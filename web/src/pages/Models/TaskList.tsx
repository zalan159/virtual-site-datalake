import { Table, Button, Space, Tag, Typography, Card, Progress, Select, Modal, App, message } from 'antd';
import { PlusOutlined, DeleteOutlined, ExclamationCircleOutlined, ReloadOutlined } from '@ant-design/icons';
import { useState, useEffect } from 'react';
import taskAPI, { Task, TaskStatus, TaskType } from '../../services/taskApi';

const { Title } = Typography;
const { Option } = Select;
const { confirm } = Modal;

const TaskList: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [statusFilter, setStatusFilter] = useState<TaskStatus | undefined>(undefined);
  const [typeFilter, setTypeFilter] = useState<TaskType | undefined>(undefined);
  const { message: messageApi } = App.useApp();

  // 获取任务列表
  const fetchTasks = async () => {
    setLoading(true);
    try {
      const data = await taskAPI.getTasks(statusFilter, typeFilter);
      setTasks(data);
    } catch (error) {
      messageApi.error('获取任务列表失败: ' + (error instanceof Error ? error.message : '未知错误'));
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // 组件加载时获取任务列表
  useEffect(() => {
    fetchTasks();
  }, [statusFilter, typeFilter]);

  // 删除任务
  const handleDeleteTask = (taskId: string) => {
    confirm({
      title: '确认删除',
      icon: <ExclamationCircleOutlined />,
      content: '确定要删除这个任务吗？此操作不可恢复。',
      okText: '确认',
      cancelText: '取消',
      onOk: async () => {
        try {
          await taskAPI.deleteTask(taskId);
          messageApi.success('任务已删除');
          fetchTasks();
        } catch (error) {
          messageApi.error('删除任务失败: ' + (error instanceof Error ? error.message : '未知错误'));
        }
      },
    });
  };

  // 刷新任务列表
  const handleRefresh = () => {
    fetchTasks();
  };

  // 获取状态标签颜色
  const getStatusColor = (status: TaskStatus) => {
    switch (status) {
      case TaskStatus.COMPLETED:
        return 'green';
      case TaskStatus.PROCESSING:
        return 'processing';
      case TaskStatus.FAILED:
        return 'red';
      case TaskStatus.PENDING:
        return 'default';
      default:
        return 'default';
    }
  };

  // 获取任务类型显示文本
  const getTaskTypeText = (type: TaskType) => {
    switch (type) {
      case TaskType.FILE_CONVERSION:
        return '文件转换';
      default:
        return type;
    }
  };

  // 格式化日期时间
  const formatDateTime = (dateTimeStr: string) => {
    if (!dateTimeStr) return '-';
    try {
      const date = new Date(dateTimeStr);
      return date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch (error) {
      console.error('日期格式化错误:', error);
      return dateTimeStr;
    }
  };

  const columns = [
    {
      title: '任务ID',
      dataIndex: 'task_id',
      key: 'task_id',
      width: 220,
    },
    {
      title: '任务类型',
      dataIndex: 'task_type',
      key: 'task_type',
      render: (type: TaskType) => getTaskTypeText(type),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: TaskStatus) => (
        <Tag color={getStatusColor(status)}>
          {status}
        </Tag>
      ),
    },
    {
      title: '进度',
      dataIndex: 'progress',
      key: 'progress',
      render: (progress: number) => (
        <Progress percent={progress} size="small" />
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (date: string) => formatDateTime(date),
    },
    {
      title: '更新时间',
      dataIndex: 'updated_at',
      key: 'updated_at',
      render: (date: string) => formatDateTime(date),
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: Task) => (
        <Space size="middle">
          <Button type="link" danger icon={<DeleteOutlined />} onClick={() => handleDeleteTask(record.task_id)}>
            删除
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
          <Title level={4}>任务列表</Title>
          <Space>
            <Button icon={<ReloadOutlined />} onClick={handleRefresh} loading={loading}>
              刷新
            </Button>
            {/* <Button type="primary" icon={<PlusOutlined />}>
              创建任务
            </Button> */}
          </Space>
        </div>
        
        <div style={{ marginBottom: 16 }}>
          <Space>
            <Select
              placeholder="状态筛选"
              style={{ width: 120 }}
              allowClear
              value={statusFilter}
              onChange={setStatusFilter}
            >
              <Option value={TaskStatus.PENDING}>等待处理</Option>
              <Option value={TaskStatus.PROCESSING}>处理中</Option>
              <Option value={TaskStatus.COMPLETED}>已完成</Option>
              <Option value={TaskStatus.FAILED}>失败</Option>
            </Select>
            
            <Select
              placeholder="类型筛选"
              style={{ width: 120 }}
              allowClear
              value={typeFilter}
              onChange={setTypeFilter}
            >
              <Option value={TaskType.FILE_CONVERSION}>文件转换</Option>
            </Select>
          </Space>
        </div>
        
        <Table 
          columns={columns} 
          dataSource={tasks} 
          rowKey="task_id" 
          loading={loading}
          pagination={{ 
            defaultPageSize: 10,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 条记录`
          }}
        />
      </Card>
    </div>
  );
};

export default TaskList; 