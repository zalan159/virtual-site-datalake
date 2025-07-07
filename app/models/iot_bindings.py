"""
IoT数据模型定义

包含升级后的IoT绑定数据类型和已弃用的旧模型。
"""

from typing import List, Dict, Any, Optional, Set, Literal
from pydantic import BaseModel, Field
import time
from datetime import datetime
from enum import Enum
from .user import PyObjectId

# ------------------------------------------------------------------------------
#  升级后的IoT数据类型定义
# ------------------------------------------------------------------------------

class IoTProtocolType(str, Enum):
    """IoT通信协议类型"""
    MQTT = "mqtt"
    WEBSOCKET = "websocket"
    HTTP = "http"

class IoTDataType(str, Enum):
    """IoT数据传输类型"""
    TEXT = "text"              # 纯文本
    JSON = "json"              # JSON字符串
    BINARY = "binary"          # 二进制数据（暂不支持绑定）
    IMAGE_BASE64 = "image_base64"  # Base64编码的图像
    IMAGE_RGBA = "image_rgba"      # RGBA矩阵格式的图像
    NUMBER = "number"          # 数值类型
    BOOLEAN = "boolean"        # 布尔类型

class BindingDirection(int, Enum):
    """绑定通信方向"""
    IOT_TO_INSTANCE = 0    # IoT -> Instance
    INSTANCE_TO_IOT = 1    # Instance -> IoT
    BIDIRECTIONAL = 2      # 双向通信

class InterpolationType(str, Enum):
    """插值类型"""
    NONE = "none"          # 无插值
    LINEAR = "linear"      # 线性插值
    SMOOTH = "smooth"      # 平滑插值（三次样条）
    STEP = "step"          # 阶梯插值

class TriggerType(str, Enum):
    """触发结果类型"""
    ANIMATION = "animation"        # 触发动画播放
    BINDING_ACTIVATION = "binding_activation"  # 激活/停用其他绑定
    SCRIPT = "script"              # 执行脚本
    STATE_CHANGE = "state_change"  # 状态切换
    EVENT = "event"                # 触发事件

# ------------------------------------------------------------------------------
#  数据处理配置模型
# ------------------------------------------------------------------------------

class ValueMapping(BaseModel):
    """数值映射配置"""
    inputMin: float = 0.0
    inputMax: float = 100.0
    outputMin: float = 0.0
    outputMax: float = 1.0
    clamp: bool = True  # 是否限制输出范围

class InterpolationConfig(BaseModel):
    """插值配置"""
    type: InterpolationType = InterpolationType.LINEAR
    duration: float = 1.0  # 插值持续时间（秒）
    easing: Optional[str] = None  # 缓动函数类型

class BindingCondition(BaseModel):
    """绑定触发条件"""
    field: str  # 监听的字段路径
    operator: Literal["eq", "ne", "gt", "lt", "gte", "lte", "in", "contains"]
    value: Any  # 比较值

class TriggerResult(BaseModel):
    """触发结果配置"""
    type: TriggerType
    target: Optional[str] = None  # 目标ID（动画ID、绑定ID、脚本ID等）
    params: Optional[Dict[str, Any]] = None  # 触发参数
    delay: Optional[float] = 0  # 延迟时间（秒）

class NodeBinding(BaseModel):
    """GLTF节点绑定配置"""
    nodeName: str  # GLTF节点名称（骨骼名称）
    nodeIndex: Optional[int] = None  # GLTF节点索引
    bindingType: Literal["translation", "rotation", "scale", "morph_weights"]
    axis: Optional[Literal["x", "y", "z", "all"]] = "all"  # 绑定轴

class HTTPConfig(BaseModel):
    """HTTP协议配置"""
    method: Literal["GET", "POST", "PUT", "DELETE"] = "GET"
    headers: Optional[Dict[str, str]] = None
    body: Optional[Dict[str, Any]] = None
    pollInterval: Optional[float] = None  # 轮询间隔（秒），None表示单次请求
    timeout: float = 30.0  # 请求超时时间

class IoTBinding(BaseModel):
    """IoT绑定配置"""
    # 基础信息
    id: str = Field(description="绑定唯一标识")
    name: Optional[str] = Field(default=None, description="绑定名称")
    enabled: bool = Field(default=True, description="是否启用")
    
    # IoT数据源
    protocol: IoTProtocolType = Field(description="通信协议类型")
    dataType: IoTDataType = Field(description="数据类型")
    sourceId: str = Field(description="IoT数据源ID（根据协议类型引用mqtt_sources、websocket_sources或http_sources集合中的文档ID）")
    
    # 绑定映射
    bindings: List[Dict[str, Any]] = Field(
        default=[],
        description="""绑定关系数组，格式：[{source: 'iot.path', target: 'instance.path', direction: 0}]
        
        source字段格式规则：
        - MQTT + JSON数据类型: '{订阅路径}.{json对象key层级}' (如: 'sensor/temperature.data.value')
        - MQTT + 其他数据类型: '{订阅路径}' (如: 'sensor/temperature')
        - WebSocket/HTTP + JSON数据类型: '{json对象key层级}' (如: 'data.value')
        - WebSocket/HTTP + 其他数据类型: 空字符串 (直接获取数据无需解析)
        """
    )
    
    # 节点绑定（用于骨骼动画）
    nodeBindings: Optional[List[NodeBinding]] = Field(
        default=None,
        description="GLTF节点/骨骼绑定配置"
    )
    
    # 数据处理
    valueMapping: Optional[ValueMapping] = Field(default=None, description="数值映射配置")
    interpolation: Optional[InterpolationConfig] = Field(default=None, description="插值配置")
    
    # 条件触发
    conditions: Optional[List[BindingCondition]] = Field(
        default=None,
        description="触发条件列表（AND关系）"
    )
    
    # 触发结果
    triggerResults: Optional[List[TriggerResult]] = Field(
        default=None,
        description="满足条件时的触发结果列表"
    )
    
    # HTTP配置（当protocol为HTTP时）
    httpConfig: Optional[HTTPConfig] = Field(
        default=None,
        description="HTTP协议特定配置"
    )
    
    # 高级配置
    updateInterval: Optional[float] = Field(
        default=None,
        description="更新间隔（毫秒），用于限制更新频率"
    )
    transform: Optional[str] = Field(
        default=None,
        description="数据转换脚本（JavaScript表达式）"
    )
    metadata: Optional[Dict[str, Any]] = Field(default={}, description="扩展元数据")

# ------------------------------------------------------------------------------
#  IoT绑定 API 模型
# ------------------------------------------------------------------------------

class IoTBindingWithInstance(IoTBinding):
    """包含实例信息的IoT绑定配置（用于API返回）"""
    instanceId: str = Field(description="绑定所属实例ID")
    instanceName: Optional[str] = Field(default=None, description="绑定所属实例名称")

class IoTBindingCreate(BaseModel):
    """创建IoT绑定请求模型"""
    name: Optional[str] = None
    enabled: bool = True
    protocol: IoTProtocolType
    dataType: IoTDataType
    sourceId: str
    bindings: List[Dict[str, Any]] = []
    nodeBindings: Optional[List[NodeBinding]] = None
    valueMapping: Optional[ValueMapping] = None
    interpolation: Optional[InterpolationConfig] = None
    conditions: Optional[List[BindingCondition]] = None
    triggerResults: Optional[List[TriggerResult]] = None
    httpConfig: Optional[HTTPConfig] = None
    updateInterval: Optional[float] = None
    transform: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None

class IoTBindingUpdate(BaseModel):
    """更新IoT绑定请求模型"""
    name: Optional[str] = None
    enabled: Optional[bool] = None
    protocol: Optional[IoTProtocolType] = None
    dataType: Optional[IoTDataType] = None
    sourceId: Optional[str] = None
    bindings: Optional[List[Dict[str, Any]]] = None
    nodeBindings: Optional[List[NodeBinding]] = None
    valueMapping: Optional[ValueMapping] = None
    interpolation: Optional[InterpolationConfig] = None
    conditions: Optional[List[BindingCondition]] = None
    triggerResults: Optional[List[TriggerResult]] = None
    httpConfig: Optional[HTTPConfig] = None
    updateInterval: Optional[float] = None
    transform: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None

class IoTBindingValidation(BaseModel):
    """IoT绑定验证请求模型"""
    binding: IoTBinding
    testData: Optional[Dict[str, Any]] = None  # 测试数据

class IoTBindingBatchCreate(BaseModel):
    """批量创建IoT绑定请求模型"""
    bindings: List[IoTBindingCreate]

class IoTBindingBatchUpdate(BaseModel):
    """批量更新IoT绑定请求模型"""
    updates: List[Dict[str, Any]]  # [{id: str, ...updates}]

# ------------------------------------------------------------------------------
#  DEPRECATED: 旧版本的IoT模型 (保留兼容性)
# ------------------------------------------------------------------------------

import warnings

class TopicSubscription(BaseModel):
    """DEPRECATED: 使用新的IoT绑定系统代替"""
    topic: str
    qos: int = 0

    def __init__(self, **data):
        warnings.warn(
            "TopicSubscription is deprecated. Use new IoT binding system instead.",
            DeprecationWarning,
            stacklevel=2
        )
        super().__init__(**data)

class UserTopicSubscription(BaseModel):
    """DEPRECATED: 用户与主题的订阅关系，使用新的IoT绑定系统代替"""
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

    def __init__(self, **data):
        warnings.warn(
            "UserTopicSubscription is deprecated. Use new IoT binding system instead.",
            DeprecationWarning,
            stacklevel=2
        )
        super().__init__(**data)

class BrokerConfig(BaseModel):
    """DEPRECATED: MQTT代理配置，使用新的IoT绑定系统代替"""
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

    def __init__(self, **data):
        warnings.warn(
            "BrokerConfig is deprecated. Use new IoT binding system instead.",
            DeprecationWarning,
            stacklevel=2
        )
        super().__init__(**data) 