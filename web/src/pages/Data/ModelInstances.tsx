import React, { useState, useEffect } from 'react';
import { Table, Card, Button, Space, Tag, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { PlusOutlined } from '@ant-design/icons';

interface ModelInstance {
  id: string;
  name: string;
  modelId: string;
  modelName: string;
  status: 'running' | 'stopped' | 'error';
  createdAt: string;
  updatedAt: string;
}

const ModelInstances: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ModelInstance[]>([]);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0,
  });

  // 模拟数据
  const mockData: ModelInstance[] = [
    {
      id: '1',
      name: '实例-001',
      modelId: 'model-001',
      modelName: '建筑模型A',
      status: 'running',
      createdAt: '2024-04-28 10:00:00',
      updatedAt: '2024-04-28 10:00:00',
    },
    {
      id: '2',
      name: '实例-002',
      modelId: 'model-002',
      modelName: '建筑模型B',
      status: 'stopped',
      createdAt: '2024-04-28 11:00:00',
      updatedAt: '2024-04-28 11:00:00',
    },
  ];

  const columns: ColumnsType<ModelInstance> = [
    {
      title: '实例名称',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '模型名称',
      dataIndex: 'modelName',
      key: 'modelName',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const statusMap = {
          running: { color: 'green', text: '运行中' },
          stopped: { color: 'default', text: '已停止' },
          error: { color: 'red', text: '错误' },
        };
        const { color, text } = statusMap[status as keyof typeof statusMap];
        return <Tag color={color}>{text}</Tag>;
      },
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
    },
    {
      title: '更新时间',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space size="middle">
          <Button type="link" onClick={() => handleView(record)}>
            查看
          </Button>
          <Button type="link" onClick={() => handleEdit(record)}>
            编辑
          </Button>
          <Button type="link" danger onClick={() => handleDelete(record)}>
            删除
          </Button>
        </Space>
      ),
    },
  ];

  const handleView = (record: ModelInstance) => {
    message.info(`查看实例: ${record.name}`);
  };

  const handleEdit = (record: ModelInstance) => {
    message.info(`编辑实例: ${record.name}`);
  };

  const handleDelete = (record: ModelInstance) => {
    message.info(`删除实例: ${record.name}`);
  };

  const handleAdd = () => {
    message.info('创建新实例');
  };

  useEffect(() => {
    setLoading(true);
    // 模拟API调用
    setTimeout(() => {
      setData(mockData);
      setPagination(prev => ({ ...prev, total: mockData.length }));
      setLoading(false);
    }, 1000);
  }, []);

  return (
    <Card
      title="模型实例管理"
      extra={
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
          新建实例
        </Button>
      }
    >
      <Table
        columns={columns}
        dataSource={data}
        rowKey="id"
        loading={loading}
        pagination={pagination}
        onChange={(newPagination) => {
          setPagination({
            current: newPagination.current || 1,
            pageSize: newPagination.pageSize || 10,
            total: pagination.total,
          });
        }}
      />
    </Card>
  );
};

export default ModelInstances; 