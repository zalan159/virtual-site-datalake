import { useEffect, useRef, useState } from 'react';
import { animationEventService } from '../services/animationEventService';
import { iotAnimationService } from '../services/iotAnimationService';
import { AnimationEvent } from '../types/animation';

interface PreviewModeOptions {
  enabled: boolean;
  viewerRef?: React.RefObject<any>;
  onAnimationEvent?: (event: AnimationEvent) => void;
  onIoTDataUpdate?: (data: any) => void;
}

export const usePreviewMode = (options: PreviewModeOptions) => {
  const { enabled, viewerRef, onAnimationEvent, onIoTDataUpdate } = options;
  
  const animationWsRef = useRef<WebSocket | null>(null);
  const iotWsRef = useRef<WebSocket | null>(null);
  const [isAnimationConnected, setIsAnimationConnected] = useState(false);
  const [isIoTConnected, setIsIoTConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  const connectAnimationWebSocket = () => {
    if (animationWsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    try {
      const wsUrl = `ws://${window.location.hostname}:8000/ws/animation-events`;
      const ws = new WebSocket(wsUrl);
      
      ws.onopen = () => {
        console.log('动画事件WebSocket连接已建立');
        setIsAnimationConnected(true);
        setConnectionError(null);
      };

      ws.onmessage = (event) => {
        try {
          const animationEvent = JSON.parse(event.data) as AnimationEvent;
          animationEventService.sendEvent(animationEvent);
          onAnimationEvent?.(animationEvent);
        } catch (error) {
          console.error('解析动画事件数据失败:', error);
        }
      };

      ws.onclose = () => {
        console.log('动画事件WebSocket连接已关闭');
        setIsAnimationConnected(false);
        animationWsRef.current = null;
      };

      ws.onerror = (error) => {
        console.error('动画事件WebSocket连接失败:', error);
        setIsAnimationConnected(false);
        setConnectionError('动画事件WebSocket连接失败');
      };

      animationWsRef.current = ws;
    } catch (error) {
      console.error('创建动画事件WebSocket连接失败:', error);
      setConnectionError('创建动画事件WebSocket连接失败');
    }
  };

  const connectIoTWebSocket = () => {
    if (iotWsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    try {
      const wsUrl = `ws://${window.location.hostname}:8000/ws/iot-data`;
      const ws = new WebSocket(wsUrl);
      
      ws.onopen = () => {
        console.log('IoT数据WebSocket连接已建立');
        setIsIoTConnected(true);
        setConnectionError(null);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'iot-update') {
            iotAnimationService.updateIoTDataBatch(data.data);
            onIoTDataUpdate?.(data.data);
          }
        } catch (error) {
          console.error('解析IoT数据失败:', error);
        }
      };

      ws.onclose = () => {
        console.log('IoT数据WebSocket连接已关闭');
        setIsIoTConnected(false);
        iotWsRef.current = null;
      };

      ws.onerror = (error) => {
        console.error('IoT数据WebSocket连接失败:', error);
        setIsIoTConnected(false);
        setConnectionError('IoT数据WebSocket连接失败');
      };

      iotWsRef.current = ws;
    } catch (error) {
      console.error('创建IoT数据WebSocket连接失败:', error);
      setConnectionError('创建IoT数据WebSocket连接失败');
    }
  };

  const disconnectWebSockets = () => {
    if (animationWsRef.current) {
      animationWsRef.current.close();
      animationWsRef.current = null;
    }
    
    if (iotWsRef.current) {
      iotWsRef.current.close();
      iotWsRef.current = null;
    }
    
    setIsAnimationConnected(false);
    setIsIoTConnected(false);
    setConnectionError(null);
  };

  const startPreviewMode = () => {
    console.log('启动预览模式');
    
    if (viewerRef?.current) {
      iotAnimationService.initialize(viewerRef.current);
    }
    
    connectAnimationWebSocket();
    connectIoTWebSocket();
  };

  const stopPreviewMode = () => {
    console.log('停止预览模式');
    
    disconnectWebSockets();
    
    iotAnimationService.cleanup();
  };

  useEffect(() => {
    if (enabled) {
      startPreviewMode();
    } else {
      stopPreviewMode();
    }

    return () => {
      stopPreviewMode();
    };
  }, [enabled, viewerRef]);

  useEffect(() => {
    return () => {
      disconnectWebSockets();
    };
  }, []);

  return {
    isAnimationConnected,
    isIoTConnected,
    connectionError,
    startPreviewMode,
    stopPreviewMode,
    reconnect: () => {
      if (enabled) {
        disconnectWebSockets();
        setTimeout(() => {
          connectAnimationWebSocket();
          connectIoTWebSocket();
        }, 1000);
      }
    }
  };
};