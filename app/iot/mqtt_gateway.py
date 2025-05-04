import asyncio
import asyncio_mqtt as aiomqtt
import aioredis
import json
import logging
from typing import List, Dict, Any, Optional

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# 示例 Broker 配置
BROKER_CONFIGS: List[Dict[str, Any]] = [
    {
        "id": "broker_1",
        "hostname": "localhost",
        "port": 1883,
        "initial_topics": [("test/topic", 0)],
        "db_details": {"stream_name": "mqtt_stream"},
        # 可扩展更多配置
    },
]

shutdown_event = asyncio.Event()
redis_pool: Optional[aioredis.Redis] = None

async def forward_to_redis(db_details: Dict[str, Any], topic: str, payload: bytes):
    global redis_pool
    try:
        if redis_pool:
            stream_name = db_details.get("stream_name", "mqtt_stream")
            data_to_store = {
                "topic": topic,
                "payload": payload.decode('utf-8', errors='ignore'),
            }
            await redis_pool.xadd(stream_name, {"data": json.dumps(data_to_store)})
            logging.debug(f"消息已转发到Redis stream: {stream_name}")
        else:
            logging.warning("Redis未初始化，无法转发消息")
    except Exception as e:
        logging.error(f"转发到Redis出错: {e}")

async def manage_broker_connection(config: Dict[str, Any]):
    broker_id = config["id"]
    hostname = config["hostname"]
    port = config.get("port", 1883)
    initial_topics = config.get("initial_topics", [])
    db_details = config.get("db_details", {})
    reconnect_interval = 5

    logging.info(f"[{broker_id}] 启动MQTT连接任务: {hostname}:{port}")
    while not shutdown_event.is_set():
        try:
            async with aiomqtt.Client(
                hostname=hostname,
                port=port,
            ) as client:
                logging.info(f"[{broker_id}] 已连接到 {hostname}:{port}")
                # 初始订阅
                for topic, qos in initial_topics:
                    await client.subscribe(topic, qos=qos)
                    logging.info(f"[{broker_id}] 订阅主题: {topic} (QoS {qos})")
                # 消息处理
                async for message in client.messages:
                    topic = message.topic.value
                    payload = message.payload
                    asyncio.create_task(forward_to_redis(db_details, topic, payload))
        except aiomqtt.MqttError as e:
            logging.error(f"[{broker_id}] MQTT错误: {e}，{reconnect_interval}s后重连...")
        except asyncio.CancelledError:
            logging.info(f"[{broker_id}] 连接任务被取消。")
            break
        except Exception as e:
            logging.error(f"[{broker_id}] 未知错误: {e}，{reconnect_interval}s后重连...")
        if not shutdown_event.is_set():
            try:
                await asyncio.wait_for(shutdown_event.wait(), timeout=reconnect_interval)
            except asyncio.TimeoutError:
                continue
        else:
            break
    logging.info(f"[{broker_id}] 连接任务已结束。")

async def main():
    global redis_pool, shutdown_event
    try:
        redis_pool = await aioredis.from_url("redis://localhost", decode_responses=False)
        await redis_pool.ping()
        logging.info("已连接到Redis。");
    except Exception as e:
        logging.error(f"Redis连接失败: {e}")
        return
    tasks = []
    for config in BROKER_CONFIGS:
        task = asyncio.create_task(manage_broker_connection(config))
        tasks.append(task)
    try:
        await asyncio.gather(*tasks)
    finally:
        if redis_pool:
            await redis_pool.close()
            logging.info("Redis连接已关闭。")

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logging.info("用户中断，程序退出。") 