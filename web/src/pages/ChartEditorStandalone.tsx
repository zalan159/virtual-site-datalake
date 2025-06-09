import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Spin, message, Button, Space } from 'antd';
import { SaveOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import chartApi, { Chart } from '../services/chartApi';

const ChartEditorStandalone: React.FC = () => {
  const { chartId } = useParams<{ chartId: string }>();
  const navigate = useNavigate();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chart, setChart] = useState<Chart | null>(null);
  const [saving, setSaving] = useState(false);

  // GoView编辑器的URL - 这里需要替换为实际的GoView编辑器地址
  const GOVIEW_EDITOR_URL = import.meta.env.VITE_REACT_APP_GOVIEW_EDITOR_URL || 'http://localhost:3001';
  
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
        sendChartDataToEditor(chartData);
        setLoading(false);
      }, 2000);
    } catch (error: any) {
      console.error('获取图表数据失败:', error);
      setError(`获取图表数据失败: ${error.response?.data?.detail || error.message || '未知错误'}`);
      setLoading(false);
    }
  };

  const sendChartDataToEditor = (chartData: Chart) => {
    if (!iframeRef.current?.contentWindow) return;

    // 向GoView编辑器发送图表配置数据
    const message = {
      type: 'LOAD_CHART',
      data: {
        chartId: chartData.uid,
        name: chartData.name,
        description: chartData.description,
        config: chartData.config,
        width: chartData.width,
        height: chartData.height
      }
    };

    // 向GoView编辑器的origin发送消息
    const targetOrigin = new URL(GOVIEW_EDITOR_URL).origin;
    iframeRef.current.contentWindow.postMessage(message, targetOrigin);
  };

  const handleSave = async () => {
    if (!chart || !iframeRef.current?.contentWindow) return;

    setSaving(true);
    try {
      // 向GoView编辑器请求当前的图表配置
      const requestMessage = {
        type: 'GET_CHART_CONFIG',
        chartId: chart.uid
      };

      const targetOrigin = new URL(GOVIEW_EDITOR_URL).origin;
      iframeRef.current.contentWindow.postMessage(requestMessage, targetOrigin);
    } catch (error) {
      message.error('保存失败');
      console.error('保存失败:', error);
      setSaving(false);
    }
  };

  const generatePreview = async () => {
    if (!chart || !iframeRef.current?.contentWindow) return;

    try {
      // 向GoView编辑器请求生成预览图
      const requestMessage = {
        type: 'GENERATE_PREVIEW',
        chartId: chart.uid
      };

      const targetOrigin = new URL(GOVIEW_EDITOR_URL).origin;
      iframeRef.current.contentWindow.postMessage(requestMessage, targetOrigin);
    } catch (error) {
      console.error('生成预览图失败:', error);
    }
  };

  // 监听来自GoView编辑器的消息
  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      // 验证消息来源
      const targetOrigin = new URL(GOVIEW_EDITOR_URL).origin;
      if (event.origin !== targetOrigin) return;

      const { type, data, chartId: messageChartId } = event.data;

      // 确保消息是针对当前图表的
      if (messageChartId !== chartId) return;

      switch (type) {
        case 'CHART_CONFIG_RESPONSE':
          // 收到图表配置数据，保存到后端
          try {
            await chartApi.updateChart(chartId!, {
              config: data.config,
              name: data.name,
              description: data.description
            });
            message.success('保存成功');
            setSaving(false);
          } catch (error) {
            message.error('保存失败');
            console.error('保存失败:', error);
            setSaving(false);
          }
          break;

        case 'PREVIEW_GENERATED':
          // 收到预览图数据，上传到后端
          try {
            await chartApi.updateChartPreview(chartId!, data.previewImage);
            message.success('预览图已更新');
          } catch (error) {
            message.error('预览图更新失败');
            console.error('预览图更新失败:', error);
          }
          break;

        case 'EDITOR_READY':
          // 编辑器已准备就绪，发送图表数据
          if (chart) {
            sendChartDataToEditor(chart);
          }
          break;

        case 'CHART_CHANGED':
          // 图表内容发生变化，可以在这里处理自动保存逻辑
          console.log('图表内容已修改');
          break;

        default:
          console.log('收到未知消息类型:', type);
      }
    };

    window.addEventListener('message', handleMessage);

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [chart, chartId, GOVIEW_EDITOR_URL]);

  const handleBack = () => {
    navigate(-1);
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
    <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
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
            <Spin size="large" tip="加载编辑器中..." />
          </div>
        )}
        
        <iframe
          ref={iframeRef}
          src={`${GOVIEW_EDITOR_URL}/#/chart/home/${chartId}?token=${getCurrentUserToken()}`}
          style={{
            width: '100%',
            height: '100%',
            border: 'none'
          }}
          onLoad={() => {
            console.log('GoView编辑器已加载');
            // iframe加载完成后延迟发送数据，确保编辑器已完全初始化
            setTimeout(() => {
              if (chart) {
                sendChartDataToEditor(chart);
              }
              setLoading(false);
            }, 1000);
          }}
          onError={() => {
            setError('无法加载GoView编辑器');
            setLoading(false);
          }}
        />
    </div>
  );
};

export default ChartEditorStandalone;