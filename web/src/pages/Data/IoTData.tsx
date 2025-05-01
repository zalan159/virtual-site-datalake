import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Space, Modal, Form, Input, message, Tag, Tooltip } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';

interface IoTDataItem {
  id: string;
  deviceId: string;
  deviceName: string;
  dataType: string;
  value: string;
  timestamp: string;
  status: 'active' | 'inactive' | 'error';
}

const IoTData: React.FC = () => {
  const [data, setData] = useState<IoTDataItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [modalVisible, setModalVisible] = useState<boolean>(false);
  const [form] = Form.useForm();
  const [editingId, setEditingId] = useState<string | null>(null);

  // 模拟数据
  useEffect(() => {
    const mockData: IoTDataItem[] = [
      {
        id: '1',
        deviceId: 'DEV001',
        deviceName: '温度传感器',
        dataType: 'temperature',
        value: '25.6°C',
        timestamp: '2023-04-27 10:30:45',
        status: 'active',
      },
      {
        id: '2',
        deviceId: 'DEV002',
        deviceName: '湿度传感器',
        dataType: 'humidity',
        value: '65%',
        timestamp: '2023-04-27 10:30:42',
        status: 'active',
      },
      {
        id: '3',
        deviceId: 'DEV003',
        deviceName: '压力传感器',
        dataType: 'pressure',
        value: '1013.25 hPa',
        timestamp: '2023-04-27 10:30:40',
        status: 'inactive',
      },
      {
        id: '4',
        deviceId: 'DEV004',
        deviceName: '光照传感器',
        dataType: 'light',
        value: '850 lux',
        timestamp: '2023-04-27 10:30:38',
        status: 'error',
      },
    ];
    setData(mockData);
  }, []);

  const handleAdd = () => {
    setEditingId(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = (record: IoTDataItem) => {
    setEditingId(record.id);
    form.setFieldsValue(record);
    setModalVisible(true);
  };

  const handleDelete = (id: string) => {
    Modal.confirm({
      title: '确认删除',
      icon: <ExclamationCircleOutlined />,
      content: '确定要删除这条IoT数据记录吗？',
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
          item.id === editingId ? { ...item, ...values } : item
        ));
        message.success('更新成功');
      } else {
        // 添加新数据
        const newItem: IoTDataItem = {
          id: Date.now().toString(),
          ...values,
          timestamp: new Date().toLocaleString(),
          status: 'active',
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
      case 'error':
        return <Tag color="red">错误</Tag>;
      default:
        return <Tag>未知</Tag>;
    }
  };

  const columns: ColumnsType<IoTDataItem> = [
    {
      title: '设备ID',
      dataIndex: 'deviceId',
      key: 'deviceId',
    },
    {
      title: '设备名称',
      dataIndex: 'deviceName',
      key: 'deviceName',
    },
    {
      title: '数据类型',
      dataIndex: 'dataType',
      key: 'dataType',
    },
    {
      title: '数值',
      dataIndex: 'value',
      key: 'value',
    },
    {
      title: '时间戳',
      dataIndex: 'timestamp',
      key: 'timestamp',
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
    <Card title="IoT数据管理" extra={<Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>添加数据</Button>}>
      <Table 
        columns={columns} 
        dataSource={data} 
        rowKey="id" 
        loading={loading}
        pagination={{ pageSize: 10 }}
      />

      <Modal
        title={editingId ? "编辑IoT数据" : "添加IoT数据"}
        open={modalVisible}
        onOk={handleModalOk}
        onCancel={() => setModalVisible(false)}
        destroyOnClose
      >
        <Form
          form={form}
          layout="vertical"
        >
          <Form.Item
            name="deviceId"
            label="设备ID"
            rules={[{ required: true, message: '请输入设备ID' }]}
          >
            <Input placeholder="请输入设备ID" />
          </Form.Item>
          <Form.Item
            name="deviceName"
            label="设备名称"
            rules={[{ required: true, message: '请输入设备名称' }]}
          >
            <Input placeholder="请输入设备名称" />
          </Form.Item>
          <Form.Item
            name="dataType"
            label="数据类型"
            rules={[{ required: true, message: '请输入数据类型' }]}
          >
            <Input placeholder="请输入数据类型" />
          </Form.Item>
          <Form.Item
            name="value"
            label="数值"
            rules={[{ required: true, message: '请输入数值' }]}
          >
            <Input placeholder="请输入数值" />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
};

export default IoTData; 