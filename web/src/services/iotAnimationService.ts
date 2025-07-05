// services/iotAnimationService.ts
import { IoTNodeBinding, ValueMapping } from '../types/animation';
import { animationEventService } from './animationEventService';

/**
 * IoT数据到动画节点绑定服务
 * 负责将IoT数据映射到GLB模型的骨骼节点变换
 */
export class IoTAnimationService {
  private bindings: Map<string, IoTNodeBinding[]> = new Map(); // modelId -> bindings
  private iotDataCache: Map<string, any> = new Map(); // dataPath -> value
  private interpolationTimers: Map<string, NodeJS.Timeout> = new Map();
  private static instance: IoTAnimationService;

  private constructor() {
    this.setupIoTDataListener();
  }

  public static getInstance(): IoTAnimationService {
    if (!IoTAnimationService.instance) {
      IoTAnimationService.instance = new IoTAnimationService();
    }
    return IoTAnimationService.instance;
  }

  /**
   * 添加IoT数据绑定
   * @param modelId 模型ID
   * @param binding 绑定配置
   */
  public addBinding(modelId: string, binding: IoTNodeBinding): void {
    if (!this.bindings.has(modelId)) {
      this.bindings.set(modelId, []);
    }
    this.bindings.get(modelId)!.push(binding);
    console.log(`添加IoT绑定: ${binding.iotDataPath} -> ${binding.nodeId} (${binding.bindingType})`);
  }

  /**
   * 移除IoT数据绑定
   * @param modelId 模型ID
   * @param bindingId 绑定ID
   */
  public removeBinding(modelId: string, bindingId: string): void {
    const bindings = this.bindings.get(modelId);
    if (bindings) {
      const index = bindings.findIndex(b => b.id === bindingId);
      if (index > -1) {
        bindings.splice(index, 1);
        console.log(`移除IoT绑定: ${bindingId}`);
      }
    }
  }

  /**
   * 获取模型的所有绑定
   * @param modelId 模型ID
   */
  public getBindings(modelId: string): IoTNodeBinding[] {
    return this.bindings.get(modelId) || [];
  }

  /**
   * 清除模型的所有绑定
   * @param modelId 模型ID
   */
  public clearBindings(modelId: string): void {
    this.bindings.delete(modelId);
  }

  /**
   * 更新IoT数据
   * @param dataPath 数据路径
   * @param value 新值
   */
  public updateIoTData(dataPath: string, value: any): void {
    const oldValue = this.iotDataCache.get(dataPath);
    this.iotDataCache.set(dataPath, value);

    // 如果值发生变化，触发相关绑定的更新
    if (oldValue !== value) {
      this.processDataUpdate(dataPath, value);
    }
  }

  /**
   * 批量更新IoT数据
   * @param data 数据对象
   */
  public updateIoTDataBatch(data: Record<string, any>): void {
    Object.entries(data).forEach(([path, value]) => {
      this.updateIoTData(path, value);
    });
  }

  /**
   * 获取IoT数据
   * @param dataPath 数据路径
   */
  public getIoTData(dataPath: string): any {
    return this.iotDataCache.get(dataPath);
  }

  /**
   * 处理数据更新
   * @param dataPath 数据路径
   * @param value 新值
   */
  private processDataUpdate(dataPath: string, value: any): void {
    // 遍历所有模型的绑定，查找匹配的绑定
    this.bindings.forEach((bindings, modelId) => {
      bindings.forEach(binding => {
        if (binding.iotDataPath === dataPath) {
          this.applyBinding(modelId, binding, value);
        }
      });
    });
  }

  /**
   * 应用绑定，将IoT数据转换为节点变换
   * @param modelId 模型ID
   * @param binding 绑定配置
   * @param value IoT数据值
   */
  private applyBinding(modelId: string, binding: IoTNodeBinding, value: any): void {
    try {
      // 数值映射
      const mappedValue = this.mapValue(value, binding.mapping);
      
      // 构建变换数据
      const transform: any = {};
      
      switch (binding.bindingType) {
        case 'translation': {
          // 假设映射后的值应用到X轴平移
          transform.translation = [mappedValue, 0, 0];
          break;
        }
        case 'rotation': {
          // 假设映射后的值应用到Z轴旋转（弧度）
          const radians = (mappedValue * Math.PI) / 180;
          transform.rotation = [0, 0, Math.sin(radians/2), Math.cos(radians/2)]; // 四元数
          break;
        }
        case 'scale': {
          // 假设映射后的值应用到统一缩放
          transform.scale = [mappedValue, mappedValue, mappedValue];
          break;
        }
      }

      // 创建节点变换事件
      const event = animationEventService.createNodeTransformEvent(
        modelId,
        binding.nodeId,
        transform,
        binding.interpolation
      );

      // 发送事件
      animationEventService.sendEvent(event);

      console.log(`应用IoT绑定: ${binding.iotDataPath}=${value} -> ${binding.nodeId}.${binding.bindingType}=${mappedValue}`);
    } catch (error) {
      console.error('应用IoT绑定失败:', error);
    }
  }

  /**
   * 数值映射
   * @param value 原始值
   * @param mapping 映射配置
   */
  private mapValue(value: number, mapping: ValueMapping): number {
    const { inputRange, outputRange, clamp } = mapping;
    
    // 线性映射
    const inputMin = inputRange[0];
    const inputMax = inputRange[1];
    const outputMin = outputRange[0];
    const outputMax = outputRange[1];
    
    // 计算映射比例
    const ratio = (value - inputMin) / (inputMax - inputMin);
    let mappedValue = outputMin + ratio * (outputMax - outputMin);
    
    // 限制在输出范围内
    if (clamp) {
      mappedValue = Math.max(outputMin, Math.min(outputMax, mappedValue));
    }
    
    return mappedValue;
  }

  /**
   * 设置IoT数据监听器
   */
  private setupIoTDataListener(): void {
    if (typeof window !== 'undefined') {
      // 监听MQTT消息事件
      window.addEventListener('mqtt-message', (event: any) => {
        if (event.detail && event.detail.topic && event.detail.payload) {
          const dataPath = `mqtt.${event.detail.topic.replace(/\//g, '.')}`;
          this.updateIoTData(dataPath, event.detail.payload);
        }
      });

      // 监听WebSocket IoT数据
      this.setupWebSocketIoTListener();

      // 监听自定义IoT数据事件
      window.addEventListener('iot-data', (event: any) => {
        if (event.detail) {
          this.updateIoTDataBatch(event.detail);
        }
      });
    }
  }

  /**
   * 设置WebSocket IoT监听器
   * WebSocket连接逻辑已移至usePreviewMode hook中，仅在预览模式下才会建立连接
   */
  private setupWebSocketIoTListener(): void {
    // WebSocket连接逻辑已移至usePreviewMode hook中
    // 这里保留空实现，避免破坏现有的事件监听架构
  }

  /**
   * 模拟IoT数据（用于测试）
   */
  public simulateIoTData(): void {
    // 模拟温度传感器数据
    setInterval(() => {
      const temperature = 20 + Math.random() * 10; // 20-30度
      this.updateIoTData('mqtt.sensor.temperature', temperature);
    }, 2000);

    // 模拟压力传感器数据
    setInterval(() => {
      const pressure = 100 + Math.random() * 50; // 100-150 kPa
      this.updateIoTData('mqtt.sensor.pressure', pressure);
    }, 3000);

    // 模拟转速数据
    setInterval(() => {
      const rpm = 1000 + Math.random() * 2000; // 1000-3000 RPM
      this.updateIoTData('mqtt.motor.rpm', rpm);
    }, 1500);
  }

  /**
   * 初始化服务（用于预览模式）
   * @param viewerRef 3D查看器引用
   */
  public initialize(viewerRef: any): void {
    // 这里可以存储viewer引用以便后续使用
    // 当前实现中暂时不需要特殊的初始化逻辑
    console.log('IoT动画服务已初始化');
  }

  /**
   * 清理资源
   */
  public cleanup(): void {
    this.bindings.clear();
    this.iotDataCache.clear();
    this.interpolationTimers.forEach(timer => clearTimeout(timer));
    this.interpolationTimers.clear();
  }
}

// 导出单例实例
export const iotAnimationService = IoTAnimationService.getInstance();