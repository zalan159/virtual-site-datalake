import React, { useState, useEffect } from 'react';
import {
  Modal,
  Card,
  Button,
  Input,
  Space,
  Row,
  Col,
  Typography,
  Tag,
  message,
  Select,
  InputNumber,
  Divider,
} from 'antd';
import {
  SendOutlined,
  DisconnectOutlined,
  ClearOutlined,
  PlusOutlined,
  MinusOutlined,
  CloudOutlined,
} from '@ant-design/icons';
import { useMQTTConnection, MQTTMessage, QoS } from '../hooks/useMQTTConnection';
import type { MQTTDataSource } from '../services/mqttApi';

const { Text } = Typography;
const { TextArea } = Input;
const { Option } = Select;

interface MQTTChatProps {
  visible: boolean;
  mqttData: MQTTDataSource | null;
  onClose: () => void;
}

const MQTTChat: React.FC<MQTTChatProps> = ({ visible, mqttData, onClose }) => {
  const [publishTopic, setPublishTopic] = useState('');
  const [messageText, setMessageText] = useState('');
  const [subscribeTopic, setSubscribeTopic] = useState('');
  const [publishQoS, setPublishQoS] = useState<QoS>(0);
  const [subscribeQoS, setSubscribeQoS] = useState<QoS>(0);
  const [retain, setRetain] = useState(false);
  const [brokerChoice, setBrokerChoice] = useState('emqx');
  const [customConfig, setCustomConfig] = useState(mqttData || {
    hostname: '',
    port: 1883,
    websocket_path: '/mqtt',
    client_id: '',
    username: '',
    password: '',
    use_tls: false,
    ca_cert: '',
    client_cert: '',
    client_key: '',
    keep_alive: 60,
    clean_session: true,
    connection_timeout: 10,
    max_retries: 3,
    retry_delay: 1000,
    default_qos: 0 as QoS,
    topics: [],
  });

  // 使用MQTT连接hook
  const {
    connect,
    disconnect,
    subscribe,
    unsubscribe,
    publish,
    isConnected,
    isConnecting,
    messages,
    subscribedTopics,
    clearMessages,
    error,
    connectionAttempts
  } = useMQTTConnection({
    hostname: customConfig.hostname,
    port: customConfig.port,
    client_id: customConfig.client_id,
    username: customConfig.username,
    password: customConfig.password,
    use_tls: customConfig.use_tls,
    ca_cert: customConfig.ca_cert,
    client_cert: customConfig.client_cert,
    client_key: customConfig.client_key,
    keep_alive: customConfig.keep_alive,
    clean_session: customConfig.clean_session,
    connection_timeout: customConfig.connection_timeout,
    max_retries: customConfig.max_retries,
    retry_delay: customConfig.retry_delay,
    default_qos: (customConfig.default_qos || 0) as QoS,
    topics: customConfig.topics,
    websocket_path: customConfig.websocket_path,
  });

  // 预设的公共 MQTT Broker 列表
  const publicBrokers = {
    emqx: {
      hostname: 'broker.emqx.io',
      port: 8083,
      label: 'EMQX 公共 Broker (ws://broker.emqx.io:8083/mqtt)'
    },
    hivemq: {
      hostname: 'broker.hivemq.com',
      port: 8000,
      label: 'HiveMQ 公共 Broker (ws://broker.hivemq.com:8000/mqtt)'
    },
    mosquitto: {
      hostname: 'test.mosquitto.org',
      port: 8080,
      label: 'Eclipse Mosquitto (ws://test.mosquitto.org:8080/mqtt)'
    },
    custom: {
      hostname: customConfig.hostname,
      port: customConfig.port,
      label: '使用配置中的 Broker'
    }
  };

  // 当选择改变时更新配置
  useEffect(() => {
    const selectedBroker = publicBrokers[brokerChoice as keyof typeof publicBrokers];
    if (selectedBroker && brokerChoice !== 'custom') {
      setCustomConfig(prevConfig => ({
        ...prevConfig,
        hostname: selectedBroker.hostname,
        port: selectedBroker.port
      }));
    }
  }, [brokerChoice]);

  // 处理modal关闭
  const handleClose = () => {
    // 关闭前先断开连接，这会停止所有重试任务
    if (isConnected || isConnecting) {
      disconnect();
    }
    onClose();
  };

  // 订阅主题
  const handleSubscribe = () => {
    if (!subscribeTopic.trim()) {
      message.warning('请输入要订阅的主题');
      return;
    }
    subscribe(subscribeTopic, subscribeQoS);
    setSubscribeTopic('');
  };

  // 取消订阅
  const handleUnsubscribe = (topic: string) => {
    unsubscribe(topic);
  };

  // 发布消息
  const handlePublish = () => {
    if (!publishTopic.trim()) {
      message.warning('请输入发布主题');
      return;
    }
    if (!messageText.trim()) {
      message.warning('请输入消息内容');
      return;
    }
    publish(publishTopic, messageText, publishQoS, retain);
    setMessageText('');
  };

  // 处理Enter键发布
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handlePublish();
    }
  };

  // 格式化时间
  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  // 获取QoS颜色
  const getQoSColor = (qos?: QoS) => {
    switch (qos) {
      case 0: return 'default';
      case 1: return 'processing';
      case 2: return 'success';
      default: return 'default';
    }
  };

  return (
    <Modal
      title={
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <CloudOutlined style={{ marginRight: '8px' }} />
          MQTT测试连接 - {mqttData?.name || publicBrokers[brokerChoice as keyof typeof publicBrokers]?.label}
        </div>
      }
      open={visible}
      onCancel={handleClose}
      footer={null}
      width={900}
      style={{ top: 20 }}
    >
      <div style={{ height: '600px', display: 'flex', flexDirection: 'column' }}>
        {/* Broker 选择器 */}
        <div style={{ marginBottom: 16, padding: 12, background: '#f5f5f5', borderRadius: 6 }}>
          <div style={{ marginBottom: 8 }}>
            <span style={{ fontWeight: 'bold' }}>选择测试 Broker:</span>
          </div>
          <Select
            value={brokerChoice}
            onChange={setBrokerChoice}
            style={{ width: '100%' }}
            options={Object.entries(publicBrokers).map(([key, broker]) => ({
              value: key,
              label: broker.label
            }))}
          />
          <div style={{ marginTop: 8, fontSize: '12px', color: '#666' }}>
            <Text type="secondary">
              当前连接: {customConfig.hostname}:{customConfig.port}
              {!isConnected && !isConnecting && (
                <span style={{ color: '#ff4d4f' }}> (未连接)</span>
              )}
              {isConnecting && (
                <span style={{ color: '#1890ff' }}> (连接中...)</span>
              )}
              {isConnected && (
                <span style={{ color: '#52c41a' }}> (已连接)</span>
              )}
            </Text>
          </div>
        </div>

        {/* 连接信息 */}
        <Card size="small" style={{ marginBottom: '16px' }}>
          <Row gutter={16} align="middle">
            <Col flex="auto">
              <Text type="secondary">连接地址: </Text>
              <Text code style={{ fontSize: '12px' }}>
                {customConfig.use_tls ? 'mqtts://' : 'mqtt://'}
                {customConfig.hostname}:{customConfig.port}
              </Text>
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
            <div style={{ marginTop: '8px' }}>
              <Text type="danger">错误: {error}</Text>
            </div>
          )}
        </Card>

        {/* 订阅管理 */}
        <Card size="small" title="主题订阅" style={{ marginBottom: '16px' }}>
          <Row gutter={8} style={{ marginBottom: '12px' }}>
            <Col flex="auto">
              <Input
                placeholder="输入要订阅的主题，如：sensor/temperature"
                value={subscribeTopic}
                onChange={(e) => setSubscribeTopic(e.target.value)}
                onPressEnter={handleSubscribe}
                disabled={!isConnected}
              />
            </Col>
            <Col>
              <Select
                value={subscribeQoS}
                onChange={setSubscribeQoS}
                style={{ width: '80px' }}
                disabled={!isConnected}
              >
                <Option value={0}>QoS 0</Option>
                <Option value={1}>QoS 1</Option>
                <Option value={2}>QoS 2</Option>
              </Select>
            </Col>
            <Col>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={handleSubscribe}
                disabled={!isConnected}
              >
                订阅
              </Button>
            </Col>
          </Row>
          
          {/* 已订阅主题列表 */}
          <div style={{ minHeight: '40px' }}>
            <Text type="secondary" style={{ fontSize: '12px' }}>已订阅主题:</Text>
            <div style={{ marginTop: '4px' }}>
              {subscribedTopics.map((topic) => (
                <Tag
                  key={topic}
                  closable
                  color="purple"
                  onClose={() => handleUnsubscribe(topic)}
                  style={{ marginBottom: '4px' }}
                >
                  {topic}
                </Tag>
              ))}
              {subscribedTopics.length === 0 && (
                <Text type="secondary" style={{ fontSize: '12px' }}>暂无订阅</Text>
              )}
            </div>
          </div>
        </Card>

        {/* 消息列表 */}
        <Card 
          size="small" 
          title="消息列表" 
          style={{ flex: 1, display: 'flex', flexDirection: 'column' }}
          bodyStyle={{ flex: 1, padding: '12px', display: 'flex', flexDirection: 'column' }}
        >
          <div 
            style={{ 
              flex: 1, 
              maxHeight: '300px',
              overflowY: 'auto', 
              border: '1px solid var(--ant-color-border)',
              borderRadius: '6px',
              padding: '8px',
              backgroundColor: 'var(--ant-color-bg-container)',
              marginBottom: '12px'
            }}
          >
            {messages.length === 0 ? (
              <div style={{ 
                textAlign: 'center', 
                padding: '20px', 
                color: 'var(--ant-color-text-tertiary)'
              }}>
                暂无消息，连接后开始接收消息
              </div>
            ) : (
              messages.map((msg) => (
                <div
                  key={msg.id}
                  style={{
                    marginBottom: '8px',
                    padding: '8px',
                    backgroundColor: msg.direction === 'sent' 
                      ? 'var(--ant-color-primary-bg)' 
                      : 'var(--ant-color-success-bg)',
                    borderRadius: '6px',
                    borderLeft: `4px solid ${msg.direction === 'sent' 
                      ? 'var(--ant-color-primary)' 
                      : 'var(--ant-color-success)'}`,
                    border: '1px solid var(--ant-color-border-secondary)',
                  }}
                >
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    marginBottom: '4px' 
                  }}>
                    <Space size="small">
                      <Tag color={msg.direction === 'sent' ? 'blue' : 'green'}>
                        {msg.direction === 'sent' ? '发布' : '接收'}
                      </Tag>
                      <Tag color="orange">{msg.topic}</Tag>
                      {msg.qos !== undefined && (
                        <Tag color={getQoSColor(msg.qos)}>QoS {msg.qos}</Tag>
                      )}
                      {msg.retain && <Tag color="red">RETAIN</Tag>}
                    </Space>
                    <Text type="secondary" style={{ fontSize: '11px' }}>
                      {formatTime(msg.timestamp)}
                    </Text>
                  </div>
                  <Text style={{ 
                    fontSize: '13px', 
                    wordBreak: 'break-word',
                    color: 'var(--ant-color-text)'
                  }}>
                    {msg.payload}
                  </Text>
                </div>
              ))
            )}
          </div>
        </Card>

        {/* 发布消息 */}
        <Card size="small" title="发布消息" style={{ marginTop: '16px' }}>
          <Row gutter={8} style={{ marginBottom: '12px' }}>
            <Col span={8}>
              <Input
                placeholder="发布主题"
                value={publishTopic}
                onChange={(e) => setPublishTopic(e.target.value)}
                disabled={!isConnected}
              />
            </Col>
            <Col span={4}>
              <Select
                value={publishQoS}
                onChange={setPublishQoS}
                style={{ width: '100%' }}
                disabled={!isConnected}
              >
                <Option value={0}>QoS 0</Option>
                <Option value={1}>QoS 1</Option>
                <Option value={2}>QoS 2</Option>
              </Select>
            </Col>
            <Col span={4}>
              <Button
                type={retain ? 'primary' : 'default'}
                onClick={() => setRetain(!retain)}
                disabled={!isConnected}
                style={{ width: '100%' }}
              >
                {retain ? 'RETAIN' : '正常'}
              </Button>
            </Col>
            <Col span={8}>
              <Button
                type="primary"
                icon={<SendOutlined />}
                onClick={handlePublish}
                disabled={!isConnected}
                style={{ width: '100%' }}
              >
                发布消息
              </Button>
            </Col>
          </Row>
          
          <TextArea
            rows={3}
            placeholder="输入要发布的消息内容..."
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            onKeyPress={handleKeyPress}
            disabled={!isConnected}
          />
        </Card>
      </div>
    </Modal>
  );
};

export default MQTTChat; 