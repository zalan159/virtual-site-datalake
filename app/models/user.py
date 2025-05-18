from pydantic import BaseModel, EmailStr, Field, GetCoreSchemaHandler
from typing import Optional, List, Any
from datetime import datetime
from enum import Enum
from bson import ObjectId
from pydantic_core import core_schema

class PyObjectId(ObjectId):
    @classmethod
    def __get_pydantic_core_schema__(
        cls, source_type: Any, handler: GetCoreSchemaHandler
    ) -> core_schema.CoreSchema:
        
        def validate_objectid(value: Any) -> ObjectId:
            if isinstance(value, ObjectId):
                return value
            if isinstance(value, str):
                if ObjectId.is_valid(value):
                    return ObjectId(value)
                raise ValueError(f"'{value}' is not a valid ObjectId")
            raise TypeError(f"ObjectId or string is required, got {type(value)}")

        python_schema = core_schema.no_info_plain_validator_function(validate_objectid)
        
        # For OpenAPI schema generation, represent as a string
        json_schema_repr = core_schema.str_schema()

        return core_schema.json_or_python_schema(
            json_schema=json_schema_repr,
            python_schema=python_schema,
            serialization=core_schema.plain_serializer_function_ser_schema(
                lambda x: str(x), # Serialize ObjectId to string
                when_used='json-unless-none' # Apply for JSON serialization if not None
            )
        )

class UserRole(str, Enum):
    ADMIN = "admin"
    USER = "user"

class UserBase(BaseModel):
    email: Optional[EmailStr] = None
    username: str
    phone: str = Field(pattern=r'^1\d{10}$')

class UserCreate(UserBase):
    password: str

class UserInDBBase(UserBase):
    id: PyObjectId = Field(alias="_id")
    is_active: bool = True
    role: UserRole = UserRole.USER
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)

    model_config = {
        "populate_by_name": True,
        "arbitrary_types_allowed": True
    }

class UserInDB(UserInDBBase):
    hashed_password: str

class User(UserInDBBase):
    pass

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    username: Optional[str] = None 