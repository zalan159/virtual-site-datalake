import { useState, useCallback } from 'react';

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
}

export interface HTTPResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  data: any;
  responseTime: number;
  responseSize: number;
}

export interface UseHTTPRequestReturn {
  execute: (options: HTTPRequestOptions) => Promise<HTTPResponse>;
  isLoading: boolean;
  error: string | null;
  lastResponse: HTTPResponse | null;
}

export const useHTTPRequest = (): UseHTTPRequestReturn => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastResponse, setLastResponse] = useState<HTTPResponse | null>(null);

  const execute = useCallback(async (options: HTTPRequestOptions): Promise<HTTPResponse> => {
    setIsLoading(true);
    setError(null);
    
    const startTime = Date.now();
    let timeoutId: NodeJS.Timeout | undefined;

    try {
      // 构建URL
      let url = options.url;
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
        responseTime,
        responseSize,
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

  return {
    execute,
    isLoading,
    error,
    lastResponse,
  };
}; 