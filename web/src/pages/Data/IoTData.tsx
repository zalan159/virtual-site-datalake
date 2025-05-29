import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Space, Modal, Form, Input, message, Row, Col, InputNumber, Alert } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, ExclamationCircleOutlined,  ProfileOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { brokerAPI, BrokerConfig } from '../../services/iotService';
// import dayjs from 'dayjs';
import { Link } from 'react-router-dom';
import './IoTData.css'; // 将样式移到外部CSS文件

const BrokerManagement: React.FC = () => {
  const [data, setData] = useState<BrokerConfig[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [form] = Form.useForm();
  const [currentId, setCurrentId] = useState<string | null>(null);
  // const [userSubscriptions, setUserSubscriptions] = useState<UserTopicSubscription[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await brokerAPI.list();
      setData(res.data);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    const values = await form.validateFields();
    
    try {
      if (currentId) {
        await brokerAPI.update(currentId, values);
        message.success('更新成功');
      } else {
        await brokerAPI.create(values);
        message.success('创建成功');
      }
      loadData();
      setModalVisible(false);
    } catch (err) {
      message.error('操作失败');
    }
  };

  const handleDelete = async (id: string) => {
    Modal.confirm({
      title: '确认删除',
      icon: <ExclamationCircleOutlined />,
      content: '确定要删除这个Broker配置吗？',
      onOk: async () => {
        await brokerAPI.delete(id);
        loadData();
        message.success('删除成功');
      }
    });
  };

  // const messageColumns = [
  //   {
  //     title: '时间',
  //     dataIndex: 'received_ts',
  //     render: (ts: number) => dayjs(ts * 1000).format('YYYY-MM-DD HH:mm:ss')
  //   },
  //   { title: '主题', dataIndex: 'topic' },
  //   {
  //     title: '内容',
  //     dataIndex: 'payload',
  //     render: (payload: any) => (
  //       <pre style={{ margin: 0, maxWidth: 400, overflow: 'auto' }}>
  //         {JSON.stringify(payload, null, 2)}
  //       </pre>
  //     )
  //   }
  // ];

  const columns: ColumnsType<BrokerConfig> = [
    { title: '主机地址', dataIndex: 'hostname' },
    { title: '端口', dataIndex: 'port' },
    {
      title: '操作',
      render: (_, record) => (
        <Space>
          <Button icon={<EditOutlined />} onClick={() => {
            setCurrentId(record._id!);
            form.setFieldsValue({
              ...record,
            });
            setModalVisible(true);
          }} />
          <Button danger icon={<DeleteOutlined />} 
            onClick={() => handleDelete(record._id!)} />
        </Space>
      )
    }
  ];

  return (
    <>
      <Card
        title="MQTT Broker管理"
        extra={
          <Space>
            <Link to="/data/mqtt-subscriptions">
              <Button 
                icon={<ProfileOutlined />}
              >
                管理我的订阅
              </Button>
            </Link>
            <Button type="primary" icon={<PlusOutlined />} 
              onClick={() => {
                setCurrentId(null);
                form.resetFields();
                setModalVisible(true);
              }}>
              新建配置
            </Button>
          </Space>
        }
      >
        <Table
          rowKey="_id"
          columns={columns}
          dataSource={data}
          loading={loading}
          pagination={{ pageSize: 8 }}
        />
      </Card>

      <Modal
        title={currentId ? '编辑配置' : '新建配置'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        destroyOnClose
        width={800}
      >
        <Alert
          message="提示"
          description="MQTT网关会根据订阅情况自动管理连接，无需手动启停"
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />
        <Form form={form} layout="vertical" initialValues={{ port: 1883 }}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="主机地址" name="hostname" 
                rules={[{ required: true }]}>
                <Input placeholder="mqtt.example.com" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="端口" name="port" 
                rules={[{ required: true }]}>
                <InputNumber min={1} max={65535} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="用户名" name="username">
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="密码" name="password">
                <Input.Password />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </>
  );
};

export default BrokerManagement; 