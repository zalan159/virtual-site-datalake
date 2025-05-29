from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from enum import Enum
from .user import PyObjectId

class FileShare(BaseModel):
    file_id: PyObjectId
    shared_with: List[str]
    permissions: List[str]
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)

    model_config = {
        "arbitrary_types_allowed": True,
        "populate_by_name": True
    }

class ConversionStatus(str, Enum):
    NONE = "none"
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"

class FileConversion(BaseModel):
    status: ConversionStatus = ConversionStatus.NONE
    input_format: Optional[str] = None
    output_format: Optional[str] = None
    input_file_path: Optional[str] = None
    output_file_path: Optional[str] = None
    task_id: Optional[str] = None
    progress: int = 0
    error_message: Optional[str] = None
    created_at: Optional[datetime] = Field(default_factory=datetime.now)
    updated_at: Optional[datetime] = Field(default_factory=datetime.now)

    model_config = {
        "arbitrary_types_allowed": True
    }

class FileMetadata(BaseModel):
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
    share_info: Optional[FileShare] = None
    conversion: Optional[FileConversion] = None

    model_config = {
        "populate_by_name": True,
        "arbitrary_types_allowed": True
    }

class PublicModelMetadata(BaseModel):
    id: PyObjectId = Field(default_factory=PyObjectId, alias="_id")
    filename: str
    file_path: str
    description: Optional[str] = None
    tags: List[str] = Field(default_factory=list)
    category: str
    sub_category: Optional[str] = None
    upload_date: datetime
    file_size: int
    preview_image: Optional[str] = None
    created_by: PyObjectId
    created_by_username: str
    is_featured: bool = False
    download_count: int = 0

    model_config = {
        "populate_by_name": True,
        "arbitrary_types_allowed": True
    } 