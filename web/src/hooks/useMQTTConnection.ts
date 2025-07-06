import { useState, useRef, useCallback, useEffect } from 'react';
import { message } from 'antd';
import mqtt, { MqttClient, IClientOptions } from 'mqtt';

// MQTT QoS levels
export type QoS = 0 | 1 | 2;

export interface MQTTMessage {
  id: string;
  topic: string;
  payload: string;
  direction: 'sent' | 'received';
  timestamp: string;
  qos?: QoS;
  retain?: boolean;
}

export interface MQTTConnectionOptions {
  hostname: string;
  port: number;
  websocket_path?: string;
  client_id?: string;
  username?: string;
  password?: string;
  use_tls?: boolean;
  ca_cert?: string;
  client_cert?: string;
  client_key?: string;
  keep_alive?: number;
  clean_session?: boolean;
  connection_timeout?: number;
  max_retries?: number;
  retry_delay?: number;
  default_qos?: QoS;
  topics?: string[];
}

export interface UseMQTTConnectionReturn {
  connect: () => void;
  disconnect: () => void;
  subscribe: (topic: string, qos?: QoS) => void;
  unsubscribe: (topic: string) => void;
  publish: (topic: string, message: string, qos?: QoS, retain?: boolean) => void;
  isConnected: boolean;
  isConnecting: boolean;
  messages: MQTTMessage[];
  subscribedTopics: string[];
  clearMessages: () => void;
  error: string | null;
  connectionAttempts: number;
}

export const useMQTTConnection = (
  options: MQTTConnectionOptions
): UseMQTTConnectionReturn => {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [messages, setMessages] = useState<MQTTMessage[]>([]);
  const [subscribedTopics, setSubscribedTopics] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [connectionAttempts, setConnectionAttempts] = useState(0);

  const clientRef = useRef<MqttClient | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const connectionAttemptsRef = useRef<number>(0);

  // 生成消息ID
  const generateMessageId = () => {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  };

  // 添加消息到列表
  const addMessage = useCallback((
    topic: string, 
    payload: string, 
    direction: 'sent' | 'received',
    qos?: QoS,
    retain?: boolean
  ) => {
    const newMessage: MQTTMessage = {
      id: generateMessageId(),
      topic,
      payload,
      direction,
      timestamp: new Date().toISOString(),
      qos,
      retain
    };
    setMessages(prev => [...prev, newMessage]);
  }, []);

  // 构建MQTT连接选项
  const buildMQTTOptions = useCallback((): IClientOptions => {
    const mqttOptions: IClientOptions = {
      clientId: options.client_id || `mqtt_client_${Math.random().toString(36).substr(2, 9)}`,
      username: options.username,
      password: options.password,
      keepalive: options.keep_alive || 60,
      clean: options.clean_session !== false,
      connectTimeout: (options.connection_timeout || 10) * 1000,
    };

    // 浏览器环境中使用WebSocket协议
    if (options.use_tls) {
      mqttOptions.protocol = 'wss';
    } else {
      mqttOptions.protocol = 'ws';
    }

    // TLS/SSL配置 (对于WebSocket over TLS)
    if (options.use_tls) {
      if (options.ca_cert || options.client_cert || options.client_key) {
        mqttOptions.ca = options.ca_cert ? [Buffer.from(options.ca_cert)] : undefined;
        mqttOptions.cert = options.client_cert ? Buffer.from(options.client_cert) : undefined;
        mqttOptions.key = options.client_key ? Buffer.from(options.client_key) : undefined;
      }
    }

    return mqttOptions;
  }, [options]);

  // 获取WebSocket端口
  const getWebSocketPort = useCallback((originalPort: number, useTls: boolean): number => {
    // 如果已经是WebSocket端口，直接返回
    if (originalPort === 8083 || originalPort === 8084 || originalPort === 8080) {
      return originalPort;
    }
    
    // 标准MQTT端口转换为WebSocket端口
    if (originalPort === 1883) {
      return 8083; // MQTT over WebSocket
    } else if (originalPort === 8883) {
      return 8084; // MQTT over WebSocket (TLS)
    }
    
    // 根据TLS设置返回默认端口
    return useTls ? 8084 : 8083;
  }, []);

  // 连接MQTT
  const connect = useCallback(() => {
    if (isConnecting || isConnected) {
      return;
    }

    setIsConnecting(true);
    setError(null);
    connectionAttemptsRef.current += 1;
    setConnectionAttempts(connectionAttemptsRef.current);

    // 重试连接的辅助函数
    const attemptReconnect = (reason: string) => {
      const maxRetries = options.max_retries || 3;
      const currentAttempts = connectionAttemptsRef.current;
      console.log(`${reason} - 当前重试次数: ${currentAttempts}, 最大重试次数: ${maxRetries}`);
      
      if (currentAttempts < maxRetries) {
        const retryDelay = (options.retry_delay || 5) * 1000;
        message.warning(`${reason}，${retryDelay / 1000}秒后重试... (第${currentAttempts}次重试，最多${maxRetries}次)`);
        addMessage('system', `${reason}，准备第${currentAttempts}次重试，${retryDelay / 1000}秒后重连...`, 'received');
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, retryDelay);
      } else {
        message.error(`连接失败，已达到最大重试次数(${maxRetries}次)`);
        addMessage('system', `连接失败，已达到最大重试次数(${maxRetries}次)`, 'received');
      }
    };

    try {
      const mqttOptions = buildMQTTOptions();
      const wsPort = getWebSocketPort(options.port, options.use_tls || false);
      
      // 处理hostname，确保不包含路径
      let cleanHostname = options.hostname;
      if (cleanHostname.includes('/')) {
        // 如果用户错误地在hostname中包含了路径，则去除路径部分
        cleanHostname = cleanHostname.split('/')[0];
        console.warn(`检测到hostname包含路径，已自动清理: ${options.hostname} => ${cleanHostname}`);
        addMessage('system', `主机名自动清理: ${options.hostname} => ${cleanHostname}`, 'received');
      }
      
      // 使用配置的WebSocket路径（默认为/mqtt）
      const websocketPath = options.websocket_path || '/mqtt';
      const brokerUrl = `${mqttOptions.protocol}://${cleanHostname}:${wsPort}${websocketPath}`;
      
      console.log('正在连接MQTT Broker:', brokerUrl);
      console.log('原始端口:', options.port, '=> WebSocket端口:', wsPort);
      addMessage('system', `正在连接到 ${brokerUrl}...`, 'received');
      
      // 如果端口被自动转换，提示用户
      if (wsPort !== options.port) {
        addMessage('system', `端口自动转换: ${options.port} => ${wsPort} (WebSocket端口)`, 'received');
      }

      const client = mqtt.connect(brokerUrl, mqttOptions);
      clientRef.current = client;

      client.on('connect', () => {
        console.log('MQTT连接已建立');
        setIsConnected(true);
        setIsConnecting(false);
        setError(null);
        connectionAttemptsRef.current = 0;
        setConnectionAttempts(0);
        message.success('MQTT连接成功');
        addMessage('system', '连接已建立', 'received');

        // 自动订阅配置的主题
        if (options.topics && options.topics.length > 0) {
          options.topics.forEach(topic => {
            subscribe(topic, options.default_qos || 0);
          });
        }
      });

      client.on('message', (topic, payload, packet) => {
        const message = payload.toString();
        console.log(`收到消息 [${topic}]:`, message);
        addMessage(topic, message, 'received', packet.qos, packet.retain);
      });

      client.on('error', (err) => {
        console.error('MQTT错误:', err);
        setError(err.message);
        setIsConnecting(false);
        addMessage('system', `连接错误: ${err.message}`, 'received');
        attemptReconnect('连接出错');
      });

      client.on('close', () => {
        console.log('MQTT连接已断开');
        setIsConnected(false);
        setIsConnecting(false);
        addMessage('system', '连接已断开', 'received');
      });

      client.on('offline', () => {
        console.log('MQTT离线');
        setIsConnected(false);
        addMessage('system', '客户端离线', 'received');
      });

      client.on('reconnect', () => {
        console.log('MQTT重连中...');
        addMessage('system', '正在重连...', 'received');
      });

    } catch (err: any) {
      console.error('MQTT连接错误:', err);
      setError(err.message);
      setIsConnecting(false);
      addMessage('system', `连接错误: ${err.message}`, 'received');
      attemptReconnect('连接失败');
    }
  }, [options, buildMQTTOptions, getWebSocketPort, addMessage]);

  // 断开连接
  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (clientRef.current) {
      clientRef.current.end(true);
      clientRef.current = null;
    }

    setIsConnected(false);
    setIsConnecting(false);
    setSubscribedTopics([]);
    connectionAttemptsRef.current = 0;
    setConnectionAttempts(0);
    console.log('MQTT连接已主动断开');
    addMessage('system', '连接已主动断开', 'received');
  }, [addMessage]);

  // 订阅主题
  const subscribe = useCallback((topic: string, qos: QoS = 0) => {
    if (!clientRef.current || !isConnected) {
      message.error('请先连接到MQTT Broker');
      return;
    }

    clientRef.current.subscribe(topic, { qos }, (err, granted) => {
      if (err) {
        console.error('订阅失败:', err);
        message.error(`订阅主题 ${topic} 失败: ${err.message}`);
        addMessage('system', `订阅主题 ${topic} 失败: ${err.message}`, 'received');
      } else {
        console.log('订阅成功:', granted);
        setSubscribedTopics(prev => {
          if (!prev.includes(topic)) {
            return [...prev, topic];
          }
          return prev;
        });
        message.success(`已订阅主题: ${topic}`);
        addMessage('system', `已订阅主题: ${topic} (QoS: ${qos})`, 'received');
      }
    });
  }, [isConnected, addMessage]);

  // 取消订阅
  const unsubscribe = useCallback((topic: string) => {
    if (!clientRef.current || !isConnected) {
      message.error('请先连接到MQTT Broker');
      return;
    }

    clientRef.current.unsubscribe(topic, (err) => {
      if (err) {
        console.error('取消订阅失败:', err);
        message.error(`取消订阅主题 ${topic} 失败: ${err.message}`);
        addMessage('system', `取消订阅主题 ${topic} 失败: ${err.message}`, 'received');
      } else {
        console.log('取消订阅成功:', topic);
        setSubscribedTopics(prev => prev.filter(t => t !== topic));
        message.success(`已取消订阅主题: ${topic}`);
        addMessage('system', `已取消订阅主题: ${topic}`, 'received');
      }
    });
  }, [isConnected, addMessage]);

  // 发布消息
  const publish = useCallback((topic: string, messageText: string, qos: QoS = 0, retain: boolean = false) => {
    if (!clientRef.current || !isConnected) {
      message.error('请先连接到MQTT Broker');
      return;
    }

    clientRef.current.publish(topic, messageText, { qos, retain }, (err) => {
      if (err) {
        console.error('发布失败:', err);
        message.error(`发布消息失败: ${err.message}`);
        addMessage('system', `发布消息失败: ${err.message}`, 'received');
      } else {
        console.log(`消息已发布到主题 ${topic}:`, messageText);
        addMessage(topic, messageText, 'sent', qos, retain);
      }
    });
  }, [isConnected, addMessage]);

  // 清空消息列表
  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  // 组件卸载时清理连接
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    connect,
    disconnect,
    subscribe,
    unsubscribe,
    publish,
    isConnected,
    isConnecting,
    messages,
    subscribedTopics,
    clearMessages,
    error,
    connectionAttempts,
  };
}; 