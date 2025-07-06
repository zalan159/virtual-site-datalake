# WebSocket数据源管理 - 前端直连功能

## 概述

WebSocket数据源管理现已升级为前端直连模式，参考stream视频流模块的设计理念，实现了浏览器端直接建立WebSocket连接进行实时通信。

## 主要特性

### 🔄 前端直连
- 后端仅存储WebSocket配置信息（URL、认证等）
- 前端直接在浏览器中建立WebSocket连接
- 无需后端代理，减少延迟和资源消耗

### 💬 实时对话
- 类似聊天应用的对话界面
- 支持发送和接收实时消息
- 消息类型自动识别（JSON/纯文本）
- 系统消息与用户消息区分显示

### 🔗 连接管理
- 可视化连接状态显示
- 自动重连机制
- 连接超时和错误处理
- 心跳保持连接

### 🔐 认证支持
- 无认证模式
- 基础认证（用户名/密码）
- Token认证
- 支持认证信息URL参数传递

## 使用方法

### 1. 创建WebSocket数据源

1. 点击"添加WebSocket"按钮
2. 填写基本信息：
   - 名称：WebSocket连接的标识名称
   - URL：WebSocket服务器地址（ws://或wss://）
   - 描述：可选的详细说明
   - 标签：用于分类和搜索

3. 配置认证（可选）：
   - 认证类型：选择无认证、基础认证或Token认证
   - 认证信息：根据类型填写相应的认证凭据

4. 连接配置：
   - 连接超时：连接建立的最大等待时间
   - Ping间隔：心跳检测间隔
   - 最大重试：连接失败时的重试次数
   - 重试延迟：重试间隔时间

### 2. 开始对话

1. 在数据源列表中找到目标WebSocket
2. 点击"对话"按钮打开对话界面
3. 点击"连接"按钮建立WebSocket连接
4. 连接成功后可在输入框中发送消息

### 3. 对话界面功能

- **连接状态指示器**：显示当前连接状态（未连接/连接中/已连接/连接失败）
- **连接控制**：连接/断开连接按钮
- **消息列表**：实时显示发送和接收的消息
- **消息输入**：支持多行文本输入，Enter发送，Shift+Enter换行
- **清空消息**：清除当前对话历史

## 技术实现

### useWebSocketConnection Hook

核心WebSocket连接逻辑封装在自定义Hook中：

```typescript
const {
  connect,           // 连接函数
  disconnect,        // 断开连接函数
  sendMessage,       // 发送消息函数
  isConnected,       // 连接状态
  isConnecting,      // 连接进行中状态
  messages,          // 消息列表
  clearMessages,     // 清空消息函数
  error,            // 错误信息
  connectionAttempts // 连接尝试次数
} = useWebSocketConnection(options);
```

### 消息格式

#### 发送消息
- 原始文本直接发送
- 自动添加到消息历史

#### 接收消息
- 自动尝试JSON解析
- 解析成功显示message/content/data字段
- 解析失败显示原始文本
- 忽略pong心跳响应

#### 系统消息
- 连接建立/断开通知
- 错误信息显示
- 以斜体样式区分

### 自动重连机制

- 连接意外断开时自动重试
- 重试次数可配置（默认3次）
- 重试延迟可配置（默认5秒）
- 超过最大重试次数后停止

### 心跳保持

- 定时发送ping消息保持连接
- 心跳间隔可配置（默认30秒）
- 自动忽略pong响应消息

## 对比原有功能

### 原有方式
- 后端代理WebSocket连接
- 通过API发送消息
- 消息历史存储在数据库
- 需要轮询获取新消息

### 新的方式
- 前端直接连接WebSocket
- 浏览器内实时收发消息
- 消息历史仅在当前会话
- 真正的实时通信体验

## 注意事项

1. **浏览器兼容性**：需要支持WebSocket的现代浏览器
2. **CORS跨域**：确保WebSocket服务器支持跨域连接
3. **SSL证书**：HTTPS页面只能连接WSS加密连接
4. **防火墙**：确保WebSocket端口未被防火墙阻挡
5. **消息大小**：避免发送过大的消息导致连接问题

## 示例WebSocket服务器

### 简单Echo服务器
```javascript
const WebSocket = require('ws');
const wss = new WebSocket.Server({ port: 8080 });

wss.on('connection', function connection(ws) {
  ws.on('message', function incoming(message) {
    console.log('received: %s', message);
    ws.send(message); // Echo回消息
  });
  
  ws.send('连接已建立');
});
```

### 测试连接
```
WebSocket URL: ws://localhost:8080
认证类型: 无认证
```

## 排错指南

### 连接失败
1. 检查URL格式是否正确
2. 确认WebSocket服务器运行状态
3. 检查网络连接和防火墙设置
4. 验证认证信息是否正确

### 消息发送失败
1. 确认WebSocket连接状态
2. 检查消息格式和大小
3. 查看浏览器控制台错误信息

### 自动重连不工作
1. 检查重试配置参数
2. 确认错误类型是否支持重连
3. 查看连接尝试次数是否超限 