import { Table, Button, Space, Typography, Card, Upload, App, Progress, Modal, Image } from 'antd';
import { UploadOutlined, DownloadOutlined, DeleteOutlined, EyeOutlined, FilePdfOutlined, FileTextOutlined, FileUnknownOutlined } from '@ant-design/icons';
import { useState, useEffect } from 'react';
import type { UploadProps } from 'antd';
import { attachmentApi, Attachment } from '../../services/attachmentApi';
import ReactPlayer from 'react-player';
import DocViewer from '@cyntler/react-doc-viewer';

const { Title } = Typography;

const AttachmentManagement: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [uploading, setUploading] = useState<boolean>(false);
  const [downloadProgress] = useState<number>(0);
  const [downloadModalVisible] = useState<boolean>(false);
  const [currentDownloadFile] = useState<string>('');
  const [previewModalVisible, setPreviewModalVisible] = useState<boolean>(false);
  const [currentFile, setCurrentFile] = useState<Attachment | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');

  const fetchAttachments = async () => {
    try {
      setLoading(true);
      const data = await attachmentApi.getList();
      setAttachments(Array.isArray(data) ? data : []);
    } catch (error) {
      messageApi.error('获取附件列表失败');
      setAttachments([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAttachments();
  }, []);

  // 当选择预览文件时，获取下载URL
  useEffect(() => {
    const getPreviewUrl = async () => {
      if (currentFile) {
        try {
          const url = await attachmentApi.getDownloadUrl(currentFile._id);
          setPreviewUrl(url);
        } catch (error) {
          messageApi.error('获取预览链接失败');
        }
      }
    };

    if (currentFile) {
      getPreviewUrl();
    }
  }, [currentFile]);

  const handleDelete = async (id: string) => {
    try {
      await attachmentApi.delete(id);
      messageApi.success('删除成功');
      fetchAttachments();
    } catch (error) {
      messageApi.error('删除失败');
    }
  };

  const handleDownload = async (id: string) => {
    try {
      // 获取预签名URL
      const downloadUrl = await attachmentApi.getDownloadUrl(id);
      
      // 直接使用浏览器下载
      window.open(downloadUrl, '_blank');
      
      messageApi.success('开始下载');
    } catch (error) {
      messageApi.error('下载失败');
    }
  };

  const handlePreview = async (record: Attachment) => {
    try {
      // 设置当前预览文件
      setCurrentFile(record);
      // 打开预览模态框
      setPreviewModalVisible(true);
    } catch (error) {
      messageApi.error('预览文件失败');
    }
  };

  // 根据文件扩展名判断文件类型
  const isImageFile = (extension: string): boolean => {
    const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg', 'heic', 'heif', 'tif', 'tiff', 'ico', 'raw'];
    // 去除可能存在的前导点号
    const ext = extension.toLowerCase().replace(/^\./, '');
    return imageExtensions.includes(ext);
  };

  const isPdfFile = (extension: string): boolean => {
    // 去除可能存在的前导点号
    const ext = extension.toLowerCase().replace(/^\./, '');
    return ext === 'pdf';
  };

  const isTextFile = (extension: string): boolean => {
    const textExtensions = ['txt', 'md', 'json', 'xml', 'csv', 'html', 'htm'];
    // 去除可能存在的前导点号
    const ext = extension.toLowerCase().replace(/^\./, '');
    return textExtensions.includes(ext);
  };

  // 判断是否为视频文件
  const isVideoFile = (extension: string): boolean => {
    const videoExtensions = ['mp4', 'webm', 'ogg', 'mov', 'avi', 'wmv', 'flv', 'mkv', '3gp'];
    // 去除可能存在的前导点号
    const ext = extension.toLowerCase().replace(/^\./, '');
    return videoExtensions.includes(ext);
  };

  // 判断是否为Office文档
  const isOfficeFile = (extension: string): boolean => {
    const officeExtensions = ['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'odt', 'ods', 'odp'];
    // 去除可能存在的前导点号
    const ext = extension.toLowerCase().replace(/^\./, '');
    return officeExtensions.includes(ext);
  };

  // 判断是否为CAD文件
  const isCadFile = (extension: string): boolean => {
    const cadExtensions = ['dwg', 'dxf', 'step', 'stp', 'igs', 'iges', 'stl'];
    // 去除可能存在的前导点号
    const ext = extension.toLowerCase().replace(/^\./, '');
    return cadExtensions.includes(ext);
  };

  // 渲染预览内容
  const renderPreviewContent = () => {
    if (!currentFile || !previewUrl) return <div style={{ textAlign: 'center', padding: '40px' }}>加载中...</div>;
    
    const { extension, filename } = currentFile;
    
    if (isImageFile(extension)) {
      return (
        <div className="preview-container" style={{ textAlign: 'center' }}>
          <Image 
            src={previewUrl} 
            alt={filename}
            style={{ maxWidth: '100%', maxHeight: '70vh' }}
          />
        </div>
      );
    } else if (isPdfFile(extension)) {
      return (
        <div className="preview-container" style={{ textAlign: 'center' }}>
          <div style={{ padding: '20px' }}>
            <FilePdfOutlined style={{ fontSize: '64px', color: '#ff4d4f' }} />
            <p>PDF 文件</p>
            <iframe
              src={`${previewUrl}#toolbar=0`}
              width="100%"
              height="500px"
              title={filename}
              style={{ border: 'none' }}
            />
          </div>
        </div>
      );
    } else if (isVideoFile(extension)) {
      return (
        <div className="preview-container" style={{ textAlign: 'center' }}>
          <div style={{ padding: '20px' }}>
            <h3>{filename}</h3>
            <ReactPlayer
              url={previewUrl}
              controls={true}
              width="100%"
              height="500px"
              config={{
                file: {
                  attributes: {
                    controlsList: 'nodownload',
                  }
                }
              }}
            />
          </div>
        </div>
      );
    } else if (isOfficeFile(extension)) {
      return (
        <div className="preview-container" style={{ textAlign: 'center' }}>
          <div style={{ padding: '20px' }}>
            <h3>{filename}</h3>
            <DocViewer
              documents={[{ uri: previewUrl, fileType: extension.replace(/^\./, '') }]}
              style={{ height: 500 }}
              prefetchMethod="GET"
              // config={{
              //   header: {
              //     disableHeader: false,
              //     disableFileName: false,
              //     retainURLParams: false
              //   }
              // }}
            />
          </div>
        </div>
      );
    } else if (isCadFile(extension)) {
      return (
        <div className="preview-container" style={{ textAlign: 'center' }}>
          <div style={{ padding: '20px' }}>
            <h3>{filename}</h3>
            <p>CAD 文件预览</p>
            <p>目前暂无CAD预览组件，请下载后使用CAD软件查看</p>
            <Button type="primary" onClick={() => handleDownload(currentFile._id)}>
              下载查看
            </Button>
          </div>
        </div>
      );
    } else if (isTextFile(extension)) {
      return (
        <div className="preview-container" style={{ textAlign: 'center' }}>
          <div style={{ padding: '20px' }}>
            <FileTextOutlined style={{ fontSize: '64px', color: '#1890ff' }} />
            <p>文本文件</p>
            <p>文件名: {filename}</p>
            <Button type="primary" onClick={() => handleDownload(currentFile._id)}>
              下载查看
            </Button>
          </div>
        </div>
      );
    } else {
      return (
        <div className="preview-container" style={{ textAlign: 'center' }}>
          <div style={{ padding: '40px 20px' }}>
            <FileUnknownOutlined style={{ fontSize: '64px', color: '#faad14' }} />
            <p>该文件类型暂不支持在线预览</p>
            <p>文件名: {filename}</p>
            <p>文件类型: {extension}</p>
            <Button type="primary" onClick={() => handleDownload(currentFile._id)}>
              下载查看
            </Button>
          </div>
        </div>
      );
    }
  };

  const columns = [
    {
      title: '文件名',
      dataIndex: 'filename',
      key: 'filename',
    },
    {
      title: '大小',
      dataIndex: 'size',
      key: 'size',
      render: (size: number) => `${(size / 1024 / 1024).toFixed(2)} MB`,
    },
    {
      title: '扩展名',
      dataIndex: 'extension',
      key: 'extension',
    },
    {
      title: '上传时间',
      dataIndex: 'upload_time',
      key: 'upload_time',
      render: (time: string) => new Date(time).toLocaleString(),
    },
    {
      title: '关联实例',
      dataIndex: 'related_instance',
      key: 'related_instance',
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: Attachment) => (
        <Space size="middle">
          <Button 
            type="link" 
            icon={<EyeOutlined />} 
            onClick={() => handlePreview(record)}
          >
            查看
          </Button>
          <Button 
            type="link" 
            icon={<DownloadOutlined />}
            onClick={() => handleDownload(record._id)}
          >
            下载
          </Button>
          <Button 
            type="link" 
            danger 
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(record._id)}
          >
            删除
          </Button>
        </Space>
      ),
    },
  ];

  const uploadProps: UploadProps = {
    name: 'files',
    multiple: true,
    customRequest: async ({ file, onSuccess, onError, onProgress }) => {
      try {
        setUploading(true);
        setUploadProgress(0);
        
        // 将单个文件转换为数组
        const files = Array.isArray(file) ? file : [file];
        
        const result = await attachmentApi.upload(
          files as File[], 
          undefined, 
          (percent) => {
            setUploadProgress(percent);
            if (onProgress) {
              onProgress({ percent });
            }
          }
        );
        
        onSuccess?.(result);
      } catch (error) {
        onError?.(error as Error);
      } finally {
        setUploading(false);
      }
    },
    onChange(info) {
      if (info.file.status === 'done') {
        messageApi.success(`${info.file.name} 文件上传成功`);
        fetchAttachments();
      } else if (info.file.status === 'error') {
        messageApi.error(`${info.file.name} 文件上传失败`);
      }
    },
    showUploadList: true,
  };

  return (
    <div>
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
          <Title level={4}>附件管理</Title>
          <Upload {...uploadProps}>
            <Button icon={<UploadOutlined />} loading={uploading}>
              上传附件
            </Button>
          </Upload>
        </div>
        
        {uploading && (
          <div style={{ marginBottom: 16 }}>
            <Progress percent={uploadProgress} status="active" />
          </div>
        )}
        
        <Table 
          columns={columns} 
          dataSource={attachments} 
          rowKey="_id" 
          loading={loading}
          pagination={{
            defaultPageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 条记录`,
          }}
        />
      </Card>
      
      {/* 下载进度模态框 */}
      <Modal
        title="文件下载"
        open={downloadModalVisible}
        footer={null}
        closable={false}
        maskClosable={false}
      >
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <p>正在下载: {currentDownloadFile}</p>
          <Progress percent={downloadProgress} status="active" />
        </div>
      </Modal>

      {/* 文件预览模态框 */}
      <Modal
        title="文件预览"
        open={previewModalVisible}
        onCancel={() => {
          setPreviewModalVisible(false);
          setCurrentFile(null);
          setPreviewUrl('');
        }}
        footer={null}
        width={800}
        centered
      >
        {renderPreviewContent()}
      </Modal>
    </div>
  );
};

export default AttachmentManagement; 