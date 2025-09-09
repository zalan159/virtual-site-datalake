#!/usr/bin/env node

/**
 * 专用MQTT发布器 - 使用独立的主题避免与其他客户端冲突
 */

const mqtt = require('mqtt');

const config = {
  broker: 'ws://broker.emqx.io:8083/mqtt',
  // 使用专用主题避免冲突
  topic: 'sensors/react_test_dedicated_new',
  clientId: `dedicated_pub_${Date.now()}`,
  publishInterval: 1000,
  testDuration: 120000 // 2分钟测试
};

console.log(`🚀 专用MQTT发布器`);
console.log(`📍 Broker: ${config.broker}`);
console.log(`📍 主题: ${config.topic}`);
console.log(`📍 客户端: ${config.clientId}`);
console.log(`📍 频率: ${config.publishInterval}ms`);
console.log('');
console.log(`💡 请将React应用的IoT绑定主题改为: ${config.topic}`);
console.log('');

const client = mqtt.connect(config.broker, {
  clientId: config.clientId,
  keepalive: 60,
  clean: true
});

let publishCount = 0;

client.on('connect', () => {
  console.log(`✅ 连接成功: ${new Date().toISOString()}`);
  console.log(`🚀 开始发布消息...`);
  console.log('');
  
  const publishInterval = setInterval(() => {
    publishCount++;
    
    const testData = {
      device_id: "react-test-sensor",
      timestamp: Date.now(),
      coordinates: [
        -10 + (Math.random() - 0.5) * 6,
        -50 + (Math.random() - 0.5) * 6,  
        -53 + (Math.random() - 0.5) * 6
      ]
    };

    const message = JSON.stringify(testData);
    
    client.publish(config.topic, message, { qos: 0 }, (err) => {
      if (err) {
        console.log(`❌ [${publishCount}] 发布失败: ${err.message}`);
      } else {
        console.log(`✅ [${publishCount}] 发布成功 (${new Date().toISOString()})`);
      }
    });
    
  }, config.publishInterval);

  // 自动停止
  setTimeout(() => {
    clearInterval(publishInterval);
    console.log(`\n🛑 发布完成，总共发布 ${publishCount} 条消息`);
    client.end();
    process.exit(0);
  }, config.testDuration);
});

client.on('error', (error) => {
  console.log(`❌ 连接失败: ${error.message}`);
  process.exit(1);
});

// 优雅退出
process.on('SIGINT', () => {
  console.log(`\n🛑 手动停止，已发布 ${publishCount} 条消息`);
  if (client) client.end();
  process.exit(0);
});