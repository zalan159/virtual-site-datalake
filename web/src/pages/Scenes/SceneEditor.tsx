import React, { useState, useEffect } from 'react';
import { Layout, Menu, Typography, Spin, message } from 'antd';
import { useParams, useNavigate } from 'react-router-dom';
import {
  AppstoreOutlined,
  EditOutlined,
  DatabaseOutlined,
  ArrowLeftOutlined,
} from '@ant-design/icons';

const { Header, Sider, Content } = Layout;
const { Title } = Typography;

// 场景类型定义
interface Scene {
  id: string;
  name: string;
  thumbnail: string;
  description: string;
  createdAt: string;
  updatedAt: string;
}

// 模拟数据
const mockScenes: Scene[] = [
  {
    id: '1',
    name: '客厅场景',
    thumbnail: 'https://gw.alipayobjects.com/zos/rmsportal/JiqGstEfoWAOHiTxclqi.png',
    description: '一个现代化的客厅场景',
    createdAt: '2024-04-27',
    updatedAt: '2024-04-27',
  },
  {
    id: '2',
    name: '卧室场景',
    thumbnail: 'https://gw.alipayobjects.com/zos/rmsportal/JiqGstEfoWAOHiTxclqi.png',
    description: '一个舒适的卧室场景',
    createdAt: '2024-04-26',
    updatedAt: '2024-04-26',
  },
  {
    id: '3',
    name: '厨房场景',
    thumbnail: 'https://gw.alipayobjects.com/zos/rmsportal/JiqGstEfoWAOHiTxclqi.png',
    description: '一个实用的厨房场景',
    createdAt: '2024-04-25',
    updatedAt: '2024-04-25',
  },
];

// 编辑器组件类型
type EditorComponent = 'composition' | 'ui' | 'data';

const SceneEditor: React.FC = () => {
  const { sceneId } = useParams<{ sceneId: string }>();
  const navigate = useNavigate();
  const [scene, setScene] = useState<Scene | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeEditor, setActiveEditor] = useState<EditorComponent>('composition');

  useEffect(() => {
    // 模拟加载场景数据
    setLoading(true);
    setTimeout(() => {
      const foundScene = mockScenes.find(s => s.id === sceneId);
      if (foundScene) {
        setScene(foundScene);
      } else {
        message.error('场景不存在');
        navigate('/scenes');
      }
      setLoading(false);
    }, 500);
  }, [sceneId, navigate]);

  // 处理返回按钮点击
  const handleBack = () => {
    navigate('/scenes');
  };

  // 渲染编辑器内容
  const renderEditorContent = () => {
    switch (activeEditor) {
      case 'composition':
        return (
          <div >
            {/* <h2>场景组成</h2> */}
            <p>这里显示场景的组成元素，如模型、灯光、相机等</p>
            <div style={{ 
              height: '500px', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              backgroundColor: '#f0f0f0',
              borderRadius: '8px'
            }}>
              <p>网页端3D场景编辑器功能正在开发中...</p>
            </div>
          </div>
        );
      case 'ui':
        return (
          <div style={{ padding: '20px' }}>
            <h2>UI编辑</h2>
            <p>这里用于编辑场景的UI元素</p>
            <div style={{ 
              height: '500px', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              backgroundColor: '#f0f0f0',
              borderRadius: '8px'
            }}>
              <p>使用goview前端</p>
            </div>
          </div>
        );
      case 'data':
        return (
          <div style={{ padding: '20px' }}>
            <h2>数据编辑</h2>
            <p>这里用于编辑场景的数据属性</p>
            <div style={{ 
              height: '500px', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              backgroundColor: '#f0f0f0',
              borderRadius: '8px'
            }}>
              <p>数据编辑器</p>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh' 
      }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{ 
        background: '#fff', 
        padding: '0 16px', 
        display: 'flex', 
        alignItems: 'center',
        boxShadow: '0 1px 4px rgba(0, 21, 41, 0.08)'
      }}>
        <ArrowLeftOutlined 
          style={{ 
            fontSize: '18px', 
            marginRight: '16px', 
            cursor: 'pointer' 
          }} 
          onClick={handleBack}
        />
        <Title level={4} style={{ margin: 0 }}>
          {scene?.name || '场景编辑器'}
        </Title>
      </Header>
      <Layout>
        <Sider width={200} style={{ background: '#fff' }}>
          <Menu
            mode="inline"
            defaultSelectedKeys={['composition']}
            style={{ height: '100%', borderRight: 0 }}
            items={[
              {
                key: 'composition',
                icon: <AppstoreOutlined />,
                label: '场景组成',
                onClick: () => setActiveEditor('composition'),
              },
              {
                key: 'ui',
                icon: <EditOutlined />,
                label: 'UI编辑',
                onClick: () => setActiveEditor('ui'),
              },
              {
                key: 'data',
                icon: <DatabaseOutlined />,
                label: '数据编辑',
                onClick: () => setActiveEditor('data'),
              },
            ]}
          />
        </Sider>
        <Layout style={{ padding: '0 24px 24px' }}>
          <Content
            style={{
              background: '#fff',
              padding: 24,
              margin: '16px 0',
              minHeight: 280,
              borderRadius: '4px',
            }}
          >
            {renderEditorContent()}
          </Content>
        </Layout>
      </Layout>
    </Layout>
  );
};

export default SceneEditor; 