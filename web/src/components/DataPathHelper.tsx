import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Button,
  Modal,
  Tree,
  Input,
  Space,
  Typography,
  Alert,
  Card,
  Row,
  Col,
  Tag,
  message,
  Spin,
  Divider,
  Select,
  TreeSelect
} from 'antd';
import {
  EyeOutlined,
  AimOutlined,
  ReloadOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  InfoCircleOutlined
} from '@ant-design/icons';
import type { DataNode } from 'antd/es/tree';

// 扩展DataNode类型支持自定义data属性
interface ExtendedDataNode extends DataNode {
  data?: {
    path: string;
    value: any;
    type: string;
  };
}

import { 
  IoTProtocolType, 
  ConnectionInfo 
} from '../services/iotBindingApi';
import { mqttAPI } from '../services/mqttApi';
import { httpAPI } from '../services/httpApi';
import { getInstanceProperties } from '../services/sceneApi';
import { useMQTTConnection } from '../hooks/useMQTTConnection';

const { Text, Paragraph } = Typography;
const { Option } = Select;

interface DataPathHelperProps {
  protocol: IoTProtocolType;
  connectionId: string;
  onSourcePathSelect: (path: string) => void;
  onTargetPathSelect: (path: string) => void;
  instanceId: string;
  sceneId: string;
}

interface DataPreviewModalProps {
  visible: boolean;
  protocol: IoTProtocolType;
  connectionId: string;
  onClose: () => void;
  onPathSelect: (path: string) => void;
}

interface PropertySelectorModalProps {
  visible: boolean;
  instanceId: string;
  sceneId: string;
  onClose: () => void;
  onPathSelect: (path: string) => void;
}

// 数据预览模态框
const DataPreviewModal: React.FC<DataPreviewModalProps> = ({
  visible,
  protocol,
  connectionId,
  onClose,
  onPathSelect
}) => {
  const [loading, setLoading] = useState(false);
  const [previewData, setPreviewData] = useState<any>(null);
  const [selectedPath, setSelectedPath] = useState<string>('');
  const [expandedKeys, setExpandedKeys] = useState<string[]>([]);
  const [mqttConfig, setMqttConfig] = useState<any>(null);
  const [collectedMessages, setCollectedMessages] = useState<any>({});
  const [connectionStatus, setConnectionStatus] = useState<string>('');
  const collectedMessagesRef = useRef<any>({}); // 用于稳定存储收集到的消息
  const mqttConnectionRef = useRef<any>(null); // 用于稳定存储MQTT连接对象

  // MQTT连接hook（仅当协议为MQTT且有配置时使用）
  const mqttConnection = useMQTTConnection(
    protocol === IoTProtocolType.MQTT && mqttConfig ? {
      hostname: mqttConfig.hostname,
      port: mqttConfig.port,
      websocket_path: mqttConfig.websocket_path,
      client_id: mqttConfig.client_id,
      username: mqttConfig.username,
      password: mqttConfig.password,
      use_tls: mqttConfig.use_tls,
      topics: [], // 禁用自动订阅，我们手动控制
      default_qos: mqttConfig.default_qos || 0,
      keep_alive: mqttConfig.keep_alive || 60,
      clean_session: mqttConfig.clean_session,
      connection_timeout: mqttConfig.connection_timeout || 10,
      max_retries: 2,
      retry_delay: 3
    } : {
      hostname: '',
      port: 1883,
      topics: []
    }
  );
  
  // 将mqttConnection存储在ref中，避免useEffect的依赖问题
  mqttConnectionRef.current = mqttConnection;

  // 构建数据树结构
  const buildDataTree = (data: any, prefix = '', parentKey = '0'): ExtendedDataNode[] => {
    if (!data || typeof data !== 'object') {
      return [];
    }

    return Object.keys(data).map((key, index) => {
      const nodeKey = `${parentKey}-${index}`;
      const currentPath = prefix ? `${prefix}.${key}` : key;
      const value = data[key];
      
      let title = (
        <span>
          <strong>{key}</strong>
          {typeof value !== 'object' && (
            <span style={{ marginLeft: 8, color: '#666' }}>
              : {typeof value === 'string' ? `"${value}"` : String(value)}
            </span>
          )}
          <Tag style={{ marginLeft: 8, fontSize: '12px' }}>
            {Array.isArray(value) ? 'array' : typeof value}
          </Tag>
        </span>
      );

      const node: ExtendedDataNode = {
        key: nodeKey,
        title,
        data: { path: currentPath, value, type: typeof value }
      };

      if (typeof value === 'object' && value !== null) {
        node.children = buildDataTree(value, currentPath, nodeKey);
      }

      return node;
    });
  };

  // 获取数据预览
  const fetchDataPreview = async () => {
    setLoading(true);
    
    // 对于MQTT协议，不重置已收集的消息和连接状态
    if (protocol !== IoTProtocolType.MQTT) {
      setCollectedMessages({});
      setConnectionStatus('');
    }
    
    try {
      let data: any = null;

      if (protocol === IoTProtocolType.HTTP) {
        // 先获取HTTP配置详情
        const configResponse = await httpAPI.getHTTPById(connectionId);
        const httpConfig = configResponse.data;
        
        // 直接使用fetch API来获取数据
        const response = await fetch(httpConfig.base_url, {
          method: httpConfig.method || 'GET',
          headers: {
            'Content-Type': 'application/json',
            ...httpConfig.headers
          }
        });
        
        if (response.ok) {
          const contentType = response.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            data = await response.json();
          } else {
            data = { text: await response.text() };
          }
        } else {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
      } else if (protocol === IoTProtocolType.MQTT) {
        console.log('📡 开始获取MQTT数据预览...');
        
        // 获取配置但不设置状态，避免触发useEffect重新执行
        let configForPreview = mqttConfig;
        if (!configForPreview) {
          const configResponse = await mqttAPI.getMQTTById(connectionId);
          configForPreview = configResponse.data;
          console.log('⚙️ MQTT配置已获取:', configForPreview);
          
          // 延迟设置配置，避免在数据收集期间触发useEffect
          setTimeout(() => {
            setMqttConfig(configForPreview);
          }, 100);
        }
        
        console.log('⏳ 等待8秒收集MQTT数据...');
        console.log('📊 当前已收集消息数量:', Object.keys(collectedMessages).length);
        
        // 保存当前的collectedMessages引用，避免闭包问题
        let finalMessages = collectedMessages;
        
        // 等待一段时间让MQTT连接建立并收集消息
        await new Promise<void>((resolve) => {
          // 每秒检查一次收集到的消息
          let checkCount = 0;
          const checkInterval = setInterval(() => {
            checkCount++;
            console.log(`⏱️ 第${checkCount}秒检查: 状态中${Object.keys(collectedMessages).length}条消息，ref中${Object.keys(collectedMessagesRef.current).length}条消息`);
            
            if (checkCount >= 8) {
              clearInterval(checkInterval);
              finalMessages = collectedMessagesRef.current;
              console.log('⏰ 等待时间结束，检查收集到的消息...');
              console.log('💾 最终收集到的消息:', finalMessages);
              resolve();
            }
          }, 1000);
        });
        
        // 使用ref中的数据而不是状态，避免闭包问题
        const currentMessages = collectedMessagesRef.current;
        const finalConfig = configForPreview;
        
        // 处理收集到的消息
        if (Object.keys(currentMessages).length > 0) {
          console.log('✅ 有收集到数据，生成数据结构...');
          data = {
            _config: {
              name: finalConfig.name,
              topics: finalConfig.topics,
              hostname: finalConfig.hostname,
              port: finalConfig.port,
              message: "已收集到实时数据"
            },
            ...currentMessages
          };
        } else {
          console.log('❌ 没有收集到数据，显示配置信息...');
          const connection = mqttConnectionRef.current;
          console.log('🔍 连接状态检查:', {
            isConnected: connection?.isConnected,
            isConnecting: connection?.isConnecting,
            subscribedTopics: connection?.subscribedTopics,
            totalMessages: connection?.messages.length,
            error: connection?.error
          });
          data = {
            _config: {
              name: finalConfig.name,
              topics: finalConfig.topics,
              hostname: finalConfig.hostname,
              port: finalConfig.port,
              message: "暂无实时数据，请确保MQTT broker正在运行且有数据发布到订阅主题",
              debug_info: {
                isConnected: connection?.isConnected,
                subscribedTopics: connection?.subscribedTopics,
                messageCount: connection?.messages.length,
                error: connection?.error
              }
            }
          };
        }
      } else if (protocol === IoTProtocolType.WEBSOCKET) {
        // WebSocket连接预览
        data = await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error('获取数据超时'));
          }, 10000);

          // 这里需要实现WebSocket连接
          // 暂时使用模拟数据
          setTimeout(() => {
            clearTimeout(timeout);
            resolve({
              realtime: {
                speed: 120.5,
                location: { lat: 39.9042, lng: 116.4074 },
                direction: 45
              },
              status: "connected"
            });
          }, 1500);
        });
      }

      setPreviewData(data);
      message.success('数据获取成功');
    } catch (error) {
      console.error('获取数据预览失败:', error);
      message.error('获取数据预览失败');
    } finally {
      setLoading(false);
    }
  };

  // 树节点选择
  const handleTreeSelect = (selectedKeys: React.Key[], info: any) => {
    if (selectedKeys.length > 0) {
      const nodeData = info.node.data;
      if (nodeData) {
        // 允许选择基本类型、数组，但不允许选择普通对象
        if (typeof nodeData.value !== 'object' || Array.isArray(nodeData.value)) {
          setSelectedPath(nodeData.path);
        }
      }
    }
  };

  // 树节点展开
  const handleTreeExpand = (expandedKeys: React.Key[]) => {
    setExpandedKeys(expandedKeys.map(key => String(key)));
  };

  // 确认选择路径
  const handleConfirmPath = () => {
    if (selectedPath) {
      onPathSelect(selectedPath);
      handleClose();
      message.success(`已选择路径: ${selectedPath}`);
    } else {
      message.warning('请选择一个数据路径');
    }
  };

  // 关闭模态框时清理连接
  const handleClose = () => {
    if (protocol === IoTProtocolType.MQTT) {
      setConnectionStatus('');
      setCollectedMessages({});
      collectedMessagesRef.current = {}; // 重置ref
    }
    onClose();
  };

  // 使用useCallback创建稳定的消息处理函数
  const handleMQTTMessages = useCallback(() => {
    const connection = mqttConnectionRef.current;
    if (!connection || protocol !== IoTProtocolType.MQTT) return;
    
    // 更新连接状态
    if (connection.isConnecting) {
      console.log('🔄 MQTT连接中...');
      setConnectionStatus('正在连接MQTT服务器...');
    } else if (connection.isConnected) {
      console.log('✅ MQTT已连接');
      console.log('📋 已订阅主题:', connection.subscribedTopics);
      console.log('📊 连接统计:', {
        isConnected: connection.isConnected,
        subscribedTopics: connection.subscribedTopics.length,
        totalMessages: connection.messages.length
      });
      
      // 根据订阅状态更新连接状态显示
      if (connection.subscribedTopics.length > 0) {
        setConnectionStatus(`已连接并订阅 ${connection.subscribedTopics.length} 个主题，正在等待数据...`);
      } else {
        setConnectionStatus('已连接，但未订阅任何主题');
      }
    } else if (connection.error) {
      console.error('❌ MQTT连接错误:', connection.error);
      setConnectionStatus(`连接错误: ${connection.error}`);
    }
    
    // 处理收到的消息
    if (connection.messages.length > 0) {
      console.log('📨 收到消息总数:', connection.messages.length);
      const newMessages: any = {};
      connection.messages.forEach((msg: any, index: number) => {
        console.log(`📨 消息 ${index + 1}:`, {
          topic: msg.topic,
          direction: msg.direction,
          payload: msg.payload,
          timestamp: msg.timestamp
        });
        
        if (msg.direction === 'received' && msg.topic !== 'system') {
          try {
            // 尝试解析JSON
            const parsedPayload = JSON.parse(msg.payload);
            newMessages[msg.topic] = parsedPayload;
            console.log('✅ JSON解析成功:', msg.topic, parsedPayload);
          } catch (error) {
            // 如果不是JSON，直接使用原始数据
            newMessages[msg.topic] = msg.payload;
            console.log('📝 使用原始数据:', msg.topic, msg.payload);
          }
        }
      });
      
      if (Object.keys(newMessages).length > 0) {
        console.log('💾 保存收集到的消息:', newMessages);
        // 使用ref存储消息，避免状态丢失
        collectedMessagesRef.current = { ...collectedMessagesRef.current, ...newMessages };
        setCollectedMessages(collectedMessagesRef.current);
      }
    }
  }, [protocol]);

  // 监听MQTT连接状态和消息
  useEffect(() => {
    if (protocol === IoTProtocolType.MQTT && mqttConfig) {
      handleMQTTMessages();
    }
  }, [protocol, mqttConfig, handleMQTTMessages, mqttConnection.isConnected, mqttConnection.isConnecting, mqttConnection.messages.length]);

  // 管理MQTT连接状态 - 减少依赖项，避免重复连接
  useEffect(() => {
    if (protocol === IoTProtocolType.MQTT && mqttConfig && visible) {
      const connection = mqttConnectionRef.current;
      console.log('🔧 MQTT配置:', {
        hostname: mqttConfig.hostname,
        port: mqttConfig.port,
        topics: mqttConfig.topics,
        websocket_path: mqttConfig.websocket_path,
        visible: visible
      });
      
      // 避免重复连接
      if (connection && !connection.isConnected && !connection.isConnecting) {
        console.log('🚀 开始MQTT连接...');
        connection.connect();
      }
    }
  }, [protocol, mqttConfig?.hostname, mqttConfig?.port, visible]);

  // 监听连接状态变化，连接成功后订阅主题 - 使用独立的useEffect
  useEffect(() => {
    if (protocol === IoTProtocolType.MQTT && mqttConfig && visible) {
      const connection = mqttConnectionRef.current;
      if (connection && connection.isConnected) {
        console.log('✅ MQTT连接已建立，开始订阅主题...');
        console.log('📋 准备订阅的主题:', mqttConfig.topics);
        console.log('🔍 当前已订阅主题:', connection.subscribedTopics);
        
        if (mqttConfig.topics && mqttConfig.topics.length > 0) {
          // 只有当主题未订阅时才订阅
          const unsubscribedTopics = mqttConfig.topics.filter((topic: string) => 
            !connection.subscribedTopics.includes(topic)
          );
          
          if (unsubscribedTopics.length > 0) {
            console.log('📝 订阅新主题:', unsubscribedTopics);
            // 清除之前的消息
            connection.clearMessages();
            
            // 订阅新的主题
            unsubscribedTopics.forEach((topic: string) => {
              console.log(`📝 订阅主题: ${topic}`);
              connection.subscribe(topic, mqttConfig.default_qos || 0);
            });
          } else {
            console.log('🔄 所有主题已订阅');
          }
        } else {
          console.log('⚠️ 没有配置要订阅的主题');
        }
      }
    }
  }, [protocol, mqttConfig?.topics, mqttConnection.isConnected, visible]);

  // 清理：模态框关闭时断开MQTT连接
  useEffect(() => {
    if (protocol === IoTProtocolType.MQTT && !visible) {
      const connection = mqttConnectionRef.current;
      if (connection && connection.isConnected) {
        console.log('🔌 模态框关闭，断开MQTT连接...');
        connection.disconnect();
      }
    }
  }, [protocol, visible]);

  // 清理：仅在组件卸载时断开MQTT连接
  useEffect(() => {
    return () => {
      const connection = mqttConnectionRef.current;
      if (protocol === IoTProtocolType.MQTT && connection && connection.isConnected) {
        connection.disconnect();
      }
    };
  }, [protocol]);

  useEffect(() => {
    if (visible) {
      setPreviewData(null);
      setSelectedPath('');
      setExpandedKeys([]);
      // 不要重置collectedMessages和connectionStatus，让它们保持当前状态
      fetchDataPreview();
    }
  }, [visible]);

  return (
    <Modal
      title={
        <Space>
          <EyeOutlined />
          数据预览 - {protocol.toUpperCase()}
        </Space>
      }
      open={visible}
      onCancel={handleClose}
      footer={[
        <Button key="refresh" icon={<ReloadOutlined />} onClick={fetchDataPreview} loading={loading}>
          重新获取
        </Button>,
        protocol === IoTProtocolType.MQTT && mqttConnection && (
          <Button 
            key="disconnect" 
            danger 
            onClick={() => {
              const connection = mqttConnectionRef.current;
              if (connection) {
                connection.disconnect();
                setConnectionStatus('连接已断开');
              }
            }}
            disabled={!mqttConnection.isConnected}
          >
            断开连接
          </Button>
        ),
        <Button key="cancel" onClick={handleClose}>
          取消
        </Button>,
        <Button key="confirm" type="primary" onClick={handleConfirmPath} disabled={!selectedPath}>
          选择此路径
        </Button>
      ].filter(Boolean)}
      width={700}
      destroyOnClose
    >
      <Row gutter={16}>
        <Col span={14}>
          <Card 
            title="数据结构" 
            size="small"
            extra={
              loading && <Spin size="small" />
            }
          >
            {/* MQTT连接状态显示 */}
            {protocol === IoTProtocolType.MQTT && connectionStatus && (
              <Alert
                type={
                  connectionStatus.includes('错误') ? 'error' : 
                  connectionStatus.includes('已连接') ? 'success' : 'info'
                }
                message={connectionStatus}
                style={{ marginBottom: 16 }}
                showIcon
              />
            )}
            
            {previewData ? (
              <Tree
                treeData={buildDataTree(previewData)}
                onSelect={handleTreeSelect}
                expandedKeys={expandedKeys}
                onExpand={handleTreeExpand}
                defaultExpandAll
                height={400}
                style={{ overflow: 'auto' }}
              />
            ) : (
              <div style={{ textAlign: 'center', padding: '40px 0' }}>
                {loading ? (
                  <Space direction="vertical" align="center">
                    <Spin size="large" />
                    <Text>正在获取数据...</Text>
                    {protocol === IoTProtocolType.MQTT && connectionStatus && (
                      <Text type="secondary">{connectionStatus}</Text>
                    )}
                  </Space>
                ) : '暂无数据'}
              </div>
            )}
          </Card>
        </Col>
        <Col span={10}>
          <Card title="路径选择" size="small">
            <Space direction="vertical" style={{ width: '100%' }}>
              <div>
                <Text strong>选中的路径:</Text>
                <Input 
                  value={selectedPath} 
                  onChange={(e) => setSelectedPath(e.target.value)}
                  placeholder="点击左侧数据节点选择路径"
                  style={{ marginTop: 8 }}
                />
              </div>
              
              {selectedPath && (
                <Alert
                  type="success"
                  showIcon
                  message="路径有效"
                  description={`数据路径: ${selectedPath}`}
                />
              )}

              {/* MQTT消息统计 */}
              {protocol === IoTProtocolType.MQTT && (
                <Alert
                  type="info"
                  showIcon
                  message="MQTT调试信息"
                  description={
                    <div>
                      <Text><strong>连接状态:</strong> {mqttConnection.isConnected ? '✅ 已连接' : mqttConnection.isConnecting ? '🔄 连接中' : '❌ 未连接'}</Text>
                      <br />
                      <Text><strong>已收集消息:</strong> {Object.keys(collectedMessages).length} 条</Text>
                      <br />
                      <Text><strong>总消息数:</strong> {mqttConnection.messages.length} 条</Text>
                      {mqttConnection.subscribedTopics.length > 0 ? (
                        <>
                          <br />
                          <Text><strong>已订阅主题:</strong> {mqttConnection.subscribedTopics.join(', ')}</Text>
                        </>
                      ) : (
                        <>
                          <br />
                          <Text style={{ color: '#ff6b35' }}><strong>⚠️ 未订阅任何主题</strong></Text>
                        </>
                      )}
                      {mqttConnection.error && (
                        <>
                          <br />
                          <Text style={{ color: '#f5222d' }}><strong>错误:</strong> {mqttConnection.error}</Text>
                        </>
                      )}
                      {mqttConfig && (
                        <>
                          <br />
                          <Text><strong>配置的主题:</strong> {mqttConfig.topics?.join(', ') || '无'}</Text>
                        </>
                      )}
                    </div>
                  }
                  style={{ marginBottom: 16 }}
                />
              )}

              <Divider />
              
              <div>
                <Text type="secondary" style={{ fontSize: '12px' }}>
                  <InfoCircleOutlined style={{ marginRight: 4 }} />
                  点击左侧树形结构中的叶子节点来选择数据路径，或手动输入路径。
                  {protocol === IoTProtocolType.MQTT && (
                    <> 对于MQTT数据，系统会自动连接并订阅配置的主题来收集实时数据。</>
                  )}
                </Text>
              </div>
            </Space>
          </Card>
        </Col>
      </Row>
    </Modal>
  );
};

// 属性选择器模态框
const PropertySelectorModal: React.FC<PropertySelectorModalProps> = ({
  visible,
  instanceId,
  sceneId,
  onClose,
  onPathSelect
}) => {
  const [loading, setLoading] = useState(false);
  const [instanceProperties, setInstanceProperties] = useState<any>(null);
  const [selectedPath, setSelectedPath] = useState<string>('');
  const [expandedKeys, setExpandedKeys] = useState<string[]>([]);

  // 构建属性树结构
  const buildPropertyTree = (data: any, prefix = '', parentKey = '0'): ExtendedDataNode[] => {
    if (!data || typeof data !== 'object') {
      return [];
    }

    return Object.keys(data).map((key, index) => {
      const nodeKey = `${parentKey}-${index}`;
      const currentPath = prefix ? `${prefix}.${key}` : key;
      const value = data[key];
      
      let title = (
        <span>
          <strong>{key}</strong>
          {typeof value !== 'object' && (
            <span style={{ marginLeft: 8, color: '#666' }}>
              : {typeof value === 'string' ? `"${value}"` : String(value)}
            </span>
          )}
          <Tag style={{ marginLeft: 8, fontSize: '12px' }}>
            {Array.isArray(value) ? 'array' : typeof value}
          </Tag>
        </span>
      );

      const node: ExtendedDataNode = {
        key: nodeKey,
        title,
        data: { path: currentPath, value, type: typeof value }
      };

      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        node.children = buildPropertyTree(value, currentPath, nodeKey);
      }

      return node;
    });
  };

  // 获取实例属性
  const fetchInstanceProperties = async () => {
    setLoading(true);
    try {
      const response = await getInstanceProperties(instanceId);
      setInstanceProperties(response.data.data);
      message.success('属性获取成功');
    } catch (error) {
      console.error('获取实例属性失败:', error);
      message.error('获取实例属性失败');
    } finally {
      setLoading(false);
    }
  };

  // 树节点选择
  const handleTreeSelect = (selectedKeys: React.Key[], info: any) => {
    if (selectedKeys.length > 0) {
      const nodeData = info.node.data;
      if (nodeData) {
        setSelectedPath(nodeData.path);
      }
    }
  };

  // 树节点展开
  const handleTreeExpand = (expandedKeys: React.Key[]) => {
    setExpandedKeys(expandedKeys.map(key => String(key)));
  };

  // 确认选择路径
  const handleConfirmPath = () => {
    if (selectedPath) {
      onPathSelect(selectedPath);
      onClose();
      message.success(`已选择属性: ${selectedPath}`);
    } else {
      message.warning('请选择一个属性路径');
    }
  };

  useEffect(() => {
    if (visible) {
      setInstanceProperties(null);
      setSelectedPath('');
      setExpandedKeys([]);
      fetchInstanceProperties();
    }
  }, [visible]);

  return (
    <Modal
      title={
        <Space>
          <AimOutlined />
          选择目标属性
        </Space>
      }
      open={visible}
      onCancel={onClose}
      footer={[
        <Button key="refresh" icon={<ReloadOutlined />} onClick={fetchInstanceProperties} loading={loading}>
          刷新属性
        </Button>,
        <Button key="cancel" onClick={onClose}>
          取消
        </Button>,
        <Button key="confirm" type="primary" onClick={handleConfirmPath} disabled={!selectedPath}>
          选择此属性
        </Button>
      ]}
      width={700}
      destroyOnClose
    >
      <Row gutter={16}>
        <Col span={14}>
          <Card 
            title="实例属性" 
            size="small"
            extra={
              loading && <Spin size="small" />
            }
          >
            {instanceProperties ? (
              <Tree
                treeData={buildPropertyTree(instanceProperties)}
                onSelect={handleTreeSelect}
                expandedKeys={expandedKeys}
                onExpand={handleTreeExpand}
                defaultExpandAll
                height={400}
                style={{ overflow: 'auto' }}
              />
            ) : (
              <div style={{ textAlign: 'center', padding: '40px 0' }}>
                {loading ? '正在加载属性...' : '暂无属性数据'}
              </div>
            )}
          </Card>
        </Col>
        <Col span={10}>
          <Card title="属性选择" size="small">
            <Space direction="vertical" style={{ width: '100%' }}>
              <div>
                <Text strong>选中的属性:</Text>
                <Input 
                  value={selectedPath} 
                  onChange={(e) => setSelectedPath(e.target.value)}
                  placeholder="点击左侧属性节点选择路径"
                  style={{ marginTop: 8 }}
                />
              </div>
              
              {selectedPath && (
                <Alert
                  type="success"
                  showIcon
                  message="属性路径有效"
                  description={`目标属性: ${selectedPath}`}
                />
              )}

              <Divider />
              
              <div>
                <Text type="secondary" style={{ fontSize: '12px' }}>
                  <InfoCircleOutlined style={{ marginRight: 4 }} />
                  选择实例的属性作为IoT数据的目标路径。支持嵌套属性访问。
                </Text>
              </div>
            </Space>
          </Card>
        </Col>
      </Row>
    </Modal>
  );
};

// 主要的数据路径辅助组件
const DataPathHelper: React.FC<DataPathHelperProps> = ({
  protocol,
  connectionId,
  onSourcePathSelect,
  onTargetPathSelect,
  instanceId,
  sceneId
}) => {
  const [dataPreviewVisible, setDataPreviewVisible] = useState(false);
  const [propertySelectorVisible, setPropertySelectorVisible] = useState(false);

  return (
    <>
      <Space>
        <Button
          icon={<EyeOutlined />}
          onClick={() => setDataPreviewVisible(true)}
          disabled={!connectionId}
        >
          预览数据
        </Button>
        <Button
          icon={<AimOutlined />}
          onClick={() => setPropertySelectorVisible(true)}
        >
          选择属性
        </Button>
      </Space>

      <DataPreviewModal
        visible={dataPreviewVisible}
        protocol={protocol}
        connectionId={connectionId}
        onClose={() => setDataPreviewVisible(false)}
        onPathSelect={onSourcePathSelect}
      />

      <PropertySelectorModal
        visible={propertySelectorVisible}
        instanceId={instanceId}
        sceneId={sceneId}
        onClose={() => setPropertySelectorVisible(false)}
        onPathSelect={onTargetPathSelect}
      />
    </>
  );
};

export default DataPathHelper;
export { DataPreviewModal }; 