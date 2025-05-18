from datetime import datetime
from typing import Optional, List
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

class ThreeDTilesBase(BaseModel):
    name: str
    description: Optional[str] = None
    metadata: Optional[dict] = None
    tags: Optional[List[str]] = []
    is_public: bool = True

class ThreeDTilesCreate(ThreeDTilesBase):
    pass

class ThreeDTilesInDB(ThreeDTilesBase):
    id: PyObjectId = Field(default_factory=PyObjectId, alias="_id")
    tileset_url: str
    minio_path: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    original_filename: Optional[str] = None
    file_size: Optional[int] = None
    longitude: Optional[float] = None
    latitude: Optional[float] = None
    height: Optional[float] = None

    class Config:
        validate_by_name = True
        arbitrary_types_allowed = True
        json_encoders = {ObjectId: str}

class ThreeDTilesUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    metadata: Optional[dict] = None
    tags: Optional[List[str]] = None
    is_public: Optional[bool] = None
    longitude: Optional[float] = None
    latitude: Optional[float] = None
    height: Optional[float] = None
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class ProcessStatus(BaseModel):
    process_id: str
    status: str  # "processing", "completed", "failed"
    message: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    tile_id: Optional[str] = None  # 处理完成后关联的3DTiles ID
    
    class Config:
        validate_by_name = True
        arbitrary_types_allowed = True 