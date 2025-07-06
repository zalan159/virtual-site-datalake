# WebSocket连接问题排错指南

## 常见错误代码及解决方案

### 🔴 错误代码 1006 - 连接异常关闭

**错误描述**: `WebSocket connection failed` 或 `连接异常关闭（代码1006）`

**可能原因及解决方案**:

#### 1. 网络和防火墙问题
- **现象**: 连接立即失败，无法建立连接
- **检查方法**: 
  ```bash
  # 检查端口是否可达
  telnet websocket-server.com 80
  # 或使用ping测试网络连通性
  ping websocket-server.com
  ```
- **解决方案**:
  - 检查公司/家庭防火墙设置
  - 如果使用代理服务器，确保支持WebSocket协议升级
  - 尝试不同的网络环境（如手机热点）

#### 2. SSL/TLS证书问题（针对wss://）
- **现象**: HTTPS页面连接WSS时失败
- **检查方法**: 在浏览器中直接访问WebSocket服务器的HTTPS页面
- **解决方案**:
  - 确保SSL证书有效且未过期
  - 检查证书链是否完整
  - 尝试使用HTTP页面连接WS（仅测试用）

#### 3. 服务器不可用
- **现象**: 特定服务器连接失败，其他服务器正常
- **检查方法**: 
  - 使用不同的WebSocket测试工具验证
  - 检查服务器状态页面
- **解决方案**:
  - 联系服务器管理员
  - 尝试备用服务器地址

#### 4. CORS跨域问题
- **现象**: 浏览器控制台显示CORS错误
- **解决方案**:
  - 确保WebSocket服务器配置了正确的CORS策略
  - 检查Origin头是否被服务器接受

## 🧪 测试服务器推荐

### 1. Postman Echo WebSocket (推荐)
```
URL: wss://ws.postman-echo.com/raw
优点: 稳定、支持SSL、官方维护
测试: 发送任何消息，服务器会回显
```

### 2. 本地测试服务器
```
URL: ws://localhost:8080
启动方法: 运行项目根目录下的 test/start-websocket-server.sh
优点: 完全可控、无网络依赖、支持调试
```

### 3. WebSocket.org Echo Server
```
URL: wss://echo.websocket.org
注意: 有时不稳定，建议作为备用
```

### 4. Heroku Echo Server
```
URL: wss://websocket-echo-server.herokuapp.com
注意: 免费服务，可能有延迟
```

## 🔧 调试工具和方法

### 1. 浏览器开发者工具
- 打开Network标签
- 筛选WS（WebSocket）连接
- 查看连接状态和消息传输

### 2. 在线WebSocket测试工具
- [WebSocket King](https://websocketking.com/)
- [Postman WebSocket](https://learning.postman.com/docs/sending-requests/websocket/)

### 3. 命令行测试工具
```bash
# 使用wscat（需要先安装: npm install -g wscat）
wscat -c wss://ws.postman-echo.com/raw

# 或使用websocat
websocat wss://ws.postman-echo.com/raw
```

## 📝 逐步排错流程

### 步骤1: 验证基本连通性
1. 使用ping测试服务器可达性
2. 检查防火墙和代理设置
3. 尝试不同的网络环境

### 步骤2: 测试WebSocket服务器
1. 使用推荐的测试服务器
2. 尝试多个不同的服务器
3. 检查服务器状态和文档

### 步骤3: 检查证书和安全设置
1. 验证SSL证书有效性
2. 检查浏览器安全策略
3. 尝试HTTP页面连接WS（仅测试）

### 步骤4: 分析错误信息
1. 查看浏览器控制台详细错误
2. 检查网络请求失败原因
3. 对比不同浏览器的表现

### 步骤5: 配置调整
1. 调整连接超时时间
2. 修改重试策略
3. 检查认证配置

## 🚀 本地测试服务器使用

### 快速启动
```bash
# Linux/macOS
cd test
./start-websocket-server.sh

# Windows
cd test
start-websocket-server.bat

# 手动启动
cd test
npm install
npm start
```

### 测试配置
- **URL**: `ws://localhost:8080`
- **认证**: 无需认证
- **功能**: Echo服务器，会回复所有消息
- **心跳**: 每30秒发送一次服务器心跳

### 服务器特性
- 支持JSON和纯文本消息
- 自动处理ping/pong心跳
- 模拟500ms延迟回复
- 详细的连接日志

## 📱 移动端注意事项

### iOS Safari
- 可能需要用户手势触发WebSocket连接
- 后台运行时连接会被系统暂停

### Android Chrome
- 网络切换时可能需要重新连接
- 省电模式可能影响连接稳定性

## 🔒 安全考虑

### 生产环境
- 始终使用WSS（加密连接）
- 实施适当的认证机制
- 限制连接频率和消息大小

### 开发环境
- 可以使用WS（非加密）进行本地测试
- 注意不要在生产代码中硬编码测试服务器地址

## 📞 获取帮助

### 1. 检查项目文档
- `web/src/docs/websocket-usage.md` - 使用指南
- `web/src/hooks/useWebSocketConnection.ts` - Hook源码

### 2. 常见问题
- 确保WebSocket URL格式正确（ws://或wss://）
- 检查认证信息是否正确
- 验证网络环境是否支持WebSocket

### 3. 提交问题时请包含
- 完整的错误信息
- 使用的WebSocket URL
- 浏览器和操作系统版本
- 网络环境描述（公司网络/家庭网络等） 