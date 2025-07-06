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
  Tabs,
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

  GlobalOutlined,
  ApiOutlined,
} from '@ant-design/icons';
import {
  httpAPI,
  HTTPDataSource,
  HTTPCreate,
  HTTPUpdate,
  HTTPTestResult,
  HTTPExecuteResult,
} from '../../services/httpApi';
import { useHTTPRequest, HTTPResponse } from '../../hooks/useHTTPRequest';

const { Option } = Select;
const { TextArea } = Input;
const { Text } = Typography;
const { TabPane } = Tabs;

const HTTPData: React.FC = () => {
  const [httpList, setHttpList] = useState<HTTPDataSource[]>([]);
  const [loading, setLoading] = useState(false);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [formModalVisible, setFormModalVisible] = useState(false);
  const [testModalVisible, setTestModalVisible] = useState(false);
  const [selectedHTTP, setSelectedHTTP] = useState<HTTPDataSource | null>(null);
  const [editingHTTP, setEditingHTTP] = useState<HTTPDataSource | null>(null);
  const [testResult, setTestResult] = useState<HTTPTestResult | null>(null);
  const [executeResult, setExecuteResult] = useState<HTTPResponse | null>(null);
  const [testLoading, setTestLoading] = useState(false);
  const [form] = Form.useForm();
  
  // 使用前端HTTP请求执行hook
  const { execute: executeHTTPRequest, isLoading: executeLoading, error: executeError } = useHTTPRequest();

  useEffect(() => {
    fetchHTTPList();
  }, []);

  const fetchHTTPList = async () => {
    setLoading(true);
    try {
      const response = await httpAPI.getHTTPList();
      // 数据转换，将_id映射到id
      const transformedData = response.data.map((item: any) => ({
        ...item,
        id: item._id, // 确保id字段存在
      }));
      setHttpList(transformedData || []);
    } catch (error) {
      message.error('获取HTTP配置列表失败');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingHTTP(null);
    form.resetFields();
    setFormModalVisible(true);
  };

  const handleEdit = (record: HTTPDataSource) => {
    setEditingHTTP(record);
    form.setFieldsValue({
      ...record,
      tags: record.tags?.join(', ') || '',
      headers: record.headers ? JSON.stringify(record.headers, null, 2) : '',
      default_params: record.default_params ? JSON.stringify(record.default_params, null, 2) : '',
    });
    setFormModalVisible(true);
  };

  const handleDelete = async (id: string) => {
    try {
      await httpAPI.deleteHTTP(id);
      message.success('删除成功');
      fetchHTTPList();
    } catch (error) {
      message.error('删除失败');
    }
  };

  const handleFormSubmit = async (values: any) => {
    try {
      const data: HTTPCreate | HTTPUpdate = {
        ...values,
        tags: values.tags ? values.tags.split(',').map((tag: string) => tag.trim()).filter(Boolean) : [],
        headers: values.headers ? JSON.parse(values.headers) : undefined,
        default_params: values.default_params ? JSON.parse(values.default_params) : undefined,
      };

      if (editingHTTP) {
        await httpAPI.updateHTTP(editingHTTP.id, data);
        message.success('更新成功');
      } else {
        await httpAPI.createHTTP(data as HTTPCreate);
        message.success('创建成功');
      }

      setFormModalVisible(false);
      fetchHTTPList();
    } catch (error) {
      message.error(editingHTTP ? '更新失败' : '创建失败');
    }
  };

  const handleViewDetails = (record: HTTPDataSource) => {
    setSelectedHTTP(record);
    setDetailModalVisible(true);
  };

  const handleTestConnection = async (record: HTTPDataSource) => {
    setSelectedHTTP(record);
    setTestModalVisible(true);
    setTestResult(null);
    setExecuteResult(null);
    setTestLoading(true);
    try {
      const result = await httpAPI.testHTTP(record.id);
      console.log('HTTP测试结果:', result);
      setTestResult(result.data);
    } catch (error) {
      console.error('HTTP测试错误:', error);
      message.error('测试连接失败');
    } finally {
      setTestLoading(false);
    }
  };

  const handleExecuteRequest = async () => {
    if (!selectedHTTP) return;
    
    try {
      // 构建HTTP请求参数
      const requestOptions = {
        method: selectedHTTP.method || 'GET',
        url: selectedHTTP.base_url,
        headers: selectedHTTP.headers,
        params: selectedHTTP.default_params,
        timeout: (selectedHTTP.timeout || 30) * 1000, // 转换为毫秒
        auth_type: selectedHTTP.auth_type,
        auth_username: selectedHTTP.auth_username,
        auth_password: selectedHTTP.auth_password,
        auth_token: selectedHTTP.auth_token,
        api_key: selectedHTTP.api_key,
        api_key_header: selectedHTTP.api_key_header,
        verify_ssl: selectedHTTP.verify_ssl,
      };

      console.log('前端执行HTTP请求:', requestOptions);
      const result = await executeHTTPRequest(requestOptions);
      console.log('HTTP执行结果:', result);
      setExecuteResult(result);
      message.success(`请求成功 (${result.status} ${result.statusText})`);
    } catch (error: any) {
      console.error('HTTP执行错误:', error);
      message.error(`执行请求失败: ${error.message}`);
    }
  };

  const getMethodColor = (method: string) => {
    const colors: { [key: string]: string } = {
      GET: 'green',
      POST: 'blue',
      PUT: 'orange',
      DELETE: 'red',
      PATCH: 'purple',
    };
    return colors[method] || 'default';
  };

  const columns = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      width: 200,
      fixed: 'left' as const,
      render: (text: string, record: HTTPDataSource) => (
        <div>
          <div style={{ fontWeight: 'bold' }}>{text}</div>
          <Text type="secondary" style={{ fontSize: '12px' }}>
            {record.id}
          </Text>
        </div>
      ),
    },
    {
      title: 'API地址',
      dataIndex: 'base_url',
      key: 'base_url',
      width: 300,
      ellipsis: true,
      render: (url: string, record: HTTPDataSource) => (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Tag color={getMethodColor(record.method || 'GET')}>
              {record.method || 'GET'}
            </Tag>
            <Text code style={{ fontSize: '12px' }}>{url}</Text>
          </div>
        </div>
      ),
    },
    {
      title: '认证类型',
      dataIndex: 'auth_type',
      key: 'auth_type',
      width: 120,
      render: (authType: string, record: HTTPDataSource) => (
        <div>
          <Tag color={authType === 'none' ? 'default' : 'blue'}>
            {authType || '无认证'}
          </Tag>
          {record.auth_username && (
            <div style={{ fontSize: '12px', marginTop: '4px' }}>
              <Text type="secondary">用户: {record.auth_username}</Text>
            </div>
          )}
        </div>
      ),
    },
    {
      title: '连接配置',
      dataIndex: 'timeout',
      key: 'connection_config',
      width: 140,
      render: (_: any, record: HTTPDataSource) => (
        <div style={{ fontSize: '12px', lineHeight: '1.4' }}>
          <div>超时: {record.timeout || 30}s</div>
          <div>重试: {record.max_retries || 3}次</div>
          <div>SSL: {record.verify_ssl ? '验证' : '跳过'}</div>
          {record.poll_enabled && (
            <div>轮询: {record.poll_interval || 0}s</div>
          )}
        </div>
      ),
    },
    {
      title: '响应格式',
      dataIndex: 'response_format',
      key: 'response_format',
      width: 100,
      render: (format: string) => (
        <Tag color="cyan">{format || 'json'}</Tag>
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
      render: (_: any, record: HTTPDataSource) => {
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
                title: '确定要删除这个HTTP配置吗？',
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
              icon={<PlayCircleOutlined />}
              onClick={() => handleTestConnection(record)}
              size="small"
            >
              测试
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
        <div>
          <h2 style={{ margin: 0 }}>HTTP连接配置管理</h2>
          <Text type="secondary">管理HTTP/HTTPS API连接配置，支持RESTful接口调用</Text>
        </div>
        <Space wrap>
          <Button
            icon={<ReloadOutlined />}
            onClick={fetchHTTPList}
          >
            刷新
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleCreate}
          >
            添加HTTP配置
          </Button>
        </Space>
      </div>

      <Table
        columns={columns}
        dataSource={httpList}
        rowKey="id"
        loading={loading}
        scroll={{ x: 1500 }}
        pagination={{
          total: httpList.length,
          pageSize: 10,
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (total) => `共 ${total} 条记录`,
        }}
      />

      {/* 详情模态框 */}
      <Modal
        title="HTTP配置详情"
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={null}
        width={800}
      >
        {selectedHTTP && (
          <Card>
            <Descriptions bordered column={2}>
              <Descriptions.Item label="名称" span={2}>
                {selectedHTTP.name}
              </Descriptions.Item>
              <Descriptions.Item label="描述" span={2}>
                {selectedHTTP.description || '无'}
              </Descriptions.Item>
              <Descriptions.Item label="API地址" span={2}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Tag color={getMethodColor(selectedHTTP.method || 'GET')}>
                    {selectedHTTP.method || 'GET'}
                  </Tag>
                  <Text code>{selectedHTTP.base_url}</Text>
                </div>
              </Descriptions.Item>
              <Descriptions.Item label="认证类型">
                <Tag color={selectedHTTP.auth_type === 'none' ? 'default' : 'blue'}>
                  {selectedHTTP.auth_type || '无认证'}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="用户名">
                {selectedHTTP.auth_username || '无'}
              </Descriptions.Item>
              <Descriptions.Item label="超时时间">
                {selectedHTTP.timeout || 30} 秒
              </Descriptions.Item>
              <Descriptions.Item label="最大重试">
                {selectedHTTP.max_retries || 3} 次
              </Descriptions.Item>
              <Descriptions.Item label="SSL验证">
                <Tag color={selectedHTTP.verify_ssl ? 'green' : 'orange'}>
                  {selectedHTTP.verify_ssl ? '验证' : '跳过'}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="轮询模式">
                <Tag color={selectedHTTP.poll_enabled ? 'green' : 'default'}>
                  {selectedHTTP.poll_enabled ? '启用' : '禁用'}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="轮询间隔">
                {selectedHTTP.poll_interval || 0} 秒
              </Descriptions.Item>
              <Descriptions.Item label="响应格式">
                <Tag color="cyan">{selectedHTTP.response_format || 'json'}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="JSON路径">
                {selectedHTTP.json_path || '无'}
              </Descriptions.Item>
              <Descriptions.Item label="可见性">
                <Tag color={selectedHTTP.is_public ? 'green' : 'orange'}>
                  {selectedHTTP.is_public ? '公开' : '私有'}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="标签" span={2}>
                {selectedHTTP.tags?.map((tag) => (
                  <Tag key={tag} color="blue">{tag}</Tag>
                ))}
              </Descriptions.Item>
              <Descriptions.Item label="创建时间">
                {new Date(selectedHTTP.created_at).toLocaleString()}
              </Descriptions.Item>
              <Descriptions.Item label="更新时间">
                {new Date(selectedHTTP.updated_at).toLocaleString()}
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
            连接测试 - {selectedHTTP?.name}
          </div>
        }
        open={testModalVisible}
        onCancel={() => setTestModalVisible(false)}
        footer={null}
        width={700}
      >
        {selectedHTTP && (
          <Tabs defaultActiveKey="validation">
            <TabPane tab="配置验证" key="validation">
              <Alert
                message="前端驱动连接测试"
                description="后端仅提供配置验证，实际HTTP请求测试需要在前端进行。"
                type="info"
                showIcon
                style={{ marginBottom: '16px' }}
              />
              
              <Card size="small" style={{ marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <GlobalOutlined />
                  <Text strong>请求地址: </Text>
                  <Tag color={getMethodColor(selectedHTTP.method || 'GET')}>
                    {selectedHTTP.method || 'GET'}
                  </Tag>
                  <Text code>{selectedHTTP.base_url}</Text>
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
            </TabPane>
            
            <TabPane tab="请求执行" key="execute">
              <Alert
                message="前端直接执行HTTP请求"
                description="在浏览器中直接执行HTTP请求，实时获取响应结果。支持跨域请求和各种认证方式。"
                type="info"
                showIcon
                style={{ marginBottom: '16px' }}
              />
              
              <Card size="small" style={{ marginBottom: '16px' }}>
                <Row gutter={16} align="middle">
                  <Col span={16}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Tag color={getMethodColor(selectedHTTP.method || 'GET')}>
                        {selectedHTTP.method || 'GET'}
                      </Tag>
                      <Text code style={{ flex: 1 }}>{selectedHTTP.base_url}</Text>
                    </div>
                    {selectedHTTP.auth_type && selectedHTTP.auth_type !== 'none' && (
                      <div style={{ marginTop: '4px' }}>
                        <Tag color="blue">
                          {selectedHTTP.auth_type === 'basic' ? '基础认证' :
                           selectedHTTP.auth_type === 'bearer' ? 'Bearer Token' :
                           selectedHTTP.auth_type === 'api_key' ? 'API Key' :
                           selectedHTTP.auth_type}
                        </Tag>
                      </div>
                    )}
                  </Col>
                  <Col span={8} style={{ textAlign: 'right' }}>
                    <Button
                      type="primary"
                      icon={<ApiOutlined />}
                      onClick={handleExecuteRequest}
                      loading={executeLoading}
                    >
                      执行请求
                    </Button>
                  </Col>
                </Row>
              </Card>

              {executeResult && (
                <div>
                  <Card size="small" title="响应信息" style={{ marginBottom: '16px' }}>
                    <Row gutter={16}>
                      <Col span={6}>
                        <div>
                          <Text type="secondary">状态码</Text>
                          <div>
                            <Badge 
                              status={executeResult.status >= 200 && executeResult.status < 300 ? 'success' : 'error'} 
                              text={`${executeResult.status} ${executeResult.statusText}`}
                            />
                          </div>
                        </div>
                      </Col>
                      <Col span={6}>
                        <div>
                          <Text type="secondary">响应时间</Text>
                          <div>{executeResult.responseTime}ms</div>
                        </div>
                      </Col>
                      <Col span={6}>
                        <div>
                          <Text type="secondary">响应大小</Text>
                          <div>{Math.round(executeResult.responseSize / 1024 * 100) / 100}KB</div>
                        </div>
                      </Col>
                      <Col span={6}>
                        <div>
                          <Text type="secondary">内容类型</Text>
                          <div>
                            {executeResult.headers['content-type'] || 
                             executeResult.headers['Content-Type'] || 
                             'unknown'}
                          </div>
                        </div>
                      </Col>
                    </Row>
                  </Card>

                  {Object.keys(executeResult.headers).length > 0 && (
                    <Card size="small" title="响应头" style={{ marginBottom: '16px' }}>
                      <pre style={{ 
                        margin: 0, 
                        padding: '12px',
                        background: 'var(--ant-color-fill-quaternary)',
                        borderRadius: '4px',
                        fontSize: '12px',
                        overflow: 'auto',
                        maxHeight: '200px',
                        color: 'var(--ant-color-text)',
                        border: '1px solid var(--ant-color-border)',
                      }}>
                        {Object.entries(executeResult.headers)
                          .map(([key, value]) => `${key}: ${value}`)
                          .join('\n')
                        }
                      </pre>
                    </Card>
                  )}

                  <Card size="small" title="响应数据">
                    <pre style={{ 
                      margin: 0, 
                      padding: '12px',
                      background: 'var(--ant-color-fill-quaternary)',
                      borderRadius: '4px',
                      fontSize: '12px',
                      overflow: 'auto',
                      maxHeight: '400px',
                      color: 'var(--ant-color-text)',
                      border: '1px solid var(--ant-color-border)',
                    }}>
                      {typeof executeResult.data === 'string' 
                        ? executeResult.data 
                        : JSON.stringify(executeResult.data, null, 2)
                      }
                    </pre>
                  </Card>
                </div>
              )}

              {executeError && (
                <Alert
                  message={executeError.includes('CORS') ? '🚨 CORS跨域限制' : '请求执行失败'}
                  description={
                    <div>
                      <p>{executeError}</p>
                      {executeError.includes('CORS') && (
                        <div style={{ marginTop: '12px' }}>
                          <Text strong>解决方案：</Text>
                          <ul style={{ paddingLeft: '20px', margin: '8px 0' }}>
                            <li>使用支持跨域的API（如上面的测试API）</li>
                            <li>在目标服务器配置CORS头</li>
                            <li>使用代理服务器或后端中转</li>
                            <li>开发环境可使用浏览器插件临时禁用CORS</li>
                          </ul>
                        </div>
                      )}
                    </div>
                  }
                  type="error"
                  style={{ marginTop: '16px' }}
                />
              )}

              {!executeResult && !executeLoading && !executeError && (
                <div>
                  <Card size="small" title="💡 快速测试提示" style={{ marginBottom: '16px' }}>
                    <div style={{ color: 'var(--ant-color-text-secondary)' }}>
                      <p>点击"执行请求"按钮即可在前端直接发送HTTP请求。</p>
                      <p>支持的功能：</p>
                      <ul style={{ paddingLeft: '20px', margin: '8px 0' }}>
                        <li>各种HTTP方法（GET、POST、PUT、DELETE、PATCH）</li>
                        <li>多种认证方式（基础认证、Bearer Token、API Key）</li>
                        <li>自定义请求头和参数</li>
                        <li>实时响应时间和大小统计</li>
                        <li>详细的响应头和数据显示</li>
                      </ul>
                    </div>
                  </Card>

                  <Alert
                    message="🚨 CORS跨域限制说明"
                    description={
                      <div>
                        <p>浏览器出于安全考虑，会阻止跨域请求。以下情况可能遇到CORS错误：</p>
                        <ul style={{ paddingLeft: '20px', marginBottom: '12px' }}>
                          <li><Text code>https://www.baidu.com</Text> - 不支持跨域</li>
                          <li><Text code>https://www.google.com</Text> - 不支持跨域</li>
                          <li>大部分商业网站都不支持跨域请求</li>
                        </ul>
                        <p style={{ marginBottom: '12px' }}><Text strong>✅ 推荐测试API（支持跨域）：</Text></p>
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
                          {[
                            { name: 'HTTPBin测试', url: 'https://httpbin.org/get', desc: 'HTTP测试服务' },
                            { name: 'JSON数据', url: 'https://jsonplaceholder.typicode.com/posts/1', desc: 'fake REST API' },
                            { name: 'GitHub API', url: 'https://api.github.com/users/octocat', desc: '用户信息' },
                            { name: '随机狗图', url: 'https://dog.ceo/api/breeds/image/random', desc: '可爱狗狗' }
                          ].map((api, index) => (
                            <Button 
                              key={index}
                              size="small"
                              type="dashed"
                              onClick={() => {
                                const requestOptions = {
                                  method: 'GET' as const,
                                  url: api.url,
                                  timeout: 30000,
                                };
                                executeHTTPRequest(requestOptions)
                                  .then((result) => {
                                    setExecuteResult(result);
                                    message.success(`${api.name} 请求成功！`);
                                  })
                                  .catch((error) => {
                                    message.error(`${api.name} 请求失败: ${error.message}`);
                                  });
                              }}
                              loading={executeLoading}
                              title={`${api.desc} - ${api.url}`}
                            >
                              🚀 {api.name}
                            </Button>
                          ))}
                        </div>
                        <ul style={{ paddingLeft: '20px', margin: 0, fontSize: '12px' }}>
                          <li><Text code>https://httpbin.org/get</Text> - HTTP测试服务</li>
                          <li><Text code>https://jsonplaceholder.typicode.com/posts/1</Text> - JSON数据</li>
                          <li><Text code>https://api.github.com/users/octocat</Text> - GitHub API</li>
                          <li><Text code>https://dog.ceo/api/breeds/image/random</Text> - 随机狗图片API</li>
                        </ul>
                      </div>
                    }
                    type="warning"
                    showIcon
                  />
                </div>
              )}
            </TabPane>
          </Tabs>
        )}
      </Modal>

      {/* 创建/编辑模态框 */}
      <Modal
        title={editingHTTP ? '编辑HTTP配置' : '创建HTTP配置'}
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
            method: 'GET',
            auth_type: 'none',
            verify_ssl: true,
            timeout: 30,
            max_retries: 3,
            retry_delay: 1,
            poll_enabled: false,
            poll_interval: 60,
            response_format: 'json',
            encoding: 'utf-8',
            api_key_header: 'X-API-Key',
          }}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="name"
                label="配置名称"
                rules={[{ required: true, message: '请输入配置名称' }]}
              >
                <Input placeholder="请输入HTTP配置名称" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="is_public" label="可见性" valuePropName="checked">
                <Switch checkedChildren="公开" unCheckedChildren="私有" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={4}>
              <Form.Item name="method" label="HTTP方法">
                <Select>
                  <Option value="GET">GET</Option>
                  <Option value="POST">POST</Option>
                  <Option value="PUT">PUT</Option>
                  <Option value="DELETE">DELETE</Option>
                  <Option value="PATCH">PATCH</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={20}>
              <Form.Item
                name="base_url"
                label="API地址"
                rules={[
                  { required: true, message: '请输入API地址' },
                  { pattern: /^https?:\/\//, message: '请输入有效的HTTP URL' },
                ]}
              >
                <Input placeholder="https://api.example.com" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="description" label="描述">
            <TextArea rows={3} placeholder="请输入描述信息" />
          </Form.Item>

          <Form.Item name="tags" label="标签">
            <Input placeholder="请输入标签，用逗号分隔" />
          </Form.Item>

          <Tabs defaultActiveKey="basic">
            <TabPane tab="基本配置" key="basic">
              <Row gutter={16}>
                <Col span={8}>
                  <Form.Item name="timeout" label="超时时间(秒)">
                    <InputNumber min={1} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
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
              </Row>

              <Row gutter={16}>
                <Col span={8}>
                  <Form.Item name="response_format" label="响应格式">
                    <Select>
                      <Option value="json">JSON</Option>
                      <Option value="xml">XML</Option>
                      <Option value="text">文本</Option>
                      <Option value="binary">二进制</Option>
                    </Select>
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="encoding" label="编码">
                    <Select>
                      <Option value="utf-8">UTF-8</Option>
                      <Option value="gbk">GBK</Option>
                      <Option value="ascii">ASCII</Option>
                    </Select>
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="json_path" label="JSON路径">
                    <Input placeholder="$.data.items" />
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item name="headers" label="请求头">
                <TextArea 
                  rows={4} 
                  placeholder='{"Content-Type": "application/json", "User-Agent": "MyApp/1.0"}'
                />
              </Form.Item>

              <Form.Item name="default_params" label="默认参数">
                <TextArea 
                  rows={3} 
                  placeholder='{"page": 1, "size": 10}'
                />
              </Form.Item>
            </TabPane>

            <TabPane tab="认证配置" key="auth">
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item name="auth_type" label="认证类型">
                    <Select>
                      <Option value="none">无认证</Option>
                      <Option value="basic">基础认证</Option>
                      <Option value="bearer">Bearer Token</Option>
                      <Option value="api_key">API Key</Option>
                      <Option value="oauth2">OAuth2</Option>
                    </Select>
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="api_key_header" label="API Key头部">
                    <Input placeholder="X-API-Key" />
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item name="auth_username" label="用户名">
                    <Input placeholder="认证用户名" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="auth_password" label="密码">
                    <Input.Password placeholder="认证密码" />
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item name="auth_token" label="Token">
                <Input placeholder="Bearer Token或API Key" />
              </Form.Item>

              <Form.Item name="api_key" label="API Key">
                <Input placeholder="API Key值" />
              </Form.Item>

              <Divider>OAuth2配置</Divider>

              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item name="oauth2_client_id" label="客户端ID">
                    <Input placeholder="OAuth2客户端ID" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="oauth2_client_secret" label="客户端密钥">
                    <Input.Password placeholder="OAuth2客户端密钥" />
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item name="oauth2_token_url" label="Token URL">
                    <Input placeholder="https://api.example.com/oauth/token" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="oauth2_scope" label="授权范围">
                    <Input placeholder="read write" />
                  </Form.Item>
                </Col>
              </Row>
            </TabPane>

            <TabPane tab="SSL配置" key="ssl">
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item name="verify_ssl" label="验证SSL证书" valuePropName="checked">
                    <Switch checkedChildren="验证" unCheckedChildren="跳过" />
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
            </TabPane>

            <TabPane tab="轮询配置" key="polling">
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item name="poll_enabled" label="启用轮询" valuePropName="checked">
                    <Switch checkedChildren="启用" unCheckedChildren="禁用" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="poll_interval" label="轮询间隔(秒)">
                    <InputNumber min={1} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
              </Row>

              <Alert
                message="轮询说明"
                description="启用轮询后，系统会按照指定间隔自动发送HTTP请求获取数据。适用于需要定期获取数据的场景。"
                type="info"
                showIcon
              />
            </TabPane>
          </Tabs>
        </Form>
      </Modal>
    </div>
  );
};

export default HTTPData; 