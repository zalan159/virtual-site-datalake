import { Table, Button, Space, Typography, Card, Modal, Form, Input, App, message, Select, Upload, Tag, Progress, Descriptions, Dropdown, Menu } from 'antd';
import { PlusOutlined, DeleteOutlined, EditOutlined, EyeOutlined, UploadOutlined, GlobalOutlined, FileImageOutlined, PlayCircleOutlined, MoreOutlined } from '@ant-design/icons';
import { useState, useEffect } from 'react';
import { wmtsAPI, WMTSLayer, WMTSCreateData, WMTSProcessStatus } from '../../services/wmtsApi';
import type { ColumnsType } from 'antd/es/table';
import type { UploadFile } from 'antd/es/upload/interface';
import { buildTiandituWMTSUrl, getTiandituLayerConfig, validateTiandituToken, TIANDITU_LAYER_OPTIONS } from '../../config/tiandituConfig';

const { Title } = Typography;
const { TextArea } = Input;

// WMTS详情查看组件
const WMTSDetailModal: React.FC<{
  visible: boolean;
  wmts: WMTSLayer | null;
  onClose: () => void;
}> = ({ visible, wmts, onClose }) => {
  if (!wmts) return null;

  return (
    <Modal
      title={`WMTS图层详情 - ${wmts.name}`}
      open={visible}
      onCancel={onClose}
      footer={[
        <Button key="close" onClick={onClose}>
          关闭
        </Button>
      ]}
      width={800}
    >
      <Descriptions column={2} bordered>
        <Descriptions.Item label="图层名称" span={2}>
          {wmts.name}
        </Descriptions.Item>
        <Descriptions.Item label="描述" span={2}>
          {wmts.description || '无'}
        </Descriptions.Item>
        <Descriptions.Item label="数据源类型">
          <Tag color={wmts.source_type === 'file' ? 'blue' : 'green'}>
            {wmts.source_type === 'file' ? '文件' : 'URL服务'}
          </Tag>
        </Descriptions.Item>
        <Descriptions.Item label="公开状态">
          <Tag color={wmts.is_public ? 'green' : 'red'}>
            {wmts.is_public ? '公开' : '私有'}
          </Tag>
        </Descriptions.Item>
        {wmts.source_type === 'url' && wmts.service_url && (
          <Descriptions.Item label="服务URL" span={2}>
            <a href={wmts.service_url} target="_blank" rel="noopener noreferrer">
              {wmts.service_url}
            </a>
          </Descriptions.Item>
        )}
        {wmts.layer_name && (
          <Descriptions.Item label="图层标识">
            {wmts.layer_name}
          </Descriptions.Item>
        )}
        <Descriptions.Item label="瓦片格式">
          {wmts.format || 'image/png'}
        </Descriptions.Item>
        <Descriptions.Item label="最小缩放">
          {wmts.min_zoom || 0}
        </Descriptions.Item>
        <Descriptions.Item label="最大缩放">
          {wmts.max_zoom || 18}
        </Descriptions.Item>
        {wmts.bounds && (
          <Descriptions.Item label="边界范围" span={2}>
            西: {wmts.bounds.west}, 南: {wmts.bounds.south}, 东: {wmts.bounds.east}, 北: {wmts.bounds.north}
          </Descriptions.Item>
        )}
        {wmts.original_filename && (
          <Descriptions.Item label="原始文件名">
            {wmts.original_filename}
          </Descriptions.Item>
        )}
        {wmts.file_size && (
          <Descriptions.Item label="文件大小">
            {(wmts.file_size / 1024 / 1024).toFixed(2)} MB
          </Descriptions.Item>
        )}
        <Descriptions.Item label="创建时间">
          {new Date(wmts.created_at).toLocaleString()}
        </Descriptions.Item>
        <Descriptions.Item label="更新时间">
          {new Date(wmts.updated_at).toLocaleString()}
        </Descriptions.Item>
        {wmts.tags && wmts.tags.length > 0 && (
          <Descriptions.Item label="标签" span={2}>
            {wmts.tags.map((tag, index) => (
              <Tag key={`${tag}-${index}`}>{tag}</Tag>
            ))}
          </Descriptions.Item>
        )}
        {wmts.attribution && (
          <Descriptions.Item label="版权信息" span={2}>
            {wmts.attribution}
          </Descriptions.Item>
        )}
      </Descriptions>
    </Modal>
  );
};

// 创建/编辑WMTS图层组件
const WMTSFormModal: React.FC<{
  visible: boolean;
  wmts: WMTSLayer | null;
  onClose: () => void;
  onSuccess: () => void;
}> = ({ visible, wmts, onClose, onSuccess }) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [sourceType, setSourceType] = useState<'file' | 'url'>('url');

  useEffect(() => {
    if (visible) {
      if (wmts) {
        // 编辑模式
        form.setFieldsValue({
          ...wmts,
          tags: wmts.tags?.join(',') || '',
        });
        setSourceType(wmts.source_type);
      } else {
        // 新增模式
        form.resetFields();
        setSourceType('url');
      }
    }
  }, [visible, wmts, form]);

  const handleSubmit = async (values: any) => {
    setLoading(true);
    try {
      const submitData: WMTSCreateData = {
        ...values,
        source_type: sourceType,
        tags: values.tags ? values.tags.split(',').map((tag: string) => tag.trim()).filter(Boolean) : [],
      };

      if (wmts) {
        // 编辑
        const wmtsId = wmts.id || wmts._id;
        if (!wmtsId) {
          message.error('WMTS图层ID缺失，无法更新');
          return;
        }
        await wmtsAPI.updateWMTS(wmtsId, submitData);
        message.success('更新WMTS图层成功');
      } else {
        // 新增URL类型的WMTS服务
        if (sourceType === 'url') {
          await wmtsAPI.createWMTSFromUrl(submitData);
          message.success('创建WMTS图层成功');
        }
      }
      
      onSuccess();
      onClose();
    } catch (error: any) {
      message.error(error.response?.data?.detail || '操作失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title={wmts ? '编辑WMTS图层' : '创建WMTS图层'}
      open={visible}
      onCancel={onClose}
      footer={null}
      width={600}
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
      >
        {!wmts && (
          <Form.Item label="数据源类型">
            <Select value={sourceType} onChange={setSourceType}>
              <Select.Option value="url">WMTS服务URL</Select.Option>
              <Select.Option value="file">上传tpkx文件</Select.Option>
            </Select>
          </Form.Item>
        )}

        <Form.Item
          name="name"
          label="图层名称"
          rules={[{ required: true, message: '请输入图层名称' }]}
        >
          <Input placeholder="请输入图层名称" />
        </Form.Item>

        <Form.Item name="description" label="描述">
          <TextArea rows={3} placeholder="请输入图层描述" />
        </Form.Item>

        {sourceType === 'url' && (
          <>
            <Form.Item
              name="service_url"
              label="WMTS服务URL"
              rules={[
                { required: true, message: '请输入WMTS服务URL' },
                { type: 'url', message: '请输入有效的URL' }
              ]}
            >
              <Input placeholder="https://example.com/wmts" />
            </Form.Item>

            <Form.Item name="layer_name" label="图层标识">
              <Input placeholder="图层标识符" />
            </Form.Item>

            <Form.Item name="format" label="瓦片格式">
              <Select defaultValue="image/png">
                <Select.Option value="image/png">PNG</Select.Option>
                <Select.Option value="image/jpeg">JPEG</Select.Option>
                <Select.Option value="image/webp">WebP</Select.Option>
              </Select>
            </Form.Item>

            <Form.Item name="tile_matrix_set" label="瓦片矩阵集">
              <Input placeholder="GoogleMapsCompatible" defaultValue="GoogleMapsCompatible" />
            </Form.Item>
          </>
        )}

        <Form.Item name="tags" label="标签">
          <Input placeholder="用逗号分隔多个标签" />
        </Form.Item>

        <Form.Item name="attribution" label="版权信息">
          <Input placeholder="数据来源版权信息" />
        </Form.Item>

        <Form.Item name="is_public" label="公开设置" valuePropName="checked" initialValue={true}>
          <Select>
            <Select.Option value={true}>公开</Select.Option>
            <Select.Option value={false}>私有</Select.Option>
          </Select>
        </Form.Item>

        {sourceType === 'url' && (
          <Form.Item label="天地图预设配置">
            <Select
              placeholder="选择天地图预设配置"
              style={{ width: '100%' }}
              onChange={(value) => {
                if (value) {
                  const config = getTiandituLayerConfig(value);
                  form.setFieldsValue({
                    service_url: config.serviceUrl,
                    layer_name: config.layerName,
                    format: config.format,
                    tile_matrix_set: config.tileMatrixSet,
                  });
                } else {
                  form.resetFields(['service_url', 'layer_name', 'format', 'tile_matrix_set']);
                }
              }}
            >
              <Select.Option value="">不使用预设</Select.Option>
              {TIANDITU_LAYER_OPTIONS.map((item) => (
                <Select.Option key={item.value} value={item.value}>
                  {item.label}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
        )}

        <Form.Item>
          <Space>
            <Button type="primary" htmlType="submit" loading={loading}>
              {wmts ? '更新' : '创建'}
            </Button>
            <Button onClick={onClose}>取消</Button>
          </Space>
        </Form.Item>
      </Form>
    </Modal>
  );
};

// 文件上传组件
const TpkxUploadModal: React.FC<{
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
}> = ({ visible, onClose, onSuccess }) => {
  const [form] = Form.useForm();
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [processStatus, setProcessStatus] = useState<WMTSProcessStatus | null>(null);

  const handleUpload = async (values: any) => {
    if (fileList.length === 0) {
      message.error('请选择要上传的tpkx文件');
      return;
    }

    setUploading(true);
    try {
      const file = fileList[0].originFileObj;
      if (!file) {
        message.error('文件上传失败');
        return;
      }
      
      const metadata = {
        name: values.name,
        description: values.description,
        tags: values.tags ? values.tags.split(',').map((tag: string) => tag.trim()).filter(Boolean) : [],
        is_public: values.is_public ?? true,
      };

      // 上传并处理文件
      const result = await wmtsAPI.uploadAndProcessTpkx(file as File, metadata);
      
      if (result.process_id) {
        // 开始轮询处理状态
        const status = await wmtsAPI.pollProcessStatus(
          result.process_id,
          (status) => setProcessStatus(status)
        );
        
        message.success('tpkx文件处理完成');
        onSuccess();
        onClose();
      }
    } catch (error: any) {
      message.error(error.message || '上传失败');
    } finally {
      setUploading(false);
      setProcessStatus(null);
    }
  };

  const uploadProps = {
    beforeUpload: (file: any) => {
      if (!file.name.endsWith('.tpkx')) {
        message.error('只能上传.tpkx格式的文件');
        return Upload.LIST_IGNORE;
      }
      setFileList([{
        uid: file.name,
        name: file.name,
        status: 'done' as const,
        originFileObj: file,
      }]);
      return false;
    },
    fileList,
    onRemove: () => {
      setFileList([]);
    },
  };

  return (
    <Modal
      title="上传tpkx瓦片文件"
      open={visible}
      onCancel={onClose}
      footer={null}
      width={600}
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={handleUpload}
      >
        <Form.Item
          name="name"
          label="图层名称"
          rules={[{ required: true, message: '请输入图层名称' }]}
        >
          <Input placeholder="请输入图层名称" />
        </Form.Item>

        <Form.Item name="description" label="描述">
          <TextArea rows={3} placeholder="请输入图层描述" />
        </Form.Item>

        <Form.Item name="tags" label="标签">
          <Input placeholder="用逗号分隔多个标签" />
        </Form.Item>

        <Form.Item name="is_public" label="公开设置" initialValue={true}>
          <Select>
            <Select.Option value={true}>公开</Select.Option>
            <Select.Option value={false}>私有</Select.Option>
          </Select>
        </Form.Item>

        <Form.Item label="选择tpkx文件" required>
          <Upload {...uploadProps}>
            <Button icon={<UploadOutlined />}>选择文件</Button>
          </Upload>
          <div style={{ color: '#666', fontSize: '12px', marginTop: '8px' }}>
            支持上传.tpkx格式的瓦片包文件
          </div>
        </Form.Item>

        {processStatus && (
          <Form.Item label="处理进度">
            <div>
              <div style={{ marginBottom: '8px' }}>状态: {processStatus.message}</div>
              {processStatus.status === 'processing' && (
                <Progress percent={50} status="active" />
              )}
            </div>
          </Form.Item>
        )}

        <Form.Item>
          <Space>
            <Button 
              type="primary" 
              htmlType="submit" 
              loading={uploading}
              disabled={fileList.length === 0}
            >
              上传并处理
            </Button>
            <Button onClick={onClose}>取消</Button>
          </Space>
        </Form.Item>
      </Form>
    </Modal>
  );
};

const TileData: React.FC = () => {
  const [wmtsList, setWmtsList] = useState<WMTSLayer[]>([]);
  const [loading, setLoading] = useState(false);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [formModalVisible, setFormModalVisible] = useState(false);
  const [uploadModalVisible, setUploadModalVisible] = useState(false);
  const [selectedWmts, setSelectedWmts] = useState<WMTSLayer | null>(null);

  const loadWmtsList = async () => {
    setLoading(true);
    try {
      const response = await wmtsAPI.getWMTSList();
      console.log('WMTS列表响应:', response.data);
      setWmtsList(response.data || []);
    } catch (error: any) {
      message.error('加载WMTS图层列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWmtsList();
  }, []);

  const handleDelete = async (wmts: WMTSLayer) => {
    const wmtsId = wmts.id || wmts._id;
    if (!wmtsId) {
      message.error('WMTS图层ID缺失，无法删除');
      return;
    }
    
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除WMTS图层"${wmts.name}"吗？此操作不可恢复。`,
      onOk: async () => {
        try {
          await wmtsAPI.deleteWMTS(wmtsId);
          message.success('删除成功');
          loadWmtsList();
        } catch (error: any) {
          message.error('删除失败');
        }
      },
    });
  };

  const columns: ColumnsType<WMTSLayer> = [
    {
      title: '图层名称',
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => (
        <Space>
          {record.source_type === 'file' ? (
            <FileImageOutlined style={{ color: '#1890ff' }} />
          ) : (
            <GlobalOutlined style={{ color: '#52c41a' }} />
          )}
          {text}
        </Space>
      ),
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
      render: (text) => text || '-',
    },
    {
      title: '数据源类型',
      dataIndex: 'source_type',
      key: 'source_type',
      render: (type) => (
        <Tag color={type === 'file' ? 'blue' : 'green'}>
          {type === 'file' ? '文件' : 'URL服务'}
        </Tag>
      ),
    },
    {
      title: '瓦片格式',
      dataIndex: 'format',
      key: 'format',
      render: (format) => format || 'image/png',
    },
    {
      title: '缩放范围',
      key: 'zoom_range',
      render: (_, record) => `${record.min_zoom || 0} - ${record.max_zoom || 18}`,
    },
    {
      title: '状态',
      dataIndex: 'is_public',
      key: 'is_public',
      render: (isPublic) => (
        <Tag color={isPublic ? 'green' : 'red'}>
          {isPublic ? '公开' : '私有'}
        </Tag>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (time) => new Date(time).toLocaleString(),
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => {
        const menu = (
          <Menu>
            <Menu.Item
              key="detail"
              icon={<EyeOutlined />}
              onClick={() => {
                setSelectedWmts(record);
                setDetailModalVisible(true);
              }}
            >
              详情
            </Menu.Item>
            <Menu.Item
              key="preview"
              icon={<PlayCircleOutlined />}
              onClick={() => {
                const wmtsId = record.id || record._id;
                if (!wmtsId) {
                  message.error('WMTS图层ID缺失，无法预览');
                  return;
                }
                const previewUrl = `/tile-preview?wmtsId=${wmtsId}`;
                window.open(previewUrl, '_blank');
              }}
            >
              预览
            </Menu.Item>
            <Menu.Item
              key="edit"
              icon={<EditOutlined />}
              onClick={() => {
                const wmtsId = record.id || record._id;
                if (!wmtsId) {
                  message.error('WMTS图层ID缺失，无法编辑');
                  return;
                }
                setSelectedWmts(record);
                setFormModalVisible(true);
              }}
            >
              编辑
            </Menu.Item>
            <Menu.Item
              key="delete"
              danger
              icon={<DeleteOutlined />}
              onClick={() => handleDelete(record)}
            >
              删除
            </Menu.Item>
          </Menu>
        );

        return (
          <Dropdown overlay={menu} trigger={['click']}>
            <Button type="text" icon={<MoreOutlined />} />
          </Dropdown>
        );
      },
    },
  ];

  return (
    <div>
      <Card>
        <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Title level={4} style={{ margin: 0 }}>瓦片数据管理</Title>
          <Space>
            <Button
              type="primary"
              icon={<GlobalOutlined />}
              onClick={() => {
                setSelectedWmts(null);
                setFormModalVisible(true);
              }}
            >
              添加WMTS服务
            </Button>
            <Button
              type="primary"
              icon={<UploadOutlined />}
              onClick={() => setUploadModalVisible(true)}
            >
              上传tpkx文件
            </Button>
          </Space>
        </div>
        
        <Table
          columns={columns}
          dataSource={wmtsList}
          rowKey={(record) => record.id || record._id || record.name}
          loading={loading}
          pagination={{
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 条记录`,
          }}
        />
      </Card>

      <WMTSDetailModal
        visible={detailModalVisible}
        wmts={selectedWmts}
        onClose={() => {
          setDetailModalVisible(false);
          setSelectedWmts(null);
        }}
      />

      <WMTSFormModal
        visible={formModalVisible}
        wmts={selectedWmts}
        onClose={() => {
          setFormModalVisible(false);
          setSelectedWmts(null);
        }}
        onSuccess={loadWmtsList}
      />

      <TpkxUploadModal
        visible={uploadModalVisible}
        onClose={() => setUploadModalVisible(false)}
        onSuccess={loadWmtsList}
      />
    </div>
  );
};

export default TileData;