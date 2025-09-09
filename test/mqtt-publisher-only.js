#!/usr/bin/env node

/**
 * 纯MQTT发布脚本 - 只发布消息，不订阅
 * 用于测试React应用是否能正常接收1Hz频率的MQTT消息
 */

const mqtt = require('mqtt');

const CONFIG = {
  broker: 'ws://broker.emqx.io:8083/mqtt',
  clientId: `publisher_only_${Date.now()}`,
  topic: 'sensors/teach/x',
  publishInterval: 1000, // 1秒间隔
  testDuration: 60000 // 60秒测试
};

class MQTTPublisher {
  constructor() {
    this.client = null;
    this.publishCount = 0;
    this.publishInterval = null;
    this.startTime = null;
  }

  async connect() {
    console.log(`🔌 连接到 MQTT Broker: ${CONFIG.broker}`);
    console.log(`📋 客户端ID: ${CONFIG.clientId}`);
    console.log(`📤 发布主题: ${CONFIG.topic}`);
    console.log(`⏱️  发布频率: ${CONFIG.publishInterval}ms (${1000/CONFIG.publishInterval} msg/s)`);
    console.log(`⏰ 测试时长: ${CONFIG.testDuration/1000}秒`);
    console.log('');

    return new Promise((resolve, reject) => {
      this.client = mqtt.connect(CONFIG.broker, {
        clientId: CONFIG.clientId,
        keepalive: 60,
        clean: true,
        connectTimeout: 10 * 1000,
        reconnectPeriod: 1000
      });

      this.client.on('connect', () => {
        console.log(`✅ 连接成功: ${new Date().toISOString()}`);
        this.startTime = Date.now();
        resolve();
      });

      this.client.on('error', (error) => {
        console.log(`❌ 连接失败: ${error.message}`);
        reject(error);
      });

      this.client.on('close', () => {
        console.log(`🔌 连接已关闭`);
      });
    });
  }

  startPublishing() {
    console.log(`🚀 开始发布消息...`);
    console.log(`💡 现在请在React应用中查看控制台，观察消息接收频率`);
    console.log('');

    this.publishInterval = setInterval(() => {
      this.publishCount++;
      
      const testData = {
        device_id: "3-axis-sensor-01",
        timestamp: Date.now(),
        coordinates: [
          -10 + (Math.random() - 0.5) * 6, // -13 到 -7
          -50 + (Math.random() - 0.5) * 6, // -53 到 -47  
          -53 + (Math.random() - 0.5) * 6  // -56 到 -50
        ]
      };

      const message = JSON.stringify(testData);
      
      this.client.publish(CONFIG.topic, message, { qos: 0 }, (err) => {
        if (err) {
          console.log(`❌ [${this.publishCount}] 发布失败: ${err.message}`);
        } else {
          console.log(`✅ [${this.publishCount}] 已发布 -> ${CONFIG.topic} (${new Date().toISOString()})`);
        }
      });
    }, CONFIG.publishInterval);

    // 定时停止
    setTimeout(() => {
      this.stopPublishing();
    }, CONFIG.testDuration);
  }

  stopPublishing() {
    console.log(`\n🛑 停止发布`);
    
    if (this.publishInterval) {
      clearInterval(this.publishInterval);
    }

    const testDuration = Date.now() - this.startTime;
    console.log(`\n📊 发布统计:`);
    console.log(`  ⏱️  测试时长: ${testDuration}ms (${(testDuration/1000).toFixed(1)}秒)`);
    console.log(`  📤 已发布消息: ${this.publishCount}`);
    console.log(`  📈 平均频率: ${(this.publishCount / (testDuration/1000)).toFixed(2)} msg/s`);

    if (this.client) {
      this.client.end();
    }

    console.log(`\n💡 请检查React应用控制台中的消息接收频率`);
    process.exit(0);
  }

  async run() {
    try {
      await this.connect();
      this.startPublishing();
    } catch (error) {
      console.log(`❌ 测试失败: ${error.message}`);
      process.exit(1);
    }
  }
}

// 处理程序退出
process.on('SIGINT', () => {
  console.log(`\n🛑 收到中断信号，正在停止...`);
  process.exit(0);
});

// 启动发布器
if (require.main === module) {
  const publisher = new MQTTPublisher();
  publisher.run();
}

module.exports = MQTTPublisher;