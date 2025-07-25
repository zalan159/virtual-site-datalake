// components/AssetTabs.tsx
import './AssetTabs.css';
import React, { useState } from 'react';
import { Tabs, Spin, Typography, Card, Image, Space, Select, Input, Empty, Pagination, theme } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { ModelAsset } from '../hooks/useModelAssets';
import { MaterialDefinition } from '../hooks/useCesiumDragAndDrop';
import { PublicModelMetadata } from '../services/publicModels';
import { usePublicModelAssets } from '../hooks/usePublicModelAssets';
import { ThreeDTilesTab } from './ThreeDTilesTab';
import { AnimationTab } from './AnimationTab';
// import { GaussianSplatTab } from './GaussianSplatTab';

const { Text } = Typography;
const { Option } = Select;

// 通用立方体图标组件
const CubeIcon: React.FC<{ size?: number; color?: string; draggable?: boolean; onDragStart?: (e: React.DragEvent) => void }> = 
  ({ size = 40, color = '#1890ff', draggable, onDragStart }) => (
  <div
    style={{ display: 'inline-block', cursor: draggable ? 'grab' : 'default' }}
    draggable={draggable}
    onDragStart={onDragStart}
  >
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none">
      <rect x="8" y="8" width="24" height="24" rx="4" fill={color} stroke={color === '#1890ff' ? '#0050b3' : '#666'} strokeWidth="2" />
      <rect x="14" y="14" width="12" height="12" rx="2" fill={color === '#1890ff' ? '#e6f7ff' : '#f0f0f0'} stroke={color} strokeWidth="1.5" />
    </svg>
  </div>
);

// 统一的资源卡片基础组件
interface AssetCardProps {
  id: string;
  name: string;
  previewImage?: string;
  icon?: React.ReactNode;
  onDragStart: (e: React.DragEvent, id: string) => void;
}

const AssetCard: React.FC<AssetCardProps> = ({ id, name, previewImage, icon, onDragStart }) => {
  return (
    <Card
      key={id}
      style={{ 
        width: 80, 
        padding: 0, 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center', 
        justifyContent: 'center',
        cursor: 'grab' 
      }}
      styles={{
        body: { padding: 8, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }
      }}
      draggable
      onDragStart={e => onDragStart(e, id)}
    >
      {previewImage ? (
        <div style={{ width: 60, height: 60, overflow: 'hidden', borderRadius: 4 }}>
          <Image
            src={previewImage}
            alt={name}
            width={60}
            height={60}
            style={{ objectFit: 'cover' }}
            fallback="/logoonly.png"
            preview={false}
          />
        </div>
      ) : icon ? (
        icon
      ) : (
        <CubeIcon />
      )}
      <Text 
        ellipsis={{ 
          tooltip: name 
        }}
        style={{ 
          fontSize: 12, 
          margin: '4px 0', 
          textAlign: 'center', 
          width: '100%', 
          padding: '0 4px',
          display: '-webkit-box',
          WebkitBoxOrient: 'vertical',
          WebkitLineClamp: 2,
          overflow: 'hidden',
          wordWrap: 'break-word',
          wordBreak: 'break-all',
          whiteSpace: 'normal'
        }}
      >
        {name}
      </Text>
    </Card>
  );
};

// 用户模型标签页组件
interface ModelTabProps {
  models: ModelAsset[];
  loading: boolean;
  onModelDragStart: (e: React.DragEvent, modelId: string, generateMode: 'mouse' | 'origin') => void;
  generateMode: 'mouse' | 'origin';
}

const ModelTab: React.FC<ModelTabProps> = ({ models, loading, onModelDragStart, generateMode }) => {
  return (
    <>
      {loading ? (
        <Spin style={{ marginTop: 32, display: 'block', textAlign: 'center' }} />
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, padding: '16px 0' }}>
          {models.length === 0 ? (
            <div style={{ color: '#888', width: '100%', textAlign: 'center', lineHeight: '80px' }}>暂无GLB模型</div>
          ) : (
            models.map((model) => {
              const modelId = model._id || model.id! || model.fileId!;
              const modelName = model.name || model.filename;
              
              return (
                <AssetCard 
                  key={modelId}
                  id={modelId}
                  name={modelName}
                  previewImage={model.preview_image}
                  onDragStart={(e, id) => onModelDragStart(e, id, generateMode)}
                />
              );
            })
          )}
        </div>
      )}
    </>
  );
};

// 公共模型标签页组件
interface PublicModelTabProps {
  models: PublicModelMetadata[];
  loading: boolean;
  total: number;
  categories: { [key: string]: string[] };
  tags: { [key: string]: string[] };
  onSearch: (search: string) => void;
  onCategoryChange: (category: string | undefined) => void;
  onSubCategoryChange: (subCategory: string | undefined) => void;
  onTagChange: (tag: string | undefined) => void;
  onPageChange: (page: number, pageSize: number) => void;
  onModelDragStart: (e: React.DragEvent, modelId: string, generateMode: 'mouse' | 'origin') => void;
  page: number; 
  pageSize: number;
  generateMode: 'mouse' | 'origin';
}

const PublicModelTab: React.FC<PublicModelTabProps> = ({
  models,
  loading,
  total,
  categories,
  tags,
  onSearch,
  onCategoryChange,
  onSubCategoryChange,
  onTagChange,
  onPageChange,
  onModelDragStart,
  page,
  pageSize,
  generateMode
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>();
  const [searchText, setSearchText] = useState('');

  const handleCategoryChange = (value: string | undefined) => {
    setSelectedCategory(value);
    onCategoryChange(value);
    onSubCategoryChange(undefined); // 重置子分类
  };

  const handleSearch = () => {
    onSearch(searchText);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* 筛选和搜索区域 */}
      <Space style={{ marginBottom: 16, flexWrap: 'wrap' }} size={[8, 16]}>
        <Select 
          placeholder="选择分类" 
          style={{ width: 120 }}
          allowClear
          onChange={handleCategoryChange}
        >
          {Object.keys(categories).map(category => (
            <Option key={category} value={category}>{category}</Option>
          ))}
        </Select>
        
        <Select 
          placeholder="选择子分类" 
          style={{ width: 120 }}
          allowClear
          disabled={!selectedCategory}
          onChange={value => onSubCategoryChange(value)}
        >
          {selectedCategory && categories[selectedCategory]?.map(subCategory => (
            <Option key={subCategory} value={subCategory}>{subCategory}</Option>
          ))}
        </Select>
        
        <Select 
          placeholder="选择标签" 
          style={{ width: 120 }}
          allowClear
          onChange={value => onTagChange(value)}
        >
          {Object.values(tags).flat().map(tag => (
            <Option key={tag} value={tag}>{tag}</Option>
          ))}
        </Select>
        
        <Input
          placeholder="搜索模型"
          value={searchText}
          onChange={e => setSearchText(e.target.value)}
          onPressEnter={handleSearch}
          suffix={<SearchOutlined onClick={handleSearch} style={{ cursor: 'pointer' }} />}
          style={{ width: 200 }}
        />
      </Space>
      
      {/* 模型列表区域 */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <Spin spinning={loading}>
          {models.length === 0 ? (
            <Empty description="暂无公共模型" style={{ margin: '40px 0' }} />
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, padding: '16px 0' }}>
              {models.map(model => (
                <AssetCard 
                  key={model._id}
                  id={model._id}
                  name={model.filename}
                  previewImage={model.preview_image}
                  onDragStart={(e, id) => onModelDragStart(e, id, generateMode)}
                />
              ))}
            </div>
          )}
        </Spin>
      </div>
      
      {/* 分页区域 */}
      <div style={{ marginTop: 16, textAlign: 'right' }}>
        <Pagination
          current={page}
          pageSize={pageSize}
          total={total}
          onChange={onPageChange}
          size="small"
          showSizeChanger={false}
          showTotal={total => `共 ${total} 个模型`}
        />
      </div>
    </div>
  );
};

// 材质标签页组件
// interface MaterialTabProps {
//   materials: MaterialDefinition[];
//   onMaterialDragStart: (e: React.DragEvent, materialId: string) => void;
// }

// const MaterialTab: React.FC<MaterialTabProps> = ({ materials, onMaterialDragStart }) => {
//   return (
//     <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, padding: '16px 0' }}>
//       {materials.map(mat => (
//         <AssetCard
//           key={mat.id}
//           id={mat.id}
//           name={mat.name}
//           icon={mat.icon}
//           onDragStart={onMaterialDragStart}
//         />
//       ))}
//     </div>
//   );
// };

// 主AssetTabs组件
interface AssetTabsProps {
  models: ModelAsset[];
  loadingModels: boolean;
  materials: MaterialDefinition[];
  onModelDragStart: (e: React.DragEvent, modelId: string, generateMode: 'mouse' | 'origin') => void;
  onMaterialDragStart: (e: React.DragEvent, materialId: string) => void;
  onPublicModelDragStart?: (e: React.DragEvent, modelId: string, generateMode: 'mouse' | 'origin') => void;
  onThreeDTilesDragStart?: (e: React.DragEvent, item: any) => void;
  onGaussianSplatDragStart?: (e: React.DragEvent, splat: any) => void;
  viewerRef: React.RefObject<any>;
  selectedModelId: string | null;
}

export const AssetTabs: React.FC<AssetTabsProps> = ({
  models,
  loadingModels,
  onModelDragStart,
  onPublicModelDragStart,
  onThreeDTilesDragStart,
  onGaussianSplatDragStart,
  viewerRef,
  selectedModelId,
}) => {
  const { token } = theme.useToken();
  // 公共模型过滤条件
  const [publicModelOptions, setPublicModelOptions] = useState({
    page: 1,
    pageSize: 20,
    category: undefined as string | undefined,
    subCategory: undefined as string | undefined,
    tag: undefined as string | undefined,
    search: undefined as string | undefined
  });

  // 新增生成方式选项
  const [generateMode, setGenerateMode] = useState<'mouse' | 'origin'>('mouse');

  // 使用公共模型hook
  const { 
    publicModels, 
    loadingPublicModels, 
    publicModelsTotal,
    categories,
    tags
  } = usePublicModelAssets(publicModelOptions);

  // 处理公共模型搜索和筛选
  const handlePublicModelSearch = (search: string) => {
    setPublicModelOptions(prev => ({ ...prev, search, page: 1 }));
  };

  const handlePublicModelCategoryChange = (category: string | undefined) => {
    setPublicModelOptions(prev => ({ ...prev, category, page: 1 }));
  };

  const handlePublicModelSubCategoryChange = (subCategory: string | undefined) => {
    setPublicModelOptions(prev => ({ ...prev, subCategory, page: 1 }));
  };

  const handlePublicModelTagChange = (tag: string | undefined) => {
    setPublicModelOptions(prev => ({ ...prev, tag, page: 1 }));
  };

  const handlePublicModelPageChange = (page: number, pageSize: number) => {
    setPublicModelOptions(prev => ({ ...prev, page, pageSize }));
  };

  // 处理模型拖拽开始，增加generateMode参数
  const handleModelDragStart = (e: React.DragEvent, modelId: string, mode: 'mouse' | 'origin') => {
    e.dataTransfer.setData('modelId', modelId);
    e.dataTransfer.setData('generateMode', mode);
    onModelDragStart(e, modelId, mode);
  };

  // 处理公共模型拖拽开始，增加generateMode参数
  const handlePublicModelDragStart = (e: React.DragEvent, modelId: string, mode: 'mouse' | 'origin') => {
    e.dataTransfer.setData('publicModelId', modelId);
    e.dataTransfer.setData('generateMode', mode);
    if (onPublicModelDragStart) {
      onPublicModelDragStart(e, modelId, mode);
    }
  };

  const items = [
    {
      key: 'models',
      label: '模型',
      children: (
        <ModelTab 
          models={models}
          loading={loadingModels}
          onModelDragStart={handleModelDragStart}
          generateMode={generateMode}
        />
      ),
    },
    {
      key: 'publicModels',
      label: '公共模型',
      children: (
        <PublicModelTab
          models={publicModels}
          loading={loadingPublicModels}
          total={publicModelsTotal}
          categories={categories}
          tags={tags}
          onSearch={handlePublicModelSearch}
          onCategoryChange={handlePublicModelCategoryChange}
          onSubCategoryChange={handlePublicModelSubCategoryChange}
          onTagChange={handlePublicModelTagChange}
          onPageChange={handlePublicModelPageChange}
          onModelDragStart={handlePublicModelDragStart}
          page={publicModelOptions.page}
          pageSize={publicModelOptions.pageSize}
          generateMode={generateMode}
        />
      ),
    },
    {
      key: 'threedtiles',
      label: '3DTiles',
      children: (
        <ThreeDTilesTab onThreeDTilesDragStart={onThreeDTilesDragStart} />
      ),
    },
    // {
    //   key: 'gaussianSplats',
    //   label: '高斯泼溅',
    //   children: (
    //     <GaussianSplatTab onGaussianSplatDragStart={onGaussianSplatDragStart} />
    //   ),
    // },
    {
      key: 'animation',
      label: '动画',
      children: (
        <AnimationTab
          viewerRef={viewerRef}
          selectedModelId={selectedModelId}
        />
      ),
    },
    {
      key: 'materials',
      label: '材质',
      children: (
        // <MaterialTab 
        //   materials={materials}
        //   onMaterialDragStart={onMaterialDragStart}
        // />
        <div style={{width: '100%', height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888', fontSize: 16}}>
          材质功能正在开发中
        </div>
      ),
    }
  ];

  // 新增：tabBarExtraContent右上角生成方式选择
  const [activeKey, setActiveKey] = useState('models');
  const showGenerateMode = activeKey === 'models' || activeKey === 'publicModels';
  const tabBarExtraContent = showGenerateMode ? (
    <Select
      size="small"
      style={{ width: 120 }}
      value={generateMode}
      onChange={setGenerateMode}
      options={[
        { label: '跟随鼠标', value: 'mouse' },
        { label: '原点生成', value: 'origin' },
      ]}
    />
  ) : null;

  return (
    <Card
      style={{
        height: '100%',
        width: '100%',
        overflow: 'hidden',
        padding: 0,
        display: 'flex',
        flexDirection: 'column',
      }}
      styles={{
        body: { padding: 0, height: '100%', display: 'flex', flexDirection: 'column' }
      }}
    >
      {/* 使用 rootClassName 配合外部样式，使 Tabs 标题栏 sticky，内容区滚动 */}
      <Tabs
        defaultActiveKey="models"
        activeKey={activeKey}
        onChange={setActiveKey}
        rootClassName="asset-tabs"
        style={{ flex: 1 }}
        tabBarStyle={{ position: 'sticky', top: 0, zIndex: 1, background: token.colorBgContainer, padding: '0 16px' }}
        items={items}
        tabBarExtraContent={tabBarExtraContent}
      />
    </Card>
  );
};