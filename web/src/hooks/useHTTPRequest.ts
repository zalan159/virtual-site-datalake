import { useState, useCallback, useRef, useEffect } from 'react';
import { IoTDataProcessor, ProcessedData } from '../utils/iotDataProcessor';
import { IoTDataType } from '../services/iotBindingApi';

export interface HTTPRequestOptions {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  url: string;
  headers?: Record<string, string>;
  params?: Record<string, string>;
  data?: any;
  timeout?: number;
  auth_type?: string;
  auth_username?: string;
  auth_password?: string;
  auth_token?: string;
  api_key?: string;
  api_key_header?: string;
  verify_ssl?: boolean;
  poll_interval?: number; // 轮询间隔(秒)，0表示不轮询
  data_type?: IoTDataType; // 期望的数据类型
}

export interface HTTPResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  data: any;
  processedData?: ProcessedData;
  responseTime: number;
  responseSize: number;
  url: string;
  isHttps: boolean;
}

export interface UseHTTPRequestReturn {
  execute: (options: HTTPRequestOptions) => Promise<HTTPResponse>;
  startPolling: (options: HTTPRequestOptions) => void;
  stopPolling: () => void;
  processResponse: (data: any, dataType: IoTDataType) => ProcessedData;
  isLoading: boolean;
  isPolling: boolean;
  error: string | null;
  lastResponse: HTTPResponse | null;
  pollCount: number;
}

export const useHTTPRequest = (): UseHTTPRequestReturn => {
  const [isLoading, setIsLoading] = useState(false);
  const [isPolling, setIsPolling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastResponse, setLastResponse] = useState<HTTPResponse | null>(null);
  const [pollCount, setPollCount] = useState(0);

  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const execute = useCallback(async (options: HTTPRequestOptions): Promise<HTTPResponse> => {
    setIsLoading(true);
    setError(null);
    
    const startTime = Date.now();
    let timeoutId: NodeJS.Timeout | undefined;

    try {
      // 构建URL，支持HTTP和HTTPS
      let url = options.url;
      
      // 自动检测和处理URL协议
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        // 如果没有协议，根据端口或其他条件推断
        if (url.includes(':443') || options.verify_ssl !== false) {
          url = 'https://' + url;
        } else {
          url = 'http://' + url;
        }
      }
      
      const isHttps = url.startsWith('https://');
      console.log(`执行${isHttps ? 'HTTPS' : 'HTTP'}请求:`, url);
      
      if (options.params && Object.keys(options.params).length > 0) {
        const searchParams = new URLSearchParams(options.params);
        url += (url.includes('?') ? '&' : '?') + searchParams.toString();
      }

      // 构建请求头
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...options.headers,
      };

      // 处理认证
      switch (options.auth_type) {
        case 'basic':
          if (options.auth_username && options.auth_password) {
            const credentials = btoa(`${options.auth_username}:${options.auth_password}`);
            headers['Authorization'] = `Basic ${credentials}`;
          }
          break;
        case 'bearer':
          if (options.auth_token) {
            headers['Authorization'] = `Bearer ${options.auth_token}`;
          }
          break;
        case 'api_key':
          if (options.api_key && options.api_key_header) {
            headers[options.api_key_header] = options.api_key;
          }
          break;
        default:
          // 无认证
          break;
      }

      // 创建超时控制器
      const controller = new AbortController();
      timeoutId = setTimeout(() => {
        controller.abort();
      }, options.timeout || 30000);

      // 构建请求配置
      const requestConfig: RequestInit = {
        method: options.method,
        headers,
        signal: controller.signal,
      };

      // 添加请求体（仅对POST、PUT、PATCH方法）
      if (['POST', 'PUT', 'PATCH'].includes(options.method) && options.data) {
        requestConfig.body = typeof options.data === 'string' 
          ? options.data 
          : JSON.stringify(options.data);
      }

      console.log('执行HTTP请求:', {
        url,
        method: options.method,
        headers,
        body: requestConfig.body,
      });

      // 执行请求
      const response = await fetch(url, requestConfig);
      const endTime = Date.now();
      const responseTime = endTime - startTime;

      // 请求成功后立即清理超时
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = undefined;
      }

      // 解析响应
      let responseData: any;
      const contentType = response.headers.get('content-type') || '';
      
      if (contentType.includes('application/json')) {
        try {
          responseData = await response.json();
        } catch (e) {
          responseData = await response.text();
        }
      } else {
        responseData = await response.text();
      }

      // 处理指定的数据类型
      let processedData: ProcessedData | undefined;
      if (options.data_type) {
        try {
          processedData = IoTDataProcessor.processData(responseData, options.data_type);
          console.log(`处理${options.data_type}类型响应数据:`, processedData);
        } catch (error: any) {
          console.warn(`无法处理为${options.data_type}类型:`, error.message);
          // 尝试自动检测数据类型
          const suggestedTypes = IoTDataProcessor.suggestDataTypes(responseData);
          if (suggestedTypes.length > 0) {
            try {
              processedData = IoTDataProcessor.processData(responseData, suggestedTypes[0]);
              console.log(`自动检测并处理为${suggestedTypes[0]}类型:`, processedData);
            } catch (autoError) {
              console.warn('自动数据处理也失败:', autoError);
            }
          }
        }
      }

      // 构建响应头对象
      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });

      // 计算响应大小（大概估算）
      const responseSize = new Blob([JSON.stringify(responseData)]).size;

      const httpResponse: HTTPResponse = {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
        data: responseData,
        processedData,
        responseTime,
        responseSize,
        url,
        isHttps,
      };

      setLastResponse(httpResponse);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return httpResponse;

    } catch (err: any) {
      let errorMessage: string;
      
      if (err.name === 'AbortError') {
        errorMessage = '请求超时或被取消';
      } else if (err.name === 'TypeError' && err.message.includes('Failed to fetch')) {
        // 很可能是CORS跨域问题
        errorMessage = 'CORS跨域限制：目标服务器不允许跨域请求。请尝试支持跨域的API或使用代理服务器。';
      } else {
        errorMessage = err.message || '请求失败';
      }
      
      setError(errorMessage);
      console.error('HTTP请求错误:', {
        name: err.name,
        message: err.message,
        stack: err.stack,
        url: options.url
      });
      throw new Error(errorMessage);
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      setIsLoading(false);
    }
  }, []);

  // 处理响应数据
  const processResponse = useCallback((data: any, dataType: IoTDataType): ProcessedData => {
    return IoTDataProcessor.processData(data, dataType);
  }, []);

  // 开始轮询
  const startPolling = useCallback((options: HTTPRequestOptions) => {
    // 停止之前的轮询
    stopPolling();
    
    if (!options.poll_interval || options.poll_interval <= 0) {
      console.warn('轮询间隔无效，无法开始轮询');
      return;
    }

    setIsPolling(true);
    setPollCount(0);
    console.log(`开始轮询，间隔: ${options.poll_interval}秒`);

    // 立即执行第一次请求
    execute(options).catch(error => {
      console.error('轮询请求失败:', error);
    });

    // 设置定时器
    pollingIntervalRef.current = setInterval(async () => {
      if (!isPolling) return; // 防止状态不一致

      try {
        await execute(options);
        setPollCount(prev => prev + 1);
      } catch (error) {
        console.error('轮询请求失败:', error);
        // 可以选择在多次失败后停止轮询
      }
    }, options.poll_interval * 1000);
  }, [execute, isPolling]);

  // 停止轮询
  const stopPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    
    setIsPolling(false);
    console.log('已停止轮询');
  }, []);

  // 清理函数
  useEffect(() => {
    return () => {
      stopPolling();
    };
  }, [stopPolling]);

  return {
    execute,
    startPolling,
    stopPolling,
    processResponse,
    isLoading,
    isPolling,
    error,
    lastResponse,
    pollCount,
  };
}; 