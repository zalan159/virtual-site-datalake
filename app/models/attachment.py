from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field
from bson import ObjectId

class PyObjectId(ObjectId):
    @classmethod
    def __get_validators__(cls):
        yield cls.validate

    @classmethod
    def validate(cls, v):
        if not ObjectId.is_valid(v):
            raise ValueError("Invalid ObjectId")
        return ObjectId(v)

    @classmethod
    def __get_pydantic_json_schema__(cls, core_schema, handler):
        # 这里需要根据你的自定义 schema 逻辑迁移，参考 Pydantic v2 文档
        return handler(core_schema)

class AttachmentBase(BaseModel):
    filename: str
    size: int
    extension: str
    related_instance: Optional[str] = None

class AttachmentCreate(AttachmentBase):
    pass

class AttachmentInDB(AttachmentBase):
    id: PyObjectId = Field(default_factory=PyObjectId, alias="_id")
    upload_time: datetime = Field(default_factory=datetime.utcnow)
    minio_path: str

    class Config:
        validate_by_name = True
        arbitrary_types_allowed = True
        json_encoders = {ObjectId: str} 