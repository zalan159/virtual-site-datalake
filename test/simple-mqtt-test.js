#!/usr/bin/env node

const mqtt = require('mqtt');

const config = {
  broker: 'ws://broker.emqx.io:8083/mqtt',
  topic: 'sensors/teach/x',
  clientId: `simple_test_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`
};

console.log(`🔌 连接到: ${config.broker}`);
console.log(`📋 客户端ID: ${config.clientId}`);
console.log(`👂 监听主题: ${config.topic}`);
console.log('');

const client = mqtt.connect(config.broker, {
  clientId: config.clientId,
  keepalive: 60,
  clean: true,
  connectTimeout: 10000,
  reconnectPeriod: 1000
});

let messageCount = 0;
let lastMessageTime = null;

client.on('connect', () => {
  console.log(`✅ 连接成功: ${new Date().toISOString()}`);
  
  client.subscribe(config.topic, { qos: 0 }, (err, granted) => {
    if (err) {
      console.log(`❌ 订阅失败: ${err.message}`);
      process.exit(1);
    } else {
      console.log(`✅ 订阅成功: ${config.topic}`);
      console.log(`📋 授权信息:`, granted);
      console.log('');
      console.log(`👂 等待消息... (按 Ctrl+C 退出)`);
      console.log('');
    }
  });
});

client.on('message', (topic, payload) => {
  const now = Date.now();
  messageCount++;
  
  const interval = lastMessageTime ? (now - lastMessageTime) : 0;
  lastMessageTime = now;
  
  console.log(`📨 [${messageCount}] 收到消息:`);
  console.log(`  ⏰ 时间: ${new Date(now).toISOString()}`);
  console.log(`  📍 主题: ${topic}`);
  console.log(`  ⏱️  间隔: ${interval}ms`);
  console.log(`  📏 大小: ${payload.length} 字节`);
  console.log(`  📄 内容: ${payload.toString().substring(0, 150)}${payload.length > 150 ? '...' : ''}`);
  console.log('');
});

client.on('error', (error) => {
  console.log(`❌ 连接错误: ${error.message}`);
  process.exit(1);
});

client.on('close', () => {
  console.log(`🔌 连接已关闭`);
});

client.on('offline', () => {
  console.log(`📴 客户端离线`);
});

client.on('reconnect', () => {
  console.log(`🔄 正在重连...`);
});

// 优雅退出
process.on('SIGINT', () => {
  console.log(`\n🛑 正在退出...`);
  console.log(`📊 总共接收 ${messageCount} 条消息`);
  if (client) {
    client.end();
  }
  process.exit(0);
});