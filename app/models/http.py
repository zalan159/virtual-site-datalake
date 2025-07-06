"""
HTTP连接配置数据模型

管理HTTP/HTTPS连接参数，用于前端驱动的IoT绑定系统。
"""

from datetime import datetime
from typing import Optional, List, Dict, Any, Literal
from pydantic import BaseModel, Field
from .user import PyObjectId
from bson import ObjectId

class HTTPBase(BaseModel):
    name: str
    description: Optional[str] = None
    metadata: Optional[dict] = None
    tags: List[str] = Field(default_factory=list)
    is_public: bool = True
    base_url: str  # Base URL for HTTP requests
    
class HTTPCreate(HTTPBase):
    # Request configuration
    method: Literal["GET", "POST", "PUT", "DELETE", "PATCH"] = "GET"
    headers: Optional[Dict[str, str]] = None  # Custom headers
    default_params: Optional[Dict[str, str]] = None  # Default query parameters
    
    # Authentication
    auth_type: Optional[str] = "none"  # "none", "basic", "bearer", "api_key", "oauth2"
    auth_username: Optional[str] = None  # For basic auth
    auth_password: Optional[str] = None  # For basic auth
    auth_token: Optional[str] = None  # For bearer token auth
    api_key: Optional[str] = None  # For API key auth
    api_key_header: Optional[str] = "X-API-Key"  # API key header name
    
    # OAuth2 configuration
    oauth2_client_id: Optional[str] = None
    oauth2_client_secret: Optional[str] = None
    oauth2_token_url: Optional[str] = None
    oauth2_scope: Optional[str] = None
    
    # TLS/SSL configuration
    verify_ssl: Optional[bool] = True  # Verify SSL certificates
    ca_cert: Optional[str] = None  # CA certificate for custom SSL
    client_cert: Optional[str] = None  # Client certificate for mutual TLS
    client_key: Optional[str] = None  # Client private key for mutual TLS
    
    # Connection settings
    timeout: Optional[int] = 30  # Request timeout in seconds
    max_retries: Optional[int] = 3  # Maximum retry attempts
    retry_delay: Optional[int] = 1  # Retry delay in seconds
    
    # Polling configuration (for periodic data fetching)
    poll_interval: Optional[int] = None  # Polling interval in seconds (None = single request)
    poll_enabled: Optional[bool] = False  # Enable periodic polling
    
    # Data handling
    response_format: Optional[str] = "json"  # "json", "xml", "text", "binary"
    json_path: Optional[str] = None  # JSONPath for extracting specific data
    encoding: Optional[str] = "utf-8"  # Response encoding

class HTTPInDB(HTTPBase):
    id: PyObjectId = Field(default_factory=PyObjectId, alias="_id")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    
    # Request configuration
    method: Literal["GET", "POST", "PUT", "DELETE", "PATCH"] = "GET"
    headers: Optional[Dict[str, str]] = None
    default_params: Optional[Dict[str, str]] = None
    
    # Authentication
    auth_type: Optional[str] = "none"
    auth_username: Optional[str] = None
    auth_password: Optional[str] = None  # Should be encrypted in production
    auth_token: Optional[str] = None  # Should be encrypted in production
    api_key: Optional[str] = None  # Should be encrypted in production
    api_key_header: Optional[str] = "X-API-Key"
    
    # OAuth2 configuration
    oauth2_client_id: Optional[str] = None
    oauth2_client_secret: Optional[str] = None  # Should be encrypted in production
    oauth2_token_url: Optional[str] = None
    oauth2_scope: Optional[str] = None
    
    # TLS/SSL configuration
    verify_ssl: Optional[bool] = True
    ca_cert: Optional[str] = None
    client_cert: Optional[str] = None
    client_key: Optional[str] = None  # Should be encrypted in production
    
    # Connection settings
    timeout: Optional[int] = 30
    max_retries: Optional[int] = 3
    retry_delay: Optional[int] = 1
    
    # Polling configuration
    poll_interval: Optional[int] = None
    poll_enabled: Optional[bool] = False
    
    # Data handling
    response_format: Optional[str] = "json"
    json_path: Optional[str] = None
    encoding: Optional[str] = "utf-8"
    
    model_config = {
        "populate_by_name": True,
        "arbitrary_types_allowed": True,
        "json_encoders": {
            ObjectId: str,
            datetime: lambda v: v.isoformat() if v else None
        }
    }
    
class HTTPUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    metadata: Optional[dict] = None
    tags: Optional[List[str]] = None
    is_public: Optional[bool] = None
    base_url: Optional[str] = None
    method: Optional[Literal["GET", "POST", "PUT", "DELETE", "PATCH"]] = None
    headers: Optional[Dict[str, str]] = None
    default_params: Optional[Dict[str, str]] = None
    auth_type: Optional[str] = None
    auth_username: Optional[str] = None
    auth_password: Optional[str] = None
    auth_token: Optional[str] = None
    api_key: Optional[str] = None
    api_key_header: Optional[str] = None
    oauth2_client_id: Optional[str] = None
    oauth2_client_secret: Optional[str] = None
    oauth2_token_url: Optional[str] = None
    oauth2_scope: Optional[str] = None
    verify_ssl: Optional[bool] = None
    ca_cert: Optional[str] = None
    client_cert: Optional[str] = None
    client_key: Optional[str] = None
    timeout: Optional[int] = None
    max_retries: Optional[int] = None
    retry_delay: Optional[int] = None
    poll_interval: Optional[int] = None
    poll_enabled: Optional[bool] = None
    response_format: Optional[str] = None
    json_path: Optional[str] = None
    encoding: Optional[str] = None 