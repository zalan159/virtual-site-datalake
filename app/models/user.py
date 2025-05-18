from pydantic import BaseModel, EmailStr, constr, Field
from typing import Optional, List, Annotated
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

class UserRole(str, Enum):
    ADMIN = "admin"
    USER = "user"

class UserBase(BaseModel):
    email: Optional[EmailStr] = None  # 邮箱选填
    username: str
    phone: Annotated[str, constr(pattern=r'^1\d{10}$')]  # 手机号必填，且必须符合格式

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
        validate_by_name = True
        arbitrary_types_allowed = True
        json_encoders = {ObjectId: str}

class User(UserBase):
    id: PyObjectId = Field(default_factory=PyObjectId, alias="_id")
    is_active: bool
    role: UserRole
    created_at: datetime
    updated_at: datetime

    class Config:
        validate_by_name = True
        arbitrary_types_allowed = True
        json_encoders = {ObjectId: str}

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    username: Optional[str] = None 