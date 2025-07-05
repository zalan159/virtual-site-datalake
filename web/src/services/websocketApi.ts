import api from './api';

export interface WebSocketDataSource {
  id: string;
  name: string;
  description?: string;
  metadata?: Record<string, any>;
  tags: string[];
  is_public: boolean;
  url: string;
  created_at: string;
  updated_at: string;
  
  // Connection configuration
  headers?: Record<string, string>;
  protocols?: string[];
  
  // Authentication
  auth_type?: string;
  auth_username?: string;
  auth_password?: string;
  auth_token?: string;
  auth_custom?: Record<string, any>;
  
  // Connection settings
  connection_timeout?: number;
  ping_interval?: number;
  ping_timeout?: number;
  max_retries?: number;
  retry_delay?: number;
}

export interface WebSocketCreateData {
  name: string;
  description?: string;
  metadata?: Record<string, any>;
  tags?: string[];
  is_public?: boolean;
  url: string;
  
  // Connection configuration
  headers?: Record<string, string>;
  protocols?: string[];
  
  // Authentication
  auth_type?: string;
  auth_username?: string;
  auth_password?: string;
  auth_token?: string;
  auth_custom?: Record<string, any>;
  
  // Connection settings
  connection_timeout?: number;
  ping_interval?: number;
  ping_timeout?: number;
  max_retries?: number;
  retry_delay?: number;
}

export interface WebSocketUpdateData {
  name?: string;
  description?: string;
  metadata?: Record<string, any>;
  tags?: string[];
  is_public?: boolean;
  url?: string;
  headers?: Record<string, string>;
  protocols?: string[];
  auth_type?: string;
  auth_username?: string;
  auth_password?: string;
  auth_token?: string;
  auth_custom?: Record<string, any>;
  connection_timeout?: number;
  ping_interval?: number;
  ping_timeout?: number;
  max_retries?: number;
  retry_delay?: number;
}

const getWebSocketList = (skip: number = 0, limit: number = 20) => {
  return api.get(`/websockets/?skip=${skip}&limit=${limit}`);
};

const getWebSocketById = (id: string) => {
  return api.get(`/websockets/${id}`);
};

const createWebSocket = (data: WebSocketCreateData) => {
  return api.post('/websockets/', data);
};

const updateWebSocket = (id: string, data: WebSocketUpdateData) => {
  return api.put(`/websockets/${id}`, data);
};

const deleteWebSocket = (id: string) => {
  return api.delete(`/websockets/${id}`);
};

export const websocketAPI = {
  getWebSocketList,
  getWebSocketById,
  createWebSocket,
  updateWebSocket,
  deleteWebSocket,
};