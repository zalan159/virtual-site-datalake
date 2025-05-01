import { Table, Button, Space, Typography, Card, Upload, App, message, Progress, Modal } from 'antd';
import { UploadOutlined, DownloadOutlined, DeleteOutlined, EyeOutlined } from '@ant-design/icons';
import { useState, useEffect } from 'react';
import type { UploadProps, UploadFile } from 'antd';
import { attachmentApi, Attachment } from '../../services/attachmentApi';

const { Title } = Typography;

const AttachmentManagement: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [uploading, setUploading] = useState<boolean>(false);
  const [downloadProgress, setDownloadProgress] = useState<number>(0);
  const [downloading, setDownloading] = useState<boolean>(false);
  const [downloadModalVisible, setDownloadModalVisible] = useState<boolean>(false);
  const [currentDownloadFile, setCurrentDownloadFile] = useState<string>('');

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

  const handleDelete = async (id: string) => {
    try {
      await attachmentApi.delete(id);
      messageApi.success('删除成功');
      fetchAttachments();
    } catch (error) {
      messageApi.error('删除失败');
    }
  };

  const handleDownload = async (id: string, filename: string) => {
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
          <Button type="link" icon={<EyeOutlined />}>
            查看
          </Button>
          <Button 
            type="link" 
            icon={<DownloadOutlined />}
            onClick={() => handleDownload(record._id, record.filename)}
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
    </div>
  );
};

export default AttachmentManagement; 