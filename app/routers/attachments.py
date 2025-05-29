from fastapi import APIRouter, UploadFile, File, HTTPException, Depends, Form, Query
from fastapi.responses import StreamingResponse
from typing import List, Optional
import os
from datetime import datetime, timedelta
from bson import ObjectId
from jose import JWTError, jwt
from fastapi import status

from app.core.minio_client import minio_client, ATTACHMENT_BUCKET_NAME
from app.models.attachment import AttachmentCreate, AttachmentInDB
from app.auth.utils import get_current_user, db, SECRET_KEY, ALGORITHM

router = APIRouter()

@router.post("/upload", response_model=List[AttachmentInDB])
async def upload_attachment(
    files: List[UploadFile] = File(...),
    current_user = Depends(get_current_user)
):
    results = []
    
    for file in files:
        # 生成唯一的文件名
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        extension = os.path.splitext(file.filename)[1]
        unique_filename = f"{timestamp}_{file.filename}"
        
        # 读取文件内容并计算大小
        file_content = await file.read()
        file_size = len(file_content)
        
        # 上传到MinIO
        try:
            # 创建一个BytesIO对象，因为MinIO需要可读的文件对象
            from io import BytesIO
            file_stream = BytesIO(file_content)
            
            minio_client.put_object(
                ATTACHMENT_BUCKET_NAME,
                unique_filename,
                file_stream,
                file_size,
                content_type=file.content_type
            )
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"文件上传失败: {str(e)}")

        # 创建数据库记录
        attachment_dict = {
            "filename": file.filename,
            "size": file_size,
            "extension": extension,
            "related_instance": None,  # 默认值为None
            "minio_path": unique_filename,
            "upload_time": datetime.utcnow()
        }
        
        # 插入数据库并获取MongoDB生成的ID
        result = await db.attachments.insert_one(attachment_dict)
        attachment_dict["_id"] = result.inserted_id
        
        results.append(AttachmentInDB(**attachment_dict))
    
    return results

@router.get("/list", response_model=List[AttachmentInDB])
async def list_attachments(
    current_user = Depends(get_current_user)
):
    attachments = await db.attachments.find().to_list(length=None)
    return [AttachmentInDB(**attachment) for attachment in attachments]

@router.get("/download/{attachment_id}")
async def download_attachment(
    attachment_id: str,
    token: Optional[str] = Query(None)
):
    try:
        # 验证token
        if not token:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="未提供认证令牌",
                headers={"WWW-Authenticate": "Bearer"},
            )
            
        try:
            payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
            username: str = payload.get("sub")
            if username is None:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="无效的认证令牌",
                    headers={"WWW-Authenticate": "Bearer"},
                )
        except JWTError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="无效的认证令牌",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        # 获取附件信息
        attachment = await db.attachments.find_one({"_id": ObjectId(attachment_id)})
        if not attachment:
            raise HTTPException(status_code=404, detail="附件不存在")
        
        # 生成预签名URL（有效期1小时）
        presigned_url = minio_client.presigned_get_object(
            ATTACHMENT_BUCKET_NAME,
            attachment["minio_path"],
            expires=timedelta(hours=1)
        )
        
        return {"download_url": presigned_url}
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=f"文件下载失败: {str(e)}")

@router.delete("/{attachment_id}")
async def delete_attachment(
    attachment_id: str,
    current_user = Depends(get_current_user)
):
    try:
        # 获取附件信息
        attachment = await db.attachments.find_one({"_id": ObjectId(attachment_id)})
        if not attachment:
            raise HTTPException(status_code=404, detail="附件不存在")
        
        # 从MinIO删除文件
        minio_client.remove_object(
            ATTACHMENT_BUCKET_NAME,
            attachment["minio_path"]
        )
        
        # 从数据库删除记录
        await db.attachments.delete_one({"_id": ObjectId(attachment_id)})
        
        return {"message": "附件删除成功"}
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=f"附件删除失败: {str(e)}")

@router.put("/{attachment_id}/related-model")
async def update_related_instance(
    attachment_id: str,
    related_instance: str,
    current_user = Depends(get_current_user)
):
    try:
        # 检查附件是否存在
        attachment = await db.attachments.find_one({"_id": ObjectId(attachment_id)})
        if not attachment:
            raise HTTPException(status_code=404, detail="附件不存在")
        
        # 更新关联模型
        result = await db.attachments.update_one(
            {"_id": ObjectId(attachment_id)},
            {"$set": {"related_instance": related_instance}}
        )
        
        if result.modified_count == 0:
            raise HTTPException(status_code=404, detail="附件不存在")
        
        return {"message": "关联模型更新成功"}
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=f"更新关联模型失败: {str(e)}") 