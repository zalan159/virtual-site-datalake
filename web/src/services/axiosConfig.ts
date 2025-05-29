import axios from 'axios';

// 创建axios实例
const api = axios.create({
  baseURL: '/api',
  timeout: 0, // 0表示无超时限制，适合大文件上传
  withCredentials: true, // 允许跨域请求携带凭证
  maxContentLength: Infinity, // 允许的最大内容长度
  maxBodyLength: Infinity, // 允许的最大请求体长度
});

// 请求拦截器
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 响应拦截器
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    if (error.response) {
      // 处理401错误
      if (error.response.status === 401) {
        localStorage.removeItem('token');
        window.location.href = '/login';
      }
      
      // 处理422错误
      if (error.response.status === 422) {
        console.error('请求验证错误 (422):', error.response.data);
      }
    }
    return Promise.reject(error);
  }
);

export default api; 