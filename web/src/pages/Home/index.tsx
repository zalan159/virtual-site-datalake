import { Card, Typography, Row, Col, Statistic } from 'antd';
import { FileOutlined, AppstoreOutlined, DatabaseOutlined } from '@ant-design/icons';
import { useEffect, useState } from 'react';
import { authAPI } from '../../services/api';

const { Title, Paragraph } = Typography;

const HomePage = () => {
  const [username, setUsername] = useState<string>('');
  const [stats, setStats] = useState({
    modelCount: 0,
    taskCount: 0,
    dataCount: 0
  });

  useEffect(() => {
    // 获取用户信息
    const fetchUserInfo = async () => {
      try {
        const response = await authAPI.getCurrentUser();
        setUsername(response.data.username);
      } catch (error) {
        console.error('获取用户信息失败', error);
      }
    };

    fetchUserInfo();
    
    // 这里可以添加获取统计数据的逻辑
    // 模拟数据
    setStats({
      modelCount: 12,
      taskCount: 5,
      dataCount: 8
    });
  }, []);

  return (
    <div>
      <Title level={2}>欢迎回来，{username}</Title>
      <Paragraph>这里是GLTF文件存储系统的主页，您可以在这里查看系统概览。</Paragraph>
      
      <Row gutter={16} style={{ marginTop: 24 }}>
        <Col span={8}>
          <Card>
            <Statistic
              title="模型总数"
              value={stats.modelCount}
              prefix={<FileOutlined />}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="任务总数"
              value={stats.taskCount}
              prefix={<AppstoreOutlined />}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="数据总数"
              value={stats.dataCount}
              prefix={<DatabaseOutlined />}
            />
          </Card>
        </Col>
      </Row>
      
      <Card style={{ marginTop: 24 }}>
        <Title level={4}>系统公告</Title>
        <Paragraph>
          欢迎使用GLTF文件存储系统，本系统提供以下功能：
        </Paragraph>
        <ul>
          <li>模型管理：上传、查看和管理您的GLTF模型文件</li>
          <li>任务管理：创建和管理模型处理任务</li>
          <li>数据管理：管理模型相关的元数据和附件</li>
        </ul>
      </Card>
    </div>
  );
};

export default HomePage; 