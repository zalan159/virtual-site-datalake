from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field, validator
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

class StreamBase(BaseModel):
    name: str
    protocol: str = "hls"  # 支持 hls、dash、webrtc
    url: str
    username: Optional[str] = None
    password: Optional[str] = None
    description: Optional[str] = None
    owner: Optional[str] = None  # 新增，所属用户

    @validator("protocol")
    def validate_protocol(cls, v):
        allowed_protocols = {"hls", "dash", "webrtc"}
        if v not in allowed_protocols:
            raise ValueError(f"protocol 只支持: {allowed_protocols}")
        return v

class StreamCreate(StreamBase):
    pass

class StreamInDB(StreamBase):
    id: PyObjectId = Field(default_factory=PyObjectId, alias="_id")
    create_time: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        validate_by_name = True
        arbitrary_types_allowed = True
        json_encoders = {ObjectId: str} 