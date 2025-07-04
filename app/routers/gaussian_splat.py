from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from motor.motor_asyncio import AsyncIOMotorDatabase
from fastapi.responses import StreamingResponse
from typing import List, Optional
from datetime import datetime
from bson import ObjectId
import os
import uuid
import logging
from io import BytesIO

from app.models.user import UserInDB
from app.models.gaussian_splat import (
    GaussianSplatMetadata,
    GaussianSplatCreate,
    GaussianSplatUpdate,
    GaussianSplatResponse
)
from app.auth.utils import get_current_active_user, db
from app.core.minio_client import minio_client, GAUSSIAN_SPLAT_BUCKET_NAME

logger = logging.getLogger(__name__)

router = APIRouter()

@router.post("/upload", response_model=GaussianSplatResponse)
async def upload_gaussian_splat(
    file: UploadFile = File(...),
    description: Optional[str] = Form(None),
    tags: Optional[str] = Form(None),
    is_public: bool = Form(False),
    current_user: UserInDB = Depends(get_current_active_user)
):
    """上传高斯泼溅文件"""
    try:
        # 验证文件格式
        allowed_extensions = ['.ply', '.splat', '.spz']
        file_extension = os.path.splitext(file.filename)[1].lower()
        
        if file_extension not in allowed_extensions:
            raise HTTPException(
                status_code=400,
                detail=f"不支持的文件格式。支持的格式：{', '.join(allowed_extensions)}"
            )
        
        # 读取文件数据
        file_data = await file.read()
        file_size = len(file_data)
        
        # 生成文件路径
        file_path = f"{current_user.id}/{datetime.now().strftime('%Y%m%d_%H%M%S')}_{file.filename}"
        
        # 上传到MinIO
        minio_client.put_object(
            GAUSSIAN_SPLAT_BUCKET_NAME,
            file_path,
            BytesIO(file_data),
            length=file_size,
            content_type=file.content_type or 'application/octet-stream'
        )
        
        # 解析标签
        tag_list = []
        if tags:
            tag_list = [tag.strip() for tag in tags.split(',') if tag.strip()]
        
        # 创建高斯泼溅元数据
        gaussian_splat_data = GaussianSplatMetadata(
            filename=file.filename,
            file_path=file_path,
            user_id=current_user.id,
            username=current_user.username,
            description=description,
            tags=tag_list,
            is_public=is_public,
            upload_date=datetime.now(),
            file_size=file_size,
            format=file_extension[1:]  # 去掉点号
        )
        
        # 保存到数据库
        result = await db.gaussian_splats.insert_one(gaussian_splat_data.model_dump(by_alias=True))
        
        # 返回结果
        return GaussianSplatResponse(
            id=str(result.inserted_id),
            filename=gaussian_splat_data.filename,
            file_path=gaussian_splat_data.file_path,
            user_id=str(gaussian_splat_data.user_id),
            username=gaussian_splat_data.username,
            description=gaussian_splat_data.description,
            tags=gaussian_splat_data.tags,
            is_public=gaussian_splat_data.is_public,
            upload_date=gaussian_splat_data.upload_date,
            file_size=gaussian_splat_data.file_size,
            format=gaussian_splat_data.format,
            point_count=gaussian_splat_data.point_count,
            position=gaussian_splat_data.position,
            rotation=gaussian_splat_data.rotation,
            scale=gaussian_splat_data.scale,
            opacity=gaussian_splat_data.opacity,
            show=gaussian_splat_data.show
        )
        
    except Exception as e:
        logger.error(f"上传高斯泼溅文件失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"上传失败: {str(e)}")


@router.get("/", response_model=List[GaussianSplatResponse])
async def get_gaussian_splats(
    skip: int = 0,
    limit: int = 100,
    tags: Optional[str] = None,
    is_public: Optional[bool] = None,
    current_user: UserInDB = Depends(get_current_active_user)
):
    """获取高斯泼溅列表"""
    try:
        # 构建查询条件
        query = {}
        
        # 如果不是管理员，只能看到自己的和公开的
        if current_user.role != "admin":
            query["$or"] = [
                {"user_id": current_user.id},
                {"is_public": True}
            ]
        
        # 标签过滤
        if tags:
            tag_list = [tag.strip() for tag in tags.split(',') if tag.strip()]
            query["tags"] = {"$in": tag_list}
        
        # 公开状态过滤
        if is_public is not None:
            query["is_public"] = is_public
        
        # 查询数据
        cursor = db.gaussian_splats.find(query).skip(skip).limit(limit)
        gaussian_splats = await cursor.to_list(length=limit)
        
        # 转换为响应格式
        result = []
        for splat in gaussian_splats:
            result.append(GaussianSplatResponse(
                id=str(splat["_id"]),
                filename=splat["filename"],
                file_path=splat["file_path"],
                user_id=str(splat["user_id"]),
                username=splat["username"],
                description=splat.get("description"),
                tags=splat.get("tags", []),
                is_public=splat.get("is_public", False),
                upload_date=splat["upload_date"],
                file_size=splat["file_size"],
                format=splat.get("format", "ply"),
                point_count=splat.get("point_count"),
                position=splat.get("position"),
                rotation=splat.get("rotation"),
                scale=splat.get("scale"),
                opacity=splat.get("opacity", 1.0),
                show=splat.get("show", True)
            ))
        
        return result
        
    except Exception as e:
        logger.error(f"获取高斯泼溅列表失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"获取列表失败: {str(e)}")


@router.get("/{splat_id}", response_model=GaussianSplatResponse)
async def get_gaussian_splat(
    splat_id: str,
    current_user: UserInDB = Depends(get_current_active_user)
):
    """获取单个高斯泼溅"""
    try:
        # 查询数据
        splat = await db.gaussian_splats.find_one({"_id": ObjectId(splat_id)})
        
        if not splat:
            raise HTTPException(status_code=404, detail="高斯泼溅不存在")
        
        # 检查权限
        if current_user.role != "admin" and splat["user_id"] != current_user.id and not splat.get("is_public", False):
            raise HTTPException(status_code=403, detail="无权访问此资源")
        
        return GaussianSplatResponse(
            id=str(splat["_id"]),
            filename=splat["filename"],
            file_path=splat["file_path"],
            user_id=str(splat["user_id"]),
            username=splat["username"],
            description=splat.get("description"),
            tags=splat.get("tags", []),
            is_public=splat.get("is_public", False),
            upload_date=splat["upload_date"],
            file_size=splat["file_size"],
            format=splat.get("format", "ply"),
            point_count=splat.get("point_count"),
            position=splat.get("position"),
            rotation=splat.get("rotation"),
            scale=splat.get("scale"),
            opacity=splat.get("opacity", 1.0),
            show=splat.get("show", True)
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取高斯泼溅失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"获取失败: {str(e)}")


@router.put("/{splat_id}", response_model=GaussianSplatResponse)
async def update_gaussian_splat(
    splat_id: str,
    update_data: GaussianSplatUpdate,
    current_user: UserInDB = Depends(get_current_active_user)
):
    """更新高斯泼溅"""
    try:
        # 查询数据
        splat = await db.gaussian_splats.find_one({"_id": ObjectId(splat_id)})
        
        if not splat:
            raise HTTPException(status_code=404, detail="高斯泼溅不存在")
        
        # 检查权限
        if current_user.role != "admin" and splat["user_id"] != current_user.id:
            raise HTTPException(status_code=403, detail="无权修改此资源")
        
        # 构建更新数据
        update_dict = {}
        if update_data.description is not None:
            update_dict["description"] = update_data.description
        if update_data.tags is not None:
            update_dict["tags"] = update_data.tags
        if update_data.is_public is not None:
            update_dict["is_public"] = update_data.is_public
        if update_data.position is not None:
            update_dict["position"] = update_data.position
        if update_data.rotation is not None:
            update_dict["rotation"] = update_data.rotation
        if update_data.scale is not None:
            update_dict["scale"] = update_data.scale
        if update_data.opacity is not None:
            update_dict["opacity"] = update_data.opacity
        if update_data.show is not None:
            update_dict["show"] = update_data.show
        
        if update_dict:
            # 更新数据库
            await db.gaussian_splats.update_one(
                {"_id": ObjectId(splat_id)},
                {"$set": update_dict}
            )
        
        # 返回更新后的数据
        updated_splat = await db.gaussian_splats.find_one({"_id": ObjectId(splat_id)})
        
        return GaussianSplatResponse(
            id=str(updated_splat["_id"]),
            filename=updated_splat["filename"],
            file_path=updated_splat["file_path"],
            user_id=str(updated_splat["user_id"]),
            username=updated_splat["username"],
            description=updated_splat.get("description"),
            tags=updated_splat.get("tags", []),
            is_public=updated_splat.get("is_public", False),
            upload_date=updated_splat["upload_date"],
            file_size=updated_splat["file_size"],
            format=updated_splat.get("format", "ply"),
            point_count=updated_splat.get("point_count"),
            position=updated_splat.get("position"),
            rotation=updated_splat.get("rotation"),
            scale=updated_splat.get("scale"),
            opacity=updated_splat.get("opacity", 1.0),
            show=updated_splat.get("show", True)
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"更新高斯泼溅失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"更新失败: {str(e)}")


@router.delete("/{splat_id}")
async def delete_gaussian_splat(
    splat_id: str,
    current_user: UserInDB = Depends(get_current_active_user)
):
    """删除高斯泼溅"""
    try:
        # 查询数据
        splat = await db.gaussian_splats.find_one({"_id": ObjectId(splat_id)})
        
        if not splat:
            raise HTTPException(status_code=404, detail="高斯泼溅不存在")
        
        # 检查权限
        if current_user.role != "admin" and splat["user_id"] != current_user.id:
            raise HTTPException(status_code=403, detail="无权删除此资源")
        
        # 删除MinIO中的文件
        try:
            minio_client.remove_object(GAUSSIAN_SPLAT_BUCKET_NAME, splat["file_path"])
        except Exception as e:
            logger.warning(f"删除MinIO文件失败: {str(e)}")
        
        # 删除数据库记录
        await db.gaussian_splats.delete_one({"_id": ObjectId(splat_id)})
        
        return {"message": "高斯泼溅删除成功"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"删除高斯泼溅失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"删除失败: {str(e)}")


@router.get("/{splat_id}/download")
async def download_gaussian_splat(
    splat_id: str,
    current_user: UserInDB = Depends(get_current_active_user)
):
    """下载高斯泼溅文件"""
    try:
        # 查询数据
        splat = await db.gaussian_splats.find_one({"_id": ObjectId(splat_id)})
        
        if not splat:
            raise HTTPException(status_code=404, detail="高斯泼溅不存在")
        
        # 检查权限
        if current_user.role != "admin" and splat["user_id"] != current_user.id and not splat.get("is_public", False):
            raise HTTPException(status_code=403, detail="无权访问此资源")
        
        # 从MinIO获取文件
        try:
            response = minio_client.get_object(GAUSSIAN_SPLAT_BUCKET_NAME, splat["file_path"])
            file_data = response.read()
            response.close()
            
            return StreamingResponse(
                BytesIO(file_data),
                media_type="application/octet-stream",
                headers={
                    "Content-Disposition": f"attachment; filename=\"{splat['filename']}\""
                }
            )
        except Exception as e:
            logger.error(f"从MinIO下载文件失败: {str(e)}")
            raise HTTPException(status_code=500, detail="文件下载失败")
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"下载高斯泼溅失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"下载失败: {str(e)}")