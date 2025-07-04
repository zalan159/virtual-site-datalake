from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from .user import PyObjectId


class GaussianSplatMetadata(BaseModel):
    id: PyObjectId = Field(default_factory=PyObjectId, alias="_id")
    filename: str
    file_path: str
    user_id: PyObjectId
    username: str
    description: Optional[str] = None
    tags: List[str] = Field(default_factory=list)
    is_public: bool = False
    upload_date: datetime
    file_size: int
    preview_image: Optional[str] = None
    
    # 高斯泼溅特有属性
    format: str = Field(default="ply")  # ply, splat, spz
    point_count: Optional[int] = None
    
    # 空间位置信息
    position: Optional[List[float]] = None  # [x, y, z]
    rotation: Optional[List[float]] = None  # [x, y, z, w] quaternion
    scale: Optional[List[float]] = None     # [x, y, z]
    
    # 渲染属性
    opacity: float = 1.0
    show: bool = True
    
    model_config = {
        "populate_by_name": True,
        "arbitrary_types_allowed": True,
        "by_alias": True  # 确保序列化时正确处理alias
    }


class GaussianSplatCreate(BaseModel):
    filename: str
    description: Optional[str] = None
    tags: List[str] = Field(default_factory=list)
    is_public: bool = False
    format: str = Field(default="ply")
    position: Optional[List[float]] = None
    rotation: Optional[List[float]] = None
    scale: Optional[List[float]] = None
    opacity: float = 1.0
    show: bool = True


class GaussianSplatUpdate(BaseModel):
    description: Optional[str] = None
    tags: Optional[List[str]] = None
    is_public: Optional[bool] = None
    position: Optional[List[float]] = None
    rotation: Optional[List[float]] = None
    scale: Optional[List[float]] = None
    opacity: Optional[float] = None
    show: Optional[bool] = None


class GaussianSplatResponse(BaseModel):
    id: str
    filename: str
    file_path: str
    user_id: str
    username: str
    description: Optional[str] = None
    tags: List[str]
    is_public: bool
    upload_date: datetime
    file_size: int
    preview_image: Optional[str] = None
    format: str
    point_count: Optional[int] = None
    position: Optional[List[float]] = None
    rotation: Optional[List[float]] = None
    scale: Optional[List[float]] = None
    opacity: float
    show: bool