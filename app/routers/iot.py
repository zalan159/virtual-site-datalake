import uuid
from fastapi import APIRouter, HTTPException, Query, Depends, Header, Body
from typing import List, Optional, Dict, Any
from motor.motor_asyncio import AsyncIOMotorClient
from app.models.iot import BrokerConfig, TopicSubscription, UserTopicSubscription
from app.utils.mongo_init import get_mongo_url
from app.auth.utils import get_current_active_user
from app.models.user import UserInDB
import os
import redis.asyncio as aioredis
import json
from fastapi.responses import JSONResponse
from datetime import datetime
import time
import logging

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

# 添加控制台处理器
handler = logging.StreamHandler()
handler.setLevel(logging.INFO)
formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
handler.setFormatter(formatter)
logger.addHandler(handler)

MONGO_URL = get_mongo_url()
MONGO_DB_NAME = os.getenv("MONGO_DB_NAME", "virtualsite")
MONGO_COLLECTION_NAME = os.getenv("MONGO_COLLECTION_NAME", "broker_configs")
MONGO_USER_SUB_COLLECTION = "mqtt_user_subscriptions"  # 用户订阅集合
REDIS_URL = f"redis://{os.getenv('REDIS_HOST', 'localhost')}:{os.getenv('REDIS_PORT', '6379')}/{os.getenv('REDIS_DB', '0')}"

router = APIRouter(tags=["iot"])

# ----------- MongoDB CRUD -----------
@router.get("/brokers", response_model=List[BrokerConfig])
async def list_brokers():
    db = AsyncIOMotorClient(MONGO_URL)[MONGO_DB_NAME]
    cursor = db[MONGO_COLLECTION_NAME].find()
    brokers = []
    async for doc in cursor:
        if "_id" in doc and not isinstance(doc["_id"], str):
            doc["_id"] = str(doc["_id"])
        brokers.append(BrokerConfig(**doc))
    return brokers

@router.get("/brokers/{broker_id}", response_model=BrokerConfig)
async def get_broker(broker_id: str):
    db = AsyncIOMotorClient(MONGO_URL)[MONGO_DB_NAME]
    doc = await db[MONGO_COLLECTION_NAME].find_one({"_id": broker_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Broker配置不存在")
    if "_id" in doc and not isinstance(doc["_id"], str):
        doc["_id"] = str(doc["_id"])
    return BrokerConfig(**doc)

@router.post("/brokers", response_model=BrokerConfig)
async def create_broker(cfg: BrokerConfig):
    db = AsyncIOMotorClient(MONGO_URL)[MONGO_DB_NAME]
    data = cfg.dict(by_alias=True, exclude_unset=True)
    
    # 强制初始化版本信息（去除 enabled 字段）
    data.update({
        "_id": data.get("_id") or str(uuid.uuid4()),
        "version": 1,
        "last_modified": time.time()
    })
    
    await db[MONGO_COLLECTION_NAME].insert_one(data)
    return BrokerConfig(**data)

@router.put("/brokers/{broker_id}", response_model=BrokerConfig)
async def update_broker(broker_id: str, cfg: BrokerConfig):
    # 在更新前添加
    if "version" in cfg.dict(exclude_unset=True):
        raise HTTPException(400, "版本号不能手动修改")
    
    db = AsyncIOMotorClient(MONGO_URL)[MONGO_DB_NAME]
    
    # 获取当前版本
    current = await db[MONGO_COLLECTION_NAME].find_one({"_id": broker_id})
    if not current:
        raise HTTPException(status_code=404, detail="Broker配置不存在")
    
    # 构建更新操作
    update_data = cfg.dict(exclude={'version', 'last_modified'})
    update_data.update({
        "version": current.get("version", 0) + 1,
        "last_modified": time.time()
    })
    
    # 使用原子操作更新
    result = await db[MONGO_COLLECTION_NAME].update_one(
        {"_id": broker_id},
        {"$set": update_data}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=500, detail="更新失败")
    
    # 返回更新后的完整文档
    updated = await db[MONGO_COLLECTION_NAME].find_one({"_id": broker_id})
    updated["_id"] = str(updated["_id"])
    return BrokerConfig(**updated)

@router.delete("/brokers/{broker_id}")
async def delete_broker(broker_id: str):
    db = AsyncIOMotorClient(MONGO_URL)[MONGO_DB_NAME]
    result = await db[MONGO_COLLECTION_NAME].delete_one({"_id": broker_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Broker配置不存在")
    return {"message": "已删除"}

@router.get("/brokers/{broker_id}/versions")
async def get_version_history(
    broker_id: str,
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100)
):
    """获取配置版本历史"""
    db = AsyncIOMotorClient(MONGO_URL)[MONGO_DB_NAME]
    
    # 假设有版本历史集合
    coll = db["broker_config_versions"]
    
    total = await coll.count_documents({"config_id": broker_id})
    cursor = coll.find({"config_id": broker_id})
    cursor.sort("version", -1).skip((page-1)*page_size).limit(page_size)
    
    versions = []
    async for doc in cursor:
        doc["_id"] = str(doc["_id"])
        doc["timestamp"] = datetime.fromtimestamp(doc["timestamp"]).isoformat()
        versions.append(doc)
        
    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "data": versions
    }

# ----------- Redis 状态查询 -----------
async def get_redis_pool():
    return await aioredis.from_url(REDIS_URL, decode_responses=True)

def _status_key(cfg_id: str) -> str:
    return f"mqtt_gateway:status:{cfg_id}"

@router.get("/brokers/status")
async def get_all_broker_status():
    db = AsyncIOMotorClient(MONGO_URL)[MONGO_DB_NAME]
    cursor = db[MONGO_COLLECTION_NAME].find()
    ids = []
    async for doc in cursor:
        ids.append(str(doc["_id"]))
    redis_pool = await get_redis_pool()
    pipe = redis_pool.pipeline()
    for cfg_id in ids:
        pipe.hgetall(_status_key(cfg_id))
    results = await pipe.execute()
    return dict(zip(ids, results))

@router.get("/brokers/{broker_id}/status")
async def get_broker_status(broker_id: str):
    redis_pool = await get_redis_pool()
    status = await redis_pool.hgetall(_status_key(broker_id))
    
    # 获取配置元数据
    db = AsyncIOMotorClient(MONGO_URL)[MONGO_DB_NAME]
    config = await db[MONGO_COLLECTION_NAME].find_one(
        {"_id": broker_id},
        {"version": 1, "last_modified": 1}
    )
    
    if not status and not config:
        raise HTTPException(status_code=404, detail="未找到该Broker的状态")
    
    response = {
        "config_version": config.get("version", 0),
        "last_modified": datetime.fromtimestamp(config.get("last_modified", 0)).isoformat(),
        "runtime_status": status
    }
    
    return JSONResponse(response)

# ----------- 用户订阅管理 -----------
@router.get("/subscriptions", response_model=List[UserTopicSubscription])
async def list_user_subscriptions(
    current_user: UserInDB = Depends(get_current_active_user)
):
    """获取当前用户的所有订阅"""
    db = AsyncIOMotorClient(MONGO_URL)[MONGO_DB_NAME]
    cursor = db[MONGO_USER_SUB_COLLECTION].find({"user_id": str(current_user.id)})
    subscriptions = []
    async for doc in cursor:
        if "_id" in doc and not isinstance(doc["_id"], str):
            doc["_id"] = str(doc["_id"])
        # 强制转换user_id和topic为字符串，防止Pydantic校验失败
        if "user_id" in doc and not isinstance(doc["user_id"], str):
            doc["user_id"] = str(doc["user_id"])
        if "topic" in doc and not isinstance(doc["topic"], str):
            doc["topic"] = str(doc["topic"])
        if "config_id" in doc and not isinstance(doc["config_id"], str):
            doc["config_id"] = str(doc["config_id"])
        subscriptions.append(UserTopicSubscription(**doc))
    return subscriptions

@router.post("/subscriptions", response_model=List[UserTopicSubscription])
async def create_subscription(
    data: Dict[str, Any] = Body(...),
    current_user: UserInDB = Depends(get_current_active_user)
):
    """支持批量创建新订阅，topic可以为str或List[str]"""
    config_id = data.get("config_id")
    topics = data.get("topic")
    qos = data.get("qos", 0)
    
    # 参数验证
    if not config_id or not topics:
        raise HTTPException(status_code=400, detail="配置ID和主题是必填项")
    
    # 支持单个或多个主题
    if isinstance(topics, str):
        topics = [topics]
    elif isinstance(topics, list):
        topics = [str(t) for t in topics if t]
    else:
        raise HTTPException(status_code=400, detail="主题格式错误")
    
    db = AsyncIOMotorClient(MONGO_URL)[MONGO_DB_NAME]
    config = await db[MONGO_COLLECTION_NAME].find_one({"_id": config_id})
    if not config:
        raise HTTPException(status_code=404, detail="Broker配置不存在")
    
    created = []
    redis_pool = await get_redis_pool()
    for topic in topics:
        # 检查是否已存在相同订阅
        existing = await db[MONGO_USER_SUB_COLLECTION].find_one({
            "user_id": str(current_user.id),
            "config_id": str(config_id),
            "topic": str(topic)
        })
        if existing:
            continue
        sub_data = {
            "_id": str(uuid.uuid4()),
            "user_id": str(current_user.id),
            "config_id": str(config_id),
            "topic": str(topic),
            "qos": qos,
            "created_at": time.time(),
            "metadata": data.get("metadata", {})
        }
        await db[MONGO_USER_SUB_COLLECTION].insert_one(sub_data)
        await redis_pool.lpush("mqtt_gateway:commands", json.dumps({
            "action": "subscribe",
            "config_id": str(config_id),
            "user_id": str(current_user.id),
            "topic": str(topic),
            "qos": qos
        }))
        created.append(UserTopicSubscription(**sub_data))
    if not created:
        raise HTTPException(status_code=400, detail="无新订阅被添加，可能已存在")
    return created

@router.delete("/subscriptions/{sub_id}")
async def delete_subscription(
    sub_id: str,
    current_user: UserInDB = Depends(get_current_active_user)
):
    """删除订阅"""
    db = AsyncIOMotorClient(MONGO_URL)[MONGO_DB_NAME]
    
    # 查找订阅
    subscription = await db[MONGO_USER_SUB_COLLECTION].find_one({
        "_id": sub_id,
        "user_id": str(current_user.id)
    })
    
    if not subscription:
        raise HTTPException(status_code=404, detail="订阅不存在或无权操作")
    
    # 删除订阅
    result = await db[MONGO_USER_SUB_COLLECTION].delete_one({
        "_id": sub_id,
        "user_id": str(current_user.id)
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=500, detail="删除失败")
    
    # 发送Redis命令通知网关
    redis_pool = await get_redis_pool()
    await redis_pool.lpush("mqtt_gateway:commands", json.dumps({
        "action": "unsubscribe",
        "config_id": str(subscription["config_id"]),
        "user_id": str(current_user.id),
        "topic": subscription["topic"]
    }))
    
    return {"message": "已删除"}

@router.get("/subscriptions/topics")
async def get_topic_suggestions():
    """获取主题建议列表"""
    return {
        "common_topics": [
            "devices/#",
            "sensors/#",
            "home/temperature",
            "home/humidity",
            "status/+",
            "alerts/#"
        ]
    }

# 历史消息查询
@router.get("/messages/history")
async def get_history_messages(
    topic: str = Query(..., description="要查询的topic"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: UserInDB = Depends(get_current_active_user)
):
    """获取指定主题的历史消息（支持通配符）"""
    db = AsyncIOMotorClient(MONGO_URL)[MONGO_DB_NAME]
    
    # 检查用户是否有权限访问该主题（支持通配符）
    if '#' in topic or '+' in topic:
        # 处理通配符逻辑
        base_topic = topic.split('/#')[0] if '#' in topic else topic.split('/+')[0]
        sub_count = await db[MONGO_USER_SUB_COLLECTION].count_documents({
            "user_id": str(current_user.id),
            "topic": {"$regex": f"^{base_topic}"}  # 匹配以 base_topic 开头的主题
        })
    else:
        # 精确匹配
        sub_count = await db[MONGO_USER_SUB_COLLECTION].count_documents({
            "user_id": str(current_user.id),
            "topic": topic
        })
    
    if sub_count == 0:
        raise HTTPException(status_code=403, detail="无权访问该主题的消息")
    
    # 查询消息（支持通配符）
    if '#' in topic or '+' in topic:
        query = {
            "user_id": str(current_user.id),
            "topic": {"$regex": f"^{topic.replace('#', '.*').replace('+', '[^/]+')}"}
        }
    else:
        query = {
            "user_id": str(current_user.id),
            "topic": topic
        }
    
    cursor = db["mqtt_messages"].find(query).sort("received_ts", -1).skip((page - 1) * page_size).limit(page_size)
    messages = []
    async for doc in cursor:
        messages.append({
            "id": str(doc["_id"]),
            "topic": doc["topic"],
            "payload": doc["payload"],
            "received_ts": doc["received_ts"],
            "payload_encoding": doc.get("payload_encoding", "utf-8")
        })
    
    total = await db["mqtt_messages"].count_documents(query)
    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "messages": messages
    }

# 实时消息（MongoDB）
@router.get("/messages/realtime")
async def get_realtime_messages(
    topic: str = Query(..., description="要订阅的topic"),
    limit: int = Query(10, ge=1, le=100, description="返回的最新消息数量"),
    current_user: UserInDB = Depends(get_current_active_user)
):
    """从MongoDB获取指定主题的最新实时消息（仅限当前用户订阅的主题）"""
    db = AsyncIOMotorClient(MONGO_URL)[MONGO_DB_NAME]
    
    # 验证用户是否有权限查询该主题
    sub_count = await db[MONGO_USER_SUB_COLLECTION].count_documents({
        "user_id": str(current_user.id),
        "topic": {"$in": [topic, topic.split('/')[0] + '/#']}
    })
    
    if sub_count == 0:
        raise HTTPException(status_code=403, detail="无权访问该主题的消息")
    
    # 从MongoDB获取最新消息
    messages = []
    async for doc in db["mqtt_messages"].find(
        {"user_id": str(current_user.id), "topic": topic}
    ).sort("received_ts", -1).limit(limit):
        messages.append({
            "id": str(doc["_id"]),
            "topic": doc["topic"],
            "payload": str(doc["payload"]),
            "received_ts": doc["received_ts"],
            "payload_encoding": doc.get("payload_encoding", "utf-8")
        })
    
    return {"messages": messages} 