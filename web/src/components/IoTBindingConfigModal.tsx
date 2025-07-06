import React, { useState, useEffect } from 'react';
import {
  Modal,
  Form,
  Steps,
  Card,
  Space,
  Button,
  Select,
  Input,
  Switch,
  InputNumber,
  Row,
  Col,
  Typography,
  Alert,
  Tabs,
  Tag,
  message,
  Collapse,
  Divider,
  Spin,
  theme
} from 'antd';
import {
  PlusOutlined,
  DeleteOutlined,
  SettingOutlined,
  ExperimentOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  InfoCircleOutlined,
  CloudOutlined
} from '@ant-design/icons';

import {
  iotBindingAPI,
  IoTBinding,
  IoTBindingCreate,
  IoTProtocolType,
  IoTDataType,
  BindingDirection,
  InterpolationType,
  TriggerType,
  ConnectionInfo,
  ValidationResult
} from '../services/iotBindingApi';
import { mqttAPI } from '../services/mqttApi';
import { httpAPI } from '../services/httpApi';
import { websocketAPI } from '../services/websocketApi';
import DataPathHelper, { DataPreviewModal } from './DataPathHelper';

const { Option } = Select;
const { TextArea } = Input;
const { Text } = Typography;
const { Panel } = Collapse;

interface IoTBindingConfigModalProps {
  visible: boolean;
  instanceId: string;
  sceneId: string;
  editingBinding?: IoTBinding | null;
  onClose: () => void;
  onSave: (binding: IoTBinding) => void;
}

const IoTBindingConfigModal: React.FC<IoTBindingConfigModalProps> = ({
  visible,
  instanceId,
  sceneId,
  editingBinding,
  onClose,
  onSave
}) => {
  const [form] = Form.useForm();
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [testLoading, setTestLoading] = useState(false);
  const [selectedProtocol, setSelectedProtocol] = useState<IoTProtocolType | null>(null);
  const [selectedConnection, setSelectedConnection] = useState<ConnectionInfo | null>(null);
  const [connections, setConnections] = useState<ConnectionInfo[]>([]);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [showDataPreview, setShowDataPreview] = useState(false);
  const [frontendValidationResult, setFrontendValidationResult] = useState<any>(null);
  const [frontendValidationLoading, setFrontendValidationLoading] = useState(false);

  const initFormData = {
    enabled: true,
    bindings: [], // 初始为空，用户需要手动添加
    valueMapping: {
      inputMin: 0,
      inputMax: 100,
      outputMin: 0,
      outputMax: 1,
      clamp: true
    },
    interpolation: {
      type: InterpolationType.LINEAR,
      duration: 1.0
    }
  };

  // 验证绑定数据结构
  const validateBindings = (bindings: any[], strict: boolean = false): any[] => {
    return bindings.map(binding => {
      // 确保每个绑定都是对象
      if (!binding || typeof binding !== 'object') {
        console.warn('🚨 跳过无效绑定项:', binding);
        return null;
      }
      
      // 确保direction字段存在且有效
      if (binding.direction === undefined || binding.direction === null) {
        console.warn('🔧 为绑定项添加默认direction:', binding);
        binding.direction = BindingDirection.IOT_TO_INSTANCE;
      }
      
      // 严格模式下验证必需字段
      if (strict) {
        if (!binding.source || !binding.target) {
          console.warn('🚨 严格模式：跳过缺少source或target的绑定项:', binding);
          return null;
        }
      }
      
      console.log('✅ 绑定项处理完成:', binding);
      return binding;
    }).filter(Boolean); // 过滤掉null值
  };

  // 前端验证绑定兼容性
  const handleFrontendValidation = async () => {
    try {
      setFrontendValidationLoading(true);
      const values = await form.validateFields();
      const bindings = values.bindings || [];
      
      if (bindings.length === 0) {
        message.warning('请先添加绑定映射');
        return;
      }

      console.log('🔍 开始前端验证绑定兼容性...');
      
      const validationResults = [];

      for (let i = 0; i < bindings.length; i++) {
        const binding = bindings[i];
        if (!binding.source || !binding.target) {
          validationResults.push({
            index: i,
            status: 'error',
            message: '源路径或目标路径缺失',
            source: binding.source,
            target: binding.target
          });
          continue;
        }

        // 获取源数据类型和结构
        const sourceInfo = await getSourceDataInfo(binding.source);
        
        // 获取目标属性类型和结构
        const targetInfo = await getTargetPropertyInfo(binding.target);
        
        // 比较数据兼容性
        const compatibility = compareDataCompatibility(sourceInfo, targetInfo);
        
        validationResults.push({
          index: i,
          source: binding.source,
          target: binding.target,
          sourceInfo,
          targetInfo,
          compatibility,
          status: compatibility.compatible ? 'success' : 'warning',
          message: compatibility.message,
          suggestions: compatibility.suggestions
        });
      }

      setFrontendValidationResult({
        timestamp: new Date().toISOString(),
        results: validationResults,
        summary: {
          total: validationResults.length,
          compatible: validationResults.filter(r => r.status === 'success').length,
          warnings: validationResults.filter(r => r.status === 'warning').length,
          errors: validationResults.filter(r => r.status === 'error').length
        }
      });

      const compatibleCount = validationResults.filter(r => r.status === 'success').length;
      const totalCount = validationResults.length;
      
      if (compatibleCount === totalCount) {
        message.success(`所有 ${totalCount} 个绑定映射验证通过！`);
      } else {
        message.warning(`${compatibleCount}/${totalCount} 个绑定映射兼容，请检查警告项`);
      }

    } catch (error) {
      console.error('前端验证失败:', error);
      message.error('前端验证失败，请检查绑定配置');
    } finally {
      setFrontendValidationLoading(false);
    }
  };

  // 获取源数据信息
  const getSourceDataInfo = async (sourcePath: string) => {
    try {
      // 模拟获取源数据（实际应该从数据预览中获取）
      if (!selectedProtocol || !selectedConnection) {
        return { type: 'unknown', structure: null, sample: null };
      }

      // 这里可以扩展为实际的数据获取逻辑
      // 目前返回模拟数据
      const mockSourceData = {
        'sensor.temperature': { type: 'number', value: 25.6, range: [0, 100] },
        'sensor.humidity': { type: 'number', value: 60.2, range: [0, 100] },
        'sensor.location': { type: 'array', value: [120.123, 30.456], length: 2, elementType: 'number' },
        'device.status': { type: 'string', value: 'active', enum: ['active', 'inactive', 'error'] },
        'device.online': { type: 'boolean', value: true },
        'data.readings': { type: 'array', value: [1, 2, 3, 4, 5], length: 5, elementType: 'number' }
      };

      return (mockSourceData as Record<string, any>)[sourcePath] || { 
        type: 'unknown', 
        structure: null, 
        sample: null,
        message: '未找到源数据信息，建议先预览数据'
      };
    } catch (error) {
      console.error('获取源数据信息失败:', error);
      return { type: 'error', message: '获取源数据失败' };
    }
  };

  // 获取目标属性信息
  const getTargetPropertyInfo = async (targetPath: string) => {
    try {
      // 模拟获取目标属性（实际应该从实例属性API获取）
      const mockTargetProperties = {
        'position.x': { type: 'number', range: [-1000, 1000] },
        'position.y': { type: 'number', range: [-1000, 1000] },
        'position.z': { type: 'number', range: [-1000, 1000] },
        'rotation.x': { type: 'number', range: [0, 360] },
        'rotation.y': { type: 'number', range: [0, 360] },
        'rotation.z': { type: 'number', range: [0, 360] },
        'scale': { type: 'number', range: [0.1, 10] },
        'visible': { type: 'boolean' },
        'color': { type: 'array', length: 3, elementType: 'number', range: [0, 1] },
        'transform': { type: 'array', length: 16, elementType: 'number' }
      };

      return (mockTargetProperties as Record<string, any>)[targetPath] || { 
        type: 'unknown', 
        message: '未找到目标属性信息'
      };
    } catch (error) {
      console.error('获取目标属性信息失败:', error);
      return { type: 'error', message: '获取目标属性失败' };
    }
  };

  // 比较数据兼容性
  const compareDataCompatibility = (sourceInfo: any, targetInfo: any) => {
    const result = {
      compatible: false,
      message: '',
      suggestions: [] as string[]
    };

    // 处理错误情况
    if (sourceInfo.type === 'error' || targetInfo.type === 'error') {
      result.message = '数据获取失败，无法验证兼容性';
      result.suggestions.push('请检查数据源和目标属性配置');
      return result;
    }

    // 处理未知类型
    if (sourceInfo.type === 'unknown' || targetInfo.type === 'unknown') {
      result.message = '数据类型未知，建议手动验证';
      result.suggestions.push('尝试预览源数据以获取实际数据类型');
      result.suggestions.push('确认目标属性的数据类型要求');
      return result;
    }

    // 类型兼容性检查
    if (sourceInfo.type === targetInfo.type) {
      if (sourceInfo.type === 'array') {
        // 数组类型检查
        if (sourceInfo.length && targetInfo.length) {
          if (sourceInfo.length === targetInfo.length) {
            result.compatible = true;
            result.message = `数组类型兼容：长度匹配 (${sourceInfo.length})`;
          } else {
            result.message = `数组长度不匹配：源(${sourceInfo.length}) vs 目标(${targetInfo.length})`;
            result.suggestions.push('考虑使用数组切片或填充来匹配长度');
            result.suggestions.push('或者使用数值映射来转换数组长度');
          }
        } else {
          result.compatible = true;
          result.message = '数组类型兼容（长度未知）';
          result.suggestions.push('建议确认数组长度要求');
        }

        // 检查数组元素类型
        if (sourceInfo.elementType && targetInfo.elementType) {
          if (sourceInfo.elementType !== targetInfo.elementType) {
            result.compatible = false;
            result.message += `，但元素类型不匹配：${sourceInfo.elementType} vs ${targetInfo.elementType}`;
          }
        }
      } else {
        result.compatible = true;
        result.message = `数据类型兼容：${sourceInfo.type}`;
      }
    } else {
      // 类型转换可能性检查
      const conversionPossible = checkTypeConversion(sourceInfo.type, targetInfo.type);
      if (conversionPossible.possible) {
        result.message = `类型不匹配但可转换：${sourceInfo.type} → ${targetInfo.type}`;
        result.suggestions.push(...conversionPossible.suggestions);
      } else {
        result.message = `类型不兼容：${sourceInfo.type} → ${targetInfo.type}`;
        result.suggestions.push('考虑使用数据转换脚本');
        result.suggestions.push('或者重新选择兼容的数据路径');
      }
    }

    // 数值范围检查
    if (sourceInfo.type === 'number' && targetInfo.type === 'number') {
      if (sourceInfo.range && targetInfo.range) {
        const sourceRange = sourceInfo.range;
        const targetRange = targetInfo.range;
        
        if (sourceRange[0] < targetRange[0] || sourceRange[1] > targetRange[1]) {
          result.suggestions.push(`建议配置数值映射：源范围[${sourceRange[0]}, ${sourceRange[1]}] → 目标范围[${targetRange[0]}, ${targetRange[1]}]`);
        }
      }
    }

    return result;
  };

  // 检查类型转换可能性
  const checkTypeConversion = (sourceType: string, targetType: string) => {
    const conversions: Record<string, Record<string, { possible: boolean, suggestions: string[] }>> = {
      'string': {
        'number': { possible: true, suggestions: ['使用 parseFloat() 或 parseInt() 转换'] },
        'boolean': { possible: true, suggestions: ['使用字符串比较转换，如 value === "true"'] },
        'array': { possible: false, suggestions: [] }
      },
      'number': {
        'string': { possible: true, suggestions: ['使用 toString() 转换'] },
        'boolean': { possible: true, suggestions: ['使用数值比较转换，如 value > 0'] },
        'array': { possible: true, suggestions: ['转换为单元素数组 [value]'] }
      },
      'boolean': {
        'string': { possible: true, suggestions: ['使用 toString() 或三元表达式转换'] },
        'number': { possible: true, suggestions: ['使用 value ? 1 : 0 转换'] },
        'array': { possible: true, suggestions: ['转换为单元素数组 [value]'] }
      },
      'array': {
        'string': { possible: true, suggestions: ['使用 JSON.stringify() 或 join() 转换'] },
        'number': { possible: true, suggestions: ['使用数组长度、求和或平均值转换'] },
        'boolean': { possible: true, suggestions: ['使用数组长度或内容检查转换'] }
      }
    };

    return conversions[sourceType]?.[targetType] || { possible: false, suggestions: [] };
  };

  // 步骤配置
  const steps = [
    {
      title: '选择数据源',
      description: '选择IoT协议和连接配置'
    },
    {
      title: '配置绑定',
      description: '设置数据路径映射关系'
    },
    {
      title: '高级选项',
      description: '配置数值映射、插值等选项'
    },
    {
      title: '验证测试',
      description: '验证配置并测试绑定效果'
    }
  ];

  // 转换数据格式为统一的ConnectionInfo格式
  const convertToConnectionInfo = (data: any, protocol: IoTProtocolType): ConnectionInfo => {
    return {
      id: data.id || data._id,
      protocol: protocol,
      name: data.name,
      description: data.description,
      hostname: data.hostname,
      port: data.port,
      url: data.url,
      base_url: data.base_url,
      is_public: data.is_public || false,
      tags: data.tags || [],
      created_at: data.created_at,
      updated_at: data.updated_at
    };
  };

  // 获取连接配置列表
  const fetchConnections = async (protocol?: IoTProtocolType) => {
    if (!protocol) {
      setConnections([]);
      return;
    }

    try {
      setLoading(true);
      console.log('正在获取连接配置, 协议:', protocol);
      
      let response;
      switch (protocol) {
        case IoTProtocolType.MQTT:
          response = await mqttAPI.getMQTTList(0, 50);
          break;
        case IoTProtocolType.HTTP:
          response = await httpAPI.getHTTPList(0, 50);
          break;
        case IoTProtocolType.WEBSOCKET:
          response = await websocketAPI.getWebSocketList(0, 50);
          break;
        default:
          throw new Error(`不支持的协议类型: ${protocol}`);
      }
      
      // 转换为统一格式
      const connectionInfos = response.data.map((item: any) => 
        convertToConnectionInfo(item, protocol)
      );
      
      console.log('获取到的连接配置:', connectionInfos);
      setConnections(connectionInfos);
    } catch (error) {
      console.error('获取连接配置失败:', error);
      message.error(`获取${protocol.toUpperCase()}连接配置失败`);
      setConnections([]);
    } finally {
      setLoading(false);
    }
  };

  // 初始化
  useEffect(() => {
    if (visible) {
      console.log('🔄 模态框初始化, 编辑模式:', !!editingBinding);
      
      if (editingBinding) {
        // 编辑模式
        console.log('📝 编辑模式，设置表单值:', editingBinding);
        form.setFieldsValue(editingBinding);
        setSelectedProtocol(editingBinding.protocol);
        setCurrentStep(0);
      } else {
        // 新增模式
        console.log('➕ 新增模式，设置初始值:', initFormData);
        form.setFieldsValue(initFormData);
        setCurrentStep(0);
        setSelectedProtocol(null);
        setSelectedConnection(null);
        setConnections([]);
      }
      
      // 验证表单初始化是否成功
      setTimeout(() => {
        const currentValues = form.getFieldsValue();
        console.log('🔍 表单初始化后的值:', currentValues);
      }, 100);
      
      setValidationResult(null);
      setFrontendValidationResult(null); // 清理前端验证结果
    }
  }, [visible, editingBinding, form]);

  // 协议变化时更新连接列表
  useEffect(() => {
    if (selectedProtocol) {
      console.log('协议选择改变，加载对应数据源:', selectedProtocol);
      fetchConnections(selectedProtocol);
    } else {
      setConnections([]);
    }
  }, [selectedProtocol]);

  // 处理协议选择
  const handleProtocolChange = (protocol: IoTProtocolType) => {
    setSelectedProtocol(protocol);
    setSelectedConnection(null);
    form.setFieldsValue({ sourceId: undefined });
  };

  // 处理连接选择
  const handleConnectionChange = (connectionId: string) => {
    const connection = connections.find(c => c.id === connectionId);
    setSelectedConnection(connection || null);
  };

  // 处理源路径选择
  const handleSourcePathSelect = (path: string, bindingIndex: number) => {
    // 只使用 setFieldValue 来更新特定字段，避免循环引用
    form.setFieldValue(['bindings', bindingIndex, 'source'], path);
    
    // 调试：验证字段确实被更新了
    setTimeout(() => {
      const currentValue = form.getFieldValue(['bindings', bindingIndex, 'source']);
      console.log('🔍 验证字段值:', { path, bindingIndex, currentValue });
    }, 100);
    
    console.log('✅ 源路径已更新:', { path, bindingIndex });
    message.success(`已设置源路径: ${path}`);
  };

  // 处理目标路径选择
  const handleTargetPathSelect = (path: string, bindingIndex: number) => {
    // 只使用 setFieldValue 来更新特定字段，避免循环引用
    form.setFieldValue(['bindings', bindingIndex, 'target'], path);
    
    console.log('✅ 目标路径已更新:', { path, bindingIndex });
    message.success(`已设置目标路径: ${path}`);
  };

  // 下一步
  const handleNext = async () => {
    try {
      // 根据当前步骤验证特定字段
      const fieldsToValidate = getCurrentStepFields();
      console.log('🔍 当前步骤需要验证的字段:', fieldsToValidate);
      
      if (fieldsToValidate.length > 0) {
        await form.validateFields(fieldsToValidate);
        console.log('✅ 当前步骤验证通过');
      }
      
      // 打印当前表单值
      const currentValues = form.getFieldsValue();
      console.log('📋 当前表单值:', currentValues);
      
      if (currentStep < steps.length - 1) {
        setCurrentStep(currentStep + 1);
      }
    } catch (error) {
      console.error('表单验证失败:', error);
      message.error('请完成当前步骤的必填项');
    }
  };

  // 获取当前步骤需要验证的字段
  const getCurrentStepFields = () => {
    switch (currentStep) {
      case 0:
        return ['protocol', 'dataType', 'sourceId'];
      case 1:
        return ['bindings'];
      case 2:
        return []; // 高级选项都是可选的
      case 3:
        return []; // 验证步骤不需要额外字段
      default:
        return [];
    }
  };

  // 上一步
  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  // 验证绑定配置
  const handleValidate = async () => {
    try {
      setTestLoading(true);
      const values = await form.validateFields();
      
      // 调试：打印表单值
      console.log('📋 表单值:', values);
      
      const binding: IoTBinding = {
        id: editingBinding?.id || `binding_${Date.now()}`,
        ...values
      };

      // 调试：打印构造的绑定对象
      console.log('📦 构造的绑定对象:', binding);
      
      // 修复数据结构：确保符合后端期望
      const fixedBinding: IoTBinding = {
        id: binding.id || `binding_${Date.now()}`,
        name: binding.name || undefined,
        enabled: binding.enabled !== undefined ? binding.enabled : true,
        protocol: binding.protocol,
        dataType: binding.dataType,
        sourceId: binding.sourceId,
        bindings: validateBindings(binding.bindings || [], true),
        valueMapping: binding.valueMapping || undefined,
        interpolation: binding.interpolation || undefined,
        updateInterval: binding.updateInterval || undefined,
        transform: binding.transform || undefined
      };
      
      // 调试：打印修复后的绑定对象
      console.log('🔧 修复后的绑定对象:', fixedBinding);
      
      // 调试：打印发送的验证数据
      const validationData = { binding: fixedBinding };
      console.log('📤 发送的验证数据:', validationData);

      const response = await iotBindingAPI.validateBinding(validationData);
      setValidationResult(response.data);

      if (response.data.valid) {
        message.success('绑定配置验证通过');
      } else {
        message.warning('绑定配置存在问题，请检查错误信息');
      }
    } catch (error) {
      console.error('验证失败:', error);
      
      // 更详细的错误信息
      if (error && typeof error === 'object' && 'response' in error) {
        const axiosError = error as any;
        console.error('🔍 错误响应:', axiosError.response?.data);
        console.error('🔍 错误状态:', axiosError.response?.status);
        console.error('🔍 错误头:', axiosError.response?.headers);
      }
      
      message.error('验证绑定配置失败');
      setValidationResult({
        valid: false,
        errors: ['验证请求失败'],
        warnings: []
      });
    } finally {
      setTestLoading(false);
    }
  };

  // 测试绑定
  const handleTest = async () => {
    try {
      setTestLoading(true);
      const values = await form.validateFields();
      
      // 修复数据结构：确保符合后端期望
      const fixedBinding: IoTBinding = {
        id: editingBinding?.id || `binding_${Date.now()}`,
        name: values.name || undefined,
        enabled: values.enabled !== undefined ? values.enabled : true,
        protocol: values.protocol,
        dataType: values.dataType,
        sourceId: values.sourceId,
        bindings: validateBindings(values.bindings || [], true),
        valueMapping: values.valueMapping || undefined,
        interpolation: values.interpolation || undefined,
        updateInterval: values.updateInterval || undefined,
        transform: values.transform || undefined
      };

      const sampleData = {
        temperature: 25.6,
        humidity: 60.2,
        status: 'active'
      };

      console.log('🧪 测试绑定数据:', { binding: fixedBinding, sampleData });

      const response = await iotBindingAPI.testBinding({ binding: fixedBinding, sampleData });
      
      if (response.data.success) {
        message.success('绑定测试成功');
      } else {
        message.error(`绑定测试失败: ${response.data.error}`);
      }
    } catch (error) {
      console.error('测试失败:', error);
      
      // 更详细的错误信息
      if (error && typeof error === 'object' && 'response' in error) {
        const axiosError = error as any;
        console.error('🧪 测试错误响应:', axiosError.response?.data);
        console.error('🧪 测试错误状态:', axiosError.response?.status);
      }
      
      message.error('测试绑定失败');
    } finally {
      setTestLoading(false);
    }
  };

  // 保存绑定
  const handleSave = async () => {
    try {
      setLoading(true);
      
      // 手动构造表单数据，因为分步骤的表单无法通过 getFieldsValue() 正确获取所有字段
      const values = {
        protocol: form.getFieldValue('protocol'),
        dataType: form.getFieldValue('dataType'),
        sourceId: form.getFieldValue('sourceId'),
        bindings: form.getFieldValue('bindings') || [],
        enabled: form.getFieldValue('enabled') !== undefined ? form.getFieldValue('enabled') : true,
        name: form.getFieldValue('name'),
        valueMapping: form.getFieldValue('valueMapping'),
        interpolation: form.getFieldValue('interpolation'),
        updateInterval: form.getFieldValue('updateInterval'),
        transform: form.getFieldValue('transform')
      };
      
      console.log('💾 手动构造的表单值:', values);
      
      // 验证必填字段
      const missingFields = [];
      if (!values.protocol) missingFields.push('协议类型');
      if (!values.dataType) missingFields.push('数据类型');
      if (!values.sourceId) missingFields.push('连接配置');
      
      if (missingFields.length > 0) {
        message.error(`请完成以下必填项：${missingFields.join('、')}`);
        // 跳转到第一步
        setCurrentStep(0);
        return;
      }
      
      if (!values.bindings || values.bindings.length === 0) {
        message.error('请至少添加一个绑定映射');
        // 跳转到第二步
        setCurrentStep(1);
        return;
      }

      
      // 修复数据结构：确保符合后端期望
      const fixedBinding: IoTBinding = {
        id: editingBinding?.id || `binding_${Date.now()}`,
        name: values.name || undefined,
        enabled: values.enabled !== undefined ? values.enabled : true,
        protocol: values.protocol,
        dataType: values.dataType,
        sourceId: values.sourceId,
        bindings: validateBindings(values.bindings || [], true),
        valueMapping: values.valueMapping || undefined,
        interpolation: values.interpolation || undefined,
        updateInterval: values.updateInterval || undefined,
        transform: values.transform || undefined
      };

      console.log('💾 保存的绑定数据:', fixedBinding);

      if (editingBinding) {
        await iotBindingAPI.updateInstanceBinding(sceneId, instanceId, editingBinding.id, fixedBinding);
        message.success('IoT绑定更新成功');
      } else {
        await iotBindingAPI.createInstanceBinding(sceneId, instanceId, fixedBinding);
        message.success('IoT绑定创建成功');
      }

      // 调用父组件的保存回调，触发绑定状态刷新
      onSave(fixedBinding);
      
      // 关闭模态框
      onClose();
    } catch (error) {
      console.error('保存绑定失败:', error);
      
      // 更详细的错误信息
      if (error && typeof error === 'object' && 'response' in error) {
        const axiosError = error as any;
        console.error('💾 保存错误响应:', axiosError.response?.data);
        console.error('💾 保存错误状态:', axiosError.response?.status);
      }
      
      message.error('保存绑定失败');
    } finally {
      setLoading(false);
    }
  };

  // 渲染步骤1：选择数据源
  const renderDataSourceStep = () => (
    <Card title="选择IoT数据源" size="small">
      <Row gutter={[16, 16]}>
        <Col span={24}>
          <Form.Item
            name="protocol"
            label="协议类型"
            rules={[{ required: true, message: '请选择协议类型' }]}
          >
            <Select
              placeholder="选择IoT通信协议"
              onChange={handleProtocolChange}
              size="large"
            >
              <Option value={IoTProtocolType.MQTT}>
                <Space>
                  <CloudOutlined />
                  MQTT - 消息队列遥测传输
                </Space>
              </Option>
              <Option value={IoTProtocolType.WEBSOCKET}>
                <Space>
                  <CloudOutlined />
                  WebSocket - 实时双向通信
                </Space>
              </Option>
              <Option value={IoTProtocolType.HTTP}>
                <Space>
                  <CloudOutlined />
                  HTTP - RESTful API轮询
                </Space>
              </Option>
            </Select>
          </Form.Item>
        </Col>

        {selectedProtocol && (
          <Col span={24}>
            <Alert
              type="info"
              showIcon
              message={`选择 ${selectedProtocol.toUpperCase()} 数据源`}
              description={`从现有的 ${selectedProtocol.toUpperCase()} 连接配置中选择一个数据源`}
              style={{ marginBottom: 16 }}
            />
            <Form.Item
              name="sourceId"
              label="连接配置"
              rules={[{ required: true, message: '请选择连接配置' }]}
            >
              <Select
                placeholder={`选择现有的 ${selectedProtocol.toUpperCase()} 连接配置`}
                onChange={handleConnectionChange}
                loading={loading}
                size="large"
                showSearch
                filterOption={(input, option) =>
                  option?.children?.toString().toLowerCase().includes(input.toLowerCase()) ?? false
                }
                notFoundContent={loading ? "加载中..." : "暂无可用的连接配置"}
              >
                {connections
                  .filter(connection => connection.protocol === selectedProtocol)
                  .map(connection => (
                  <Option key={connection.id} value={connection.id}>
                    <div>
                      <div style={{ fontWeight: 'bold', display: 'flex', alignItems: 'center' }}>
                        <CloudOutlined style={{ marginRight: 8, color: '#1890ff' }} />
                        {connection.name}
                        {connection.is_public && <Tag style={{ marginLeft: 8 }}>公共</Tag>}
                      </div>
                      <div style={{ fontSize: '12px', color: '#666' }}>
                        {connection.protocol === 'mqtt' && connection.hostname && `${connection.hostname}:${connection.port}`}
                        {connection.protocol === 'websocket' && connection.url}
                        {connection.protocol === 'http' && connection.base_url}
                      </div>
                    </div>
                  </Option>
                ))}
              </Select>
            </Form.Item>
          </Col>
        )}

        <Col span={12}>
          <Form.Item
            name="dataType"
            label="数据类型"
            rules={[{ required: true, message: '请选择数据类型' }]}
          >
            <Select placeholder="选择数据类型">
              <Option value={IoTDataType.JSON}>JSON - 结构化数据</Option>
              <Option value={IoTDataType.TEXT}>Text - 文本数据</Option>
              <Option value={IoTDataType.NUMBER}>Number - 数值数据</Option>
              <Option value={IoTDataType.BOOLEAN}>Boolean - 布尔数据</Option>
              <Option value={IoTDataType.IMAGE_BASE64}>Image Base64 - 图像数据</Option>
            </Select>
          </Form.Item>
        </Col>

        <Col span={12}>
          <Form.Item name="name" label="绑定名称">
            <Input placeholder="可选的绑定名称" />
          </Form.Item>
        </Col>

        <Col span={24}>
          <Form.Item name="enabled" label="启用绑定" valuePropName="checked">
            <Switch checkedChildren="启用" unCheckedChildren="禁用" />
          </Form.Item>
        </Col>
      </Row>

      {selectedConnection && (
        <Alert
          type="info"
          showIcon
          message="选中的连接配置"
          description={
            <div>
              <Text strong>{selectedConnection.name}</Text>
              <br />
              <Text type="secondary">{selectedConnection.description}</Text>
              <br />
              {selectedConnection.tags.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  {selectedConnection.tags.map(tag => (
                    <Tag key={tag}>{tag}</Tag>
                  ))}
                </div>
              )}
            </div>
          }
        />
      )}
    </Card>
  );

  // 渲染步骤2：配置绑定
  const renderBindingConfigStep = () => (
    <Card title="绑定映射配置" size="small">
      <Alert
        type="info"
        showIcon
        message="数据路径映射"
        description="配置IoT数据路径到模型属性的映射关系。支持JSON路径访问，如：sensor.temperature、device.status等。点击预览数据按钮可以获取实际的MQTT数据（基于数据源配置的订阅主题）。"
        style={{ marginBottom: 16 }}
      />

      <Form.List name="bindings">
        {(fields, { add, remove }) => (
          <>
            {fields.map(({ key, name, ...restField }) => (
              <Card key={key} size="small" style={{ marginBottom: 8 }}>
                <Row gutter={16}>
                  <Col span={8}>
                    <Form.Item
                      {...restField}
                      name={[name, 'source']}
                      label="数据源路径"
                      rules={[{ required: true, message: '请输入数据源路径' }]}
                    >
                      <Input 
                        placeholder="如：sensor.temperature" 
                        addonAfter={
                          <Button
                            icon={<CloudOutlined />}
                            title="预览数据"
                            onClick={() => {
                              if (selectedProtocol && selectedConnection?.id) {
                                setShowDataPreview(true);
                              } else {
                                message.warning('请先选择协议和数据源');
                              }
                            }}
                            disabled={!selectedProtocol || !selectedConnection?.id}
                            type="text"
                            size="small"
                          />
                        }
                      />
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item
                      {...restField}
                      name={[name, 'target']}
                      label="目标属性"
                      rules={[{ required: true, message: '请输入目标属性' }]}
                    >
                      <Input 
                        placeholder="如：properties.temperature" 
                        addonAfter={
                          <Button
                            icon={<SettingOutlined />}
                            title="选择属性"
                            onClick={() => {
                              console.log('触发属性选择', { instanceId, sceneId });
                            }}
                            type="text"
                            size="small"
                          />
                        }
                      />
                    </Form.Item>
                  </Col>
                  <Col span={6}>
                    <Form.Item
                      {...restField}
                      name={[name, 'direction']}
                      label="方向"
                      rules={[{ required: true, message: '请选择方向' }]}
                    >
                      <Select>
                        <Option value={BindingDirection.IOT_TO_INSTANCE}>IoT → 模型</Option>
                        <Option value={BindingDirection.INSTANCE_TO_IOT}>模型 → IoT</Option>
                        <Option value={BindingDirection.BIDIRECTIONAL}>双向</Option>
                      </Select>
                    </Form.Item>
                  </Col>
                  <Col span={2}>
                    <Button
                      type="link"
                      danger
                      icon={<DeleteOutlined />}
                      onClick={() => remove(name)}
                      style={{ marginTop: 30 }}
                    />
                  </Col>
                </Row>
                
                {/* 添加高级路径选择工具 */}
                <Row>
                  <Col span={24} style={{ textAlign: 'center', marginTop: 8 }}>
                    {selectedProtocol && selectedConnection?.id && (
                      <DataPathHelper
                        protocol={selectedProtocol}
                        connectionId={selectedConnection.id}
                        instanceId={instanceId}
                        sceneId={sceneId}
                        onSourcePathSelect={(path) => {
                          console.log('🔧 DataPathHelper 源路径选择:', { path, bindingIndex: name });
                          handleSourcePathSelect(path, name);
                        }}
                        onTargetPathSelect={(path) => {
                          console.log('🔧 DataPathHelper 目标路径选择:', { path, bindingIndex: name });
                          handleTargetPathSelect(path, name);
                        }}
                      />
                    )}
                  </Col>
                </Row>
              </Card>
            ))}
            <Button
              type="dashed"
              onClick={() => add()}
              block
              icon={<PlusOutlined />}
            >
              添加绑定映射
            </Button>
          </>
        )}
      </Form.List>
      
      {/* 前端验证按钮和结果 */}
      <Divider />
      <Row gutter={16}>
        <Col span={12}>
          <Button
            type="primary"
            ghost
            icon={<CheckCircleOutlined />}
            onClick={handleFrontendValidation}
            loading={frontendValidationLoading}
            block
          >
            验证数据兼容性
          </Button>
        </Col>
        <Col span={12}>
          <Button
            icon={<InfoCircleOutlined />}
            onClick={() => {
              Modal.info({
                title: '数据兼容性验证说明',
                content: (
                  <div>
                    <p>此验证功能会检查以下兼容性：</p>
                    <ul>
                      <li><strong>数据类型匹配：</strong>检查源数据和目标属性的类型是否兼容</li>
                      <li><strong>数组长度匹配：</strong>验证数组类型的元素数量是否一致</li>
                      <li><strong>数值范围检查：</strong>确认数值范围是否需要映射</li>
                      <li><strong>类型转换建议：</strong>提供数据转换的实现建议</li>
                    </ul>
                    <Alert 
                      type="info" 
                      message="建议在配置完绑定映射后进行验证，以确保数据能正确传输"
                      style={{ marginTop: 16 }}
                    />
                  </div>
                ),
                width: 600
              });
            }}
            block
          >
            验证说明
          </Button>
        </Col>
      </Row>

      {/* 验证结果显示 */}
      {frontendValidationResult && (
        <Card 
          title={
            <Space>
              <CheckCircleOutlined />
              数据兼容性验证结果
              <Tag color={frontendValidationResult.summary.errors > 0 ? 'red' : 
                          frontendValidationResult.summary.warnings > 0 ? 'orange' : 'green'}>
                {frontendValidationResult.summary.compatible}/{frontendValidationResult.summary.total} 兼容
              </Tag>
            </Space>
          }
          size="small"
          style={{ marginTop: 16 }}
          extra={
            <Button 
              size="small" 
              onClick={() => setFrontendValidationResult(null)}
            >
              清除结果
            </Button>
          }
        >
          {/* 验证总览 */}
          <Row gutter={16} style={{ marginBottom: 16 }}>
            <Col span={6}>
              <Card size="small" style={{ textAlign: 'center', backgroundColor: '#f0f9ff' }}>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#1890ff' }}>
                  {frontendValidationResult.summary.total}
                </div>
                <div style={{ color: '#666' }}>总计</div>
              </Card>
            </Col>
            <Col span={6}>
              <Card size="small" style={{ textAlign: 'center', backgroundColor: '#f6ffed' }}>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#52c41a' }}>
                  {frontendValidationResult.summary.compatible}
                </div>
                <div style={{ color: '#666' }}>兼容</div>
              </Card>
            </Col>
            <Col span={6}>
              <Card size="small" style={{ textAlign: 'center', backgroundColor: '#fff7e6' }}>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#fa8c16' }}>
                  {frontendValidationResult.summary.warnings}
                </div>
                <div style={{ color: '#666' }}>警告</div>
              </Card>
            </Col>
            <Col span={6}>
              <Card size="small" style={{ textAlign: 'center', backgroundColor: '#fff2f0' }}>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#ff4d4f' }}>
                  {frontendValidationResult.summary.errors}
                </div>
                <div style={{ color: '#666' }}>错误</div>
              </Card>
            </Col>
          </Row>

          {/* 详细验证结果 */}
          <Collapse>
            {frontendValidationResult.results.map((result: any, index: number) => (
              <Panel 
                key={index}
                header={
                  <Space>
                    {result.status === 'success' && <CheckCircleOutlined style={{ color: '#52c41a' }} />}
                    {result.status === 'warning' && <ExclamationCircleOutlined style={{ color: '#fa8c16' }} />}
                    {result.status === 'error' && <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />}
                    <Text strong>绑定 {index + 1}:</Text>
                    <Text code>{result.source}</Text>
                    <Text>→</Text>
                    <Text code>{result.target}</Text>
                    <Tag color={result.status === 'success' ? 'green' : 
                               result.status === 'warning' ? 'orange' : 'red'}>
                      {result.message}
                    </Tag>
                  </Space>
                }
              >
                <Row gutter={16}>
                  <Col span={12}>
                    <Card title="源数据信息" size="small">
                      {result.sourceInfo && (
                        <div>
                          <p><strong>类型:</strong> {result.sourceInfo.type}</p>
                          {result.sourceInfo.value !== undefined && (
                            <p><strong>示例值:</strong> {JSON.stringify(result.sourceInfo.value)}</p>
                          )}
                          {result.sourceInfo.range && (
                            <p><strong>范围:</strong> [{result.sourceInfo.range[0]}, {result.sourceInfo.range[1]}]</p>
                          )}
                          {result.sourceInfo.length && (
                            <p><strong>数组长度:</strong> {result.sourceInfo.length}</p>
                          )}
                          {result.sourceInfo.elementType && (
                            <p><strong>元素类型:</strong> {result.sourceInfo.elementType}</p>
                          )}
                        </div>
                      )}
                    </Card>
                  </Col>
                  <Col span={12}>
                    <Card title="目标属性信息" size="small">
                      {result.targetInfo && (
                        <div>
                          <p><strong>类型:</strong> {result.targetInfo.type}</p>
                          {result.targetInfo.range && (
                            <p><strong>范围:</strong> [{result.targetInfo.range[0]}, {result.targetInfo.range[1]}]</p>
                          )}
                          {result.targetInfo.length && (
                            <p><strong>数组长度:</strong> {result.targetInfo.length}</p>
                          )}
                          {result.targetInfo.elementType && (
                            <p><strong>元素类型:</strong> {result.targetInfo.elementType}</p>
                          )}
                        </div>
                      )}
                    </Card>
                  </Col>
                </Row>
                
                {result.suggestions && result.suggestions.length > 0 && (
                  <Alert
                    type="info"
                    message="优化建议"
                    description={
                      <ul style={{ marginBottom: 0 }}>
                        {result.suggestions.map((suggestion: string, idx: number) => (
                          <li key={idx}>{suggestion}</li>
                        ))}
                      </ul>
                    }
                    style={{ marginTop: 16 }}
                  />
                )}
              </Panel>
            ))}
          </Collapse>
        </Card>
      )}
    </Card>
  );

  // 渲染步骤3：高级选项
  const renderAdvancedOptionsStep = () => (
    <Space direction="vertical" style={{ width: '100%' }}>
      <Collapse>
        <Panel header="数值映射" key="valueMapping">
          <Row gutter={16}>
            <Col span={6}>
              <Form.Item name={['valueMapping', 'inputMin']} label="输入最小值">
                <InputNumber style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name={['valueMapping', 'inputMax']} label="输入最大值">
                <InputNumber style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name={['valueMapping', 'outputMin']} label="输出最小值">
                <InputNumber style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name={['valueMapping', 'outputMax']} label="输出最大值">
                <InputNumber style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item name={['valueMapping', 'clamp']} label="限制输出范围" valuePropName="checked">
                <Switch checkedChildren="是" unCheckedChildren="否" />
              </Form.Item>
            </Col>
          </Row>
        </Panel>

        <Panel header="插值配置" key="interpolation">
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name={['interpolation', 'type']} label="插值类型">
                <Select>
                  <Option value={InterpolationType.NONE}>无插值</Option>
                  <Option value={InterpolationType.LINEAR}>线性插值</Option>
                  <Option value={InterpolationType.SMOOTH}>平滑插值</Option>
                  <Option value={InterpolationType.STEP}>阶梯插值</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name={['interpolation', 'duration']} label="插值时长(秒)">
                <InputNumber min={0} step={0.1} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
        </Panel>

        <Panel header="其他配置" key="other">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="updateInterval" label="更新间隔(毫秒)">
                <InputNumber min={0} style={{ width: '100%' }} placeholder="0表示无限制" />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item name="transform" label="数据转换脚本">
                <TextArea 
                  rows={3} 
                  placeholder="可选的JavaScript表达式，如：value * 100" 
                />
              </Form.Item>
            </Col>
          </Row>
        </Panel>
      </Collapse>
    </Space>
  );

  // 渲染步骤4：验证测试
  const renderValidationStep = () => (
    <Card title="配置验证" size="small">
      <Space direction="vertical" style={{ width: '100%' }}>
        <Row gutter={16}>
          <Col span={12}>
            <Button
              type="primary"
              icon={<CheckCircleOutlined />}
              onClick={handleValidate}
              loading={testLoading}
              block
            >
              验证配置
            </Button>
          </Col>
          <Col span={12}>
            <Button
              icon={<ExperimentOutlined />}
              onClick={handleTest}
              loading={testLoading}
              block
            >
              测试绑定
            </Button>
          </Col>
        </Row>

        {validationResult && (
          <Alert
            type={validationResult.valid ? 'success' : 'error'}
            showIcon
            message={validationResult.valid ? '配置验证通过' : '配置验证失败'}
            description={
              <div>
                {validationResult.errors.length > 0 && (
                  <div>
                    <strong>错误：</strong>
                    <ul>
                      {validationResult.errors.map((error, index) => (
                        <li key={index}>{error}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {validationResult.warnings.length > 0 && (
                  <div>
                    <strong>警告：</strong>
                    <ul>
                      {validationResult.warnings.map((warning, index) => (
                        <li key={index}>{warning}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            }
          />
        )}
      </Space>
    </Card>
  );

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return renderDataSourceStep();
      case 1:
        return renderBindingConfigStep();
      case 2:
        return renderAdvancedOptionsStep();
      case 3:
        return renderValidationStep();
      default:
        return null;
    }
  };

  return (
    <Modal
      title={editingBinding ? '编辑IoT绑定' : '新增IoT绑定'}
      open={visible}
      onCancel={onClose}
      footer={[
        <Button key="cancel" onClick={onClose}>
          取消
        </Button>,
        currentStep > 0 && (
          <Button key="prev" onClick={handlePrev}>
            上一步
          </Button>
        ),
        currentStep < steps.length - 1 ? (
          <Button key="next" type="primary" onClick={handleNext}>
            下一步
          </Button>
        ) : (
          <Button key="save" type="primary" onClick={handleSave} loading={loading}>
            {editingBinding ? '更新绑定' : '创建绑定'}
          </Button>
        )
      ].filter(Boolean)}
      width={800}
      destroyOnClose={false}
      forceRender
    >
      <Steps current={currentStep} items={steps} style={{ marginBottom: 24 }} />

      <Spin spinning={loading}>
        <Form form={form} layout="vertical">
          {renderStepContent()}
        </Form>
      </Spin>

      {/* 数据预览模态框 */}
      {selectedProtocol && selectedConnection && (
        <DataPreviewModal
          visible={showDataPreview}
          protocol={selectedProtocol}
          connectionId={selectedConnection.id}
          onClose={() => setShowDataPreview(false)}
          onPathSelect={(path) => {
            // 这里可以自动填充到当前的绑定配置中
            const bindings = form.getFieldValue('bindings') || [];
            console.log('📍 选择数据路径:', path);
            console.log('📋 当前绑定配置:', bindings);
            
            if (bindings.length > 0) {
              // 直接更新第一个绑定项的源路径
              form.setFieldValue(['bindings', 0, 'source'], path);
              console.log('✅ 已更新绑定配置源路径:', path);
            } else {
              // 如果没有绑定项，创建一个新的
              const newBinding = { 
                source: path, 
                target: '', 
                direction: BindingDirection.IOT_TO_INSTANCE 
              };
              form.setFieldsValue({ bindings: [newBinding] });
              console.log('✅ 已创建新绑定配置:', [newBinding]);
            }
            setShowDataPreview(false);
            message.success(`已选择数据路径: ${path}`);
          }}
        />
      )}
    </Modal>
  );
};

export default IoTBindingConfigModal; 