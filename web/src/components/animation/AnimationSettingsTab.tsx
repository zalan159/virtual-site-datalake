// components/animation/AnimationSettingsTab.tsx
import React, { useState } from 'react';
import { 
  Card, 
  Radio, 
  Switch, 
  Select, 
  Space, 
  Typography, 
  Button,
  Divider,
  Form,
  Input,
  InputNumber,
  Table,
  Popconfirm,
  Alert,
  theme
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { PlusOutlined, DeleteOutlined, SettingOutlined } from '@ant-design/icons';
import { 
  AnimationManagerState, 
  AnimationSettings, 
  AnimationTriggerType,
  IoTNodeBinding,
  ValueMapping,
  InterpolationConfig
} from '../../types/animation';
import { iotAnimationService } from '../../services/iotAnimationService';

const { Text, Title } = Typography;
const { Option } = Select;

interface AnimationSettingsTabProps {
  animationState: AnimationManagerState;
  onUpdateSettings: (settings: Partial<AnimationSettings>) => void;
}

export const AnimationSettingsTab: React.FC<AnimationSettingsTabProps> = ({
  animationState,
  onUpdateSettings,
}) => {
  const { animations, boneNodes, settings } = animationState;
  const [form] = Form.useForm();
  const [iotBindingForm] = Form.useForm();
  const [showAddBinding, setShowAddBinding] = useState(false);
  
  const { token } = theme.useToken();

  // 处理触发类型改变
  const handleTriggerTypeChange = (triggerType: AnimationTriggerType) => {
    onUpdateSettings({ triggerType });
  };

  // 处理自动播放设置改变
  const handleAutoPlaySettingsChange = (field: string, value: any) => {
    onUpdateSettings({ [field]: value });
  };

  // 处理自动播放动画序列选择
  const handleAutoPlayClipsChange = (clipIds: string[]) => {
    onUpdateSettings({ autoPlayClips: clipIds });
  };

  // 添加IoT绑定
  const handleAddIoTBinding = (values: any) => {
    const newBinding: IoTNodeBinding = {
      id: `binding_${Date.now()}`,
      nodeId: values.nodeId,
      iotDataPath: values.iotDataPath,
      bindingType: values.bindingType,
      mapping: {
        inputRange: [values.inputMin, values.inputMax],
        outputRange: [values.outputMin, values.outputMax],
        clamp: values.clamp || false,
      },
      interpolation: {
        enabled: values.interpolationEnabled || false,
        duration: values.interpolationDuration || 1000,
        easing: values.interpolationEasing || 'linear',
      },
    };

    const updatedBindings = [...settings.iotBindings, newBinding];
    onUpdateSettings({ iotBindings: updatedBindings });
    
    // 同时添加到IoT绑定服务
    if (animationState.selectedModelId) {
      iotAnimationService.addBinding(animationState.selectedModelId, newBinding);
    }
    
    iotBindingForm.resetFields();
    setShowAddBinding(false);
  };

  // 删除IoT绑定
  const handleDeleteIoTBinding = (bindingId: string) => {
    const updatedBindings = settings.iotBindings.filter(b => b.id !== bindingId);
    onUpdateSettings({ iotBindings: updatedBindings });
    
    // 同时从IoT绑定服务中移除
    if (animationState.selectedModelId) {
      iotAnimationService.removeBinding(animationState.selectedModelId, bindingId);
    }
  };

  // IoT绑定表格列定义
  const iotBindingColumns: ColumnsType<IoTNodeBinding> = [
    {
      title: '节点',
      dataIndex: 'nodeId',
      key: 'nodeId',
      render: (nodeId: string) => {
        const node = findNodeById(boneNodes, nodeId);
        return <Text code>{node?.name || nodeId}</Text>;
      },
    },
    {
      title: 'IoT数据路径',
      dataIndex: 'iotDataPath',
      key: 'iotDataPath',
      render: (path: string) => <Text code>{path}</Text>,
    },
    {
      title: '绑定类型',
      dataIndex: 'bindingType',
      key: 'bindingType',
      render: (type: string) => {
        const typeMap = {
          translation: '平移',
          rotation: '旋转',
          scale: '缩放',
        };
        return typeMap[type as keyof typeof typeMap] || type;
      },
    },
    {
      title: '输入范围',
      key: 'inputRange',
      render: (_, record) => `[${record.mapping.inputRange[0]}, ${record.mapping.inputRange[1]}]`,
    },
    {
      title: '输出范围',
      key: 'outputRange',
      render: (_, record) => `[${record.mapping.outputRange[0]}, ${record.mapping.outputRange[1]}]`,
    },
    {
      title: '插值',
      key: 'interpolation',
      render: (_, record) => record.interpolation.enabled ? 
        `${record.interpolation.duration}ms (${record.interpolation.easing})` : '关闭',
    },
    {
      title: '操作',
      key: 'action',
      width: 80,
      render: (_, record) => (
        <Popconfirm
          title="确定删除此绑定吗？"
          onConfirm={() => handleDeleteIoTBinding(record.id)}
          okText="删除"
          cancelText="取消"
        >
          <Button type="link" size="small" danger icon={<DeleteOutlined />} />
        </Popconfirm>
      ),
    },
  ];

  // 查找节点
  const findNodeById = (nodes: any[], id: string): any => {
    for (const node of nodes) {
      if (node.id === id) return node;
      if (node.children && node.children.length > 0) {
        const found = findNodeById(node.children, id);
        if (found) return found;
      }
    }
    return null;
  };

  // 获取所有节点的平铺列表
  const flattenNodes = (nodes: any[]): any[] => {
    let result: any[] = [];
    nodes.forEach(node => {
      result.push(node);
      if (node.children && node.children.length > 0) {
        result.push(...flattenNodes(node.children));
      }
    });
    return result;
  };

  const allNodes = flattenNodes(boneNodes);

  return (
    <div style={{ padding: 16, height: '100%', overflow: 'auto' }}>
      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        
        {/* 触发设置 */}
        <Card size="small" title={<><SettingOutlined /> 动画触发设置</>}>
          <Form layout="vertical">
            <Form.Item label="触发方式">
              <Radio.Group 
                value={settings.triggerType} 
                onChange={(e) => handleTriggerTypeChange(e.target.value)}
              >
                <Radio.Button value={AnimationTriggerType.AUTO}>自动播放</Radio.Button>
                <Radio.Button value={AnimationTriggerType.MANUAL}>手动触发</Radio.Button>
                <Radio.Button value={AnimationTriggerType.IOT_EVENT}>IoT事件</Radio.Button>
                <Radio.Button value={AnimationTriggerType.TIME_EVENT}>时间事件</Radio.Button>
              </Radio.Group>
            </Form.Item>
          </Form>
        </Card>

        {/* 自动播放设置 */}
        {settings.triggerType === AnimationTriggerType.AUTO && (
          <Card size="small" title="自动播放配置">
            <Space direction="vertical" style={{ width: '100%' }}>
              
              <Form.Item label="自动播放的动画序列">
                <Select
                  mode="multiple"
                  placeholder="选择要自动播放的动画序列"
                  value={settings.autoPlayClips}
                  onChange={handleAutoPlayClipsChange}
                  style={{ width: '100%' }}
                >
                  {animations.map(animation => (
                    <Option key={animation.id} value={animation.id}>
                      {animation.name}
                    </Option>
                  ))}
                </Select>
              </Form.Item>

              <Form.Item>
                <Space wrap>
                  <Space>
                    <Text>顺序播放:</Text>
                    <Switch 
                      checked={settings.playSequentially}
                      onChange={(checked) => handleAutoPlaySettingsChange('playSequentially', checked)}
                    />
                  </Space>
                  <Space>
                    <Text>随机播放:</Text>
                    <Switch 
                      checked={settings.randomPlay}
                      onChange={(checked) => handleAutoPlaySettingsChange('randomPlay', checked)}
                    />
                  </Space>
                  <Space>
                    <Text>循环播放:</Text>
                    <Switch 
                      checked={settings.loopPlayback}
                      onChange={(checked) => handleAutoPlaySettingsChange('loopPlayback', checked)}
                    />
                  </Space>
                </Space>
              </Form.Item>

              {settings.autoPlayClips.length > 0 && (
                <Alert
                  message="自动播放预览"
                  description={`将${settings.playSequentially ? '依次' : '随机'}播放所选动画序列${settings.loopPlayback ? '并循环' : ''}`}
                  type="info"
                  showIcon
                />
              )}
            </Space>
          </Card>
        )}

        {/* IoT事件绑定设置 */}
        {settings.triggerType === AnimationTriggerType.IOT_EVENT && (
          <Card 
            size="small" 
            title="IoT数据绑定" 
            extra={
              <Space>
                <Button 
                  type="default" 
                  size="small"
                  onClick={() => iotAnimationService.simulateIoTData()}
                >
                  模拟数据
                </Button>
                <Button 
                  type="primary" 
                  size="small" 
                  icon={<PlusOutlined />}
                  onClick={() => setShowAddBinding(true)}
                >
                  添加绑定
                </Button>
              </Space>
            }
          >
            <Table
              dataSource={settings.iotBindings}
              columns={iotBindingColumns}
              rowKey="id"
              size="small"
              pagination={false}
              locale={{ emptyText: '暂无IoT绑定，点击上方"添加绑定"按钮创建' }}
            />
          </Card>
        )}

        {/* 添加IoT绑定表单 */}
        {showAddBinding && (
          <Card size="small" title="添加IoT数据绑定">
            <Form
              form={iotBindingForm}
              layout="vertical"
              onFinish={handleAddIoTBinding}
            >
              <Form.Item
                name="nodeId"
                label="目标骨骼节点"
                rules={[{ required: true, message: '请选择骨骼节点' }]}
              >
                <Select placeholder="选择要绑定的骨骼节点">
                  {allNodes.map(node => (
                    <Option key={node.id} value={node.id}>
                      {node.name}
                    </Option>
                  ))}
                </Select>
              </Form.Item>

              <Form.Item
                name="iotDataPath"
                label="IoT数据路径"
                rules={[{ required: true, message: '请输入IoT数据路径' }]}
              >
                <Input placeholder="例如: mqtt.sensor.temperature" />
              </Form.Item>

              <Form.Item
                name="bindingType"
                label="绑定类型"
                rules={[{ required: true, message: '请选择绑定类型' }]}
              >
                <Select placeholder="选择绑定类型">
                  <Option value="translation">平移 (Translation)</Option>
                  <Option value="rotation">旋转 (Rotation)</Option>
                  <Option value="scale">缩放 (Scale)</Option>
                </Select>
              </Form.Item>

              <Divider orientation="left" plain>数值映射</Divider>
              
              <Form.Item label="输入范围">
                <Input.Group compact>
                  <Form.Item name="inputMin" noStyle rules={[{ required: true }]}>
                    <InputNumber placeholder="最小值" style={{ width: '50%' }} />
                  </Form.Item>
                  <Form.Item name="inputMax" noStyle rules={[{ required: true }]}>
                    <InputNumber placeholder="最大值" style={{ width: '50%' }} />
                  </Form.Item>
                </Input.Group>
              </Form.Item>

              <Form.Item label="输出范围">
                <Input.Group compact>
                  <Form.Item name="outputMin" noStyle rules={[{ required: true }]}>
                    <InputNumber placeholder="最小值" style={{ width: '50%' }} />
                  </Form.Item>
                  <Form.Item name="outputMax" noStyle rules={[{ required: true }]}>
                    <InputNumber placeholder="最大值" style={{ width: '50%' }} />
                  </Form.Item>
                </Input.Group>
              </Form.Item>

              <Form.Item name="clamp" valuePropName="checked">
                <Switch /> <Text>限制在输出范围内</Text>
              </Form.Item>

              <Divider orientation="left" plain>插值设置</Divider>

              <Form.Item name="interpolationEnabled" valuePropName="checked">
                <Switch /> <Text>启用插值</Text>
              </Form.Item>

              <Form.Item
                name="interpolationDuration"
                label="插值时间 (毫秒)"
                dependencies={['interpolationEnabled']}
              >
                <InputNumber min={0} max={10000} placeholder="1000" />
              </Form.Item>

              <Form.Item
                name="interpolationEasing"
                label="插值曲线"
                dependencies={['interpolationEnabled']}
              >
                <Select placeholder="选择插值曲线">
                  <Option value="linear">线性</Option>
                  <Option value="ease-in">缓入</Option>
                  <Option value="ease-out">缓出</Option>
                  <Option value="ease-in-out">缓入缓出</Option>
                </Select>
              </Form.Item>

              <Form.Item>
                <Space>
                  <Button type="primary" htmlType="submit">
                    添加绑定
                  </Button>
                  <Button onClick={() => setShowAddBinding(false)}>
                    取消
                  </Button>
                </Space>
              </Form.Item>
            </Form>
          </Card>
        )}

        {/* 事件触发说明 */}
        <Card size="small" title="动画事件格式说明">
          <Typography>
            <Typography.Paragraph>
              <Text>动画系统支持以下JSON格式的事件触发：</Text>
            </Typography.Paragraph>
            <Typography.Paragraph>
              <pre style={{ 
                backgroundColor: token.colorFillAlter, 
                border: `1px solid ${token.colorBorder}`,
                padding: token.paddingSM, 
                borderRadius: token.borderRadius, 
                marginTop: token.marginXS,
                fontSize: token.fontSizeSM,
                overflow: 'auto',
                color: token.colorText,
                fontFamily: token.fontFamilyCode || 'monospace'
              }}>
{`{
  "type": "play" | "pause" | "stop" | "seek" | "node_transform",
  "modelId": "场景中GLB对象的ID",
  "clipId": "动画序列ID (可选)",
  "time": 跳转时间秒数 (可选),
  "playMode": "once" | "loop" | "pingpong" (可选),
  "nodeId": "骨骼节点ID (节点变换时必需)",
  "transform": {
    "translation": [x, y, z],
    "rotation": [x, y, z, w],
    "scale": [x, y, z]
  },
  "interpolation": {
    "enabled": true,
    "duration": 1000,
    "easing": "linear"
  },
  "timestamp": 时间戳
}`}
              </pre>
            </Typography.Paragraph>
          </Typography>
        </Card>

      </Space>
    </div>
  );
};