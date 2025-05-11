// components/AssetTabs.tsx
import React from 'react';
import { Tabs, Spin, Button, Typography, Card } from 'antd';
import { DownloadOutlined } from '@ant-design/icons';
import { ModelAsset } from '../hooks/useModelAssets';
import { MaterialDefinition } from '../hooks/useCesiumDragAndDrop';
import modelAPI from '../services/modelApi'; // 假设路径正确
import { message } from 'antd';

const { Text } = Typography;

// 自定义立方体图标 (可以移到单独的 UI 组件文件)
const CubeIcon: React.FC<{ size?: number; draggable?: boolean; onDragStart?: (e: React.DragEvent) => void }> =
  ({ size = 40, draggable, onDragStart }) => (
  <div
    style={{ display: 'inline-block', cursor: draggable ? 'grab' : 'default' }}
    draggable={draggable}
    onDragStart={onDragStart}
  >
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none">
      <rect x="8" y="8" width="24" height="24" rx="4" fill="#1890ff" stroke="#0050b3" strokeWidth="2" />
      <rect x="14" y="14" width="12" height="12" rx="2" fill="#e6f7ff" stroke="#1890ff" strokeWidth="1.5" />
    </svg>
  </div>
);

interface ModelAssetCardProps {
  model: ModelAsset;
  onDragStart: (e: React.DragEvent, modelId: string) => void;
}

const ModelAssetCard: React.FC<ModelAssetCardProps> = ({ model, onDragStart }) => {
  const modelId = model._id || model.id! || model.fileId!;
  const modelName = model.name || model.filename;

  const handleDownload = async () => {
    try {
      const response = await modelAPI.getModelDownloadUrl(modelId); // 假设此API获取原始模型下载链接
      if (response.data && response.data.download_url) {
        window.open(response.data.download_url, '_blank');
      } else {
        message.error('下载链接不可用');
      }
    } catch (error) {
      message.error('下载失败');
    }
  };

  return (
    <Card
      key={modelId}
      style={{ width: 80, padding: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}
      styles={{
        body: { padding: 8, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }
      }}
    >
      <CubeIcon
        draggable
        onDragStart={e => onDragStart(e, modelId)}
      />
      <Text style={{ fontSize: 12, margin: '4px 0', textAlign: 'center', width: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', padding: '0 4px' }} title={modelName}>
        {modelName}
      </Text>
      <Button
        type="link"
        size="small"
        icon={<DownloadOutlined />}
        style={{ padding: 0, height: 20, fontSize: 12 }}
        onClick={e => {
          e.stopPropagation();
          handleDownload();
        }}
      >
        下载
      </Button>
    </Card>
  );
};


interface MaterialAssetCardProps {
  material: MaterialDefinition;
  onDragStart: (e: React.DragEvent, materialId: string) => void;
}

const MaterialAssetCard: React.FC<MaterialAssetCardProps> = ({ material, onDragStart }) => (
  <Card
    key={material.id}
    draggable
    onDragStart={e => onDragStart(e, material.id)}
    style={{ width: 80, height: 80, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', borderRadius: 8, cursor: 'grab', padding: 0 }}
    styles={{
      body: { padding: 8, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }
    }}
  >
    {material.icon}
    <Text style={{ fontSize: 12, margin: '4px 0', textAlign: 'center' }}>{material.name}</Text>
  </Card>
);

interface AssetTabsProps {
  models: ModelAsset[];
  loadingModels: boolean;
  materials: MaterialDefinition[];
  onModelDragStart: (e: React.DragEvent, modelId: string) => void;
  onMaterialDragStart: (e: React.DragEvent, materialId: string) => void;
}

export const AssetTabs: React.FC<AssetTabsProps> = ({
  models,
  loadingModels,
  materials,
  onModelDragStart,
  onMaterialDragStart,
}) => {
  const items = [
    {
      key: 'models',
      label: '模型',
      children: (
        loadingModels ? (
          <Spin style={{ marginTop: 32, display: 'block', textAlign: 'center' }} />
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, padding: '16px 0' }}>
            {models.length === 0 ? (
              <div style={{ color: '#888', width: '100%', textAlign: 'center', lineHeight: '80px' }}>暂无GLB模型</div>
            ) : (
              models.map((model) => (
                <ModelAssetCard key={model._id || model.id || model.fileId} model={model} onDragStart={onModelDragStart} />
              ))
            )}
          </div>
        )
      ),
    },
    {
      key: 'materials',
      label: '材质',
      children: (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, padding: '16px 0' }}>
          {materials.map(mat => (
            <MaterialAssetCard key={mat.id} material={mat} onDragStart={onMaterialDragStart} />
          ))}
        </div>
      ),
    }
  ];

  return (
    <Card
      style={{
        height: '100%',
        width: '100%',
        overflowY: 'auto',
        padding: 0,
        display: 'flex',
        flexDirection: 'column',
      }}
      styles={{
        body: { padding: 0, height: '100%', display: 'flex', flexDirection: 'column' }
      }}
    >
      <Tabs
        defaultActiveKey="models"
        style={{ flex: 1, padding: '0 16px' }}
        items={items}
      />
    </Card>
  );
};