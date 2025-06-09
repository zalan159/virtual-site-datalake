# GoView MQTT数据来源扩展开发计划

## 📋 项目概述

### 项目背景
当前GoView项目支持以下三种数据来源：
- **静态数据** (STATIC): 直接在配置中定义的固定数据
- **动态请求** (AJAX): 通过HTTP请求获取数据
- **数据池** (Pond): 使用公共接口池的数据

### 项目目标
在现有架构基础上，新增**MQTT订阅**数据来源，支持：
- 实时订阅MQTT主题获取数据
- 可配置MQTT连接参数（服务器、端口、用户名、密码等）
- 支持QoS设置和主题通配符
- 与现有组件系统无缝集成
- 支持数据过滤和转换

## 🏗️ 技术方案设计

### 架构设计
```
用户配置界面 → MQTT配置组件 → MQTT客户端管理器 → 数据分发 → 组件更新
     ↓              ↓                ↓            ↓          ↓
  config.vue → ChartDataMqtt → MqttClient → useChartDataFetch → 图表渲染
```

### 核心模块设计

#### 1. 枚举扩展
- 在 `RequestDataTypeEnum` 中添加 `MQTT = 3`
- 在 `SelectCreateDataEnum` 中添加 `MQTT = 'MQTT订阅'`

#### 2. MQTT客户端管理器
- 单例模式管理MQTT连接
- 支持多主题订阅
- 自动重连机制
- 连接状态监控

#### 3. 配置结构设计
```typescript
interface MqttConfigType {
  broker: {
    host: string        // MQTT服务器地址
    port: number        // 端口号
    protocol: 'mqtt' | 'mqtts' | 'ws' | 'wss'  // 协议类型
    username?: string   // 用户名
    password?: string   // 密码
    clientId?: string   // 客户端ID
  }
  subscription: {
    topic: string       // 订阅主题
    qos: 0 | 1 | 2     // QoS等级
  }
  options: {
    autoReconnect: boolean    // 自动重连
    reconnectInterval: number // 重连间隔(ms)
    keepalive: number        // 心跳间隔(s)
  }
}
```

## 📁 文件结构规划

### 新增文件
```
src/
├── enums/
│   ├── httpEnum.ts                    # 修改：添加MQTT枚举
│   └── mqttEnum.ts                    # 新增：MQTT相关枚举
├── api/
│   └── mqtt.ts                        # 新增：MQTT客户端管理
├── utils/
│   └── mqttClient.ts                  # 新增：MQTT客户端工具类
├── hooks/
│   ├── useChartDataFetch.hook.ts      # 修改：添加MQTT数据获取
│   └── useMqttConnection.hook.ts      # 新增：MQTT连接管理Hook
├── views/chart/ContentConfigurations/components/ChartData/
│   ├── index.vue                      # 修改：添加MQTT选项
│   ├── index.d.ts                     # 修改：添加MQTT类型定义
│   └── components/
│       └── ChartDataMqtt/
│           ├── index.vue              # 新增：MQTT配置界面
│           └── index.d.ts             # 新增：MQTT配置类型
├── store/modules/chartEditStore/
│   └── chartEditStore.d.ts            # 修改：添加MQTT配置类型
└── packages/public/
    └── publicConfig.ts                # 修改：添加MQTT默认配置
```

### 修改文件清单
- `src/enums/httpEnum.ts` - 添加MQTT数据类型枚举
- `src/hooks/useChartDataFetch.hook.ts` - 集成MQTT数据获取逻辑
- `src/views/chart/ContentConfigurations/components/ChartData/index.vue` - 添加MQTT选项
- `src/views/chart/ContentConfigurations/components/ChartData/index.d.ts` - 添加类型定义
- `src/store/modules/chartEditStore/chartEditStore.d.ts` - 扩展配置类型
- `src/packages/public/publicConfig.ts` - 添加默认MQTT配置
- `package.json` - 添加MQTT依赖

## 🚀 详细开发步骤

### 第一阶段：基础架构搭建
1. **安装依赖包**
   ```bash
   npm install mqtt @types/mqtt
   ```

2. **扩展枚举定义**
   - 在 `httpEnum.ts` 中添加 `MQTT = 3`
   - 创建 `mqttEnum.ts` 定义MQTT相关枚举

3. **创建基础类型定义**
   - 在相关 `.d.ts` 文件中添加MQTT配置接口
   - 扩展请求配置类型

### 第二阶段：MQTT客户端实现
1. **创建MQTT客户端管理器**
   - 实现连接管理、订阅管理、消息分发
   - 支持自动重连和错误处理
   - 实现单例模式避免重复连接

2. **创建MQTT连接Hook**
   - 封装连接状态管理
   - 提供连接、断开、订阅等方法
   - 处理连接生命周期

### 第三阶段：配置界面开发
1. **创建ChartDataMqtt组件**
   - MQTT服务器配置表单
   - 主题订阅配置
   - 连接状态显示
   - 实时数据预览

2. **集成到数据选择界面**
   - 在主配置界面添加MQTT选项
   - 条件渲染MQTT配置组件

### 第四阶段：数据获取集成
1. **扩展useChartDataFetch Hook**
   - 添加MQTT数据源处理逻辑
   - 实现消息到数据的转换
   - 处理数据过滤和映射

2. **数据流处理**
   - 实现MQTT消息解析
   - 支持JSON数据转换
   - 错误处理和数据验证

### 第五阶段：测试和优化
1. **功能测试**
   - 连接测试
   - 订阅测试
   - 数据更新测试
   - 错误场景测试

2. **性能优化**
   - 连接池优化
   - 内存泄漏检查
   - 重连策略优化

## 🎯 核心实现要点

### 1. MQTT客户端单例管理
```typescript
class MqttClientManager {
  private static instance: MqttClientManager
  private clients: Map<string, MqttClient> = new Map()
  
  static getInstance(): MqttClientManager {
    if (!this.instance) {
      this.instance = new MqttClientManager()
    }
    return this.instance
  }
  
  // 获取或创建连接
  getClient(config: MqttConfigType): Promise<MqttClient>
  
  // 订阅主题
  subscribe(clientId: string, topic: string, callback: Function)
  
  // 断开连接
  disconnect(clientId: string)
}
```

### 2. 数据获取集成
```typescript
// 在useChartDataFetch中添加MQTT处理
const mqttDataFetch = async () => {
  if (requestDataType.value === RequestDataTypeEnum.MQTT) {
    const mqttManager = MqttClientManager.getInstance()
    const client = await mqttManager.getClient(mqttConfig)
    
    mqttManager.subscribe(clientId, topic, (message) => {
      const parsedData = JSON.parse(message.toString())
      const filteredData = newFunctionHandle(parsedData, null, filter)
      updateCallback(filteredData)
    })
  }
}
```

### 3. 配置界面结构
```vue
<template>
  <div class="mqtt-config">
    <!-- 连接配置 -->
    <setting-item-box name="MQTT服务器配置">
      <setting-item name="服务器地址">
        <n-input v-model:value="config.broker.host" />
      </setting-item>
      <setting-item name="端口">
        <n-input-number v-model:value="config.broker.port" />
      </setting-item>
      <!-- 更多配置项... -->
    </setting-item-box>
    
    <!-- 订阅配置 -->
    <setting-item-box name="订阅配置">
      <setting-item name="主题">
        <n-input v-model:value="config.subscription.topic" />
      </setting-item>
      <setting-item name="QoS">
        <n-select v-model:value="config.subscription.qos" />
      </setting-item>
    </setting-item-box>
    
    <!-- 连接状态和测试 -->
    <setting-item-box name="连接状态">
      <n-button @click="testConnection">测试连接</n-button>
      <n-tag :type="connectionStatus">{{ statusText }}</n-tag>
    </setting-item-box>
  </div>
</template>
```

## ⚠️ 注意事项和风险点

### 1. 技术风险
- **浏览器MQTT限制**: 需要确保MQTT服务器支持WebSocket
- **连接管理复杂性**: 多组件订阅同一主题时的资源管理
- **内存泄漏**: 确保组件销毁时正确清理MQTT连接

### 2. 用户体验风险
- **连接失败处理**: 提供清晰的错误提示和重试机制
- **数据格式兼容**: 确保MQTT消息能正确解析为图表数据
- **性能影响**: 高频消息可能影响界面性能

### 3. 兼容性考虑
- **MQTT协议版本**: 默认支持MQTT 3.1.1，可选支持5.0
- **SSL/TLS**: 支持加密连接
- **认证方式**: 用户名密码、证书认证

## 🧪 测试计划

### 1. 单元测试
- MQTT客户端管理器测试
- 数据转换函数测试
- 配置验证测试

### 2. 集成测试
- 端到端连接测试
- 多组件订阅测试
- 错误恢复测试

### 3. 性能测试
- 大量消息处理测试
- 内存使用监控
- 连接稳定性测试

### 4. 兼容性测试
- 不同MQTT服务器测试
- 不同浏览器兼容性
- 移动端兼容性

## 📚 文档计划

### 1. 开发文档更新
- 在组件开发指南中添加MQTT数据源章节
- API文档更新
- 配置示例文档

### 2. 用户使用文档
- MQTT数据源使用指南
- 常见问题解答
- 最佳实践建议

## 🎉 预期成果

### 功能特性
- ✅ 支持MQTT实时数据订阅
- ✅ 完整的连接配置界面
- ✅ 自动重连和错误处理
- ✅ 与现有组件无缝集成
- ✅ 支持多种MQTT协议和认证方式

### 技术指标
- 连接建立时间 < 3秒
- 消息处理延迟 < 100ms
- 支持100+并发订阅
- 内存使用稳定，无泄漏

## 📅 开发时间表

| 阶段 | 任务 | 预计时间 | 依赖关系 |
|------|------|----------|----------|
| 1 | 基础架构搭建 | 1天 | 无 |
| 2 | MQTT客户端实现 | 2天 | 阶段1 |
| 3 | 配置界面开发 | 2天 | 阶段1,2 |
| 4 | 数据获取集成 | 1天 | 阶段2,3 |
| 5 | 测试和优化 | 2天 | 阶段4 |
| 6 | 文档编写 | 1天 | 阶段5 |

**总计预估时间：9个工作日**

---

## 总结

本开发计划详细规划了GoView项目中MQTT数据来源扩展功能的完整实现方案。通过模块化设计和渐进式开发，确保新功能与现有架构的良好集成，同时保持代码质量和用户体验。

关键成功因素：
1. 遵循现有架构设计原则
2. 确保连接稳定性和性能
3. 提供良好的用户配置体验
4. 完善的错误处理和文档 