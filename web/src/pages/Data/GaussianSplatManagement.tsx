import React, { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Button,
  Space,
  Upload,
  Modal,
  Form,
  Input,
  Select,
  Tag,
  message,
  Popconfirm,
  Tooltip,
  Switch,
  Row,
  Col,
  Divider,
  Badge,
  Typography,
  Descriptions,
} from 'antd';
import {
  PlusOutlined,
  EyeOutlined,
  EditOutlined,
  DeleteOutlined,
  DownloadOutlined,
  CloudUploadOutlined,
  FileOutlined,
  TagOutlined,
  UserOutlined,
  CalendarOutlined,
  DatabaseOutlined,
  GlobalOutlined,
  LockOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import { UploadFile } from 'antd/es/upload/interface';
import { gaussianSplatApi, GaussianSplat, GaussianSplatUpdate } from '../../services/gaussianSplatApi';
import { formatFileSize, formatDate } from '../../utils/formatters';

const { Title, Text } = Typography;
const { Option } = Select;
const { TextArea } = Input;

const GaussianSplatManagement: React.FC = () => {
  const [gaussianSplats, setGaussianSplats] = useState<GaussianSplat[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploadModalVisible, setUploadModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [currentSplat, setCurrentSplat] = useState<GaussianSplat | null>(null);
  const [uploadForm] = Form.useForm();
  const [editForm] = Form.useForm();
  const [searchText, setSearchText] = useState('');
  const [filterTags, setFilterTags] = useState<string[]>([]);
  const [filterPublic, setFilterPublic] = useState<boolean | undefined>();

  // 获取高斯泼溅列表
  const fetchGaussianSplats = async () => {
    setLoading(true);
    try {
      const data = await gaussianSplatApi.getGaussianSplats(
        0,
        100,
        filterTags.length > 0 ? filterTags.join(',') : undefined,
        filterPublic
      );
      setGaussianSplats(data);
    } catch (error) {
      message.error('获取高斯泼溅列表失败');
      console.error('Error fetching gaussian splats:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGaussianSplats();
  }, [filterTags, filterPublic]);

  // 上传高斯泼溅文件
  const handleUpload = async (values: any) => {
    const { file, description, tags, is_public } = values;
    
    if (!file || !file.originFileObj) {
      message.error('请选择文件');
      return;
    }

    setLoading(true);
    try {
      const tagList = tags ? tags.split(',').map((tag: string) => tag.trim()).filter(Boolean) : [];
      await gaussianSplatApi.uploadGaussianSplat(
        file.originFileObj,
        description,
        tagList,
        is_public
      );
      message.success('上传成功');
      setUploadModalVisible(false);
      uploadForm.resetFields();
      fetchGaussianSplats();
    } catch (error) {
      message.error('上传失败');
      console.error('Error uploading gaussian splat:', error);
    } finally {
      setLoading(false);
    }
  };

  // 编辑高斯泼溅
  const handleEdit = (record: GaussianSplat) => {
    setCurrentSplat(record);
    editForm.setFieldsValue({
      description: record.description,
      tags: record.tags.join(','),
      is_public: record.is_public,
      opacity: record.opacity,
      show: record.show,
    });
    setEditModalVisible(true);
  };

  // 更新高斯泼溅
  const handleUpdate = async (values: any) => {
    if (!currentSplat) return;

    setLoading(true);
    try {
      const updateData: GaussianSplatUpdate = {
        description: values.description,
        tags: values.tags ? values.tags.split(',').map((tag: string) => tag.trim()).filter(Boolean) : [],
        is_public: values.is_public,
        opacity: values.opacity,
        show: values.show,
      };

      await gaussianSplatApi.updateGaussianSplat(currentSplat.id, updateData);
      message.success('更新成功');
      setEditModalVisible(false);
      setCurrentSplat(null);
      editForm.resetFields();
      fetchGaussianSplats();
    } catch (error) {
      message.error('更新失败');
      console.error('Error updating gaussian splat:', error);
    } finally {
      setLoading(false);
    }
  };

  // 删除高斯泼溅
  const handleDelete = async (id: string) => {
    setLoading(true);
    try {
      await gaussianSplatApi.deleteGaussianSplat(id);
      message.success('删除成功');
      fetchGaussianSplats();
    } catch (error) {
      message.error('删除失败');
      console.error('Error deleting gaussian splat:', error);
    } finally {
      setLoading(false);
    }
  };

  // 下载高斯泼溅文件
  const handleDownload = async (record: GaussianSplat) => {
    try {
      const blob = await gaussianSplatApi.downloadGaussianSplat(record.id);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = record.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      message.success('下载完成');
    } catch (error) {
      message.error('下载失败');
      console.error('Error downloading gaussian splat:', error);
    }
  };

  // 预览高斯泼溅
  const handlePreview = (record: GaussianSplat) => {
    const url = `/gaussian-splat-preview/${record.id}`;
    window.open(url, '_blank');
  };

  const columns = [
    {
      title: '文件名',
      dataIndex: 'filename',
      key: 'filename',
      render: (text: string, record: GaussianSplat) => (
        <Space>
          <FileOutlined />
          <div>
            <div>{text}</div>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {record.format.toUpperCase()} · {formatFileSize(record.file_size)}
            </Text>
          </div>
        </Space>
      ),
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      render: (text: string) => text || '-',
    },
    {
      title: '标签',
      dataIndex: 'tags',
      key: 'tags',
      render: (tags: string[]) => (
        <Space wrap>
          {tags.map((tag, index) => (
            <Tag key={`${tag}-${index}`} icon={<TagOutlined />}>
              {tag}
            </Tag>
          ))}
        </Space>
      ),
    },
    {
      title: '上传者',
      dataIndex: 'username',
      key: 'username',
      render: (text: string) => (
        <Space>
          <UserOutlined />
          {text}
        </Space>
      ),
    },
    {
      title: '状态',
      key: 'status',
      render: (record: GaussianSplat) => (
        <Space>
          <Badge
            status={record.is_public ? 'success' : 'default'}
            text={record.is_public ? '公开' : '私有'}
          />
          <Badge
            status={record.show ? 'processing' : 'default'}
            text={record.show ? '显示' : '隐藏'}
          />
        </Space>
      ),
    },
    {
      title: '上传时间',
      dataIndex: 'upload_date',
      key: 'upload_date',
      render: (date: string) => (
        <Space>
          <CalendarOutlined />
          {formatDate(date)}
        </Space>
      ),
    },
    {
      title: '操作',
      key: 'action',
      render: (record: GaussianSplat) => (
        <Space>
          <Tooltip key="preview" title="预览">
            <Button 
              type="text" 
              icon={<EyeOutlined />} 
              onClick={() => handlePreview(record)}
            />
          </Tooltip>
          <Tooltip key="edit" title="编辑">
            <Button 
              type="text" 
              icon={<EditOutlined />} 
              onClick={() => handleEdit(record)}
            />
          </Tooltip>
          <Tooltip key="download" title="下载">
            <Button 
              type="text" 
              icon={<DownloadOutlined />} 
              onClick={() => handleDownload(record)}
            />
          </Tooltip>
          <Popconfirm
            key="delete"
            title="确定删除这个高斯泼溅吗？"
            onConfirm={() => handleDelete(record.id)}
            okText="确定"
            cancelText="取消"
            icon={<ExclamationCircleOutlined style={{ color: 'red' }} />}
          >
            <Tooltip title="删除">
              <Button 
                type="text" 
                danger 
                icon={<DeleteOutlined />}
              />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const filteredSplats = gaussianSplats.filter(splat =>
    splat.filename.toLowerCase().includes(searchText.toLowerCase()) ||
    splat.description?.toLowerCase().includes(searchText.toLowerCase())
  );

  return (
    <div style={{ padding: '24px' }}>
      <Card>
        <Row justify="space-between" align="middle" style={{ marginBottom: 24 }}>
          <Col>
            <Title level={4} style={{ margin: 0 }}>
              <DatabaseOutlined style={{ marginRight: 8 }} />
              高斯泼溅管理
            </Title>
            <Text type="secondary">
              管理3D高斯泼溅文件，支持PLY、SPLAT、SPZ格式
            </Text>
          </Col>
          <Col>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setUploadModalVisible(true)}
            >
              上传高斯泼溅
            </Button>
          </Col>
        </Row>

        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={8}>
            <Input
              placeholder="搜索文件名或描述"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              allowClear
            />
          </Col>
          <Col span={8}>
            <Select
              placeholder="筛选公开状态"
              value={filterPublic}
              onChange={setFilterPublic}
              allowClear
              style={{ width: '100%' }}
            >
              <Option value={true}>公开</Option>
              <Option value={false}>私有</Option>
            </Select>
          </Col>
          <Col span={8}>
            <Select
              mode="tags"
              placeholder="筛选标签"
              value={filterTags}
              onChange={setFilterTags}
              style={{ width: '100%' }}
            />
          </Col>
        </Row>

        <Table
          columns={columns}
          dataSource={filteredSplats}
          rowKey="id"
          loading={loading}
          pagination={{
            total: filteredSplats.length,
            pageSize: 10,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) =>
              `第 ${range[0]}-${range[1]} 项，共 ${total} 项`,
          }}
        />
      </Card>

      {/* 上传模态框 */}
      <Modal
        title="上传高斯泼溅文件"
        open={uploadModalVisible}
        onCancel={() => {
          setUploadModalVisible(false);
          uploadForm.resetFields();
        }}
        footer={null}
        width={600}
      >
        <Form
          form={uploadForm}
          onFinish={handleUpload}
          layout="vertical"
        >
          <Form.Item
            name="file"
            label="高斯泼溅文件"
            rules={[{ required: true, message: '请选择文件' }]}
          >
            <Upload
              beforeUpload={() => false}
              maxCount={1}
              accept=".ply,.splat,.spz"
            >
              <Button icon={<CloudUploadOutlined />}>选择文件</Button>
            </Upload>
          </Form.Item>

          <Form.Item
            name="description"
            label="描述"
          >
            <TextArea rows={3} placeholder="请输入描述信息" />
          </Form.Item>

          <Form.Item
            name="tags"
            label="标签"
          >
            <Input placeholder="请输入标签，多个标签用逗号分隔" />
          </Form.Item>

          <Form.Item
            name="is_public"
            label="公开状态"
            valuePropName="checked"
          >
            <Switch
              checkedChildren="公开"
              unCheckedChildren="私有"
            />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" loading={loading}>
                上传
              </Button>
              <Button onClick={() => setUploadModalVisible(false)}>
                取消
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* 编辑模态框 */}
      <Modal
        title="编辑高斯泼溅"
        open={editModalVisible}
        onCancel={() => {
          setEditModalVisible(false);
          setCurrentSplat(null);
          editForm.resetFields();
        }}
        footer={null}
        width={600}
      >
        <Form
          form={editForm}
          onFinish={handleUpdate}
          layout="vertical"
        >
          <Form.Item
            name="description"
            label="描述"
          >
            <TextArea rows={3} placeholder="请输入描述信息" />
          </Form.Item>

          <Form.Item
            name="tags"
            label="标签"
          >
            <Input placeholder="请输入标签，多个标签用逗号分隔" />
          </Form.Item>

          <Form.Item
            name="is_public"
            label="公开状态"
            valuePropName="checked"
          >
            <Switch
              checkedChildren="公开"
              unCheckedChildren="私有"
            />
          </Form.Item>

          <Form.Item
            name="opacity"
            label="透明度"
          >
            <Input type="number" min={0} max={1} step={0.1} />
          </Form.Item>

          <Form.Item
            name="show"
            label="显示状态"
            valuePropName="checked"
          >
            <Switch
              checkedChildren="显示"
              unCheckedChildren="隐藏"
            />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" loading={loading}>
                更新
              </Button>
              <Button onClick={() => setEditModalVisible(false)}>
                取消
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default GaussianSplatManagement;