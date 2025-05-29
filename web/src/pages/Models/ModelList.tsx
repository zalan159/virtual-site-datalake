import { Table, Button, Space, Tag, Card, Modal, Popconfirm, Form, Input, Progress, App, Image, Dropdown, Menu } from 'antd';
import { PlusOutlined, DownloadOutlined, DeleteOutlined, EditOutlined, SwapOutlined, CheckCircleOutlined, LoadingOutlined, EyeOutlined, MoreOutlined } from '@ant-design/icons';
import { useState, useEffect, useRef } from 'react';
import modelAPI from '../../services/modelApi';
import { UploadOutlined } from '@ant-design/icons';
import { Upload } from 'antd';
import type { UploadFile } from 'antd/es/upload/interface';


// const { Option } = Select;



// 定义模型类型
interface Model {
  _id: string;
  filename: string;
  file_path: string;
  file_size: number;
  upload_date: string;
  tags: string[];
  description?: string;
  preview_image?: string;
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
  const [supportedFormats, setSupportedFormats] = useState<string[]>([]);
  const supportedFormatsRef = useRef<string[]>([]);
  
  // 编辑模态框状态
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [currentModel, setCurrentModel] = useState<Model | null>(null);
  const [editForm] = Form.useForm();
  const [editLoading, setEditLoading] = useState(false);
  const [inputVisible, setInputVisible] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [editTags, setEditTags] = useState<string[]>([]);

  // // 转换模态框状态
  // const [convertModalVisible, setConvertModalVisible] = useState(false);
  // const [converting, setConverting] = useState(false);
  // const [convertForm] = Form.useForm();
  
  // 转换状态查询
  const [conversionStatus, setConversionStatus] = useState<{[key: string]: {
    status: string;
    progress: number;
    taskId: string;
  }}>({});
  const [statusPollingInterval, setStatusPollingInterval] = useState<number | null>(null);


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

  // 获取支持的文件格式
  const fetchSupportedFormats = async () => {
    try {
      const response = await modelAPI.getSupportedFormats();
      // response.data 是 [{format, extensions: []}, ...]
      const allExts = response.data.flatMap((item: any) => item.extensions.map((ext: string) => ext.toUpperCase()));
      setSupportedFormats(allExts);
      supportedFormatsRef.current = allExts;
    } catch (error) {
      message.error('获取支持的文件格式失败');
    }
  };

  useEffect(() => {
    fetchSupportedFormats();
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
  const handleDownload = async (fileId: string) => {
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
  const handleDownloadConverted = async (fileId: string) => {
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
      console.error('错误详情:', error.response?.data);
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
  const handleConvert = async (model: Model) => {
    setCurrentModel(model);
    // 直接执行转换为GLB格式
    try {
      // setConverting(true);
      const response = await modelAPI.convertModel(model._id, 'GLB');
      const taskId = response.data.task_id;
      if (taskId) {
        // 更新当前模型的转换状态
        const updatedModels = models.map(m => {
          if (m._id === model._id) {
            return {
              ...m,
              conversion: {
                ...m.conversion,
                status: 'PENDING',
                task_id: taskId,
                progress: 0
              }
            };
          }
          return m;
        });
        setModels(updatedModels);
        // 开始轮询转换状态
        startPollingConversionStatus(taskId, model._id);
      }
      message.success('模型转换任务已创建');
    } catch (error: any) {
      console.error('转换模型失败:', error);
      console.error('错误详情:', error.response?.data);
      console.error('错误状态码:', error.response?.status);
      message.error(`转换模型失败: ${error.response?.data?.detail || error.message || '未知错误'}`);
    } finally {
      // setConverting(false);
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
      title: '预览图',
      dataIndex: 'preview_image',
      key: 'preview_image',
      width: 80,
      render: (src: string) => (
        <Image.PreviewGroup>
          <Image
            src={src}
            width={60}
            height={60}
            style={{ objectFit: 'cover', borderRadius: 4 }}
            fallback="/logoonly.png"
            preview={{ mask: <EyeOutlined /> }}
          />
        </Image.PreviewGroup>
      ),
    },
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
        // const outputFormat = conversionInfo?.output_format || '';
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
              <Tag color="success" icon={<CheckCircleOutlined />}>已完成</Tag>
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
      render: (_: any, record: Model) => {
        const isGLB = record.conversion?.output_format?.toUpperCase() === 'GLB';
        const isConverted = record.conversion?.status?.toLowerCase() === 'completed';
        const isProcessing = record.conversion?.status?.toLowerCase() === 'processing';
        return (
          <Space size="middle">
            {/* 转换按钮 */}
            <Button
              type="link"
              icon={<SwapOutlined />}
              onClick={() => handleConvert(record)}
              disabled={isProcessing || isConverted}
            >
              转换
            </Button>
            {/* 预览按钮，仅GLB且转换完成可用 */}
            <Button
              type="link"
              icon={<EyeOutlined />}
              onClick={() => window.open(`/preview/${record._id}?hasPreviewImage=${!!record.preview_image}`, '_blank')}
              disabled={!isConverted || !isGLB}
            >
              预览
            </Button>
            {/* 更多操作下拉菜单 */}
            <Dropdown
              overlay={
                <Menu>
                  <Menu.Item
                    key="download"
                    icon={<DownloadOutlined />}
                    onClick={() => handleDownload(record._id)}
                  >
                    下载源文件
                  </Menu.Item>
                  <Menu.Item
                    key="download-converted"
                    icon={<DownloadOutlined />}
                    onClick={() => handleDownloadConverted(record._id)}
                    disabled={!isConverted}
                  >
                    下载转换后文件
                  </Menu.Item>
                  <Menu.Item
                    key="edit"
                    icon={<EditOutlined />}
                    onClick={() => handleEdit(record)}
                  >
                    编辑
                  </Menu.Item>
                  <Menu.Divider />
                  <Menu.Item
                    key="delete"
                    icon={<DeleteOutlined />}
                  >
                    <Popconfirm
                      title="确认删除"
                      description="确定要删除这个模型吗？此操作不可恢复。"
                      onConfirm={() => handleDelete(record._id)}
                      okText="确认"
                      cancelText="取消"
                    >
                      <span style={{ color: 'red' }}>删除</span>
                    </Popconfirm>
                  </Menu.Item>
                </Menu>
              }
              trigger={["click"]}
            >
              <Button type="link" icon={<MoreOutlined />} />
            </Dropdown>
          </Space>
        );
      },
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
          accept={supportedFormats.map(format => `.${format.toLowerCase()}`).join(',')}
          fileList={fileList}
          onChange={({ fileList }) => setFileList(fileList)}
          maxCount={1}
        >
          <Button icon={<UploadOutlined />}>选择模型文件</Button>
        </Upload>
        <div style={{ marginTop: 16 }}>
          <p>支持的文件格式: {supportedFormats.join(', ')}</p>
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
      {/*
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
      */}
    </div>
  );
};

export default ModelList; 