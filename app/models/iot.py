from typing import List, Dict, Any, Optional, Set
from pydantic import BaseModel, Field
import time
from datetime import datetime
from .user import PyObjectId

class TopicSubscription(BaseModel):
    topic: str
    qos: int = 0

class UserTopicSubscription(BaseModel):
    """用户与主题的订阅关系"""
    id: Optional[PyObjectId] = Field(default=None, alias="_id")
    user_id: str
    config_id: str
    topic: str
    qos: int = 0
    created_at: float = Field(default_factory=time.time)
    last_active: Optional[float] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)

    model_config = {
        "populate_by_name": True,
        "arbitrary_types_allowed": True
    }

class BrokerConfig(BaseModel):
    id: Optional[PyObjectId] = Field(default=None, alias="_id")
    user_id: Optional[str] = None
    hostname: str
    port: int = 1883
    username: Optional[str] = None
    password: Optional[str] = None
    initial_topics: List[TopicSubscription] = Field(default_factory=list)
    db_details: Dict[str, Any] = Field(default_factory=lambda: {"stream_name": "mqtt_stream_default"})
    description: Optional[str] = None

    model_config = {
        "json_encoders": {
            datetime: lambda v: v.timestamp()
        },
        "populate_by_name": True,
        "arbitrary_types_allowed": True
    } 