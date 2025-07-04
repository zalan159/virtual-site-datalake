import React, { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Card, Spin, message, Button, Space, Typography, Descriptions, Tag } from 'antd';
import { ArrowLeftOutlined, DownloadOutlined, EyeOutlined } from '@ant-design/icons';
import { gaussianSplatApi, GaussianSplat } from '../services/gaussianSplatApi';
import { formatFileSize, formatDate } from '../utils/formatters';

const { Title, Text } = Typography;

// 暂时使用简单的加载器，后续可以集成真正的3D高斯泼溅查看器
const SimpleGaussianSplatViewer: React.FC<{ splat: GaussianSplat }> = ({ splat }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [viewerReady, setViewerReady] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;

    // 这里应该集成真正的3D高斯泼溅查看器
    // 目前先显示一个占位符
    const loadViewer = async () => {
      try {
        // 模拟加载过程
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // 在这里集成第三方高斯泼溅查看器
        // 比如使用 three.js 或者 CesiumJS 相关的高斯泼溅插件
        
        setViewerReady(true);
      } catch (error) {
        console.error('Failed to load gaussian splat viewer:', error);
        message.error('加载3D查看器失败');
      }
    };

    loadViewer();
  }, [splat]);

  if (!viewerReady) {
    return (
      <div 
        style={{ 
          height: '100%', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center' 
        }}
      >
        <Spin size="large" tip="加载3D查看器中..." />
      </div>
    );
  }

  return (
    <div 
      ref={containerRef}
      style={{ 
        width: '100%', 
        height: '100%', 
        backgroundColor: '#f0f2f5',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column'
      }}
    >
      <EyeOutlined style={{ fontSize: 48, color: '#1890ff', marginBottom: 16 }} />
      <Title level={4} style={{ margin: 0, color: '#666' }}>
        3D高斯泼溅预览
      </Title>
      <Text type="secondary" style={{ marginTop: 8 }}>
        {splat.filename}
      </Text>
      <Text type="secondary" style={{ fontSize: 12, marginTop: 4 }}>
        格式：{splat.format.toUpperCase()} · 大小：{formatFileSize(splat.file_size)}
      </Text>
      <div style={{ marginTop: 16, fontSize: 12, color: '#999', textAlign: 'center' }}>
        注意：3D高斯泼溅查看器正在开发中
        <br />
        将来会集成CesiumJS或Three.js的高斯泼溅插件
      </div>
    </div>
  );
};

const GaussianSplatPreview: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [splat, setSplat] = useState<GaussianSplat | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSplat = async () => {
      if (!id) return;
      
      setLoading(true);
      try {
        const data = await gaussianSplatApi.getGaussianSplat(id);
        setSplat(data);
      } catch (error) {
        message.error('获取高斯泼溅信息失败');
        console.error('Error fetching gaussian splat:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchSplat();
  }, [id]);

  const handleDownload = async () => {
    if (!splat) return;
    
    try {
      const blob = await gaussianSplatApi.downloadGaussianSplat(splat.id);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = splat.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      message.success('下载完成');
    } catch (error) {
      message.error('下载失败');
      console.error('Error downloading gaussian splat:', error);
    }
  };

  if (loading) {
    return (
      <div style={{ 
        height: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center' 
      }}>
        <Spin size="large" tip="加载中..." />
      </div>
    );
  }

  if (!splat) {
    return (
      <div style={{ 
        height: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center' 
      }}>
        <div style={{ textAlign: 'center' }}>
          <Title level={4}>高斯泼溅不存在</Title>
          <Button onClick={() => window.history.back()}>
            返回
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* 头部工具栏 */}
      <Card 
        size="small" 
        style={{ 
          borderRadius: 0, 
          borderBottom: '1px solid #d9d9d9',
          flexShrink: 0
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Space>
            <Button 
              icon={<ArrowLeftOutlined />} 
              onClick={() => window.history.back()}
            >
              返回
            </Button>
            <Title level={5} style={{ margin: 0 }}>
              {splat.filename}
            </Title>
            <Tag color="blue">{splat.format.toUpperCase()}</Tag>
          </Space>
          <Space>
            <Button 
              icon={<DownloadOutlined />} 
              onClick={handleDownload}
            >
              下载
            </Button>
          </Space>
        </div>
      </Card>

      {/* 主内容区 */}
      <div style={{ flex: 1, display: 'flex' }}>
        {/* 3D查看器 */}
        <div style={{ flex: 1, position: 'relative' }}>
          <SimpleGaussianSplatViewer splat={splat} />
        </div>

        {/* 侧边栏信息 */}
        <Card 
          size="small" 
          style={{ 
            width: 300, 
            borderRadius: 0, 
            borderLeft: '1px solid #d9d9d9',
            maxHeight: '100%',
            overflow: 'auto'
          }}
        >
          <Descriptions title="文件信息" size="small" column={1}>
            <Descriptions.Item label="文件名">
              {splat.filename}
            </Descriptions.Item>
            <Descriptions.Item label="格式">
              {splat.format.toUpperCase()}
            </Descriptions.Item>
            <Descriptions.Item label="文件大小">
              {formatFileSize(splat.file_size)}
            </Descriptions.Item>
            <Descriptions.Item label="上传时间">
              {formatDate(splat.upload_date)}
            </Descriptions.Item>
            <Descriptions.Item label="上传者">
              {splat.username}
            </Descriptions.Item>
            <Descriptions.Item label="状态">
              <Space>
                <Tag color={splat.is_public ? 'green' : 'default'}>
                  {splat.is_public ? '公开' : '私有'}
                </Tag>
                <Tag color={splat.show ? 'blue' : 'default'}>
                  {splat.show ? '显示' : '隐藏'}
                </Tag>
              </Space>
            </Descriptions.Item>
            {splat.point_count && (
              <Descriptions.Item label="点数">
                {splat.point_count.toLocaleString()}
              </Descriptions.Item>
            )}
            {splat.description && (
              <Descriptions.Item label="描述">
                {splat.description}
              </Descriptions.Item>
            )}
            {splat.tags && splat.tags.length > 0 && (
              <Descriptions.Item label="标签">
                <Space wrap>
                  {splat.tags.map((tag) => (
                    <Tag key={tag}>{tag}</Tag>
                  ))}
                </Space>
              </Descriptions.Item>
            )}
          </Descriptions>

          {/* 渲染属性 */}
          <div style={{ marginTop: 16 }}>
            <Title level={5}>渲染属性</Title>
            <Descriptions size="small" column={1}>
              <Descriptions.Item label="透明度">
                {splat.opacity}
              </Descriptions.Item>
              {splat.position && (
                <Descriptions.Item label="位置">
                  [{splat.position.map(p => p.toFixed(2)).join(', ')}]
                </Descriptions.Item>
              )}
              {splat.rotation && (
                <Descriptions.Item label="旋转">
                  [{splat.rotation.map(r => r.toFixed(2)).join(', ')}]
                </Descriptions.Item>
              )}
              {splat.scale && (
                <Descriptions.Item label="缩放">
                  [{splat.scale.map(s => s.toFixed(2)).join(', ')}]
                </Descriptions.Item>
              )}
            </Descriptions>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default GaussianSplatPreview;