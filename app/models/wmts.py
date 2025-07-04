from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field
from .user import PyObjectId

class WMTSBase(BaseModel):
    name: str
    description: Optional[str] = None
    metadata: Optional[dict] = None
    tags: List[str] = Field(default_factory=list)
    is_public: bool = True
    source_type: str  # "file" for tpkx upload, "url" for WMTS service URL

class WMTSCreate(WMTSBase):
    service_url: Optional[str] = None  # For URL-based WMTS services
    layer_name: Optional[str] = None   # Layer identifier for WMTS service
    format: Optional[str] = "image/png"  # Tile format (png, jpeg, etc.)
    tile_matrix_set: Optional[str] = "GoogleMapsCompatible"  # Default tile matrix

class WMTSInDB(WMTSBase):
    id: PyObjectId = Field(default_factory=PyObjectId, alias="_id")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    original_filename: Optional[str] = None
    file_size: Optional[int] = None
    
    # For file-based WMTS (tpkx)
    minio_path: Optional[str] = None        # MinIO path for extracted tiles
    tile_url_template: Optional[str] = None  # Template URL for accessing tiles
    
    # For URL-based WMTS services
    service_url: Optional[str] = None
    layer_name: Optional[str] = None
    format: Optional[str] = "image/png"
    tile_matrix_set: Optional[str] = "GoogleMapsCompatible"
    
    # Tile bounds and metadata
    min_zoom: Optional[int] = 0
    max_zoom: Optional[int] = 18
    bounds: Optional[dict] = None  # {"west": -180, "south": -90, "east": 180, "north": 90}
    attribution: Optional[str] = None

    model_config = {
        "populate_by_name": True,
        "arbitrary_types_allowed": True,
        "by_alias": True  # 确保序列化时正确处理alias
    }

class WMTSUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    metadata: Optional[dict] = None
    tags: Optional[List[str]] = None
    is_public: Optional[bool] = None
    service_url: Optional[str] = None
    layer_name: Optional[str] = None
    format: Optional[str] = None
    tile_matrix_set: Optional[str] = None
    min_zoom: Optional[int] = None
    max_zoom: Optional[int] = None
    bounds: Optional[dict] = None
    attribution: Optional[str] = None

class WMTSProcessStatus(BaseModel):
    process_id: str
    status: str
    message: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    wmts_id: Optional[str] = None

    model_config = {
        "populate_by_name": True,
        "arbitrary_types_allowed": True
    }