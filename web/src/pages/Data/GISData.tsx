import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Space, Modal, Form, Input, message, Tag, Tooltip, Select, Upload, InputNumber, Progress, notification } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, ExclamationCircleOutlined, EnvironmentOutlined, CloudUploadOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { UploadProps } from 'antd/es/upload';
import api from '../../services/axiosConfig';
import { useNavigate } from 'react-router-dom';

const { Option } = Select;
const { TextArea } = Input;

interface ThreeDTilesItem {
  _id: string;
  name: string;
  description: string;
  tileset_url: string;
  minio_path: string;
  created_at: string;
  updated_at: string;
  is_public: boolean;
  tags: string[];
  original_filename: string;
  file_size: number;
  metadata: any;
  longitude: number | null;
  latitude: number | null;
  height: number | null;
}

const GISData: React.FC = () => {
  const [data, setData] = useState<ThreeDTilesItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [modalVisible, setModalVisible] = useState<boolean>(false);
  const [form] = Form.useForm();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [fileList, setFileList] = useState<any[]>([]);
  const [uploading, setUploading] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [uploadStatus, setUploadStatus] = useState<string>('');
  const navigate = useNavigate();
  
  // 获取3DTiles数据
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const response = await api.get('/3dtiles');
      setData(response.data);
    } catch (error) {
      console.error('获取3DTiles数据失败:', error);
      message.error('获取数据失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setEditingId(null);
    form.resetFields();
    setFileList([]);
    setUploadProgress(0);
    setUploadStatus('');
    setModalVisible(true);
  };

  const handleEdit = (record: ThreeDTilesItem) => {
    setEditingId(record._id);
    form.setFieldsValue({
      name: record.name,
      description: record.description,
      tags: record.tags ? record.tags.join(',') : '',
      is_public: record.is_public,
      longitude: record.longitude,
      latitude: record.latitude,
      height: record.height
    });
    setModalVisible(true);
  };

  const handleDelete = (id: string) => {
    Modal.confirm({
      title: '确认删除',
      icon: <ExclamationCircleOutlined />,
      content: '确定要删除这条3DTiles数据记录吗？',
      okText: '确认',
      cancelText: '取消',
      onOk: async () => {
        try {
          await api.delete(`/3dtiles/${id}`);
          message.success('删除成功');
          fetchData();
        } catch (error) {
          console.error('删除失败:', error);
          message.error('删除失败，请稍后重试');
        }
      },
    });
  };

  // 获取MinIO预签名上传URL
  const getUploadUrl = async (filename: string) => {
    const formData = new FormData();
    formData.append('filename', filename);
    try {
      const response = await api.post('/3dtiles/upload-url', formData);
      return response.data;
    } catch (error: any) {
      console.error('获取上传URL失败:', error);
      if (error.response) {
        throw new Error(`获取上传URL失败: ${error.response.data.detail || '请稍后重试'}`);
      } else {
        throw new Error('获取上传URL失败，请稍后重试');
      }
    }
  };

  // 上传文件到MinIO
  const uploadToMinio = (url: string, file: File): Promise<void> => {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      
      // 进度监听
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percentCompleted = Math.round((event.loaded * 100) / event.total);
          setUploadProgress(percentCompleted);
          setUploadStatus(`上传中 ${percentCompleted}%`);
        }
      };
      
      xhr.open('PUT', url);
      
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          setUploadStatus('上传完成，正在处理...');
          resolve();
        } else {
          reject(new Error(`上传失败: ${xhr.statusText}`));
        }
      };
      
      xhr.onerror = () => {
        reject(new Error('上传过程中发生错误'));
      };
      
      xhr.send(file);
    });
  };

  // 处理直传后的文件
  const processUploadedFile = async (objectId: string, filename: string, values: any) => {
    const formData = new FormData();
    formData.append('object_id', objectId);
    formData.append('filename', filename);
    formData.append('name', values.name);
    
    if (values.description) {
      formData.append('description', values.description);
    }
    
    // 处理标签
    if (values.tags) {
      const tagsArray = values.tags.split(',').map((tag: string) => tag.trim());
      formData.append('tags', JSON.stringify(tagsArray));
    }
    
    // 添加是否公开字段
    formData.append('is_public', values.is_public !== undefined ? values.is_public.toString() : 'true');
    
    try {
      setUploadStatus('正在开始处理文件...');
      const response = await api.post('/3dtiles/process', formData);
      return response.data;
    } catch (error: any) {
      console.error('处理文件失败:', error);
      if (error.response) {
        throw new Error(`处理文件失败: ${error.response.data.detail || '请稍后重试'}`);
      } else {
        throw new Error('处理文件失败，请稍后重试');
      }
    }
  };

  // 前往任务列表页面
  const goToTaskList = (taskId?: string) => {
    // 假设任务列表页面路由为 /tasks
    navigate('/tasks', { state: { activeTaskId: taskId } });
  };

  const handleModalOk = async () => {
    try {
      const values = await form.validateFields();
      
      if (editingId) {
        // 编辑现有数据
        const formData = new FormData();
        formData.append('name', values.name);
        if (values.description) formData.append('description', values.description);
        
        // 处理标签
        if (values.tags) {
          const tagsArray = values.tags.split(',').map((tag: string) => tag.trim());
          formData.append('tags', JSON.stringify(tagsArray));
        }
        
        formData.append('is_public', values.is_public !== undefined ? values.is_public.toString() : 'true');
        
        // 添加坐标信息
        if (values.longitude !== undefined && values.longitude !== null) {
          formData.append('longitude', values.longitude.toString());
        }
        if (values.latitude !== undefined && values.latitude !== null) {
          formData.append('latitude', values.latitude.toString());
        }
        if (values.height !== undefined && values.height !== null) {
          formData.append('height', values.height.toString());
        }
        
        await api.put(`/3dtiles/${editingId}`, formData);
        message.success('更新成功');
        setModalVisible(false);
        fetchData();
      } else {
        // 添加新数据
        if (fileList.length === 0) {
          message.error('请上传3DTiles文件');
          return;
        }
        
        setUploading(true);
        setUploadProgress(0);
        setUploadStatus('准备上传...');
        
        // 获取上传文件
        const file = fileList[0].originFileObj || fileList[0];
        
        try {
          // 1. 获取MinIO预签名上传URL
          const { upload_url, object_id } = await getUploadUrl(file.name);
          
          // 2. 直接上传文件到MinIO
          await uploadToMinio(upload_url, file);
          
          // 3. 通知后端处理上传的文件
          const result = await processUploadedFile(object_id, file.name, values);
          
          // 关闭上传模态框
          setModalVisible(false);
          setFileList([]);
          form.resetFields();
          
          // 显示通知而不是打开处理状态弹窗
          notification.success({
            message: '上传成功',
            description: (
              <div>
                <p>文件已上传成功，后台正在处理数据。</p>
                <p>您可以 <a onClick={() => goToTaskList(result.task_id)}>前往任务列表</a> 查看处理进度。</p>
              </div>
            ),
            duration: 8,
          });
          
          // 刷新数据列表
          fetchData();
        } catch (error: any) {
          console.error('上传失败:', error);
          message.error(error.message || '上传失败，请稍后重试');
        }
      }
    } catch (error: any) {
      console.error('操作失败:', error);
      if (error.response) {
        message.error(`操作失败: ${error.response.data.detail || '请稍后重试'}`);
      } else {
        message.error('操作失败，请稍后重试');
      }
    } finally {
      setUploading(false);
      setUploadProgress(0);
      setUploadStatus('');
    }
  };

  const formatFileSize = (size: number) => {
    if (!size) return '未知';
    
    if (size < 1024) {
      return size + ' B';
    } else if (size < 1024 * 1024) {
      return (size / 1024).toFixed(2) + ' KB';
    } else if (size < 1024 * 1024 * 1024) {
      return (size / (1024 * 1024)).toFixed(2) + ' MB';
    } else {
      return (size / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
    }
  };

  const formatTime = (timeStr: string) => {
    if (!timeStr) return '';
    const date = new Date(timeStr);
    return date.toLocaleString('zh-CN');
  };

  const formatCoordinate = (value: number | null) => {
    if (value === null || value === undefined) return '未知';
    return value.toFixed(6);
  };

  const handleViewMap = (record: ThreeDTilesItem) => {
    // 创建URL参数
    const params = new URLSearchParams();
    params.set('url', record.tileset_url);
    params.set('name', record.name);
    
    // 如果有坐标信息，也一并传递
    if (record.longitude !== null && record.latitude !== null) {
      params.set('longitude', record.longitude.toString());
      params.set('latitude', record.latitude.toString());
      params.set('height', (record.height || 0).toString());
    }
    
    // 打开新标签页，加载TilesetViewer组件
    window.open(`/tileset-viewer?${params.toString()}`, '_blank');
  };

  const customRequest = async ({ 
    file, 
    onSuccess, 
  }: any) => {
    // 这里我们只是将文件添加到fileList，不做实际上传
    // 上传会在表单提交时进行
    setFileList([file]);
    if (onSuccess) {
      onSuccess("ok");
    }
  };

  const uploadProps: UploadProps = {
    onRemove: () => {
      setFileList([]);
    },
    beforeUpload: (file) => {
      // 检查文件扩展名
      const isZipOr3tz = file.name.endsWith('.zip') || file.name.endsWith('.3tz');
      if (!isZipOr3tz) {
        message.error('只能上传 .zip 或 .3tz 格式的文件!');
        return Upload.LIST_IGNORE;
      }
      
      // 直接在这里设置文件列表
      setFileList([file]);
      return false; // 返回false阻止自动上传
    },
    fileList,
    accept: '.zip,.3tz',
    multiple: false,
    customRequest: customRequest,
    progress: {
      strokeColor: {
        '0%': '#108ee9',
        '100%': '#87d068',
      },
      strokeWidth: 3,
      format: (percent) => percent ? `${parseFloat(percent.toFixed(2))}%` : '0%',
    },
  };

  const columns: ColumnsType<ThreeDTilesItem> = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
    },
    {
      title: '坐标',
      key: 'coordinates',
      render: (_, record) => (
        <>
          {record.longitude !== null && record.latitude !== null ? (
            <Tooltip title={`经度: ${formatCoordinate(record.longitude)}, 纬度: ${formatCoordinate(record.latitude)}, 高度: ${formatCoordinate(record.height)}`}>
              <Tag color="blue">{formatCoordinate(record.longitude)}, {formatCoordinate(record.latitude)}</Tag>
            </Tooltip>
          ) : (
            <Tag color="default">未知</Tag>
          )}
        </>
      ),
    },
    {
      title: '文件名',
      dataIndex: 'original_filename',
      key: 'original_filename',
      ellipsis: true,
    },
    {
      title: '文件大小',
      dataIndex: 'file_size',
      key: 'file_size',
      render: (size) => formatFileSize(size),
    },
    {
      title: '标签',
      dataIndex: 'tags',
      key: 'tags',
      render: (tags: string[]) => (
        <>
          {tags && tags.map(tag => (
            <Tag key={tag}>{tag}</Tag>
          ))}
        </>
      ),
    },
    {
      title: '上传时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (time) => formatTime(time),
    },
    {
      title: '状态',
      dataIndex: 'is_public',
      key: 'is_public',
      render: (isPublic) => (
        isPublic ? <Tag color="green">公开</Tag> : <Tag color="orange">私有</Tag>
      ),
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space size="middle">
          <Tooltip title="查看3D模型">
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
              onClick={() => handleDelete(record._id)}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <Card title="3DTiles数据管理" extra={<Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>添加数据</Button>}>
      <Table 
        columns={columns} 
        dataSource={data} 
        rowKey="_id" 
        loading={loading}
        pagination={{ pageSize: 10 }}
      />

      <Modal
        title={editingId ? "编辑3DTiles数据" : "添加3DTiles数据"}
        open={modalVisible}
        onOk={handleModalOk}
        onCancel={() => setModalVisible(false)}
        confirmLoading={uploading}
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
            name="description"
            label="描述"
          >
            <TextArea placeholder="请输入描述" rows={4} />
          </Form.Item>
          <Form.Item
            name="tags"
            label="标签"
          >
            <Input placeholder="请输入标签，以逗号分隔" />
          </Form.Item>
          
          {editingId && (
            <div>
              <h4>坐标信息</h4>
              <div style={{ display: 'flex', gap: '16px' }}>
                <Form.Item
                  name="longitude"
                  label="经度"
                  style={{ flex: 1 }}
                >
                  <InputNumber precision={6} style={{ width: '100%' }} placeholder="经度" />
                </Form.Item>
                <Form.Item
                  name="latitude"
                  label="纬度"
                  style={{ flex: 1 }}
                >
                  <InputNumber precision={6} style={{ width: '100%' }} placeholder="纬度" />
                </Form.Item>
                <Form.Item
                  name="height"
                  label="高度"
                  style={{ flex: 1 }}
                >
                  <InputNumber style={{ width: '100%' }} placeholder="高度" />
                </Form.Item>
              </div>
            </div>
          )}
          
          <Form.Item
            name="is_public"
            label="是否公开"
            initialValue={true}
          >
            <Select>
              <Option value={true}>公开</Option>
              <Option value={false}>私有</Option>
            </Select>
          </Form.Item>
          {!editingId && (
            <Form.Item 
              label="上传3DTiles文件"
              required
              rules={[{ required: true, message: '请上传文件' }]}
            >
              <Upload {...uploadProps}>
                <Button icon={<CloudUploadOutlined />} disabled={fileList.length > 0}>
                  上传3DTiles文件 (.zip或.3tz格式)
                </Button>
              </Upload>
              <div style={{ marginTop: 8 }}>
                支持的文件格式: .zip, .3tz (包含tileset.json的3DTiles数据集)
              </div>
              {(uploading || uploadStatus) && (
                <div style={{ marginTop: 16 }}>
                  {uploadStatus && <div style={{ marginBottom: 8 }}>{uploadStatus}</div>}
                  <Progress percent={uploadProgress} status={uploading ? "active" : "success"} />
                </div>
              )}
            </Form.Item>
          )}
        </Form>
      </Modal>
    </Card>
  );
};

export default GISData; 