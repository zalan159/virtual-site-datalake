import api from './axiosConfig';

const API_BASE_URL = '/streams';

export interface Stream {
  _id: string;
  name: string;
  protocol: string;
  url: string;
  username?: string;
  password?: string;
  description?: string;
  owner?: string;
  create_time: string;
}

export interface StreamCreate {
  name: string;
  protocol?: string;
  url: string;
  username?: string;
  password?: string;
  description?: string;
}

export const streamApi = {
  // 获取视频流列表
  getList: async (): Promise<Stream[]> => {
    const response = await api.get(`${API_BASE_URL}/list`);
    return response.data;
  },

  // 创建视频流
  create: async (data: StreamCreate): Promise<Stream> => {
    const response = await api.post(`${API_BASE_URL}/create`, data);
    return response.data;
  },

  // 获取单个视频流详情
  get: async (id: string): Promise<Stream> => {
    const response = await api.get(`${API_BASE_URL}/${id}`);
    return response.data;
  },

  // 更新视频流
  update: async (id: string, data: StreamCreate): Promise<Stream> => {
    const response = await api.put(`${API_BASE_URL}/${id}`, data);
    return response.data;
  },

  // 删除视频流
  delete: async (id: string): Promise<void> => {
    await api.delete(`${API_BASE_URL}/${id}`);
  },
}; 