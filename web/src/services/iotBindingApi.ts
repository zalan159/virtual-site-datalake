import api from './axiosConfig';

// IoT协议类型
export enum IoTProtocolType {
  MQTT = "mqtt",
  WEBSOCKET = "websocket", 
  HTTP = "http"
}

// IoT数据类型
export enum IoTDataType {
  TEXT = "text",
  JSON = "json",
  BINARY = "binary",
  IMAGE_BASE64 = "image_base64",
  IMAGE_RGBA = "image_rgba",
  NUMBER = "number",
  BOOLEAN = "boolean"
}

// 绑定通信方向
export enum BindingDirection {
  IOT_TO_INSTANCE = 0,    // IoT -> Instance
  INSTANCE_TO_IOT = 1,    // Instance -> IoT
  BIDIRECTIONAL = 2       // 双向通信
}

// 插值类型
export enum InterpolationType {
  NONE = "none",
  LINEAR = "linear",
  SMOOTH = "smooth",
  STEP = "step"
}

// 触发结果类型
export enum TriggerType {
  ANIMATION = "animation",
  BINDING_ACTIVATION = "binding_activation",
  SCRIPT = "script",
  STATE_CHANGE = "state_change",
  EVENT = "event"
}

// Target路径类型定义
export enum TargetType {
  INSTANCE = "instance",
  NODE = "node", 
  MATERIAL = "material"
}

// Target路径规则：
// instance.{instance property}.{key inside property(if property value is json obj and key exist)}
// node.{nodeId}.{key inside node property(if property value is json obj and key exist)}
// material.{materialId}.{key inside material property(if property value is json obj and key exist)}
export interface TargetPath {
  type: TargetType;
  id: string; // instance property name / nodeId / materialId
  property?: string; // key inside the property if it's a json object
  fullPath: string; // 完整路径字符串
}

// 接口定义
export interface ValueMapping {
  inputMin: number;
  inputMax: number;
  outputMin: number;
  outputMax: number;
  clamp: boolean;
}

export interface InterpolationConfig {
  type: InterpolationType;
  duration: number;
  easing?: string;
}

export interface BindingCondition {
  field: string;
  operator: "eq" | "ne" | "gt" | "lt" | "gte" | "lte" | "in" | "contains";
  value: any;
}

export interface TriggerResult {
  type: TriggerType;
  target?: string;
  params?: { [key: string]: any };
  delay?: number;
}

export interface NodeBinding {
  nodeName: string;
  nodeIndex?: number;
  bindingType: "translation" | "rotation" | "scale" | "morph_weights";
  axis?: "x" | "y" | "z" | "all";
}

export interface HTTPConfig {
  method: "GET" | "POST" | "PUT" | "DELETE";
  headers?: { [key: string]: string };
  body?: { [key: string]: any };
  pollInterval?: number;
  timeout: number;
}

export interface IoTBinding {
  id: string;
  name?: string;
  enabled: boolean;
  protocol: IoTProtocolType;
  dataType: IoTDataType;
  sourceId: string;
  bindings: { [key: string]: any }[];
  nodeBindings?: NodeBinding[];
  valueMapping?: ValueMapping;
  interpolation?: InterpolationConfig;
  conditions?: BindingCondition[];
  triggerResults?: TriggerResult[];
  httpConfig?: HTTPConfig;
  updateInterval?: number;
  transform?: string;
  metadata?: { [key: string]: any };
  // Target路径规则说明
  targetPathRules?: {
    instance: string; // "instance.{instance property}.{key inside property(if property value is json obj and key exist)}"
    node: string; // "node.{nodeId}.{key inside node property(if property value is json obj and key exist)}"
    material: string; // "material.{materialId}.{key inside material property(if property value is json obj and key exist)}"
  };
}

export interface IoTBindingWithInstance extends IoTBinding {
  instanceId: string;
  instanceName?: string;
}

export interface IoTBindingCreate {
  name?: string;
  enabled?: boolean;
  protocol: IoTProtocolType;
  dataType: IoTDataType;
  sourceId: string;
  bindings?: { [key: string]: any }[];
  nodeBindings?: NodeBinding[];
  valueMapping?: ValueMapping;
  interpolation?: InterpolationConfig;
  conditions?: BindingCondition[];
  triggerResults?: TriggerResult[];
  httpConfig?: HTTPConfig;
  updateInterval?: number;
  transform?: string;
  metadata?: { [key: string]: any };
}

export interface IoTBindingUpdate {
  name?: string;
  enabled?: boolean;
  protocol?: IoTProtocolType;
  dataType?: IoTDataType;
  sourceId?: string;
  bindings?: { [key: string]: any }[];
  nodeBindings?: NodeBinding[];
  valueMapping?: ValueMapping;
  interpolation?: InterpolationConfig;
  conditions?: BindingCondition[];
  triggerResults?: TriggerResult[];
  httpConfig?: HTTPConfig;
  updateInterval?: number;
  transform?: string;
  metadata?: { [key: string]: any };
}

export interface IoTBindingValidation {
  binding: IoTBinding;
  testData?: { [key: string]: any };
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface TestResult {
  success: boolean;
  processedData?: any;
  appliedMappings?: any[];
  triggeredResults?: any[];
  error?: string;
}

// 连接配置相关接口
export interface ConnectionInfo {
  id: string;
  protocol: string;
  name: string;
  description?: string;
  hostname?: string;
  port?: number;
  url?: string;
  base_url?: string;
  is_public: boolean;
  tags: string[];
  created_at: string;
  updated_at: string;
}

export interface ProtocolStats {
  mqtt: { total: number; public: number };
  websocket: { total: number; public: number };
  http: { total: number; public: number };
  summary: {
    total_connections: number;
    total_public: number;
    supported_protocols: string[];
  };
}

// API 方法
export const iotBindingAPI = {
  // 获取场景中所有实例的IoT绑定列表（新增）
  getSceneBindings: (sceneId: string) =>
    api.get<IoTBindingWithInstance[]>(`/scenes/${sceneId}/iot-bindings/all`),

  // 获取场景实例的IoT绑定列表
  getInstanceBindings: (sceneId: string, instanceId: string) =>
    api.get<IoTBinding[]>(`/scenes/${sceneId}/instances/${instanceId}/iot-bindings`),

  // 创建场景实例的IoT绑定
  createInstanceBinding: (sceneId: string, instanceId: string, data: IoTBindingCreate) =>
    api.post<IoTBinding>(`/scenes/${sceneId}/instances/${instanceId}/iot-bindings`, data),

  // 更新场景实例的IoT绑定
  updateInstanceBinding: (sceneId: string, instanceId: string, bindingId: string, data: IoTBindingUpdate) =>
    api.put<IoTBinding>(`/scenes/${sceneId}/instances/${instanceId}/iot-bindings/${bindingId}`, data),

  // 删除场景实例的IoT绑定
  deleteInstanceBinding: (sceneId: string, instanceId: string, bindingId: string) =>
    api.delete(`/scenes/${sceneId}/instances/${instanceId}/iot-bindings/${bindingId}`),

  // 批量创建IoT绑定
  batchCreateBindings: (sceneId: string, instanceId: string, bindings: IoTBindingCreate[]) =>
    api.post<IoTBinding[]>(`/scenes/${sceneId}/instances/${instanceId}/iot-bindings/batch`, { bindings }),

  // 验证IoT绑定配置
  validateBinding: (validationData: IoTBindingValidation) =>
    api.post<ValidationResult>('/iot-bindings/validate', validationData),

  // 测试IoT绑定配置
  testBinding: (testData: { binding: IoTBinding; sampleData?: any }) =>
    api.post<TestResult>('/iot-bindings/test', testData),

  // 获取实时数据（前端驱动）
  getRealtimeData: (bindingId: string) =>
    api.get(`/iot-bindings/${bindingId}/data/realtime`),

  // 获取历史数据
  getHistoryData: (bindingId: string) =>
    api.get(`/iot-bindings/${bindingId}/data/history`),

  // 发送命令（双向通信）
  sendCommand: (bindingId: string, command: any) =>
    api.post(`/iot-bindings/${bindingId}/command`, command),
    
  // 连接配置管理API
  // 获取所有连接配置
  getAllConnections: (protocol?: string, search?: string, skip = 0, limit = 50) =>
    api.get<ConnectionInfo[]>('/iot/connections', { params: { protocol, search, skip, limit } }),

  // 根据ID获取连接配置
  getConnectionById: (connectionId: string) =>
    api.get<ConnectionInfo>(`/iot/connections/${connectionId}`),

  // 获取协议统计信息
  getProtocolStats: () =>
    api.get<ProtocolStats>('/iot/connections/protocols/stats'),

  // 获取所有标签
  getTags: () =>
    api.get<string[]>('/iot/connections/tags'),

  // 测试连接配置
  testConnection: (connectionId: string) =>
    api.post(`/iot/connections/${connectionId}/test`),

  // Target路径解析工具
  parseTargetPath: (targetPath: string): TargetPath | null => {
    const parts = targetPath.split('.');
    if (parts.length < 2) return null;
    
    const type = parts[0] as TargetType;
    const id = parts[1];
    const property = parts.length > 2 ? parts.slice(2).join('.') : undefined;
    
    if (!Object.values(TargetType).includes(type)) return null;
    
    return {
      type,
      id,
      property,
      fullPath: targetPath
    };
  },

  // 构建 Target路径
  buildTargetPath: (type: TargetType, id: string, property?: string): string => {
    let path = `${type}.${id}`;
    if (property) {
      path += `.${property}`;
    }
    return path;
  },

  // 验证Target路径格式
  validateTargetPath: (targetPath: string): boolean => {
    const parsed = iotBindingAPI.parseTargetPath(targetPath);
    return parsed !== null;
  },
}; 