#!/usr/bin/env node

/**
 * MQTT WebSocket 客户端测试脚本
 * 用于验证 EMQX 公共 broker 的连接限制和数据频率问题
 */

const mqtt = require('mqtt');

// 配置参数
const CONFIG = {
  // EMQX 公共 broker
  broker: 'ws://broker.emqx.io:8083/mqtt',
  // 备用 broker
  backupBroker: 'ws://broker.hivemq.com:8000/mqtt',
  
  // 连接选项 (无认证)
  options: {
    clientId: `test_ws_client_${Date.now()}`,
    keepalive: 60,
    clean: true,
    connectTimeout: 10 * 1000,
    reconnectPeriod: 1000,
    queueQoSZero: false
  },
  
  // 备用连接选项 (带认证)
  optionsWithAuth: {
    clientId: `test_ws_client_auth_${Date.now()}`,
    username: 'test',
    password: 'test', 
    keepalive: 60,
    clean: true,
    connectTimeout: 10 * 1000,
    reconnectPeriod: 1000,
    queueQoSZero: false
  },
  
  // 测试主题
  testTopic: 'sensors/teach/x',
  publishTopic: 'sensors/teach/x',  // 改为测试你应用使用的主题
  
  // 发布频率（毫秒）
  publishInterval: 1000,
  
  // 测试持续时间（毫秒）
  testDuration: 60000, // 1分钟
  
  // 简化测试模式（只测试一个主题）
  simpleMode: true,
  
  // 发布+监听模式（验证1秒频率）
  listenOnly: true
};

class MQTTTester {
  constructor() {
    this.client = null;
    this.messageCount = 0;
    this.lastMessageTime = null;
    this.messageIntervals = [];
    this.startTime = null;
    this.publishCount = 0;
    this.publishInterval = null;
  }

  // 连接到 MQTT broker
  async connect(brokerUrl = CONFIG.broker, useAuth = false) {
    const options = useAuth ? CONFIG.optionsWithAuth : CONFIG.options;
    console.log(`🔌 尝试连接到: ${brokerUrl}`);
    console.log(`📋 客户端配置:`, {
      clientId: options.clientId,
      username: options.username || '(无)',
      keepalive: options.keepalive,
      认证模式: useAuth ? '用户名密码' : '匿名'
    });

    return new Promise((resolve, reject) => {
      this.client = mqtt.connect(brokerUrl, options);

      this.client.on('connect', () => {
        console.log(`✅ 连接成功: ${brokerUrl}`);
        console.log(`⏰ 连接时间: ${new Date().toISOString()}`);
        this.startTime = Date.now();
        resolve();
      });

      this.client.on('error', (error) => {
        console.log(`❌ 连接失败: ${error.message}`);
        console.log(`🔍 错误详情:`, error);
        
        // 如果是认证错误且当前使用匿名连接，尝试带认证的连接
        if (error.message.includes('Not authorized') && !useAuth) {
          console.log(`🔄 匿名连接被拒绝，尝试使用认证...`);
          this.connect(brokerUrl, true).then(resolve).catch(reject);
        } else {
          reject(error);
        }
      });

      this.client.on('close', () => {
        console.log(`🔌 连接已关闭`);
      });

      this.client.on('offline', () => {
        console.log(`📴 客户端离线`);
      });

      this.client.on('reconnect', () => {
        console.log(`🔄 正在重连...`);
      });

      this.client.on('disconnect', (packet) => {
        console.log(`🚪 服务器断开连接:`, packet);
      });
    });
  }

  // 订阅主题并监听消息
  subscribe(topic) {
    console.log(`🔔 尝试订阅主题: ${topic}`);
    
    return new Promise((resolve, reject) => {
      this.client.subscribe(topic, { qos: 0 }, (err, granted) => {
        if (err) {
          console.log(`❌ 订阅失败: ${topic} - ${err.message}`);
          reject(err);
        } else {
          console.log(`✅ 订阅成功: ${topic}`);
          console.log(`📋 授权信息:`, granted);
          
          // 检查授权结果
          if (granted && granted.length > 0) {
            const grantedQos = granted[0].qos;
            if (grantedQos === 128) {
              console.log(`⚠️  订阅被拒绝，QoS = 128 (拒绝码)`);
            } else {
              console.log(`✅ 订阅授权成功，QoS = ${grantedQos}`);
            }
          }
          resolve();
        }
      });
    });
  }

  // 设置消息监听器
  setupMessageHandler() {
    this.client.on('message', (topic, payload) => {
      const now = Date.now();
      this.messageCount++;
      
      // 计算消息间隔
      if (this.lastMessageTime) {
        const interval = now - this.lastMessageTime;
        this.messageIntervals.push(interval);
        
        // 只保留最近20个间隔用于计算平均值
        if (this.messageIntervals.length > 20) {
          this.messageIntervals.shift();
        }
      }
      
      this.lastMessageTime = now;
      
      const message = payload.toString();
      const avgInterval = this.messageIntervals.length > 0 
        ? (this.messageIntervals.reduce((a, b) => a + b, 0) / this.messageIntervals.length)
        : 0;
      
      console.log(`📨 [${this.messageCount}] 收到消息:`);
      console.log(`  📍 主题: ${topic}`);
      console.log(`  ⏰ 时间: ${new Date(now).toISOString()}`);
      console.log(`  📏 大小: ${message.length} 字节`);
      console.log(`  ⏱️  间隔: ${this.lastMessageTime ? `${this.messageIntervals[this.messageIntervals.length - 1]}ms` : 'N/A'}`);
      console.log(`  📊 平均间隔: ${avgInterval.toFixed(0)}ms (${(1000/avgInterval).toFixed(2)} msg/s)`);
      console.log(`  📄 内容: ${message.substring(0, 100)}${message.length > 100 ? '...' : ''}`);
      console.log('');
    });
  }

  // 开始定期发布测试消息
  startPublishing() {
    console.log(`🚀 开始发布测试消息，间隔: ${CONFIG.publishInterval}ms`);
    
    this.publishInterval = setInterval(() => {
      this.publishCount++;
      
      const testData = {
        device_id: "3-axis-sensor-01",  // 与你应用中相同的设备ID
        timestamp: Date.now(),
        coordinates: [
          -10 + Math.random() * 6 - 3, // -13 到 -7 (模拟真实变化)
          -50 + Math.random() * 6 - 3, // -53 到 -47  
          -53 + Math.random() * 6 - 3  // -56 到 -50
        ]
      };

      const message = JSON.stringify(testData, null, 2);
      
      console.log(`📤 [${this.publishCount}] 尝试发布到: ${CONFIG.publishTopic}`);
      
      this.client.publish(CONFIG.publishTopic, message, { qos: 0 }, (err) => {
        if (err) {
          console.log(`❌ 发布失败 [${this.publishCount}]: ${err.message}`);
        } else {
          console.log(`✅ [${this.publishCount}] 发布成功 -> ${CONFIG.publishTopic}`);
          console.log(`  📄 数据: ${JSON.stringify(testData).substring(0, 60)}...`);
        }
      });
    }, CONFIG.publishInterval);
  }

  // 运行完整测试
  async runTest() {
    try {
      console.log(`🧪 开始 MQTT WebSocket 频率测试`);
      console.log(`📋 测试配置:`);
      console.log(`  - Broker: ${CONFIG.broker}`);
      console.log(`  - 测试主题: ${CONFIG.publishTopic} (与你的应用相同)`);
      console.log(`  - 设备ID: 3-axis-sensor-01`);
      console.log(`  - 发布频率: ${CONFIG.publishInterval}ms (${1000/CONFIG.publishInterval} msg/s)`);
      console.log(`  - 测试时长: ${CONFIG.testDuration/1000}秒`);
      console.log('');
      console.log(`💡 这次测试专门验证你应用使用的 sensors/teach/x 主题是否有限制`);
      console.log(`👂 纯监听模式：只订阅，不发布消息`);
      console.log('');

      // 连接
      await this.connect();

      // 设置消息监听器
      this.setupMessageHandler();

      // 只订阅 sensors/teach/x 主题
      console.log(`🔧 监听模式：只订阅 ${CONFIG.testTopic}`);
      await this.subscribe(CONFIG.testTopic);

      // 等待2秒确保订阅完成
      console.log(`⏳ 等待 2 秒确保订阅完成...`);
      await new Promise(resolve => setTimeout(resolve, 2000));

      if (CONFIG.listenOnly) {
        console.log(`👂 开始监听 ${CONFIG.testTopic} 主题...`);
        console.log(`💡 现在请在你的应用中触发IoT数据更新`);
        console.log(`⏰ 测试将持续 ${CONFIG.testDuration/1000} 秒`);
      } else {
        // 开始发布测试消息
        this.startPublishing();
      }

      // 运行指定时间后停止
      setTimeout(() => {
        this.stopTest();
      }, CONFIG.testDuration);

    } catch (error) {
      console.log(`❌ 测试失败: ${error.message}`);
      process.exit(1);
    }
  }

  // 停止测试
  stopTest() {
    console.log(`🛑 停止测试`);
    
    if (this.publishInterval) {
      clearInterval(this.publishInterval);
    }

    const testDuration = Date.now() - this.startTime;
    const avgInterval = this.messageIntervals.length > 0 
      ? (this.messageIntervals.reduce((a, b) => a + b, 0) / this.messageIntervals.length)
      : 0;

    console.log(`\n📊 测试结果统计:`);
    console.log(`  ⏱️  测试时长: ${testDuration}ms (${(testDuration/1000).toFixed(1)}秒)`);
    console.log(`  📤 发布消息数: ${this.publishCount}`);
    console.log(`  📨 接收消息数: ${this.messageCount}`);
    console.log(`  📈 平均接收间隔: ${avgInterval.toFixed(0)}ms`);
    console.log(`  🚀 平均接收频率: ${avgInterval > 0 ? (1000/avgInterval).toFixed(2) : 0} msg/s`);
    console.log(`  📏 消息间隔范围: ${Math.min(...this.messageIntervals)}ms - ${Math.max(...this.messageIntervals)}ms`);
    
    if (this.messageIntervals.length > 0) {
      console.log(`  📊 最近间隔 (ms): [${this.messageIntervals.slice(-5).join(', ')}]`);
    }

    console.log(`\n🔍 分析:`);
    if (avgInterval > CONFIG.publishInterval * 2) {
      console.log(`  ⚠️  消息接收明显延迟，可能存在 broker 限制`);
    } else if (avgInterval > CONFIG.publishInterval * 1.2) {
      console.log(`  ⚡ 消息接收略有延迟，网络或处理延迟`);
    } else {
      console.log(`  ✅ 消息接收正常，无明显延迟`);
    }

    if (this.client) {
      this.client.end();
    }

    process.exit(0);
  }
}

// 处理程序退出
process.on('SIGINT', () => {
  console.log(`\n🛑 收到中断信号，正在停止测试...`);
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log(`\n🛑 收到终止信号，正在停止测试...`);
  process.exit(0);
});

// 启动测试
if (require.main === module) {
  const tester = new MQTTTester();
  tester.runTest();
}

module.exports = MQTTTester;