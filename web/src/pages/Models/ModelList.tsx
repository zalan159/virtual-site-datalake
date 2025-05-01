import { Table, Button, Space, Tag, Typography, Card, Modal, Popconfirm, Form, Input, Select, Progress, App } from 'antd';
import { PlusOutlined, DownloadOutlined, DeleteOutlined, EditOutlined, SwapOutlined, CheckCircleOutlined, LoadingOutlined, EyeOutlined } from '@ant-design/icons';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import modelAPI from '../../services/modelApi';
import { UploadOutlined } from '@ant-design/icons';
import { Upload } from 'antd';
import type { UploadFile } from 'antd/es/upload/interface';

const { Title } = Typography;
const { confirm } = Modal;
const { Option } = Select;

// 支持的文件格式列表
const SUPPORTED_FORMATS = [
  '3MF', 'SAT', 'SAB', 'DWG', 'DXF', '3DS', 'DWF', 'DWFX', 'IPT', 'IAM', 'NWD', 
  'MODEL', 'SESSION', 'DLV', 'EXP', 'CATDrawing', 'CATPart', 'CATProduct', 'CATShape', 
  'CGR', '3DXML', 'DAE', 'ASM', 'NEU', 'PRT', 'XAS', 'XPR', 'DGN', 'FBX', 'GLTF', 
  'GLB', 'MF1', 'ARC', 'UNV', 'PKG', 'IFC', 'IFCZIP', 'IGS', 'IGES', 'JT', 'X_B', 
  'X_T', 'XMT', 'XMT_TXT', 'PDF', 'PRC', 'RVT', 'RFA', '3DM', 'STL', 'U3D', 'VDA', 
  'WRL', 'VRML', 'OBJ'
];

// 转换状态映射
const CONVERSION_STATUS = {
  'pending': '等待中',
  'processing': '处理中',
  'completed': '已完成',
  'failed': '失败',
};

// 定义模型类型
interface Model {
  _id: string;
  filename: string;
  file_path: string;
  file_size: number;
  upload_date: string;
  tags: string[];
  description?: string;
  conversion?: {
    status: string;
    task_id?: string;
    progress?: number;
    input_format?: string;
    output_format?: string;
    output_file_path?: string;
  };
}

const ModelList: React.FC = () => {
  const { message } = App.useApp();
  const [models, setModels] = useState<Model[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploadModalVisible, setUploadModalVisible] = useState(false);
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [uploading, setUploading] = useState(false);
  
  // 编辑模态框状态
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [currentModel, setCurrentModel] = useState<Model | null>(null);
  const [editForm] = Form.useForm();
  const [editLoading, setEditLoading] = useState(false);
  const [inputVisible, setInputVisible] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [editTags, setEditTags] = useState<string[]>([]);

  // 转换模态框状态
  const [convertModalVisible, setConvertModalVisible] = useState(false);
  const [converting, setConverting] = useState(false);
  const [convertForm] = Form.useForm();
  
  // 转换状态查询
  const [conversionStatus, setConversionStatus] = useState<{[key: string]: {
    status: string;
    progress: number;
    taskId: string;
  }}>({});
  const [statusPollingInterval, setStatusPollingInterval] = useState<number | null>(null);

  const navigate = useNavigate();

  // 获取模型列表
  const fetchModels = async () => {
    setLoading(true);
    try {
      const response = await modelAPI.getModels();
      setModels(response.data);
    } catch (error) {
      console.error('获取模型列表失败:', error);
      message.error('获取模型列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchModels();
  }, []);

  // 处理上传模型
  const handleUpload = async () => {
    if (fileList.length === 0) {
      message.error('请选择要上传的模型文件');
      return;
    }

    setUploading(true);
    try {
      const file = fileList[0].originFileObj as File;
      await modelAPI.uploadModel(file);
      message.success('模型上传成功');
      setUploadModalVisible(false);
      setFileList([]);
      fetchModels(); // 刷新模型列表
    } catch (error) {
      console.error('上传模型失败:', error);
      message.error('上传模型失败');
    } finally {
      setUploading(false);
    }
  };

  // 验证文件类型
  const beforeUpload = (file: File) => {
    const extension = file.name.split('.').pop()?.toUpperCase();
    if (!extension || !SUPPORTED_FORMATS.includes(extension)) {
      message.error(`不支持的文件格式: ${extension}。请上传支持的文件格式。`);
      return false;
    }
    return false; // 返回false阻止自动上传
  };

  // 处理删除模型
  const handleDelete = async (id: string) => {
    try {
      await modelAPI.deleteModel(id);
      message.success('模型删除成功');
      fetchModels(); // 刷新模型列表
    } catch (error: any) {
      console.error('删除模型失败:', error);
      message.error(`删除模型失败: ${error.response?.data?.detail || error.message || '未知错误'}`);
    }
  };

  // 处理下载模型
  const handleDownload = async (fileId: string, filename: string) => {
    try {
      const response = await modelAPI.getModelDownloadUrl(fileId);
      // 使用后端返回的download_url直接下载文件
      if (response.data && response.data.download_url) {
        window.open(response.data.download_url, '_blank');
      } else {
        message.error('下载链接不可用');
      }
    } catch (error) {
      console.error('下载模型失败:', error);
      message.error('下载模型失败');
    }
  };
  
  // 处理下载转换后的模型
  const handleDownloadConverted = async (fileId: string, filename: string) => {
    try {
      const response = await modelAPI.getConvertedModelDownloadUrl(fileId);
      // 使用后端返回的download_url直接下载文件
      if (response.data && response.data.download_url) {
        window.open(response.data.download_url, '_blank');
      } else {
        message.error('转换后模型下载链接不可用');
      }
    } catch (error: any) {
      console.error('下载转换后模型失败:', error);
      message.error(`下载转换后模型失败: ${error.response?.data?.detail || error.message || '未知错误'}`);
    }
  };

  // 处理编辑模型
  const handleEdit = (model: Model) => {
    setCurrentModel(model);
    setEditTags(model.tags || []);
    editForm.setFieldsValue({
      filename: model.filename,
      description: model.description || '',
    });
    setEditModalVisible(true);
  };

  // 处理保存编辑
  const handleSaveEdit = async () => {
    if (!currentModel) return;
    
    try {
      const values = await editForm.validateFields();
      setEditLoading(true);
      
      const updateData = {
        description: values.description,
        tags: editTags,
      };
      
      console.log('发送到后端的数据:', updateData);
      console.log('当前模型ID:', currentModel._id);
      
      await modelAPI.updateModel(currentModel._id, updateData);
      
      message.success('模型信息更新成功');
      setEditModalVisible(false);
      fetchModels(); // 刷新模型列表
    } catch (error: any) {
      console.error('更新模型失败:', error);
      console.error('错误详情:', error.response?.data);
      message.error('更新模型失败');
    } finally {
      setEditLoading(false);
    }
  };

  // 处理标签输入
  const handleInputConfirm = () => {
    if (inputValue && !editTags.includes(inputValue)) {
      setEditTags([...editTags, inputValue]);
    }
    setInputValue('');
    setInputVisible(false);
  };

  // 处理删除标签
  const handleCloseTag = (removedTag: string) => {
    setEditTags(editTags.filter(tag => tag !== removedTag));
  };

  // 处理转换模型
  const handleConvert = (model: Model) => {
    setCurrentModel(model);
    convertForm.resetFields();
    setConvertModalVisible(true);
  };

  // 执行转换
  const executeConvert = async () => {
    if (!currentModel) return;
    
    try {
      const values = await convertForm.validateFields();
      console.log('转换表单值:', values);
      console.log('当前模型:', currentModel);
      setConverting(true);
      
      // 确保outputFormat不为undefined
      const outputFormat = values.outputFormat || undefined;
      console.log('传递给API的outputFormat:', outputFormat);
      
      const response = await modelAPI.convertModel(currentModel._id, outputFormat);
      console.log('转换API响应:', response);
      
      // 获取任务ID并开始轮询状态
      const taskId = response.data.task_id;
      if (taskId) {
        // 更新当前模型的转换状态
        const updatedModels = models.map(model => {
          if (model._id === currentModel._id) {
            return {
              ...model,
              conversion: {
                ...model.conversion,
                status: 'PENDING',
                task_id: taskId,
                progress: 0
              }
            };
          }
          return model;
        });
        setModels(updatedModels);
        
        // 开始轮询转换状态
        startPollingConversionStatus(taskId, currentModel._id);
      }
      
      message.success('模型转换任务已创建');
      setConvertModalVisible(false);
    } catch (error: any) {
      console.error('转换模型失败:', error);
      console.error('错误详情:', error.response?.data);
      console.error('错误状态码:', error.response?.status);
      message.error(`转换模型失败: ${error.response?.data?.detail || error.message || '未知错误'}`);
    } finally {
      setConverting(false);
    }
  };
  
  // 开始轮询转换状态
  const startPollingConversionStatus = (taskId: string, modelId: string) => {
    // 清除之前的轮询
    if (statusPollingInterval) {
      window.clearInterval(statusPollingInterval);
    }
    
    // 设置新的轮询
    const interval = window.setInterval(async () => {
      try {
        const response = await modelAPI.getConversionStatus(taskId);
        const status = response.data.status;
        const progress = response.data.progress || 0;
        
        // 更新转换状态
        setConversionStatus(prev => {
          const newStatus = { ...prev };
          newStatus[modelId] = {
            status,
            progress,
            taskId
          };
          return newStatus;
        });
        
        // 如果转换完成或失败，停止轮询
        if (status === 'COMPLETED' || status === 'FAILED') {
          window.clearInterval(interval);
          setStatusPollingInterval(null);
          
          // 刷新模型列表以获取最新状态
          fetchModels();
          
          // 显示相应消息
          if (status === 'COMPLETED') {
            message.success('模型转换完成');
          } else {
            message.error('模型转换失败');
          }
        }
      } catch (error) {
        console.error('获取转换状态失败:', error);
        // 出错时停止轮询
        window.clearInterval(interval);
        setStatusPollingInterval(null);
      }
    }, 3000); // 每3秒查询一次
    
    setStatusPollingInterval(interval);
  };
  
  // 组件卸载时清除轮询
  useEffect(() => {
    return () => {
      if (statusPollingInterval) {
        window.clearInterval(statusPollingInterval);
      }
    };
  }, [statusPollingInterval]);

  const columns = [
    {
      title: '模型名称',
      dataIndex: 'filename',
      key: 'filename',
    },
    {
      title: '大小',
      dataIndex: 'file_size',
      key: 'file_size',
      render: (size: number) => `${(size / 1024 / 1024).toFixed(2)} MB`,
    },
    {
      title: '格式',
      dataIndex: 'file_path',
      key: 'format',
      render: (path: string) => path.split('.').pop()?.toUpperCase() || 'GLTF',
    },
    {
      title: '标签',
      dataIndex: 'tags',
      key: 'tags',
      render: (tags: string[]) => (
        <>
          {tags && tags.map(tag => (
            <Tag key={tag} color="blue">{tag}</Tag>
          ))}
        </>
      ),
    },
    {
      title: '上传时间',
      dataIndex: 'upload_date',
      key: 'upload_date',
      render: (date: string) => new Date(date).toLocaleString(),
    },
    {
      title: '转换状态',
      key: 'conversion',
      render: (_: any, record: Model) => {
        // 检查是否有转换信息
        const modelId = record._id;
        const conversionInfo = record.conversion || {} as Model['conversion'];
        const statusInfo = conversionStatus[modelId] || {};
        
        // 优先使用轮询获取的状态，如果没有则使用模型中的状态
        const status = statusInfo.status || conversionInfo?.status;
        const progress = statusInfo.progress || conversionInfo?.progress || 0;
        const outputFormat = conversionInfo?.output_format || '';
        
        if (!status) {
          return <Tag color="default">未转换</Tag>;
        }
        
        // 根据状态显示不同的标签和进度条
        switch (status.toLowerCase()) {
          case 'pending':
            return <Tag color="default">等待中</Tag>;
          case 'processing':
            return (
              <div>
                <Tag color="processing" icon={<LoadingOutlined />}>处理中</Tag>
                <Progress percent={progress} size="small" />
              </div>
            );
          case 'completed':
            return (
              <div>
                <Tag color="success" icon={<CheckCircleOutlined />}>已完成</Tag>
                <Space>
                  <Button 
                    type="link" 
                    size="small" 
                    onClick={() => handleDownloadConverted(modelId, record.filename)}
                  >
                    下载转换后文件
                  </Button>
                  {outputFormat.toUpperCase() === 'GLB' && (
                    <Button 
                      type="link" 
                      size="small" 
                      icon={<EyeOutlined />}
                      onClick={() => window.open(`/preview/${modelId}`, '_blank')}
                    >
                      预览
                    </Button>
                  )}
                </Space>
              </div>
            );
          case 'failed':
            return <Tag color="error">转换失败</Tag>;
          default:
            return <Tag color="default">未知状态</Tag>;
        }
      },
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: Model) => (
        <Space size="middle">
          <Button type="link" icon={<DownloadOutlined />} onClick={() => handleDownload(record._id, record.filename)}>
            下载
          </Button>
          <Button type="link" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
            编辑
          </Button>
          <Button 
            type="link" 
            icon={<SwapOutlined />} 
            onClick={() => handleConvert(record)}
            disabled={record.conversion?.status === 'PROCESSING'}
          >
            转换
          </Button>
          <Popconfirm
            title="确认删除"
            description="确定要删除这个模型吗？此操作不可恢复。"
            onConfirm={() => handleDelete(record._id)}
            okText="确认"
            cancelText="取消"
          >
            <Button type="link" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
          {/* <Title level={4}>模型列表</Title> */}
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setUploadModalVisible(true)}>
            上传模型
          </Button>
        </div>
        <Table 
          columns={columns} 
          dataSource={models} 
          rowKey="_id" 
          loading={loading}
        />
      </Card>

      {/* 上传模型模态框 */}
      <Modal
        title="上传模型"
        open={uploadModalVisible}
        onOk={handleUpload}
        onCancel={() => setUploadModalVisible(false)}
        confirmLoading={uploading}
      >
        <Upload
          accept={SUPPORTED_FORMATS.map(format => `.${format.toLowerCase()}`).join(',')}
          fileList={fileList}
          onChange={({ fileList }) => setFileList(fileList)}
          maxCount={1}
        >
          <Button icon={<UploadOutlined />}>选择模型文件</Button>
        </Upload>
        <div style={{ marginTop: 16 }}>
          <p>支持的文件格式: {SUPPORTED_FORMATS.join(', ')}</p>
        </div>
      </Modal>

      {/* 编辑模型模态框 */}
      <Modal
        title="编辑模型"
        open={editModalVisible}
        onOk={handleSaveEdit}
        onCancel={() => setEditModalVisible(false)}
        confirmLoading={editLoading}
      >
        <Form
          form={editForm}
          layout="vertical"
        >
          <Form.Item
            name="filename"
            label="文件名"
            rules={[{ required: true, message: '请输入文件名' }]}
          >
            <Input disabled />
          </Form.Item>
          <Form.Item
            name="description"
            label="描述"
          >
            <Input.TextArea rows={4} />
          </Form.Item>
          <Form.Item label="标签">
            <div style={{ marginBottom: 16 }}>
              {editTags.map(tag => (
                <Tag 
                  key={tag} 
                  closable 
                  onClose={() => handleCloseTag(tag)}
                  style={{ marginBottom: 8 }}
                >
                  {tag}
                </Tag>
              ))}
            </div>
            {inputVisible ? (
              <Input
                type="text"
                size="small"
                style={{ width: 100 }}
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                onBlur={handleInputConfirm}
                onPressEnter={handleInputConfirm}
                autoFocus
              />
            ) : (
              <Tag 
                style={{ borderStyle: 'dashed' }} 
                onClick={() => setInputVisible(true)}
              >
                <PlusOutlined /> 添加标签
              </Tag>
            )}
          </Form.Item>
        </Form>
      </Modal>

      {/* 转换模型模态框 */}
      <Modal
        title="转换模型"
        open={convertModalVisible}
        onOk={executeConvert}
        onCancel={() => setConvertModalVisible(false)}
        confirmLoading={converting}
      >
        <Form
          form={convertForm}
          layout="vertical"
        >
          <Form.Item
            name="outputFormat"
            label="输出格式"
            rules={[{ required: true, message: '请选择输出格式' }]}
          >
            <Select placeholder="请选择输出格式">
              <Option value="GLB">GLB</Option>
              <Option value="OBJ">OBJ</Option>
              <Option value="FBX">FBX</Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default ModelList; 