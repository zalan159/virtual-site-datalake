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

  Tag,
  Space,
  Card,
  Descriptions,
  Divider,
  Typography,
  Row,
  Col,
  Badge,
  InputNumber,
  Dropdown,

  Alert,
} from 'antd';
import type { Breakpoint } from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  EyeOutlined,
  ReloadOutlined,
  PlayCircleOutlined,
  MoreOutlined,
  SecurityScanOutlined,
  WifiOutlined,
  CloudOutlined,
} from '@ant-design/icons';
import {
  mqttAPI,
  MQTTDataSource,
  MQTTCreate,
  MQTTUpdate,
  MQTTTestResult,
} from '../../services/mqttApi';
import MQTTChat from '../../components/MQTTChat';

const { Option } = Select;
const { TextArea } = Input;
const { Text } = Typography;

const MQTTData: React.FC = () => {
  const [mqttList, setMqttList] = useState<MQTTDataSource[]>([]);
  const [loading, setLoading] = useState(false);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [formModalVisible, setFormModalVisible] = useState(false);
  const [testModalVisible, setTestModalVisible] = useState(false);
  const [chatModalVisible, setChatModalVisible] = useState(false);
  const [selectedMQTT, setSelectedMQTT] = useState<MQTTDataSource | null>(null);
  const [editingMQTT, setEditingMQTT] = useState<MQTTDataSource | null>(null);
  const [testResult, setTestResult] = useState<MQTTTestResult | null>(null);
  const [testLoading, setTestLoading] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    fetchMQTTList();
  }, []);

  const fetchMQTTList = async () => {
    setLoading(true);
    try {
      const response = await mqttAPI.getMQTTList();
      // 数据转换，将_id映射到id
      const transformedData = response.data.map((item: any) => ({
        ...item,
        id: item._id, // 确保id字段存在
      }));
      setMqttList(transformedData || []);
    } catch (error) {
      message.error('获取MQTT配置列表失败');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingMQTT(null);
    form.resetFields();
    setFormModalVisible(true);
  };

  const handleEdit = (record: MQTTDataSource) => {
    setEditingMQTT(record);
    form.setFieldsValue({
      ...record,
      tags: record.tags || [],
      topics: record.topics || [],
    });
    setFormModalVisible(true);
  };

  const handleDelete = async (id: string) => {
    try {
      await mqttAPI.deleteMQTT(id);
      message.success('删除成功');
      fetchMQTTList();
    } catch (error) {
      message.error('删除失败');
    }
  };

  const handleFormSubmit = async (values: any) => {
    try {
      const data: MQTTCreate | MQTTUpdate = {
        ...values,
        tags: Array.isArray(values.tags) ? values.tags : (values.tags ? [values.tags] : []),
        topics: Array.isArray(values.topics) ? values.topics : (values.topics ? [values.topics] : []),
      };

      if (editingMQTT) {
        await mqttAPI.updateMQTT(editingMQTT.id, data);
        message.success('更新成功');
      } else {
        await mqttAPI.createMQTT(data as MQTTCreate);
        message.success('创建成功');
      }

      setFormModalVisible(false);
      fetchMQTTList();
    } catch (error) {
      message.error(editingMQTT ? '更新失败' : '创建失败');
    }
  };

  const handleViewDetails = (record: MQTTDataSource) => {
    setSelectedMQTT(record);
    setDetailModalVisible(true);
  };

  const handleTestConnection = async (record: MQTTDataSource) => {
    setSelectedMQTT(record);
    setTestModalVisible(true);
    setTestLoading(true);
    try {
      const result = await mqttAPI.testMQTT(record.id);
      setTestResult(result.data);
    } catch (error) {
      message.error('测试连接失败');
    } finally {
      setTestLoading(false);
    }
  };

  const handleChatConnection = (record: MQTTDataSource) => {
    setSelectedMQTT(record);
    setChatModalVisible(true);
  };

  const columns = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      width: 200,
      fixed: 'left' as const,
      render: (text: string, record: MQTTDataSource) => (
        <div>
          <div style={{ fontWeight: 'bold' }}>{text}</div>
          <Text type="secondary" style={{ fontSize: '12px' }}>
            {record.id}
          </Text>
        </div>
      ),
    },
    {
      title: 'Broker地址',
      dataIndex: 'hostname',
      key: 'hostname',
      width: 200,
      render: (hostname: string, record: MQTTDataSource) => (
        <div>
          <div>{hostname}:{record.port}</div>
          <div style={{ fontSize: '11px', marginTop: '2px' }}>
            <Text type="secondary">
              WebSocket: {record.use_tls ? 'wss' : 'ws'}://{hostname}:{record.port}{record.websocket_path || '/mqtt'}
            </Text>
          </div>
          <Text type="secondary" style={{ fontSize: '12px', marginTop: '4px' }}>
            {record.use_tls ? (
              <Tag color="green">
                <SecurityScanOutlined /> TLS
              </Tag>
            ) : (
              <Tag color="orange">
                <WifiOutlined /> TCP
              </Tag>
            )}
          </Text>
        </div>
      ),
    },
    {
      title: '认证类型',
      dataIndex: 'auth_type',
      key: 'auth_type',
      width: 120,
      render: (authType: string, record: MQTTDataSource) => (
        <div>
          <Tag color={authType === 'none' ? 'default' : 'blue'}>
            {authType || '无认证'}
          </Tag>
          {record.username && (
            <div style={{ fontSize: '12px', marginTop: '4px' }}>
              <Text type="secondary">用户: {record.username}</Text>
            </div>
          )}
        </div>
      ),
    },
    {
      title: '连接配置',
      dataIndex: 'connection_timeout',
      key: 'connection_config',
      width: 140,
      render: (_: any, record: MQTTDataSource) => (
        <div style={{ fontSize: '12px', lineHeight: '1.4' }}>
          <div>超时: {record.connection_timeout || 10}s</div>
          <div>心跳: {record.keep_alive || 60}s</div>
          <div>重试: {record.max_retries || 3}次</div>
          <div>QoS: {record.default_qos || 0}</div>
        </div>
      ),
    },
    {
      title: '订阅主题',
      dataIndex: 'topics',
      key: 'topics',
      width: 200,
      responsive: ['md'] as Breakpoint[],
      render: (topics: string[]) => (
        <div style={{ maxHeight: '60px', overflow: 'auto' }}>
          {topics?.map((topic) => (
            <Tag key={topic} color="purple" style={{ fontSize: '11px', marginBottom: '2px' }}>
              {topic}
            </Tag>
          ))}
          {(!topics || topics.length === 0) && (
            <Text type="secondary" style={{ fontSize: '11px' }}>未配置</Text>
          )}
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
      render: (_: any, record: MQTTDataSource) => {
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
                title: '确定要删除这个MQTT配置吗？',
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
              icon={<CloudOutlined />}
              onClick={() => handleChatConnection(record)}
              size="small"
            >
              连接测试
            </Button>
            <Dropdown
              menu={{ items: [
                {
                  key: 'validate',
                  icon: <PlayCircleOutlined />,
                  label: '配置验证',
                  onClick: () => handleTestConnection(record),
                },
                ...menuItems
              ]}}
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
        <div>
          <h2 style={{ margin: 0 }}>MQTT连接配置管理</h2>
          <Text type="secondary">管理MQTT Broker连接配置，支持前端直连模式</Text>
        </div>
        <Space wrap>
          <Button
            icon={<ReloadOutlined />}
            onClick={fetchMQTTList}
          >
            刷新
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleCreate}
          >
            添加MQTT配置
          </Button>
        </Space>
      </div>

      <Table
        columns={columns}
        dataSource={mqttList}
        rowKey="id"
        loading={loading}
        scroll={{ x: 1400 }}
        pagination={{
          total: mqttList.length,
          pageSize: 10,
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (total) => `共 ${total} 条记录`,
        }}
      />

      {/* 详情模态框 */}
      <Modal
        title="MQTT配置详情"
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={null}
        width={800}
      >
        {selectedMQTT && (
          <Card>
            <Descriptions bordered column={2}>
              <Descriptions.Item label="名称" span={2}>
                {selectedMQTT.name}
              </Descriptions.Item>
              <Descriptions.Item label="描述" span={2}>
                {selectedMQTT.description || '无'}
              </Descriptions.Item>
              <Descriptions.Item label="Broker地址">
                {selectedMQTT.hostname}:{selectedMQTT.port}
              </Descriptions.Item>
              <Descriptions.Item label="WebSocket路径">
                {selectedMQTT.websocket_path || '/mqtt'}
              </Descriptions.Item>
              <Descriptions.Item label="TLS加密">
                <Tag color={selectedMQTT.use_tls ? 'green' : 'orange'}>
                  {selectedMQTT.use_tls ? '启用' : '禁用'}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="认证类型">
                <Tag color={selectedMQTT.auth_type === 'none' ? 'default' : 'blue'}>
                  {selectedMQTT.auth_type || '无认证'}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="用户名">
                {selectedMQTT.username || '无'}
              </Descriptions.Item>
              <Descriptions.Item label="客户端ID">
                {selectedMQTT.client_id || '自动生成'}
              </Descriptions.Item>
              <Descriptions.Item label="保持连接">
                {selectedMQTT.keep_alive || 60} 秒
              </Descriptions.Item>
              <Descriptions.Item label="连接超时">
                {selectedMQTT.connection_timeout || 10} 秒
              </Descriptions.Item>
              <Descriptions.Item label="最大重试">
                {selectedMQTT.max_retries || 3} 次
              </Descriptions.Item>
              <Descriptions.Item label="默认QoS">
                {selectedMQTT.default_qos || 0}
              </Descriptions.Item>
              <Descriptions.Item label="清理会话">
                <Tag color={selectedMQTT.clean_session ? 'green' : 'orange'}>
                  {selectedMQTT.clean_session ? '是' : '否'}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="可见性">
                <Tag color={selectedMQTT.is_public ? 'green' : 'orange'}>
                  {selectedMQTT.is_public ? '公开' : '私有'}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="订阅主题" span={2}>
                {selectedMQTT.topics && selectedMQTT.topics.length > 0 ? (
                  selectedMQTT.topics.map((topic) => (
                    <Tag key={topic} color="purple">{topic}</Tag>
                  ))
                ) : (
                  <Text type="secondary">未配置</Text>
                )}
              </Descriptions.Item>
              <Descriptions.Item label="标签" span={2}>
                {selectedMQTT.tags?.map((tag) => (
                  <Tag key={tag} color="blue">{tag}</Tag>
                ))}
              </Descriptions.Item>
              <Descriptions.Item label="创建时间">
                {new Date(selectedMQTT.created_at).toLocaleString()}
              </Descriptions.Item>
              <Descriptions.Item label="更新时间">
                {new Date(selectedMQTT.updated_at).toLocaleString()}
              </Descriptions.Item>
            </Descriptions>
          </Card>
        )}
      </Modal>

      {/* 测试连接模态框 */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <PlayCircleOutlined style={{ marginRight: '8px' }} />
            连接测试 - {selectedMQTT?.name}
          </div>
        }
        open={testModalVisible}
        onCancel={() => setTestModalVisible(false)}
        footer={null}
        width={600}
      >
        {selectedMQTT && (
          <div>
            <Alert
              message="前端驱动连接测试"
              description="后端仅提供配置验证，实际连接测试需要在前端进行。"
              type="info"
              showIcon
              style={{ marginBottom: '16px' }}
            />
            
            <Card size="small" style={{ marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CloudOutlined />
                <Text strong>连接地址: </Text>
                <Text code>
                  {selectedMQTT.use_tls ? 'wss://' : 'ws://'}
                  {selectedMQTT.hostname}:{selectedMQTT.port}{selectedMQTT.websocket_path || '/mqtt'}
                </Text>
              </div>
            </Card>

            {testLoading ? (
              <div style={{ textAlign: 'center', padding: '20px' }}>
                <Badge status="processing" text="正在验证配置..." />
              </div>
            ) : testResult ? (
              <div>
                <div style={{ marginBottom: '16px' }}>
                  <Badge 
                    status={testResult.validation.valid ? 'success' : 'error'} 
                    text={testResult.validation.valid ? '配置验证通过' : '配置验证失败'}
                  />
                </div>
                
                {testResult.validation.errors.length > 0 && (
                  <Alert
                    message="配置错误"
                    description={
                      <ul style={{ margin: 0, paddingLeft: '20px' }}>
                        {testResult.validation.errors.map((error, index) => (
                          <li key={index}>{error}</li>
                        ))}
                      </ul>
                    }
                    type="error"
                    style={{ marginBottom: '16px' }}
                  />
                )}

                {testResult.validation.warnings.length > 0 && (
                  <Alert
                    message="配置警告"
                    description={
                      <ul style={{ margin: 0, paddingLeft: '20px' }}>
                        {testResult.validation.warnings.map((warning, index) => (
                          <li key={index}>{warning}</li>
                        ))}
                      </ul>
                    }
                    type="warning"
                    style={{ marginBottom: '16px' }}
                  />
                )}

                <Card size="small">
                  <Text type="secondary">{testResult.message}</Text>
                </Card>
              </div>
            ) : null}
          </div>
        )}
      </Modal>

      {/* 创建/编辑模态框 */}
      <Modal
        title={editingMQTT ? '编辑MQTT配置' : '创建MQTT配置'}
        open={formModalVisible}
        onCancel={() => setFormModalVisible(false)}
        onOk={form.submit}
        width={900}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleFormSubmit}
          initialValues={{
            is_public: true,
            port: 1883,
            websocket_path: '/mqtt',
            auth_type: 'none',
            use_tls: false,
            tls_insecure: false,
            clean_session: true,
            keep_alive: 60,
            connection_timeout: 10,
            max_retries: 3,
            retry_delay: 5,
            default_qos: 0,
            max_inflight_messages: 20,
            max_queued_messages: 0,
          }}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="name"
                label="配置名称"
                rules={[{ required: true, message: '请输入配置名称' }]}
              >
                <Input placeholder="请输入MQTT配置名称" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="is_public" label="可见性" valuePropName="checked">
                <Switch checkedChildren="公开" unCheckedChildren="私有" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="hostname"
                label="Broker地址"
                rules={[
                  { required: true, message: '请输入Broker地址' },
                  {
                    validator: (_, value) => {
                      if (value && value.includes('/')) {
                        return Promise.reject(new Error('请只输入主机名，不要包含路径（如：broker.emqx.io）'));
                      }
                      return Promise.resolve();
                    }
                  }
                ]}
                extra="仅支持WebSocket over MQTT协议，请只填写主机名，不要包含路径"
              >
                <Input placeholder="broker.emqx.io（仅主机名，不含路径）" />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item
                name="port"
                label="端口"
                rules={[{ required: true, message: '请输入端口' }]}
                extra="系统将自动转换为WebSocket端口"
              >
                <InputNumber min={1} max={65535} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item
                name="websocket_path"
                label="WebSocket路径"
                rules={[{ required: true, message: '请输入WebSocket路径' }]}
                extra="标准路径为 /mqtt"
              >
                <Input placeholder="/mqtt" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="description" label="描述">
            <TextArea rows={3} placeholder="请输入描述信息" />
          </Form.Item>

          <Form.Item name="tags" label="标签">
            <Select
              mode="tags"
              style={{ width: '100%' }}
              placeholder="请输入标签，按回车添加"
              tokenSeparators={[',']}
              allowClear
            />
          </Form.Item>

          <Form.Item name="topics" label="订阅主题">
            <Select
              mode="tags"
              style={{ width: '100%' }}
              placeholder="请输入MQTT主题，按回车添加，如：sensor/temperature"
              tokenSeparators={[',']}
              allowClear
            />
          </Form.Item>

          <Divider>连接配置</Divider>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="client_id" label="客户端ID">
                <Input placeholder="留空则自动生成" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="clean_session" label="清理会话" valuePropName="checked">
                <Switch checkedChildren="是" unCheckedChildren="否" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="keep_alive" label="保持连接(秒)">
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="connection_timeout" label="连接超时(秒)">
                <InputNumber min={1} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="default_qos" label="默认QoS">
                <Select>
                  <Option value={0}>0 - 最多发送一次</Option>
                  <Option value={1}>1 - 至少发送一次</Option>
                  <Option value={2}>2 - 只发送一次</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="max_retries" label="最大重试次数">
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="retry_delay" label="重试延迟(秒)">
                <InputNumber min={1} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="max_inflight_messages" label="最大飞行消息数">
                <InputNumber min={1} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          <Divider>安全配置</Divider>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="use_tls" label="启用TLS" valuePropName="checked">
                <Switch checkedChildren="启用" unCheckedChildren="禁用" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="tls_insecure" label="跳过证书验证" valuePropName="checked">
                <Switch checkedChildren="跳过" unCheckedChildren="验证" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="auth_type" label="认证类型">
                <Select>
                  <Option value="none">无认证</Option>
                  <Option value="username_password">用户名密码</Option>
                  <Option value="certificate">证书认证</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="username" label="用户名">
                <Input placeholder="MQTT用户名" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="password" label="密码">
                <Input.Password placeholder="MQTT密码" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="ca_cert" label="CA证书">
            <TextArea rows={4} placeholder="PEM格式的CA证书内容" />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="client_cert" label="客户端证书">
                <TextArea rows={4} placeholder="PEM格式的客户端证书内容" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="client_key" label="客户端私钥">
                <TextArea rows={4} placeholder="PEM格式的客户端私钥内容" />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      {/* MQTT聊天测试模态框 */}
      <MQTTChat
        visible={chatModalVisible}
        mqttData={selectedMQTT}
        onClose={() => setChatModalVisible(false)}
      />
    </div>
  );
};

export default MQTTData; 