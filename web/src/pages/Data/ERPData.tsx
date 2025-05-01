import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Space, Modal, Form, Input, message, Tag, Tooltip, Select, DatePicker, InputNumber } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, ExclamationCircleOutlined, BarChartOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';

const { Option } = Select;

interface ERPDataItem {
  id: string;
  module: string;
  type: string;
  title: string;
  amount: number;
  date: string;
  status: 'pending' | 'approved' | 'rejected';
  description: string;
}

const ERPData: React.FC = () => {
  const [data, setData] = useState<ERPDataItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [modalVisible, setModalVisible] = useState<boolean>(false);
  const [form] = Form.useForm();
  const [editingId, setEditingId] = useState<string | null>(null);

  // 模拟数据
  useEffect(() => {
    const mockData: ERPDataItem[] = [
      {
        id: '1',
        module: '财务',
        type: '支出',
        title: '办公用品采购',
        amount: 2500.00,
        date: '2023-04-27',
        status: 'approved',
        description: '采购办公用品，包括打印纸、墨盒等',
      },
      {
        id: '2',
        module: '人力资源',
        type: '收入',
        title: '员工工资发放',
        amount: 50000.00,
        date: '2023-04-26',
        status: 'pending',
        description: '4月份员工工资发放',
      },
      {
        id: '3',
        module: '库存',
        type: '支出',
        title: '原材料采购',
        amount: 15000.00,
        date: '2023-04-25',
        status: 'approved',
        description: '采购生产所需原材料',
      },
      {
        id: '4',
        module: '销售',
        type: '收入',
        title: '产品销售',
        amount: 35000.00,
        date: '2023-04-24',
        status: 'rejected',
        description: '产品销售订单',
      },
    ];
    setData(mockData);
  }, []);

  const handleAdd = () => {
    setEditingId(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = (record: ERPDataItem) => {
    setEditingId(record.id);
    form.setFieldsValue({
      ...record,
      date: dayjs(record.date),
    });
    setModalVisible(true);
  };

  const handleDelete = (id: string) => {
    Modal.confirm({
      title: '确认删除',
      icon: <ExclamationCircleOutlined />,
      content: '确定要删除这条ERP数据记录吗？',
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
          item.id === editingId ? { 
            ...item, 
            ...values,
            date: values.date.format('YYYY-MM-DD'),
          } : item
        ));
        message.success('更新成功');
      } else {
        // 添加新数据
        const newItem: ERPDataItem = {
          id: Date.now().toString(),
          ...values,
          date: values.date.format('YYYY-MM-DD'),
          status: 'pending',
        };
        setData([...data, newItem]);
        message.success('添加成功');
      }
      setModalVisible(false);
    });
  };

  const getStatusTag = (status: string) => {
    switch (status) {
      case 'approved':
        return <Tag color="green">已批准</Tag>;
      case 'pending':
        return <Tag color="blue">待处理</Tag>;
      case 'rejected':
        return <Tag color="red">已拒绝</Tag>;
      default:
        return <Tag>未知</Tag>;
    }
  };

  const handleViewReport = (record: ERPDataItem) => {
    message.info(`查看报表: ${record.title}`);
    // 这里可以实现报表查看功能
  };

  const columns: ColumnsType<ERPDataItem> = [
    {
      title: '模块',
      dataIndex: 'module',
      key: 'module',
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
    },
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
    },
    {
      title: '金额',
      dataIndex: 'amount',
      key: 'amount',
      render: (amount) => `¥${amount.toFixed(2)}`,
    },
    {
      title: '日期',
      dataIndex: 'date',
      key: 'date',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status) => getStatusTag(status),
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space size="middle">
          <Tooltip title="查看报表">
            <Button 
              type="text" 
              icon={<BarChartOutlined />} 
              onClick={() => handleViewReport(record)}
            />
          </Tooltip>
          <Tooltip title="编辑">
            <Button 
              type="text" 
              icon={<EditOutlined />} 
              onClick={() => handleEdit(record)}
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
    <Card title="ERP数据管理" extra={<Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>添加数据</Button>}>
      <Table 
        columns={columns} 
        dataSource={data} 
        rowKey="id" 
        loading={loading}
        pagination={{ pageSize: 10 }}
      />

      <Modal
        title={editingId ? "编辑ERP数据" : "添加ERP数据"}
        open={modalVisible}
        onOk={handleModalOk}
        onCancel={() => setModalVisible(false)}
        destroyOnClose
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
        >
          <Form.Item
            name="module"
            label="模块"
            rules={[{ required: true, message: '请选择模块' }]}
          >
            <Select placeholder="请选择模块">
              <Option value="财务">财务</Option>
              <Option value="人力资源">人力资源</Option>
              <Option value="库存">库存</Option>
              <Option value="销售">销售</Option>
              <Option value="采购">采购</Option>
              <Option value="生产">生产</Option>
            </Select>
          </Form.Item>
          <Form.Item
            name="type"
            label="类型"
            rules={[{ required: true, message: '请选择类型' }]}
          >
            <Select placeholder="请选择类型">
              <Option value="收入">收入</Option>
              <Option value="支出">支出</Option>
            </Select>
          </Form.Item>
          <Form.Item
            name="title"
            label="标题"
            rules={[{ required: true, message: '请输入标题' }]}
          >
            <Input placeholder="请输入标题" />
          </Form.Item>
          <Form.Item
            name="amount"
            label="金额"
            rules={[{ required: true, message: '请输入金额' }]}
          >
            <InputNumber 
              style={{ width: '100%' }} 
              placeholder="请输入金额" 
              min={0} 
              precision={2}
              prefix="¥"
            />
          </Form.Item>
          <Form.Item
            name="date"
            label="日期"
            rules={[{ required: true, message: '请选择日期' }]}
          >
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            name="description"
            label="描述"
            rules={[{ required: true, message: '请输入描述' }]}
          >
            <Input.TextArea placeholder="请输入描述" rows={4} />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
};

export default ERPData; 