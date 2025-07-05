const WebSocket = require('ws');
const http = require('http');

// 创建HTTP服务器
const server = http.createServer();

// 创建WebSocket服务器
const wss = new WebSocket.Server({ 
  server,
  // 允许跨域
  perMessageDeflate: false 
});

console.log('🚀 WebSocket测试服务器启动...');

// 处理WebSocket连接
wss.on('connection', function connection(ws, request) {
  const clientIP = request.socket.remoteAddress;
  console.log(`📱 新客户端连接: ${clientIP}`);
  
  // 发送欢迎消息
  ws.send(JSON.stringify({
    type: 'welcome',
    message: '欢迎连接到WebSocket测试服务器！',
    timestamp: new Date().toISOString(),
    server: 'VirtualSite Test Server'
  }));

  // 监听客户端消息
  ws.on('message', function incoming(message) {
    try {
      const data = message.toString();
      console.log(`📩 收到消息: ${data}`);
      
      // 尝试解析JSON
      let response;
      try {
        const parsed = JSON.parse(data);
        
        // 处理ping消息
        if (parsed.type === 'ping') {
          response = JSON.stringify({
            type: 'pong',
            timestamp: new Date().toISOString()
          });
        } else {
          // Echo消息
          response = JSON.stringify({
            type: 'echo',
            original: parsed,
            message: `服务器回复: ${parsed.message || parsed.content || '收到消息'}`,
            timestamp: new Date().toISOString()
          });
        }
      } catch (e) {
        // 处理纯文本消息
        response = JSON.stringify({
          type: 'echo',
          message: `服务器回复: ${data}`,
          timestamp: new Date().toISOString()
        });
      }
      
      // 延迟500ms回复，模拟真实场景
      setTimeout(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(response);
        }
      }, 500);
      
    } catch (error) {
      console.error('❌ 处理消息错误:', error);
      ws.send(JSON.stringify({
        type: 'error',
        message: '服务器处理消息时发生错误',
        timestamp: new Date().toISOString()
      }));
    }
  });

  // 监听连接关闭
  ws.on('close', function close(code, reason) {
    console.log(`📴 客户端断开连接: ${clientIP}, 代码: ${code}, 原因: ${reason}`);
  });

  // 监听错误
  ws.on('error', function error(err) {
    console.error('❌ WebSocket错误:', err);
  });

  // 定期发送心跳消息（可选）
  const heartbeat = setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'heartbeat',
        message: '服务器心跳',
        timestamp: new Date().toISOString()
      }));
    } else {
      clearInterval(heartbeat);
    }
  }, 30000); // 30秒心跳

  // 清理心跳定时器
  ws.on('close', () => {
    clearInterval(heartbeat);
  });
});

// 处理服务器错误
wss.on('error', function error(err) {
  console.error('❌ WebSocket服务器错误:', err);
});

// 启动服务器
const PORT = process.env.PORT || 8080;
server.listen(PORT, function listening() {
  console.log(`✅ WebSocket服务器运行在: ws://localhost:${PORT}`);
  console.log('📝 可用的测试URL:');
  console.log(`   ws://localhost:${PORT}`);
  console.log(`   ws://127.0.0.1:${PORT}`);
  console.log('');
  console.log('🔧 测试说明:');
  console.log('   - 服务器会回复所有收到的消息');
  console.log('   - 支持JSON和纯文本消息');
  console.log('   - 每30秒发送一次心跳消息');
  console.log('   - 使用Ctrl+C停止服务器');
  console.log('');
});

// 优雅关闭
process.on('SIGINT', function() {
  console.log('\n🛑 正在关闭WebSocket服务器...');
  wss.close(function() {
    console.log('✅ 服务器已关闭');
    process.exit(0);
  });
}); 