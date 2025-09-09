#!/usr/bin/env node

/**
 * 纯监听器 - 用于检测MQTT消息频率
 * 不发布任何消息，只监听指定主题
 */

const mqtt = require('mqtt');

const config = {
  broker: 'ws://broker.emqx.io:8083/mqtt',
  topics: ['sensors/react_test_dedicated_new', 'sensors/teach/x'],
  clientId: `pure_listener_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
};

console.log(`👂 MQTT消息频率监听器`);
console.log(`📍 Broker: ${config.broker}`);
console.log(`📍 客户端: ${config.clientId}`);
console.log(`📍 监听主题: ${config.topics.join(', ')}`);
console.log('');

const client = mqtt.connect(config.broker, {
  clientId: config.clientId,
  keepalive: 60,
  clean: true,
  connectTimeout: 10000
});

const messageStats = new Map();

client.on('connect', () => {
  console.log(`✅ 连接成功: ${new Date().toISOString()}`);
  
  // 订阅所有主题
  config.topics.forEach(topic => {
    client.subscribe(topic, { qos: 0 }, (err, granted) => {
      if (err) {
        console.log(`❌ 订阅失败: ${topic} - ${err.message}`);
      } else {
        console.log(`✅ 订阅成功: ${topic}`);
        messageStats.set(topic, {
          count: 0,
          lastTime: null,
          intervals: []
        });
      }
    });
  });
  
  console.log('');
  console.log(`🔍 开始监听消息频率...`);
  console.log('');
});

client.on('message', (topic, payload) => {
  const now = Date.now();
  const stats = messageStats.get(topic);
  
  if (stats) {
    stats.count++;
    
    if (stats.lastTime) {
      const interval = now - stats.lastTime;
      stats.intervals.push(interval);
      
      // 只保留最近10个间隔
      if (stats.intervals.length > 10) {
        stats.intervals.shift();
      }
      
      const avgInterval = stats.intervals.reduce((a, b) => a + b, 0) / stats.intervals.length;
      const frequency = 1000 / avgInterval;
      
      console.log(`📨 [${stats.count}] ${topic}`);
      console.log(`  ⏰ 时间: ${new Date(now).toISOString()}`);
      console.log(`  ⏱️  间隔: ${interval}ms`);
      console.log(`  📊 平均间隔: ${avgInterval.toFixed(0)}ms (${frequency.toFixed(2)} Hz)`);
      console.log(`  📏 大小: ${payload.length} 字节`);
      console.log('');
    } else {
      console.log(`📨 [${stats.count}] ${topic} - 首条消息`);
      console.log(`  ⏰ 时间: ${new Date(now).toISOString()}`);
      console.log(`  📏 大小: ${payload.length} 字节`);
      console.log('');
    }
    
    stats.lastTime = now;
  }
});

client.on('error', (error) => {
  console.log(`❌ 连接错误: ${error.message}`);
});

// 定期打印统计信息
setInterval(() => {
  console.log(`📊 === 统计信息 ===`);
  for (const [topic, stats] of messageStats) {
    const avgInterval = stats.intervals.length > 0 
      ? stats.intervals.reduce((a, b) => a + b, 0) / stats.intervals.length
      : 0;
    const frequency = avgInterval > 0 ? 1000 / avgInterval : 0;
    
    console.log(`  📍 ${topic}:`);
    console.log(`    总消息数: ${stats.count}`);
    console.log(`    平均间隔: ${avgInterval.toFixed(0)}ms`);
    console.log(`    平均频率: ${frequency.toFixed(2)} Hz`);
    console.log(`    最近间隔: [${stats.intervals.slice(-3).join(', ')}]ms`);
  }
  console.log('');
}, 30000); // 每30秒打印一次

// 优雅退出
process.on('SIGINT', () => {
  console.log(`\n📊 === 最终统计 ===`);
  for (const [topic, stats] of messageStats) {
    console.log(`  📍 ${topic}: ${stats.count} 条消息`);
  }
  client.end();
  process.exit(0);
});