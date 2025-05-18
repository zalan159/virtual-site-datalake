import uuid
from fastapi import APIRouter, HTTPException, Query, Depends, Header, Body
from typing import List, Optional, Dict, Any
from motor.motor_asyncio import AsyncIOMotorClient
from app.models.iot import BrokerConfig, TopicSubscription, UserTopicSubscription
from app.auth.utils import get_current_active_user
from app.models.user import UserInDB, PyObjectId
from bson import ObjectId
import os
import redis.asyncio as aioredis
import json
from fastapi.responses import JSONResponse
from datetime import datetime
import time
import logging

from app.utils.mongo_init import get_mongo_url

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
async def list_brokers(current_user: UserInDB = Depends(get_current_active_user)):
    db = AsyncIOMotorClient(MONGO_URL)[MONGO_DB_NAME]
    cursor = db[MONGO_COLLECTION_NAME].find({"user_id": str(current_user.id)})
    brokers = []
    async for doc in cursor:
        brokers.append(BrokerConfig(**doc))
    return brokers

@router.get("/brokers/{broker_id}", response_model=BrokerConfig)
async def get_broker(broker_id: str, current_user: UserInDB = Depends(get_current_active_user)):
    db = AsyncIOMotorClient(MONGO_URL)[MONGO_DB_NAME]
    try:
        obj_id = ObjectId(broker_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid broker_id format")
    
    doc = await db[MONGO_COLLECTION_NAME].find_one({"_id": obj_id, "user_id": str(current_user.id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Broker配置不存在或无权访问")
    return BrokerConfig(**doc)

@router.post("/brokers", response_model=BrokerConfig)
async def create_broker(cfg: BrokerConfig, current_user: UserInDB = Depends(get_current_active_user)):
    db = AsyncIOMotorClient(MONGO_URL)[MONGO_DB_NAME]
    
    # cfg from request body already includes user_id due to model change, 
    # but we should explicitly set/override it to the current_user's ID for security.
    data = cfg.model_dump(by_alias=True, exclude_unset=True)
    data["user_id"] = str(current_user.id) # Ensure it's current user's ID
    
    _id_to_use = data.get("_id") 
    if _id_to_use is None: 
        _id_to_use = ObjectId()
    elif not isinstance(_id_to_use, ObjectId):
        try:
            _id_to_use = ObjectId(str(_id_to_use)) 
        except Exception:
            # This should be caught by Pydantic validation of cfg if client sends invalid _id string
            pass 

    data.update({
        "_id": _id_to_use,
        "user_id": str(current_user.id), # Re-affirm user_id from authenticated user
        "version": 1,
        "last_modified": time.time()
    })
    
    # Check if hostname is provided, as it's mandatory in the model but not enforced here before insert
    if "hostname" not in data or not data["hostname"]:
        raise HTTPException(status_code=422, detail="Hostname is required for BrokerConfig")

    await db[MONGO_COLLECTION_NAME].insert_one(data)
    return BrokerConfig(**data)

@router.put("/brokers/{broker_id}", response_model=BrokerConfig)
async def update_broker(broker_id: str, cfg_update: BrokerConfig, current_user: UserInDB = Depends(get_current_active_user)):
    if "version" in cfg_update.model_dump(exclude_unset=True):
        raise HTTPException(status_code=400, detail="版本号不能手动修改")
    
    db = AsyncIOMotorClient(MONGO_URL)[MONGO_DB_NAME]
    try:
        obj_id = ObjectId(broker_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid broker_id format")

    current_broker_doc = await db[MONGO_COLLECTION_NAME].find_one({"_id": obj_id, "user_id": str(current_user.id)})
    if not current_broker_doc:
        raise HTTPException(status_code=404, detail="Broker配置不存在或无权修改")
    
    update_data = cfg_update.model_dump(exclude_unset=True, exclude={'id', '_id', 'user_id', 'version', 'last_modified'})
    # user_id should not be updatable via this endpoint
    update_data["user_id"] = str(current_user.id) # Ensure user_id remains current user's
    update_data.update({
        "version": current_broker_doc.get("version", 0) + 1,
        "last_modified": time.time()
    })
    
    result = await db[MONGO_COLLECTION_NAME].update_one(
        {"_id": obj_id, "user_id": str(current_user.id)}, # Ensure only owner can update
        {"$set": update_data}
    )
    
    if result.matched_count == 0: # Check matched_count to ensure the find criteria was met
        # This case might happen if, concurrently, the item was deleted or user_id changed (though user_id shouldn't change)
        raise HTTPException(status_code=404, detail="Broker配置不存在或更新冲突")
    if result.modified_count == 0 and update_data: # If there were actual changes proposed but nothing modified
        # This means the submitted data was identical to existing data or update_data was empty after exclusions
        # Return the current document as no modification occurred but the request was valid.
        pass # Allow returning the fetched document

    updated_doc = await db[MONGO_COLLECTION_NAME].find_one({"_id": obj_id, "user_id": str(current_user.id)})
    if not updated_doc:
        raise HTTPException(status_code=404, detail="Broker配置更新后未找到")
    return BrokerConfig(**updated_doc)

@router.delete("/brokers/{broker_id}")
async def delete_broker(broker_id: str, current_user: UserInDB = Depends(get_current_active_user)):
    db = AsyncIOMotorClient(MONGO_URL)[MONGO_DB_NAME]
    try:
        obj_id = ObjectId(broker_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid broker_id format")
        
    result = await db[MONGO_COLLECTION_NAME].delete_one({"_id": obj_id, "user_id": str(current_user.id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Broker配置不存在或无权删除")
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
    
    # Ensure broker_id is used appropriately in query if it refers to an ObjectId string
    # For this example, assuming config_id in 'broker_config_versions' is stored as string.
    # If config_id is an ObjectId, convert broker_id to ObjectId for querying.
    # query_filter = {"config_id": ObjectId(broker_id)} if ObjectId.is_valid(broker_id) else {"config_id": broker_id}
    # For simplicity, if 'config_id' is always a string derived from an ObjectId:
    query_filter = {"config_id": broker_id}

    total = await coll.count_documents(query_filter)
    cursor = coll.find(query_filter)
    cursor.sort("version", -1).skip((page-1)*page_size).limit(page_size)
    
    versions = []
    async for doc in cursor:
        # doc["_id"] = str(doc["_id"]) # Removed, assuming PyObjectId handles it if part of a model
        # If 'doc' is directly returned or part of a dict not processed by PyObjectId for '_id',
        # manual conversion might still be needed for serialization if _id is an ObjectId.
        # However, PyObjectId in models should handle this.
        # The current response is a plain dict, so _id might need str conversion if it's ObjectId
        if isinstance(doc.get("_id"), ObjectId):
             doc["_id"] = str(doc["_id"]) # Keep for direct dict return if not using Pydantic model with PyObjectId for this specific dict

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
    # Assuming current_user.id is a PyObjectId, it will be serialized to string for DB query
    # or handled correctly if the DB driver/PyMongo expects ObjectId.
    # For clarity, ensuring it's a string for the query if user_id in DB is a string.
    # If user_id in DB is ObjectId, convert str(current_user.id) to ObjectId for query.
    # Let's assume user_id is stored as a string in the 'mqtt_user_subscriptions' collection.
    user_id_str = str(current_user.id) # current_user.id is PyObjectId, str() will use its serializer

    cursor = db[MONGO_USER_SUB_COLLECTION].find({"user_id": user_id_str})
    subscriptions = []
    async for doc in cursor:
        # if "_id" in doc and not isinstance(doc["_id"], str): # Removed
        #     doc["_id"] = str(doc["_id"]) # Removed
        
        # Ensure other fields are of correct type if needed, though Pydantic should handle.
        # Example: Pydantic will validate 'user_id' against UserTopicSubscription.user_id (str)
        # if "user_id" in doc and not isinstance(doc["user_id"], str):
        #     doc["user_id"] = str(doc["user_id"])
        # if "topic" in doc and not isinstance(doc["topic"], str):
        #     doc["topic"] = str(doc["topic"])
        # if "config_id" in doc and not isinstance(doc["config_id"], str):
        #     doc["config_id"] = str(doc["config_id"])
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
    
    # Convert config_id string to ObjectId for querying
    try:
        broker_object_id = ObjectId(config_id)
    except Exception: # Handles invalid ObjectId format
        raise HTTPException(status_code=400, detail=f"无效的Broker配置ID格式: {config_id}")
        
    config = await db[MONGO_COLLECTION_NAME].find_one({"_id": broker_object_id})
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
            "_id": ObjectId(),
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
    """删除用户订阅并通知网关"""
    db = AsyncIOMotorClient(MONGO_URL)[MONGO_DB_NAME]
    
    try:
        obj_id = ObjectId(sub_id)
    except Exception:
        raise HTTPException(status_code=400, detail="无效的订阅ID格式")

    # 1. Find the subscription document BEFORE deleting it to get details for notification
    subscription_to_delete = await db[MONGO_USER_SUB_COLLECTION].find_one(
        {"_id": obj_id, "user_id": str(current_user.id)}
    )

    if not subscription_to_delete:
        raise HTTPException(status_code=404, detail="订阅不存在或无权删除")

    # 2. Delete the subscription from the database
    result = await db[MONGO_USER_SUB_COLLECTION].delete_one(
        {"_id": obj_id, "user_id": str(current_user.id)}
    )
    
    # Should always be 1 if find_one above succeeded, but good to check
    if result.deleted_count == 0:
        # This case should ideally not be reached if find_one found the doc
        raise HTTPException(status_code=404, detail="订阅删除失败，可能已被删除") 

    # 3. Notify MQTT Gateway via Redis command
    try:
        redis_pool_instance = await get_redis_pool() # Get Redis connection
        command_payload = {
            "action": "unsubscribe",
            "config_id": str(subscription_to_delete.get("config_id")), # Ensure it's string
            "user_id": str(current_user.id), # or str(subscription_to_delete.get("user_id"))
            "topic": subscription_to_delete.get("topic")
            # qos is not strictly needed for unsubscribe command but can be included if useful
        }
        await redis_pool_instance.lpush("mqtt_gateway:commands", json.dumps(command_payload))
        logger.info(f"Sent unsubscribe command to Redis for sub_id {sub_id}, topic {command_payload['topic']}")
    except Exception as e:
        logger.error(f"发送取消订阅命令到 Redis 失败 (sub_id: {sub_id}): {e}", exc_info=True)
        # Decide if this should be a critical error. For now, we log and proceed.
        # The subscription is deleted from DB; gateway might eventually sync via config_watcher or periodic checks.
        
    return {"message": "订阅已删除，并已通知网关处理"}

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