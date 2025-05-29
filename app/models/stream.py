from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field, field_validator
from .user import PyObjectId

class StreamBase(BaseModel):
    name: str
    protocol: str = "hls"  # 支持 hls、dash、webrtc
    url: str
    username: Optional[str] = None
    password: Optional[str] = None
    description: Optional[str] = None
    owner: Optional[str] = None  # 新增，所属用户

    @field_validator("protocol")
    @classmethod
    def validate_protocol(cls, v: str):
        allowed_protocols = {"hls", "dash", "webrtc"}
        if v not in allowed_protocols:
            raise ValueError(f"protocol 只支持: {allowed_protocols}")
        return v

class StreamCreate(StreamBase):
    pass

class StreamInDB(StreamBase):
    id: PyObjectId = Field(default_factory=PyObjectId, alias="_id")
    create_time: datetime = Field(default_factory=datetime.utcnow)

    model_config = {
        "populate_by_name": True,
        "arbitrary_types_allowed": True
    } 