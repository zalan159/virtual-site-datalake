# 灵境中台骨骼动画系统使用指南

## 概述

灵境中台的骨骼动画系统支持GLB格式模型的动画播放、骨骼节点控制，以及IoT数据驱动的实时动画。该系统设计用于数字孪生场景中的设备状态可视化和实时数据展示。

## 功能特性

### 1. 动画播放控制
- 支持GLB文件中的预设动画序列播放
- 提供播放/暂停/停止/时间轴控制
- 支持循环播放、播放速度调节
- 可视化的时间轴和进度显示

### 2. 骨骼节点查看
- 树状展示GLB模型的骨骼结构
- 实时显示每个节点的Transform数据
- 支持节点搜索和层级展开/折叠
- 节点选择和详情查看

### 3. IoT数据绑定
- 将MQTT等IoT数据映射到骨骼节点变换
- 支持数值范围映射和插值
- 实时响应外部数据变化
- 可配置的触发方式和播放模式

## 使用方法

### 基础动画播放

1. **选择模型**
   - 在场景中点击选择包含动画的GLB模型
   - 选中后动画页签会显示该模型的动画信息

2. **播放动画**
   - 切换到"动画"页签
   - 在"动作序列"子页签中选择要播放的动画
   - 点击播放按钮开始播放
   - 可以调节播放速度、启用循环播放

3. **时间轴控制**
   - 拖拽时间轴快进/快退到指定时间点
   - 使用快进/快退按钮精确控制

### IoT数据驱动动画

1. **配置触发方式**
   ```typescript
   // 在"设置"子页签中选择"IoT事件"触发方式
   ```

2. **添加数据绑定**
   - 选择目标骨骼节点
   - 输入IoT数据路径（如：`mqtt.sensor.temperature`）
   - 选择绑定类型（平移/旋转/缩放）
   - 配置数值映射范围
   - 设置插值参数

3. **测试绑定**
   - 点击"模拟数据"按钮生成测试数据
   - 观察模型实时响应数据变化

### 编程接口使用

```typescript
import { animationEventService } from '@/services/animationEventService';
import { iotAnimationService } from '@/services/iotAnimationService';

// 发送播放事件
const playEvent = animationEventService.createPlayEvent(
  'model_123',           // 模型ID
  'animation_0',         // 动画序列ID
  'loop',               // 播放模式
  1.5                   // 播放速度
);
animationEventService.sendEvent(playEvent);

// 更新IoT数据
iotAnimationService.updateIoTData('mqtt.sensor.temperature', 25.6);

// 直接控制节点变换
const transformEvent = animationEventService.createNodeTransformEvent(
  'model_123',
  'BoneNode_001',
  {
    rotation: [0, 0, 0.5, 0.866] // 30度Z轴旋转的四元数
  },
  {
    enabled: true,
    duration: 1000,
    easing: 'ease-in-out'
  }
);
animationEventService.sendEvent(transformEvent);
```

### JSON事件格式

系统支持标准化的JSON事件格式，可用于外部系统集成：

```json
{
  "type": "play",
  "modelId": "model_123",
  "clipId": "animation_0",
  "playMode": "loop",
  "timestamp": 1623456789000
}

{
  "type": "node_transform",
  "modelId": "model_123",
  "nodeId": "BoneNode_001",
  "transform": {
    "translation": [1.0, 0.0, 0.0],
    "rotation": [0, 0, 0.5, 0.866],
    "scale": [1.2, 1.2, 1.2]
  },
  "interpolation": {
    "enabled": true,
    "duration": 2000,
    "easing": "ease-in-out"
  },
  "timestamp": 1623456789000
}
```

## 实际应用场景

### 1. 工业设备监控
- 将设备转速数据绑定到旋转动画
- 用温度数据控制散热器开合角度
- 压力数据驱动活塞运动

### 2. 建筑环境展示
- 风速数据控制风力发电机转动
- 光照强度影响太阳能板角度
- 人流量数据控制电梯运行动画

### 3. 车辆状态可视化
- 发动机转速驱动内部部件动画
- 车门开关状态控制门板动画
- 燃油消耗影响仪表指针位置

## 注意事项

1. **性能考虑**
   - 避免过于频繁的IoT数据更新（建议间隔≥100ms）
   - 使用插值减少突兀的变化
   - 合理设置数值映射范围

2. **数据格式**
   - IoT数据路径使用点分格式（如：`mqtt.device.sensor.value`）
   - 四元数旋转格式为 [x, y, z, w]
   - 所有数值单位保持一致

3. **兼容性**
   - 确保GLB模型包含正确的骨骼结构
   - 验证动画数据的完整性
   - 测试不同浏览器的WebGL支持

## 调试和故障排除

1. **动画不播放**
   - 检查GLB文件是否包含动画数据
   - 确认模型已正确加载到场景中
   - 查看浏览器控制台错误信息

2. **IoT绑定无效**
   - 验证数据路径格式正确
   - 检查数值映射范围设置
   - 确认目标节点存在于模型中

3. **性能问题**
   - 减少同时播放的动画数量
   - 优化GLB模型的骨骼复杂度
   - 调整动画更新频率

## 扩展开发

系统采用模块化设计，支持扩展：

- 添加新的数据源类型
- 自定义插值算法
- 扩展事件类型
- 集成外部动画引擎