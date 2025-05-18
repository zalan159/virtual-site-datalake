from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from enum import Enum
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

class FileShare(BaseModel):
    file_id: PyObjectId = Field(default_factory=PyObjectId)
    shared_with: List[str]  # 用户ID列表
    permissions: List[str]  # 权限列表：read, write, delete
    created_at: datetime = datetime.now()
    updated_at: datetime = datetime.now()

    class Config:
        arbitrary_types_allowed = True
        json_encoders = {ObjectId: str}

class ConversionStatus(str, Enum):
    NONE = "none"  # 未转换
    PENDING = "pending"  # 等待转换
    PROCESSING = "processing"  # 转换中
    COMPLETED = "completed"  # 转换完成
    FAILED = "failed"  # 转换失败

class FileConversion(BaseModel):
    status: ConversionStatus = ConversionStatus.NONE
    input_format: Optional[str] = None  # 输入格式
    output_format: Optional[str] = None  # 输出格式
    input_file_path: Optional[str] = None  # 输入文件路径
    output_file_path: Optional[str] = None  # 输出文件路径
    task_id: Optional[str] = None  # 转换任务ID
    progress: int = 0  # 转换进度
    error_message: Optional[str] = None  # 错误信息
    created_at: Optional[datetime] = None  # 创建时间
    updated_at: Optional[datetime] = None  # 更新时间

    class Config:
        arbitrary_types_allowed = True

class FileMetadata(BaseModel):
    id: PyObjectId = Field(default_factory=PyObjectId, alias="_id")
    filename: str
    file_path: str
    user_id: PyObjectId
    username: str
    description: Optional[str] = None
    tags: List[str] = []
    is_public: bool = False
    upload_date: datetime
    file_size: int
    preview_image: Optional[str] = None
    share_info: Optional[FileShare] = None
    conversion: Optional[FileConversion] = None  # 添加转换信息

    class Config:
        validate_by_name = True
        arbitrary_types_allowed = True
        json_encoders = {ObjectId: str}

class PublicModelMetadata(BaseModel):
    id: PyObjectId = Field(default_factory=PyObjectId, alias="_id")
    filename: str
    file_path: str
    description: Optional[str] = None
    tags: List[str] = []
    category: str  # 模型分类，例如："家具"、"装饰品"、"植物"、"人物"等
    sub_category: Optional[str] = None  # 子分类，例如："桌子"、"椅子"、"沙发"等
    upload_date: datetime
    file_size: int
    preview_image: Optional[str] = None
    created_by: PyObjectId  # 创建者ID
    created_by_username: str  # 创建者用户名
    is_featured: bool = False  # 是否为推荐模型
    download_count: int = 0  # 下载次数

    class Config:
        validate_by_name = True
        arbitrary_types_allowed = True
        json_encoders = {ObjectId: str} 