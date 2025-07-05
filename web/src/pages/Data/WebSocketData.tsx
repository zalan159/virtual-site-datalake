import React, { useState, useEffect } from 'react';
import {
  Table,
  Button,
  Modal,
  Form,
  Input,
  Select,
  Switch,
  message,
  Popconfirm,
  Tag,
  Space,
  Card,
  Descriptions,
  Divider,
  Typography,
  Row,
  Col,
  Badge,
  List,
  Avatar,
  Dropdown,
  Menu,
} from 'antd';
import type { Breakpoint } from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  EyeOutlined,
  MessageOutlined,
  ReloadOutlined,
  SendOutlined,
  DisconnectOutlined,
  ClearOutlined,
  CommentOutlined,
  MoreOutlined,
} from '@ant-design/icons';
import {
  websocketAPI,
  WebSocketDataSource,
  WebSocketCreateData,
  WebSocketUpdateData,
} from '../../services/websocketApi';
import { useWebSocketConnection, WebSocketMessage } from '../../hooks';

const { Option } = Select;
const { TextArea } = Input;
const { Text } = Typography;

// WebSocket对话组件
const WebSocketChat: React.FC<{
  visible: boolean;
  websocketData: WebSocketDataSource | null;
  onClose: () => void;
}> = ({ visible, websocketData, onClose }) => {
  const [messageText, setMessageText] = useState('');

  // 使用WebSocket连接hook
  const {
    connect,
    disconnect,
    sendMessage,
    isConnected,
    isConnecting,
    messages,
    clearMessages,
    error,
    connectionAttempts
  } = useWebSocketConnection({
    url: websocketData?.url || '',
    protocols: websocketData?.protocols,
    auth_type: websocketData?.auth_type,
    auth_username: websocketData?.auth_username,
    auth_password: websocketData?.auth_password,
    auth_token: websocketData?.auth_token,
    connection_timeout: websocketData?.connection_timeout,
    ping_interval: websocketData?.ping_interval,
    max_retries: websocketData?.max_retries,
    retry_delay: websocketData?.retry_delay,
  });

  // 处理modal关闭
  const handleClose = () => {
    // 关闭前先断开连接，这会停止所有重试任务
    if (isConnected || isConnecting) {
      disconnect();
    }
    onClose();
  };

  // 发送消息
  const handleSendMessage = () => {
    if (!messageText.trim()) {
      message.warning('请输入消息内容');
      return;
    }
    sendMessage(messageText);
    setMessageText('');
  };

  // 处理Enter键发送
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // 格式化时间
  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  // 获取连接状态颜色
  const getConnectionStatus = () => {
    if (isConnecting) {
      return { status: 'processing', text: '连接中...' };
    } else if (isConnected) {
      return { status: 'success', text: '已连接' };
    } else if (error) {
      return { status: 'error', text: `连接失败: ${error}` };
    } else {
      return { status: 'default', text: '未连接' };
    }
  };

  const status = getConnectionStatus();

  return (
    <Modal
      title={
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>WebSocket对话 - {websocketData?.name}</span>
          <Badge status={status.status as any} text={status.text} />
        </div>
      }
      open={visible}
      onCancel={handleClose}
      width={800}
      footer={null}
      destroyOnClose
    >
      <div style={{ height: '500px', display: 'flex', flexDirection: 'column' }}>
        {/* 连接信息 */}
        <Card size="small" style={{ marginBottom: '16px' }}>
          <Row gutter={16} align="middle">
            <Col flex="auto">
              <Text type="secondary">连接地址: </Text>
              <Text code style={{ fontSize: '12px' }}>{websocketData?.url}</Text>
            </Col>
            <Col>
              <Space>
                <Button
                  type={isConnected ? 'default' : 'primary'}
                  icon={isConnected ? <DisconnectOutlined /> : <SendOutlined />}
                  onClick={isConnected ? disconnect : connect}
                  loading={isConnecting}
                >
                  {isConnected ? '断开连接' : '连接'}
                </Button>
                <Button
                  icon={<ClearOutlined />}
                  onClick={clearMessages}
                  disabled={messages.length === 0}
                >
                  清空消息
                </Button>
              </Space>
            </Col>
          </Row>
          {connectionAttempts > 0 && !isConnected && (
            <div style={{ marginTop: '8px' }}>
              <Text type="warning">连接尝试次数: {connectionAttempts}</Text>
            </div>
          )}
          {error && (
            <div style={{ marginTop: '8px', padding: '8px', backgroundColor: '#fff2f0', borderRadius: '4px', border: '1px solid #ffccc7' }}>
              <Text type="danger">错误: {error}</Text>
              {error.includes('1006') && (
                <div style={{ marginTop: '4px' }}>
                  <Text type="secondary" style={{ fontSize: '12px' }}>
                    常见解决方案: 
                    <br />• 检查网络连接和防火墙设置
                    <br />• 确认WebSocket服务器正在运行
                    <br />• 如果是wss://，请确保SSL证书有效
                    <br />• 尝试使用不同的测试服务器
                  </Text>
                </div>
              )}
            </div>
          )}
        </Card>

        {/* 消息列表 */}
        <div style={{ flex: 1, border: '1px solid #d9d9d9', borderRadius: '6px', overflow: 'hidden' }}>
          <div style={{ 
            height: '100%', 
            padding: '16px', 
            overflowY: 'auto',
            backgroundColor: '#fafafa'
          }}>
            {messages.length === 0 ? (
              <div style={{ 
                height: '100%', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                color: '#999'
              }}>
                <div style={{ textAlign: 'center' }}>
                  <CommentOutlined style={{ fontSize: '48px', marginBottom: '16px' }} />
                  <div>暂无消息，连接WebSocket后开始对话</div>
                </div>
              </div>
            ) : (
              <List
                dataSource={messages}
                renderItem={(msg: WebSocketMessage) => (
                  <List.Item style={{ 
                    padding: '8px 0',
                    border: 'none',
                    justifyContent: msg.direction === 'sent' ? 'flex-end' : 'flex-start'
                  }}>
                    <div style={{
                      maxWidth: '70%',
                      display: 'flex',
                      flexDirection: msg.direction === 'sent' ? 'row-reverse' : 'row',
                      alignItems: 'flex-start',
                      gap: '8px'
                    }}>
                      <Avatar 
                        size="small"
                        style={{ 
                          backgroundColor: msg.direction === 'sent' ? '#1890ff' : '#52c41a',
                          flexShrink: 0
                        }}
                      >
                        {msg.direction === 'sent' ? '我' : 'WS'}
                      </Avatar>
                      <div style={{
                        padding: '8px 12px',
                        borderRadius: '8px',
                        backgroundColor: msg.direction === 'sent' ? '#1890ff' : '#ffffff',
                        color: msg.direction === 'sent' ? '#ffffff' : '#000000',
                        border: msg.direction === 'received' ? '1px solid #d9d9d9' : 'none',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                      }}>
                        <div style={{ marginBottom: '4px' }}>
                          {msg.type === 'system' ? (
                            <Text italic style={{ color: msg.direction === 'sent' ? '#ffffff' : '#666' }}>
                              {msg.content}
                            </Text>
                          ) : (
                            <span>{msg.content}</span>
                          )}
                        </div>
                        <div style={{ 
                          fontSize: '11px', 
                          opacity: 0.7,
                          textAlign: msg.direction === 'sent' ? 'right' : 'left'
                        }}>
                          {formatTime(msg.timestamp)}
                        </div>
                      </div>
                    </div>
                  </List.Item>
                )}
              />
            )}
          </div>
        </div>

        {/* 消息输入 */}
        <div style={{ marginTop: '16px' }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            <TextArea
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="输入消息内容，按Enter发送，Shift+Enter换行"
              rows={3}
              disabled={!isConnected}
              style={{ flex: 1 }}
            />
            <Button
              type="primary"
              icon={<SendOutlined />}
              onClick={handleSendMessage}
              disabled={!isConnected || !messageText.trim()}
              size="large"
              style={{ alignSelf: 'flex-end' }}
            >
              发送
            </Button>
          </div>
          {!isConnected && (
            <div style={{ marginTop: '8px' }}>
              <Text type="secondary">请先连接WebSocket再发送消息</Text>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};

const WebSocketData: React.FC = () => {
  const [websockets, setWebSockets] = useState<WebSocketDataSource[]>([]);
  const [loading, setLoading] = useState(false);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [formModalVisible, setFormModalVisible] = useState(false);
  const [chatModalVisible, setChatModalVisible] = useState(false);
  const [selectedWebSocket, setSelectedWebSocket] = useState<WebSocketDataSource | null>(null);
  const [editingWebSocket, setEditingWebSocket] = useState<WebSocketDataSource | null>(null);
  const [form] = Form.useForm();

  useEffect(() => {
    fetchWebSockets();
  }, []);

  const fetchWebSockets = async () => {
    setLoading(true);
    try {
      const response = await websocketAPI.getWebSocketList();
      // 在这里进行数据转换，将 _id 映射到 id
      const transformedData = response.data.map((item: any) => ({
        ...item,
        id: item._id, // 确保id字段存在
      }));
      setWebSockets(transformedData || []);
    } catch (error) {
      message.error('获取WebSocket列表失败');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingWebSocket(null);
    form.resetFields();
    setFormModalVisible(true);
  };

  const handleEdit = (record: WebSocketDataSource) => {
    setEditingWebSocket(record);
    form.setFieldsValue({
      ...record,
      tags: record.tags?.join(', ') || '',
    });
    setFormModalVisible(true);
  };

  const handleDelete = async (id: string) => {
    try {
      await websocketAPI.deleteWebSocket(id);
      message.success('删除成功');
      fetchWebSockets();
    } catch (error) {
      message.error('删除失败');
    }
  };

  const handleFormSubmit = async (values: any) => {
    try {
      const data: WebSocketCreateData | WebSocketUpdateData = {
        ...values,
        tags: values.tags ? values.tags.split(',').map((tag: string) => tag.trim()).filter(Boolean) : [],
      };

      if (editingWebSocket) {
        await websocketAPI.updateWebSocket(editingWebSocket.id, data);
        message.success('更新成功');
      } else {
        await websocketAPI.createWebSocket(data as WebSocketCreateData);
        message.success('创建成功');
      }

      setFormModalVisible(false);
      fetchWebSockets();
    } catch (error) {
      message.error(editingWebSocket ? '更新失败' : '创建失败');
    }
  };

  const handleViewDetails = (record: WebSocketDataSource) => {
    setSelectedWebSocket(record);
    setDetailModalVisible(true);
  };

  const handleStartChat = (record: WebSocketDataSource) => {
    setSelectedWebSocket(record);
    setChatModalVisible(true);
  };

  const columns = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      width: 200,
      fixed: 'left' as const,
      render: (text: string, record: WebSocketDataSource) => (
        <div>
          <div>{text}</div>
          <Text type="secondary" style={{ fontSize: '12px' }}>
            {record.id}
          </Text>
        </div>
      ),
    },
    {
      title: 'WebSocket URL',
      dataIndex: 'url',
      key: 'url',
      width: 300,
      ellipsis: true,
      render: (url: string) => (
        <Text code style={{ fontSize: '12px' }}>{url}</Text>
      ),
    },
    {
      title: '认证类型',
      dataIndex: 'auth_type',
      key: 'auth_type',
      width: 100,
      render: (authType: string) => (
        <Tag color={authType === 'none' ? 'default' : 'blue'}>
          {authType || '无认证'}
        </Tag>
      ),
    },
    {
      title: '连接配置',
      dataIndex: 'connection_timeout',
      key: 'connection_config',
      width: 120,
      render: (_: any, record: WebSocketDataSource) => (
        <div style={{ fontSize: '12px', lineHeight: '1.2' }}>
          <div>超时: {record.connection_timeout || 10}s</div>
          <div>心跳: {record.ping_interval || 0}s</div>
          <div>重试: {record.max_retries || 3}次</div>
        </div>
      ),
    },
    {
      title: '标签',
      dataIndex: 'tags',
      key: 'tags',
      width: 150,
      responsive: ['md'] as Breakpoint[],
      render: (tags: string[]) => (
        <>
          {tags?.map((tag) => (
            <Tag key={tag} color="blue" style={{ fontSize: '11px' }}>
              {tag}
            </Tag>
          ))}
        </>
      ),
    },
    {
      title: '可见性',
      dataIndex: 'is_public',
      key: 'is_public',
      width: 80,
      responsive: ['lg'] as Breakpoint[],
      render: (isPublic: boolean) => (
        <Tag color={isPublic ? 'green' : 'orange'}>
          {isPublic ? '公开' : '私有'}
        </Tag>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 160,
      responsive: ['lg'] as Breakpoint[],
      render: (text: string) => (
        <div style={{ fontSize: '12px' }}>
          {new Date(text).toLocaleString()}
        </div>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      fixed: 'right' as const,
      render: (_: any, record: WebSocketDataSource) => {
        const menuItems = [
          {
            key: 'view',
            icon: <EyeOutlined />,
            label: '查看详情',
            onClick: () => handleViewDetails(record),
          },
          {
            key: 'edit',
            icon: <EditOutlined />,
            label: '编辑',
            onClick: () => handleEdit(record),
          },
          {
            type: 'divider' as const,
          },
          {
            key: 'delete',
            icon: <DeleteOutlined />,
            label: '删除',
            danger: true,
            onClick: () => {
              Modal.confirm({
                title: '确定要删除这个WebSocket数据源吗？',
                content: '删除后将无法恢复',
                okText: '确定',
                cancelText: '取消',
                okType: 'danger',
                onOk: () => handleDelete(record.id),
              });
            },
          },
        ];

        return (
          <Space size="small">
            <Button
              type="primary"
              icon={<MessageOutlined />}
              onClick={() => handleStartChat(record)}
              size="small"
            >
              对话
            </Button>
            <Dropdown
              menu={{ items: menuItems }}
              trigger={['click']}
              placement="bottomRight"
              arrow
            >
              <Button
                type="text"
                icon={<MoreOutlined />}
                size="small"
                style={{ 
                  padding: '4px 8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
                title="更多操作"
              />
            </Dropdown>
          </Space>
        );
      },
    },
  ];

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ 
        marginBottom: '16px', 
        display: 'flex', 
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        <h2 style={{ margin: 0 }}>WebSocket数据源管理</h2>
        <Space wrap>
          <Button
            icon={<ReloadOutlined />}
            onClick={fetchWebSockets}
          >
            刷新
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleCreate}
          >
            添加WebSocket
          </Button>
        </Space>
      </div>

      <Table
        columns={columns}
        dataSource={websockets}
        rowKey="id"
        loading={loading}
        scroll={{ x: 1300 }}
        pagination={{
          total: websockets.length,
          pageSize: 10,
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (total) => `共 ${total} 条记录`,
        }}
      />

      {/* 详情模态框 */}
      <Modal
        title="WebSocket数据源详情"
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={null}
        width={800}
      >
        {selectedWebSocket && (
          <Card>
            <Descriptions bordered column={2}>
              <Descriptions.Item label="名称" span={2}>
                {selectedWebSocket.name}
              </Descriptions.Item>
              <Descriptions.Item label="描述" span={2}>
                {selectedWebSocket.description || '无'}
              </Descriptions.Item>
              <Descriptions.Item label="WebSocket URL" span={2}>
                <Text code>{selectedWebSocket.url}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="认证类型">
                <Tag color={selectedWebSocket.auth_type === 'none' ? 'default' : 'blue'}>
                  {selectedWebSocket.auth_type || '无认证'}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="连接超时">
                {selectedWebSocket.connection_timeout || 10} 秒
              </Descriptions.Item>
              <Descriptions.Item label="Ping间隔">
                {selectedWebSocket.ping_interval || 30} 秒
              </Descriptions.Item>
              <Descriptions.Item label="最大重试">
                {selectedWebSocket.max_retries || 3} 次
              </Descriptions.Item>
              <Descriptions.Item label="可见性">
                <Tag color={selectedWebSocket.is_public ? 'green' : 'orange'}>
                  {selectedWebSocket.is_public ? '公开' : '私有'}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="协议" span={2}>
                {selectedWebSocket.protocols ? (
                  selectedWebSocket.protocols.map(protocol => (
                    <Tag key={protocol}>{protocol}</Tag>
                  ))
                ) : '默认'}
              </Descriptions.Item>
              <Descriptions.Item label="标签" span={2}>
                {selectedWebSocket.tags?.map((tag) => (
                  <Tag key={tag} color="blue">{tag}</Tag>
                ))}
              </Descriptions.Item>
              <Descriptions.Item label="创建时间">
                {new Date(selectedWebSocket.created_at).toLocaleString()}
              </Descriptions.Item>
              <Descriptions.Item label="更新时间">
                {new Date(selectedWebSocket.updated_at).toLocaleString()}
              </Descriptions.Item>
            </Descriptions>
          </Card>
        )}
      </Modal>

      {/* 创建/编辑模态框 */}
      <Modal
        title={editingWebSocket ? '编辑WebSocket数据源' : '创建WebSocket数据源'}
        open={formModalVisible}
        onCancel={() => setFormModalVisible(false)}
        onOk={form.submit}
        width={800}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleFormSubmit}
          initialValues={{
            is_public: true,
            auth_type: 'none',
            connection_timeout: 10,
            ping_interval: 0, // 默认禁用心跳，避免对简单服务器造成干扰
            ping_timeout: 10,
            max_retries: 3,
            retry_delay: 5,
          }}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="name"
                label="名称"
                rules={[{ required: true, message: '请输入名称' }]}
              >
                <Input placeholder="请输入WebSocket名称" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="is_public" label="可见性" valuePropName="checked">
                <Switch checkedChildren="公开" unCheckedChildren="私有" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="url"
            label="WebSocket URL"
            rules={[
              { required: true, message: '请输入WebSocket URL' },
              { pattern: /^wss?:\/\//, message: '请输入有效的WebSocket URL (ws:// 或 wss://)' },
            ]}
            extra={
              <div style={{ marginTop: '4px' }}>
                <Text type="secondary" style={{ fontSize: '12px' }}>
                  测试服务器推荐：
                  <br />• <Text code>wss://echo.websocket.org/</Text> - WebSocket.org Echo (稳定)
                  <br />• <Text code>wss://ws.postman-echo.com/raw</Text> - Postman Echo
                  <br />• <Text code>ws://localhost:8080</Text> - 本地测试服务器
                  <br />• <Text code>wss://websocket-echo-server.herokuapp.com</Text> - Heroku Echo
                </Text>
              </div>
            }
          >
            <Input placeholder="wss://echo.websocket.org/" />
          </Form.Item>

          <Form.Item name="description" label="描述">
            <TextArea rows={3} placeholder="请输入描述信息" />
          </Form.Item>

          <Form.Item name="tags" label="标签">
            <Input placeholder="请输入标签，用逗号分隔" />
          </Form.Item>

          <Divider>认证配置</Divider>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="auth_type" label="认证类型">
                <Select>
                  <Option value="none">无认证</Option>
                  <Option value="basic">基础认证</Option>
                  <Option value="token">Token认证</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="auth_username" label="用户名">
                <Input placeholder="认证用户名" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="auth_password" label="密码">
                <Input.Password placeholder="认证密码" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="auth_token" label="Token">
            <Input placeholder="认证Token" />
          </Form.Item>

          <Divider>连接配置</Divider>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="connection_timeout" label="连接超时(秒)">
                <Input type="number" min={1} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item 
                name="ping_interval" 
                label="Ping间隔(秒)"
                extra="设置为0禁用心跳，推荐对echo服务器禁用"
              >
                <Input type="number" min={0} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="ping_timeout" label="Ping超时(秒)">
                <Input type="number" min={1} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="max_retries" label="最大重试次数">
                <Input type="number" min={0} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="retry_delay" label="重试延迟(秒)">
                <Input type="number" min={1} />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      {/* WebSocket对话模态框 */}
      <WebSocketChat
        visible={chatModalVisible}
        websocketData={selectedWebSocket}
        onClose={() => setChatModalVisible(false)}
      />
    </div>
  );
};

export default WebSocketData;