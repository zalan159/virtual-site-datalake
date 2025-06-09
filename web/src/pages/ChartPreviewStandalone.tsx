import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Spin, Button, Space } from 'antd';
import { ArrowLeftOutlined, EditOutlined } from '@ant-design/icons';
import chartApi, { Chart } from '../services/chartApi';

const ChartPreviewStandalone: React.FC = () => {
  const { chartId } = useParams<{ chartId: string }>();
  const navigate = useNavigate();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chart, setChart] = useState<Chart | null>(null);

  // GoView预览器的URL
  const GOVIEW_VIEWER_URL = import.meta.env.VITE_REACT_APP_GOVIEW_VIEWER_URL || 'http://localhost:3001';
  
  // 获取当前用户token
  const getCurrentUserToken = (): string | null => {
    return localStorage.getItem('token');
  };

  useEffect(() => {
    if (!chartId) {
      setError('图表ID不存在');
      setLoading(false);
      return;
    }

    fetchChart();
  }, [chartId]);

  const fetchChart = async () => {
    if (!chartId) return;

    try {
      setLoading(true);
      const chartData = await chartApi.getChart(chartId);
      setChart(chartData);
      
      // 等待iframe加载完成后，发送图表数据
      setTimeout(() => {
        sendChartDataToViewer(chartData);
        setLoading(false);
      }, 2000);
    } catch (error: any) {
      console.error('获取图表数据失败:', error);
      setError(`获取图表数据失败: ${error.response?.data?.detail || error.message || '未知错误'}`);
      setLoading(false);
    }
  };

  const sendChartDataToViewer = (chartData: Chart) => {
    if (!iframeRef.current?.contentWindow) return;

    // 向GoView预览器发送图表配置数据
    const message = {
      type: 'LOAD_CHART_PREVIEW',
      data: {
        chartId: chartData.uid,
        name: chartData.name,
        config: chartData.config,
        width: chartData.width,
        height: chartData.height
      }
    };

    iframeRef.current.contentWindow.postMessage(message, GOVIEW_VIEWER_URL);
  };

  // 监听来自GoView预览器的消息
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // 验证消息来源
      if (event.origin !== GOVIEW_VIEWER_URL) return;

      const { type, chartId: messageChartId } = event.data;

      // 确保消息是针对当前图表的
      if (messageChartId !== chartId) return;

      switch (type) {
        case 'VIEWER_READY':
          // 预览器已准备就绪，发送图表数据
          if (chart) {
            sendChartDataToViewer(chart);
          }
          break;

        case 'CHART_LOADED':
          // 图表已加载完成
          console.log('图表预览已加载');
          setLoading(false);
          break;

        default:
          console.log('收到未知消息类型:', type);
      }
    };

    window.addEventListener('message', handleMessage);

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [chart, chartId, GOVIEW_VIEWER_URL]);

  const handleBack = () => {
    navigate(-1);
  };

  const handleEdit = () => {
    navigate(`/chart-editor/${chartId}`);
  };

  if (error) {
    return (
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column',
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        padding: '20px'
      }}>
        <div style={{ color: 'red', marginBottom: '20px', fontSize: '16px' }}>
          {error}
        </div>
        <Button onClick={handleBack}>
          返回
        </Button>
      </div>
    );
  }

  return (
    <div style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* 顶部工具栏 */}
      <div style={{ 
        height: '60px', 
        backgroundColor: '#fff', 
        borderBottom: '1px solid #e8e8e8',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 20px',
        zIndex: 1000
      }}>
        <Space>
          <Button 
            icon={<ArrowLeftOutlined />} 
            onClick={handleBack}
          >
            返回
          </Button>
          <span style={{ fontSize: '16px', fontWeight: 'bold' }}>
            {chart?.name || '图表预览'}
          </span>
        </Space>
        
        <Space>
          <Button 
            type="primary" 
            icon={<EditOutlined />}
            onClick={handleEdit}
          >
            编辑
          </Button>
        </Space>
      </div>

      {/* 预览区域 */}
      <div style={{ flex: 1, position: 'relative' }}>
        {loading && (
          <div style={{ 
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: 'rgba(255, 255, 255, 0.8)',
            zIndex: 1000
          }}>
            <Spin size="large" tip="加载预览中..." />
          </div>
        )}
        
        <iframe
          ref={iframeRef}
          src={`${GOVIEW_VIEWER_URL}/project-view?projectId=${chartId}&token=${getCurrentUserToken()}`}
          style={{
            width: '100%',
            height: '100%',
            border: 'none'
          }}
          onLoad={() => {
            console.log('GoView预览器已加载');
            // iframe加载完成后延迟发送数据，确保预览器已完全初始化
            setTimeout(() => {
              if (chart) {
                sendChartDataToViewer(chart);
              }
              setLoading(false);
            }, 1000);
          }}
          onError={() => {
            setError('无法加载GoView预览器');
            setLoading(false);
          }}
        />
      </div>
    </div>
  );
};

export default ChartPreviewStandalone;