from typing import List, Dict, Any, Optional, Set
from pydantic import BaseModel, Field
import time
from datetime import datetime

class TopicSubscription(BaseModel):
    topic: str
    qos: int = 0

class UserTopicSubscription(BaseModel):
    """用户与主题的订阅关系"""
    id: Optional[str] = Field(None, alias="_id")
    user_id: str
    config_id: str  # broker配置的ID
    topic: str
    qos: int = 0
    created_at: float = Field(default_factory=time.time)
    last_active: Optional[float] = None
    metadata: Dict[str, Any] = {}

class BrokerConfig(BaseModel):
    id: Optional[str] = Field(None, alias="_id")
    hostname: str
    port: int = 1883
    username: Optional[str] = None
    password: Optional[str] = None
    initial_topics: List[TopicSubscription] = []
    db_details: Dict[str, Any] = {"stream_name": "mqtt_stream_default"}
    description: Optional[str] = None

    class Config:
        json_encoders = {
            datetime: lambda v: v.timestamp()
        } 