import React, { useState, useEffect } from 'react';
import { Card, Input, Button, Modal, Form, message, Row, Col, Space, Spin, Pagination } from 'antd';
import { SearchOutlined, DownloadOutlined, EyeOutlined } from '@ant-design/icons';
import sketchfabService from '../../services/sketchfabApi';

const { Search } = Input;

const Store: React.FC = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [models, setModels] = useState<any[]>([]);
  const [token, setToken] = useState<string>('');
  const [loginModalVisible, setLoginModalVisible] = useState(true);
  const [searchValue, setSearchValue] = useState('');
  const [downloading, setDownloading] = useState<string | null>(null);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 24,
    total: 0,
  });

  // 处理登录
  const handleLogin = async (values: any) => {
    try {
      console.log('开始Sketchfab登录流程:', { username: values.username });
      setLoading(true);
      const response = await sketchfabService.getAccessToken(values.username, values.password);
      console.log('Sketchfab登录成功，获取到token:', response.access_token.substring(0, 10) + '...');
      setToken(response.access_token);
      localStorage.setItem('sketchfab_token', response.access_token);
      setLoginModalVisible(false);
      message.success('登录成功');
      fetchModels();
    } catch (error) {
      console.error('Sketchfab登录失败:', error);
      message.error('登录失败，请检查用户名和密码');
    } finally {
      setLoading(false);
    }
  };

  // 获取模型列表
  const fetchModels = async (search?: string, page: number = 1) => {
    try {
      console.log('开始获取Sketchfab模型列表:', { search, page });
      setLoading(true);
      const response = await sketchfabService.searchModels(token, search, page, pagination.pageSize);
      console.log('获取到Sketchfab模型列表:', response.results.length + '个模型');
      setModels(response.results);
      setPagination({
        ...pagination,
        current: page,
        total: response.count,
      });
    } catch (error) {
      console.error('获取Sketchfab模型列表失败:', error);
      message.error('获取模型列表失败');
    } finally {
      setLoading(false);
    }
  };

  // 处理搜索
  const handleSearch = (value: string) => {
    console.log('搜索Sketchfab模型:', value);
    setSearchValue(value);
    fetchModels(value, 1);
  };

  // 处理分页变化
  const handlePageChange = (page: number) => {
    console.log('切换Sketchfab模型列表页码:', page);
    fetchModels(searchValue, page);
  };

  // 处理下载
  const handleDownload = async (uid: string) => {
    try {
      console.log('开始下载Sketchfab模型:', uid);
      setDownloading(uid);
      const response = await sketchfabService.downloadModel(uid, token);
      console.log('Sketchfab模型下载成功:', response);
      message.success(`模型下载成功，文件路径: ${response.file_path}`);
    } catch (error) {
      console.error('Sketchfab模型下载失败:', error);
      message.error('模型下载失败');
    } finally {
      setDownloading(null);
    }
  };

  // 处理预览
  const handlePreview = (uid: string) => {
    console.log('预览Sketchfab模型:', uid);
    window.open(`https://sketchfab.com/3d-models/${uid}`, '_blank');
  };

  // 检查是否有保存的token
  useEffect(() => {
    const savedToken = localStorage.getItem('sketchfab_token');
    if (savedToken) {
      console.log('从本地存储恢复Sketchfab token');
      setToken(savedToken);
      setLoginModalVisible(false);
      fetchModels();
    }
  }, []);

  return (
    <div>
      <Modal
        title="Sketchfab登录"
        open={loginModalVisible}
        footer={null}
        closable={false}
      >
        <Form form={form} onFinish={handleLogin}>
          <Form.Item
            name="username"
            rules={[{ required: true, message: '请输入用户名' }]}
          >
            <Input placeholder="用户名" />
          </Form.Item>
          <Form.Item
            name="password"
            rules={[{ required: true, message: '请输入密码' }]}
          >
            <Input.Password placeholder="密码" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} block>
              登录
            </Button>
          </Form.Item>
        </Form>
      </Modal>

      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Search
          placeholder="搜索模型"
          onSearch={handleSearch}
          style={{ width: 400 }}
          loading={loading}
        />
        <Button 
          type="primary" 
          onClick={() => setLoginModalVisible(true)}
          disabled={!!token}
        >
          切换账号
        </Button>
      </div>

      <Spin spinning={loading}>
        <Row gutter={[16, 16]}>
          {models.map((model) => (
            <Col xs={24} sm={12} md={8} lg={6} key={model.uid}>
              <Card
                hoverable
                cover={
                  <img
                    alt={model.name}
                    src={model.thumbnails?.images?.[0]?.url}
                    style={{ height: 200, objectFit: 'cover' }}
                  />
                }
                actions={[
                  <Button
                    icon={<EyeOutlined />}
                    onClick={() => handlePreview(model.uid)}
                  >
                    预览
                  </Button>,
                  <Button
                    icon={<DownloadOutlined />}
                    loading={downloading === model.uid}
                    onClick={() => handleDownload(model.uid)}
                  >
                    下载
                  </Button>,
                ]}
              >
                <Card.Meta
                  title={model.name}
                  description={
                    <div>
                      <p>作者: {model.user?.displayName}</p>
                      <p>点赞: {model.likeCount}</p>
                      <p>查看: {model.viewCount}</p>
                    </div>
                  }
                />
              </Card>
            </Col>
          ))}
        </Row>
        
        {models.length > 0 && (
          <div style={{ marginTop: 16, textAlign: 'center' }}>
            <Pagination
              current={pagination.current}
              pageSize={pagination.pageSize}
              total={pagination.total}
              onChange={handlePageChange}
              showSizeChanger={false}
            />
          </div>
        )}
      </Spin>
    </div>
  );
};

export default Store; 