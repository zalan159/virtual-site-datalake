from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Body, Form
from typing import List, Optional
from datetime import datetime
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorClient
import json
from io import BytesIO
import os
from dotenv import load_dotenv
import uuid
import base64
from PIL import Image

from app.models.user import UserInDB
from app.models.file import FileMetadata, FileShare, ConversionStatus, FileConversion
from app.auth.utils import get_current_active_user, db
from app.core.minio_client import (
    minio_client,
    minio_external_client,
    SOURCE_BUCKET_NAME,
    CONVERTED_BUCKET_NAME,
    PUBLIC_MODEL_BUCKET_NAME,
    PREVIEW_BUCKET_NAME,
)
from app.tasks.task_manager import TaskManager, TaskType
from app.utils.mongo_init import get_mongo_url

# 加载 .env 文件
load_dotenv()

# 替换 config 导入为环境变量
MONGO_URL = get_mongo_url()
MINIO_CONFIG = {
    "username": os.getenv("MINIO_USERNAME"),
    "password": os.getenv("MINIO_PASSWORD"),
    "host": os.getenv("MINIO_HOST"),
    "port": os.getenv("MINIO_PORT"),
}
CONVERTER_CONFIG = {
    "path": os.getenv("CONVERTER_PATH"),
    "program_name": os.getenv("CONVERTER_PROGRAM_NAME"),
    "default_output_format": os.getenv("CONVERTER_DEFAULT_OUTPUT_FORMAT"),
}

# 解析文件格式限制
with open(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'file_formats.json'), 'r', encoding='utf-8') as f:
    FILE_FORMATS = json.load(f)

router = APIRouter()

# 确保bucket存在
BUCKET_NAME = SOURCE_BUCKET_NAME

def get_all_supported_extensions():
    """
    从 FILE_FORMATS 中提取所有支持的扩展名
    """
    supported_extensions = []
    for format_info in FILE_FORMATS:
        supported_extensions.extend(format_info["extensions"])
    return supported_extensions

@router.get("/supported-formats", response_model=List[dict])
async def get_supported_formats():
    """
    获取所有支持的文件格式及其扩展名
    
    返回格式示例：
    [
        {"format": "GLTF", "extensions": ["GLTF", "GLB"]},
        {"format": "OBJ", "extensions": ["OBJ"]}
    ]
    """
    return FILE_FORMATS 

@router.post("/upload", response_model=FileMetadata)
async def upload_file(
    file: UploadFile = File(...), 
    metadata: str = None,
    current_user: UserInDB = Depends(get_current_active_user)
):
    """
    上传3D模型文件
    
    - **file**: 3D模型文件
    - **metadata**: 文件元数据（JSON字符串）
    - **current_user**: 当前登录用户（自动获取）
    """
    # 获取文件扩展名
    file_extension = file.filename.split('.')[-1].lower()
    
    # 检查文件扩展名是否支持
    supported_extensions = [ext.lower() for ext in get_all_supported_extensions()]
    if file_extension not in supported_extensions:
        raise HTTPException(
            status_code=400, 
            detail=f"不支持的文件格式。支持的格式: {', '.join(supported_extensions)}"
        )
    
    try:
        # 上传文件到MinIO
        file_data = await file.read()
        file_path = f"{current_user.id}/{datetime.now().strftime('%Y%m%d_%H%M%S')}_{file.filename}"
        
        # 判断是否为glb格式，若是则同时上传到转换桶和源文件桶并设置conversion为已完成
        if file_extension == "glb":
            # 上传到转换桶
            file_stream1 = BytesIO(file_data)
            minio_client.put_object(
                CONVERTED_BUCKET_NAME,
                file_path,
                file_stream1,
                len(file_data),
                content_type=f"application/{file_extension}"
            )
            # 同时上传到源文件桶
            file_stream2 = BytesIO(file_data)
            minio_client.put_object(
                SOURCE_BUCKET_NAME,
                file_path,
                file_stream2,
                len(file_data),
                content_type=f"application/{file_extension}"
            )
            # 构造conversion字段
            conversion = FileConversion(
                status=ConversionStatus.COMPLETED,
                input_format="GLB",
                output_format="GLB",
                input_file_path=file_path,
                output_file_path=file_path,
                task_id=None,
                progress=100,
                created_at=datetime.now(),
                updated_at=datetime.now()
            )
        else:
            # 上传到源文件桶
            file_stream = BytesIO(file_data)
            minio_client.put_object(
                SOURCE_BUCKET_NAME,
                file_path,
                file_stream,
                len(file_data),
                content_type=f"application/{file_extension}"
            )
            conversion = None
        
        # 存储元数据到MongoDB
        metadata_dict = json.loads(metadata) if metadata else {}
        metadata_dict.update({
            "filename": file.filename,
            "file_path": file_path,
            "upload_date": datetime.now(),
            "file_size": len(file_data),
            "user_id": current_user.id,
            "username": current_user.username,
            "is_public": False,
            "tags": []
        })
        if conversion:
            metadata_dict["conversion"] = conversion.model_dump()
        
        result = await db.files.insert_one(metadata_dict)
        metadata_dict["_id"] = result.inserted_id
        
        return FileMetadata(**metadata_dict)
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/list", response_model=List[FileMetadata])
async def list_files(current_user: UserInDB = Depends(get_current_active_user)):
    """
    获取当前用户的所有文件列表
    
    - **current_user**: 当前登录用户（自动获取）
    """
    try:
        files = await db.files.find({"user_id": current_user.id}).to_list(length=None)
        return [FileMetadata(**file) for file in files]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{file_path}", response_model=FileMetadata)
async def get_file(
    file_path: str,
    current_user: UserInDB = Depends(get_current_active_user)
):
    """
    获取特定文件的详情和下载链接
    
    - **file_path**: 文件路径
    - **current_user**: 当前登录用户（自动获取）
    """
    try:
        # 获取文件元数据
        file_metadata = await db.files.find_one({
            "file_path": file_path,
            "$or": [
                {"user_id": current_user.id},
                {"is_public": True},
                {"share_info.shared_with": current_user.id}
            ]
        })
        if not file_metadata:
            raise HTTPException(status_code=404, detail="文件不存在")
        
        # 获取文件URL
        url = minio_external_client.presigned_get_object(SOURCE_BUCKET_NAME, file_path)
        
        # 如果有转换后的文件，也获取其URL
        if file_metadata.get("conversion") and file_metadata["conversion"].get("output_file_path"):
            converted_url = minio_external_client.presigned_get_object(
                CONVERTED_BUCKET_NAME,
                file_metadata["conversion"]["output_file_path"]
            )
            file_metadata["conversion"]["download_url"] = converted_url
        
        file_metadata["download_url"] = url
        
        return FileMetadata(**file_metadata)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{file_id}", response_model=dict)
async def delete_file(
    file_id: str,
    current_user: UserInDB = Depends(get_current_active_user)
):
    """
    删除文件
    
    - **file_id**: 文件ID
    - **current_user**: 当前登录用户
    """
    # 获取文件信息
    file_info = await db.files.find_one({"_id": ObjectId(file_id)})
    if not file_info:
        raise HTTPException(status_code=404, detail="文件不存在")
    
    # 检查权限
    if file_info["user_id"] != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="没有权限删除此文件")
    
    # 删除文件
    await db.files.delete_one({"_id": ObjectId(file_id)})
    return {"message": "文件删除成功"}

@router.put("/{file_id}", response_model=FileMetadata)
async def update_file(
    file_id: str,
    update_data: dict = Body(...),
    current_user: UserInDB = Depends(get_current_active_user)
):
    """
    更新文件信息
    
    - **file_id**: 文件ID
    - **update_data**: 更新数据，包含description、tags和is_public字段
    - **current_user**: 当前登录用户
    """
    # 获取文件信息
    file_info = await db.files.find_one({"_id": ObjectId(file_id)})
    if not file_info:
        raise HTTPException(status_code=404, detail="文件不存在")
    
    # 检查权限
    if file_info["user_id"] != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="没有权限更新此文件")
    
    # 更新文件信息
    db_update_data = {}
    if "description" in update_data:
        db_update_data["description"] = update_data["description"]
    if "tags" in update_data:
        db_update_data["tags"] = update_data["tags"]
    if "is_public" in update_data:
        db_update_data["is_public"] = update_data["is_public"]
    
    db_update_data["updated_at"] = datetime.now()
    
    await db.files.update_one(
        {"_id": ObjectId(file_id)},
        {"$set": db_update_data}
    )
    
    # 返回更新后的文件信息
    updated_file = await db.files.find_one({"_id": ObjectId(file_id)})
    return FileMetadata(**updated_file)

@router.post("/{file_id}/share", response_model=FileShare)
async def share_file(
    file_id: str,
    share_info: FileShare,
    current_user: UserInDB = Depends(get_current_active_user)
):
    """
    分享文件
    
    - **file_id**: 文件ID
    - **share_info**: 分享信息
    - **current_user**: 当前登录用户
    """
    # 获取文件信息
    file_info = await db.files.find_one({"_id": ObjectId(file_id)})
    if not file_info:
        raise HTTPException(status_code=404, detail="文件不存在")
    
    # 检查权限
    if file_info["user_id"] != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="没有权限分享此文件")
    
    # 更新分享信息
    share_info_dict = share_info.model_dump()
    share_info_dict["updated_at"] = datetime.now()
    
    await db.files.update_one(
        {"_id": ObjectId(file_id)},
        {"$set": {"share_info": share_info_dict}}
    )
    
    return share_info

@router.get("/shared/list", response_model=List[FileMetadata])
async def list_shared_files(current_user: UserInDB = Depends(get_current_active_user)):
    """
    获取分享给当前用户的文件列表
    
    - **current_user**: 当前登录用户
    """
    files = await db.files.find({
        "share_info.shared_with": current_user.id
    }).to_list(length=None)
    return [FileMetadata(**file) for file in files]

@router.get("/download/{file_id}", response_model=dict)
async def get_download_url(
    file_id: str,
    current_user: UserInDB = Depends(get_current_active_user)
):
    """
    根据文件ID获取下载链接
    
    - **file_id**: 文件ID
    - **current_user**: 当前登录用户（自动获取）
    """
    try:
        # 获取文件元数据
        file_metadata = await db.files.find_one({
            "_id": ObjectId(file_id),
            "$or": [
                {"user_id": current_user.id},
                {"is_public": True},
                {"share_info.shared_with": current_user.id}
            ]
        })
        
        if not file_metadata:
            raise HTTPException(status_code=404, detail="文件不存在或无权访问")
        
        # 获取文件URL
        file_path = file_metadata.get("file_path")
        if not file_path:
            raise HTTPException(status_code=500, detail="文件路径不存在")
            
        url = minio_external_client.presigned_get_object(SOURCE_BUCKET_NAME, file_path)
        
        return {
            "file_id": str(file_metadata["_id"]),
            "filename": file_metadata.get("filename", ""),
            "download_url": url
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/download/converted/{file_id}", response_model=dict)
async def get_converted_download_url(
    file_id: str,
    current_user: UserInDB = Depends(get_current_active_user)
):
    """
    根据文件ID获取转换后文件的下载链接
    
    - **file_id**: 文件ID
    - **current_user**: 当前登录用户（自动获取）
    """
    try:
        # 获取文件元数据
        file_metadata = await db.files.find_one({
            "_id": ObjectId(file_id),
            "$or": [
                {"user_id": current_user.id},
                {"is_public": True},
                {"share_info.shared_with": current_user.id}
            ]
        })
        
        if not file_metadata:
            raise HTTPException(status_code=404, detail="文件不存在或无权访问")
        
        # 检查是否有转换后的文件
        if not file_metadata.get("conversion") or not file_metadata["conversion"].get("output_file_path"):
            raise HTTPException(status_code=404, detail="文件未转换或转换失败")
        
        # 获取转换后文件的URL
        output_file_path = file_metadata["conversion"]["output_file_path"]
        url = minio_external_client.presigned_get_object(CONVERTED_BUCKET_NAME, output_file_path)
        
        return {
            "file_id": str(file_metadata["_id"]),
            "filename": os.path.basename(output_file_path),
            "download_url": url
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{file_id}/convert", response_model=dict)
async def convert_file(
    file_id: str,
    output_format: Optional[str] = Form(None),
    current_user: UserInDB = Depends(get_current_active_user)
):
    """
    转换文件格式
    
    - **file_id**: 文件ID
    - **output_format**: 输出格式（可选，默认为配置中的默认格式）
    - **current_user**: 当前登录用户
    """
    print(f"转换文件请求: file_id={file_id}, output_format={output_format}, user={current_user.username}")
    print(f"请求参数类型: file_id={type(file_id)}, output_format={type(output_format)}")
    
    # 验证file_id是否为有效的ObjectId
    try:
        ObjectId(file_id)
        print(f"file_id是有效的ObjectId: {file_id}")
    except Exception as e:
        print(f"file_id不是有效的ObjectId: {file_id}, 错误: {str(e)}")
        raise HTTPException(status_code=422, detail=f"无效的文件ID: {file_id}")
    
    # 验证output_format是否为有效值
    valid_formats = ["GLTF", "GLB", "OBJ", "FBX"]
    if output_format and output_format not in valid_formats:
        print(f"无效的输出格式: {output_format}")
        raise HTTPException(
            status_code=422, 
            detail=f"无效的输出格式: {output_format}。支持的格式: {', '.join(valid_formats)}"
        )
    
    try:
        # 获取文件元数据
        file_metadata = await db.files.find_one({
            "_id": ObjectId(file_id),
            "$or": [
                {"user_id": current_user.id},
                {"is_public": True},
                {"share_info.shared_with": current_user.id}
            ]
        })
        
        if not file_metadata:
            print(f"文件不存在或无权访问: file_id={file_id}")
            raise HTTPException(status_code=404, detail="文件不存在或无权访问")
        
        print(f"找到文件元数据: {file_metadata.get('filename')}")
        
        # 获取文件路径
        file_path = file_metadata.get("file_path")
        if not file_path:
            print(f"文件路径不存在: file_id={file_id}")
            raise HTTPException(status_code=500, detail="文件路径不存在")
        
        # 确定输出格式
        output_format = output_format or CONVERTER_CONFIG.get("default_output_format", "GLTF")
        print(f"使用输出格式: {output_format}")
        
        # 创建转换任务
        task_manager = TaskManager()
        task = await task_manager.create_task(
            task_type=TaskType.FILE_CONVERSION,
            user_id=str(current_user.id),
            file_id=file_id,
            input_file_path=file_path,
            output_format=output_format
        )
        
        # 更新文件元数据中的转换信息
        conversion = FileConversion(
            status=ConversionStatus.PENDING,
            input_format=os.path.splitext(file_metadata["file_path"])[1][1:].upper(),
            output_format=output_format,
            input_file_path=file_path,
            task_id=task.task_id,
            progress=0,
            created_at=datetime.now(),
            updated_at=datetime.now()
        )
        
        await db.files.update_one(
            {"_id": ObjectId(file_id)},
            {"$set": {"conversion": conversion.model_dump()}}
        )
        
        # 启动任务管理器（如果尚未启动）
        if not task_manager.is_running:
            await task_manager.start()
        
        return {
            "message": "文件转换任务已创建",
            "task_id": task.task_id,
            "status": task.status,
            "progress": task.progress
        }
    
    except Exception as e:
        print(f"转换过程中发生异常: {str(e)}")
        import traceback
        print(f"异常堆栈: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/convert/status/{task_id}", response_model=dict)
async def get_conversion_status(
    task_id: str,
    current_user: UserInDB = Depends(get_current_active_user)
):
    """
    获取转换任务状态 (已弃用)
    请使用 /tasks/status/{task_id} 代替
    
    - **task_id**: 任务ID
    - **current_user**: 当前登录用户
    """
    # 发出警告日志
    import logging
    logging.warning("使用已弃用的API: /files/convert/status/{task_id}，请改用 /tasks/status/{task_id}")
    
    try:
        # 获取任务
        task_manager = TaskManager()
        task = await task_manager.get_task(task_id)
        
        if not task:
            raise HTTPException(status_code=404, detail="任务不存在")
        
        # 检查权限
        if task.user_id != str(current_user.id) and current_user.role != "admin":
            raise HTTPException(status_code=403, detail="没有权限查看此任务")
        
        # 直接转发到新的API
        from app.routers.tasks import get_task_status
        return await get_task_status(task_id, current_user)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/{file_id}/preview-image", response_model=dict)
async def update_file_preview_image(
    file_id: str,
    data: dict = Body(...),
    current_user: UserInDB = Depends(get_current_active_user)
):
    """
    更新文件的预览图（base64），保存到MinIO并更新MongoDB
    - **file_id**: 文件ID
    - **data**: {"preview_image": base64字符串}
    - **current_user**: 当前登录用户
    """
    # 1. 检查文件是否存在及权限
    file_info = await db.files.find_one({"_id": ObjectId(file_id)})
    if not file_info:
        raise HTTPException(404, "文件不存在")
    if file_info["user_id"] != current_user.id and current_user.role != "admin":
        raise HTTPException(403, "没有权限更新此文件")

    # 2. 解析base64字符串
    try:
        preview_image_b64 = data.get("preview_image", "")
        header, b64data = preview_image_b64.split(',', 1) if ',' in preview_image_b64 else ('', preview_image_b64)
        image_data = base64.b64decode(b64data)
        image = Image.open(BytesIO(image_data))
    except Exception as e:
        raise HTTPException(400, f"图片解码失败: {str(e)}")

    # 3. 保存为PNG到内存
    buffer = BytesIO()
    image.save(buffer, format="PNG")
    buffer.seek(0)

    # 4. 上传到MinIO（preview桶，文件名用file_id+uuid）
    filename = f"{file_id}_{uuid.uuid4().hex}.png"
    minio_client.put_object(
        PREVIEW_BUCKET_NAME,
        filename,
        buffer,
        length=buffer.getbuffer().nbytes,
        content_type="image/png"
    )

    # 5. 获取公开URL
    minio_scheme = "https" if os.getenv("MINIO_SECURE", "false").lower() == "true" else "http"
    minio_host = f"{minio_scheme}://{os.getenv('MINIO_EXTERNAL_HOST', os.getenv('MINIO_HOST'))}:{os.getenv('MINIO_PORT')}"
    preview_url = f"{minio_host}/{PREVIEW_BUCKET_NAME}/{filename}"

    # 6. 更新MongoDB
    await db.files.update_one(
        {"_id": ObjectId(file_id)},
        {"$set": {"preview_image": preview_url, "updated_at": datetime.now()}}
    )

    return {"file_id": file_id, "preview_image": preview_url}

