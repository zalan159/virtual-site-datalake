import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Button, Modal, Input, message, Space, Popconfirm } from 'antd';
import { EditOutlined, DeleteOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';

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

const SceneList: React.FC = () => {
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [renameModalVisible, setRenameModalVisible] = useState<boolean>(false);
  const [currentScene, setCurrentScene] = useState<Scene | null>(null);
  const [newSceneName, setNewSceneName] = useState<string>('');
  const navigate = useNavigate();

  useEffect(() => {
    // 模拟加载数据
    setLoading(true);
    setTimeout(() => {
      setScenes(mockScenes);
      setLoading(false);
    }, 500);
  }, []);

  // 处理场景点击，进入编辑页面
  const handleSceneClick = (scene: Scene) => {
    navigate(`/scenes/edit/${scene.id}`);
  };

  // 处理重命名场景
  const handleRenameScene = (scene: Scene) => {
    setCurrentScene(scene);
    setNewSceneName(scene.name);
    setRenameModalVisible(true);
  };

  // 确认重命名
  const confirmRename = () => {
    if (currentScene && newSceneName.trim()) {
      // 模拟API调用
      setScenes(scenes.map(scene => 
        scene.id === currentScene.id 
          ? { ...scene, name: newSceneName.trim() } 
          : scene
      ));
      message.success('场景重命名成功');
      setRenameModalVisible(false);
    }
  };

  // 处理删除场景
  const handleDeleteScene = (scene: Scene) => {
    Modal.confirm({
      title: '确认删除',
      icon: <ExclamationCircleOutlined />,
      content: `确定要删除场景"${scene.name}"吗？此操作不可恢复。`,
      okText: '确认',
      cancelText: '取消',
      onOk: () => {
        // 模拟API调用
        setScenes(scenes.filter(s => s.id !== scene.id));
        message.success('场景删除成功');
      },
    });
  };

  return (
    <div>
      <Row gutter={[16, 16]}>
        {scenes.map(scene => (
          <Col xs={24} sm={12} md={8} lg={6} key={scene.id}>
            <Card
              hoverable
              cover={
                <div 
                  style={{ 
                    height: 200, 
                    overflow: 'hidden',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: '#f0f0f0'
                  }}
                  onClick={() => handleSceneClick(scene)}
                >
                  <img 
                    alt={scene.name} 
                    src={scene.thumbnail} 
                    style={{ 
                      width: '100%', 
                      height: '100%', 
                      objectFit: 'cover' 
                    }} 
                  />
                </div>
              }
              actions={[
                <Button 
                  type="text" 
                  icon={<EditOutlined />} 
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRenameScene(scene);
                  }}
                >
                  重命名
                </Button>,
                <Popconfirm
                  title="确认删除"
                  description={`确定要删除场景"${scene.name}"吗？`}
                  onConfirm={(e) => {
                    e?.stopPropagation();
                    handleDeleteScene(scene);
                  }}
                  okText="确认"
                  cancelText="取消"
                >
                  <Button 
                    type="text" 
                    danger 
                    icon={<DeleteOutlined />} 
                    onClick={(e) => e.stopPropagation()}
                  >
                    删除
                  </Button>
                </Popconfirm>
              ]}
            >
              <Card.Meta
                title={scene.name}
                description={scene.description}
              />
            </Card>
          </Col>
        ))}
      </Row>

      {/* 重命名模态框 */}
      <Modal
        title="重命名场景"
        open={renameModalVisible}
        onOk={confirmRename}
        onCancel={() => setRenameModalVisible(false)}
      >
        <Input
          placeholder="请输入新的场景名称"
          value={newSceneName}
          onChange={(e) => setNewSceneName(e.target.value)}
        />
      </Modal>
    </div>
  );
};

export default SceneList; 