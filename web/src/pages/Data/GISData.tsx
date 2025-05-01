import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Space, Modal, Form, Input, message, Tag, Tooltip, Select, Upload, InputNumber } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, ExclamationCircleOutlined, UploadOutlined, EnvironmentOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { UploadProps } from 'antd';

const { Option } = Select;

interface GISDataItem {
  id: string;
  name: string;
  type: string;
  coordinates: string;
  area: number;
  description: string;
  uploadTime: string;
  status: 'active' | 'inactive' | 'error';
}

const GISData: React.FC = () => {
  const [data, setData] = useState<GISDataItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [modalVisible, setModalVisible] = useState<boolean>(false);
  const [form] = Form.useForm();
  const [editingId, setEditingId] = useState<string | null>(null);

  // 模拟数据
  useEffect(() => {
    const mockData: GISDataItem[] = [
      {
        id: '1',
        name: '北京市区域',
        type: '行政区划',
        coordinates: '116.4074, 39.9042',
        area: 16410.54,
        description: '北京市行政区划数据',
        uploadTime: '2023-04-27 10:30:45',
        status: 'active',
      },
      {
        id: '2',
        name: '上海市区域',
        type: '行政区划',
        coordinates: '121.4737, 31.2304',
        area: 6340.5,
        description: '上海市行政区划数据',
        uploadTime: '2023-04-27 09:15:22',
        status: 'active',
      },
      {
        id: '3',
        name: '广州市区域',
        type: '行政区划',
        coordinates: '113.2644, 23.1291',
        area: 7434.4,
        description: '广州市行政区划数据',
        uploadTime: '2023-04-27 08:45:33',
        status: 'inactive',
      },
      {
        id: '4',
        name: '深圳市区域',
        type: '行政区划',
        coordinates: '114.0579, 22.5431',
        area: 1997.47,
        description: '深圳市行政区划数据',
        uploadTime: '2023-04-27 07:30:18',
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

  const handleEdit = (record: GISDataItem) => {
    setEditingId(record.id);
    form.setFieldsValue(record);
    setModalVisible(true);
  };

  const handleDelete = (id: string) => {
    Modal.confirm({
      title: '确认删除',
      icon: <ExclamationCircleOutlined />,
      content: '确定要删除这条GIS数据记录吗？',
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
        const newItem: GISDataItem = {
          id: Date.now().toString(),
          ...values,
          uploadTime: new Date().toLocaleString(),
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

  const handleViewMap = (record: GISDataItem) => {
    message.info(`查看地图: ${record.name}`);
    // 这里可以实现地图查看功能
  };

  const uploadProps: UploadProps = {
    name: 'file',
    action: 'https://www.mocky.io/v2/5cc8019d300000980a055e76',
    headers: {
      authorization: 'authorization-text',
    },
    onChange(info) {
      if (info.file.status === 'done') {
        message.success(`${info.file.name} 文件上传成功`);
      } else if (info.file.status === 'error') {
        message.error(`${info.file.name} 文件上传失败`);
      }
    },
  };

  const columns: ColumnsType<GISDataItem> = [
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
      title: '坐标',
      dataIndex: 'coordinates',
      key: 'coordinates',
    },
    {
      title: '面积(km²)',
      dataIndex: 'area',
      key: 'area',
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
    },
    {
      title: '上传时间',
      dataIndex: 'uploadTime',
      key: 'uploadTime',
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
          <Tooltip title="查看地图">
            <Button 
              type="text" 
              icon={<EnvironmentOutlined />} 
              onClick={() => handleViewMap(record)}
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
    <Card title="GIS数据管理" extra={<Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>添加数据</Button>}>
      <Table 
        columns={columns} 
        dataSource={data} 
        rowKey="id" 
        loading={loading}
        pagination={{ pageSize: 10 }}
      />

      <Modal
        title={editingId ? "编辑GIS数据" : "添加GIS数据"}
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
            name="name"
            label="名称"
            rules={[{ required: true, message: '请输入名称' }]}
          >
            <Input placeholder="请输入名称" />
          </Form.Item>
          <Form.Item
            name="type"
            label="类型"
            rules={[{ required: true, message: '请选择类型' }]}
          >
            <Select placeholder="请选择类型">
              <Option value="行政区划">行政区划</Option>
              <Option value="地形地貌">地形地貌</Option>
              <Option value="水系">水系</Option>
              <Option value="道路">道路</Option>
              <Option value="建筑物">建筑物</Option>
            </Select>
          </Form.Item>
          <Form.Item
            name="coordinates"
            label="坐标"
            rules={[{ required: true, message: '请输入坐标' }]}
          >
            <Input placeholder="请输入坐标 (经度, 纬度)" />
          </Form.Item>
          <Form.Item
            name="area"
            label="面积(km²)"
            rules={[{ required: true, message: '请输入面积' }]}
          >
            <InputNumber 
              style={{ width: '100%' }} 
              placeholder="请输入面积" 
              min={0} 
              precision={2}
            />
          </Form.Item>
          <Form.Item
            name="description"
            label="描述"
            rules={[{ required: true, message: '请输入描述' }]}
          >
            <Input.TextArea placeholder="请输入描述" rows={4} />
          </Form.Item>
          {!editingId && (
            <Form.Item label="上传GIS文件">
              <Upload {...uploadProps}>
                <Button icon={<UploadOutlined />}>上传GIS文件</Button>
              </Upload>
            </Form.Item>
          )}
        </Form>
      </Modal>
    </Card>
  );
};

export default GISData; 