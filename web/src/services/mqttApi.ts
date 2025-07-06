import api from './axiosConfig';

export interface MQTTBase {
  name: string;
  description?: string;
  metadata?: any;
  tags: string[];
  is_public: boolean;
  hostname: string;
  port: number;
  websocket_path: string;
  topics: string[];
}

export interface MQTTCreate extends MQTTBase {
  client_id?: string;
  keep_alive?: number;
  clean_session?: boolean;
  auth_type?: string;
  username?: string;
  password?: string;
  ca_cert?: string;
  client_cert?: string;
  client_key?: string;
  use_tls?: boolean;
  tls_insecure?: boolean;
  default_qos?: number;
  connection_timeout?: number;
  max_retries?: number;
  retry_delay?: number;
  max_inflight_messages?: number;
  max_queued_messages?: number;
}

export interface MQTTDataSource extends MQTTBase {
  id: string;
  _id: string;
  created_at: string;
  updated_at: string;
  client_id?: string;
  keep_alive?: number;
  clean_session?: boolean;
  auth_type?: string;
  username?: string;
  password?: string;
  ca_cert?: string;
  client_cert?: string;
  client_key?: string;
  use_tls?: boolean;
  tls_insecure?: boolean;
  default_qos?: number;
  connection_timeout?: number;
  max_retries?: number;
  retry_delay?: number;
  max_inflight_messages?: number;
  max_queued_messages?: number;
}

export interface MQTTUpdate {
  name?: string;
  description?: string;
  metadata?: any;
  tags?: string[];
  is_public?: boolean;
  hostname?: string;
  port?: number;
  websocket_path?: string;
  topics?: string[];
  client_id?: string;
  keep_alive?: number;
  clean_session?: boolean;
  auth_type?: string;
  username?: string;
  password?: string;
  ca_cert?: string;
  client_cert?: string;
  client_key?: string;
  use_tls?: boolean;
  tls_insecure?: boolean;
  default_qos?: number;
  connection_timeout?: number;
  max_retries?: number;
  retry_delay?: number;
  max_inflight_messages?: number;
  max_queued_messages?: number;
}

export interface MQTTTestResult {
  config_id: string;
  connection_test: string;
  validation: {
    valid: boolean;
    errors: string[];
    warnings: string[];
  };
  message: string;
}

export const mqttAPI = {
  // 获取MQTT配置列表
  getMQTTList: (skip: number = 0, limit: number = 20) => 
    api.get<MQTTDataSource[]>('/mqtt/', { params: { skip, limit } }),

  // 根据ID获取MQTT配置
  getMQTTById: (id: string) => 
    api.get<MQTTDataSource>(`/mqtt/${id}`),

  // 创建MQTT配置
  createMQTT: (data: MQTTCreate) => 
    api.post<MQTTDataSource>('/mqtt/', data),

  // 更新MQTT配置
  updateMQTT: (id: string, data: MQTTUpdate) => 
    api.put<MQTTDataSource>(`/mqtt/${id}`, data),

  // 删除MQTT配置
  deleteMQTT: (id: string) => 
    api.delete(`/mqtt/${id}`),

  // 测试MQTT连接
  testMQTT: (id: string) => 
    api.post<MQTTTestResult>(`/mqtt/${id}/test`),
}; 