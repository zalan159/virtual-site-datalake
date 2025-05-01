import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Space, Modal, Form, Input, message, Tag, Tooltip, Select, Upload } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, ExclamationCircleOutlined, UploadOutlined, PlayCircleOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { UploadProps } from 'antd';

const { Option } = Select;

interface VideoDataItem {
  id: string;
  title: string;
  source: string;
  format: string;
  duration: string;
  size: string;
  uploadTime: string;
  status: 'processing' | 'ready' | 'error';
}

const VideoData: React.FC = () => {
  const [data, setData] = useState<VideoDataItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [modalVisible, setModalVisible] = useState<boolean>(false);
  const [form] = Form.useForm();
  const [editingId, setEditingId] = useState<string | null>(null);

  // 模拟数据
  useEffect(() => {
    const mockData: VideoDataItem[] = [
      {
        id: '1',
        title: '监控摄像头1号',
        source: '摄像头1',
        format: 'H.264',
        duration: '00:30:15',
        size: '256MB',
        uploadTime: '2023-04-27 10:30:45',
        status: 'ready',
      },
      {
        id: '2',
        title: '监控摄像头2号',
        source: '摄像头2',
        format: 'H.265',
        duration: '01:15:30',
        size: '512MB',
        uploadTime: '2023-04-27 09:15:22',
        status: 'ready',
      },
      {
        id: '3',
        title: '监控摄像头3号',
        source: '摄像头3',
        format: 'H.264',
        duration: '00:45:10',
        size: '384MB',
        uploadTime: '2023-04-27 08:45:33',
        status: 'processing',
      },
      {
        id: '4',
        title: '监控摄像头4号',
        source: '摄像头4',
        format: 'H.265',
        duration: '00:20:05',
        size: '128MB',
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

  const handleEdit = (record: VideoDataItem) => {
    setEditingId(record.id);
    form.setFieldsValue(record);
    setModalVisible(true);
  };

  const handleDelete = (id: string) => {
    Modal.confirm({
      title: '确认删除',
      icon: <ExclamationCircleOutlined />,
      content: '确定要删除这条视频流数据记录吗？',
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
        const newItem: VideoDataItem = {
          id: Date.now().toString(),
          ...values,
          uploadTime: new Date().toLocaleString(),
          status: 'processing',
        };
        setData([...data, newItem]);
        message.success('添加成功');
      }
      setModalVisible(false);
    });
  };

  const getStatusTag = (status: string) => {
    switch (status) {
      case 'ready':
        return <Tag color="green">就绪</Tag>;
      case 'processing':
        return <Tag color="blue">处理中</Tag>;
      case 'error':
        return <Tag color="red">错误</Tag>;
      default:
        return <Tag>未知</Tag>;
    }
  };

  const handlePreview = (record: VideoDataItem) => {
    message.info(`预览视频: ${record.title}`);
    // 这里可以实现视频预览功能
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

  const columns: ColumnsType<VideoDataItem> = [
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
    },
    {
      title: '来源',
      dataIndex: 'source',
      key: 'source',
    },
    {
      title: '格式',
      dataIndex: 'format',
      key: 'format',
    },
    {
      title: '时长',
      dataIndex: 'duration',
      key: 'duration',
    },
    {
      title: '大小',
      dataIndex: 'size',
      key: 'size',
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
              icon={<PlayCircleOutlined />} 
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
    <Card title="视频流数据管理" extra={<Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>添加数据</Button>}>
      <Table 
        columns={columns} 
        dataSource={data} 
        rowKey="id" 
        loading={loading}
        pagination={{ pageSize: 10 }}
      />

      <Modal
        title={editingId ? "编辑视频流数据" : "添加视频流数据"}
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
            name="title"
            label="标题"
            rules={[{ required: true, message: '请输入标题' }]}
          >
            <Input placeholder="请输入标题" />
          </Form.Item>
          <Form.Item
            name="source"
            label="来源"
            rules={[{ required: true, message: '请输入来源' }]}
          >
            <Input placeholder="请输入来源" />
          </Form.Item>
          <Form.Item
            name="format"
            label="格式"
            rules={[{ required: true, message: '请选择格式' }]}
          >
            <Select placeholder="请选择格式">
              <Option value="H.264">H.264</Option>
              <Option value="H.265">H.265</Option>
              <Option value="MPEG-4">MPEG-4</Option>
              <Option value="AVC">AVC</Option>
            </Select>
          </Form.Item>
          <Form.Item
            name="duration"
            label="时长"
            rules={[{ required: true, message: '请输入时长' }]}
          >
            <Input placeholder="请输入时长 (HH:MM:SS)" />
          </Form.Item>
          <Form.Item
            name="size"
            label="大小"
            rules={[{ required: true, message: '请输入大小' }]}
          >
            <Input placeholder="请输入大小" />
          </Form.Item>
          {!editingId && (
            <Form.Item label="上传视频">
              <Upload {...uploadProps}>
                <Button icon={<UploadOutlined />}>上传视频文件</Button>
              </Upload>
            </Form.Item>
          )}
        </Form>
      </Modal>
    </Card>
  );
};

export default VideoData; 