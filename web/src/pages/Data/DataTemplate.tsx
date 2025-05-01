import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Space, Modal, Form, Input, message, Tag, Tooltip, Select, Upload, InputNumber, Tabs } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, ExclamationCircleOutlined, UploadOutlined, FileTextOutlined, CopyOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { UploadProps } from 'antd';

const { Option } = Select;
const { TabPane } = Tabs;

interface TemplateItem {
  id: string;
  name: string;
  type: string;
  description: string;
  fields: TemplateField[];
  createTime: string;
  updateTime: string;
  status: 'active' | 'inactive' | 'draft';
}

interface TemplateField {
  id: string;
  name: string;
  type: 'string' | 'number' | 'boolean' | 'date' | 'enum' | 'file';
  required: boolean;
  description: string;
  options?: string[]; // 用于enum类型
}

const DataTemplate: React.FC = () => {
  const [data, setData] = useState<TemplateItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [modalVisible, setModalVisible] = useState<boolean>(false);
  const [form] = Form.useForm();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>('basic');

  // 模拟数据
  useEffect(() => {
    const mockData: TemplateItem[] = [
      {
        id: '1',
        name: '设备信息模板',
        type: 'IoT',
        description: '用于存储IoT设备的基本信息',
        fields: [
          { id: '1-1', name: '设备ID', type: 'string', required: true, description: '设备的唯一标识符' },
          { id: '1-2', name: '设备类型', type: 'enum', required: true, description: '设备类型', options: ['传感器', '执行器', '控制器'] },
          { id: '1-3', name: '安装日期', type: 'date', required: true, description: '设备安装日期' },
          { id: '1-4', name: '状态', type: 'boolean', required: true, description: '设备是否在线' },
        ],
        createTime: '2023-04-27 10:30:45',
        updateTime: '2023-04-27 10:30:45',
        status: 'active',
      },
      {
        id: '2',
        name: '用户信息模板',
        type: 'ERP',
        description: '用于存储用户的基本信息',
        fields: [
          { id: '2-1', name: '用户ID', type: 'string', required: true, description: '用户的唯一标识符' },
          { id: '2-2', name: '用户名', type: 'string', required: true, description: '用户的登录名' },
          { id: '2-3', name: '年龄', type: 'number', required: false, description: '用户年龄' },
          { id: '2-4', name: '头像', type: 'file', required: false, description: '用户头像' },
        ],
        createTime: '2023-04-27 09:15:22',
        updateTime: '2023-04-27 09:15:22',
        status: 'active',
      },
      {
        id: '3',
        name: '地理信息模板',
        type: 'GIS',
        description: '用于存储地理空间信息',
        fields: [
          { id: '3-1', name: '位置ID', type: 'string', required: true, description: '位置的唯一标识符' },
          { id: '3-2', name: '经度', type: 'number', required: true, description: '位置的经度坐标' },
          { id: '3-3', name: '纬度', type: 'number', required: true, description: '位置的纬度坐标' },
          { id: '3-4', name: '位置类型', type: 'enum', required: true, description: '位置类型', options: ['建筑物', '道路', '公园', '水域'] },
        ],
        createTime: '2023-04-27 08:45:33',
        updateTime: '2023-04-27 08:45:33',
        status: 'inactive',
      },
    ];
    setData(mockData);
  }, []);

  const handleAdd = () => {
    setEditingId(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = (record: TemplateItem) => {
    setEditingId(record.id);
    form.setFieldsValue(record);
    setModalVisible(true);
  };

  const handleDelete = (id: string) => {
    Modal.confirm({
      title: '确认删除',
      icon: <ExclamationCircleOutlined />,
      content: '确定要删除这个数据模板吗？',
      okText: '确认',
      cancelText: '取消',
      onOk: () => {
        setData(data.filter(item => item.id !== id));
        message.success('删除成功');
      },
    });
  };

  const handleModalOk = () => {
    form.validateFields().then(values => {
      if (editingId) {
        // 编辑现有数据
        setData(data.map(item => 
          item.id === editingId ? { ...item, ...values, updateTime: new Date().toLocaleString() } : item
        ));
        message.success('更新成功');
      } else {
        // 添加新数据
        const newItem: TemplateItem = {
          id: Date.now().toString(),
          ...values,
          fields: [],
          createTime: new Date().toLocaleString(),
          updateTime: new Date().toLocaleString(),
          status: 'draft',
        };
        setData([...data, newItem]);
        message.success('添加成功');
      }
      setModalVisible(false);
    });
  };

  const getStatusTag = (status: string) => {
    switch (status) {
      case 'active':
        return <Tag color="green">活跃</Tag>;
      case 'inactive':
        return <Tag color="orange">非活跃</Tag>;
      case 'draft':
        return <Tag color="blue">草稿</Tag>;
      default:
        return <Tag>未知</Tag>;
    }
  };

  const handlePreview = (record: TemplateItem) => {
    message.info(`预览模板: ${record.name}`);
    // 这里可以实现模板预览功能
  };

  const handleCopy = (record: TemplateItem) => {
    const newItem: TemplateItem = {
      ...record,
      id: Date.now().toString(),
      name: `${record.name} (副本)`,
      createTime: new Date().toLocaleString(),
      updateTime: new Date().toLocaleString(),
      status: 'draft',
    };
    setData([...data, newItem]);
    message.success('复制成功');
  };

  const columns: ColumnsType<TemplateItem> = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
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
      ellipsis: true,
    },
    {
      title: '字段数',
      key: 'fieldCount',
      render: (_, record) => record.fields.length,
    },
    {
      title: '创建时间',
      dataIndex: 'createTime',
      key: 'createTime',
    },
    {
      title: '更新时间',
      dataIndex: 'updateTime',
      key: 'updateTime',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status) => getStatusTag(status),
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space size="middle">
          <Tooltip title="预览">
            <Button 
              type="text" 
              icon={<FileTextOutlined />} 
              onClick={() => handlePreview(record)}
            />
          </Tooltip>
          <Tooltip title="编辑">
            <Button 
              type="text" 
              icon={<EditOutlined />} 
              onClick={() => handleEdit(record)}
            />
          </Tooltip>
          <Tooltip title="复制">
            <Button 
              type="text" 
              icon={<CopyOutlined />} 
              onClick={() => handleCopy(record)}
            />
          </Tooltip>
          <Tooltip title="删除">
            <Button 
              type="text" 
              danger 
              icon={<DeleteOutlined />} 
              onClick={() => handleDelete(record.id)}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <Card title="数据模板管理" extra={<Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>添加模板</Button>}>
      <Table 
        columns={columns} 
        dataSource={data} 
        rowKey="id" 
        loading={loading}
        pagination={{ pageSize: 10 }}
      />

      <Modal
        title={editingId ? "编辑模板" : "添加模板"}
        open={modalVisible}
        onOk={handleModalOk}
        onCancel={() => setModalVisible(false)}
        destroyOnClose
        width={800}
      >
        <Tabs activeKey={activeTab} onChange={setActiveTab}>
          <TabPane tab="基本信息" key="basic">
            <Form
              form={form}
              layout="vertical"
            >
              <Form.Item
                name="name"
                label="名称"
                rules={[{ required: true, message: '请输入名称' }]}
              >
                <Input placeholder="请输入模板名称" />
              </Form.Item>
              <Form.Item
                name="type"
                label="类型"
                rules={[{ required: true, message: '请选择类型' }]}
              >
                <Select placeholder="请选择类型">
                  <Option value="IoT">IoT</Option>
                  <Option value="ERP">ERP</Option>
                  <Option value="GIS">GIS</Option>
                  <Option value="视频">视频</Option>
                  <Option value="其他">其他</Option>
                </Select>
              </Form.Item>
              <Form.Item
                name="description"
                label="描述"
                rules={[{ required: true, message: '请输入描述' }]}
              >
                <Input.TextArea placeholder="请输入模板描述" rows={4} />
              </Form.Item>
            </Form>
          </TabPane>
          <TabPane tab="字段配置" key="fields" disabled={!editingId}>
            <div style={{ textAlign: 'center', padding: '20px' }}>
              <p>字段配置功能将在编辑模式下可用</p>
            </div>
          </TabPane>
        </Tabs>
      </Modal>
    </Card>
  );
};

export default DataTemplate; 