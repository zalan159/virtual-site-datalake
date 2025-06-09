import axiosInstance from './axios'
import { streamsApiPre } from '@/settings/httpSetting'

// 视频流接口类型定义
export interface StreamItem {
  _id: string       // MongoDB的_id字段
  name: string
  protocol: string
  url: string
  username?: string
  password?: string
  description?: string
  owner?: string
  create_time?: string
}

// 创建streams专用的axios实例，继承主实例的配置但使用不同的前缀
import axios from 'axios'
import { ResultEnum } from '@/enums/httpEnum'

const streamsAxiosInstance = axios.create({
  baseURL: import.meta.env.PROD ? streamsApiPre : streamsApiPre, // 开发和生产都使用streamsApiPre，由vite代理或nginx处理
  timeout: ResultEnum.TIMEOUT,
  withCredentials: true
})

// 使用与主实例相同的拦截器
streamsAxiosInstance.interceptors.request.use(
  (config) => {
    // 从URL获取token
    const token = getTokenFromUrl()
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (err) => {
    return Promise.reject(err)
  }
)

streamsAxiosInstance.interceptors.response.use(
  (res) => {
    return Promise.resolve(res)
  },
  (err) => {
    console.error('Streams API请求失败:', err)
    return Promise.reject(err)
  }
)

// 获取URL参数中的token
const getTokenFromUrl = (): string | null => {
  try {
    // 从window.route.params获取token（GoView路由守卫已将query参数放入此处）
    return (window as any).route?.params?.token || null
  } catch (error) {
    console.warn('获取URL参数中的token失败:', error)
    return null
  }
}

// Streams API方法
export const streamsApi = {
  // 获取视频流列表
  getStreamList: async (): Promise<StreamItem[]> => {
    console.log('=== StreamsApi: 开始获取视频流列表 ===')
    try {
      const res = await streamsAxiosInstance.get<StreamItem[]>('/list')
      console.log('StreamsApi API响应:', res.data)
      return Array.isArray(res.data) ? res.data : []
    } catch (error) {
      console.error('StreamsApi获取视频流列表异常:', error)
      throw error
    }
  },

  // 根据ID获取视频流详情
  getStreamById: async (id: string): Promise<StreamItem | null> => {
    try {
      const res = await streamsAxiosInstance.get<StreamItem>(`/${id}`)
      return res.data || null
    } catch (error) {
      console.error('StreamsApi获取视频流详情异常:', error)
      throw error
    }
  }
}

export default streamsApi 