// SceneEditorStandalone.tsx
import React, { useRef, useState, useCallback, useEffect } from 'react';
import { Typography, Switch, Tabs, Form, InputNumber, Button, Spin, message, Card, Flex, Splitter } from 'antd';
import { useParams } from 'react-router-dom';
import * as Cesium from 'cesium'; // 引入 Cesium 以便使用 CustomShader 等
import axios from 'axios';

// Hooks
import { useCesiumViewer } from '../../hooks/useCesiumViewer';
import { useModelAssets } from '../../hooks/useModelAssets';
import { useCesiumInteractions, SelectedModelInfo } from '../../hooks/useCesiumInteractions';
import { useCesiumDragAndDrop, MaterialDefinition } from '../../hooks/useCesiumDragAndDrop';

// Components
import { AssetTabs } from '../../components/AssetTabs';
import { SelectedModelPropertiesPanel } from '../../components/SelectedModelPropertiesPanel';
import { LayerDrawer, LayerInfo } from '../../components/LayerDrawer';
import { MenuOutlined } from '@ant-design/icons';
import DynamicPropertyForm from '../../components/DynamicPropertyForm';
import { getSceneDetail, updateSceneProperty, updateScenePreviewImage } from '../../services/sceneApi';

const { Title } = Typography;
const { TabPane } = Tabs;

// 材质定义 (可以移到单独的文件或从API获取)
const editorMaterials: MaterialDefinition[] = [
  {
    id: 'red',
    name: '红色',
    icon: (
      <svg width={40} height={40} viewBox="0 0 40 40" fill="none">
        <rect x="8" y="8" width="24" height="24" rx="4" fill="#ff4d4f" stroke="#a8071a" strokeWidth="2" />
        <rect x="14" y="14" width="12" height="12" rx="2" fill="#fff1f0" stroke="#ff4d4f" strokeWidth="1.5" />
      </svg>
    ),
    customShader: new Cesium.CustomShader({
      fragmentShaderText: `
        void fragmentMain(FragmentInput fsInput, inout czm_modelMaterial material) {
          material.diffuse = vec3(1.0, 0.0, 0.0);
        }
      `
    })
  },
  // 添加更多材质...
];

const SceneSidebar: React.FC<{ sceneId?: string, viewerRef?: React.RefObject<any>, style?: React.CSSProperties }> = ({ sceneId, viewerRef, style }) => {
  const [sceneInfo, setSceneInfo] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const fetchSceneData = useCallback(() => {
    if (!sceneId) return;
    setLoading(true);
    getSceneDetail(sceneId)
      .then(res => {
        console.log('场景数据:', res.data);
        setSceneInfo(res.data);
      })
      .finally(() => setLoading(false));
  }, [sceneId]);

  useEffect(() => {
    fetchSceneData();
  }, [fetchSceneData]);

  // 保存所有属性（忽略预览图）
  const handleSave = async (values: any): Promise<void> => {
    if (!sceneId) return;
    // 只保存非预览图字段
    const { preview_image, ...rest } = values || {};
    if (Object.keys(rest).length > 0) {
      await updateSceneProperty(sceneId, rest);
    }
    // 预览图完全不在这里处理
  };

  // 新增：飞到原点
  const handleFlyToOrigin = (origin: {longitude: number, latitude: number, height: number}) => {
    if (!origin || !viewerRef?.current) return;
    const { longitude, latitude, height } = origin;
    if (
      typeof longitude === 'number' &&
      typeof latitude === 'number' &&
      typeof height === 'number'
    ) {
      viewerRef.current.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(longitude, latitude, height || 1000),
        duration: 1.5
      });
    }
  };

  // 新增：更新预览图
  const handleUpdatePreviewImage = async () => {
    if (!sceneId || !viewerRef?.current) return;
    try {
      // 强制渲染一帧
      viewerRef.current.scene.requestRender();
      // 等待下一帧（确保渲染完成）
      await new Promise(resolve => setTimeout(resolve, 100));
      // 获取 Cesium canvas 截图
      const canvas = viewerRef.current.scene.canvas;
      const base64 = canvas.toDataURL('image/png');
      await updateScenePreviewImage(sceneId, base64);
      message.success('预览图已更新');
      fetchSceneData();
    } catch (e) {
      message.error('预览图更新失败');
    }
  };

  return (
    <Card
      style={{
        position: 'absolute',
        top: 0,
        right: 0,
        width: '20vw',
        height: '80vh',
        zIndex: 100,
        borderRadius: '8px 0 0 8px',
        overflow: 'auto',
        padding: 0,
        ...style
      }}
      styles={{
        body: { padding: '16px 0', height: '100%', overflow: 'auto' }
      }}
    >
      {!sceneInfo ? (
        <Spin spinning={loading} style={{ margin: '100px auto', display: 'block', textAlign: 'center' }}>
          <div>加载场景数据...</div>
        </Spin>
      ) : (
        <Tabs 
          defaultActiveKey="scene" 
          style={{ width: '100%' }}
          items={[
            {
              key: 'scene',
              label: '场景设置',
              children: (
                <DynamicPropertyForm
                  entityId={sceneId || ''}
                  data={sceneInfo.data}
                  metadata={sceneInfo.metadata}
                  loading={loading}
                  onSave={handleSave}
                  onRefresh={fetchSceneData}
                  sectionTitle="场景属性"
                  onFlyToOrigin={handleFlyToOrigin}
                  onUpdatePreviewImage={handleUpdatePreviewImage}
                />
              )
            },
            {
              key: 'instance',
              label: '实例管理',
              children: (
                <div style={{ padding: '16px', color: '#999' }}>
                  实例管理功能开发中...
                </div>
              )
            }
          ]}
        />
      )}
    </Card>
  );
};

const SceneEditorStandalone: React.FC = () => {
  const { sceneId } = useParams<{ sceneId?: string }>();
  const cesiumContainerRef = useRef<HTMLDivElement>(null);
  const gizmoRef = useRef<any>(null);

  // 场景数据状态
  const [sceneInfo, setSceneInfo] = useState<any>(null);
  const [loadingScene, setLoadingScene] = useState(false);

  // 获取场景数据
  const fetchSceneData = useCallback(() => {
    if (!sceneId) return;
    setLoadingScene(true);
    getSceneDetail(sceneId)
      .then((res) => {
        setSceneInfo(res.data);
      })
      .finally(() => setLoadingScene(false));
  }, [sceneId]);

  // 组件加载时立即获取场景数据
  useEffect(() => {
    fetchSceneData();
  }, [fetchSceneData]);

  // 根据 sceneInfo 动态设置 origin
  const origin = sceneInfo?.data?.origin || {
    longitude: 113.2644, // 默认值
    latitude: 23.1291,
    height: 10000,
  };

  // Cesium Viewer Hook，依赖 origin
  const viewerRef = useCesiumViewer(cesiumContainerRef, origin);

  // Model Assets Hook
  const { models, loadingModels } = useModelAssets();

  // Selected Model State
  const [selectedModelInfo, setSelectedModelInfo] = useState<SelectedModelInfo | null>(null);

  // Cesium Interactions Hook
  const { externalClearHighlight, clearGizmo } = useCesiumInteractions(
    viewerRef,
    setSelectedModelInfo,
    gizmoRef
  );

  const [drawerVisible, setDrawerVisible] = useState(false);
  const [layerStates, setLayerStates] = useState<LayerInfo[]>([]);

  // 获取图层信息
  const refreshLayerStates = useCallback(() => {
    if (viewerRef.current) {
      const layers = viewerRef.current.imageryLayers;
      const arr: LayerInfo[] = [];
      for (let i = 0; i < layers.length; i++) {
        const layer = layers.get(i);
        let layerName = '';
        if (layer.imageryProvider && layer.imageryProvider.constructor && layer.imageryProvider.constructor.name) {
          layerName = layer.imageryProvider.constructor.name;
        } else {
          layerName = `图层${i + 1}`;
        }
        arr.push({
          id: String(i),
          name: layerName,
          show: layer.show,
        });
      }
      setLayerStates(arr);
    }
  }, [viewerRef]);

  // Cesium Drag and Drop Hook
  const { dragLatLng, handleDragOver, handleDrop, resetDragLatLng } = useCesiumDragAndDrop(
    viewerRef,
    cesiumContainerRef,
    models,
    editorMaterials,
    refreshLayerStates
  );

  const handleCesiumMouseLeave = () => {
    resetDragLatLng();
    externalClearHighlight();
  };

  const handleClosePropertiesPanel = useCallback(() => {
    setSelectedModelInfo(null);
    clearGizmo();
  }, [clearGizmo]);

  const handleModelDragStart = (e: React.DragEvent, modelId: string) => {
    e.dataTransfer.setData('modelId', modelId);
  };

  const handleMaterialDragStart = (e: React.DragEvent, materialId: string) => {
    e.dataTransfer.setData('materialId', materialId);
  };

  // 切换图层显示/隐藏
  const handleToggleLayer = (id: string, show: boolean) => {
    if (viewerRef.current) {
      const idx = parseInt(id, 10);
      const layer = viewerRef.current.imageryLayers.get(idx);
      if (layer) {
        layer.show = show;
        if (idx === 0 && viewerRef.current.scene && viewerRef.current.scene.globe) {
          if (!show) {
            viewerRef.current.scene.globe.baseColor = Cesium.Color.fromCssColorString('#e0e0e0');
          } else {
            viewerRef.current.scene.globe.baseColor = Cesium.Color.WHITE;
          }
        }
        refreshLayerStates();
      }
    }
  };

  // 打开 Drawer 时刷新图层
  const handleOpenDrawer = () => {
    refreshLayerStates();
    setDrawerVisible(true);
  };

  return (
    <div style={{ height: '100vh', width: '100vw', background: '#fff', position: 'relative', overflow: 'hidden' }}>
      <Title level={3} style={{ position: 'absolute', zIndex: 10, left: 24, top: 16, userSelect: 'none' }}>
        独立场景编辑器 {sceneId ? `(ID: ${sceneId})` : ''}
      </Title>

      {/* Splitter 嵌套布局 */}
      <Splitter layout="vertical" style={{ height: '100vh', width: '100vw' }}>
        <Splitter.Panel style={{ minHeight: 0 }}>
          <Splitter style={{ height: '100%', width: '100%' }}>
            {/* 左上：Cesium Viewer */}
            <Splitter.Panel style={{ minWidth: 0, position: 'relative', height: '100%' }}>
              <div
                ref={cesiumContainerRef}
                style={{ width: '100%', height: '100%' }}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onMouseLeave={handleCesiumMouseLeave}
              />
            </Splitter.Panel>
            {/* 右上：SceneSidebar，仅在 sceneInfo 和 viewerRef 准备好后加载 */}
            <Splitter.Panel defaultSize={400} style={{ minWidth: 0, position: 'relative', height: '100%' }}>
              {sceneInfo && viewerRef.current ? (
                <SceneSidebar sceneId={sceneId} viewerRef={viewerRef} style={{ width: '100%', height: '100%' }} />
              ) : (
                <Spin spinning={loadingScene} style={{ margin: '100px auto', display: 'block', textAlign: 'center' }}>
                  <div>加载场景数据...</div>
                </Spin>
              )}
            </Splitter.Panel>
          </Splitter>
        </Splitter.Panel>
        {/* 下方：AssetTabs */}
        <Splitter.Panel defaultSize={300} style={{ minHeight: 0, position: 'relative' }}>
          <div style={{ width: '100%', height: '100%' }}>
            <AssetTabs
              models={models}
              loadingModels={loadingModels}
              materials={editorMaterials}
              onModelDragStart={handleModelDragStart}
              onMaterialDragStart={handleMaterialDragStart}
            />
          </div>
        </Splitter.Panel>
      </Splitter>

      {dragLatLng && (
        <div style={{
          position: 'absolute',
          left: 16,
          bottom: '27%',
          zIndex: 100,
          padding: '4px 12px',
          borderRadius: 4,
          fontSize: 13,
          pointerEvents: 'none',
        }}>
          经纬度：{dragLatLng.lon.toFixed(6)}, {dragLatLng.lat.toFixed(6)}
        </div>
      )}

      <SelectedModelPropertiesPanel
        selectedModelInfo={selectedModelInfo}
        onClose={handleClosePropertiesPanel}
      />

      {/* 左上角菜单按钮 */}
      <MenuOutlined
        style={{
          position: 'absolute',
          zIndex: 20,
          left: 16,
          top: 16,
          fontSize: 24,
          cursor: 'pointer',
        }}
        onClick={handleOpenDrawer}
      />

      {/* 图层 Drawer */}
      <LayerDrawer
        visible={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        layers={layerStates}
        onToggleLayer={handleToggleLayer}
      />
    </div>
  );
};

export default SceneEditorStandalone;