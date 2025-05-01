from pydantic import BaseModel, EmailStr, constr, Field
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
    def __modify_schema__(cls, field_schema):
        field_schema.update(type="string")

class UserRole(str, Enum):
    ADMIN = "admin"
    USER = "user"

class UserBase(BaseModel):
    email: Optional[EmailStr] = None  # 邮箱选填
    username: str
    phone: constr(regex=r'^1\d{10}$')  # 手机号必填，且必须符合格式

class UserCreate(UserBase):
    password: str

class UserInDB(UserBase):
    id: PyObjectId = Field(default_factory=PyObjectId, alias="_id")
    hashed_password: str
    is_active: bool = True
    role: UserRole = UserRole.USER
    created_at: datetime = datetime.now()
    updated_at: datetime = datetime.now()

    class Config:
        allow_population_by_field_name = True
        arbitrary_types_allowed = True
        json_encoders = {ObjectId: str}

class User(UserBase):
    id: PyObjectId = Field(default_factory=PyObjectId, alias="_id")
    is_active: bool
    role: UserRole
    created_at: datetime
    updated_at: datetime

    class Config:
        allow_population_by_field_name = True
        arbitrary_types_allowed = True
        json_encoders = {ObjectId: str}

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    username: Optional[str] = None

class FileShare(BaseModel):
    file_id: PyObjectId = Field(default_factory=PyObjectId)
    shared_with: List[str]  # 用户ID列表
    permissions: List[str]  # 权限列表：read, write, delete
    created_at: datetime = datetime.now()
    updated_at: datetime = datetime.now()

    class Config:
        arbitrary_types_allowed = True
        json_encoders = {ObjectId: str}

# 定义转换状态枚举
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
    share_info: Optional[FileShare] = None
    conversion: Optional[FileConversion] = None  # 添加转换信息

    class Config:
        allow_population_by_field_name = True
        arbitrary_types_allowed = True
        json_encoders = {ObjectId: str} 