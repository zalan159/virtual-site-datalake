import motor.motor_asyncio
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import os
from dotenv import load_dotenv

# 加载环境变量
load_dotenv()

# MongoDB 配置
MONGO_USERNAME = os.getenv('MONGO_USERNAME', 'admin')
MONGO_PASSWORD = os.getenv('MONGO_PASSWORD', 'admin123')
MONGO_HOST = os.getenv('MONGO_HOST', 'localhost')
MONGO_PORT = os.getenv('MONGO_PORT', '27017')
MONGO_DB_NAME = os.getenv('MONGO_DB_NAME', 'virtualsite')
MONGO_URI = f"mongodb://{MONGO_USERNAME}:{MONGO_PASSWORD}@{MONGO_HOST}:{MONGO_PORT}/{MONGO_DB_NAME}?authSource=admin"
MONGO_COLLECTION_NAME = "broker_configs"

# 定义 Pydantic 模型
class TopicSubscription(BaseModel):
    topic: str
    qos: int = 0

class BrokerConfig(BaseModel):
    id: str = Field(..., alias='_id')  # 使用 MongoDB 的 _id 作为唯一标识
    enabled: bool = True
    hostname: str
    port: int = 1883
    username: Optional[str] = None
    password: Optional[str] = None
    initial_topics: List[TopicSubscription] = []
    db_details: Dict[str, Any] = {"stream_name": "mqtt_stream_default"}
    description: Optional[str] = None  # 可选描述字段

async def insert_test_config():
    # 创建 MongoDB 客户端
    client = motor.motor_asyncio.AsyncIOMotorClient(MONGO_URI)
    db = client[MONGO_DB_NAME]
    collection = db[MONGO_COLLECTION_NAME]

    # 创建测试配置
    test_config = {
        "_id": "test_config_1",  # 唯一 ID
        "enabled": True,
        "hostname": "broker.emqx.io",
        "port": 1883,
        "initial_topics": [{"topic": "testtopic/#", "qos": 0}],
        "db_details": {"stream_name": "mqtt_stream_test"},
        "description": "测试配置"
    }

    # 插入到 MongoDB
    try:
        await collection.insert_one(test_config)
        print("测试配置已成功插入 MongoDB！")
    except Exception as e:
        print(f"插入配置时出错: {e}")
    finally:
        client.close()

# 运行脚本
if __name__ == "__main__":
    import asyncio
    asyncio.run(insert_test_config())