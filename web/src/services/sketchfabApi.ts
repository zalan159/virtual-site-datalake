import axios from 'axios';
import { fileAPI } from './api';

// 创建axios实例
const api = axios.create({
  baseURL: 'http://127.0.0.1:8000',
  timeout: 30000,
  withCredentials: true,
});

// Sketchfab API服务
export const sketchfabService = {
  // 使用用户名和密码获取访问令牌
  getAccessToken: async (username: string, password: string) => {
    try {
      console.log('发送Sketchfab认证请求:', { username, password: '******' });
      const response = await api.post('/sketchfab/auth', { username, password });
      console.log('Sketchfab认证响应:', response.data);
      return response.data;
    } catch (error) {
      console.error('Sketchfab认证失败:', error);
      if (axios.isAxiosError(error) && error.response) {
        console.error('错误响应:', error.response.data);
      }
      throw error;
    }
  },

  // 搜索模型
  searchModels: async (token: string, search?: string, page: number = 1, count: number = 24) => {
    try {
      console.log('搜索Sketchfab模型:', { token: token.substring(0, 10) + '...', search, page, count });
      const response = await api.get('/sketchfab/models', {
        params: {
          token,
          search,
          page,
          count,
        },
      });
      console.log('Sketchfab模型搜索结果:', response.data);
      return response.data;
    } catch (error) {
      console.error('获取Sketchfab模型列表失败:', error);
      if (axios.isAxiosError(error) && error.response) {
        console.error('错误响应:', error.response.data);
      }
      throw error;
    }
  },

  // 获取模型详情
  getModelDetails: async (uid: string, token: string) => {
    try {
      console.log('获取Sketchfab模型详情:', { uid, token: token.substring(0, 10) + '...' });
      const response = await api.get(`/sketchfab/models/${uid}`, {
        params: { token },
      });
      console.log('Sketchfab模型详情:', response.data);
      return response.data;
    } catch (error) {
      console.error('获取Sketchfab模型详情失败:', error);
      if (axios.isAxiosError(error) && error.response) {
        console.error('错误响应:', error.response.data);
      }
      throw error;
    }
  },

  // 下载模型
  downloadModel: async (uid: string, token: string) => {
    try {
      console.log('下载Sketchfab模型:', { uid, token: token.substring(0, 10) + '...' });
      const response = await api.post(`/sketchfab/models/${uid}/download`, { token });
      console.log('Sketchfab模型下载结果:', response.data);
      return response.data;
    } catch (error) {
      console.error('下载Sketchfab模型失败:', error);
      if (axios.isAxiosError(error) && error.response) {
        console.error('错误响应:', error.response.data);
      }
      throw error;
    }
  },
};

export default sketchfabService; 