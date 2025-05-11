from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Body, Form, Query
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
from bson import ObjectId
from math import ceil
import json
from io import BytesIO
import os
import uuid
import base64
from PIL import Image

from app.models.user import UserInDB
from app.models.file import PublicModelMetadata
from app.auth.utils import get_current_active_user, db
from app.core.minio_client import minio_client, PUBLIC_MODEL_BUCKET_NAME, PREVIEW_BUCKET_NAME

router = APIRouter(
    tags=["公共模型"]
)

# 权限检查函数
def is_admin_user(current_user: UserInDB = Depends(get_current_active_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="只有管理员可以操作公共模型")
    return current_user

# 数据模型结构
class PaginatedResponse(Dict[str, Any]):
    pass

@router.post("/upload", response_model=PublicModelMetadata)
async def upload_public_model(
    file: UploadFile = File(...),
    metadata: str = Form(...),
    current_user: UserInDB = Depends(is_admin_user)
):
    """
    上传公共模型（仅管理员）
    
    - **file**: GLB格式模型文件
    - **metadata**: 包含category、sub_category等信息的JSON字符串
    """
    file_extension = file.filename.split('.')[-1].lower()
    # 公共模型仅支持glb格式
    if file_extension != 'glb':
        raise HTTPException(
            status_code=400,
            detail="公共模型仅支持GLB格式"
        )
    try:
        file_data = await file.read()
        file_path = f"{datetime.now().strftime('%Y%m%d_%H%M%S')}_{file.filename}"
        file_stream = BytesIO(file_data)
        minio_client.put_object(
            PUBLIC_MODEL_BUCKET_NAME,
            file_path,
            file_stream,
            len(file_data),
            content_type=f"application/{file_extension}"
        )
        
        # 解析元数据JSON
        metadata_dict = json.loads(metadata)
        
        # 验证必填字段
        if "category" not in metadata_dict:
            raise HTTPException(status_code=400, detail="缺少必填字段: category")
        
        # 确保category是单个字符串而非数组
        if isinstance(metadata_dict.get("category"), list):
            metadata_dict["category"] = metadata_dict["category"][0] if metadata_dict["category"] else ""
            
        # 确保sub_category是单个字符串而非数组
        if isinstance(metadata_dict.get("sub_category"), list):
            metadata_dict["sub_category"] = metadata_dict["sub_category"][0] if metadata_dict["sub_category"] else None
            
        # 添加其他必要字段
        metadata_dict.update({
            "filename": file.filename,
            "file_path": file_path,
            "upload_date": datetime.now(),
            "file_size": len(file_data),
            "created_by": str(current_user.id),
            "created_by_username": current_user.username,
            "download_count": 0,
            "is_featured": metadata_dict.get("is_featured", False),
            "tags": metadata_dict.get("tags", [])
        })
        
        result = await db.public_models.insert_one(metadata_dict)
        metadata_dict["_id"] = str(result.inserted_id)
        
        return metadata_dict
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/list", response_model=PaginatedResponse)
async def list_public_models(
    page: int = Query(1, ge=1, description="页码"),
    limit: int = Query(10, ge=1, le=100, description="每页数量"),
    category: Optional[str] = Query(None, description="按分类筛选"),
    sub_category: Optional[str] = Query(None, description="按子分类筛选"),
    tag: Optional[str] = Query(None, description="按标签筛选"),
    search: Optional[str] = Query(None, description="搜索关键词"),
    featured: Optional[bool] = Query(None, description="是否只显示推荐模型")
):
    """
    获取公共模型列表（支持分页、筛选和搜索）
    
    - **page**: 页码，默认1
    - **limit**: 每页数量，默认10
    - **category**: 分类筛选
    - **sub_category**: 子分类筛选
    - **tag**: 标签筛选
    - **search**: 搜索关键词
    - **featured**: 是否只显示推荐模型
    """
    try:
        # 构建查询条件
        query = {}
        
        if category:
            query["category"] = category
            
        if sub_category:
            query["sub_category"] = sub_category
            
        if tag:
            query["tags"] = tag
            
        if featured is not None:
            query["is_featured"] = featured
            
        if search:
            # 在多个字段中搜索关键词
            query["$or"] = [
                {"filename": {"$regex": search, "$options": "i"}},
                {"description": {"$regex": search, "$options": "i"}},
                {"tags": {"$regex": search, "$options": "i"}}
            ]
        
        # 计算总数
        total_count = await db.public_models.count_documents(query)
        total_pages = ceil(total_count / limit)
        
        # 获取当前页数据
        skip = (page - 1) * limit
        cursor = db.public_models.find(query).sort("upload_date", -1).skip(skip).limit(limit)
        models = await cursor.to_list(length=limit)
        
        # 转换ObjectId为字符串
        for model in models:
            model["_id"] = str(model["_id"])
            if "created_by" in model and isinstance(model["created_by"], ObjectId):
                model["created_by"] = str(model["created_by"])
        
        # 获取下载链接
        for model in models:
            url = minio_client.presigned_get_object(PUBLIC_MODEL_BUCKET_NAME, model["file_path"])
            model["download_url"] = url
        
        return {
            "items": models,
            "total": total_count,
            "page": page,
            "size": limit,
            "pages": total_pages
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/categories", response_model=Dict[str, List[str]])
async def get_categories():
    """
    获取所有分类和子分类
    
    返回格式: 
    {
      "category1": ["sub_category1", "sub_category2"],
      "category2": ["sub_category3", "sub_category4"]
    }
    """
    try:
        # 聚合查询获取所有分类和子分类
        pipeline = [
            {
                "$group": {
                    "_id": "$category",
                    "sub_categories": {"$addToSet": "$sub_category"}
                }
            }
        ]
        
        result = await db.public_models.aggregate(pipeline).to_list(length=None)
        
        # 整理返回结果
        categories = {}
        for item in result:
            category = item["_id"]
            sub_categories = [sc for sc in item["sub_categories"] if sc]  # 过滤None值
            categories[category] = sub_categories
            
        return categories
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/tags", response_model=Dict[str, List[str]])
async def get_tags_by_category(
    category: Optional[str] = Query(None, description="分类名称，不提供则返回所有分类的标签")
):
    """
    获取分类下的所有标签
    
    - **category**: 分类名称，不提供则返回所有分类的标签
    
    返回格式:
    {
      "category1": ["tag1", "tag2"],
      "category2": ["tag3", "tag4"]
    }
    或者
    {
      "tags": ["tag1", "tag2", "tag3"]
    }
    """
    try:
        if category:
            # 查询特定分类下的所有标签
            pipeline = [
                {"$match": {"category": category}},
                {"$unwind": "$tags"},
                {"$group": {"_id": None, "tags": {"$addToSet": "$tags"}}},
                {"$project": {"_id": 0, "tags": 1}}
            ]
            
            result = await db.public_models.aggregate(pipeline).to_list(length=None)
            if not result:
                return {"tags": []}
            return {"tags": result[0].get("tags", [])}
        else:
            # 查询所有分类及其标签
            pipeline = [
                {"$unwind": "$tags"},
                {"$group": {"_id": "$category", "tags": {"$addToSet": "$tags"}}},
                {"$project": {"category": "$_id", "tags": 1, "_id": 0}}
            ]
            
            result = await db.public_models.aggregate(pipeline).to_list(length=None)
            
            # 整理返回结果
            tags_by_category = {}
            for item in result:
                category = item["category"]
                tags = item["tags"]
                tags_by_category[category] = tags
                
            return tags_by_category
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/search", response_model=PaginatedResponse)
async def search_public_models(
    query: str = Query(..., description="搜索关键词"),
    category: Optional[str] = Query(None, description="限制在特定分类中搜索"),
    tags: Optional[List[str]] = Query(None, description="限制在包含特定标签的模型中搜索"),
    page: int = Query(1, ge=1, description="页码"),
    limit: int = Query(10, ge=1, le=100, description="每页数量")
):
    """
    搜索公共模型
    
    - **query**: 搜索关键词
    - **category**: 限制在特定分类中搜索
    - **tags**: 限制在包含特定标签的模型中搜索
    - **page**: 页码，默认1
    - **limit**: 每页数量，默认10
    """
    try:
        # 构建查询条件
        search_query = {
            "$or": [
                {"filename": {"$regex": query, "$options": "i"}},
                {"description": {"$regex": query, "$options": "i"}},
                {"tags": {"$regex": query, "$options": "i"}},
                {"category": {"$regex": query, "$options": "i"}},
                {"sub_category": {"$regex": query, "$options": "i"}}
            ]
        }
        
        # 添加分类筛选条件
        if category:
            search_query["category"] = category
            
        # 添加标签筛选条件
        if tags:
            search_query["tags"] = {"$all": tags}
            
        # 计算总数
        total_count = await db.public_models.count_documents(search_query)
        total_pages = ceil(total_count / limit)
        
        # 获取当前页数据
        skip = (page - 1) * limit
        cursor = db.public_models.find(search_query).sort("upload_date", -1).skip(skip).limit(limit)
        models = await cursor.to_list(length=limit)
        
        # 转换ObjectId为字符串
        for model in models:
            model["_id"] = str(model["_id"])
            if "created_by" in model and isinstance(model["created_by"], ObjectId):
                model["created_by"] = str(model["created_by"])
                
        # 获取下载链接
        for model in models:
            url = minio_client.presigned_get_object(PUBLIC_MODEL_BUCKET_NAME, model["file_path"])
            model["download_url"] = url
            
        return {
            "items": models,
            "total": total_count,
            "page": page,
            "size": limit,
            "pages": total_pages,
            "query": query
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/by-category/{category}", response_model=PaginatedResponse)
async def get_models_by_category(
    category: str,
    sub_category: Optional[str] = Query(None, description="子分类"),
    page: int = Query(1, ge=1, description="页码"),
    limit: int = Query(10, ge=1, le=100, description="每页数量"),
    featured: Optional[bool] = Query(None, description="是否只显示推荐模型")
):
    """
    按分类获取公共模型
    
    - **category**: 分类名称
    - **sub_category**: 子分类名称（可选）
    - **page**: 页码，默认1
    - **limit**: 每页数量，默认10
    - **featured**: 是否只显示推荐模型
    """
    try:
        # 构建查询条件
        query = {"category": category}
        
        if sub_category:
            query["sub_category"] = sub_category
            
        if featured is not None:
            query["is_featured"] = featured
            
        # 计算总数
        total_count = await db.public_models.count_documents(query)
        total_pages = ceil(total_count / limit)
        
        # 获取当前页数据
        skip = (page - 1) * limit
        cursor = db.public_models.find(query).sort("upload_date", -1).skip(skip).limit(limit)
        models = await cursor.to_list(length=limit)
        
        # 转换ObjectId为字符串
        for model in models:
            model["_id"] = str(model["_id"])
            if "created_by" in model and isinstance(model["created_by"], ObjectId):
                model["created_by"] = str(model["created_by"])
                
        # 获取下载链接
        for model in models:
            url = minio_client.presigned_get_object(PUBLIC_MODEL_BUCKET_NAME, model["file_path"])
            model["download_url"] = url
            
        return {
            "items": models,
            "total": total_count,
            "page": page,
            "size": limit,
            "pages": total_pages,
            "category": category,
            "sub_category": sub_category
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{file_id}", response_model=PublicModelMetadata)
async def get_public_model(file_id: str):
    """
    获取公共模型详情
    
    - **file_id**: 文件ID
    """
    try:
        file_metadata = await db.public_models.find_one({"_id": ObjectId(file_id)})
        if not file_metadata:
            raise HTTPException(status_code=404, detail="模型不存在")
        
        # 转换ObjectId为字符串
        file_metadata["_id"] = str(file_metadata["_id"])
        if "created_by" in file_metadata and isinstance(file_metadata["created_by"], ObjectId):
            file_metadata["created_by"] = str(file_metadata["created_by"])
            
        # 获取下载链接
        url = minio_client.presigned_get_object(PUBLIC_MODEL_BUCKET_NAME, file_metadata["file_path"])
        file_metadata["download_url"] = url
        
        return file_metadata
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{file_id}", response_model=dict)
async def delete_public_model(file_id: str, current_user: UserInDB = Depends(is_admin_user)):
    """
    删除公共模型（仅管理员）
    
    - **file_id**: 文件ID
    """
    try:
        file_info = await db.public_models.find_one({"_id": ObjectId(file_id)})
        if not file_info:
            raise HTTPException(status_code=404, detail="模型不存在")
            
        # 删除MinIO中的文件
        try:
            minio_client.remove_object(PUBLIC_MODEL_BUCKET_NAME, file_info["file_path"])
            
            # 如果有预览图，也一并删除
            if file_info.get("preview_image"):
                preview_filename = file_info["preview_image"].split("/")[-1]
                minio_client.remove_object(PREVIEW_BUCKET_NAME, preview_filename)
        except Exception as e:
            # 继续执行，即使MinIO删除失败
            print(f"删除MinIO文件失败: {str(e)}")
            
        # 删除MongoDB中的记录
        await db.public_models.delete_one({"_id": ObjectId(file_id)})
        
        return {"message": "公共模型删除成功"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/{file_id}", response_model=PublicModelMetadata)
async def update_public_model(
    file_id: str,
    update_data: dict = Body(...),
    current_user: UserInDB = Depends(is_admin_user)
):
    """
    更新公共模型信息（仅管理员）
    
    - **file_id**: 文件ID
    - **update_data**: 更新数据，可包含description、tags、category、sub_category、is_featured等字段
    """
    try:
        file_info = await db.public_models.find_one({"_id": ObjectId(file_id)})
        if not file_info:
            raise HTTPException(status_code=404, detail="模型不存在")
        
        # 确保category是单个字符串而非数组
        if isinstance(update_data.get("category"), list):
            update_data["category"] = update_data["category"][0] if update_data["category"] else ""
            
        # 确保sub_category是单个字符串而非数组
        if isinstance(update_data.get("sub_category"), list):
            update_data["sub_category"] = update_data["sub_category"][0] if update_data["sub_category"] else None
            
        # 筛选允许更新的字段
        allowed_fields = [
            "description", "tags", "category", "sub_category", 
            "is_featured", "filename"
        ]
        
        db_update_data = {k: v for k, v in update_data.items() if k in allowed_fields}
        
        # 添加更新时间
        db_update_data["updated_at"] = datetime.now()
        
        # 更新数据库
        await db.public_models.update_one(
            {"_id": ObjectId(file_id)},
            {"$set": db_update_data}
        )
        
        # 返回更新后的数据
        updated_file = await db.public_models.find_one({"_id": ObjectId(file_id)})
        
        # 转换ObjectId为字符串
        updated_file["_id"] = str(updated_file["_id"])
        if "created_by" in updated_file and isinstance(updated_file["created_by"], ObjectId):
            updated_file["created_by"] = str(updated_file["created_by"])
        
        # 获取下载链接
        url = minio_client.presigned_get_object(PUBLIC_MODEL_BUCKET_NAME, updated_file["file_path"])
        updated_file["download_url"] = url
        
        return updated_file
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{file_id}/download", response_model=dict)
async def record_download(file_id: str):
    """
    记录下载并返回下载链接
    
    - **file_id**: 文件ID
    """
    try:
        file_info = await db.public_models.find_one({"_id": ObjectId(file_id)})
        if not file_info:
            raise HTTPException(status_code=404, detail="模型不存在")
            
        # 更新下载计数
        await db.public_models.update_one(
            {"_id": ObjectId(file_id)},
            {"$inc": {"download_count": 1}}
        )
        
        # 获取下载链接，使用timedelta而不是整数
        url = minio_client.presigned_get_object(
            PUBLIC_MODEL_BUCKET_NAME, 
            file_info["file_path"],
            expires=timedelta(seconds=3600)  # 链接有效期1小时
        )
        
        return {
            "file_id": file_id,
            "filename": file_info.get("filename", ""),
            "download_url": url
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/{file_id}/preview-image", response_model=dict)
async def update_public_model_preview(
    file_id: str,
    data: dict = Body(...),
    current_user: UserInDB = Depends(is_admin_user)
):
    """
    更新公共模型的预览图（base64），保存到MinIO并更新MongoDB
    
    - **file_id**: 文件ID
    - **data**: {"preview_image": base64字符串}
    """
    try:
        # 检查文件是否存在
        file_info = await db.public_models.find_one({"_id": ObjectId(file_id)})
        if not file_info:
            raise HTTPException(status_code=404, detail="模型不存在")
            
        # 解析base64字符串
        preview_image_b64 = data.get("preview_image", "")
        header, b64data = preview_image_b64.split(',', 1) if ',' in preview_image_b64 else ('', preview_image_b64)
        image_data = base64.b64decode(b64data)
        image = Image.open(BytesIO(image_data))
        
        # 保存为PNG到内存
        buffer = BytesIO()
        image.save(buffer, format="PNG")
        buffer.seek(0)
        
        # 上传到MinIO
        filename = f"public_{file_id}_{uuid.uuid4().hex}.png"
        minio_client.put_object(
            PREVIEW_BUCKET_NAME,
            filename,
            buffer,
            length=buffer.getbuffer().nbytes,
            content_type="image/png"
        )
        
        # 获取公开URL
        minio_scheme = "https" if os.getenv("MINIO_SECURE", "false").lower() == "true" else "http"
        minio_host = f"{minio_scheme}://{os.getenv('MINIO_HOST')}:{os.getenv('MINIO_PORT')}"
        preview_url = f"{minio_host}/{PREVIEW_BUCKET_NAME}/{filename}"
        
        # 更新MongoDB
        await db.public_models.update_one(
            {"_id": ObjectId(file_id)},
            {"$set": {"preview_image": preview_url, "updated_at": datetime.now()}}
        )
        
        return {"file_id": file_id, "preview_image": preview_url}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/featured/list", response_model=List[PublicModelMetadata])
async def get_featured_models(limit: int = Query(10, ge=1, le=100, description="返回数量")):
    """
    获取推荐公共模型
    
    - **limit**: 返回数量，默认10
    """
    try:
        models = await db.public_models.find(
            {"is_featured": True}
        ).sort("download_count", -1).limit(limit).to_list(length=limit)
        
        # 转换ObjectId为字符串
        for model in models:
            model["_id"] = str(model["_id"])
            if "created_by" in model and isinstance(model["created_by"], ObjectId):
                model["created_by"] = str(model["created_by"])
                
        # 添加下载链接
        for model in models:
            url = minio_client.presigned_get_object(PUBLIC_MODEL_BUCKET_NAME, model["file_path"])
            model["download_url"] = url
            
        return models
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/popular/list", response_model=List[PublicModelMetadata])
async def get_popular_models(
    limit: int = Query(10, ge=1, le=100, description="返回数量"),
    category: Optional[str] = Query(None, description="限制特定分类")
):
    """
    获取热门公共模型（按下载量排序）
    
    - **limit**: 返回数量，默认10
    - **category**: 限制特定分类
    """
    try:
        query = {}
        if category:
            query["category"] = category
            
        models = await db.public_models.find(
            query
        ).sort("download_count", -1).limit(limit).to_list(length=limit)
        
        # 转换ObjectId为字符串
        for model in models:
            model["_id"] = str(model["_id"])
            if "created_by" in model and isinstance(model["created_by"], ObjectId):
                model["created_by"] = str(model["created_by"])
                
        # 添加下载链接
        for model in models:
            url = minio_client.presigned_get_object(PUBLIC_MODEL_BUCKET_NAME, model["file_path"])
            model["download_url"] = url
            
        return models
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/latest/list", response_model=List[PublicModelMetadata])
async def get_latest_models(
    limit: int = Query(10, ge=1, le=100, description="返回数量"),
    category: Optional[str] = Query(None, description="限制特定分类")
):
    """
    获取最新公共模型
    
    - **limit**: 返回数量，默认10
    - **category**: 限制特定分类
    """
    try:
        query = {}
        if category:
            query["category"] = category
            
        models = await db.public_models.find(
            query
        ).sort("upload_date", -1).limit(limit).to_list(length=limit)
        
        # 转换ObjectId为字符串
        for model in models:
            model["_id"] = str(model["_id"])
            if "created_by" in model and isinstance(model["created_by"], ObjectId):
                model["created_by"] = str(model["created_by"])
                
        # 添加下载链接
        for model in models:
            url = minio_client.presigned_get_object(PUBLIC_MODEL_BUCKET_NAME, model["file_path"])
            model["download_url"] = url
            
        return models
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) 