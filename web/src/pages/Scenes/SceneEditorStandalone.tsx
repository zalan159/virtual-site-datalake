// SceneEditorStandalone.tsx
import React, { useRef, useState, useCallback, useEffect } from 'react';
import { Typography,  Spin, Splitter, App as AntdApp, Button } from 'antd';
import { useParams } from 'react-router-dom';
import * as Cesium from 'cesium'; // 引入 Cesium 以便使用 CustomShader 等
// @ts-ignore
import CesiumGizmo from '../../../cesium-gizmo/src/CesiumGizmo.js';

// Hooks
import { useCesiumViewer } from '../../hooks/useCesiumViewer';
import { useModelAssets } from '../../hooks/useModelAssets';
import { useCesiumInteractions, SelectedModelInfo } from '../../hooks/useCesiumInteractions';
import { useCesiumDragAndDrop } from '../../hooks/useCesiumDragAndDrop';
import { usePublicModelAssets } from '../../hooks/usePublicModelAssets';

// Components
import { AssetTabs } from '../../components/AssetTabs.js';
import { SelectedModelPropertiesPanel } from '../../components/SelectedModelPropertiesPanel';
import { LayerDrawer, LayerInfo } from '../../components/LayerDrawer';
import { MenuOutlined, EyeOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import { getSceneDetail } from '../../services/sceneApi';

// 新组件
import SceneSidebar from '../../components/scenes/SceneSidebar';
import LoadingIndicator from '../../components/scenes/LoadingIndicator';
import { buildGoViewChartPreviewUrl } from '../../config/iframe';

// 常量
import { editorMaterials } from '../../constants/editorMaterials';

const { Title } = Typography;

const SceneEditorStandalone: React.FC = () => {
  const { sceneId } = useParams<{ sceneId?: string }>();
  const cesiumContainerRef = useRef<HTMLDivElement>(null);
  const gizmoRef = useRef<any>(null);

  // 场景数据状态
  const [sceneInfo, setSceneInfo] = useState<any>(null);
  const [loadingScene, setLoadingScene] = useState(false);
  const [selectedInstanceId, setSelectedInstanceId] = useState<string | null>(null);
  
  // 预览模式状态
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [chartPreviewUrls, setChartPreviewUrls] = useState<string[]>([]);
  const [chartBounds, setChartBounds] = useState<Array<{
    x: number;
    y: number;
    width: number;
    height: number;
  }>>([]);

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

  console.log('场景编辑器中的origin:', {
    sceneInfoOrigin: sceneInfo?.data?.origin,
    finalOrigin: origin
  });

  // Cesium Viewer Hook，依赖 origin
  const { viewerRef, loadingInstances, loadingProgress, loadSceneInstances } = useCesiumViewer(cesiumContainerRef, origin);

  // 场景加载完成后加载场景实例
  useEffect(() => {
    if (sceneId && viewerRef.current && origin && sceneInfo) {
      console.log('开始加载场景实例...', {
        sceneId,
        origin,
        sceneInfo
      });
      loadSceneInstances(sceneId);
    }
  }, [sceneId, viewerRef, origin, sceneInfo, loadSceneInstances]);

  // Model Assets Hook
  const { models, loadingModels } = useModelAssets();

  // 获取公共模型数据
  const { publicModels} = usePublicModelAssets({
    pageSize: 40 // 默认一次加载更多公共模型
  });

  // Selected Model State
  const [selectedModelInfo, setSelectedModelInfo] = useState<SelectedModelInfo | null>(null);
  
  // Cesium Interactions Hook
  const { externalClearHighlight, clearGizmo } = useCesiumInteractions(
    viewerRef,
    setSelectedModelInfo,
    gizmoRef,
    setSelectedInstanceId,
    origin,
    sceneId
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
  const { message } = AntdApp.useApp();
  
  // 用于获取实例树刷新方法的引用
  const fetchInstanceTreeRef = useRef<(() => void) | undefined>();
  const setFetchInstanceTree = (fn: () => void) => {
    fetchInstanceTreeRef.current = fn;
  };
  
  const { dragLatLng, handleDragOver, handleDrop, resetDragLatLng } = useCesiumDragAndDrop(
    viewerRef,
    cesiumContainerRef,
    models,
    editorMaterials,
    message,
    refreshLayerStates,
    publicModels,
    sceneId,
    origin,
    fetchInstanceTreeRef
  );

  const handleCesiumMouseLeave = () => {
    resetDragLatLng();
    externalClearHighlight();
  };

  const handleModelDragStart = (e: React.DragEvent, modelId: string) => {
    e.dataTransfer.setData('modelId', modelId);
  };

  const handleMaterialDragStart = (e: React.DragEvent, materialId: string) => {
    e.dataTransfer.setData('materialId', materialId);
  };

  const handlePublicModelDragStart = (e: React.DragEvent, modelId: string) => {
    e.dataTransfer.setData('publicModelId', modelId);
  };

  // 3DTiles拖拽
  const handleThreeDTilesDragStart = (e: React.DragEvent, item: any) => {
    e.dataTransfer.setData('threeDTilesId', item._id);
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

  // 监听来自 iframe 的边界框信息
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'CHART_BOUNDS_UPDATE') {
        setChartBounds(event.data.bounds || []);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  // 预览模式切换
  const handlePreviewToggle = () => {
    const nextIsPreviewMode = !isPreviewMode;
    setIsPreviewMode(nextIsPreviewMode);

    if (nextIsPreviewMode) {
      // 进入预览模式
      externalClearHighlight();
      clearGizmo();
      setSelectedModelInfo(null);
      setSelectedInstanceId(null);
      
      // 处理图表绑定
      if (sceneInfo?.data?.chart_binds?.length > 0) {
        const token = localStorage.getItem('token');
        const urls = sceneInfo.data.chart_binds.map((bind: any) => {
          let chartId: string | null = null;
          
          if (typeof bind === 'string') {
            chartId = bind;
          } else if (typeof bind === 'object' && bind !== null) {
            // 兼容对象形式
            chartId = bind.uid || bind.chartId || bind.id;
          }

          if (!chartId) {
            console.warn('无法在图表绑定中找到有效的ID:', bind);
            return null;
          }
          return buildGoViewChartPreviewUrl(chartId, { token: token || undefined, transparentBg: true });
        }).filter(Boolean) as string[]; // 过滤掉 null 的结果
        setChartPreviewUrls(urls);
      }

    } else {
      // 退出预览模式
      setChartPreviewUrls([]);
      setChartBounds([]); // 清空边界信息
    }
    
    // 延迟调用resize以确保DOM更新完成
    setTimeout(() => {
      if (viewerRef.current) {
        viewerRef.current.resize();
      }
    }, 100);
  };

  return (
    <div style={{ height: '100vh', width: '100vw', background: '#fff', position: 'relative', overflow: 'hidden' }}>
      {/* 预览/返回按钮 */}
      <Button
        type="primary"
        icon={isPreviewMode ? <ArrowLeftOutlined /> : <EyeOutlined />}
        style={{ 
          position: 'absolute', 
          zIndex: 15, 
          left: 24, 
          top: 60, 
          userSelect: 'none'
        }}
        onClick={handlePreviewToggle}
      >
        {isPreviewMode ? '返回' : '预览'}
      </Button>

      {/* 预览模式下的图表 */}
      {isPreviewMode && chartPreviewUrls.map((url, index) => {
        const clipPathId = `chart-clip-path-${index}`;

        return (
          <div key={index} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}>
            {/* 动态生成SVG裁剪路径 */}
            <svg width="0" height="0" style={{ position: 'absolute' }}>
              <defs>
                <clipPath id={clipPathId}>
                  {chartBounds.map((bound, boundIndex) => (
                    <rect
                      key={`rect-${boundIndex}`}
                      x={bound.x}
                      y={bound.y}
                      width={bound.width}
                      height={bound.height}
                    />
                  ))}
                </clipPath>
              </defs>
            </svg>

            {/* 应用了裁剪路径的 Iframe */}
            <iframe
              key={index}
              src={url}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                border: 'none',
                background: 'transparent',
                zIndex: 20,
                pointerEvents: chartBounds.length > 0 ? 'auto' : 'none',
                clipPath: `url(#${clipPathId})`,
              }}
              allowTransparency={true}
              title={`chart-preview-${index}`}
            />
          </div>
        );
      })}

      {/* <Title level={3} style={{ position: 'absolute', zIndex: 10, left: 24, top: 16, userSelect: 'none' }}>
        独立场景编辑器 {sceneId ? `(ID: ${sceneId})` : ''}
      </Title> */}

      {/* 使用抽取的加载状态指示器组件 */}
      <LoadingIndicator 
        loadingInstances={loadingInstances} 
        loadingProgress={loadingProgress} 
      />

      {/* Splitter 嵌套布局 - 通过动态调整面板大小实现预览模式 */}
      <Splitter 
        layout="vertical" 
        style={{ height: '100vh', width: '100vw' }}
      >
        <Splitter.Panel style={{ minHeight: 0 }}>
          <Splitter style={{ height: '100%', width: '100%' }}>
            {/* 左上：Cesium Viewer - 预览模式下占满整个空间 */}
            <Splitter.Panel 
              size={isPreviewMode ? '100%' : undefined}
              style={{ minWidth: 0, position: 'relative', height: '100%' }}
            >
              <div
                ref={cesiumContainerRef}
                style={{ width: '100%', height: '100%' }}
                onDragOver={!isPreviewMode ? handleDragOver : undefined}
                onDrop={!isPreviewMode ? handleDrop : undefined}
                onMouseLeave={handleCesiumMouseLeave}
              />
            </Splitter.Panel>
            {/* 右上：SceneSidebar - 预览模式下隐藏 */}
            {!isPreviewMode && (
              <Splitter.Panel defaultSize={400} style={{ minWidth: 0, position: 'relative', height: '100%' }}>
                {sceneInfo && viewerRef.current ? (
                  <SceneSidebar 
                    sceneId={sceneId} 
                    viewerRef={viewerRef} 
                    style={{ width: '100%', height: '100%' }}
                    selectedInstanceId={selectedInstanceId}
                    onInstanceSelect={setSelectedInstanceId}
                    gizmoRef={gizmoRef}
                    onModelSelect={setSelectedModelInfo}
                    setFetchInstanceTree={setFetchInstanceTree}
                  />
                ) : (
                  <Spin spinning={loadingScene} style={{ margin: '100px auto', display: 'block', textAlign: 'center' }}>
                    <div>加载场景数据...</div>
                  </Spin>
                )}
              </Splitter.Panel>
            )}
            {/* 属性面板 - 预览模式下隐藏 */}
            {!isPreviewMode && (
              <Splitter.Panel
                collapsible
                defaultSize={320}
                min={240}
                max={400}
                style={{ minWidth: 0, position: 'relative', height: '100%'}}
              >
                <SelectedModelPropertiesPanel
                  selectedModelInfo={selectedModelInfo}
                />
              </Splitter.Panel>
            )}
          </Splitter>
        </Splitter.Panel>
        {/* 下方：AssetTabs - 预览模式下隐藏 */}
        {!isPreviewMode && (
          <Splitter.Panel defaultSize={300} style={{ minHeight: 0, position: 'relative' }}>
            <div style={{ width: '100%', height: '100%' }}>
              <AssetTabs
                models={models}
                loadingModels={loadingModels}
                materials={editorMaterials}
                onModelDragStart={handleModelDragStart}
                onMaterialDragStart={handleMaterialDragStart}
                onPublicModelDragStart={handlePublicModelDragStart}
                onThreeDTilesDragStart={handleThreeDTilesDragStart}
                viewerRef={viewerRef}
                selectedModelId={selectedInstanceId}
              />
            </div>
          </Splitter.Panel>
        )}
      </Splitter>

      {!isPreviewMode && dragLatLng && (
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

      {/* 左上角菜单按钮 - 只在编辑模式显示 */}
      {!isPreviewMode && (
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
      )}

      {/* 图层 Drawer - 只在编辑模式显示 */}
      {!isPreviewMode && (
        <LayerDrawer
          visible={drawerVisible}
          onClose={() => setDrawerVisible(false)}
          layers={layerStates}
          onToggleLayer={handleToggleLayer}
        />
      )}
    </div>
  );
};

export default SceneEditorStandalone;