import { Table, Button, Space, Tag, Typography, Card, Progress, Select, Modal, App } from 'antd';
import {  DeleteOutlined, ExclamationCircleOutlined, ReloadOutlined, FileOutlined, GlobalOutlined } from '@ant-design/icons';
import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import taskAPI, { Task, TaskStatus, TaskType } from '../../services/taskApi';

const { Title } = Typography;
const { Option } = Select;
const { confirm } = Modal;

const TaskList: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [statusFilter, setStatusFilter] = useState<TaskStatus | undefined>(undefined);
  const [typeFilter, setTypeFilter] = useState<string | undefined>(undefined);
  const { message: messageApi } = App.useApp();
  const navigate = useNavigate();
  const location = useLocation();

  // 获取任务列表
  const fetchTasks = useCallback(async () => {
    setLoading(true);
    try {
      const data = await taskAPI.getTasks(statusFilter, typeFilter as any);
      console.log('获取到的任务数据:', data);
      
      // 添加调试信息，检查任务类型
      if (data && data.length > 0) {
        console.log('TaskType值:', TaskType);
        
        data.forEach((task: Task) => {
          console.log(`任务ID: ${task.task_id}, 类型: ${task.task_type}`);
          console.log('任务对象:', task);
        });
      } else {
        console.log('没有获取到任务数据');
      }
      
      setTasks(data);
      
      // 检查是否有需要高亮的任务ID
      const { state } = location;
      if (state && state.activeTaskId) {
        // 可以在这里添加滚动到指定任务的逻辑
        console.log("需要高亮的任务ID:", state.activeTaskId);
        // 清除state，避免刷新时重复高亮
        navigate(location.pathname, { replace: true });
      }
    } catch (error) {
      messageApi.error('获取任务列表失败: ' + (error instanceof Error ? error.message : '未知错误'));
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, typeFilter, location, navigate, messageApi]);

  // 组件加载时获取任务列表
  useEffect(() => {
    fetchTasks();
    
    // 设置定时刷新
    const timer = setInterval(() => {
      fetchTasks();
    }, 10000); // 每10秒刷新一次
    
    return () => clearInterval(timer);
  }, [fetchTasks]);

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

  // 是否是文件转换任务
  const isFileConversionTask = (taskType: string): boolean => {
    return taskType === TaskType.FILE_CONVERSION || taskType === "file_conversion";
  };

  // 是否是3DTiles处理任务
  const is3DTilesTask = (taskType: string): boolean => {
    return taskType === TaskType.THREEDTILES_PROCESSING || taskType === "threedtiles_processing";
  };

  // 获取任务类型显示文本
  const getTaskTypeText = (type: string) => {
    if (isFileConversionTask(type)) {
      return '文件转换';
    }
    if (is3DTilesTask(type)) {
      return '3DTiles处理';
    }
    return type;
  };

  // 查看任务关联的资源
  const handleViewResource = (task: Task) => {
    if (isFileConversionTask(task.task_type)) {
      // 跳转到文件详情页面
      navigate(`/files/${task.file_id}`);
    } else if (is3DTilesTask(task.task_type)) {
      // 如果已经处理完成且有tile_id，跳转到3DTiles预览页面
      if (task.process_status && task.process_status.tile_id) {
        navigate(`/data/gis/detail/${task.process_status.tile_id}`);
      } else {
        // 否则返回到3DTiles列表
        navigate('/data/gis');
      }
    }
  };

  // 获取图标
  const getTaskTypeIcon = (type: string) => {
    if (isFileConversionTask(type)) {
      return <FileOutlined />;
    }
    if (is3DTilesTask(type)) {
      return <GlobalOutlined />;
    }
    return null;
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

  // 获取任务资源名称
  const getResourceName = (task: Task) => {
    if (task.resource_name) {
      return task.resource_name;
    }
    
    // 根据任务类型从结果中提取名称
    if (is3DTilesTask(task.task_type) && task.result) {
      if (task.result.filename) {
        return task.result.filename;
      }
      
      // 嵌套查找threedtiles_data中的名称
      if (task.result.threedtiles_data && task.result.threedtiles_data.name) {
        return task.result.threedtiles_data.name;
      }
    }
    
    return '未命名资源';
  };

  const columns = [
    {
      title: '任务ID',
      dataIndex: 'task_id',
      key: 'task_id',
      width: 220,
      ellipsis: true,
    },
    {
      title: '资源名称',
      key: 'resource_name',
      render: (_: any, record: Task) => getResourceName(record),
    },
    {
      title: '任务类型',
      dataIndex: 'task_type',
      key: 'task_type',
      render: (type: string) => (
        <Space>
          {getTaskTypeIcon(type)}
          {getTaskTypeText(type)}
        </Space>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: TaskStatus, record: Task) => {
        // 对于3DTiles任务，优先显示处理状态
        if (is3DTilesTask(record.task_type) && record.process_status) {
          return (
            <Tag color={getStatusColor(status)}>
              {status}
              {record.process_status.message ? `: ${record.process_status.message}` : ''}
            </Tag>
          );
        }
        return (
          <Tag color={getStatusColor(status)}>
            {status}
          </Tag>
        );
      },
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
          <Button 
            type="link" 
            onClick={() => handleViewResource(record)}
          >
            查看
          </Button>
          <Button 
            type="link" 
            danger 
            icon={<DeleteOutlined />} 
            onClick={() => handleDeleteTask(record.task_id)}
          >
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
              <Option value={TaskType.THREEDTILES_PROCESSING}>3DTiles处理</Option>
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
          // 添加行高亮条件
          rowClassName={(record) => {
            // 检查是否有需要高亮的任务ID
            const { state } = location;
            if (state && state.activeTaskId === record.task_id) {
              return 'highlight-row';
            }
            return '';
          }}
        />
      </Card>

      {/* 添加高亮样式 */}
      <style>
        {`
          .highlight-row {
            background-color: #e6f7ff;
          }
        `}
      </style>
    </div>
  );
};

export default TaskList; 