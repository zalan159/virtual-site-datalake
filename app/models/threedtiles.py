from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field
from .user import PyObjectId

class ThreeDTilesBase(BaseModel):
    name: str
    description: Optional[str] = None
    metadata: Optional[dict] = None
    tags: List[str] = Field(default_factory=list)
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

    model_config = {
        "populate_by_name": True,
        "arbitrary_types_allowed": True
    }

class ThreeDTilesUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    metadata: Optional[dict] = None
    tags: Optional[List[str]] = None
    is_public: Optional[bool] = None
    longitude: Optional[float] = None
    latitude: Optional[float] = None
    height: Optional[float] = None

class ProcessStatus(BaseModel):
    process_id: str
    status: str
    message: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    tile_id: Optional[str] = None

    model_config = {
        "populate_by_name": True,
        "arbitrary_types_allowed": True
    } 