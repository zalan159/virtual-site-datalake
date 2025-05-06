import api from './axiosConfig';

export interface BrokerConfig {
  _id?: string;
  hostname: string;
  port: number;
  username?: string;
  password?: string;
  initial_topics: TopicSubscription[];
  db_details: {
    stream_name: string;
  };
}

export interface TopicSubscription {
  topic: string;
  qos: number;
}

export interface UserTopicSubscription {
  _id?: string;
  user_id: string;
  config_id: string;
  topic: string;
  qos: number;
  created_at: number;
  last_active?: number;
  metadata?: Record<string, any>;
}

// Broker配置相关接口
export const brokerAPI = {
  list: () => api.get<BrokerConfig[]>('/iot/brokers'),
  create: (data: Omit<BrokerConfig, '_id'>) => 
    api.post<BrokerConfig>('/iot/brokers', data),
  update: (id: string, data: Partial<BrokerConfig>) => api.put<BrokerConfig>(`/iot/brokers/${id}`, data),
  delete: (id: string) => api.delete(`/iot/brokers/${id}`),
};

// 用户订阅相关接口
export const subscriptionAPI = {
  list: () => api.get<UserTopicSubscription[]>('/iot/subscriptions'),
  create: (data: { config_id: string, topic: string, qos?: number, metadata?: Record<string, any> }) => 
    api.post<UserTopicSubscription>('/iot/subscriptions', data),
  delete: (id: string) => api.delete(`/iot/subscriptions/${id}`),
  getTopicSuggestions: () => api.get<{ common_topics: string[] }>('/iot/subscriptions/topics')
};

// 消息相关接口
export interface MessageRecord {
  redis_id?: string;
  topic: string;
  payload: any;
  received_ts?: number;
  timestamp?: number;
  user_id?: string;
  config_id?: string;
}

export const messageAPI = {
  history: (topic: string, page: number, pageSize: number) => 
    api.get<{ total: number; messages: MessageRecord[] }>('/iot/messages/history', { 
      params: { 
        topic, 
        page, 
        page_size: pageSize 
      }
    }),
  realtime: (topic: string, lastId = '0-0', timeout = 5) =>
    api.get<{ messages: MessageRecord[] }>('/iot/messages/realtime', { 
      params: { 
        topic, 
        last_id: lastId, 
        timeout 
      }
    }),
}; 