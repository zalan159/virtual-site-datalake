import { useEffect, useRef, useState, useCallback } from 'react';
import { animationEventService } from '../services/animationEventService';
import { iotAnimationService } from '../services/iotAnimationService';
import { AnimationEvent } from '../types/animation';
import { iotBindingAPI, IoTBinding, IoTBindingWithInstance, IoTProtocolType } from '../services/iotBindingApi';
import { mqttAPI, MQTTDataSource } from '../services/mqttApi';
import { websocketAPI } from '../services/websocketApi';
import { httpAPI } from '../services/httpApi';
import { useMQTTConnection, MQTTConnectionOptions } from './useMQTTConnection';
import { useWebSocketConnection, WebSocketConnectionOptions } from './useWebSocketConnection';
import { useHTTPRequest, HTTPRequestOptions } from './useHTTPRequest';
import { IoTDataProcessor, DataBindingProcessor } from '../utils/iotDataProcessor';

interface PreviewModeOptions {
  enabled: boolean;
  sceneId?: string;
  instanceId?: string;
  viewerRef?: React.RefObject<any>;
  onAnimationEvent?: (event: AnimationEvent) => void;
  onIoTDataUpdate?: (data: any) => void;
  onInstanceUpdate?: (instanceId: string, property: string, value: any) => void;
  iotAnimationConfig?: {
    enableSmoothTransition: boolean;
    transitionDuration: number; // 动画持续时间（秒）
    usePathAnimation: boolean; // 是否使用路径动画
    maxPathPoints: number; // 路径动画最大点数
  };
}

// 连接池接口定义
interface IoTConnection {
  sourceId: string;
  protocol: IoTProtocolType;
  config: any;
  client: any; // MQTT/WebSocket/HTTP client
  bindings: (IoTBinding | IoTBindingWithInstance)[]; // 使用此连接的所有绑定
  isConnected: boolean;
  lastDataTime?: number;
}

interface ConnectionPool {
  connections: Map<string, IoTConnection>;
  bindingGroups: Map<string, (IoTBinding | IoTBindingWithInstance)[]>;
}

export const usePreviewMode = (options: PreviewModeOptions) => {
  const { enabled, sceneId, instanceId, viewerRef, onAnimationEvent, onIoTDataUpdate, onInstanceUpdate, iotAnimationConfig } = options;
  
  const animationWsRef = useRef<WebSocket | null>(null);
  const iotWsRef = useRef<WebSocket | null>(null);
  const [isAnimationConnected, setIsAnimationConnected] = useState(false);
  const [isIoTConnected, setIsIoTConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  
  // IoT绑定相关状态
  const [iotBindings, setIoTBindings] = useState<(IoTBinding | IoTBindingWithInstance)[]>([]);
  const [connectionConfigs, setConnectionConfigs] = useState<Map<string, any>>(new Map());
  const [bindingDataCache, setBindingDataCache] = useState<Map<string, any>>(new Map());
  
  // 连接池管理器
  const connectionPoolRef = useRef<ConnectionPool>({
    connections: new Map(),
    bindingGroups: new Map()
  });
  const [poolStatus, setPoolStatus] = useState<{[key: string]: boolean}>({});
  
  const httpRequestHook = useHTTPRequest();

  // ====================  原有数据处理逻辑 ====================
  
  /**
   * 根据绑定规则处理IoT数据并更新实例
   */
  const processIoTDataAndUpdateInstance = useCallback(async (binding: IoTBinding | IoTBindingWithInstance, rawData: any, topic?: string) => {
    try {
      debugLog('PROCESS_DATA', `开始处理IoT数据`, { bindingId: binding.id, protocol: binding.protocol, dataType: binding.dataType, topic });
      
      // 获取绑定的实例ID
      const bindingInstanceId = 'instanceId' in binding ? binding.instanceId : instanceId;
      const bindingInstanceName = 'instanceName' in binding ? binding.instanceName : '未知实例';
      
      // 1. 处理原始数据
      const processedData = IoTDataProcessor.processData(rawData, binding.dataType);
      if (!processedData.success) {
        debugLog('PROCESS_DATA', `数据处理失败: ${processedData.error}`, { bindingId: binding.id });
        return;
      }
      
      // 2. 处理绑定规则 - 增强topic匹配逻辑
      if (binding.bindings && binding.bindings.length > 0) {
        for (const bindingRule of binding.bindings) {
          try {
            // 根据协议类型和数据类型解析source格式
            const sourceString = bindingRule.source || '';
            const { topicPath, dataPath, matches } = parseSourcePath(sourceString, topic, binding.protocol, binding.dataType);
            
            // 如果指定了topic，检查是否匹配
            if (topic && topicPath && !matches) {
              debugLog('PROCESS_DATA', `Topic不匹配，跳过此绑定规则`, { 
                bindingId: binding.id, 
                expectedTopic: topicPath,
                actualTopic: topic
              });
              continue;
            }
            
            // 提取源数据路径的值
            const sourceValue = DataBindingProcessor.extractValue(processedData.data, dataPath);
            
            if (sourceValue !== undefined) {
              // 应用数值映射（如果配置了）
              let mappedValue = sourceValue;
              if (binding.valueMapping && typeof sourceValue === 'number') {
                const { inputMin, inputMax, outputMin, outputMax, clamp } = binding.valueMapping;
                
                // 线性映射
                let normalizedValue = (sourceValue - inputMin) / (inputMax - inputMin);
                if (clamp) {
                  normalizedValue = Math.max(0, Math.min(1, normalizedValue));
                }
                mappedValue = outputMin + normalizedValue * (outputMax - outputMin);
              }
              
              // 更新实例属性
              if (bindingInstanceId) {
                onInstanceUpdate?.(bindingInstanceId, bindingRule.target, mappedValue);
              } else {
                onInstanceUpdate?.('scene', bindingRule.target, mappedValue);
              }
              
              // 缓存数据
              setBindingDataCache(prev => new Map(prev).set(`${binding.id}_${bindingRule.target}`, {
                value: mappedValue,
                timestamp: Date.now(),
                bindingId: binding.id,
                instanceId: bindingInstanceId,
                instanceName: bindingInstanceName,
                source: bindingRule.source,
                target: bindingRule.target,
                topic: topic
              }));
            }
          } catch (error: any) {
            debugLog('PROCESS_DATA', `处理绑定规则失败`, { bindingId: binding.id, bindingRule, error: error.message });
          }
        }
      }
      
      // 调用IoT数据更新回调
      onIoTDataUpdate?.({
        bindingId: binding.id,
        rawData,
        processedData: processedData.data,
        timestamp: Date.now()
      });
      
    } catch (error: any) {
      debugLog('PROCESS_DATA', `IoT数据处理失败`, { bindingId: binding.id, error: error.message });
    }
  }, [instanceId, onInstanceUpdate, onIoTDataUpdate]);

  /**
   * 根据协议类型和数据类型解析source路径
   */
  const parseSourcePath = useCallback((sourcePath: string, currentTopic?: string, protocol?: string, dataType?: string) => {
    if (!sourcePath) {
      return { topicPath: '', dataPath: '', matches: true };
    }

    let topicPath = '';
    let dataPath = '';
    let matches = true;

    // 根据协议类型和数据类型解析source格式
    if (protocol === 'mqtt') {
      if (dataType === 'json') {
        // MQTT + JSON: '{订阅路径}.{json对象key层级}'
        if (sourcePath.includes('/')) {
          const lastSlashIndex = sourcePath.lastIndexOf('/');
          const remainingPart = sourcePath.substring(lastSlashIndex + 1);
          
          if (remainingPart.includes('.')) {
            const firstDotAfterSlash = sourcePath.indexOf('.', lastSlashIndex);
            topicPath = sourcePath.substring(0, firstDotAfterSlash);
            dataPath = sourcePath.substring(firstDotAfterSlash + 1);
          } else {
            topicPath = sourcePath;
            dataPath = '';
          }
        } else {
          const firstDotIndex = sourcePath.indexOf('.');
          if (firstDotIndex === -1) {
            if (currentTopic && sourcePath === currentTopic) {
              topicPath = sourcePath;
              dataPath = '';
            } else {
              topicPath = '';
              dataPath = sourcePath;
            }
          } else {
            topicPath = '';
            dataPath = sourcePath;
          }
        }
      } else {
        // MQTT + 其他类型: '{订阅路径}'
        topicPath = sourcePath;
        dataPath = '';
      }
      
      // 检查topic是否匹配（仅MQTT需要）
      if (currentTopic && topicPath) {
        matches = matchTopic(topicPath, currentTopic);
      }
    } else {
      // WebSocket/HTTP协议
      if (dataType === 'json') {
        // WebSocket/HTTP + JSON: '{json对象key层级}'
        topicPath = '';
        dataPath = sourcePath;
      } else {
        // WebSocket/HTTP + 其他类型: 空字符串
        topicPath = '';
        dataPath = '';
      }
      
      // WebSocket/HTTP总是匹配（没有topic概念）
      matches = true;
    }
    
    return { topicPath, dataPath, matches };
  }, []);

  /**
   * MQTT topic匹配函数
   */
  const matchTopic = useCallback((pattern: string, topic: string): boolean => {
    if (pattern === topic) {
      return true;
    }
    
    const regexPattern = pattern
      .replace(/\+/g, '[^/]+')
      .replace(/\#/g, '.*');
    
    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(topic);
  }, []);

  /**
   * 获取当前场景实例的所有IoT绑定
   */
  const fetchIoTBindings = useCallback(async () => {
    if (!sceneId || !instanceId) {
      debugLog('FETCH_BINDINGS', '缺少sceneId或instanceId，跳过获取IoT绑定');
      return;
    }
    
    try {
      debugLog('FETCH_BINDINGS', `开始获取IoT绑定 - Scene: ${sceneId}, Instance: ${instanceId}`);
      
      const response = await iotBindingAPI.getInstanceBindings(sceneId, instanceId);
      const bindings = response.data;
      
      setIoTBindings(bindings);
      
      // 获取所有唯一的连接配置ID
      const sourceIds = [...new Set(bindings.map(b => b.sourceId))];
      await fetchConnectionConfigs(sourceIds, bindings);
      
    } catch (error: any) {
      debugLog('FETCH_BINDINGS', '获取IoT绑定失败', error);
      setConnectionError(`获取IoT绑定失败: ${error.message}`);
    }
  }, [sceneId, instanceId]);

  /**
   * 获取场景中所有实例的IoT绑定
   */
  const fetchSceneBindings = useCallback(async () => {
    if (!sceneId) {
      debugLog('FETCH_SCENE_BINDINGS', '缺少sceneId，跳过获取场景IoT绑定');
      return;
    }
    
    try {
      debugLog('FETCH_SCENE_BINDINGS', `开始获取场景所有IoT绑定 - Scene: ${sceneId}`);
      
      const response = await iotBindingAPI.getSceneBindings(sceneId);
      const bindings = response.data;
      
      setIoTBindings(bindings);
      
      // 获取所有唯一的连接配置ID
      const sourceIds = [...new Set(bindings.map(b => b.sourceId))];
      await fetchConnectionConfigs(sourceIds, bindings);
      
    } catch (error: any) {
      debugLog('FETCH_SCENE_BINDINGS', '获取场景IoT绑定失败', error);
      setConnectionError(`获取场景IoT绑定失败: ${error.message}`);
    }
  }, [sceneId]);

  /**
   * 获取连接配置
   */
  const fetchConnectionConfigs = useCallback(async (sourceIds: string[], bindings: (IoTBinding | IoTBindingWithInstance)[]) => {
    const configs = new Map();
    
    for (const sourceId of sourceIds) {
      try {
        const binding = bindings.find(b => b.sourceId === sourceId);
        const protocol = binding?.protocol || 'mqtt';
        
        let config;
        switch (protocol) {
          case 'mqtt':
            const mqttResponse = await mqttAPI.getMQTTById(sourceId);
            config = mqttResponse.data;
            break;
          case 'websocket':
            const wsResponse = await websocketAPI.getWebSocketById(sourceId);
            config = wsResponse.data;
            break;
          case 'http':
            const httpResponse = await httpAPI.getHTTPById(sourceId);
            config = httpResponse.data;
            break;
          default:
            throw new Error(`不支持的协议类型: ${protocol}`);
        }
        
        configs.set(sourceId, config);
      } catch (error: any) {
        debugLog('FETCH_CONFIG', `获取连接配置失败: ${sourceId}`, error);
      }
    }
    
    setConnectionConfigs(configs);
  }, []);

  // ====================  连接池管理逻辑 ====================
  
  /**
   * 调试日志函数
   */
  const debugLog = useCallback((category: string, message: string, data?: any) => {
    const timestamp = new Date().toISOString();
    console.log(`[DEBUG ${timestamp}] [${category}] ${message}`, data || '');
  }, []);

  /**
   * 构建连接池：按sourceId对绑定进行分组
   */
  const buildConnectionPool = useCallback(async () => {
    debugLog('POOL_BUILD', '开始构建连接池', { bindingsCount: iotBindings.length });
    
    const pool = connectionPoolRef.current;
    
    // 清理现有连接池
    pool.bindingGroups.clear();
    
    // 按sourceId分组绑定
    const enabledBindings = iotBindings.filter(binding => binding.enabled);
    for (const binding of enabledBindings) {
      if (!pool.bindingGroups.has(binding.sourceId)) {
        pool.bindingGroups.set(binding.sourceId, []);
      }
      pool.bindingGroups.get(binding.sourceId)!.push(binding);
    }
    
    debugLog('POOL_BUILD', '绑定分组完成', { 
      groupCount: pool.bindingGroups.size,
      groups: Array.from(pool.bindingGroups.entries()).map(([sourceId, bindings]) => ({
        sourceId,
        bindingCount: bindings.length,
        protocols: [...new Set(bindings.map(b => b.protocol))]
      }))
    });
    
    // 为每个数据源创建或更新连接
    for (const [sourceId, bindings] of pool.bindingGroups) {
      const config = connectionConfigs.get(sourceId);
      if (!config) {
        debugLog('POOL_BUILD', `跳过缺少配置的数据源`, { sourceId });
        continue;
      }
      
      // 获取协议类型（同一个sourceId的所有绑定应该使用相同协议）
      const protocol = bindings[0].protocol;
      
      // 检查是否已存在连接
      let connection = pool.connections.get(sourceId);
      if (connection) {
        // 更新现有连接的绑定列表
        connection.bindings = bindings;
        debugLog('POOL_BUILD', `更新现有连接`, { sourceId, protocol, bindingCount: bindings.length });
      } else {
        // 创建新连接
        connection = {
          sourceId,
          protocol,
          config,
          client: null,
          bindings,
          isConnected: false
        };
        pool.connections.set(sourceId, connection);
        debugLog('POOL_BUILD', `创建新连接`, { sourceId, protocol, bindingCount: bindings.length });
      }
    }
    
    // 清理不再需要的连接
    for (const [sourceId, connection] of pool.connections) {
      if (!pool.bindingGroups.has(sourceId)) {
        debugLog('POOL_BUILD', `清理废弃连接`, { sourceId });
        await disconnectFromPool(sourceId);
        pool.connections.delete(sourceId);
      }
    }
    
    debugLog('POOL_BUILD', '连接池构建完成', { 
      totalConnections: pool.connections.size,
      totalBindings: iotBindings.length
    });
  }, [iotBindings, connectionConfigs]);

  /**
   * 启动连接池中的所有连接
   */
  const startConnectionPool = useCallback(async () => {
    debugLog('POOL_START', '启动连接池');
    
    const pool = connectionPoolRef.current;
    const promises: Promise<void>[] = [];
    
    for (const [sourceId, connection] of pool.connections) {
      if (!connection.isConnected) {
        promises.push(connectToPool(sourceId, connection));
      }
    }
    
    await Promise.allSettled(promises);
    debugLog('POOL_START', '连接池启动完成');
  }, []);

  /**
   * 停止连接池中的所有连接
   */
  const stopConnectionPool = useCallback(async () => {
    debugLog('POOL_STOP', '停止连接池');
    
    const pool = connectionPoolRef.current;
    const promises: Promise<void>[] = [];
    
    for (const [sourceId] of pool.connections) {
      promises.push(disconnectFromPool(sourceId));
    }
    
    await Promise.allSettled(promises);
    pool.connections.clear();
    pool.bindingGroups.clear();
    setPoolStatus({});
    
    debugLog('POOL_STOP', '连接池已停止');
  }, []);

  /**
   * 连接到特定数据源
   */
  const connectToPool = useCallback(async (sourceId: string, connection: IoTConnection): Promise<void> => {
    try {
      debugLog('POOL_CONNECT', `开始连接`, { sourceId, protocol: connection.protocol });
      
      setPoolStatus(prev => ({ ...prev, [sourceId]: false }));
      
      switch (connection.protocol) {
        case IoTProtocolType.MQTT:
          await connectMQTTToPool(sourceId, connection);
          break;
        case IoTProtocolType.WEBSOCKET:
          await connectWebSocketToPool(sourceId, connection);
          break;
        case IoTProtocolType.HTTP:
          await connectHTTPToPool(sourceId, connection);
          break;
        default:
          throw new Error(`不支持的协议类型: ${connection.protocol}`);
      }
      
      connection.isConnected = true;
      setPoolStatus(prev => ({ ...prev, [sourceId]: true }));
      
      debugLog('POOL_CONNECT', `连接成功`, { sourceId, protocol: connection.protocol });
      
    } catch (error: any) {
      debugLog('POOL_CONNECT', `连接失败`, { sourceId, error: error.message });
      setConnectionError(`连接失败 [${sourceId}]: ${error.message}`);
    }
  }, []);

  /**
   * 断开特定数据源的连接
   */
  const disconnectFromPool = useCallback(async (sourceId: string): Promise<void> => {
    const pool = connectionPoolRef.current;
    const connection = pool.connections.get(sourceId);
    
    if (!connection) return;
    
    try {
      debugLog('POOL_DISCONNECT', `断开连接`, { sourceId, protocol: connection.protocol });
      
      if (connection.client) {
        switch (connection.protocol) {
          case IoTProtocolType.MQTT:
            if (connection.client.end) {
              connection.client.end(true);
            }
            break;
          case IoTProtocolType.WEBSOCKET:
            if (connection.client.close) {
              connection.client.close();
            }
            break;
          case IoTProtocolType.HTTP:
            // HTTP轮询通过clearInterval停止
            if (connection.client) {
              clearInterval(connection.client);
            }
            break;
        }
      }
      
      connection.isConnected = false;
      setPoolStatus(prev => {
        const newStatus = { ...prev };
        delete newStatus[sourceId];
        return newStatus;
      });
      
      debugLog('POOL_DISCONNECT', `断开成功`, { sourceId });
      
    } catch (error: any) {
      debugLog('POOL_DISCONNECT', `断开失败`, { sourceId, error: error.message });
    }
  }, []);

  /**
   * 处理从连接池收到的数据
   */
  const handlePoolData = useCallback(async (sourceId: string, rawData: any, topic?: string) => {
    const pool = connectionPoolRef.current;
    const connection = pool.connections.get(sourceId);
    
    if (!connection) {
      debugLog('POOL_DATA', `连接不存在`, { sourceId });
      return;
    }
    
    debugLog('POOL_DATA', `收到数据`, { 
      sourceId, 
      bindingCount: connection.bindings.length,
      topic,
      dataPreview: typeof rawData === 'string' ? rawData.substring(0, 100) : rawData
    });
    
    // 更新连接的最后数据时间
    connection.lastDataTime = Date.now();
    
    // 处理所有使用此连接的绑定
    for (const binding of connection.bindings) {
      try {
        await processIoTDataAndUpdateInstance(binding, rawData, topic);
      } catch (error: any) {
        debugLog('POOL_DATA', `处理绑定失败`, { 
          sourceId, 
          bindingId: binding.id, 
          error: error.message 
        });
      }
    }
  }, []);

  /**
   * 连接MQTT到连接池
   */
  const connectMQTTToPool = useCallback(async (sourceId: string, connection: IoTConnection): Promise<void> => {
    const config = connection.config;
    
    // 创建MQTT客户端
    const mqtt = await import('mqtt');
    const protocol = config.use_tls ? 'wss' : 'ws';
    const websocketPath = config.websocket_path || '/mqtt';
    const brokerUrl = `${protocol}://${config.hostname}:${config.port}${websocketPath}`;
    
    const client = mqtt.default.connect(brokerUrl, {
      clientId: config.client_id || `iot_pool_${sourceId}`,
      username: config.username,
      password: config.password,
      keepalive: config.keep_alive || 60,
      clean: config.clean_session !== false,
      connectTimeout: (config.connection_timeout || 10) * 1000,
    });
    
    return new Promise((resolve, reject) => {
      client.on('connect', () => {
        debugLog('MQTT_POOL', `MQTT连接成功`, { sourceId });
        
        // 收集所有需要订阅的主题
        const topics = new Set<string>();
        if (config.topics && config.topics.length > 0) {
          config.topics.forEach((topic: string) => topics.add(topic));
        }
        
        // 从绑定中提取额外的主题
        for (const binding of connection.bindings) {
          if (binding.protocol === 'mqtt' && binding.bindings) {
            for (const bindingRule of binding.bindings) {
              const { topicPath } = parseSourcePath(bindingRule.source || '', undefined, binding.protocol, binding.dataType);
              if (topicPath) {
                topics.add(topicPath);
              }
            }
          }
        }
        
        // 订阅所有主题
        for (const topic of topics) {
          client.subscribe(topic, { qos: 0 }, (err, granted) => {
            if (err) {
              debugLog('MQTT_POOL', `订阅失败`, { sourceId, topic, error: err.message });
            } else {
              debugLog('MQTT_POOL', `订阅成功`, { sourceId, topic, granted });
            }
          });
        }
        
        connection.client = client;
        resolve();
      });
      
      client.on('message', async (topic, payload, packet) => {
        const message = payload.toString();
        debugLog('MQTT_POOL', `收到消息`, { sourceId, topic, messageLength: message.length });
        await handlePoolData(sourceId, message, topic);
      });
      
      client.on('error', (error) => {
        debugLog('MQTT_POOL', `连接错误`, { sourceId, error: error.message });
        reject(error);
      });
      
      client.on('close', () => {
        debugLog('MQTT_POOL', `连接关闭`, { sourceId });
        connection.isConnected = false;
        setPoolStatus(prev => ({ ...prev, [sourceId]: false }));
      });
    });
  }, [handlePoolData, parseSourcePath]);

  /**
   * 连接WebSocket到连接池
   */
  const connectWebSocketToPool = useCallback(async (sourceId: string, connection: IoTConnection): Promise<void> => {
    const config = connection.config;
    
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(config.url, config.protocols);
      
      ws.onopen = () => {
        debugLog('WS_POOL', `WebSocket连接成功`, { sourceId, url: config.url });
        connection.client = ws;
        resolve();
      };
      
      ws.onmessage = async (event) => {
        debugLog('WS_POOL', `收到消息`, { sourceId, dataLength: event.data.length });
        await handlePoolData(sourceId, event.data, config.url);
      };
      
      ws.onclose = () => {
        debugLog('WS_POOL', `连接关闭`, { sourceId });
        connection.isConnected = false;
        setPoolStatus(prev => ({ ...prev, [sourceId]: false }));
      };
      
      ws.onerror = (error) => {
        debugLog('WS_POOL', `连接错误`, { sourceId, error });
        reject(new Error('WebSocket连接失败'));
      };
    });
  }, [handlePoolData]);

  /**
   * 连接HTTP到连接池
   */
  const connectHTTPToPool = useCallback(async (sourceId: string, connection: IoTConnection): Promise<void> => {
    const config = connection.config;
    
    // 找到第一个HTTP绑定的配置
    const httpBinding = connection.bindings.find(b => b.protocol === 'http');
    const pollInterval = httpBinding?.httpConfig?.pollInterval || httpBinding?.updateInterval || 10;
    
    const httpOptions: HTTPRequestOptions = {
      method: httpBinding?.httpConfig?.method || 'GET',
      url: config.base_url,
      headers: config.headers,
      auth_type: config.auth_type,
      auth_username: config.auth_username,
      auth_password: config.auth_password,
      auth_token: config.auth_token,
      api_key: config.api_key,
      api_key_header: config.api_key_header,
      timeout: httpBinding?.httpConfig?.timeout || 30000,
      poll_interval: pollInterval,
      data_type: httpBinding?.dataType
    };
    
    const pollFunction = async () => {
      try {
        debugLog('HTTP_POOL', `执行轮询`, { sourceId, url: httpOptions.url });
        
        const response = await httpRequestHook.execute(httpOptions);
        
        debugLog('HTTP_POOL', `轮询成功`, { 
          sourceId, 
          status: response.status, 
          responseTime: response.responseTime 
        });
        
        await handlePoolData(sourceId, response.data, httpOptions.url);
        
      } catch (error: any) {
        debugLog('HTTP_POOL', `轮询失败`, { sourceId, error: error.message });
      }
    };
    
    // 立即执行一次
    await pollFunction();
    
    // 设置定时轮询
    if (pollInterval && pollInterval > 0) {
      const intervalId = setInterval(pollFunction, pollInterval * 1000);
      connection.client = intervalId;
      
      debugLog('HTTP_POOL', `HTTP轮询已启动`, { 
        sourceId, 
        interval: pollInterval 
      });
    }
  }, [handlePoolData, httpRequestHook]);

  // ====================  原有WebSocket逻辑 ====================

  const connectAnimationWebSocket = () => {
    if (animationWsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    try {
      const wsUrl = `ws://${window.location.hostname}:8000/ws/animation-events`;
      const ws = new WebSocket(wsUrl);
      
      ws.onopen = () => {
        console.log('动画事件WebSocket连接已建立');
        setIsAnimationConnected(true);
        setConnectionError(null);
      };

      ws.onmessage = (event) => {
        try {
          const animationEvent = JSON.parse(event.data) as AnimationEvent;
          animationEventService.sendEvent(animationEvent);
          onAnimationEvent?.(animationEvent);
        } catch (error) {
          console.error('解析动画事件数据失败:', error);
        }
      };

      ws.onclose = () => {
        console.log('动画事件WebSocket连接已关闭');
        setIsAnimationConnected(false);
        animationWsRef.current = null;
      };

      ws.onerror = (error) => {
        console.error('动画事件WebSocket连接失败:', error);
        setIsAnimationConnected(false);
        setConnectionError('动画事件WebSocket连接失败');
      };

      animationWsRef.current = ws;
    } catch (error) {
      console.error('创建动画事件WebSocket连接失败:', error);
      setConnectionError('创建动画事件WebSocket连接失败');
    }
  };

  const connectIoTWebSocket = () => {
    if (iotWsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    try {
      const wsUrl = `ws://${window.location.hostname}:8000/ws/iot-data`;
      const ws = new WebSocket(wsUrl);
      
      ws.onopen = () => {
        console.log('IoT数据WebSocket连接已建立');
        setIsIoTConnected(true);
        setConnectionError(null);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'iot-update') {
            iotAnimationService.updateIoTDataBatch(data.data);
            onIoTDataUpdate?.(data.data);
          }
        } catch (error) {
          console.error('解析IoT数据失败:', error);
        }
      };

      ws.onclose = () => {
        console.log('IoT数据WebSocket连接已关闭');
        setIsIoTConnected(false);
        iotWsRef.current = null;
      };

      ws.onerror = (error) => {
        console.error('IoT数据WebSocket连接失败:', error);
        setIsIoTConnected(false);
        setConnectionError('IoT数据WebSocket连接失败');
      };

      iotWsRef.current = ws;
    } catch (error) {
      console.error('创建IoT数据WebSocket连接失败:', error);
      setConnectionError('创建IoT数据WebSocket连接失败');
    }
  };

  const disconnectWebSockets = () => {
    if (animationWsRef.current) {
      animationWsRef.current.close();
      animationWsRef.current = null;
    }
    
    if (iotWsRef.current) {
      iotWsRef.current.close();
      iotWsRef.current = null;
    }
    
    setIsAnimationConnected(false);
    setIsIoTConnected(false);
    setConnectionError(null);
  };

  const startPreviewMode = async () => {
    debugLog('PREVIEW', '启动预览模式');
    
    if (viewerRef?.current) {
      iotAnimationService.initialize(viewerRef.current);
    }
    
    // 启动原有的WebSocket连接
    connectAnimationWebSocket();
    connectIoTWebSocket();
    
    // 启动IoT绑定功能
    try {
      // 1. 获取IoT绑定配置
      if (instanceId) {
        // 如果有instanceId，获取特定实例的绑定
        await fetchIoTBindings();
      } else {
        // 如果只有sceneId，获取整个场景的绑定
        await fetchSceneBindings();
      }
      
      // 2. 构建并启动连接池 (在绑定获取完成后通过effect自动触发)
      
    } catch (error: any) {
      debugLog('PREVIEW', '启动IoT绑定失败', error);
    }
  };

  const stopPreviewMode = () => {
    debugLog('PREVIEW', '停止预览模式');
    
    // 停止原有的WebSocket连接
    disconnectWebSockets();
    
    // 停止连接池
    stopConnectionPool();
    
    // 清理服务
    iotAnimationService.cleanup();
    
    // 清理状态
    setIoTBindings([]);
    setConnectionConfigs(new Map());
    setBindingDataCache(new Map());
  };

  // 当IoT绑定和连接配置都获取完成后，构建并启动连接池
  useEffect(() => {
    if (enabled && iotBindings.length > 0 && connectionConfigs.size > 0) {
      debugLog('EFFECT', '检测到IoT绑定和配置已获取，构建并启动连接池');
      
      const initializePool = async () => {
        try {
          await buildConnectionPool();
          await startConnectionPool();
        } catch (error: any) {
          debugLog('EFFECT', '初始化连接池失败', error);
          setConnectionError(`初始化连接池失败: ${error.message}`);
        }
      };
      
      initializePool();
    }
  }, [enabled, iotBindings.length, connectionConfigs.size, buildConnectionPool, startConnectionPool]);

  useEffect(() => {
    if (enabled) {
      startPreviewMode();
    } else {
      stopPreviewMode();
    }

    return () => {
      stopPreviewMode();
    };
  }, [enabled, viewerRef]);

  useEffect(() => {
    return () => {
      disconnectWebSockets();
    };
  }, []);

  return {
    // 原有状态
    isAnimationConnected,
    isIoTConnected,
    connectionError,
    startPreviewMode,
    stopPreviewMode,
    
    // IoT绑定状态
    iotBindings,
    connectionConfigs: Array.from(connectionConfigs.entries()),
    bindingDataCache: Array.from(bindingDataCache.entries()),
    
    // 连接池状态
    poolStatus,
    connectionPool: {
      connections: Array.from(connectionPoolRef.current.connections.entries()),
      bindingGroups: Array.from(connectionPoolRef.current.bindingGroups.entries())
    },
    
    // 调试和管理功能
    debugLog,
    fetchIoTBindings,
    fetchSceneBindings,
    buildConnectionPool,
    startConnectionPool,
    stopConnectionPool,
    
    reconnect: () => {
      if (enabled) {
        debugLog('RECONNECT', '重新连接所有服务');
        
        // 重连原有WebSocket
        disconnectWebSockets();
        setTimeout(() => {
          connectAnimationWebSocket();
          connectIoTWebSocket();
        }, 1000);
        
        // 重连连接池
        stopConnectionPool();
        setTimeout(async () => {
          if (iotBindings.length > 0 && connectionConfigs.size > 0) {
            try {
              await buildConnectionPool();
              await startConnectionPool();
            } catch (error: any) {
              debugLog('RECONNECT', '重连连接池失败', error);
            }
          }
        }, 1500);
      }
    }
  };
};