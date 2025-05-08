// SceneEditorStandalone.tsx
import React, { useRef, useState, useCallback } from 'react';
import { Typography } from 'antd';
import { useParams } from 'react-router-dom';
import * as Cesium from 'cesium'; // 引入 Cesium 以便使用 CustomShader 等

// Hooks
import { useCesiumViewer } from '../../hooks/useCesiumViewer';
import { useModelAssets } from '../../hooks/useModelAssets';
import { useCesiumInteractions, SelectedModelInfo } from '../../hooks/useCesiumInteractions';
import { useCesiumDragAndDrop, MaterialDefinition } from '../../hooks/useCesiumDragAndDrop';

// Components
import { AssetTabs } from '../../components/AssetTabs';
import { SelectedModelPropertiesPanel } from '../../components/SelectedModelPropertiesPanel';

const { Title } = Typography;

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

const SceneEditorStandalone: React.FC = () => {
  const { sceneId } = useParams<{ sceneId?: string }>();
  const cesiumContainerRef = useRef<HTMLDivElement>(null);
  const gizmoRef = useRef<any>(null); // Gizmo 实例引用

  // Cesium Viewer Hook
  const viewerRef = useCesiumViewer(cesiumContainerRef);

  // Model Assets Hook
  const { models, loadingModels } = useModelAssets();

  // Selected Model State
  const [selectedModelInfo, setSelectedModelInfo] = useState<SelectedModelInfo | null>(null);

  // Cesium Interactions Hook
  const { externalClearHighlight, clearGizmo } = useCesiumInteractions(
    viewerRef,
    setSelectedModelInfo, // 回调函数，用于更新选中的模型信息
    gizmoRef
  );

  // Cesium Drag and Drop Hook
  const { dragLatLng, handleDragOver, handleDrop, resetDragLatLng } = useCesiumDragAndDrop(
    viewerRef,
    cesiumContainerRef,
    models,
    editorMaterials
  );

  const handleCesiumMouseLeave = () => {
    resetDragLatLng(); // 清除拖拽时的经纬度显示
    externalClearHighlight(); // 清除高亮
  };

  const handleClosePropertiesPanel = useCallback(() => {
    setSelectedModelInfo(null);
    clearGizmo(); // 关闭属性面板时也清除 Gizmo
    // 可选：如果希望清除模型颜色，需要额外逻辑
    // if (selectedModelInfo?.primitive) {
    //   selectedModelInfo.primitive.color = undefined; // 或者恢复原始颜色
    // }
  }, [clearGizmo]);


  const handleModelDragStart = (e: React.DragEvent, modelId: string) => {
    e.dataTransfer.setData('modelId', modelId);
  };

  const handleMaterialDragStart = (e: React.DragEvent, materialId: string) => {
    e.dataTransfer.setData('materialId', materialId);
  };

  return (
    <div style={{ height: '100vh', width: '100vw', background: '#fff', position: 'relative', overflow: 'hidden' }}>
      <Title level={3} style={{ position: 'absolute', zIndex: 10, left: 24, top: 16, userSelect: 'none' }}>
        独立场景编辑器 {sceneId ? `(ID: ${sceneId})` : ''}
      </Title>

      <div
        ref={cesiumContainerRef}
        style={{ width: '100%', height: '100%' }}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onMouseLeave={handleCesiumMouseLeave}
      />

      <AssetTabs
        models={models}
        loadingModels={loadingModels}
        materials={editorMaterials}
        onModelDragStart={handleModelDragStart}
        onMaterialDragStart={handleMaterialDragStart}
      />

      {dragLatLng && (
        <div style={{
          position: 'absolute',
          left: 16,
          bottom: '27%', // 调整位置，避免与 Tabs 重叠
          zIndex: 100,
          background: 'rgba(255,255,255,0.9)',
          padding: '4px 12px',
          borderRadius: 4,
          boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
          color: '#333',
          fontSize: 13,
          pointerEvents: 'none', // 避免干扰鼠标事件
        }}>
          经纬度：{dragLatLng.lon.toFixed(6)}, {dragLatLng.lat.toFixed(6)}
        </div>
      )}

      <SelectedModelPropertiesPanel
        selectedModelInfo={selectedModelInfo}
        onClose={handleClosePropertiesPanel}
      />
    </div>
  );
};

export default SceneEditorStandalone;