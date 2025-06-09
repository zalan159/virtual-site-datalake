import React, { useState, useEffect } from 'react';
import {
  Button,
  Space,
  Modal,
  Form,
  Input,
  message,
  Popconfirm,
  Tag,
  Image,
  Card,
  Row,
  Col,
  Select,
  Tooltip,
  Pagination
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  EyeOutlined,
  CopyOutlined,
  BarChartOutlined
} from '@ant-design/icons';
import chartApi, { Chart, ChartCreateRequest, ChartUpdateRequest } from '../../services/chartApi';

const { Option } = Select;
const { TextArea } = Input;

const ChartData: React.FC = () => {
  const [charts, setCharts] = useState<Chart[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingChart, setEditingChart] = useState<Chart | null>(null);
  const [form] = Form.useForm();
  const [searchName, setSearchName] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('');

  const fetchCharts = async () => {
    setLoading(true);
    try {
      const response = await chartApi.getChartList({
        page: currentPage,
        page_size: pageSize,
        name: searchName || undefined,
        status: filterStatus || undefined
      });
      setCharts(response.charts);
      setTotal(response.total);
    } catch (error) {
      message.error('获取图表列表失败');
      console.error('Error fetching charts:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCharts();
  }, [currentPage, pageSize, searchName, filterStatus]);

  const handleCreate = () => {
    setEditingChart(null);
    form.resetFields();
    setIsModalVisible(true);
  };

  const handleEdit = (chart: Chart) => {
    setEditingChart(chart);
    form.setFieldsValue({
      name: chart.name,
      description: chart.description,
      width: chart.width,
      height: chart.height,
      status: chart.status,
      is_public: chart.is_public
    });
    setIsModalVisible(true);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      
      if (editingChart) {
        // 更新图表
        const updateData: ChartUpdateRequest = {
          name: values.name,
          description: values.description,
          width: values.width,
          height: values.height,
          status: values.status,
          is_public: values.is_public
        };
        await chartApi.updateChart(editingChart.uid, updateData);
        message.success('图表更新成功');
      } else {
        // 创建新图表
        const createData: ChartCreateRequest = {
          name: values.name,
          description: values.description,
          width: values.width || 1920,
          height: values.height || 1080,
          is_public: values.is_public || false,
          config: {
            // 默认的GoView配置结构
            width: values.width || 1920,
            height: values.height || 1080,
            chartTheme: 'default',
            chartList: []
          }
        };
        await chartApi.createChart(createData);
        message.success('图表创建成功');
      }
      
      setIsModalVisible(false);
      fetchCharts();
    } catch (error) {
      message.error(editingChart ? '更新失败' : '创建失败');
      console.error('Error submitting chart:', error);
    }
  };

  const handleDelete = async (chartId: string) => {
    try {
      await chartApi.deleteChart(chartId);
      message.success('删除成功');
      fetchCharts();
    } catch (error) {
      message.error('删除失败');
      console.error('Error deleting chart:', error);
    }
  };

  const handleCopy = async (chart: Chart) => {
    try {
      const createData: ChartCreateRequest = {
        name: `${chart.name} - 副本`,
        description: chart.description,
        width: chart.width,
        height: chart.height,
        is_public: false,
        config: { ...chart.config }
      };
      await chartApi.createChart(createData);
      message.success('复制成功');
      fetchCharts();
    } catch (error) {
      message.error('复制失败');
      console.error('Error copying chart:', error);
    }
  };

  const handleEditInGoView = (chartId: string) => {
    // 跳转到GoView编辑器
    window.open(`/chart-editor/${chartId}`, '_blank');
  };

  const handlePreview = (chartId: string) => {
    // 预览图表
    window.open(`/chart-preview/${chartId}`, '_blank');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'published':
        return 'green';
      case 'draft':
        return 'orange';
      case 'archived':
        return 'red';
      default:
        return 'default';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'published':
        return '已发布';
      case 'draft':
        return '草稿';
      case 'archived':
        return '已归档';
      default:
        return status;
    }
  };

  return (
    <div style={{ padding: '24px' }}>
      <Card>
        <div style={{ marginBottom: 16 }}>
          <Row gutter={16} justify="space-between">
            <Col>
              <Space>
                <Input.Search
                  placeholder="搜索图表名称"
                  value={searchName}
                  onChange={(e) => setSearchName(e.target.value)}
                  onSearch={fetchCharts}
                  style={{ width: 200 }}
                />
                <Select
                  placeholder="状态筛选"
                  value={filterStatus}
                  onChange={setFilterStatus}
                  style={{ width: 120 }}
                  allowClear
                >
                  <Option value="draft">草稿</Option>
                  <Option value="published">已发布</Option>
                  <Option value="archived">已归档</Option>
                </Select>
              </Space>
            </Col>
            <Col>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={handleCreate}
              >
                新建图表
              </Button>
            </Col>
          </Row>
        </div>

        <div style={{ marginBottom: 16 }}>
          <Row gutter={[16, 16]}>
            {charts.map((chart) => (
              <Col xs={24} sm={12} md={8} lg={6} xl={4} key={chart.uid}>
                                 <Card
                   hoverable
                   loading={loading}
                   onClick={() => handleEditInGoView(chart.uid)}
                   style={{ cursor: 'pointer' }}
                   cover={
                    <div style={{ height: 120, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f5f5f5' }}>
                      {chart.preview_image ? (
                        <Image
                          src={chart.preview_image}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          fallback="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAMIAAADDCAYAAADQvc6UAAABRWlDQ1BJQ0MgUHJvZmlsZQAAKJFjYGASSSwoyGFhYGDIzSspCnJ3UoiIjFJgf8LAwSDCIMogwMCcmFxc4BgQ4ANUwgCjUcG3awyMIPqyLsis7PPOq3QdDFcvjV3jOD1boQVTPQrgSkktTgbSf4A4LbmgqISBgTEFyFYuLykAsTuAbJEioKOA7DkgdjqEvQHEToKwj4DVhAQ5A9k3gGyB5IxEoBmML4BsnSQk8XQkNtReEOBxcfXxUQg1Mjc0dyHgXNJBSWpFCYh2zi+oLMpMzyhRcASGUqqCZ16yno6CkYGRAQMDKMwhqj/fAIcloxgHQqxAjIHBEugw5sUIsSQpBobtQPdLciLEVJYzMPBHMDBsayhILEqEO4DxG0txmrERhM29nYGBddr//5/DGRjYNRkY/l7////39v///y4Dmn+LgeHANwDrkl1AuO+pmgAAADhlWElmTU0AKgAAAAgAAYdpAAQAAAABAAAAGgAAAAAAAqACAAQAAAABAAAAwqADAAQAAAABAAAAwwAAAAD9b/HnAAAHlklEQVR4Ae3dP3Ik1RnG4W+FgJDI2/FuCQiJfQfYJeAgg4dA76LIqzOgS8BeKVAG7FGz94hdAiJjQKHU3z8qLaauu6v/7xfP1/d7oSGpu7q7 avPr/efXt"
                        />
                      ) : (
                        <BarChartOutlined style={{ fontSize: 40, color: '#ccc' }} />
                      )}
                    </div>
                  }
                                     actions={[
                     <Tooltip title="编辑">
                       <Button
                         type="primary"
                         size="small"
                         icon={<EditOutlined />}
                         onClick={(e) => {
                           e.stopPropagation();
                           handleEditInGoView(chart.uid);
                         }}
                       />
                     </Tooltip>,
                     <Tooltip title="预览">
                       <Button
                         size="small"
                         icon={<EyeOutlined />}
                         onClick={(e) => {
                           e.stopPropagation();
                           handlePreview(chart.uid);
                         }}
                       />
                     </Tooltip>,
                     <Tooltip title="设置">
                       <Button
                         size="small"
                         icon={<EditOutlined />}
                         onClick={(e) => {
                           e.stopPropagation();
                           handleEdit(chart);
                         }}
                       />
                     </Tooltip>,
                     <Tooltip title="复制">
                       <Button
                         size="small"
                         icon={<CopyOutlined />}
                         onClick={(e) => {
                           e.stopPropagation();
                           handleCopy(chart);
                         }}
                       />
                     </Tooltip>,
                     <Popconfirm
                       title="确定要删除这个图表吗？"
                       onConfirm={() => handleDelete(chart.uid)}
                       okText="确定"
                       cancelText="取消"
                     >
                       <Tooltip title="删除">
                         <Button
                           size="small"
                           danger
                           icon={<DeleteOutlined />}
                           onClick={(e) => e.stopPropagation()}
                         />
                       </Tooltip>
                     </Popconfirm>
                   ]}
                >
                  <Card.Meta
                    title={
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Tooltip title={chart.name}>
                          <span style={{ 
                            overflow: 'hidden', 
                            textOverflow: 'ellipsis', 
                            whiteSpace: 'nowrap',
                            maxWidth: '120px'
                          }}>
                            {chart.name}
                          </span>
                        </Tooltip>
                        <Tag color={getStatusColor(chart.status)} style={{ marginLeft: 8 }}>
                          {getStatusText(chart.status)}
                        </Tag>
                      </div>
                    }
                    description={
                      <div>
                        <div style={{ marginBottom: 8 }}>
                          <Tooltip title={chart.description || '无描述'}>
                            <div style={{ 
                              overflow: 'hidden', 
                              textOverflow: 'ellipsis', 
                              whiteSpace: 'nowrap',
                              color: '#666',
                              fontSize: '12px'
                            }}>
                              {chart.description || '无描述'}
                            </div>
                          </Tooltip>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', color: '#999' }}>
                          <span>{chart.width} × {chart.height}</span>
                          <Tag color={chart.is_public ? 'blue' : 'default'} style={{ fontSize: '10px' }}>
                            {chart.is_public ? '公开' : '私有'}
                          </Tag>
                        </div>
                        <div style={{ fontSize: '11px', color: '#999', marginTop: 4 }}>
                          {new Date(chart.updated_at).toLocaleString()}
                        </div>
                      </div>
                    }
                  />
                </Card>
              </Col>
            ))}
          </Row>
        </div>

        {charts.length === 0 && !loading && (
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#999' }}>
            <BarChartOutlined style={{ fontSize: 48, marginBottom: 16 }} />
            <div>暂无图表数据</div>
          </div>
        )}

        <div style={{ textAlign: 'center', marginTop: 24 }}>
          <Pagination
            current={currentPage}
            pageSize={pageSize}
            total={total}
            showSizeChanger
            showQuickJumper
            showTotal={(total, range) => `第 ${range[0]}-${range[1]} 条/共 ${total} 条`}
            onChange={(page, size) => {
              setCurrentPage(page);
              setPageSize(size);
            }}
          />
        </div>
      </Card>

      <Modal
        title={editingChart ? '编辑图表' : '新建图表'}
        open={isModalVisible}
        onOk={handleSubmit}
        onCancel={() => setIsModalVisible(false)}
        okText="确定"
        cancelText="取消"
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{
            width: 1920,
            height: 1080,
            status: 'draft',
            is_public: false
          }}
        >
          <Form.Item
            name="name"
            label="图表名称"
            rules={[{ required: true, message: '请输入图表名称' }]}
          >
            <Input placeholder="请输入图表名称" />
          </Form.Item>

          <Form.Item
            name="description"
            label="描述"
          >
            <TextArea rows={3} placeholder="请输入图表描述" />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="width"
                label="宽度"
                rules={[{ required: true, message: '请输入宽度' }]}
              >
                <Input type="number" placeholder="1920" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="height"
                label="高度"
                rules={[{ required: true, message: '请输入高度' }]}
              >
                <Input type="number" placeholder="1080" />
              </Form.Item>
            </Col>
          </Row>

          {editingChart && (
            <>
              <Form.Item
                name="status"
                label="状态"
              >
                <Select>
                  <Option value="draft">草稿</Option>
                  <Option value="published">已发布</Option>
                  <Option value="archived">已归档</Option>
                </Select>
              </Form.Item>

              <Form.Item
                name="is_public"
                label="访问权限"
              >
                <Select>
                  <Option value={false}>私有</Option>
                  <Option value={true}>公开</Option>
                </Select>
              </Form.Item>
            </>
          )}
        </Form>
      </Modal>
    </div>
  );
};

export default ChartData;