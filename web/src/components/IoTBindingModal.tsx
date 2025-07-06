import React, { useState, useEffect } from 'react';
import {
  Modal,
  Table,
  Button,
  Space,
  Typography,
  Alert,
  Tag,
  message,
  Popconfirm,
  Empty,
  Card,
  Row,
  Col,
  Divider
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  SettingOutlined,
  ExperimentOutlined,
  CloudOutlined,
  InfoCircleOutlined
} from '@ant-design/icons';

import {
  iotBindingAPI,
  IoTBinding,
  IoTProtocolType,
  IoTDataType,
  BindingDirection
} from '../services/iotBindingApi';
import IoTBindingConfigModal from './IoTBindingConfigModal';

const { Title, Text } = Typography;

interface IoTBindingModalProps {
  visible: boolean;
  instanceId: string;
  sceneId: string;
  bindings?: IoTBinding[];
  onClose: () => void;
  onSave: (bindings: IoTBinding[]) => void;
}

const IoTBindingModal: React.FC<IoTBindingModalProps> = ({
  visible,
  instanceId,
  sceneId,
  bindings = [],
  onClose,
  onSave
}) => {
  const [existingBindings, setExistingBindings] = useState<IoTBinding[]>([]);
  const [loading, setLoading] = useState(false);
  const [configModalVisible, setConfigModalVisible] = useState(false);
  const [editingBinding, setEditingBinding] = useState<IoTBinding | null>(null);

  // 加载现有绑定
  const loadExistingBindings = async () => {
    try {
      setLoading(true);
      console.log('正在加载IoT绑定:', { sceneId, instanceId });
      const response = await iotBindingAPI.getInstanceBindings(sceneId, instanceId);
      console.log('成功加载IoT绑定:', response.data);
      setExistingBindings(response.data);
    } catch (error: any) {
      console.error('加载绑定配置失败:', error);
      console.error('错误详情:', {
        message: error?.message,
        status: error?.response?.status,
        data: error?.response?.data,
        url: error?.config?.url
      });
      // 暂时不显示错误，因为可能是新实例还没有绑定
      setExistingBindings([]);
    } finally {
      setLoading(false);
    }
  };

  // 初始化
  useEffect(() => {
    if (visible) {
      loadExistingBindings();
    }
  }, [visible, sceneId, instanceId]);

  // 新增绑定
  const handleAddBinding = () => {
    setEditingBinding(null);
    setConfigModalVisible(true);
  };

  // 编辑绑定
  const handleEditBinding = (binding: IoTBinding) => {
    setEditingBinding(binding);
    setConfigModalVisible(true);
  };

  // 删除绑定
  const handleDeleteBinding = async (bindingId: string) => {
    try {
      setLoading(true);
      await iotBindingAPI.deleteInstanceBinding(sceneId, instanceId, bindingId);
      message.success('绑定删除成功');
      await loadExistingBindings();
      onSave(existingBindings.filter(b => b.id !== bindingId));
    } catch (error) {
      console.error('删除绑定失败:', error);
      message.error('删除绑定失败');
    } finally {
      setLoading(false);
    }
  };

  // 配置模态框保存
  const handleConfigSave = async (binding: IoTBinding) => {
    try {
      console.log('🔄 刷新绑定配置，触发父组件更新');
      
      // 重新加载最新的绑定数据
      const response = await iotBindingAPI.getInstanceBindings(sceneId, instanceId);
      const updatedBindings = response.data;
      
      console.log('📋 最新绑定数据:', updatedBindings);
      
      // 更新本地状态
      setExistingBindings(updatedBindings);
      
      // 调用父组件的onSave回调，传递最新的绑定数据
      onSave(updatedBindings);
      
      setConfigModalVisible(false);
      message.success(editingBinding ? '绑定更新成功' : '绑定创建成功');
    } catch (error) {
      console.error('保存绑定失败:', error);
      message.error('保存绑定失败');
    }
  };

  // 配置模态框关闭
  const handleConfigClose = () => {
    setConfigModalVisible(false);
    setEditingBinding(null);
  };

  // 获取协议图标和颜色
  const getProtocolDisplay = (protocol: IoTProtocolType) => {
    const configs = {
      [IoTProtocolType.MQTT]: { color: '#52c41a', text: 'MQTT' },
      [IoTProtocolType.WEBSOCKET]: { color: '#1890ff', text: 'WebSocket' },
      [IoTProtocolType.HTTP]: { color: '#fa8c16', text: 'HTTP' }
    };
    return configs[protocol] || { color: '#666', text: protocol };
  };

  // 获取数据类型显示
  const getDataTypeDisplay = (dataType: IoTDataType) => {
    const configs = {
      [IoTDataType.JSON]: { color: 'blue', text: 'JSON' },
      [IoTDataType.TEXT]: { color: 'green', text: '文本' },
      [IoTDataType.NUMBER]: { color: 'orange', text: '数值' },
      [IoTDataType.BOOLEAN]: { color: 'purple', text: '布尔' },
      [IoTDataType.IMAGE_BASE64]: { color: 'red', text: '图像' },
      [IoTDataType.BINARY]: { color: 'gray', text: '二进制' },
      [IoTDataType.IMAGE_RGBA]: { color: 'pink', text: 'RGBA' }
    };
    return configs[dataType] || { color: 'default', text: dataType };
  };

  // 获取绑定方向显示
  const getDirectionDisplay = (direction: BindingDirection) => {
    const configs = {
      [BindingDirection.IOT_TO_INSTANCE]: { text: 'IoT → 模型', color: 'blue' },
      [BindingDirection.INSTANCE_TO_IOT]: { text: '模型 → IoT', color: 'green' },
      [BindingDirection.BIDIRECTIONAL]: { text: '双向', color: 'purple' }
    };
    return configs[direction] || { text: '未知', color: 'default' };
  };

  // 表格列定义
  const columns: ColumnsType<IoTBinding> = [
    {
      title: '绑定名称',
      dataIndex: 'name',
      key: 'name',
      width: 200,
      render: (name: string, record: IoTBinding) => (
        <div>
          <div style={{ fontWeight: 'bold' }}>
            {name || `绑定-${record.id.slice(-8)}`}
          </div>
          <Text type="secondary" style={{ fontSize: '12px' }}>
            ID: {record.id}
          </Text>
        </div>
      ),
    },
    {
      title: '协议',
      dataIndex: 'protocol',
      key: 'protocol',
      width: 120,
      render: (protocol: IoTProtocolType) => {
        const display = getProtocolDisplay(protocol);
        return (
          <Tag color={display.color} icon={<CloudOutlined />}>
            {display.text}
          </Tag>
        );
      },
    },
    {
      title: '数据类型',
      dataIndex: 'dataType',
      key: 'dataType',
      width: 100,
      render: (dataType: IoTDataType) => {
        const display = getDataTypeDisplay(dataType);
        return <Tag color={display.color}>{display.text}</Tag>;
      },
    },
    {
      title: '绑定数量',
      dataIndex: 'bindings',
      key: 'bindings',
      width: 100,
      render: (bindings: any[]) => (
        <Text>{bindings?.length || 0} 个映射</Text>
      ),
    },
    {
      title: '状态',
      dataIndex: 'enabled',
      key: 'enabled',
      width: 80,
      render: (enabled: boolean) => (
        <Tag color={enabled ? 'success' : 'default'}>
          {enabled ? '启用' : '禁用'}
        </Tag>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      render: (_, record: IoTBinding) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEditBinding(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确定删除这个IoT绑定吗？"
            onConfirm={() => handleDeleteBinding(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button
              type="link"
              size="small"
              danger
              icon={<DeleteOutlined />}
            >
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <>
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <SettingOutlined style={{ marginRight: 8 }} />
            IoT数据绑定管理
          </div>
        }
        open={visible}
        onCancel={onClose}
        footer={[
          <Button key="close" onClick={onClose}>
            关闭
          </Button>
        ]}
        width={1000}
        destroyOnClose
      >
        <div style={{ marginBottom: 16 }}>
          <Alert
            type="info"
            showIcon
            message="IoT数据绑定"
            description="管理当前模型实例的IoT数据绑定配置。通过绑定可以将IoT设备数据实时映射到3D模型的属性。"
            style={{ marginBottom: 16 }}
          />
          
          <Row justify="space-between" align="middle">
            <Col>
              <Title level={4} style={{ margin: 0 }}>
                现有绑定 ({existingBindings.length})
              </Title>
            </Col>
            <Col>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={handleAddBinding}
              >
                新增IoT绑定
              </Button>
            </Col>
          </Row>
        </div>

        <Card>
          <Table
            columns={columns}
            dataSource={existingBindings}
            rowKey="id"
            loading={loading}
            pagination={false}
            locale={{
              emptyText: (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description={
                    <div>
                      <div>暂无IoT绑定配置</div>
                      <Button
                        type="link"
                        icon={<PlusOutlined />}
                        onClick={handleAddBinding}
                      >
                        立即创建第一个绑定
                      </Button>
                    </div>
                  }
                />
              )
            }}
          />
        </Card>

        {existingBindings.length > 0 && (
          <div style={{ marginTop: 16, textAlign: 'center' }}>
            <Text type="secondary">
              <InfoCircleOutlined style={{ marginRight: 4 }} />
              绑定配置会自动保存到模型实例。修改后请刷新场景以查看效果。
            </Text>
          </div>
        )}
      </Modal>

      {/* 配置绑定的子模态框 */}
      <IoTBindingConfigModal
        visible={configModalVisible}
        instanceId={instanceId}
        sceneId={sceneId}
        editingBinding={editingBinding}
        onClose={handleConfigClose}
        onSave={handleConfigSave}
      />
    </>
  );
};

export default IoTBindingModal; 