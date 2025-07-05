# IoT绑定功能升级计划

## 1. 现状调查

### 1.1 当前实现分析

#### 数据模型层面
- **Instance类IoT绑定**：仅存储MongoDB文档ID数组，缺乏绑定配置信息
- **绑定类型**：支持iot_binds、video_binds、file_binds三种类型
- **数据结构**：简单的字符串数组，无法表达复杂的绑定关系

#### 后端架构
- **MQTT Gateway**：完整的MQTT消息接收、Redis流处理、MongoDB持久化架构
- **WebSocket支持**：已实现WebSocket数据源的CRUD管理
- **数据流**：IoT数据 → Redis Streams → MongoDB → 前端查询

#### 前端实现
- **动画服务**：支持IoT数据到GLB模型骨骼节点的映射
- **实时更新**：通过WebSocket连接实现数据推送
- **局限性**：
  - 仅支持骨骼变换（平移、旋转、缩放）
  - 绑定配置存储在前端，未持久化到数据库
  - 不支持材质属性绑定

### 1.2 问题分析

1. **数据模型不足**
   - 无法记录IoT数据路径与Instance属性的映射关系
   - 缺少数值转换、插值等配置
   - 不支持双向通信配置
   - 无法表达条件触发逻辑

2. **功能局限**
   - 仅支持简单的数据引用，不支持复杂的数据处理
   - 材质绑定功能缺失
   - 批量绑定管理困难
   - 性能优化手段有限

3. **架构问题**
   - 前后端绑定配置不同步
   - 缺少统一的绑定配置验证
   - 实时数据处理逻辑分散

## 2. 升级方案设计

### 2.1 核心设计理念

1. **标准化**：遵循GLTF 2.0材质标准，确保3D资产兼容性
2. **灵活性**：支持多种数据类型、协议和绑定模式
3. **性能优化**：提供更新频率控制、批量处理等优化手段
4. **可扩展性**：预留扩展接口，支持未来功能增强

### 2.2 数据模型升级

#### IoTBinding配置结构
```python
class IoTBinding(BaseModel):
    # 基础信息
    id: str                          # 绑定唯一标识
    name: Optional[str]              # 绑定名称
    enabled: bool = True             # 是否启用
    
    # IoT数据源
    protocol: IoTProtocolType        # mqtt/websocket
    dataType: IoTDataType           # text/json/binary/image_base64/image_rgba/number/boolean
    sourceId: str                   # MongoDB文档ID
    
    # 绑定映射（支持多个映射关系）
    bindings: List[Dict[str, Any]]  # [{source: 'iot.path', target: 'instance.path', direction: 0}]
    
    # 数据处理
    valueMapping: Optional[ValueMapping]          # 数值映射配置
    interpolation: Optional[InterpolationConfig]  # 插值配置
    
    # 条件触发
    conditions: Optional[List[BindingCondition]]  # 触发条件列表
    
    # 高级配置
    updateInterval: Optional[float]              # 更新间隔限制
    transform: Optional[str]                     # JS表达式转换
    metadata: Dict[str, Any] = {}               # 扩展元数据
```

#### 绑定映射详解

1. **JSON数据绑定**
   ```json
   {
     "source": "temperature.value",
     "target": "properties.temperature",
     "direction": 0
   }
   ```

2. **材质属性绑定**
   ```json
   {
     "source": "color.rgb",
     "target": "materials[0].pbrMetallicRoughness.baseColorFactor",
     "direction": 0,
     "transform": "value.map(v => v/255)"
   }
   ```

3. **图像纹理绑定**
   ```json
   {
     "source": "thermal_image",
     "target": "materials[0].emissiveTexture",
     "direction": 0,
     "dataType": "image_base64"
   }
   ```

4. **双向通信绑定**
   ```json
   {
     "source": "control.power",
     "target": "properties.power_state",
     "direction": 2,
     "conditions": [{
       "field": "properties.manual_mode",
       "operator": "eq",
       "value": true
     }]
   }
   ```

### 2.3 材质系统升级

#### GLTF 2.0标准材质支持
```python
class GLTFMaterial(BaseModel):
    name: Optional[str]
    pbrMetallicRoughness: Optional[GLTFMaterialPBR]
    normalTexture: Optional[Dict[str, Any]]
    occlusionTexture: Optional[Dict[str, Any]]
    emissiveTexture: Optional[Dict[str, Any]]
    emissiveFactor: Optional[List[float]]
    alphaMode: Optional[Literal["OPAQUE", "MASK", "BLEND"]]
    alphaCutoff: Optional[float]
    doubleSided: Optional[bool]
```

支持的材质属性绑定：
- baseColorFactor：基础颜色
- metallicFactor：金属度
- roughnessFactor：粗糙度
- emissiveFactor：自发光颜色
- 各类纹理贴图的动态替换

### 2.4 功能扩展

#### 2.4.1 数据类型支持
- **文本数据**：自动匹配properties中的字符串属性
- **JSON数据**：支持嵌套路径访问（如`sensor.temperature.value`）
- **数值数据**：支持数值映射和插值
- **布尔数据**：用于状态切换和条件触发
- **图像数据**：
  - Base64编码：适用于小图像传输
  - RGBA矩阵：适用于实时图像处理
  - 自动转换为WebGL纹理

#### 2.4.2 插值系统
- **线性插值**：平滑的数值过渡
- **平滑插值**：使用三次样条曲线
- **阶梯插值**：离散值切换
- **自定义缓动**：支持常见缓动函数

#### 2.4.3 条件触发
- 支持多条件组合（AND逻辑）
- 条件运算符：eq、ne、gt、lt、gte、lte、in、contains
- 支持嵌套属性路径比较

#### 2.4.4 性能优化
- **更新频率限制**：通过updateInterval控制
- **批量更新**：合并多个绑定的更新操作
- **智能缓存**：避免重复计算和渲染
- **按需订阅**：仅订阅活跃场景的IoT数据

### 2.5 API设计

#### 绑定管理API
```
POST   /api/scenes/{scene_id}/instances/{instance_id}/iot-bindings
GET    /api/scenes/{scene_id}/instances/{instance_id}/iot-bindings
PUT    /api/scenes/{scene_id}/instances/{instance_id}/iot-bindings/{binding_id}
DELETE /api/scenes/{scene_id}/instances/{instance_id}/iot-bindings/{binding_id}
POST   /api/scenes/{scene_id}/instances/{instance_id}/iot-bindings/batch
```

#### 绑定验证API
```
POST   /api/iot-bindings/validate
POST   /api/iot-bindings/test
```

#### 实时数据API
```
GET    /api/iot-bindings/{binding_id}/data/realtime
GET    /api/iot-bindings/{binding_id}/data/history
POST   /api/iot-bindings/{binding_id}/command
```

## 3. 实施计划

### 3.1 第一阶段：基础架构升级（2周）
- [x] 定义IoTBinding数据模型
- [x] 实现GLTF 2.0材质模型
- [ ] 升级Instance类的iot_binds字段
- [ ] 创建绑定配置验证器
- [ ] 实现基础CRUD API

### 3.2 第二阶段：核心功能实现（3周）
- [ ] 实现JSON路径解析和映射
- [ ] 开发数值映射和插值系统
- [ ] 实现条件触发机制
- [ ] 集成材质属性绑定
- [ ] 优化实时数据处理流程

### 3.3 第三阶段：高级特性（2周）
- [ ] 实现图像数据绑定
- [ ] 开发双向通信功能
- [ ] 添加JavaScript表达式支持
- [ ] 实现批量绑定管理
- [ ] 性能优化和缓存机制

### 3.4 第四阶段：前端集成（2周）
- [ ] 升级前端TypeScript接口
- [ ] 更新绑定配置UI
- [ ] 集成材质编辑器
- [ ] 优化实时数据展示
- [ ] 添加绑定调试工具

### 3.5 第五阶段：测试和文档（1周）
- [ ] 编写单元测试
- [ ] 性能测试和优化
- [ ] 编写API文档
- [ ] 创建使用示例
- [ ] 部署和监控

## 4. 技术考虑

### 4.1 数据存储
- Neo4j的JSONProperty存储限制需要考虑
- 复杂绑定配置可能需要压缩存储
- 考虑将部分配置存储到MongoDB

### 4.2 性能优化
- Redis缓存绑定配置和计算结果
- 使用WebWorker处理复杂计算
- 批量更新减少渲染次数
- 智能订阅减少网络流量

### 4.3 安全性
- JavaScript表达式执行的沙箱环境
- 双向通信的权限控制
- 敏感数据的加密传输
- 防止恶意绑定配置

### 4.4 兼容性
- 保持向后兼容，支持旧版简单绑定
- 提供迁移工具
- 渐进式功能启用

## 5. 风险和挑战

### 5.1 技术风险
- Neo4j存储复杂JSON的性能问题
- 实时数据处理的延迟控制
- 前端渲染性能瓶颈
- WebSocket连接稳定性

### 5.2 业务风险
- 功能复杂度增加导致易用性下降
- 新旧系统迁移的数据一致性
- 第三方IoT设备的兼容性问题

### 5.3 缓解措施
- 充分的性能测试和优化
- 提供简单和高级两种配置模式
- 完善的错误处理和降级方案
- 详细的文档和培训

## 6. 预期成果

### 6.1 功能提升
- 支持复杂的IoT数据绑定场景
- 实现材质和纹理的动态更新
- 提供灵活的数据处理能力
- 支持双向通信和控制

### 6.2 性能改进
- 更高效的数据更新机制
- 智能的资源管理
- 可配置的性能优化选项

### 6.3 用户体验
- 直观的绑定配置界面
- 实时的绑定效果预览
- 完善的调试和监控工具
- 丰富的使用示例

## 7. 总结

本次IoT绑定功能升级将大幅提升灵境孪生中台的数字孪生能力，使其能够支持更复杂、更真实的工业场景应用。通过标准化的数据模型、灵活的绑定配置和高效的处理机制，为用户提供强大而易用的IoT集成方案。

升级完成后，平台将能够：
1. 支持任意IoT数据到3D模型属性的映射
2. 实现材质、纹理的实时动态更新
3. 提供双向通信能力，实现真正的数字孪生交互
4. 通过插值、条件触发等机制提供流畅的视觉体验
5. 为复杂的工业应用场景提供完整的解决方案