import asyncio
from aiomqtt import Client, MqttError  # ✅ 使用新的 aiomqtt 2.x API
import redis.asyncio as aioredis
import motor.motor_asyncio  # MongoDB
import json
import logging
import time
from typing import List, Dict, Any, Optional, Tuple
from pydantic import BaseModel, Field
import signal
import os
from dotenv import load_dotenv
import sys
import asyncio
from app.iot.connection_pool import ConnectionPool, init_connection_pool
from app.models.iot import BrokerConfig, TopicSubscription, UserTopicSubscription

if sys.platform.startswith('win'):
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
# --------------------------- 日志配置 ---------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger("mqtt_gateway")

# --------------------------- 加载 .env --------------------------
load_dotenv()

# --------------------------- Mongo 配置 -------------------------
MONGO_USERNAME = os.getenv("MONGO_USERNAME", "admin")
MONGO_PASSWORD = os.getenv("MONGO_PASSWORD", "admin123")
MONGO_HOST = os.getenv("MONGO_HOST", "localhost")
MONGO_PORT = os.getenv("MONGO_PORT", "27017")
MONGO_DB_NAME = os.getenv("MONGO_DB_NAME", "virtualsite")
MONGO_COLLECTION_NAME = os.getenv("MONGO_COLLECTION_NAME", "broker_configs")
MONGO_MSG_COLLECTION = os.getenv("MONGO_MSG_COLLECTION", "mqtt_messages")
MONGO_USER_SUB_COLLECTION = "mqtt_user_subscriptions"  # 新增用户订阅集合
MONGO_URI = (
    f"mongodb://{MONGO_USERNAME}:{MONGO_PASSWORD}@{MONGO_HOST}:{MONGO_PORT}/"
    f"{MONGO_DB_NAME}?authSource=admin"
)

# --------------------------- Redis 配置 -------------------------
REDIS_HOST = os.getenv("REDIS_HOST", "localhost")
REDIS_PORT = os.getenv("REDIS_PORT", "6379")
REDIS_DB = os.getenv("REDIS_DB", "0")
REDIS_PASSWORD = os.getenv("REDIS_PASSWORD", "")
REDIS_STREAM_NAME = os.getenv("REDIS_STREAM_NAME", "mqtt_stream_default")
REDIS_URL = f"redis://:{REDIS_PASSWORD}@{REDIS_HOST}:{REDIS_PORT}/{REDIS_DB}" if REDIS_PASSWORD else f"redis://{REDIS_HOST}:{REDIS_PORT}/{REDIS_DB}"

# --------------------------- 常量 / 状态 ------------------------
shutdown_event = asyncio.Event()
redis_pool: Optional[aioredis.Redis] = None
active_tasks: Dict[str, asyncio.Task] = {}
connection_pool: Optional[ConnectionPool] = None

# --------------------------- Redis 状态 ------------------------

def _status_key(cfg_id: str) -> str:
    return f"mqtt_gateway:status:{cfg_id}"


async def update_redis_status(cfg_id: str, data: Dict[str, Any]) -> None:
    """将连接状态写入 Redis Hash."""
    if not redis_pool:
        logger.warning("[%s] Redis 未就绪, 无法写入状态", cfg_id)
        return

    payload = {
        "status": data.get("status", "unknown"),
        "last_update_ts": time.time(),
        "last_update_readable": time.strftime("%Y-%m-%d %H:%M:%S", time.localtime()),
        "hostname": data.get("hostname", ""),
        "port": str(data.get("port", "")),
        "username": data.get("username") or "",
        "subscribed_topics": json.dumps(data.get("subscribed_topics", [])),
        "last_error": data.get("last_error", ""),
        "pid": data.get("pid", 0),
    }
    try:
        await redis_pool.hset(_status_key(cfg_id), mapping=payload)
    except Exception as exc:
        logger.error("[%s] 更新 Redis 状态失败: %s", cfg_id, exc)


async def set_status_disconnected(cfg_id: str, hostname: str, port: int, username: Optional[str]):
    await update_redis_status(
        cfg_id,
        {
            "status": "disconnected",
            "hostname": hostname,
            "port": port,
            "username": username,
            "last_error": "Gateway shutdown or task stopped.",
            "subscribed_topics": [],
        },
    )


# --------------------------- Mongo 加载配置 --------------------
async def load_configs(last_check: float = 0) -> Tuple[List[Dict[str, Any]], float]:
    """增量加载配置，返回(变更的配置列表, 新的检查时间戳)"""
    client = None
    changed_cfgs = []
    try:
        client = motor.motor_asyncio.AsyncIOMotorClient(MONGO_URI)
        coll = client[MONGO_DB_NAME][MONGO_COLLECTION_NAME]
        
        # 构建查询条件
        query = {}
        if last_check > 0:
            # 只查询更新的配置
            query = {
                "$or": [
                    {"updated_at": {"$gt": last_check}},
                    {"created_at": {"$gt": last_check}}
                ]
            }
        
        async for doc in coll.find(query):
            try:
                if "_id" in doc and not isinstance(doc["_id"], str):
                    doc["_id"] = str(doc["_id"])
                validated = BrokerConfig(**doc).dict()
                changed_cfgs.append(validated)
            except Exception as err:
                logger.error("配置验证失败 (%s): %s", doc.get("_id", "?"), err)

        return changed_cfgs, time.time()
    except Exception as exc:
        logger.error("读取MongoDB失败: %s", exc)
        return [], last_check
    finally:
        if client:
            client.close()

# --------------------------- 用户订阅管理 --------------------
async def load_user_subscriptions(config_id: str = None):
    """加载用户订阅关系"""
    client = None
    try:
        client = motor.motor_asyncio.AsyncIOMotorClient(MONGO_URI)
        coll = client[MONGO_DB_NAME][MONGO_USER_SUB_COLLECTION]
        
        # 构建查询
        query = {}
        if config_id:
            query["config_id"] = config_id
        
        subscriptions = []
        async for doc in coll.find(query):
            if "_id" in doc and not isinstance(doc["_id"], str):
                doc["_id"] = str(doc["_id"])
            subscriptions.append(doc)
        
        return subscriptions
    except Exception as exc:
        logger.error("读取用户订阅失败: %s", exc)
        return []
    finally:
        if client:
            client.close()

async def apply_user_subscriptions(config_id: str):
    """应用用户订阅"""
    global connection_pool
    
    # 加载配置
    client = motor.motor_asyncio.AsyncIOMotorClient(MONGO_URI)
    config = await client[MONGO_DB_NAME][MONGO_COLLECTION_NAME].find_one({"_id": config_id})
    if not config:
        logger.error(f"[{config_id}] 配置不存在")
        return False
    
    # 加载用户订阅
    subscriptions = await load_user_subscriptions(config_id)
    
    # 应用订阅
    for sub in subscriptions:
        try:
            user_id = sub["user_id"]
            topic = sub["topic"]
            qos = sub.get("qos", 0)
            # 兼容topic为list的情况
            if isinstance(topic, list):
                for t in topic:
                    await connection_pool.subscribe(config, t, qos, user_id)
                    logger.info(f"[{config_id}] 应用用户{user_id}订阅: {t}")
            else:
                await connection_pool.subscribe(config, topic, qos, user_id)
                logger.info(f"[{config_id}] 应用用户{user_id}订阅: {topic}")
        except Exception as e:
            logger.error(f"[{config_id}] 应用订阅失败: {e}")
    
    # 清理无效连接
    await connection_pool.cleanup_idle_connections()
    
    return True

# --------------------------- Redis Stream -> MongoDB --------------------
async def consume_redis_stream_to_mongo(
    stream_name: str = REDIS_STREAM_NAME,
    batch_size: int = 1000,
    interval: int = 10
):
    """定期从 Redis Stream 消费数据并存入 MongoDB"""
    consumer_group = "mongo_consumers"
    last_id = ">"  # 使用特殊ID表示只消费新消息
    client = motor.motor_asyncio.AsyncIOMotorClient(MONGO_URI)
    collection = client[MONGO_DB_NAME][MONGO_MSG_COLLECTION]
    global redis_pool

    try:
        # 创建消费者组（如果不存在）
        await redis_pool.xgroup_create(stream_name, consumer_group, id="0", mkstream=True)
    except Exception as e:
        if "BUSYGROUP" not in str(e):
            logger.error("创建消费者组失败: %s", e)

    while not shutdown_event.is_set():
        try:
            # 使用消费者组读取消息
            results = await redis_pool.xreadgroup(
                groupname=consumer_group,
                consumername="mongo_worker",
                streams={stream_name: last_id},
                count=batch_size,
                block=1000
            )

            docs = []
            pending_ack = []
            for stream, messages in results:
                for msg_id, msg_data in messages:
                    data = msg_data.get(b"data")
                    if data:
                        try:
                            doc = json.loads(data)
                            doc["redis_id"] = msg_id.decode() if isinstance(msg_id, bytes) else msg_id
                            docs.append(doc)
                            pending_ack.append(msg_id)
                        except Exception as e:
                            logger.error("解析 Stream 数据失败: %s", e)

            # 批量写入 MongoDB
            if docs:
                try:
                    await collection.insert_many(docs)
                    logger.info("已写入 %d 条消息到 MongoDB", len(docs))
                    # 写入成功后确认消息
                    await redis_pool.xack(stream_name, consumer_group, *pending_ack)
                    # 删除已确认消息（避免 Redis 数据堆积）
                    await redis_pool.xdel(stream_name, *pending_ack)
                except Exception as e:
                    logger.error("批量写入失败，保留消息重试: %s", e)
                    # 写入失败时不确认消息，等待下次重试

        except Exception as exc:
            logger.error("消费 Redis Stream 失败: %s", exc)

        # 等待 interval 秒
        try:
            await asyncio.wait_for(shutdown_event.wait(), timeout=interval)
        except asyncio.TimeoutError:
            continue

    client.close()

# --------------------------- 主程序 ---------------------------
async def main():
    global redis_pool, connection_pool

    # Redis 连接
    try:
        redis_pool = await aioredis.from_url(REDIS_URL, decode_responses=False)
        await redis_pool.ping()
        logger.info("已连接 Redis (%s)", REDIS_URL)
    except Exception as exc:
        logger.critical("Redis 连接失败: %s", exc)
        return

    # 初始化连接池（这是唯一的连接管理入口）
    connection_pool = await init_connection_pool(redis_pool)
    logger.info("MQTT连接池已初始化")

    # 系统任务只需要保留配置监控和命令监听
    system_tasks = {
        "sys_config_watcher": asyncio.create_task(config_watcher()),
        "sys_command_listener": asyncio.create_task(command_listener()),
        "sys_redis2mongo": asyncio.create_task(consume_redis_stream_to_mongo())
    }
    active_tasks.update(system_tasks)
    
    logger.info("启动完成，系统任务：%s", ", ".join(system_tasks.keys()))
    
    # 主循环（连接池会自动管理连接）
    while not shutdown_event.is_set():
        await asyncio.sleep(1)
    
    # 关闭所有连接（通过连接池统一关闭）
    if connection_pool:
        await connection_pool.close_all()
    
    # 关闭Redis连接
    if redis_pool:
        await redis_pool.close()

# --------------------------- 信号处理 -------------------------

def _signal_handler(sig, frame):
    logger.warning("收到信号 %s, 开始关闭 …", sig)
    shutdown_event.set()


for _sig in (signal.SIGINT, signal.SIGTERM):
    signal.signal(_sig, _signal_handler)

async def config_watcher(interval: int = 30):
    """配置变更监控协程"""
    last_configs = {}  # 缓存上次的配置
    last_check = 0  # 上次检查时间戳
    
    while not shutdown_event.is_set():
        try:
            # 获取自上次检查以来发生变化的配置
            changed_cfgs, new_check = await load_configs(last_check)
            
            # 处理变更的配置
            for cfg in changed_cfgs:
                cfg_id = cfg['id']
                
                # 检查配置是否真正发生变化
                if cfg_id in last_configs:
                    # 比较配置内容
                    old_cfg = last_configs[cfg_id]
                    if (old_cfg.get('hostname') == cfg.get('hostname') and
                        old_cfg.get('port') == cfg.get('port') and
                        old_cfg.get('username') == cfg.get('username') and
                        old_cfg.get('password') == cfg.get('password')):
                        continue  # 配置未变，跳过
                
                # 更新缓存并应用订阅
                last_configs[cfg_id] = cfg
                await apply_user_subscriptions(cfg_id)
                logger.info(f"[{cfg_id}] 配置已更新")
            
            last_check = new_check  # 更新检查时间戳
            await asyncio.sleep(interval)
        except asyncio.CancelledError:
            break
        except Exception as e:
            logger.error("Config watcher error: %s", e)
            await asyncio.sleep(interval)

async def command_listener():
    """Redis命令监听协程"""
    while not shutdown_event.is_set():
        try:
            # 阻塞式读取命令，超时1秒
            cmd = await redis_pool.blpop("mqtt_gateway:commands", timeout=1)
            if not cmd:
                continue

            _, payload = cmd
            try:
                data = json.loads(payload)
                action = data.get("action")
                cfg_id = data.get("config_id")
                user_id = data.get("user_id")
                topic = data.get("topic")
                qos = data.get("qos", 0)

                if action == "reload":
                    # 重新加载单个配置
                    cfgs, _ = await load_configs(0)
                    target_cfg = next((c for c in cfgs if c["id"] == cfg_id), None)
                    
                    if target_cfg:
                        # 重新应用用户订阅（连接池自动处理）
                        await apply_user_subscriptions(cfg_id)
                        logger.info(f"[{cfg_id}] 手动重载完成")

                elif action == "subscribe":
                    # 动态添加订阅（通过连接池处理）
                    if not all([cfg_id, user_id, topic]):
                        logger.error("订阅命令缺少必要参数")
                        continue
                    
                    # 获取配置
                    client = motor.motor_asyncio.AsyncIOMotorClient(MONGO_URI)
                    config = await client[MONGO_DB_NAME][MONGO_COLLECTION_NAME].find_one({"_id": cfg_id})
                    if not config:
                        logger.error(f"[{cfg_id}] 配置不存在")
                        continue
                    
                    # 直接通过连接池订阅
                    success = await connection_pool.subscribe(config, topic, qos, user_id)
                    
                    if success:
                        logger.info(f"[{cfg_id}] 用户{user_id}订阅主题{topic}成功")
                    else:
                        logger.error(f"[{cfg_id}] 用户{user_id}订阅主题{topic}失败")

                elif action == "unsubscribe":
                    # 动态取消订阅（通过连接池处理）
                    if not all([cfg_id, user_id, topic]):
                        logger.error("取消订阅命令缺少必要参数")
                        continue
                    
                    # 获取配置
                    client = motor.motor_asyncio.AsyncIOMotorClient(MONGO_URI)
                    config = await client[MONGO_DB_NAME][MONGO_COLLECTION_NAME].find_one({"_id": cfg_id})
                    if not config:
                        logger.error(f"[{cfg_id}] 配置不存在")
                        continue
                    
                    # 直接通过连接池取消订阅
                    success = await connection_pool.unsubscribe(config, topic, user_id)
                    
                    if success:
                        logger.info(f"[{cfg_id}] 用户{user_id}取消订阅主题{topic}成功")
                    else:
                        logger.error(f"[{cfg_id}] 用户{user_id}取消订阅主题{topic}失败")

            except json.JSONDecodeError:
                logger.error("无效的命令格式")
            except KeyError as e:
                logger.error("命令缺少必要字段: %s", e)
            except Exception as e:
                logger.error("命令处理失败: %s", e)

        except redis.RedisError as e:
            logger.error("Redis连接异常: %s", e)
            await asyncio.sleep(5)
        except Exception as e:
            logger.error("命令监听异常: %s", e)

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        pass
