from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field
# 假设 PyObjectId 从 user 模型或其他公共模型文件导入
from .user import PyObjectId # 或者一个更通用的共享模型文件
# from bson import ObjectId # 如果 PyObjectId 被导入，这个可能不再直接需要

class AttachmentBase(BaseModel):
    filename: str
    size: int
    extension: str
    related_instance: Optional[str] = None # 考虑这个是否应该是 PyObjectId

class AttachmentCreate(AttachmentBase):
    pass

class AttachmentInDB(AttachmentBase):
    # 使用导入的 PyObjectId
    id: PyObjectId = Field(default_factory=PyObjectId, alias="_id")
    upload_time: datetime = Field(default_factory=datetime.utcnow)
    minio_path: str

    # Pydantic V2 使用 model_config
    model_config = {
        "populate_by_name": True,
        "arbitrary_types_allowed": True
        # json_encoders 通常在类型级别处理或通过 model_dump/load 自定义
    } 