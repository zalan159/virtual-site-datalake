// types/animation.ts

// GLB动画序列信息
export interface GLBAnimationClip {
  id: string;
  name: string;
  duration: number; // 动画时长（秒）
  startTime: number;
  endTime: number;
}

// 骨骼节点信息
export interface BoneNode {
  id: string;
  name: string;
  translation?: [number, number, number];
  rotation?: [number, number, number, number]; // 四元数
  scale?: [number, number, number];
  children?: BoneNode[];
}

// 动画播放状态
export enum AnimationPlayState {
  STOPPED = 'stopped',
  PLAYING = 'playing',
  PAUSED = 'paused'
}

// 动画播放模式
export enum AnimationPlayMode {
  ONCE = 'once',        // 播放一次
  LOOP = 'loop',        // 循环播放
  PING_PONG = 'pingpong' // 往返播放
}

// 动画触发类型
export enum AnimationTriggerType {
  AUTO = 'auto',        // 自动播放
  MANUAL = 'manual',    // 手动触发
  IOT_EVENT = 'iot_event', // IoT事件触发
  TIME_EVENT = 'time_event' // 时间事件触发
}

// 动画播放控制器状态
export interface AnimationPlayerState {
  currentTime: number;
  totalDuration: number;
  playState: AnimationPlayState;
  playMode: AnimationPlayMode;
  playbackRate: number; // 播放速度
  selectedClipId: string | null;
}

// 动画设置配置
export interface AnimationSettings {
  triggerType: AnimationTriggerType;
  autoPlayClips: string[]; // 自动播放的动画序列ID列表
  playSequentially: boolean; // 是否顺序播放
  randomPlay: boolean; // 是否随机播放
  loopPlayback: boolean; // 是否循环播放
  iotBindings: IoTNodeBinding[]; // IoT数据绑定
}

// IoT数据到骨骼节点的绑定
export interface IoTNodeBinding {
  id: string;
  nodeId: string; // 骨骼节点ID
  iotDataPath: string; // IoT数据路径，如 "mqtt.temperature"
  bindingType: 'translation' | 'rotation' | 'scale';
  mapping: ValueMapping; // 数值映射配置
  interpolation: InterpolationConfig; // 插值配置
}

// 数值映射配置
export interface ValueMapping {
  inputRange: [number, number]; // 输入范围
  outputRange: [number, number]; // 输出范围
  clamp: boolean; // 是否限制在范围内
}

// 插值配置
export interface InterpolationConfig {
  enabled: boolean;
  duration: number; // 插值时间（毫秒）
  easing: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out';
}

// 动画事件触发JSON格式
export interface AnimationEvent {
  type: 'play' | 'pause' | 'stop' | 'seek' | 'node_transform';
  modelId: string; // 场景中GLB对象的ID
  
  // 播放控制相关
  clipId?: string; // 动画序列ID
  time?: number; // 跳转到指定时间
  playMode?: AnimationPlayMode;
  playbackRate?: number;
  
  // 节点变换相关
  nodeId?: string; // 骨骼节点ID
  transform?: {
    translation?: [number, number, number];
    rotation?: [number, number, number, number];
    scale?: [number, number, number];
  };
  
  // 插值配置
  interpolation?: {
    enabled: boolean;
    duration: number; // 插值时间（毫秒）
    easing: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out';
  };
  
  timestamp: number; // 事件时间戳
}

// 动画管理器状态
export interface AnimationManagerState {
  selectedModelId: string | null;
  animations: GLBAnimationClip[];
  boneNodes: BoneNode[];
  playerState: AnimationPlayerState;
  settings: AnimationSettings;
  isLoading: boolean;
}