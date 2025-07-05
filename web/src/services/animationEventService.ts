// services/animationEventService.ts
import { AnimationEvent } from '../types/animation';

/**
 * 动画事件服务
 * 负责处理动画事件的发送、接收和转发
 */
export class AnimationEventService {
  private eventListeners: Map<string, ((event: AnimationEvent) => void)[]> = new Map();
  private static instance: AnimationEventService;

  private constructor() {
    // 监听来自外部的动画事件（如IoT系统、时间触发器等）
    this.setupExternalEventListeners();
  }

  public static getInstance(): AnimationEventService {
    if (!AnimationEventService.instance) {
      AnimationEventService.instance = new AnimationEventService();
    }
    return AnimationEventService.instance;
  }

  /**
   * 注册动画事件监听器
   * @param modelId 模型ID
   * @param listener 事件监听函数
   */
  public addEventListener(modelId: string, listener: (event: AnimationEvent) => void): void {
    if (!this.eventListeners.has(modelId)) {
      this.eventListeners.set(modelId, []);
    }
    this.eventListeners.get(modelId)!.push(listener);
  }

  /**
   * 移除动画事件监听器
   * @param modelId 模型ID
   * @param listener 事件监听函数
   */
  public removeEventListener(modelId: string, listener: (event: AnimationEvent) => void): void {
    const listeners = this.eventListeners.get(modelId);
    if (listeners) {
      const index = listeners.indexOf(listener);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  /**
   * 发送动画事件
   * @param event 动画事件
   */
  public sendEvent(event: AnimationEvent): void {
    // 验证事件格式
    if (!this.validateEvent(event)) {
      console.error('无效的动画事件格式:', event);
      return;
    }

    // 添加时间戳
    event.timestamp = Date.now();

    // 通知对应模型的监听器
    const listeners = this.eventListeners.get(event.modelId);
    if (listeners) {
      listeners.forEach(listener => {
        try {
          listener(event);
        } catch (error) {
          console.error('动画事件处理失败:', error);
        }
      });
    }

    // 记录事件日志
    this.logEvent(event);
  }

  /**
   * 创建播放事件
   * @param modelId 模型ID
   * @param clipId 动画序列ID
   * @param playMode 播放模式
   * @param playbackRate 播放速度
   */
  public createPlayEvent(
    modelId: string, 
    clipId?: string, 
    playMode?: string, 
    playbackRate?: number
  ): AnimationEvent {
    return {
      type: 'play',
      modelId,
      clipId,
      playMode: playMode as any,
      playbackRate,
      timestamp: Date.now(),
    };
  }

  /**
   * 创建暂停事件
   * @param modelId 模型ID
   */
  public createPauseEvent(modelId: string): AnimationEvent {
    return {
      type: 'pause',
      modelId,
      timestamp: Date.now(),
    };
  }

  /**
   * 创建停止事件
   * @param modelId 模型ID
   */
  public createStopEvent(modelId: string): AnimationEvent {
    return {
      type: 'stop',
      modelId,
      timestamp: Date.now(),
    };
  }

  /**
   * 创建时间跳转事件
   * @param modelId 模型ID
   * @param time 目标时间（秒）
   */
  public createSeekEvent(modelId: string, time: number): AnimationEvent {
    return {
      type: 'seek',
      modelId,
      time,
      timestamp: Date.now(),
    };
  }

  /**
   * 创建节点变换事件
   * @param modelId 模型ID
   * @param nodeId 节点ID
   * @param transform 变换数据
   * @param interpolation 插值配置
   */
  public createNodeTransformEvent(
    modelId: string,
    nodeId: string,
    transform: {
      translation?: [number, number, number];
      rotation?: [number, number, number, number];
      scale?: [number, number, number];
    },
    interpolation?: {
      enabled: boolean;
      duration: number;
      easing: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out';
    }
  ): AnimationEvent {
    return {
      type: 'node_transform',
      modelId,
      nodeId,
      transform,
      interpolation,
      timestamp: Date.now(),
    };
  }

  /**
   * 解析来自外部系统的JSON事件
   * @param jsonString JSON字符串
   */
  public parseAndSendEvent(jsonString: string): void {
    try {
      const event = JSON.parse(jsonString) as AnimationEvent;
      this.sendEvent(event);
    } catch (error) {
      console.error('解析动画事件JSON失败:', error);
    }
  }

  /**
   * 验证事件格式
   * @param event 动画事件
   */
  private validateEvent(event: AnimationEvent): boolean {
    // 检查必需字段
    if (!event.type || !event.modelId) {
      return false;
    }

    // 检查事件类型
    const validTypes = ['play', 'pause', 'stop', 'seek', 'node_transform'];
    if (!validTypes.includes(event.type)) {
      return false;
    }

    // 特定类型的验证
    switch (event.type) {
      case 'seek':
        return typeof event.time === 'number';
      case 'node_transform':
        return !!event.nodeId && !!event.transform;
      default:
        return true;
    }
  }

  /**
   * 设置外部事件监听器
   */
  private setupExternalEventListeners(): void {
    // 监听来自IoT系统的事件
    if (typeof window !== 'undefined') {
      // 监听自定义事件
      window.addEventListener('animation-event', (event: any) => {
        if (event.detail) {
          this.sendEvent(event.detail);
        }
      });

      // 监听WebSocket消息（如果有IoT WebSocket连接）
      this.setupWebSocketListener();
    }
  }

  /**
   * 设置WebSocket监听器
   * WebSocket连接逻辑已移至usePreviewMode hook中，仅在预览模式下才会建立连接
   */
  private setupWebSocketListener(): void {
    // WebSocket连接逻辑已移至usePreviewMode hook中
    // 这里保留空实现，避免破坏现有的事件监听架构
  }

  /**
   * 记录事件日志
   * @param event 动画事件
   */
  private logEvent(event: AnimationEvent): void {
    if (process.env.NODE_ENV === 'development') {
      console.log(`[动画事件] ${event.type} - ${event.modelId}`, event);
    }
  }

  /**
   * 清理资源
   */
  public cleanup(): void {
    this.eventListeners.clear();
  }
}

// 导出单例实例
export const animationEventService = AnimationEventService.getInstance();