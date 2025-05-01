import { Table, Button, Space, Typography, Card, Form, Input, Modal, Select } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { useState } from 'react';

const { Title } = Typography;
const { Option } = Select;

const MetadataManagement = () => {
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [form] = Form.useForm();
  
  // 模拟数据
  const [metadata, setMetadata] = useState([
    {
      id: '1',
      key: '材质',
      value: '金属',
      type: '字符串',
      description: '模型材质类型',
    },
    {
      id: '2',
      key: '尺寸',
      value: '100x200x300',
      type: '字符串',
      description: '模型尺寸',
    },
    {
      id: '3',
      key: '复杂度',
      value: '高',
      type: '枚举',
      description: '模型复杂度',
    },
  ]);

  const columns = [
    {
      title: '键名',
      dataIndex: 'key',
      key: 'key',
    },
    {
      title: '值',
      dataIndex: 'value',
      key: 'value',
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: any) => (
        <Space size="middle">
          <Button type="link" icon={<EditOutlined />}>
            编辑
          </Button>
          <Button type="link" danger icon={<DeleteOutlined />}>
            删除
          </Button>
        </Space>
      ),
    },
  ];

  const handleAdd = () => {
    setIsModalVisible(true);
  };

  const handleOk = () => {
    form.validateFields().then(values => {
      // 这里添加保存逻辑
      console.log('表单值:', values);
      setIsModalVisible(false);
      form.resetFields();
    });
  };

  const handleCancel = () => {
    setIsModalVisible(false);
    form.resetFields();
  };

  return (
    <div>
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
          <Title level={4}>元数据管理</Title>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
            添加元数据
          </Button>
        </div>
        <Table columns={columns} dataSource={metadata} rowKey="id" />
      </Card>

      <Modal
        title="添加元数据"
        open={isModalVisible}
        onOk={handleOk}
        onCancel={handleCancel}
      >
        <Form
          form={form}
          layout="vertical"
        >
          <Form.Item
            name="key"
            label="键名"
            rules={[{ required: true, message: '请输入键名' }]}
          >
            <Input placeholder="请输入键名" />
          </Form.Item>
          <Form.Item
            name="value"
            label="值"
            rules={[{ required: true, message: '请输入值' }]}
          >
            <Input placeholder="请输入值" />
          </Form.Item>
          <Form.Item
            name="type"
            label="类型"
            rules={[{ required: true, message: '请选择类型' }]}
          >
            <Select placeholder="请选择类型">
              <Option value="字符串">字符串</Option>
              <Option value="数字">数字</Option>
              <Option value="布尔值">布尔值</Option>
              <Option value="枚举">枚举</Option>
            </Select>
          </Form.Item>
          <Form.Item
            name="description"
            label="描述"
          >
            <Input.TextArea placeholder="请输入描述" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default MetadataManagement; 