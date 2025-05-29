import asyncio
import logging
import json
import time
import uuid
from typing import Dict, List, Set, Any, Optional, Tuple
from collections import defaultdict
from aiomqtt import Client, MqttError
import redis.asyncio as aioredis

from app.models.iot import BrokerConfig, UserTopicSubscription

logger = logging.getLogger("mqtt_connection_pool")

# 全局共享对象
redis_pool: Optional[aioredis.Redis] = None
REDIS_STREAM_NAME = "mqtt_stream_default"

class MQTTConnection:
    """MQTT连接封装类"""
    def __init__(self, conn_key: str, broker_info: Dict):
        self.conn_key = conn_key  # 连接唯一键 (hostname:port:username)
        self.broker_info = broker_info
        self.client: Optional[Client] = None
        logger.info(f"[{self.conn_key}] MQTTConnection __init__: self.client is initially {self.client}, id: {id(self.client)}")
        self.client_task: Optional[asyncio.Task] = None
        self.subscriptions: Dict[str, Set[str]] = defaultdict(set)  # topic -> {user_id1, user_id2, ...}
        self.is_connected = False
        self.reconnect_interval = 5  # 初始重连间隔
        self.max_reconnect_interval = 60  # 最大重连间隔
        self.connection_lock = asyncio.Lock()  # 防止并发连接
        self.connected_event = asyncio.Event()  # 新增：连接建立事件
        self.keepalive = 60  # 新增保活参数
        self.last_activity = 0  # 最后活动时间戳
    
    def get_connection_key(self) -> str:
        return self.conn_key
    
    async def ensure_connected(self) -> bool:
        """确保连接已建立"""
        async with self.connection_lock:
            if self.is_connected and self.client and self.client_task and not self.client_task.done():
                await self.connected_event.wait()  # 等待连接真正建立
                return True
            
            # Potentially problematic if _close_connection fails due to AttributeError
            # Consider if this call is always safe or needed if self.client is None initially.
            if self.client: # Only call _close_connection if there's an existing client to clean up
                logger.info(f"[{self.conn_key}] ensure_connected: Found existing client, calling _close_connection first.")
                await self._close_connection()
            else:
                logger.info(f"[{self.conn_key}] ensure_connected: No existing client, proceeding to create new one.")

            hostname = self.broker_info.get("hostname")
            port = self.broker_info.get("port", 1883)
            username = self.broker_info.get("username")
            password = self.broker_info.get("password")
            try:
                self.client = Client(
                    hostname=hostname,
                    port=port,
                    username=username,
                    password=password
                    # Ensure other necessary params like client_id, keepalive are considered if needed by your aiomqtt version or broker
                )
                logger.info(f"[{self.conn_key}] ensure_connected: NEW self.client CREATED: {self.client}, id: {id(self.client)}, type: {type(self.client)}")
                logger.info(f"[{self.conn_key}] ensure_connected: dir(self.client) AFTER CREATION: {dir(self.client)}")

                self.connected_event.clear() 
                self.client_task = asyncio.create_task(self._message_handler())
                
                try:
                    await asyncio.wait_for(self.connected_event.wait(), timeout=10)
                except asyncio.TimeoutError:
                    logger.error(f"[{self.conn_key}] 连接超时等待 connected_event")
                    # Even if timed out, the task is running. Consider cleanup or error propagation.
                    # For now, let it proceed, _message_handler might still set is_connected.
                    return False # Or handle more gracefully
                
                if not self.is_connected:
                    logger.warning(f"[{self.conn_key}] ensure_connected: connected_event set, but is_connected is False. Task status: {self.client_task.done() if self.client_task else 'No task'}")
                    return False
                
                self.reconnect_interval = 5 
                logger.info(f"[{self.conn_key}] 连接成功 (ensure_connected)")
                await self._resubscribe_all()
                return True
            except Exception as e:
                logger.error(f"[{self.conn_key}] 创建MQTT Client或启动任务失败 (ensure_connected): {e}", exc_info=True)
                # Fallback for self.client if instantiation failed before assignment
                if hasattr(self, 'client') and self.client is not None:
                     logger.info(f"[{self.conn_key}] ensure_connected: self.client after EXCEPTION: {self.client}, id: {id(self.client)}, type: {type(self.client)}")
                # Exponential backoff for retries (if this method is called in a loop)
                # await asyncio.sleep(self.reconnect_interval)
                # self.reconnect_interval = min(self.reconnect_interval * 1.5, self.max_reconnect_interval)
                return False
    
    async def _close_connection(self):
        """关闭连接（增强版）"""
        logger.info(f"[{self.conn_key}] _close_connection called. Current client: {self.client}, id: {id(self.client) if self.client else 'N/A'}")
        # 1. 取消并等待任务
        if self.client_task:
            if not self.client_task.done():
                self.client_task.cancel()
                try:
                    await self.client_task
                except asyncio.CancelledError:
                    logger.info(f"[{self.conn_key}] 连接任务已正确取消 (_close_connection)")
                except Exception as e:
                    logger.error(f"[{self.conn_key}] _close_connection: 等待任务完成发生错误: {e}", exc_info=True)
            else:
                logger.info(f"[{self.conn_key}] _close_connection: 连接任务已完成，无需取消.")
        
        # 2. 关闭 aiomqtt.Client 实例
        if self.client:
            logger.info(f"[{self.conn_key}] _close_connection: self.client BEFORE __aexit__: {self.client}, id: {id(self.client)}, type: {type(self.client)}")
            logger.info(f"[{self.conn_key}] _close_connection: dir(self.client) BEFORE __aexit__: {dir(self.client)}")
            try:
                # 使用 __aexit__ 来代替不存在的 disconnect 方法
                # __aexit__ 会处理底层的 Paho client 的 disconnect
                await self.client.__aexit__(None, None, None) 
                logger.info(f"[{self.conn_key}] 已通过 __aexit__ 清理MQTT连接")
            except MqttError as e: # aiomqtt.MqttError
                logger.error(f"[{self.conn_key}] __aexit__ 时发生MQTT错误: {e}", exc_info=True)
            # AttributeError 不应再发生，因为我们不再调用 .disconnect()
            # except AttributeError as ae: 
            #     logger.error(f"[{self.conn_key}] AttributeError during __aexit__ (should not happen): {ae}. Attributes of self.client: {dir(self.client)}", exc_info=True)
            except Exception as e:
                logger.error(f"[{self.conn_key}] __aexit__ 时发生未知错误: {e}", exc_info=True)
        else:
            logger.info(f"[{self.conn_key}] _close_connection: No client instance to run __aexit__ on.")
        
        # 3. 清理状态 (确保总是在 finally 中执行，或者在此处，因为前面错误已捕获)
        # 将状态清理移到这里，确保即使 __aexit__ 出错也执行
        self.client = None
        self.client_task = None
        self.is_connected = False # 标记为未连接
        self.connected_event.clear() # 重置事件
        # self.subscriptions.clear() # 通常在连接关闭时不清除订阅，因为它们可能需要用于重连后的重新订阅
        # 但如果 _close_connection 意味着永久关闭，则清除是合理的。
        # 暂时保留不清除，因为重连逻辑可能会用到。如果这是永久关闭，则应清除。
        logger.info(f"[{self.conn_key}] _close_connection: Connection state reset.")
    
    async def _message_handler(self):
        """处理MQTT消息"""
        # 更新最后活动时间
        self.last_activity = time.time()
        try:
            async with self.client:
                self.is_connected = True
                self.connected_event.set()  # 连接建立，事件 set
                async for message in self.client.messages:
                    # 新增订阅状态检查
                    if not self.subscriptions:
                        logger.info(f"[{self.conn_key}] 无活跃订阅，停止消息处理")
                        break
                    
                    topic = str(message.topic)
                    payload = message.payload
                    
                    # 根据订阅列表找出哪些用户订阅了此主题
                    for user_id in self._get_users_for_topic(topic):
                        # 找出哪些配置与此连接和用户相关
                        for config_id in await ConnectionPool.get_instance().get_configs_by_connection(self.conn_key):
                            # 获取流名称
                            stream_name = ConnectionPool.get_instance().get_stream_name(config_id)
                            
                            # 转发到Redis Stream
                            try:
                                # 尝试解析消息
                                try:
                                    payload_str = payload.decode("utf-8")
                                    encoding = "utf-8"
                                except UnicodeDecodeError:
                                    import base64
                                    payload_str = base64.b64encode(payload).decode()
                                    encoding = "base64"
                                
                                # 构建记录
                                record = {
                                    "user_id": user_id,
                                    "config_id": config_id,
                                    "topic": str(topic),
                                    "payload": payload_str,
                                    "payload_encoding": encoding,
                                    "received_ts": time.time(),
                                }
                                
                                if redis_pool:
                                    await redis_pool.xadd(stream_name, {"data": json.dumps(record)})
                                    await self._update_subscription_activity(user_id, config_id, topic)
                            except Exception as e:
                                logger.error(f"[{self.conn_key}] 消息处理失败: {e}", exc_info=True)
        except asyncio.CancelledError:
            self.is_connected = False
            self.connected_event.clear()
            raise
        except Exception as e:
            self.is_connected = False
            self.connected_event.clear()
            logger.error(f"[{self.conn_key}] 消息处理异常: {e}", exc_info=True)
            # 连接出错，触发重连
            asyncio.create_task(self.ensure_connected())
    
    def _get_users_for_topic(self, message_topic: str) -> Set[str]:
        """精确匹配通配符订阅"""
        subscribers = set()
        
        # 先处理精确匹配
        if message_topic in self.subscriptions:
            subscribers.update(self.subscriptions[message_topic])
        
        # 处理通配符匹配
        for sub_topic in self.subscriptions:
            if sub_topic == "#":
                subscribers.update(self.subscriptions[sub_topic])
                continue
            
            if "+" in sub_topic or "#" in sub_topic:
                topic_parts = sub_topic.split("/")
                msg_parts = message_topic.split("/")
                
                match = True
                for i, part in enumerate(topic_parts):
                    if part == "#":
                        if i == len(topic_parts)-1:
                            subscribers.update(self.subscriptions[sub_topic])
                            break
                        else:
                            match = False
                            break
                    elif part == "+":
                        if i >= len(msg_parts):
                            match = False
                            break
                    else:
                        if i >= len(msg_parts) or part != msg_parts[i]:
                            match = False
                            break
                if match:
                    subscribers.update(self.subscriptions[sub_topic])
        
        return subscribers
    
    async def _update_subscription_activity(self, user_id: str, config_id: str, topic: str):
        """更新订阅活动状态"""
        if redis_pool:
            key = f"mqtt:subscription:{config_id}:{user_id}:{topic}"
            await redis_pool.hset(key, mapping={
                "last_active": time.time(),
                "last_active_readable": time.strftime("%Y-%m-%d %H:%M:%S", time.localtime()),
            })
    
    async def subscribe(self, topic: str, qos: int, user_id: str, config_id: str) -> bool:
        """智能订阅管理"""
        if not self.subscriptions.get(topic):
            # 首次订阅时建立连接
            if not await self.ensure_connected():
                return False
            try:
                await self.client.subscribe(topic, qos)
            except Exception as e:
                logger.error(f"订阅失败: {topic} - {e}")
                return False
        self.subscriptions[topic].add(user_id)
        return True
    
    async def unsubscribe(self, topic: str, user_id: str, config_id: str) -> bool:
        """取消订阅主题，支持 topic 为 str 或 list[str]"""
        try:
            # 统一处理 topic 为列表的情况
            topics = [topic] if isinstance(topic, str) else topic
            
            for t in topics:
                original_count = len(self.subscriptions.get(t, set()))
                
                if t in self.subscriptions:
                    self.subscriptions[t].discard(user_id)
                    current_count = len(self.subscriptions[t])
                    
                    # 如果当前用户是最后一个订阅者
                    if current_count == 0 and original_count > 0:
                        if self.client and self.is_connected:
                            try:
                                await self.client.unsubscribe(t)
                                logger.info(f"[{self.conn_key}] 成功取消订阅主题: {t}")
                            except Exception as e:
                                logger.error(f"[{self.conn_key}] 取消订阅失败: {t} - {e}")
                        del self.subscriptions[t]
                
                # 强制清理空主题
                self.subscriptions = {k:v for k,v in self.subscriptions.items() if v}
            
            # 在所有主题处理完成后检查连接状态
            if not self.subscriptions:
                logger.info(f"[{self.conn_key}] 无活跃订阅，立即关闭连接")
                await self._close_connection()
            
            return True
        except Exception as e:
            logger.error(f"[{self.conn_key}] 取消订阅失败: {e}", exc_info=True)
            return False
    
    async def _resubscribe_all(self):
        """重新订阅所有主题"""
        if not self.client or not self.is_connected:
            return
            
        for topic, user_ids in self.subscriptions.items():
            if user_ids:  # 只订阅有用户的主题
                try:
                    await self.client.subscribe(topic)
                    logger.info(f"[{self.conn_key}] 重新订阅主题: {topic}")
                except Exception as e:
                    logger.error(f"[{self.conn_key}] 重新订阅失败: {topic}, {e}")

    async def check_idle(self):
        """检查空闲连接（立即关闭无订阅的连接）"""
        if not self.subscriptions:
            logger.info(f"[{self.conn_key}] 检查到无活跃订阅，关闭连接")
            await self._close_connection()
            return True
        return False

class ConnectionPool:
    """MQTT连接池"""
    _instance = None
    
    @classmethod
    def get_instance(cls):
        if cls._instance is None:
            cls._instance = ConnectionPool()
        return cls._instance
    
    def __init__(self):
        self.connections: Dict[str, MQTTConnection] = {}  # 连接键 -> 连接对象
        self.config_map: Dict[str, Dict] = {}  # config_id (string) -> 配置信息 (dict)
        self.config_to_conn: Dict[str, str] = {}  # config_id (string) -> 连接键 (string)
        self.lock = asyncio.Lock()
    
    def _get_string_broker_id(self, broker_config: Dict) -> Optional[str]:
        """可靠地从broker_config字典中获取broker ID的字符串形式。"""
        if not broker_config:
            logger.warning("空的 broker_config 传入 _get_string_broker_id")
            return None

        # 尝试获取 "id" (来自 Pydantic model.dump()) 或 "_id" (来自原始DB文档)
        broker_id_val = broker_config.get("id", broker_config.get("_id"))
        
        if broker_id_val is None:
            logger.warning(f"Broker config中缺少 'id' 或 '_id' : {broker_config.get('hostname', 'N/A')}")
            return None # 或者根据策略返回一个唯一占位符或抛出错误
        
        return str(broker_id_val) #确保是字符串 (ObjectId会转为str, str保持不变)

    def get_connection_key(self, broker_config: Dict) -> str:
        """生成连接唯一键（简化版本）"""
        host = broker_config["hostname"]
        port = broker_config["port"]
        return f"{host}:{port}"
    
    def get_stream_name(self, config_id: str) -> str:
        """获取配置的流名称"""
        if config_id in self.config_map:
            db_details = self.config_map[config_id].get("db_details", {})
            return db_details.get("stream_name", REDIS_STREAM_NAME)
        return REDIS_STREAM_NAME
    
    async def get_configs_by_connection(self, conn_key: str) -> List[str]:
        """获取使用指定连接的所有配置ID"""
        return [cfg_id for cfg_id, conn in self.config_to_conn.items() if conn == conn_key]
    
    async def get_or_create_connection(self, broker_config: Dict) -> Optional[MQTTConnection]:
        """获取或创建连接"""
        async with self.lock:
            broker_id_str = self._get_string_broker_id(broker_config)
            if not broker_id_str:
                logger.error(f"无法为 broker_config 获取有效的字符串ID: {broker_config.get('hostname', 'N/A')}")
                return None #无法处理没有有效ID的配置

            # 保存配置信息
            self.config_map[broker_id_str] = broker_config
            
            # 生成连接键
            conn_key = self.get_connection_key(broker_config)
            self.config_to_conn[broker_id_str] = conn_key
            
            # 获取或创建连接
            if conn_key not in self.connections:
                self.connections[conn_key] = MQTTConnection(conn_key, broker_config)
            
            return self.connections[conn_key]
    
    async def subscribe(self, broker_config: Dict, topic: str, qos: int, user_id: str) -> bool:
        """订阅主题，支持 topic 为 str 或 list[str]"""
        connection = await self.get_or_create_connection(broker_config)
        if not connection:
            return False # 如果无法获取或创建连接
            
        broker_id_str = self._get_string_broker_id(broker_config)
        if not broker_id_str:
             logger.error(f"订阅时无法从 broker_config 获取有效的字符串ID: {broker_config.get('hostname', 'N/A')}")
             return False
        return await connection.subscribe(topic, qos, user_id, broker_id_str)
    
    async def unsubscribe(self, broker_config: Dict, topic: str, user_id: str) -> bool:
        """取消订阅主题，支持 topic 为 str 或 list[str]"""
        conn_key = self.get_connection_key(broker_config) # Fine, uses hostname/port
        if conn_key in self.connections:
            broker_id_str = self._get_string_broker_id(broker_config)
            if not broker_id_str:
                logger.error(f"取消订阅时无法从 broker_config 获取有效的字符串ID: {broker_config.get('hostname', 'N/A')}")
                return False # 或者 True 如果认为操作不应失败
            return await self.connections[conn_key].unsubscribe(
                topic, user_id, broker_id_str
            )
        return True  # 如果连接不存在，视为成功
    
    async def close_all(self):
        """关闭所有连接"""
        for conn in self.connections.values():
            await conn._close_connection()
        self.connections.clear()

    async def cleanup_idle_connections(self):
        """定期清理空闲连接"""
        async with self.lock:
            to_remove = []
            for conn_key, conn in self.connections.items():
                if await conn.check_idle():
                    to_remove.append(conn_key)
            for key in to_remove:
                del self.connections[key]

# 初始化连接池
async def init_connection_pool(r_pool: aioredis.Redis):
    """初始化连接池"""
    global redis_pool
    redis_pool = r_pool
    return ConnectionPool.get_instance() 