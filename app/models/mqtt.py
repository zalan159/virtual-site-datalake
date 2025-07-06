"""
MQTT连接配置数据模型

管理MQTT broker连接参数，用于前端驱动的IoT绑定系统。
"""

from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field
from .user import PyObjectId
from bson import ObjectId

class MQTTBase(BaseModel):
    name: str
    description: Optional[str] = None
    metadata: Optional[dict] = None
    tags: List[str] = Field(default_factory=list)
    is_public: bool = True
    hostname: str  # MQTT broker hostname
    port: int = 1883  # MQTT broker port
    websocket_path: str = "/mqtt"  # WebSocket path for MQTT over WebSocket
    topics: List[str] = Field(default_factory=list)  # Subscription topics
    
class MQTTCreate(MQTTBase):
    # Connection configuration
    client_id: Optional[str] = None  # MQTT client ID, auto-generated if None
    keep_alive: Optional[int] = 60  # Keep alive interval in seconds
    clean_session: Optional[bool] = True  # Clean session flag
    
    # Authentication
    auth_type: Optional[str] = "none"  # "none", "username_password", "certificate"
    username: Optional[str] = None  # For username/password auth
    password: Optional[str] = None  # For username/password auth
    ca_cert: Optional[str] = None  # CA certificate for TLS
    client_cert: Optional[str] = None  # Client certificate for mutual TLS
    client_key: Optional[str] = None  # Client private key for mutual TLS
    
    # TLS/SSL configuration
    use_tls: Optional[bool] = False  # Enable TLS/SSL
    tls_insecure: Optional[bool] = False  # Skip certificate verification
    
    # Quality of Service
    default_qos: Optional[int] = 0  # Default QoS level (0, 1, 2)
    
    # Connection settings
    connection_timeout: Optional[int] = 10  # Connection timeout in seconds
    max_retries: Optional[int] = 3  # Maximum retry attempts
    retry_delay: Optional[int] = 5  # Retry delay in seconds
    
    # Message handling
    max_inflight_messages: Optional[int] = 20  # Maximum inflight messages
    max_queued_messages: Optional[int] = 0  # Maximum queued messages (0 = unlimited)

class MQTTInDB(MQTTBase):
    id: PyObjectId = Field(default_factory=PyObjectId, alias="_id")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    
    # Connection configuration
    client_id: Optional[str] = None
    keep_alive: Optional[int] = 60
    clean_session: Optional[bool] = True
    
    # Authentication
    auth_type: Optional[str] = "none"
    username: Optional[str] = None
    password: Optional[str] = None  # Should be encrypted in production
    ca_cert: Optional[str] = None
    client_cert: Optional[str] = None
    client_key: Optional[str] = None  # Should be encrypted in production
    
    # TLS/SSL configuration
    use_tls: Optional[bool] = False
    tls_insecure: Optional[bool] = False
    
    # Quality of Service
    default_qos: Optional[int] = 0
    
    # Connection settings
    connection_timeout: Optional[int] = 10
    max_retries: Optional[int] = 3
    retry_delay: Optional[int] = 5
    
    # Message handling
    max_inflight_messages: Optional[int] = 20
    max_queued_messages: Optional[int] = 0
    
    model_config = {
        "populate_by_name": True,
        "arbitrary_types_allowed": True,
        "json_encoders": {
            ObjectId: str,
            datetime: lambda v: v.isoformat() if v else None
        }
    }
    
class MQTTUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    metadata: Optional[dict] = None
    tags: Optional[List[str]] = None
    is_public: Optional[bool] = None
    hostname: Optional[str] = None
    port: Optional[int] = None
    websocket_path: Optional[str] = None
    topics: Optional[List[str]] = None
    client_id: Optional[str] = None
    keep_alive: Optional[int] = None
    clean_session: Optional[bool] = None
    auth_type: Optional[str] = None
    username: Optional[str] = None
    password: Optional[str] = None
    ca_cert: Optional[str] = None
    client_cert: Optional[str] = None
    client_key: Optional[str] = None
    use_tls: Optional[bool] = None
    tls_insecure: Optional[bool] = None
    default_qos: Optional[int] = None
    connection_timeout: Optional[int] = None
    max_retries: Optional[int] = None
    retry_delay: Optional[int] = None
    max_inflight_messages: Optional[int] = None
    max_queued_messages: Optional[int] = None 