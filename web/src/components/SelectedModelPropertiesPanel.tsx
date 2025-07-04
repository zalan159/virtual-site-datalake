// components/SelectedModelPropertiesPanel.tsx
import React, { useEffect, useState } from 'react';
import { Empty, Spin, Tabs, App as AntdApp, Card } from 'antd';
import { SelectedModelInfo } from '../hooks/useCesiumInteractions';
import DynamicPropertyForm from './DynamicPropertyForm';
import { getInstanceProperties, updateInstanceProperties } from '../services/sceneApi';

interface SelectedModelPropertiesPanelProps {
  selectedModelInfo: SelectedModelInfo | null;
  realtimeTransform?: {
    instanceId: string;
    transform: {
      location: number[];
      rotation: number[];
      scale: number[];
    };
  } | null;
}

export const SelectedModelPropertiesPanel: React.FC<SelectedModelPropertiesPanelProps> = ({
  selectedModelInfo,
  realtimeTransform
}) => {
  const [loading, setLoading] = useState(false);
  const [propertiesData, setPropertiesData] = useState<any>(null);
  const [metadata, setMetadata] = useState<any>(null);
  const { message } = AntdApp.useApp();

  // 当选中模型变化时，加载模型属性
  useEffect(() => {
    if (selectedModelInfo?.id) {
      loadModelProperties(selectedModelInfo.id);
      // 打印metadata和propertiesData

    } else {
      setPropertiesData(null);
      setMetadata(null);
    }
  }, [selectedModelInfo]);

  // 加载模型属性
  const loadModelProperties = async (instanceId: string) => {
    setLoading(true);
    try {
      const response = await getInstanceProperties(instanceId);
      setPropertiesData(response.data.data);
      setMetadata(response.data.metadata);
      // 打印metadata和propertiesData
      console.log("metadata:", metadata);
      console.log("propertiesData:", propertiesData);
    } catch (error) {
      console.error('获取模型属性失败:', error);
      message.error('获取模型属性失败');
    } finally {
      setLoading(false);
    }
  };

  // 保存模型属性
  const handleSave = async (values: any) => {
    if (!selectedModelInfo?.id) return;
    
    try {
      // 分别处理不同分组的属性更新
      // 注意：资产属性不可编辑，所以不处理
      
      // 更新实例属性
      if (values.instance) {
        await updateInstanceProperties(selectedModelInfo.id, values.instance);
      }
      
      // 更新绑定关系
      if (values.bindings) {
        await updateInstanceProperties(selectedModelInfo.id, values.bindings);
      }
      
      message.success('属性已更新');
      // 刷新属性
      loadModelProperties(selectedModelInfo.id);
    } catch (error) {
      console.error('更新属性失败:', error);
      message.error('更新属性失败');
    }
  };

  // Tab内容渲染
  const renderTabContent = () => {
    if (!selectedModelInfo) {
      return <Empty description="请选择一个模型以查看其属性" />;
    }

    if (loading) {
      return <Spin tip="加载中..." />;
    }

    if (propertiesData && metadata) {
      // 合并实时变换数据
      let mergedData = { ...propertiesData };
      
      // 如果有实时变换数据且匹配当前选中的模型
      if (realtimeTransform && realtimeTransform.instanceId === selectedModelInfo.id) {
        // 根据数据结构更新transform
        if (mergedData.instance) {
          mergedData = {
            ...mergedData,
            instance: {
              ...mergedData.instance,
              transform: realtimeTransform.transform
            }
          };
        } else if (mergedData.transform) {
          mergedData = {
            ...mergedData,
            transform: realtimeTransform.transform
          };
        }
      }
      
      // 打印metadata和propertiesData
      console.log("渲染表单前 metadata:", metadata);
      console.log("渲染表单前 propertiesData:", mergedData);
      return (
        <DynamicPropertyForm
          entityId={selectedModelInfo.id}
          data={mergedData}
          metadata={metadata}
          onSave={handleSave}
          onRefresh={() => loadModelProperties(selectedModelInfo.id)}
          sectionTitle="模型属性"
          // isGrouped={true}
        />
      );
    }

    return <Empty description="未能加载模型属性" />;
  };

  return (
    <Card
      style={{
        width: '100%',
        height: '100%',
        overflow: 'auto',
        padding: 0,
        borderRadius: 0,
      }}
      styles={{
        body: { padding: '16px 0', height: '100%', overflow: 'auto' }
      }}
    >
      <Tabs 
        style={{ width: '100%', height: '100%', overflow: 'auto' }}
        tabBarStyle={{ margin: 0 }}
        items={[
          {
            key: 'properties',
            label: '模型属性',
            children: renderTabContent(),
          }
        ]}
      />
    </Card>
  );
};