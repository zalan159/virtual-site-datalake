import { useState, useRef, useCallback, useEffect } from 'react';
import { message } from 'antd';

export interface WebSocketMessage {
  id: string;
  content: string;
  direction: 'sent' | 'received';
  timestamp: string;
  type?: string;
}

export interface WebSocketConnectionOptions {
  url: string;
  protocols?: string[];
  headers?: Record<string, string>;
  auth_type?: string;
  auth_username?: string;
  auth_password?: string;
  auth_token?: string;
  connection_timeout?: number;
  ping_interval?: number;
  max_retries?: number;
  retry_delay?: number;
}

export interface UseWebSocketConnectionReturn {
  connect: () => void;
  disconnect: () => void;
  sendMessage: (message: string) => void;
  isConnected: boolean;
  isConnecting: boolean;
  messages: WebSocketMessage[];
  clearMessages: () => void;
  error: string | null;
  connectionAttempts: number;
}

export const useWebSocketConnection = (
  options: WebSocketConnectionOptions
): UseWebSocketConnectionReturn => {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [messages, setMessages] = useState<WebSocketMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [connectionAttempts, setConnectionAttempts] = useState(0);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const connectionAttemptsRef = useRef<number>(0);



  // 生成消息ID
  const generateMessageId = () => {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  };

  // 添加消息到列表
  const addMessage = useCallback((content: string, direction: 'sent' | 'received', type?: string) => {
    const newMessage: WebSocketMessage = {
      id: generateMessageId(),
      content,
      direction,
      timestamp: new Date().toISOString(),
      type
    };
    setMessages(prev => [...prev, newMessage]);
  }, []);

  // 构建WebSocket URL（包含认证信息）
  const buildWebSocketUrl = useCallback(() => {
    let url = options.url;
    
    // 只有在明确需要认证且不是'none'时才添加认证参数
    if (options.auth_type && options.auth_type !== 'none') {
      if (options.auth_type === 'token' && options.auth_token) {
        const separator = url.includes('?') ? '&' : '?';
        url += `${separator}token=${encodeURIComponent(options.auth_token)}`;
      } else if (options.auth_type === 'basic' && options.auth_username && options.auth_password) {
        // Basic认证通常放在headers中，但有些WebSocket服务器支持URL认证
        const separator = url.includes('?') ? '&' : '?';
        url += `${separator}username=${encodeURIComponent(options.auth_username)}&password=${encodeURIComponent(options.auth_password)}`;
      }
    }
    
    return url;
  }, [options]);

  // 设置心跳
  const setupPing = useCallback(() => {
    if (options.ping_interval && options.ping_interval > 0) {
      pingIntervalRef.current = setInterval(() => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          try {
            // 发送简单的ping文本消息，大多数echo服务器都支持
            wsRef.current.send('ping');
          } catch (error) {
            console.error('发送心跳失败:', error);
          }
        }
      }, options.ping_interval * 1000);
    }
  }, [options.ping_interval]);

  // 清理心跳
  const clearPing = useCallback(() => {
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }
  }, []);

  // 连接WebSocket
  const connect = useCallback(() => {
    if (isConnecting || isConnected) {
      return;
    }

    setIsConnecting(true);
    setError(null);
    connectionAttemptsRef.current += 1;
    setConnectionAttempts(connectionAttemptsRef.current);

    // 重试连接的辅助函数
    const attemptReconnect = (reason: string) => {
      const maxRetries = options.max_retries || 3;
      const currentAttempts = connectionAttemptsRef.current;
      console.log(`${reason} - 当前重试次数: ${currentAttempts}, 最大重试次数: ${maxRetries}`);
      
      if (currentAttempts < maxRetries) {
        const retryDelay = (options.retry_delay || 5) * 1000;
        message.warning(`${reason}，${retryDelay / 1000}秒后重试... (第${currentAttempts}次重试，最多${maxRetries}次)`);
        addMessage(`${reason}，准备第${currentAttempts}次重试，${retryDelay / 1000}秒后重连...`, 'received', 'system');
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, retryDelay);
      } else {
        message.error(`连接失败，已达到最大重试次数(${maxRetries}次)`);
        addMessage(`连接失败，已达到最大重试次数(${maxRetries}次)`, 'received', 'system');
      }
    };

    try {
      const url = buildWebSocketUrl();
      console.log('正在连接WebSocket:', url);
      
      // 创建WebSocket连接
      // 只有在有有效协议时才传递protocols参数
      const ws = options.protocols && options.protocols.length > 0 
        ? new WebSocket(url, options.protocols)
        : new WebSocket(url);
      wsRef.current = ws;

      // 设置连接超时
      const connectionTimeout = setTimeout(() => {
        if (ws.readyState === WebSocket.CONNECTING) {
          ws.close();
          setError('连接超时');
          setIsConnecting(false);
          addMessage('连接超时', 'received', 'system');
          attemptReconnect('连接超时');
        }
      }, (options.connection_timeout || 10) * 1000);

      ws.onopen = () => {
        clearTimeout(connectionTimeout);
        console.log('WebSocket连接已建立');
        setIsConnected(true);
        setIsConnecting(false);
        setError(null);
        connectionAttemptsRef.current = 0;
        setConnectionAttempts(0);
        setupPing();
        message.success('WebSocket连接成功');
        addMessage('连接已建立', 'received', 'system');
      };

      ws.onmessage = (event) => {
        try {
          // 尝试解析JSON消息
          const data = JSON.parse(event.data);
          
          // 忽略pong消息
          if (data.type === 'pong') {
            return;
          }
          
          // 显示消息内容
          const content = data.message || data.content || data.data || JSON.stringify(data);
          addMessage(content, 'received');
        } catch (error) {
          // 如果不是JSON，直接显示原始数据
          // 忽略ping的回显，避免消息混乱
          if (event.data === 'ping') {
            console.log('收到ping回显，忽略显示');
            return;
          }
          addMessage(event.data, 'received');
        }
      };

      ws.onclose = (event) => {
        clearTimeout(connectionTimeout);
        clearPing();
        console.log('WebSocket连接已关闭:', event.code, event.reason);
        setIsConnected(false);
        setIsConnecting(false);
        
        // 详细的错误代码说明
        const getCloseReason = (code: number) => {
          switch (code) {
            case 1000: return '正常关闭';
            case 1001: return '端点离开';
            case 1002: return '协议错误';
            case 1003: return '不支持的数据类型';
            case 1006: return '连接异常关闭（可能是网络问题、SSL证书问题或CORS问题）';
            case 1007: return '数据格式错误';
            case 1008: return '策略违规';
            case 1009: return '消息过大';
            case 1010: return '扩展协商失败';
            case 1011: return '服务器错误';
            case 1015: return 'TLS握手失败';
            default: return event.reason || '未知原因';
          }
        };
        
        if (event.code !== 1000) { // 不是正常关闭
          const reason = getCloseReason(event.code);
          setError(`连接已关闭 (代码${event.code}: ${reason})`);
          addMessage(`连接已断开 (代码${event.code}: ${reason})`, 'received', 'system');
          
          // 对于1006错误，给出更多建议
          if (event.code === 1006) {
            addMessage('建议检查：1)网络连接 2)防火墙设置 3)目标服务器状态 4)SSL证书', 'received', 'system');
          }
          
          // 自动重连
          attemptReconnect('连接断开');
        } else {
          addMessage('连接已正常关闭', 'received', 'system');
        }
      };

      ws.onerror = (error) => {
        clearTimeout(connectionTimeout);
        console.error('WebSocket错误:', error);
        setError('连接发生错误');
        setIsConnecting(false);
        addMessage('连接发生错误', 'received', 'system');
        
        // 如果WebSocket还在连接状态，说明是连接阶段的错误，需要重试
        if (ws.readyState === WebSocket.CONNECTING) {
          attemptReconnect('连接错误');
        } else {
          message.error('WebSocket连接发生错误');
        }
      };

    } catch (error) {
      console.error('创建WebSocket连接失败:', error);
      setError('无法创建连接');
      setIsConnecting(false);
      message.error('无法创建WebSocket连接');
    }
  }, [options, isConnecting, isConnected, buildWebSocketUrl, setupPing, clearPing, addMessage]);

  // 断开连接
  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    clearPing();
    
    if (wsRef.current) {
      wsRef.current.close(1000, '用户主动断开');
      wsRef.current = null;
    }
    
    setIsConnected(false);
    setIsConnecting(false);
    setError(null);
    connectionAttemptsRef.current = 0;
    setConnectionAttempts(0);
    message.info('已断开WebSocket连接');
  }, [clearPing]);

  // 发送消息
  const sendMessage = useCallback((messageContent: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      message.error('WebSocket未连接，无法发送消息');
      return;
    }

    try {
      // 发送消息
      wsRef.current.send(messageContent);
      addMessage(messageContent, 'sent');
      console.log('已发送消息:', messageContent);
    } catch (error) {
      console.error('发送消息失败:', error);
      message.error('发送消息失败');
    }
  }, [addMessage]);

  // 清除消息
  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  // 组件卸载时清理连接
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    connect,
    disconnect,
    sendMessage,
    isConnected,
    isConnecting,
    messages,
    clearMessages,
    error,
    connectionAttempts
  };
}; 