import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Button, Modal, Input, message, Space, Popconfirm } from 'antd';
import { EditOutlined, DeleteOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { getSceneList, renameScene, deleteScene, createScene } from '../../services/sceneApi';

// 场景类型定义
interface Scene {
  id: string;
  name: string;
  thumbnail?: string;
  description?: string;
  createdAt?: string;
  updatedAt?: string;
  owner?: string;
}

const SceneList: React.FC = () => {
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [renameModalVisible, setRenameModalVisible] = useState<boolean>(false);
  const [currentScene, setCurrentScene] = useState<Scene | null>(null);
  const [newSceneName, setNewSceneName] = useState<string>('');
  const [createModalVisible, setCreateModalVisible] = useState<boolean>(false);
  const [newCreateName, setNewCreateName] = useState<string>('');
  const navigate = useNavigate();

  useEffect(() => {
    setLoading(true);
    getSceneList()
      .then(res => {
        // 适配后端数据结构
        const data = Array.isArray(res.data) ? res.data : [];
        setScenes(
          data.map((item: any) => ({
            id: item.uid,
            name: item.name,
            thumbnail: item.preview_image || 'https://gw.alipayobjects.com/zos/rmsportal/JiqGstEfoWAOHiTxclqi.png',
            description: item.owner ? `拥有者: ${item.owner}` : '',
            createdAt: item.created_at,
            updatedAt: item.updated_at,
            owner: item.owner,
          }))
        );
      })
      .catch(() => {
        message.error('获取场景列表失败');
      })
      .finally(() => setLoading(false));
  }, []);

  // 处理场景点击，进入编辑页面
  const handleSceneClick = (scene: Scene) => {
    window.open(`/scene-editor/${scene.id}`, '_blank');
  };

  // 处理重命名场景
  const handleRenameScene = (scene: Scene) => {
    setCurrentScene(scene);
    setNewSceneName(scene.name);
    setRenameModalVisible(true);
  };

  // 确认重命名
  const confirmRename = async () => {
    if (currentScene && newSceneName.trim()) {
      try {
        await renameScene(currentScene.id, newSceneName.trim());
        setScenes(scenes.map(scene =>
          scene.id === currentScene.id
            ? { ...scene, name: newSceneName.trim() }
            : scene
        ));
        message.success('场景重命名成功');
        setRenameModalVisible(false);
      } catch {
        message.error('重命名失败');
      }
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
      onOk: async () => {
        try {
          await deleteScene(scene.id);
          setScenes(scenes.filter(s => s.id !== scene.id));
          message.success('场景删除成功');
        } catch {
          message.error('删除失败');
        }
      },
    });
  };

  // 新建场景提交
  const handleCreateScene = async () => {
    if (!newCreateName.trim()) {
      message.warning('请输入场景名称');
      return;
    }
    try {
      await createScene(newCreateName.trim());
      setCreateModalVisible(false);
      setNewCreateName('');
      // 重新加载场景列表
      setLoading(true);
      getSceneList()
        .then(res => {
          const data = Array.isArray(res.data) ? res.data : [];
          setScenes(
            data.map((item: any) => ({
              id: item.uid,
              name: item.name,
              thumbnail: item.preview_image || 'https://gw.alipayobjects.com/zos/rmsportal/JiqGstEfoWAOHiTxclqi.png',
              description: item.owner ? `拥有者: ${item.owner}` : '',
              createdAt: item.created_at,
              updatedAt: item.updated_at,
              owner: item.owner,
            }))
          );
        })
        .catch(() => {
          message.error('获取场景列表失败');
        })
        .finally(() => setLoading(false));
      message.success('新建场景成功');
    } catch {
      message.error('新建场景失败');
    }
  };

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 18, fontWeight: 500 }}>场景列表</span>
        <Button type="primary" onClick={() => setCreateModalVisible(true)}>新建场景</Button>
      </div>
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

      {/* 新建场景模态框 */}
      <Modal
        title="新建场景"
        open={createModalVisible}
        onOk={handleCreateScene}
        onCancel={() => setCreateModalVisible(false)}
      >
        <Input
          placeholder="请输入场景名称"
          value={newCreateName}
          onChange={e => setNewCreateName(e.target.value)}
        />
      </Modal>

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