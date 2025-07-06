import api from './axiosConfig';

export interface HTTPBase {
  name: string;
  description?: string;
  metadata?: any;
  tags: string[];
  is_public: boolean;
  base_url: string;
}

export interface HTTPCreate extends HTTPBase {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: Record<string, string>;
  default_params?: Record<string, string>;
  auth_type?: string;
  auth_username?: string;
  auth_password?: string;
  auth_token?: string;
  api_key?: string;
  api_key_header?: string;
  oauth2_client_id?: string;
  oauth2_client_secret?: string;
  oauth2_token_url?: string;
  oauth2_scope?: string;
  verify_ssl?: boolean;
  ca_cert?: string;
  client_cert?: string;
  client_key?: string;
  timeout?: number;
  max_retries?: number;
  retry_delay?: number;
  poll_interval?: number;
  poll_enabled?: boolean;
  response_format?: string;
  json_path?: string;
  encoding?: string;
}

export interface HTTPDataSource extends HTTPBase {
  id: string;
  _id: string;
  created_at: string;
  updated_at: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: Record<string, string>;
  default_params?: Record<string, string>;
  auth_type?: string;
  auth_username?: string;
  auth_password?: string;
  auth_token?: string;
  api_key?: string;
  api_key_header?: string;
  oauth2_client_id?: string;
  oauth2_client_secret?: string;
  oauth2_token_url?: string;
  oauth2_scope?: string;
  verify_ssl?: boolean;
  ca_cert?: string;
  client_cert?: string;
  client_key?: string;
  timeout?: number;
  max_retries?: number;
  retry_delay?: number;
  poll_interval?: number;
  poll_enabled?: boolean;
  response_format?: string;
  json_path?: string;
  encoding?: string;
}

export interface HTTPUpdate {
  name?: string;
  description?: string;
  metadata?: any;
  tags?: string[];
  is_public?: boolean;
  base_url?: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: Record<string, string>;
  default_params?: Record<string, string>;
  auth_type?: string;
  auth_username?: string;
  auth_password?: string;
  auth_token?: string;
  api_key?: string;
  api_key_header?: string;
  oauth2_client_id?: string;
  oauth2_client_secret?: string;
  oauth2_token_url?: string;
  oauth2_scope?: string;
  verify_ssl?: boolean;
  ca_cert?: string;
  client_cert?: string;
  client_key?: string;
  timeout?: number;
  max_retries?: number;
  retry_delay?: number;
  poll_interval?: number;
  poll_enabled?: boolean;
  response_format?: string;
  json_path?: string;
  encoding?: string;
}

export interface HTTPTestResult {
  config_id: string;
  connection_test: string;
  validation: {
    valid: boolean;
    errors: string[];
    warnings: string[];
  };
  message: string;
}

export interface HTTPExecuteResult {
  id: string;
  name: string;
  base_url: string;
  method: string;
  headers: Record<string, string>;
  default_params: Record<string, string>;
  timeout: number;
  response_format: string;
  json_path?: string;
  encoding: string;
  execution_mode: string;
  message: string;
}

export const httpAPI = {
  // 获取HTTP配置列表
  getHTTPList: (skip: number = 0, limit: number = 20) => 
    api.get<HTTPDataSource[]>('/http/', { params: { skip, limit } }),

  // 根据ID获取HTTP配置
  getHTTPById: (id: string) => 
    api.get<HTTPDataSource>(`/http/${id}`),

  // 创建HTTP配置
  createHTTP: (data: HTTPCreate) => 
    api.post<HTTPDataSource>('/http/', data),

  // 更新HTTP配置
  updateHTTP: (id: string, data: HTTPUpdate) => 
    api.put<HTTPDataSource>(`/http/${id}`, data),

  // 删除HTTP配置
  deleteHTTP: (id: string) => 
    api.delete(`/http/${id}`),

  // 测试HTTP连接
  testHTTP: (id: string) => 
    api.post<HTTPTestResult>(`/http/${id}/test`),

  // 执行HTTP请求
  executeHTTP: (id: string) => 
    api.post<HTTPExecuteResult>(`/http/${id}/execute`),
}; 