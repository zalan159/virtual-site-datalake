from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field
from .user import PyObjectId
from bson import ObjectId

class WebSocketBase(BaseModel):
    name: str
    description: Optional[str] = None
    metadata: Optional[dict] = None
    tags: List[str] = Field(default_factory=list)
    is_public: bool = True
    url: str  # WebSocket connection URL
    
class WebSocketCreate(WebSocketBase):
    # Connection configuration
    headers: Optional[Dict[str, str]] = None  # Custom headers for connection
    protocols: Optional[List[str]] = None  # WebSocket subprotocols
    
    # Authentication
    auth_type: Optional[str] = "none"  # "none", "basic", "token", "custom"
    auth_username: Optional[str] = None  # For basic auth
    auth_password: Optional[str] = None  # For basic auth
    auth_token: Optional[str] = None  # For token auth
    auth_custom: Optional[Dict[str, Any]] = None  # For custom auth
    
    # Connection settings
    connection_timeout: Optional[int] = 10  # Connection timeout in seconds
    ping_interval: Optional[int] = 30  # Ping interval in seconds
    ping_timeout: Optional[int] = 10  # Ping timeout in seconds
    max_retries: Optional[int] = 3  # Maximum retry attempts
    retry_delay: Optional[int] = 5  # Retry delay in seconds

class WebSocketInDB(WebSocketBase):
    id: PyObjectId = Field(default_factory=PyObjectId, alias="_id")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    
    # Connection configuration
    headers: Optional[Dict[str, str]] = None
    protocols: Optional[List[str]] = None
    
    # Authentication
    auth_type: Optional[str] = "none"
    auth_username: Optional[str] = None
    auth_password: Optional[str] = None  # Should be encrypted in production
    auth_token: Optional[str] = None  # Should be encrypted in production
    auth_custom: Optional[Dict[str, Any]] = None
    
    # Connection settings
    connection_timeout: Optional[int] = 10
    ping_interval: Optional[int] = 30
    ping_timeout: Optional[int] = 10
    max_retries: Optional[int] = 3
    retry_delay: Optional[int] = 5
    
    model_config = {
        "populate_by_name": True,
        "arbitrary_types_allowed": True,
        "json_encoders": {
            ObjectId: str,
            datetime: lambda v: v.isoformat() if v else None
        }
    }
    
class WebSocketUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    metadata: Optional[dict] = None
    tags: Optional[List[str]] = None
    is_public: Optional[bool] = None
    url: Optional[str] = None
    headers: Optional[Dict[str, str]] = None
    protocols: Optional[List[str]] = None
    auth_type: Optional[str] = None
    auth_username: Optional[str] = None
    auth_password: Optional[str] = None
    auth_token: Optional[str] = None
    auth_custom: Optional[Dict[str, Any]] = None
    connection_timeout: Optional[int] = None
    ping_interval: Optional[int] = None
    ping_timeout: Optional[int] = None
    max_retries: Optional[int] = None
    retry_delay: Optional[int] = None

