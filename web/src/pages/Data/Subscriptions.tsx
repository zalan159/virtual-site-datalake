import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Space, Modal, Form, Input, message, Tag, Select, InputNumber, Tooltip } from 'antd';
import { PlusOutlined, DeleteOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { brokerAPI, subscriptionAPI, UserTopicSubscription, BrokerConfig, messageAPI } from '../../services/iotService';
import dayjs from 'dayjs';

const UserSubscriptions: React.FC = () => {
  const [subscriptions, setSubscriptions] = useState<UserTopicSubscription[]>([]);
  const [brokers, setBrokers] = useState<BrokerConfig[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [form] = Form.useForm();
  const [topicSuggestions, setTopicSuggestions] = useState<string[]>([]);
  const [messageModalOpen, setMessageModalOpen] = useState(false);
  const [messageType, setMessageType] = useState<'history' | 'realtime'>('history');
  const [currentTopic, setCurrentTopic] = useState('');
  const [messages, setMessages] = useState<any[]>([]);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [realtimeLastId, setRealtimeLastId] = useState('0-0');
  const [loadingMsg, setLoadingMsg] = useState(false);
  const [polling, setPolling] = useState(false);
  
  useEffect(() => {
    loadData();
    loadBrokers();
    loadTopicSuggestions();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await subscriptionAPI.list();
      setSubscriptions(res.data);
    } catch (err) {
      message.error('获取订阅列表失败');
    } finally {
      setLoading(false);
    }
  };

  const loadBrokers = async () => {
    try {
      const res = await brokerAPI.list();
      setBrokers(res.data);
    } catch (err) {
      message.error('获取Broker列表失败');
    }
  };

  const loadTopicSuggestions = async () => {
    try {
      const res = await subscriptionAPI.getTopicSuggestions();
      setTopicSuggestions(res.data.common_topics);
    } catch (err) {
      console.error('获取主题建议失败', err);
    }
  };

  const handleDelete = async (id: string) => {
    Modal.confirm({
      title: '确认取消订阅',
      icon: <ExclamationCircleOutlined />,
      content: '确定要取消这个主题的订阅吗？',
      onOk: async () => {
        try {
          await subscriptionAPI.delete(id);
          message.success('取消订阅成功');
          loadData();
        } catch (err) {
          message.error('取消订阅失败');
        }
      }
    });
  };

  const handleCreateSubscription = async () => {
    try {
      const values = await form.validateFields();
      await subscriptionAPI.create(values);
      message.success('订阅成功');
      setModalVisible(false);
      loadData();
    } catch (err) {
      message.error('订阅失败');
    }
  };

  const loadHistoryMessages = async (topic: string, page: number, pageSize: number) => {
    setLoadingMsg(true);
    try {
      const res = await messageAPI.history(topic, page, pageSize);
      console.log('历史消息API响应:', res); // 调试日志
      setMessages(res.data.messages);
      setPagination({ current: page, pageSize, total: res.data.total });
      console.log('历史消息数据:', res.data.messages); // 调试日志
    } catch (err) {
      console.error('获取历史消息失败:', err); // 调试日志
    } finally {
      setLoadingMsg(false);
    }
  };

  const showHistory = async (topic: string) => {
    setMessageType('history');
    setCurrentTopic(topic);
    setMessageModalOpen(true);
    loadHistoryMessages(topic, 1, 20); // 直接传递 topic
  };

  const showRealtime = async (topic: string) => {
    setMessageType('realtime');
    setCurrentTopic(topic);
    setMessageModalOpen(true);
    setMessages([]);
    setRealtimeLastId('0-0');
    setPolling(true);
  };

  // 轮询实时消息
  useEffect(() => {
    let timer: NodeJS.Timeout;
    let isMounted = true;

    const fetchRealtime = async () => {
      if (!isMounted || messageType !== 'realtime' || !currentTopic || !polling) return;
      
      try {
        const res = await messageAPI.realtime(currentTopic, realtimeLastId);
        console.log('实时消息API响应:', res); // 调试日志
        if (isMounted && res.data.messages.length > 0) {
          setMessages(res.data.messages.reverse());
          setRealtimeLastId(res.data.messages[0].redis_id!);
          console.log('实时消息数据:', res.data.messages); // 调试日志
        }
      } catch (err) {
        console.error('获取实时消息失败:', err); // 调试日志
      } finally {
        if (isMounted && polling) {
          timer = setTimeout(fetchRealtime, 2000);
        }
      }
    };

    if (messageType === 'realtime' && currentTopic && polling) {
      fetchRealtime();
    }

    return () => {
      isMounted = false;
      if (timer) clearTimeout(timer);
    };
  }, [messageType, currentTopic, polling, realtimeLastId]);

  const closeMessageModal = () => {
    setMessageModalOpen(false);
    setPolling(false); // 停止轮询
    setMessages([]);
    setRealtimeLastId('0-0');
  };

  // 添加页面离开时的清理
  useEffect(() => {
    return () => {
      setPolling(false); // 组件卸载时停止轮询
    };
  }, []);

  const columns: ColumnsType<UserTopicSubscription> = [
    {
      title: 'Broker',
      render: (_, record) => {
        const broker = brokers.find(b => b._id === record.config_id);
        return broker ? (
          <Tooltip title={`${broker.hostname}:${broker.port}`}>
            {broker.hostname}
          </Tooltip>
        ) : record.config_id;
      }
    },
    { 
      title: '主题', 
      dataIndex: 'topic',
      render: (topic) => (
        <Tag color="blue">{topic}</Tag>
      )
    },
    { title: 'QoS', dataIndex: 'qos' },
    { 
      title: '订阅时间', 
      dataIndex: 'created_at',
      render: (time) => dayjs(time * 1000).format('YYYY-MM-DD HH:mm:ss')
    },
    { 
      title: '最近活动', 
      dataIndex: 'last_active',
      render: (time) => time ? dayjs(time * 1000).format('YYYY-MM-DD HH:mm:ss') : '-'
    },
    {
      title: '操作',
      render: (_, record) => (
        <Space>
          <Button
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(record._id!)}
          >
            取消订阅
          </Button>
          <Button onClick={() => showHistory(record.topic)}>
            查看历史消息
          </Button>
          <Button onClick={() => showRealtime(record.topic)}>
            查看实时消息
          </Button>
        </Space>
      )
    }
  ];

  const messageColumns = [
    {
      title: '时间',
      dataIndex: 'received_ts',
      key: 'received_ts',
      render: (time: number) => dayjs(time * 1000).format('YYYY-MM-DD HH:mm:ss')
    },
    {
      title: '主题',
      dataIndex: 'topic',
      key: 'topic',
      render: (topic: string) => <Tag color="blue">{topic}</Tag>
    },
    {
      title: '内容',
      dataIndex: 'payload',
      key: 'payload',
      render: (payload: any) => (
        <Tooltip title={String(payload)}>
          <div style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {String(payload)}
          </div>
        </Tooltip>
      )
    }
  ];

  return (
    <>
      <Card
        title="我的MQTT订阅"
        extra={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              form.resetFields();
              setModalVisible(true);
            }}
          >
            添加订阅
          </Button>
        }
      >
        <Table
          rowKey="_id"
          columns={columns}
          dataSource={subscriptions}
          loading={loading}
          pagination={{ pageSize: 10 }}
        />
      </Card>

      <Modal
        title={messageType === 'history' ? `历史消息 - ${currentTopic}` : `实时消息 - ${currentTopic}`}
        open={messageModalOpen}
        onCancel={closeMessageModal}
        footer={null}
        width={800}
        destroyOnClose
      >
        <Table
          rowKey={(record) => record.id || record.redis_id || Math.random()}
          columns={messageColumns}
          dataSource={messages}
          loading={loadingMsg}
          pagination={
            messageType === 'history' 
              ? { 
                  current: pagination.current,
                  pageSize: pagination.pageSize,
                  total: pagination.total,
                  onChange: (page, pageSize) => {
                    setPagination({ ...pagination, current: page, pageSize });
                    loadHistoryMessages(currentTopic, page, pageSize);
                  }
                }
              : false
          }
          scroll={{ y: 400 }}
        />
      </Modal>

      <Modal
        title="添加订阅"
        open={modalVisible}
        onOk={handleCreateSubscription}
        onCancel={() => setModalVisible(false)}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="config_id"
            label="选择MQTT Broker"
            rules={[{ required: true, message: '请选择Broker' }]}
          >
            <Select placeholder="选择要订阅的Broker">
              {brokers.map(broker => (
                <Select.Option key={broker._id} value={broker._id!}>
                  {broker.hostname}:{broker.port} {broker.username ? `(${broker.username})` : ''}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            name="topic"
            label="主题"
            rules={[{ required: true, message: '请输入要订阅的主题' }]}
          >
            <Select
              placeholder="输入要订阅的主题"
              showSearch
              allowClear
              mode="tags"
            >
              {topicSuggestions.map(topic => (
                <Select.Option key={topic} value={topic}>
                  {topic}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="qos" label="QoS" initialValue={0}>
            <Select>
              <Select.Option value={0}>0 - 最多发送一次</Select.Option>
              <Select.Option value={1}>1 - 至少发送一次</Select.Option>
              <Select.Option value={2}>2 - 只发送一次</Select.Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
};

export default UserSubscriptions; 