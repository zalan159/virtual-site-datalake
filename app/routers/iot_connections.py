"""
IoT连接统一管理路由
提供跨协议的连接配置管理接口
"""

from fastapi import APIRouter, HTTPException, Depends
from motor.motor_asyncio import AsyncIOMotorDatabase
from typing import List, Dict, Any, Optional
from bson import ObjectId
from bson.errors import InvalidId

from app.db.mongo_db import get_database
from app.models.mqtt import MQTTInDB
from app.models.http import HTTPInDB
from app.models.websocket import WebSocketInDB
from app.models.iot_bindings import IoTProtocolType
from app.auth.utils import get_current_active_user
from app.models.user import UserInDB

router = APIRouter()


# 统一的连接信息接口
class ConnectionInfo:
    def __init__(self, connection_data: Dict[str, Any], protocol: IoTProtocolType):
        self.id = str(connection_data.get("_id"))
        self.protocol = protocol
        self.name = connection_data.get("name", "")
        self.enabled = connection_data.get("enabled", True)
        self.created_at = connection_data.get("created_at")
        self.updated_at = connection_data.get("updated_at")
        self.tags = connection_data.get("tags", [])
        
        # 根据协议类型提取特定配置
        if protocol == IoTProtocolType.MQTT:
            self.config = {
                "host": connection_data.get("host"),
                "port": connection_data.get("port"),
                "username": connection_data.get("username"),
                "password": connection_data.get("password"),
                "use_tls": connection_data.get("use_tls", False),
                "ca_cert_path": connection_data.get("ca_cert_path"),
            }
        elif protocol == IoTProtocolType.HTTP:
            self.config = {
                "base_url": connection_data.get("base_url"),
                "auth_type": connection_data.get("auth_type"),
                "headers": connection_data.get("headers", {}),
                "timeout": connection_data.get("timeout", 30),
            }
        elif protocol == IoTProtocolType.WEBSOCKET:
            self.config = {
                "url": connection_data.get("url"),
                "protocols": connection_data.get("protocols", []),
                "headers": connection_data.get("headers", {}),
                "auth_type": connection_data.get("auth_type"),
            }
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "protocol": self.protocol.value,
            "name": self.name,
            "enabled": self.enabled,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
            "tags": self.tags,
            "config": self.config,
        }


async def find_connection_by_id(db: AsyncIOMotorDatabase, connection_id: str) -> Optional[ConnectionInfo]:
    """
    根据连接ID在所有协议集合中查找连接配置
    """
    if not ObjectId.is_valid(connection_id):
        return None
    
    object_id = ObjectId(connection_id)
    
    # 尝试在MQTT集合中查找
    mqtt_conn = await db.mqtt_connections.find_one({"_id": object_id})
    if mqtt_conn:
        return ConnectionInfo(mqtt_conn, IoTProtocolType.MQTT)
    
    # 尝试在HTTP集合中查找
    http_conn = await db.http_connections.find_one({"_id": object_id})
    if http_conn:
        return ConnectionInfo(http_conn, IoTProtocolType.HTTP)
    
    # 尝试在WebSocket集合中查找
    ws_conn = await db.websocket_connections.find_one({"_id": object_id})
    if ws_conn:
        return ConnectionInfo(ws_conn, IoTProtocolType.WEBSOCKET)
    
    return None


async def find_connection_by_binding_id(db: AsyncIOMotorDatabase, scene_id: str, instance_id: str, binding_id: str) -> Optional[ConnectionInfo]:
    """
    根据IoT绑定ID查找对应的连接配置
    
    Args:
        db: 数据库连接
        scene_id: 场景ID
        instance_id: 实例ID  
        binding_id: IoT绑定ID
        
    Returns:
        ConnectionInfo: 连接配置信息，如果未找到返回None
    """
    from app.models.scene import Scene, Instance
    from app.models.iot_bindings import IoTBinding
    
    try:
        # 1. 获取场景和实例
        scene = Scene.nodes.get_or_none(uid=scene_id)
        if not scene:
            return None
            
        instance = Instance.nodes.get_or_none(uid=instance_id)
        if not instance:
            return None
        
        # 2. 查找指定的IoT绑定
        iot_binds = getattr(instance, 'iot_binds', None) or []
        
        binding_data = None
        for bind_data in iot_binds:
            if bind_data.get("id") == binding_id:
                binding_data = bind_data
                break
        
        if not binding_data:
            return None
        
        # 3. 解析IoT绑定并获取sourceId
        try:
            binding = IoTBinding(**binding_data)
            source_id = binding.sourceId
        except Exception:
            return None
        
        # 4. 使用sourceId查找连接配置
        return await find_connection_by_id(db, source_id)
        
    except Exception:
        return None


@router.get("/connections", summary="获取所有连接配置")
async def get_all_connections(
    protocol: Optional[IoTProtocolType] = None,
    enabled: Optional[bool] = None,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: UserInDB = Depends(get_current_active_user)
) -> List[Dict[str, Any]]:
    """
    获取所有连接配置，支持按协议和状态过滤
    """
    connections = []
    
    # 构建查询条件
    query = {}
    if enabled is not None:
        query["enabled"] = enabled
    
    # 如果指定了协议，只查询该协议
    if protocol:
        if protocol == IoTProtocolType.MQTT:
            mqtt_conns = await db.mqtt_connections.find(query).to_list(None)
            connections.extend([ConnectionInfo(conn, IoTProtocolType.MQTT).to_dict() for conn in mqtt_conns])
        elif protocol == IoTProtocolType.HTTP:
            http_conns = await db.http_connections.find(query).to_list(None)
            connections.extend([ConnectionInfo(conn, IoTProtocolType.HTTP).to_dict() for conn in http_conns])
        elif protocol == IoTProtocolType.WEBSOCKET:
            ws_conns = await db.websocket_connections.find(query).to_list(None)
            connections.extend([ConnectionInfo(conn, IoTProtocolType.WEBSOCKET).to_dict() for conn in ws_conns])
    else:
        # 查询所有协议的连接
        mqtt_conns = await db.mqtt_connections.find(query).to_list(None)
        connections.extend([ConnectionInfo(conn, IoTProtocolType.MQTT).to_dict() for conn in mqtt_conns])
        
        http_conns = await db.http_connections.find(query).to_list(None)
        connections.extend([ConnectionInfo(conn, IoTProtocolType.HTTP).to_dict() for conn in http_conns])
        
        ws_conns = await db.websocket_connections.find(query).to_list(None)
        connections.extend([ConnectionInfo(conn, IoTProtocolType.WEBSOCKET).to_dict() for conn in ws_conns])
    
    # 按创建时间排序
    connections.sort(key=lambda x: x.get("created_at", ""), reverse=True)
    
    return connections


@router.get("/connections/{connection_id}", summary="根据ID获取连接配置")
async def get_connection_by_id(
    connection_id: str,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: UserInDB = Depends(get_current_active_user)
) -> Dict[str, Any]:
    """
    根据ID获取连接配置，自动检测协议类型
    """
    try:
        connection = await find_connection_by_id(db, connection_id)
        if not connection:
            raise HTTPException(status_code=404, detail=f"连接配置未找到: {connection_id}")
        
        return connection.to_dict()
    except InvalidId:
        raise HTTPException(status_code=400, detail="无效的连接ID格式")


@router.get("/scenes/{scene_id}/instances/{instance_id}/bindings/{binding_id}/connection", summary="根据IoT绑定ID获取连接配置")
async def get_connection_by_binding_id(
    scene_id: str,
    instance_id: str,
    binding_id: str,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: UserInDB = Depends(get_current_active_user)
) -> Dict[str, Any]:
    """
    根据IoT绑定ID获取对应的连接配置
    
    首先根据bindingId找到IoT绑定记录，然后根据其中的sourceId获取连接配置
    """
    try:
        connection = await find_connection_by_binding_id(db, scene_id, instance_id, binding_id)
        if not connection:
            raise HTTPException(status_code=404, detail=f"IoT绑定或连接配置未找到: {binding_id}")
        
        return connection.to_dict()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取连接配置失败: {str(e)}")


@router.get("/connections/protocols/stats", summary="获取协议统计信息")
async def get_protocol_stats(
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: UserInDB = Depends(get_current_active_user)
) -> Dict[str, Any]:
    """
    获取各协议的连接统计信息
    """
    stats = {}
    
    # MQTT统计
    mqtt_total = await db.mqtt_connections.count_documents({})
    mqtt_enabled = await db.mqtt_connections.count_documents({"enabled": True})
    stats["mqtt"] = {
        "total": mqtt_total,
        "enabled": mqtt_enabled,
        "disabled": mqtt_total - mqtt_enabled
    }
    
    # HTTP统计
    http_total = await db.http_connections.count_documents({})
    http_enabled = await db.http_connections.count_documents({"enabled": True})
    stats["http"] = {
        "total": http_total,
        "enabled": http_enabled,
        "disabled": http_total - http_enabled
    }
    
    # WebSocket统计
    ws_total = await db.websocket_connections.count_documents({})
    ws_enabled = await db.websocket_connections.count_documents({"enabled": True})
    stats["websocket"] = {
        "total": ws_total,
        "enabled": ws_enabled,
        "disabled": ws_total - ws_enabled
    }
    
    # 总计
    total_connections = mqtt_total + http_total + ws_total
    total_enabled = mqtt_enabled + http_enabled + ws_enabled
    
    stats["total"] = {
        "connections": total_connections,
        "enabled": total_enabled,
        "disabled": total_connections - total_enabled
    }
    
    return stats


@router.get("/connections/tags", summary="获取所有连接标签")
async def get_all_tags(
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: UserInDB = Depends(get_current_active_user)
) -> List[str]:
    """
    获取所有连接配置中使用的标签
    """
    tags = set()
    
    # 从MQTT连接中获取标签
    mqtt_tags = await db.mqtt_connections.distinct("tags")
    tags.update(mqtt_tags)
    
    # 从HTTP连接中获取标签
    http_tags = await db.http_connections.distinct("tags")
    tags.update(http_tags)
    
    # 从WebSocket连接中获取标签
    ws_tags = await db.websocket_connections.distinct("tags")
    tags.update(ws_tags)
    
    return sorted(list(tags))


@router.post("/connections/{connection_id}/test", summary="测试连接")
async def test_connection(
    connection_id: str,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: UserInDB = Depends(get_current_active_user)
) -> Dict[str, Any]:
    """
    测试指定连接的连通性
    注意：这个接口只返回连接配置，实际的连接测试在前端进行
    """
    connection = await find_connection_by_id(db, connection_id)
    if not connection:
        raise HTTPException(status_code=404, detail=f"连接配置未找到: {connection_id}")
    
    # 返回连接配置供前端进行连接测试
    return {
        "connection_id": connection_id,
        "protocol": connection.protocol.value,
        "config": connection.config,
        "message": "连接配置已获取，请在前端进行连接测试"
    }