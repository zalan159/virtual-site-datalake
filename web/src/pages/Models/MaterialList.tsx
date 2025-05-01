import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Space, Modal, Form, Input, message, Tag, Tooltip, Select, Upload, InputNumber } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, ExclamationCircleOutlined, UploadOutlined, PictureOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { UploadProps } from 'antd';

const { Option } = Select;

interface MaterialItem {
  id: string;
  name: string;
  type: string;
  texture: string;
  color: string;
  roughness: number;
  metallic: number;
  description: string;
  uploadTime: string;
  status: 'active' | 'inactive' | 'error';
}

const MaterialList: React.FC = () => {
  const [data, setData] = useState<MaterialItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [modalVisible, setModalVisible] = useState<boolean>(false);
  const [form] = Form.useForm();
  const [editingId, setEditingId] = useState<string | null>(null);

  // 模拟数据
  useEffect(() => {
    const mockData: MaterialItem[] = [
      {
        id: '1',
        name: '金属材质',
        type: '金属',
        texture: 'metal_texture.jpg',
        color: '#C0C0C0',
        roughness: 0.2,
        metallic: 0.9,
        description: '标准金属材质，适用于机械部件',
        uploadTime: '2023-04-27 10:30:45',
        status: 'active',
      },
      {
        id: '2',
        name: '木材材质',
        type: '木材',
        texture: 'wood_texture.jpg',
        color: '#8B4513',
        roughness: 0.7,
        metallic: 0.0,
        description: '自然木材材质，适用于家具模型',
        uploadTime: '2023-04-27 09:15:22',
        status: 'active',
      },
      {
        id: '3',
        name: '玻璃材质',
        type: '玻璃',
        texture: 'glass_texture.jpg',
        color: '#FFFFFF',
        roughness: 0.1,
        metallic: 0.0,
        description: '透明玻璃材质，适用于窗户和容器',
        uploadTime: '2023-04-27 08:45:33',
        status: 'inactive',
      },
      {
        id: '4',
        name: '布料材质',
        type: '布料',
        texture: 'fabric_texture.jpg',
        color: '#FF69B4',
        roughness: 0.8,
        metallic: 0.0,
        description: '柔软布料材质，适用于服装模型',
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

  const handleEdit = (record: MaterialItem) => {
    setEditingId(record.id);
    form.setFieldsValue(record);
    setModalVisible(true);
  };

  const handleDelete = (id: string) => {
    Modal.confirm({
      title: '确认删除',
      icon: <ExclamationCircleOutlined />,
      content: '确定要删除这条材质记录吗？',
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
        const newItem: MaterialItem = {
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

  const handlePreview = (record: MaterialItem) => {
    message.info(`预览材质: ${record.name}`);
    // 这里可以实现材质预览功能
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

  const columns: ColumnsType<MaterialItem> = [
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
      title: '纹理',
      dataIndex: 'texture',
      key: 'texture',
    },
    {
      title: '颜色',
      dataIndex: 'color',
      key: 'color',
      render: (color) => (
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <div style={{ 
            width: 20, 
            height: 20, 
            backgroundColor: color, 
            borderRadius: '50%', 
            marginRight: 8 
          }} />
          {color}
        </div>
      ),
    },
    {
      title: '粗糙度',
      dataIndex: 'roughness',
      key: 'roughness',
      render: (roughness) => `${(roughness * 100).toFixed(0)}%`,
    },
    {
      title: '金属度',
      dataIndex: 'metallic',
      key: 'metallic',
      render: (metallic) => `${(metallic * 100).toFixed(0)}%`,
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
          <Tooltip title="预览">
            <Button 
              type="text" 
              icon={<PictureOutlined />} 
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
    <Card title="材质列表" extra={<Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>添加材质</Button>}>
      <Table 
        columns={columns} 
        dataSource={data} 
        rowKey="id" 
        loading={loading}
        pagination={{ pageSize: 10 }}
      />

      <Modal
        title={editingId ? "编辑材质" : "添加材质"}
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
              <Option value="金属">金属</Option>
              <Option value="木材">木材</Option>
              <Option value="玻璃">玻璃</Option>
              <Option value="布料">布料</Option>
              <Option value="塑料">塑料</Option>
              <Option value="石材">石材</Option>
              <Option value="陶瓷">陶瓷</Option>
              <Option value="皮革">皮革</Option>
            </Select>
          </Form.Item>
          <Form.Item
            name="texture"
            label="纹理"
            rules={[{ required: true, message: '请输入纹理' }]}
          >
            <Input placeholder="请输入纹理" />
          </Form.Item>
          <Form.Item
            name="color"
            label="颜色"
            rules={[{ required: true, message: '请输入颜色' }]}
          >
            <Input placeholder="请输入颜色 (十六进制颜色代码)" />
          </Form.Item>
          <Form.Item
            name="roughness"
            label="粗糙度"
            rules={[{ required: true, message: '请输入粗糙度' }]}
          >
            <InputNumber 
              style={{ width: '100%' }} 
              placeholder="请输入粗糙度 (0-1)" 
              min={0} 
              max={1} 
              step={0.1}
              precision={2}
            />
          </Form.Item>
          <Form.Item
            name="metallic"
            label="金属度"
            rules={[{ required: true, message: '请输入金属度' }]}
          >
            <InputNumber 
              style={{ width: '100%' }} 
              placeholder="请输入金属度 (0-1)" 
              min={0} 
              max={1} 
              step={0.1}
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
            <Form.Item label="上传纹理图片">
              <Upload {...uploadProps}>
                <Button icon={<UploadOutlined />}>上传纹理图片</Button>
              </Upload>
            </Form.Item>
          )}
        </Form>
      </Modal>
    </Card>
  );
};

export default MaterialList; 