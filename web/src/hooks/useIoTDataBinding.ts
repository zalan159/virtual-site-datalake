/**
 * 统一IoT数据绑定管理器
 * 支持MQTT、WebSocket、HTTP所有协议和数据类型的绑定处理
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { message } from 'antd';
import { useMQTTConnection } from './useMQTTConnection';
import { useWebSocketConnection } from './useWebSocketConnection';
import { useHTTPRequest } from './useHTTPRequest';
import { 
  IoTDataProcessor, 
  DataBindingProcessor, 
  ProcessedData,
  JSONPathParser,
  ValueMapper,
  InterpolationEngine,
  ValueMapping,
  InterpolationConfig,
  BindingCondition,
  TriggerResult
} from '../utils/iotDataProcessor';
import { ConditionEngine, TriggerContext, ConditionContext } from '../utils/conditionEngine';
import { 
  IoTBinding, 
  IoTProtocolType, 
  IoTDataType, 
  BindingDirection,
  HTTPConfig 
} from '../services/iotBindingApi';

export interface IoTDataUpdate {
  bindingId: string;
  sourceData: any;
  processedData: ProcessedData;
  timestamp: string;
  protocol: IoTProtocolType;
  dataType: IoTDataType;
}

export interface UseIoTDataBindingOptions {
  onDataUpdate?: (update: IoTDataUpdate) => void;
  onBindingError?: (bindingId: string, error: string) => void;
  onConnectionChange?: (protocol: IoTProtocolType, connected: boolean) => void;
}

export interface UseIoTDataBindingReturn {
  // 绑定管理
  addBinding: (binding: IoTBinding, connectionConfig: any) => Promise<boolean>;
  removeBinding: (bindingId: string) => void;
  updateBinding: (bindingId: string, binding: Partial<IoTBinding>) => void;
  getBinding: (bindingId: string) => IoTBinding | undefined;
  getAllBindings: () => IoTBinding[];
  
  // 连接管理
  connectProtocol: (protocol: IoTProtocolType, config: any) => void;
  disconnectProtocol: (protocol: IoTProtocolType) => void;
  isProtocolConnected: (protocol: IoTProtocolType) => boolean;
  
  // 数据处理
  processBindingData: (bindingId: string, sourceData: any) => ProcessedData | null;
  extractBindingValue: (binding: IoTBinding, sourceData: any) => any;
  applyValueMapping: (binding: IoTBinding, value: any) => any;
  
  // 新增：高级数据处理
  extractValueWithJSONPath: (data: any, path: string) => any;
  applyAdvancedValueMapping: (value: number, mapping: ValueMapping) => number;
  createInterpolatedTransition: (from: any, to: any, config: InterpolationConfig, onUpdate: (value: any) => void) => { cancel: () => void };
  
  // 新增：条件和触发
  evaluateConditions: (conditions: BindingCondition[], context: ConditionContext) => boolean;
  executeTriggers: (triggers: TriggerResult[], sceneId: string, instanceId: string) => Promise<void>;
  
  // 新增：路径建议和验证
  suggestDataPaths: (sampleData: any) => Array<{path: string, type: string, sample: any}>;
  validateDataPath: (data: any, path: string) => { valid: boolean; value?: any; suggestions?: string[] };
  
  // 状态信息
  activeBindings: IoTBinding[];
  connectionStatus: Record<IoTProtocolType, boolean>;
  lastDataUpdates: Record<string, IoTDataUpdate>;
  errorStates: Record<string, string>;
  
  // 新增：绑定数据历史
  bindingDataHistory: Record<string, any[]>;
  conditionStates: Record<string, boolean>;
}

export const useIoTDataBinding = (options: UseIoTDataBindingOptions = {}): UseIoTDataBindingReturn => {
  const { onDataUpdate, onBindingError, onConnectionChange } = options;

  // 状态管理
  const [activeBindings, setActiveBindings] = useState<IoTBinding[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<Record<IoTProtocolType, boolean>>({
    [IoTProtocolType.MQTT]: false,
    [IoTProtocolType.WEBSOCKET]: false,
    [IoTProtocolType.HTTP]: false,
  });
  const [lastDataUpdates, setLastDataUpdates] = useState<Record<string, IoTDataUpdate>>({});
  const [errorStates, setErrorStates] = useState<Record<string, string>>({});
  
  // 新增：高级状态管理
  const [bindingDataHistory, setBindingDataHistory] = useState<Record<string, any[]>>({});
  const [conditionStates, setConditionStates] = useState<Record<string, boolean>>({});

  // 连接配置存储
  const connectionConfigsRef = useRef<Record<string, any>>({});
  const pollingIntervalsRef = useRef<Record<string, NodeJS.Timeout>>({});
  
  // 新增：插值过渡控制器存储
  const transitionControllersRef = useRef<Record<string, { cancel: () => void }>>({});
  
  // 新增：绑定数据历史大小限制
  const maxHistorySize = 50;

  // 协议连接hooks
  const mqttConnection = useMQTTConnection({
    hostname: '',
    port: 1883,
  });

  const wsConnection = useWebSocketConnection({
    url: '',
  });

  const httpRequest = useHTTPRequest();

  // 监听连接状态变化
  useEffect(() => {
    const newStatus = {
      [IoTProtocolType.MQTT]: mqttConnection.isConnected,
      [IoTProtocolType.WEBSOCKET]: wsConnection.isConnected,
      [IoTProtocolType.HTTP]: !httpRequest.error, // HTTP没有持久连接，以无错误状态为准
    };

    setConnectionStatus(prev => {
      // 检查是否有变化
      const hasChanged = Object.keys(newStatus).some(
        protocol => newStatus[protocol as IoTProtocolType] !== prev[protocol as IoTProtocolType]
      );

      if (hasChanged) {
        Object.keys(newStatus).forEach(protocol => {
          const protocolType = protocol as IoTProtocolType;
          if (newStatus[protocolType] !== prev[protocolType]) {
            onConnectionChange?.(protocolType, newStatus[protocolType]);
          }
        });
      }

      return newStatus;
    });
  }, [mqttConnection.isConnected, wsConnection.isConnected, httpRequest.error, onConnectionChange]);

  // 监听MQTT消息
  useEffect(() => {
    if (mqttConnection.messages.length > 0) {
      const latestMessage = mqttConnection.messages[mqttConnection.messages.length - 1];
      if (latestMessage.direction === 'received' && latestMessage.processedData) {
        handleIncomingData(IoTProtocolType.MQTT, latestMessage.topic, latestMessage.processedData);
      }
    }
  }, [mqttConnection.messages]);

  // 监听WebSocket消息
  useEffect(() => {
    if (wsConnection.messages.length > 0) {
      const latestMessage = wsConnection.messages[wsConnection.messages.length - 1];
      if (latestMessage.direction === 'received' && latestMessage.processedData) {
        handleIncomingData(IoTProtocolType.WEBSOCKET, 'websocket', latestMessage.processedData);
      }
    }
  }, [wsConnection.messages]);

  // 监听HTTP响应
  useEffect(() => {
    if (httpRequest.lastResponse?.processedData) {
      handleIncomingData(IoTProtocolType.HTTP, httpRequest.lastResponse.url, httpRequest.lastResponse.processedData);
    }
  }, [httpRequest.lastResponse]);

  // 处理接收到的数据 (增强版)
  const handleIncomingData = useCallback(async (protocol: IoTProtocolType, source: string, processedData: ProcessedData) => {
    // 查找匹配的绑定
    const matchingBindings = activeBindings.filter(binding => {
      if (binding.protocol !== protocol) return false;
      if (!binding.enabled) return false;
      
      // 根据协议类型匹配数据源
      switch (protocol) {
        case IoTProtocolType.MQTT:
          return binding.bindings.some(b => source.includes(b.source) || b.source.includes(source));
        case IoTProtocolType.WEBSOCKET:
        case IoTProtocolType.HTTP:
          return true; // WebSocket和HTTP通常只有一个数据源
        default:
          return false;
      }
    });

    // 处理匹配的绑定
    for (const binding of matchingBindings) {
      try {
        // 获取历史数据用于条件评估
        const previousData = bindingDataHistory[binding.id]?.[bindingDataHistory[binding.id].length - 1];
        
        // 使用JSON路径解析器提取数据
        let extractedValue = processedData.data;
        if (binding.bindings.length > 0 && binding.bindings[0].source) {
          extractedValue = JSONPathParser.extractValue(processedData.data, binding.bindings[0].source);
        }

        // 应用高级数值映射
        let mappedValue = extractedValue;
        if (binding.valueMapping && typeof extractedValue === 'number') {
          mappedValue = ValueMapper.map(extractedValue, binding.valueMapping);
        }

        // 更新数据历史
        setBindingDataHistory(prev => {
          const history = prev[binding.id] || [];
          const newHistory = [...history, mappedValue];
          if (newHistory.length > maxHistorySize) {
            newHistory.shift();
          }
          return { ...prev, [binding.id]: newHistory };
        });

        // 评估条件触发
        if (binding.conditions && binding.conditions.length > 0) {
          const conditionContext: ConditionContext = {
            currentValue: mappedValue,
            previousValue: previousData,
            timestamp: Date.now(),
            metadata: { bindingId: binding.id, protocol, source }
          };

          const conditionResult = ConditionEngine.evaluateConditions(
            binding.conditions, 
            conditionContext, 
            'and' // 默认使用AND逻辑
          );

          // 更新条件状态
          setConditionStates(prev => ({
            ...prev,
            [binding.id]: conditionResult.satisfied
          }));

          // 执行触发器
          if (conditionResult.satisfied && binding.triggerResults && binding.triggerResults.length > 0) {
            await executeTriggersForBinding(binding, binding.triggerResults);
          }
        }

        // 应用插值过渡（如果配置了）
        if (binding.interpolation && binding.interpolation.enabled && previousData !== undefined) {
          // 取消现有的过渡
          if (transitionControllersRef.current[binding.id]) {
            transitionControllersRef.current[binding.id].cancel();
          }

          // 创建新的过渡
          const controller = InterpolationEngine.createTransition(
            previousData,
            mappedValue,
            binding.interpolation,
            (interpolatedValue) => {
              // 在过渡过程中更新数据
              const interpolatedUpdate: IoTDataUpdate = {
                bindingId: binding.id,
                sourceData: processedData.originalData,
                processedData: {
                  ...processedData,
                  data: interpolatedValue
                },
                timestamp: new Date().toISOString(),
                protocol,
                dataType: binding.dataType,
              };
              onDataUpdate?.(interpolatedUpdate);
            },
            () => {
              // 过渡完成，清理控制器
              delete transitionControllersRef.current[binding.id];
            }
          );

          transitionControllersRef.current[binding.id] = controller;
        } else {
          // 直接更新数据
          const dataUpdate: IoTDataUpdate = {
            bindingId: binding.id,
            sourceData: processedData.originalData,
            processedData: {
              ...processedData,
              data: mappedValue
            },
            timestamp: new Date().toISOString(),
            protocol,
            dataType: binding.dataType,
          };

          setLastDataUpdates(prev => ({
            ...prev,
            [binding.id]: dataUpdate,
          }));

          onDataUpdate?.(dataUpdate);
        }

        // 清除错误状态
        setErrorStates(prev => {
          const newErrors = { ...prev };
          delete newErrors[binding.id];
          return newErrors;
        });

      } catch (error: any) {
        const errorMessage = `绑定处理失败: ${error.message}`;
        setErrorStates(prev => ({
          ...prev,
          [binding.id]: errorMessage,
        }));
        onBindingError?.(binding.id, errorMessage);
      }
    }
  }, [activeBindings, bindingDataHistory, onDataUpdate, onBindingError, maxHistorySize]);

  // 为绑定执行触发器
  const executeTriggersForBinding = useCallback(async (binding: IoTBinding, triggers: TriggerResult[]) => {
    const triggerContext: TriggerContext = {
      sceneId: '', // 这里需要从外部传入
      instanceId: '', // 这里需要从外部传入
      bindingId: binding.id,
      setModelProperty: async (target: string, value: any) => {
        console.log(`设置模型属性: ${target} = `, value);
        // 这里需要集成3D模型操作接口
      },
      sendIoTCommand: async (protocol: string, target: string, value: any) => {
        console.log(`发送IoT命令: ${protocol}:${target} = `, value);
        // 这里需要集成IoT命令发送接口
      },
      playAnimation: async (target: string, params: any) => {
        console.log(`播放动画: ${target}`, params);
        // 这里需要集成动画播放接口
      },
      showAlert: (message: string, type = 'info') => {
        message[type](message);
      },
      callFunction: async (functionName: string, params: any) => {
        console.log(`调用函数: ${functionName}`, params);
        // 这里可以实现自定义函数调用
      },
      setState: (key: string, value: any) => {
        console.log(`设置状态: ${key} = `, value);
        // 这里可以设置全局状态或本地存储
      },
      getState: (key: string) => {
        console.log(`获取状态: ${key}`);
        return null; // 这里可以从全局状态或本地存储获取
      }
    };

    await ConditionEngine.executeTriggers(triggers, triggerContext);
  }, []);

  // 添加绑定
  const addBinding = useCallback(async (binding: IoTBinding, connectionConfig: any): Promise<boolean> => {
    try {
      // 验证绑定配置
      if (!binding.id || !binding.protocol || !binding.dataType) {
        throw new Error('绑定配置不完整');
      }

      // 存储连接配置
      connectionConfigsRef.current[binding.sourceId] = connectionConfig;

      // 添加到活动绑定列表
      setActiveBindings(prev => {
        const existing = prev.find(b => b.id === binding.id);
        if (existing) {
          // 更新现有绑定
          return prev.map(b => b.id === binding.id ? binding : b);
        } else {
          // 添加新绑定
          return [...prev, binding];
        }
      });

      // 根据协议类型建立连接
      await connectProtocol(binding.protocol, connectionConfig);

      // 为HTTP协议设置轮询
      if (binding.protocol === IoTProtocolType.HTTP && binding.httpConfig?.pollInterval) {
        setupHttpPolling(binding, connectionConfig);
      }

      console.log(`已添加${binding.protocol}绑定:`, binding.id);
      return true;
    } catch (error: any) {
      onBindingError?.(binding.id, `添加绑定失败: ${error.message}`);
      return false;
    }
  }, [onBindingError]);

  // 设置HTTP轮询
  const setupHttpPolling = useCallback((binding: IoTBinding, connectionConfig: any) => {
    if (!binding.httpConfig?.pollInterval || binding.httpConfig.pollInterval <= 0) {
      return;
    }

    // 清除现有的轮询
    if (pollingIntervalsRef.current[binding.id]) {
      clearInterval(pollingIntervalsRef.current[binding.id]);
    }

    // 设置新的轮询
    const pollOptions = {
      ...connectionConfig,
      poll_interval: binding.httpConfig.pollInterval,
      data_type: binding.dataType,
    };

    httpRequest.startPolling(pollOptions);

    console.log(`已设置HTTP轮询，间隔: ${binding.httpConfig.pollInterval}秒`);
  }, [httpRequest]);

  // 移除绑定
  const removeBinding = useCallback((bindingId: string) => {
    setActiveBindings(prev => prev.filter(b => b.id !== bindingId));
    
    // 清除轮询
    if (pollingIntervalsRef.current[bindingId]) {
      clearInterval(pollingIntervalsRef.current[bindingId]);
      delete pollingIntervalsRef.current[bindingId];
    }

    // 清除数据更新和错误状态
    setLastDataUpdates(prev => {
      const newUpdates = { ...prev };
      delete newUpdates[bindingId];
      return newUpdates;
    });

    setErrorStates(prev => {
      const newErrors = { ...prev };
      delete newErrors[bindingId];
      return newErrors;
    });

    console.log('已移除绑定:', bindingId);
  }, []);

  // 更新绑定
  const updateBinding = useCallback((bindingId: string, updates: Partial<IoTBinding>) => {
    setActiveBindings(prev => prev.map(binding => 
      binding.id === bindingId ? { ...binding, ...updates } : binding
    ));
  }, []);

  // 获取绑定
  const getBinding = useCallback((bindingId: string): IoTBinding | undefined => {
    return activeBindings.find(b => b.id === bindingId);
  }, [activeBindings]);

  // 获取所有绑定
  const getAllBindings = useCallback((): IoTBinding[] => {
    return [...activeBindings];
  }, [activeBindings]);

  // 连接协议
  const connectProtocol = useCallback(async (protocol: IoTProtocolType, config: any): Promise<void> => {
    try {
      switch (protocol) {
        case IoTProtocolType.MQTT:
          if (!mqttConnection.isConnected) {
            // 需要重新初始化MQTT连接配置
            // 这里可能需要重新创建useMQTTConnection实例
            mqttConnection.connect();
          }
          break;
        case IoTProtocolType.WEBSOCKET:
          if (!wsConnection.isConnected) {
            wsConnection.connect();
          }
          break;
        case IoTProtocolType.HTTP:
          // HTTP无需持久连接，每次请求时建立
          break;
      }
    } catch (error: any) {
      throw new Error(`连接${protocol}失败: ${error.message}`);
    }
  }, [mqttConnection, wsConnection]);

  // 断开协议连接
  const disconnectProtocol = useCallback((protocol: IoTProtocolType) => {
    switch (protocol) {
      case IoTProtocolType.MQTT:
        mqttConnection.disconnect();
        break;
      case IoTProtocolType.WEBSOCKET:
        wsConnection.disconnect();
        break;
      case IoTProtocolType.HTTP:
        httpRequest.stopPolling();
        break;
    }
  }, [mqttConnection, wsConnection, httpRequest]);

  // 检查协议连接状态
  const isProtocolConnected = useCallback((protocol: IoTProtocolType): boolean => {
    return connectionStatus[protocol];
  }, [connectionStatus]);

  // 处理绑定数据
  const processBindingData = useCallback((bindingId: string, sourceData: any): ProcessedData | null => {
    const binding = getBinding(bindingId);
    if (!binding) {
      return null;
    }

    try {
      return IoTDataProcessor.processData(sourceData, binding.dataType);
    } catch (error: any) {
      onBindingError?.(bindingId, `数据处理失败: ${error.message}`);
      return null;
    }
  }, [getBinding, onBindingError]);

  // 提取绑定值
  const extractBindingValue = useCallback((binding: IoTBinding, sourceData: any): any => {
    try {
      // 处理数据类型转换
      const processedData = IoTDataProcessor.processData(sourceData, binding.dataType);
      
      if (!processedData.success) {
        throw new Error(processedData.error || '数据处理失败');
      }

      // 应用绑定路径提取
      if (binding.bindings.length > 0) {
        const firstBinding = binding.bindings[0];
        if (firstBinding.source) {
          return DataBindingProcessor.extractValue(processedData.data, firstBinding.source);
        }
      }

      return processedData.data;
    } catch (error: any) {
      console.error('提取绑定值失败:', error);
      return undefined;
    }
  }, []);

  // 应用值映射
  const applyValueMapping = useCallback((binding: IoTBinding, value: any): any => {
    if (!binding.valueMapping || typeof value !== 'number') {
      return value;
    }

    const { inputMin, inputMax, outputMin, outputMax, clamp } = binding.valueMapping;
    
    // 线性映射
    const ratio = (value - inputMin) / (inputMax - inputMin);
    let mappedValue = outputMin + ratio * (outputMax - outputMin);
    
    // 限制在输出范围内
    if (clamp) {
      mappedValue = Math.max(outputMin, Math.min(outputMax, mappedValue));
    }
    
    return mappedValue;
  }, []);

  // 新增：使用JSON路径提取值
  const extractValueWithJSONPath = useCallback((data: any, path: string): any => {
    return JSONPathParser.extractValue(data, path);
  }, []);

  // 新增：应用高级数值映射
  const applyAdvancedValueMapping = useCallback((value: number, mapping: ValueMapping): number => {
    return ValueMapper.map(value, mapping);
  }, []);

  // 新增：创建插值过渡
  const createInterpolatedTransition = useCallback((
    from: any, 
    to: any, 
    config: InterpolationConfig, 
    onUpdate: (value: any) => void
  ): { cancel: () => void } => {
    return InterpolationEngine.createTransition(from, to, config, onUpdate);
  }, []);

  // 新增：评估条件
  const evaluateConditions = useCallback((
    conditions: BindingCondition[], 
    context: ConditionContext
  ): boolean => {
    const result = ConditionEngine.evaluateConditions(conditions, context, 'and');
    return result.satisfied;
  }, []);

  // 新增：执行触发器
  const executeTriggers = useCallback(async (
    triggers: TriggerResult[], 
    sceneId: string, 
    instanceId: string
  ): Promise<void> => {
    const triggerContext: TriggerContext = {
      sceneId,
      instanceId,
      bindingId: '',
      setModelProperty: async (target: string, value: any) => {
        console.log(`设置模型属性: ${target} = `, value);
        // 这里需要集成实际的3D模型操作接口
      },
      sendIoTCommand: async (protocol: string, target: string, value: any) => {
        console.log(`发送IoT命令: ${protocol}:${target} = `, value);
        // 这里需要集成实际的IoT命令发送接口
      },
      playAnimation: async (target: string, params: any) => {
        console.log(`播放动画: ${target}`, params);
      },
      showAlert: (message: string, type = 'info') => {
        message[type](message);
      },
      callFunction: async (functionName: string, params: any) => {
        console.log(`调用函数: ${functionName}`, params);
      },
      setState: (key: string, value: any) => {
        console.log(`设置状态: ${key} = `, value);
      },
      getState: (key: string) => {
        return null;
      }
    };

    await ConditionEngine.executeTriggers(triggers, triggerContext);
  }, []);

  // 新增：建议数据路径
  const suggestDataPaths = useCallback((sampleData: any): Array<{path: string, type: string, sample: any}> => {
    return DataBindingProcessor.suggestDataPaths(sampleData);
  }, []);

  // 新增：验证数据路径
  const validateDataPath = useCallback((data: any, path: string): { valid: boolean; value?: any; suggestions?: string[] } => {
    const result = DataBindingProcessor.validatePath(data, path);
    return {
      valid: result.valid,
      value: result.value,
      suggestions: result.suggestions
    };
  }, []);

  // 清理资源
  useEffect(() => {
    return () => {
      // 清理所有轮询
      Object.values(pollingIntervalsRef.current).forEach(interval => {
        clearInterval(interval);
      });
      
      // 清理所有插值过渡
      Object.values(transitionControllersRef.current).forEach(controller => {
        controller.cancel();
      });
      
      // 清理条件历史记录
      ConditionEngine.clearConditionHistory();
      
      // 断开所有连接
      mqttConnection.disconnect();
      wsConnection.disconnect();
      httpRequest.stopPolling();
    };
  }, [mqttConnection, wsConnection, httpRequest]);

  return {
    addBinding,
    removeBinding,
    updateBinding,
    getBinding,
    getAllBindings,
    connectProtocol,
    disconnectProtocol,
    isProtocolConnected,
    processBindingData,
    extractBindingValue,
    applyValueMapping,
    
    // 新增：高级数据处理
    extractValueWithJSONPath,
    applyAdvancedValueMapping,
    createInterpolatedTransition,
    
    // 新增：条件和触发
    evaluateConditions,
    executeTriggers,
    
    // 新增：路径建议和验证
    suggestDataPaths,
    validateDataPath,
    
    // 状态信息
    activeBindings,
    connectionStatus,
    lastDataUpdates,
    errorStates,
    
    // 新增：绑定数据历史
    bindingDataHistory,
    conditionStates,
  };
};