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
import { usePreviewMode } from '../../hooks/usePreviewMode';
import { useCesiumAnimation } from '../../hooks/useCesiumAnimation';

// Components
import { AssetTabs } from '../../components/AssetTabs.js';
import { SelectedModelPropertiesPanel } from '../../components/SelectedModelPropertiesPanel';
import { LayerDrawer, LayerInfo } from '../../components/LayerDrawer';
import { MenuOutlined, EyeOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import { getSceneDetail } from '../../services/sceneApi';
import { wmtsAPI } from '../../services/wmtsApi';

// 新组件
import SceneSidebar from '../../components/scenes/SceneSidebar';
import LoadingIndicator from '../../components/scenes/LoadingIndicator';
import { buildGoViewChartPreviewUrl } from '../../config/iframe';

// 常量
import { editorMaterials } from '../../constants/editorMaterials';

// 🆕 导入target路径解析工具
import { iotBindingAPI, TargetType } from '../../services/iotBindingApi';

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

  // 新增：IoT动画配置状态
  const [iotAnimationSettings, setIoTAnimationSettings] = useState({
    enableSmoothTransition: true,
    transitionDuration: 1.0,
    usePathAnimation: false,
    maxPathPoints: 10,
    clearCameraTracking: true
  });

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

  // WMTS图层加载函数
  const loadWMTSLayer = useCallback(async (wmtsId: string) => {
    try {
      console.log('开始加载WMTS图层:', wmtsId);
      
      // 获取WMTS图层详情
      const wmtsResponse = await wmtsAPI.getWMTSById(wmtsId);
      const wmtsData = wmtsResponse.data;
      
      if (wmtsData && viewerRef.current) {
        let imageryProvider;
        
        if (wmtsData.source_type === 'file' && wmtsData.tile_url_template) {
          // 对于文件类型的WMTS (tpkx)
          const minioUrl = import.meta.env.VITE_MINIO_URL || '';
          const tileUrl = `${minioUrl}${wmtsData.tile_url_template}`;
          
          imageryProvider = new Cesium.UrlTemplateImageryProvider({
            url: tileUrl,
            minimumLevel: wmtsData.min_zoom || 0,
            maximumLevel: wmtsData.max_zoom || 18,
            rectangle: wmtsData.bounds ? Cesium.Rectangle.fromDegrees(
              wmtsData.bounds.west,
              wmtsData.bounds.south,
              wmtsData.bounds.east,
              wmtsData.bounds.north
            ) : undefined
          });
        } else if (wmtsData.source_type === 'url' && wmtsData.service_url) {
          // 对于URL类型的WMTS服务
          let serviceUrl = wmtsData.service_url;
          
          // 如果是天地图服务，需要特殊处理
          if (serviceUrl.includes('tianditu.gov.cn')) {
            imageryProvider = new Cesium.WebMapTileServiceImageryProvider({
              url: serviceUrl,
              layer: wmtsData.layer_name || 'img', // 天地图默认使用img图层, 'vec' for vector
              style: 'default',
              format: wmtsData.format || 'image/png',
              tileMatrixSetID: wmtsData.tile_matrix_set || 'c', // 天地图wgs84
              maximumLevel: wmtsData.max_zoom || 18,
              minimumLevel: wmtsData.min_zoom || 0,
              subdomains: ['t0','t1','t2','t3','t4','t5','t6','t7'] //天地图负载均衡
            });
          } else {
            // 其他WMTS服务
            imageryProvider = new Cesium.WebMapTileServiceImageryProvider({
              url: serviceUrl,
              layer: wmtsData.layer_name || '',
              style: 'default',
              format: wmtsData.format || 'image/png',
              tileMatrixSetID: wmtsData.tile_matrix_set || 'GoogleMapsCompatible',
              maximumLevel: wmtsData.max_zoom || 18,
              minimumLevel: wmtsData.min_zoom || 0
            });
          }
        }
        
        if (imageryProvider) {
          // 清除现有的WMTS图层
          const imageryLayers = viewerRef.current.imageryLayers;
          for (let i = imageryLayers.length - 1; i >= 0; i--) {
            const layer = imageryLayers.get(i);
            if ((layer as any).wmtsId) {
              imageryLayers.remove(layer);
            }
          }
          
          // 添加新的WMTS图层
          const imageryLayer = imageryLayers.addImageryProvider(imageryProvider);
          (imageryLayer as any).wmtsId = wmtsId;
          (imageryLayer as any).wmtsName = wmtsData.name;
          
          console.log(`已加载WMTS图层: ${wmtsData.name}`);
        }
      }
    } catch (error) {
      console.error('加载WMTS图层失败:', error);
    }
  }, []);

  // WMTS图层加载
  useEffect(() => {
    if (sceneInfo?.data?.tiles_binding && viewerRef.current && !loadingInstances) {
      const { wmts_id, enabled } = sceneInfo.data.tiles_binding;
      
      if (enabled && wmts_id) {
        loadWMTSLayer(wmts_id);
      }
    }
  }, [sceneInfo, viewerRef, loadingInstances, loadWMTSLayer]);

  // Model Assets Hook
  const { models, loadingModels } = useModelAssets();

  // 获取公共模型数据
  const { publicModels} = usePublicModelAssets({
    pageSize: 40 // 默认一次加载更多公共模型
  });

  // 动画状态管理 Hook
  const { animationState, updateNodeTransform } = useCesiumAnimation(viewerRef, selectedInstanceId);

  // Selected Model State
  const [selectedModelInfo, setSelectedModelInfo] = useState<SelectedModelInfo | null>(null);
  
  // 实时变换状态，用于在gizmo操作过程中更新侧边栏
  const [realtimeTransform, setRealtimeTransform] = useState<{
    instanceId: string;
    transform: {
      location: number[];
      rotation: number[];
      scale: number[];
    };
  } | null>(null);
  
  // 处理实时变换更新
  const handleTransformUpdate = useCallback((instanceId: string, transform: {
    location: number[];
    rotation: number[];
    scale: number[];
  }) => {
    setRealtimeTransform({ instanceId, transform });
  }, []);

  // 清理实时变换状态的函数
  const clearRealtimeTransform = useCallback(() => {
    setRealtimeTransform(null);
  }, []);

  // Cesium Interactions Hook
  const { externalClearHighlight, clearGizmo } = useCesiumInteractions(
    viewerRef,
    setSelectedModelInfo,
    gizmoRef,
    setSelectedInstanceId,
    origin,
    sceneId,
    handleTransformUpdate,
    clearRealtimeTransform
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

  // 高斯泼溅拖拽
  const handleGaussianSplatDragStart = (e: React.DragEvent, splat: any) => {
    e.dataTransfer.setData('gaussianSplatId', splat.id);
    e.dataTransfer.setData('gaussianSplatData', JSON.stringify(splat));
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

  // 预览模式WebSocket连接管理
  const { 
    // isAnimationConnected, 
    // isIoTConnected, 
    // connectionError,
    // reconnect
  } = usePreviewMode({
    enabled: isPreviewMode,
    sceneId: sceneId || undefined, // 传递sceneId，处理null类型
    instanceId: selectedInstanceId || undefined, // 传递当前选中的实例ID，处理null类型
    viewerRef,
    // IoT动画配置
    iotAnimationConfig: iotAnimationSettings,
    onAnimationEvent: (event) => {
      console.log('接收到动画事件:', event);
    },
    onIoTDataUpdate: (data) => {
      console.log('接收到IoT数据更新:', data);
    },
    onInstanceUpdate: (instanceId, property, value) => {
      console.log('接收到实例更新:', { instanceId, property, value });
      
      // 🆕 确保selectedInstanceId被正确设置，以便动画系统能够工作
      if (instanceId !== 'scene' && instanceId !== selectedInstanceId) {
        console.log('🔄 设置selectedInstanceId为当前更新的实例:', { 
          oldSelectedInstanceId: selectedInstanceId, 
          newSelectedInstanceId: instanceId 
        });
        setSelectedInstanceId(instanceId);
      }
      
      // 更新Cesium中的3D模型实例
      if (viewerRef.current && viewerRef.current.scene) {
        const primitives = viewerRef.current.scene.primitives;
        
        // 处理场景级绑定 - 更新所有实例
        if (instanceId === 'scene') {
          console.log('场景级绑定，更新所有模型实例');
          
          // 对所有实例应用更新
          for (let i = 0; i < primitives.length; i++) {
            const primitive = primitives.get(i);
            
            // 检查是否是模型实例
            if (primitive && (primitive.id || (primitive as any).instanceId)) {
              const primitiveInstanceId = primitive.id || (primitive as any).instanceId;
              console.log('找到模型实例，正在更新属性:', { 
                primitiveId: primitiveInstanceId, 
                property, 
                value, 
                primitive 
              });
              
              // 🆕 应用属性更新，使用primitive的实例ID
              applyPropertyUpdate(primitive, property, value, primitiveInstanceId);
            }
          }
          return; // 场景级绑定处理完毕，提前返回
        }
        
        // 处理特定实例的绑定
        for (let i = 0; i < primitives.length; i++) {
          const primitive = primitives.get(i);
          
          // 检查是否是目标模型实例
          if (primitive.id === instanceId || (primitive as any).instanceId === instanceId) {
            console.log('找到模型实例，正在更新属性:', { instanceId, property, value, primitive });
            
            // 🆕 应用属性更新，传入实例ID
            applyPropertyUpdate(primitive, property, value, instanceId);
            break; // 找到目标实例后停止循环
          }
        }
      }
    }
  });

  // 抽取的属性更新函数
  const applyPropertyUpdate = (primitive: any, property: string, value: any, targetInstanceId: string) => {
    try {
      // 处理不同类型的属性更新
      switch (property) {
        case 'instance.transform.location':
          // 实例变换位置 - 目标绝对ENU坐标 (East-North-Up)
          if (Array.isArray(value) && value.length >= 3) {
            const [east, north, up] = value;
            
            if (primitive.modelMatrix) {
              // 使用平滑动画过渡设置目标位置
              updateModelPositionSmooth(primitive, east, north, up);
            }
          } else if (typeof value === 'object' && value !== null) {
            // 如果是对象格式的ENU位置 {x, y, z} 或 {east, north, up}
            let east, north, up;
            if ('east' in value && 'north' in value) {
              east = value.east;
              north = value.north;
              up = value.up || 0;
            } else if ('x' in value && 'y' in value) {
              east = value.x;
              north = value.y;
              up = value.z || 0;
            }
            
            if (east !== undefined && north !== undefined) {
              if (primitive.modelMatrix) {
                updateModelPositionSmooth(primitive, east, north, up);
              }
            }
          }
          break;
          
        case 'location':
        case 'position':
          // 绝对位置 - 使用经纬度坐标系
          if (Array.isArray(value) && value.length >= 3) {
            const [longitude, latitude, height] = value;
            updateModelPositionAbsolute(primitive, longitude, latitude, height);
          } else if (typeof value === 'object' && value !== null) {
            // 如果是对象格式的位置 {longitude, latitude, height}
            let longitude, latitude, height;
            if ('longitude' in value && 'latitude' in value) {
              longitude = value.longitude;
              latitude = value.latitude;
              height = value.height || 0;
            }
            
            if (longitude !== undefined && latitude !== undefined) {
              updateModelPositionAbsolute(primitive, longitude, latitude, height);
            }
          }
          break;
          
        case 'rotation':
          // 更新旋转
          if (Array.isArray(value) || (typeof value === 'object' && value !== null)) {
            updateModelRotation(primitive, value, iotAnimationSettings.enableSmoothTransition);
          }
          break;
          
        case 'scale':
          // 更新缩放
          if (Array.isArray(value) || typeof value === 'number' || (typeof value === 'object' && value !== null)) {
            updateModelScale(primitive, value, iotAnimationSettings.enableSmoothTransition);
          }
          break;
          
        case 'visibility':
        case 'visible':
          // 更新可见性
          if (primitive.show !== undefined) {
            primitive.show = Boolean(value);
            console.log('已更新模型可见性:', value);
          }
          break;

        // 🆕 材质属性
        case 'material.baseColor':
        case 'material.baseColorFactor':
          // 基础颜色更新
          if (typeof value === 'object' && value !== null && 'color' in value) {
            const materialIndex = value.materialIndex || 'all';
            updateModelMaterial(primitive, materialIndex, 'baseColor', value.color);
          } else {
            // 简化格式：直接传颜色值，应用到所有材质
            updateModelMaterial(primitive, 'all', 'baseColor', value);
          }
          break;

        case 'material.baseColorTexture':
          // 基础颜色贴图更新
          if (typeof value === 'object' && value !== null && 'texture' in value) {
            const materialIndex = value.materialIndex || 'all';
            updateModelMaterial(primitive, materialIndex, 'baseColorTexture', value.texture);
          } else {
            updateModelMaterial(primitive, 'all', 'baseColorTexture', value);
          }
          break;

        case 'material.metallicFactor':
          // 金属度因子更新
          if (typeof value === 'object' && value !== null && 'factor' in value) {
            const materialIndex = value.materialIndex || 'all';
            updateModelMaterial(primitive, materialIndex, 'metallicFactor', value.factor);
          } else {
            updateModelMaterial(primitive, 'all', 'metallicFactor', value);
          }
          break;

        case 'material.roughnessFactor':
          // 粗糙度因子更新
          if (typeof value === 'object' && value !== null && 'factor' in value) {
            const materialIndex = value.materialIndex || 'all';
            updateModelMaterial(primitive, materialIndex, 'roughnessFactor', value.factor);
          } else {
            updateModelMaterial(primitive, 'all', 'roughnessFactor', value);
          }
          break;

        case 'material.emissiveFactor':
          // 发射光因子更新
          if (typeof value === 'object' && value !== null && 'emissive' in value) {
            const materialIndex = value.materialIndex || 'all';
            updateModelMaterial(primitive, materialIndex, 'emissiveFactor', value.emissive);
          } else {
            updateModelMaterial(primitive, 'all', 'emissiveFactor', value);
          }
          break;

        case 'material.normalTexture':
          // 法线贴图更新
          if (typeof value === 'object' && value !== null && 'texture' in value) {
            const materialIndex = value.materialIndex || 'all';
            updateModelMaterial(primitive, materialIndex, 'normalTexture', value.texture);
          } else {
            updateModelMaterial(primitive, 'all', 'normalTexture', value);
          }
          break;

        case 'material.alphaMode':
          // Alpha模式更新
          if (typeof value === 'object' && value !== null && 'mode' in value) {
            const materialIndex = value.materialIndex || 'all';
            updateModelMaterial(primitive, materialIndex, 'alphaMode', value.mode);
          } else {
            updateModelMaterial(primitive, 'all', 'alphaMode', value);
          }
          break;

        case 'material.alphaCutoff':
          // Alpha裁剪值更新
          if (typeof value === 'object' && value !== null && 'cutoff' in value) {
            const materialIndex = value.materialIndex || 'all';
            updateModelMaterial(primitive, materialIndex, 'alphaCutoff', value.cutoff);
          } else {
            updateModelMaterial(primitive, 'all', 'alphaCutoff', value);
          }
          break;

        // 🆕 通用材质属性更新
        case 'material':
          // 通用材质更新：支持批量更新多个属性
          if (typeof value === 'object' && value !== null) {
            const materialIndex = value.materialIndex || 'all';
            
            // 遍历材质属性并更新
            Object.keys(value).forEach(key => {
              if (key !== 'materialIndex') {
                updateModelMaterial(primitive, materialIndex, key, value[key]);
              }
            });
          }
          break;
          
                 default:
           // 🆕 检查是否为新格式的节点属性：node.{nodeId}.{property} 或 node.{nodeId}
           if (property.startsWith('node.')) {
             const nodePropertyMatch = property.match(/^node\.([^.]+)(?:\.(.+))?$/);
             if (nodePropertyMatch) {
               const nodeId = nodePropertyMatch[1];
               const nodeProperty = nodePropertyMatch[2]; // 可能为 undefined（完整对象更新）
               
               console.log(`🎯 使用Animation系统处理节点属性: ${nodeId}.${nodeProperty || 'all'}`, value);
               
               try {
                 if (nodeProperty === 'translation' || nodeProperty === 'location') {
                   // 🆕 调用动画系统的节点更新函数，直接传入实例ID
                   updateNodeTransform(`node_${nodeId}`, { translation: value }, targetInstanceId);
                   console.log('✅ 节点位置更新成功:', value);
                 } else if (nodeProperty === 'rotation') {
                   updateNodeTransform(`node_${nodeId}`, { rotation: value }, targetInstanceId);
                   console.log('✅ 节点旋转更新成功:', value);
                 } else if (nodeProperty === 'scale') {
                   updateNodeTransform(`node_${nodeId}`, { scale: value }, targetInstanceId);
                   console.log('✅ 节点缩放更新成功:', value);
                 } else if (!nodeProperty) {
                   // 完整对象更新：node.{nodeId}
                   updateNodeTransform(`node_${nodeId}`, value, targetInstanceId);
                   console.log('✅ 节点完整更新成功:', value);
                 } else {
                   console.log('⚠️ 未知的节点属性:', { nodeId, nodeProperty, value });
                 }
               } catch (error) {
                 console.error('❌ 节点更新失败:', error);
               }
               
               return; // 处理完成，直接返回
             }
           }
           
           console.log('不支持的属性类型:', property);
      }
      
      // 触发场景重绘 (如果有viewer引用)
      if (viewerRef?.current?.scene) {
        viewerRef.current.scene.requestRender();
      }
      
    } catch (error) {
      console.error('更新模型属性失败:', error);
    }
  };



  // 🔧 修复：直接位置更新函数（处理绝对目标位置，修复ENU方向问题）
  const updateModelPositionDirect = useCallback((primitive: any, east: number, north: number, up: number) => {
    if (!primitive.modelMatrix) return;
    
    try {
      // 获取当前模型矩阵的缩放（保持不变）
      const currentMatrix = primitive.modelMatrix.clone();
      const scale = Cesium.Matrix4.getScale(currentMatrix, new Cesium.Cartesian3());
      
      // 🔧 关键修复：正确处理ENU坐标系方向
      // 1. 确保有场景原点信息
      if (!origin) {
        console.warn('缺少场景原点信息，无法正确处理ENU坐标');
        return;
      }
      
      // 2. 创建场景原点的ENU变换矩阵
      const originCartesian = Cesium.Cartesian3.fromDegrees(
        origin.longitude, 
        origin.latitude, 
        origin.height || 0
      );
      const enuMatrix = Cesium.Transforms.eastNorthUpToFixedFrame(originCartesian);
      
      // 3. 创建目标ENU局部坐标（这是绝对位置，不是偏移量）
      const targetLocalPosition = new Cesium.Cartesian3(east, north, up);
      
      // 4. 将目标ENU坐标转换为世界坐标
      const targetWorldPosition = new Cesium.Cartesian3();
      Cesium.Matrix4.multiplyByPoint(enuMatrix, targetLocalPosition, targetWorldPosition);
      
      // 5. 构建新的模型矩阵（与模型加载时完全一致的方式）
      let newMatrix = Cesium.Transforms.eastNorthUpToFixedFrame(targetWorldPosition);
      
      // 🔧 关键修复：使用存储的原始HPR角度或保持默认方向
      // 检查是否有存储的原始旋转数据
      if (primitive.originalRotation) {
        // 使用原始的HPR角度重新应用旋转（与模型加载时相同的方式）
        const { heading, pitch, roll } = primitive.originalRotation;
        const hpr = new Cesium.HeadingPitchRoll(heading, pitch, roll);
        const rotationMatrix = Cesium.Matrix3.fromHeadingPitchRoll(hpr);
        const rotationMatrix4 = Cesium.Matrix4.fromRotation(rotationMatrix);
        
        // 应用旋转（与模型加载时相同的方式）
        const rotatedMatrix = new Cesium.Matrix4();
        Cesium.Matrix4.multiply(newMatrix, rotationMatrix4, rotatedMatrix);
        newMatrix = rotatedMatrix;
        
        console.log('使用原始HPR角度:', { heading, pitch, roll });
      } else {
        // 如果没有原始旋转数据，尝试从当前位置计算相对旋转
        // 这是一个简化的处理，可能需要更复杂的坐标系转换
        console.warn('缺少原始旋转数据，保持ENU坐标系默认方向');
      }
      
      // 6. 应用缩放
      Cesium.Matrix4.multiplyByScale(newMatrix, scale, newMatrix);
      
      primitive.modelMatrix = newMatrix;
      console.log('已直接更新模型位置 (绝对ENU坐标，修复方向):', { 
        targetENU: { east, north, up },
        targetWorld: targetWorldPosition,
        hasOriginalRotation: !!primitive.originalRotation
      });
      
    } catch (error) {
      console.error('直接位置更新失败:', error);
    }
  }, [origin]);

  // 新增：平滑位置更新函数
  const updateModelPositionSmooth = useCallback((primitive: any, east: number, north: number, up: number) => {
    if (!primitive.modelMatrix) return;
    
    // 使用当前的动画配置
    const animationConfig = iotAnimationSettings;
    
    // 如果禁用了平滑过渡，直接更新
    if (!animationConfig.enableSmoothTransition) {
      updateModelPositionDirect(primitive, east, north, up);
      return;
    }
     
     try {
       // 获取当前模型矩阵的缩放（保持不变）
       const currentMatrix = primitive.modelMatrix.clone();
       const scale = Cesium.Matrix4.getScale(currentMatrix, new Cesium.Cartesian3());
       
       // 获取当前世界位置（用于动画起点）
       const currentTranslation = Cesium.Matrix4.getTranslation(currentMatrix, new Cesium.Cartesian3());
       
       // 🔧 修复：将IoT数据作为目标绝对ENU坐标处理
       // 1. 确保有场景原点信息
       if (!origin) {
         console.warn('缺少场景原点信息，无法正确处理ENU坐标');
         updateModelPositionDirect(primitive, east, north, up);
         return;
       }
       
       // 2. 创建场景原点的ENU变换矩阵
       const originCartesian = Cesium.Cartesian3.fromDegrees(
         origin.longitude, 
         origin.latitude, 
         origin.height || 0
       );
       const enuMatrix = Cesium.Transforms.eastNorthUpToFixedFrame(originCartesian);
       
       // 3. 创建目标ENU局部坐标（这是绝对位置，不是偏移量）
       const targetLocalPosition = new Cesium.Cartesian3(east, north, up);
       
       // 4. 将目标ENU坐标转换为世界坐标
       const targetWorldPosition = new Cesium.Cartesian3();
       Cesium.Matrix4.multiplyByPoint(enuMatrix, targetLocalPosition, targetWorldPosition);
       
       // 使用Cesium的插值动画
       if (viewerRef.current) {
         const viewer = viewerRef.current;
         
         // 如果启用了相机跟踪清除，确保相机不会跟踪任何实体
         if (animationConfig.clearCameraTracking && viewer.trackedEntity) {
           viewer.trackedEntity = undefined;
           console.log('已清除相机跟踪实体，防止相机跳转');
         }
         
         const startTime = viewer.clock.currentTime.clone();
         const endTime = Cesium.JulianDate.addSeconds(startTime, animationConfig.transitionDuration, new Cesium.JulianDate());
        
        // 创建位置插值属性
        const positionProperty = new Cesium.SampledPositionProperty();
        positionProperty.addSample(startTime, currentTranslation);
        positionProperty.addSample(endTime, targetWorldPosition);
        
        // 设置插值算法
        positionProperty.setInterpolationOptions({
          interpolationDegree: 2,
          interpolationAlgorithm: Cesium.LagrangePolynomialApproximation
        });
        
                 // 启动动画更新
         const animationStartTime = performance.now();
         const animateTo = () => {
           const elapsed = (performance.now() - animationStartTime) / 1000.0;
           const progress = Math.min(elapsed / animationConfig.transitionDuration, 1.0);
          
          if (progress < 1.0) {
            // 插值计算当前位置
            const currentTime = Cesium.JulianDate.addSeconds(startTime, elapsed, new Cesium.JulianDate());
            const interpolatedPosition = positionProperty.getValue(currentTime);
            
            if (interpolatedPosition) {
              // 🔧 关键修复：构建新的模型矩阵时使用原始旋转数据
              let newMatrix = Cesium.Transforms.eastNorthUpToFixedFrame(interpolatedPosition);
              
              // 使用保存的原始旋转数据，而不是从当前矩阵提取的旋转
              if (primitive.originalRotation) {
                const { heading, pitch, roll } = primitive.originalRotation;
                const hpr = new Cesium.HeadingPitchRoll(heading, pitch, roll);
                const rotationMatrix = Cesium.Matrix3.fromHeadingPitchRoll(hpr);
                const rotationMatrix4 = Cesium.Matrix4.fromRotation(rotationMatrix);
                
                const rotatedMatrix = new Cesium.Matrix4();
                Cesium.Matrix4.multiply(newMatrix, rotationMatrix4, rotatedMatrix);
                newMatrix = rotatedMatrix;
              }
              
              Cesium.Matrix4.multiplyByScale(newMatrix, scale, newMatrix);
              
              primitive.modelMatrix = newMatrix;
              viewer.scene.requestRender();
            }
            
            // 继续动画
            requestAnimationFrame(animateTo);
          } else {
            // 🔧 关键修复：动画完成，设置最终位置时使用原始旋转数据
            let newMatrix = Cesium.Transforms.eastNorthUpToFixedFrame(targetWorldPosition);
            
            // 使用保存的原始旋转数据，而不是从当前矩阵提取的旋转
            if (primitive.originalRotation) {
              const { heading, pitch, roll } = primitive.originalRotation;
              const hpr = new Cesium.HeadingPitchRoll(heading, pitch, roll);
              const rotationMatrix = Cesium.Matrix3.fromHeadingPitchRoll(hpr);
              const rotationMatrix4 = Cesium.Matrix4.fromRotation(rotationMatrix);
              
              const rotatedMatrix = new Cesium.Matrix4();
              Cesium.Matrix4.multiply(newMatrix, rotationMatrix4, rotatedMatrix);
              newMatrix = rotatedMatrix;
            }
            
            Cesium.Matrix4.multiplyByScale(newMatrix, scale, newMatrix);
            
            primitive.modelMatrix = newMatrix;
            viewer.scene.requestRender();
            
            console.log('已平滑更新模型位置 (绝对ENU坐标，修复方向):', { 
              targetENU: { east, north, up },
              targetWorld: targetWorldPosition,
              hasOriginalRotation: !!primitive.originalRotation
            });
          }
        };
        
        // 开始动画
        requestAnimationFrame(animateTo);
             } else {
         // 如果没有viewer，使用直接更新（兜底方案）
         updateModelPositionDirect(primitive, east, north, up);
       }
      
         } catch (error) {
       console.error('平滑位置更新失败:', error);
       // 降级到直接更新（使用正确的ENU坐标处理）
       updateModelPositionDirect(primitive, east, north, up);
     }
     }, [viewerRef, origin, iotAnimationSettings]);

   // 新增：绝对位置更新函数
  const updateModelPositionAbsolute = useCallback((primitive: any, longitude: number, latitude: number, height: number) => {
    if (!primitive.modelMatrix) return;
    
    try {
      const cartesian = Cesium.Cartesian3.fromDegrees(longitude, latitude, height);
      
      // 获取当前模型矩阵的缩放和旋转
      const currentMatrix = primitive.modelMatrix.clone();
      const scale = Cesium.Matrix4.getScale(currentMatrix, new Cesium.Cartesian3());
      const rotation = Cesium.Matrix4.getRotation(currentMatrix, new Cesium.Matrix3());
      
      const newMatrix = Cesium.Transforms.eastNorthUpToFixedFrame(cartesian);
      Cesium.Matrix4.multiplyByMatrix3(newMatrix, rotation, newMatrix);
      Cesium.Matrix4.multiplyByScale(newMatrix, scale, newMatrix);
      
      primitive.modelMatrix = newMatrix;
      console.log('已更新模型位置 (经纬度):', { longitude, latitude, height });
      
    } catch (error) {
      console.error('绝对位置更新失败:', error);
    }
  }, []);

  // 🔧 扩展：旋转更新函数（支持多种格式和平滑插值）
  const updateModelRotation = useCallback((primitive: any, rotation: any, smooth: boolean = false) => {
    if (!primitive.modelMatrix) return;
    
    try {
      let hpr: Cesium.HeadingPitchRoll;
      
      // 解析不同格式的旋转数据
      if (Array.isArray(rotation)) {
        if (rotation.length === 3) {
          // 欧拉角格式 [heading, pitch, roll] 或 [yaw, pitch, roll]
          hpr = new Cesium.HeadingPitchRoll(
            Cesium.Math.toRadians(rotation[0] || 0), // heading/yaw
            Cesium.Math.toRadians(rotation[1] || 0), // pitch
            Cesium.Math.toRadians(rotation[2] || 0)  // roll
          );
        } else if (rotation.length === 4) {
          // 四元数格式 [x, y, z, w]
          const quaternion = new Cesium.Quaternion(rotation[0], rotation[1], rotation[2], rotation[3]);
          hpr = Cesium.HeadingPitchRoll.fromQuaternion(quaternion);
        } else {
          throw new Error(`不支持的旋转数组长度: ${rotation.length}`);
        }
      } else if (typeof rotation === 'object' && rotation !== null) {
        if ('heading' in rotation && 'pitch' in rotation && 'roll' in rotation) {
          // HPR对象格式
          hpr = new Cesium.HeadingPitchRoll(
            Cesium.Math.toRadians(rotation.heading || 0),
            Cesium.Math.toRadians(rotation.pitch || 0),
            Cesium.Math.toRadians(rotation.roll || 0)
          );
        } else if ('yaw' in rotation && 'pitch' in rotation && 'roll' in rotation) {
          // YPR对象格式
          hpr = new Cesium.HeadingPitchRoll(
            Cesium.Math.toRadians(rotation.yaw || 0),
            Cesium.Math.toRadians(rotation.pitch || 0),
            Cesium.Math.toRadians(rotation.roll || 0)
          );
        } else if ('x' in rotation && 'y' in rotation && 'z' in rotation && 'w' in rotation) {
          // 四元数对象格式
          const quaternion = new Cesium.Quaternion(rotation.x, rotation.y, rotation.z, rotation.w);
          hpr = Cesium.HeadingPitchRoll.fromQuaternion(quaternion);
        } else {
          throw new Error('不支持的旋转对象格式');
        }
      } else {
        throw new Error('不支持的旋转数据类型');
      }
      
      // 获取当前矩阵的位置和缩放
      const currentMatrix = primitive.modelMatrix.clone();
      const translation = Cesium.Matrix4.getTranslation(currentMatrix, new Cesium.Cartesian3());
      const scale = Cesium.Matrix4.getScale(currentMatrix, new Cesium.Cartesian3());
      
      if (smooth && viewerRef.current && iotAnimationSettings.enableSmoothTransition) {
        // 平滑旋转插值
        updateModelRotationSmooth(primitive, translation, scale, hpr);
      } else {
        // 直接旋转更新
        updateModelRotationDirect(primitive, translation, scale, hpr);
      }
      
    } catch (error) {
      console.error('旋转更新失败:', error);
    }
  }, [viewerRef, iotAnimationSettings]);

  // 直接旋转更新函数
  const updateModelRotationDirect = useCallback((primitive: any, translation: Cesium.Cartesian3, scale: Cesium.Cartesian3, hpr: Cesium.HeadingPitchRoll) => {
    try {
      const newMatrix = Cesium.Transforms.eastNorthUpToFixedFrame(translation);
      const rotationMatrix = Cesium.Matrix3.fromHeadingPitchRoll(hpr);
      Cesium.Matrix4.multiplyByMatrix3(newMatrix, rotationMatrix, newMatrix);
      Cesium.Matrix4.multiplyByScale(newMatrix, scale, newMatrix);
      
      primitive.modelMatrix = newMatrix;
      
      // 更新存储的原始旋转数据
      if (primitive.originalRotation) {
        primitive.originalRotation = {
          heading: hpr.heading,
          pitch: hpr.pitch,
          roll: hpr.roll
        };
      }
      
      const degrees = {
        heading: Cesium.Math.toDegrees(hpr.heading),
        pitch: Cesium.Math.toDegrees(hpr.pitch),
        roll: Cesium.Math.toDegrees(hpr.roll)
      };
      
      console.log('已直接更新模型旋转:', degrees);
      
    } catch (error) {
      console.error('直接旋转更新失败:', error);
    }
  }, []);

  // 平滑旋转更新函数
  const updateModelRotationSmooth = useCallback((primitive: any, translation: Cesium.Cartesian3, scale: Cesium.Cartesian3, targetHpr: Cesium.HeadingPitchRoll) => {
    if (!viewerRef.current) {
      updateModelRotationDirect(primitive, translation, scale, targetHpr);
      return;
    }
    
    try {
      const viewer = viewerRef.current;
      const animationConfig = iotAnimationSettings;
      
      // 获取当前旋转
      const currentMatrix = primitive.modelMatrix.clone();
      const currentRotation = Cesium.Matrix4.getRotation(currentMatrix, new Cesium.Matrix3());
      const currentHpr = Cesium.HeadingPitchRoll.fromQuaternion(
        Cesium.Quaternion.fromRotationMatrix(currentRotation)
      );
      
      // 创建旋转插值
      const startTime = viewer.clock.currentTime.clone();
      const endTime = Cesium.JulianDate.addSeconds(startTime, animationConfig.transitionDuration, new Cesium.JulianDate());
      
      // 使用SLERP进行平滑旋转插值
      const startQuaternion = Cesium.Quaternion.fromHeadingPitchRoll(currentHpr);
      const endQuaternion = Cesium.Quaternion.fromHeadingPitchRoll(targetHpr);
      
      const animationStartTime = performance.now();
      const animateRotation = () => {
        const elapsed = (performance.now() - animationStartTime) / 1000.0;
        const progress = Math.min(elapsed / animationConfig.transitionDuration, 1.0);
        
        if (progress < 1.0) {
          // 球面线性插值
          const interpolatedQuaternion = new Cesium.Quaternion();
          Cesium.Quaternion.slerp(startQuaternion, endQuaternion, progress, interpolatedQuaternion);
          
          // 转换回HPR
          const interpolatedHpr = Cesium.HeadingPitchRoll.fromQuaternion(interpolatedQuaternion);
          
          // 应用插值旋转
          const newMatrix = Cesium.Transforms.eastNorthUpToFixedFrame(translation);
          const rotationMatrix = Cesium.Matrix3.fromHeadingPitchRoll(interpolatedHpr);
          Cesium.Matrix4.multiplyByMatrix3(newMatrix, rotationMatrix, newMatrix);
          Cesium.Matrix4.multiplyByScale(newMatrix, scale, newMatrix);
          
          primitive.modelMatrix = newMatrix;
          viewer.scene.requestRender();
          
          requestAnimationFrame(animateRotation);
        } else {
          // 动画完成，设置最终旋转
          updateModelRotationDirect(primitive, translation, scale, targetHpr);
          
          console.log('已平滑更新模型旋转 (SLERP插值):', {
            targetDegrees: {
              heading: Cesium.Math.toDegrees(targetHpr.heading),
              pitch: Cesium.Math.toDegrees(targetHpr.pitch),
              roll: Cesium.Math.toDegrees(targetHpr.roll)
            }
          });
        }
      };
      
      requestAnimationFrame(animateRotation);
      
    } catch (error) {
      console.error('平滑旋转更新失败:', error);
      updateModelRotationDirect(primitive, translation, scale, targetHpr);
    }
  }, [viewerRef, iotAnimationSettings, updateModelRotationDirect]);

  // 🔧 扩展：缩放更新函数（支持多种格式和平滑插值）
  const updateModelScale = useCallback((primitive: any, scale: any, smooth: boolean = false) => {
    if (!primitive.modelMatrix) return;
    
    try {
      let scaleVector: Cesium.Cartesian3;
      
      // 解析不同格式的缩放数据
      if (typeof scale === 'number') {
        // 统一缩放
        scaleVector = new Cesium.Cartesian3(scale, scale, scale);
      } else if (Array.isArray(scale)) {
        if (scale.length === 1) {
          // 统一缩放数组格式 [scale]
          scaleVector = new Cesium.Cartesian3(scale[0], scale[0], scale[0]);
        } else if (scale.length >= 3) {
          // 各轴独立缩放 [x, y, z]
          scaleVector = new Cesium.Cartesian3(
            scale[0] || 1,
            scale[1] || 1,
            scale[2] || 1
          );
        } else {
          throw new Error(`不支持的缩放数组长度: ${scale.length}`);
        }
      } else if (typeof scale === 'object' && scale !== null) {
        if ('x' in scale && 'y' in scale && 'z' in scale) {
          // 对象格式 {x, y, z}
          scaleVector = new Cesium.Cartesian3(
            scale.x || 1,
            scale.y || 1,
            scale.z || 1
          );
        } else if ('uniform' in scale) {
          // 统一缩放对象格式 {uniform: number}
          scaleVector = new Cesium.Cartesian3(scale.uniform, scale.uniform, scale.uniform);
        } else {
          throw new Error('不支持的缩放对象格式');
        }
      } else {
        throw new Error('不支持的缩放数据类型');
      }
      
      // 获取当前矩阵的位置和旋转
      const currentMatrix = primitive.modelMatrix.clone();
      const translation = Cesium.Matrix4.getTranslation(currentMatrix, new Cesium.Cartesian3());
      
      // 🔧 修复：使用原始旋转数据而不是提取的旋转矩阵
      if (smooth && viewerRef.current && iotAnimationSettings.enableSmoothTransition) {
        // 平滑缩放插值
        updateModelScaleSmooth(primitive, translation, scaleVector);
      } else {
        // 直接缩放更新
        updateModelScaleDirect(primitive, translation, scaleVector);
      }
      
    } catch (error) {
      console.error('缩放更新失败:', error);
    }
  }, [viewerRef, iotAnimationSettings]);

  // 直接缩放更新函数
  const updateModelScaleDirect = useCallback((primitive: any, translation: Cesium.Cartesian3, scaleVector: Cesium.Cartesian3) => {
    try {
      let newMatrix = Cesium.Transforms.eastNorthUpToFixedFrame(translation);
      
      // 🔧 使用原始旋转数据
      if (primitive.originalRotation) {
        const { heading, pitch, roll } = primitive.originalRotation;
        const hpr = new Cesium.HeadingPitchRoll(heading, pitch, roll);
        const rotationMatrix = Cesium.Matrix3.fromHeadingPitchRoll(hpr);
        const rotationMatrix4 = Cesium.Matrix4.fromRotation(rotationMatrix);
        
        const rotatedMatrix = new Cesium.Matrix4();
        Cesium.Matrix4.multiply(newMatrix, rotationMatrix4, rotatedMatrix);
        newMatrix = rotatedMatrix;
      }
      
      Cesium.Matrix4.multiplyByScale(newMatrix, scaleVector, newMatrix);
      
      primitive.modelMatrix = newMatrix;
      console.log('已直接更新模型缩放:', { 
        scaleX: scaleVector.x, 
        scaleY: scaleVector.y, 
        scaleZ: scaleVector.z 
      });
      
    } catch (error) {
      console.error('直接缩放更新失败:', error);
    }
  }, []);

  // 平滑缩放更新函数
  const updateModelScaleSmooth = useCallback((primitive: any, translation: Cesium.Cartesian3, targetScale: Cesium.Cartesian3) => {
    if (!viewerRef.current) {
      updateModelScaleDirect(primitive, translation, targetScale);
      return;
    }
    
    try {
      const viewer = viewerRef.current;
      const animationConfig = iotAnimationSettings;
      
      // 获取当前缩放
      const currentMatrix = primitive.modelMatrix.clone();
      const currentScale = Cesium.Matrix4.getScale(currentMatrix, new Cesium.Cartesian3());
      
      const animationStartTime = performance.now();
      const animateScale = () => {
        const elapsed = (performance.now() - animationStartTime) / 1000.0;
        const progress = Math.min(elapsed / animationConfig.transitionDuration, 1.0);
        
        if (progress < 1.0) {
          // 线性插值缩放
          const interpolatedScale = new Cesium.Cartesian3();
          Cesium.Cartesian3.lerp(currentScale, targetScale, progress, interpolatedScale);
          
          // 应用插值缩放
          let newMatrix = Cesium.Transforms.eastNorthUpToFixedFrame(translation);
          
          // 🔧 使用原始旋转数据
          if (primitive.originalRotation) {
            const { heading, pitch, roll } = primitive.originalRotation;
            const hpr = new Cesium.HeadingPitchRoll(heading, pitch, roll);
            const rotationMatrix = Cesium.Matrix3.fromHeadingPitchRoll(hpr);
            const rotationMatrix4 = Cesium.Matrix4.fromRotation(rotationMatrix);
            
            const rotatedMatrix = new Cesium.Matrix4();
            Cesium.Matrix4.multiply(newMatrix, rotationMatrix4, rotatedMatrix);
            newMatrix = rotatedMatrix;
          }
          
          Cesium.Matrix4.multiplyByScale(newMatrix, interpolatedScale, newMatrix);
          
          primitive.modelMatrix = newMatrix;
          viewer.scene.requestRender();
          
          requestAnimationFrame(animateScale);
        } else {
          // 动画完成，设置最终缩放
          updateModelScaleDirect(primitive, translation, targetScale);
          
          console.log('已平滑更新模型缩放 (线性插值):', {
            targetScale: {
              x: targetScale.x,
              y: targetScale.y,
              z: targetScale.z
            }
          });
        }
      };
      
      requestAnimationFrame(animateScale);
      
    } catch (error) {
      console.error('平滑缩放更新失败:', error);
      updateModelScaleDirect(primitive, translation, targetScale);
    }
  }, [viewerRef, iotAnimationSettings, updateModelScaleDirect]);

  // 🆕 模型状态检查辅助函数
  
  /**
   * 🆕 检查模型是否已准备好进行节点操作
   * @param primitive 模型原语
   * @returns 是否准备好
   */
  const isModelReady = useCallback((primitive: any): boolean => {
    if (!primitive) return false;
    
    // 检查模型对象是否存在
    const hasModel = !!(primitive._model || primitive.model || primitive._gltf);
    
    // 检查加载状态
    const isLoaded = primitive.loaded !== false; // 默认为true，除非明确为false
    
    // 检查是否有readyPromise且已resolved
    const hasReadyPromise = !!primitive.readyPromise;
    
    if (hasModel && isLoaded) {
      // 进一步检查节点数据是否可用
      let model = primitive._model || primitive.model || { gltf: primitive._gltf };
      const hasNodes = !!(model.gltf && model.gltf.nodes);
      
      return hasNodes;
    }
    
    return false;
  }, []);

  /**
   * 🆕 等待模型准备就绪
   * @param primitive 模型原语
   * @param maxWaitTime 最大等待时间（毫秒）
   * @returns Promise
   */
  const waitForModelReady = useCallback((primitive: any, maxWaitTime: number = 5000): Promise<void> => {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      
      const checkReady = () => {
        if (isModelReady(primitive)) {
          resolve();
          return;
        }
        
        // 检查是否超时
        if (Date.now() - startTime > maxWaitTime) {
          reject(new Error(`模型加载超时 (${maxWaitTime}ms)`));
          return;
        }
        
        // 如果有readyPromise，等待它
        if (primitive.readyPromise) {
          primitive.readyPromise.then(() => {
            // readyPromise resolved后再次检查
            if (isModelReady(primitive)) {
              resolve();
            } else {
              // 如果还没准备好，继续轮询
              setTimeout(checkReady, 100);
            }
          }).catch((error: any) => {
            reject(new Error(`模型readyPromise失败: ${error.message}`));
          });
        } else {
          // 没有readyPromise，使用轮询
          setTimeout(checkReady, 100);
        }
      };
      
      checkReady();
    });
  }, [isModelReady]);

  // 🆕 骨骼节点变换更新功能
  
  /**
   * 查找模型中的节点
   * @param primitive 模型原语
   * @param nodeId 节点ID或索引或名称（兼容性）
   * @returns 找到的节点对象
   */
  const findModelNode = useCallback((primitive: any, nodeId: string | number): any => {
    try {
      // 🔧 增强模型状态检查
      if (!primitive) {
        console.warn('primitive对象不存在');
        return null;
      }
      
      // 检查多种可能的模型对象路径
      let model = null;
      
      if (primitive._model) {
        model = primitive._model;
      } else if (primitive.model) {
        model = primitive.model;
      } else if (primitive._gltf) {
        model = { gltf: primitive._gltf };
      } else {
        console.warn('模型对象不存在，可能模型还未完全加载', {
          primitiveType: primitive.constructor?.name,
          hasModel: !!primitive._model,
          hasGltf: !!primitive._gltf,
          hasLoaded: primitive.loaded,
          readyPromise: !!primitive.readyPromise
        });
        return null;
      }
      
      // 检查是否有节点集合
      if (!model.gltf || !model.gltf.nodes) {
        console.warn('模型没有节点信息', {
          hasGltf: !!model.gltf,
          hasNodes: !!(model.gltf && model.gltf.nodes),
          modelKeys: Object.keys(model)
        });
        return null;
      }
      
      const nodes = model.gltf.nodes;
      
      if (typeof nodeId === 'number') {
        // 按索引查找
        if (nodeId >= 0 && nodeId < nodes.length) {
          return {
            node: nodes[nodeId],
            index: nodeId,
            model: model
          };
        }
      } else if (typeof nodeId === 'string') {
        // 优先按ID查找，然后按名称查找（兼容性）
        for (let i = 0; i < nodes.length; i++) {
          const node = nodes[i];
          // 首先尝试匹配ID
          if (node.id === nodeId) {
            return {
              node: node,
              index: i,
              model: model
            };
          }
        }
        
        // 如果没有找到ID匹配，尝试名称匹配（向后兼容）
        for (let i = 0; i < nodes.length; i++) {
          const node = nodes[i];
          if (node.name === nodeId) {
            console.warn(`节点 '${nodeId}' 通过名称找到，建议使用节点ID`);
            return {
              node: node,
              index: i,
              model: model
            };
          }
        }
      }
      
      console.warn(`未找到节点: ${nodeId}`);
      return null;
      
    } catch (error) {
      console.error('查找模型节点失败:', error);
      return null;
    }
  }, []);

  /**
   * 更新模型节点的变换
   * @param primitive 模型原语
   * @param nodeId 节点ID或索引
   * @param property 变换属性 ('location', 'rotation', 'scale')
   * @param value 新的变换值
   * @param smooth 是否使用平滑过渡
   */
  const updateModelNodeTransform = useCallback((primitive: any, nodeId: string | number, property: 'location' | 'rotation' | 'scale', value: any, smooth: boolean = false) => {
    try {
      const nodeInfo = findModelNode(primitive, nodeId);
      if (!nodeInfo) {
        return;
      }
      
      const { node, index, model } = nodeInfo;
      
      console.log(`更新节点变换 [${nodeId}] ${property}:`, value);
      
      // 确保节点有变换信息
      if (!node.matrix && !node.translation && !node.rotation && !node.scale) {
        // 初始化节点变换
        node.translation = [0, 0, 0];
        node.rotation = [0, 0, 0, 1]; // 四元数格式
        node.scale = [1, 1, 1];
      }
      
      switch (property) {
        case 'location':
          updateNodeLocation(node, value, smooth);
          break;
        case 'rotation':
          updateNodeRotation(node, value, smooth);
          break;
        case 'scale':
          updateNodeScale(node, value, smooth);
          break;
        default:
          console.warn(`不支持的节点变换属性: ${property}`);
          return;
      }
      
      // 标记模型需要更新
      if (model.dirty !== undefined) {
        model.dirty = true;
      }
      
      // 请求场景重绘
      if (viewerRef?.current?.scene) {
        viewerRef.current.scene.requestRender();
      }
      
    } catch (error) {
      console.error('更新模型节点变换失败:', error);
    }
  }, [findModelNode, viewerRef]);

  /**
   * 更新节点位置
   */
  const updateNodeLocation = useCallback((node: any, location: any, smooth: boolean) => {
    let locationArray: number[];
    
    if (Array.isArray(location) && location.length >= 3) {
      locationArray = [location[0], location[1], location[2]];
    } else if (typeof location === 'object' && location !== null) {
      if ('x' in location && 'y' in location && 'z' in location) {
        locationArray = [location.x, location.y, location.z];
      } else {
        throw new Error('不支持的位置对象格式');
      }
    } else {
      throw new Error('不支持的位置数据类型');
    }
    
    if (smooth && iotAnimationSettings.enableSmoothTransition) {
      // TODO: 实现节点位置平滑插值
      node.translation = locationArray;
    } else {
      node.translation = locationArray;
    }
    
    console.log('已更新节点位置:', locationArray);
  }, [iotAnimationSettings]);

  /**
   * 更新节点旋转
   */
  const updateNodeRotation = useCallback((node: any, rotation: any, smooth: boolean) => {
    let rotationArray: number[];
    
    if (Array.isArray(rotation)) {
      if (rotation.length === 3) {
        // 欧拉角转换为四元数
        const hpr = new Cesium.HeadingPitchRoll(
          Cesium.Math.toRadians(rotation[0]),
          Cesium.Math.toRadians(rotation[1]),
          Cesium.Math.toRadians(rotation[2])
        );
        const quaternion = Cesium.Quaternion.fromHeadingPitchRoll(hpr);
        rotationArray = [quaternion.x, quaternion.y, quaternion.z, quaternion.w];
      } else if (rotation.length === 4) {
        // 四元数格式
        rotationArray = [rotation[0], rotation[1], rotation[2], rotation[3]];
      } else {
        throw new Error(`不支持的旋转数组长度: ${rotation.length}`);
      }
    } else if (typeof rotation === 'object' && rotation !== null) {
      if ('x' in rotation && 'y' in rotation && 'z' in rotation && 'w' in rotation) {
        rotationArray = [rotation.x, rotation.y, rotation.z, rotation.w];
      } else {
        throw new Error('不支持的旋转对象格式');
      }
    } else {
      throw new Error('不支持的旋转数据类型');
    }
    
    if (smooth && iotAnimationSettings.enableSmoothTransition) {
      // TODO: 实现节点旋转平滑插值（SLERP）
      node.rotation = rotationArray;
    } else {
      node.rotation = rotationArray;
    }
    
    console.log('已更新节点旋转:', rotationArray);
  }, [iotAnimationSettings]);

  /**
   * 更新节点缩放
   */
  const updateNodeScale = useCallback((node: any, scale: any, smooth: boolean) => {
    let scaleArray: number[];
    
    if (typeof scale === 'number') {
      scaleArray = [scale, scale, scale];
    } else if (Array.isArray(scale)) {
      if (scale.length === 1) {
        scaleArray = [scale[0], scale[0], scale[0]];
      } else if (scale.length >= 3) {
        scaleArray = [scale[0], scale[1], scale[2]];
      } else {
        throw new Error(`不支持的缩放数组长度: ${scale.length}`);
      }
    } else if (typeof scale === 'object' && scale !== null) {
      if ('x' in scale && 'y' in scale && 'z' in scale) {
        scaleArray = [scale.x, scale.y, scale.z];
      } else if ('uniform' in scale) {
        scaleArray = [scale.uniform, scale.uniform, scale.uniform];
      } else {
        throw new Error('不支持的缩放对象格式');
      }
    } else {
      throw new Error('不支持的缩放数据类型');
    }
    
    if (smooth && iotAnimationSettings.enableSmoothTransition) {
      // TODO: 实现节点缩放平滑插值
      node.scale = scaleArray;
    } else {
      node.scale = scaleArray;
    }
    
    console.log('已更新节点缩放:', scaleArray);
  }, [iotAnimationSettings]);

  /**
   * 🆕 处理新格式的节点属性更新
   * @param primitive 模型原语
   * @param nodeId 节点ID
   * @param nodeProperty 节点属性 ('location', 'rotation', 'scale') 或 undefined（完整对象）
   * @param value 属性值
   */
  const handleNodePropertyUpdate = useCallback((primitive: any, nodeId: string, nodeProperty: string | undefined, value: any) => {
    try {
      console.log(`处理节点属性更新 [${nodeId}] ${nodeProperty || '完整对象'}:`, value);
      
      // 🔧 添加模型加载状态检查和重试机制
      const executeUpdate = () => {
        if (nodeProperty) {
          // 单个属性更新：node.{nodeId}.{property}
          switch (nodeProperty) {
            case 'location':
              updateModelNodeTransform(primitive, nodeId, 'location', value, iotAnimationSettings.enableSmoothTransition);
              break;
            case 'rotation':
              updateModelNodeTransform(primitive, nodeId, 'rotation', value, iotAnimationSettings.enableSmoothTransition);
              break;
            case 'scale':
              updateModelNodeTransform(primitive, nodeId, 'scale', value, iotAnimationSettings.enableSmoothTransition);
              break;
            default:
              console.warn(`不支持的节点属性: ${nodeProperty}`);
          }
        } else {
          // 完整对象更新：node.{nodeId}
          handleCompleteNodeUpdate(primitive, nodeId, value);
        }
      };
      
      // 检查模型是否已加载
      if (isModelReady(primitive)) {
        // 模型已准备好，直接执行更新
        executeUpdate();
      } else {
        // 模型还未准备好，等待模型加载完成后重试
        console.log(`模型还未完全加载，等待模型准备就绪后重试节点更新 [${nodeId}]`);
        waitForModelReady(primitive).then(() => {
          console.log(`模型已准备就绪，重试节点更新 [${nodeId}]`);
          executeUpdate();
        }).catch(error => {
          console.error(`等待模型准备就绪失败，跳过节点更新 [${nodeId}]:`, error);
        });
      }
      
    } catch (error) {
      console.error('节点属性更新失败:', error);
    }
  }, [iotAnimationSettings, updateModelNodeTransform, isModelReady, waitForModelReady]);

  /**
   * 🆕 处理完整节点对象更新
   * @param primitive 模型原语  
   * @param nodeId 节点ID
   * @param nodeData 完整的节点数据对象 {location?, rotation?, scale?}
   */
  const handleCompleteNodeUpdate = useCallback((primitive: any, nodeId: string, nodeData: any) => {
    try {
      if (typeof nodeData !== 'object' || nodeData === null) {
        console.warn('完整节点更新需要对象格式的数据');
        return;
      }
      
      console.log(`处理完整节点更新 [${nodeId}]:`, nodeData);
      
      // 按照优先级顺序更新：位置 -> 旋转 -> 缩放
      if ('location' in nodeData && nodeData.location !== undefined) {
        updateModelNodeTransform(primitive, nodeId, 'location', nodeData.location, iotAnimationSettings.enableSmoothTransition);
      }
      
      if ('rotation' in nodeData && nodeData.rotation !== undefined) {
        updateModelNodeTransform(primitive, nodeId, 'rotation', nodeData.rotation, iotAnimationSettings.enableSmoothTransition);
      }
      
      if ('scale' in nodeData && nodeData.scale !== undefined) {
        updateModelNodeTransform(primitive, nodeId, 'scale', nodeData.scale, iotAnimationSettings.enableSmoothTransition);
      }
      
      // 检查是否包含任何有效属性
      const hasValidProperty = ['location', 'rotation', 'scale'].some(prop => prop in nodeData && nodeData[prop] !== undefined);
      
      if (!hasValidProperty) {
        console.warn('完整节点更新没有找到有效的属性 (location, rotation, scale)');
      }
      
    } catch (error) {
      console.error('完整节点更新失败:', error);
    }
  }, [iotAnimationSettings, updateModelNodeTransform]);

  // 🆕 材质贴图更新功能
  
  /**
   * 更新模型材质属性
   * @param primitive 模型原语
   * @param materialIndex 材质索引（可选，默认更新所有材质）
   * @param property 材质属性名称
   * @param value 新的属性值
   */
  const updateModelMaterial = useCallback((primitive: any, materialIndex: number | 'all', property: string, value: any) => {
    try {
      // 🔧 增强材质更新的模型检查
      if (!primitive) {
        console.warn('primitive对象不存在');
        return;
      }
      
      // 检查模型是否准备好
      if (!isModelReady(primitive)) {
        console.log('模型还未完全加载，等待模型准备就绪后重试材质更新');
        waitForModelReady(primitive).then(() => {
          console.log('模型已准备就绪，重试材质更新');
          updateModelMaterial(primitive, materialIndex, property, value);
        }).catch(error => {
          console.error('等待模型准备就绪失败，跳过材质更新:', error);
        });
        return;
      }
      
      // 获取模型对象
      let model = primitive._model || primitive.model || { gltf: primitive._gltf };
      
      if (!model) {
        console.warn('模型对象不存在');
        return;
      }
      
      // 检查是否有材质信息
      if (!model.gltf || !model.gltf.materials) {
        console.warn('模型没有材质信息');
        return;
      }
      
      const materials = model.gltf.materials;
      
      if (materialIndex === 'all') {
        // 更新所有材质
        for (let i = 0; i < materials.length; i++) {
          updateMaterialProperty(materials[i], i, property, value);
        }
      } else if (typeof materialIndex === 'number') {
        // 更新指定材质
        if (materialIndex >= 0 && materialIndex < materials.length) {
          updateMaterialProperty(materials[materialIndex], materialIndex, property, value);
        } else {
          console.warn(`材质索引超出范围: ${materialIndex}`);
          return;
        }
      }
      
      // 标记模型需要更新
      if (model.dirty !== undefined) {
        model.dirty = true;
      }
      
      // 请求场景重绘
      if (viewerRef?.current?.scene) {
        viewerRef.current.scene.requestRender();
      }
      
    } catch (error) {
      console.error('更新模型材质失败:', error);
    }
  }, [viewerRef, isModelReady, waitForModelReady]);

  /**
   * 更新单个材质的属性
   */
  const updateMaterialProperty = useCallback((material: any, materialIndex: number, property: string, value: any) => {
    try {
      console.log(`更新材质 [${materialIndex}] ${property}:`, value);
      
      // 确保材质有PBR信息
      if (!material.pbrMetallicRoughness) {
        material.pbrMetallicRoughness = {};
      }
      
      const pbr = material.pbrMetallicRoughness;
      
      switch (property) {
        case 'baseColor':
        case 'baseColorFactor':
          updateBaseColor(pbr, value);
          break;
          
        case 'baseColorTexture':
          updateBaseColorTexture(pbr, value);
          break;
          
        case 'metallicFactor':
          updateMetallicFactor(pbr, value);
          break;
          
        case 'roughnessFactor':
          updateRoughnessFactor(pbr, value);
          break;
          
        case 'metallicRoughnessTexture':
          updateMetallicRoughnessTexture(pbr, value);
          break;
          
        case 'normalTexture':
          updateNormalTexture(material, value);
          break;
          
        case 'emissiveFactor':
          updateEmissiveFactor(material, value);
          break;
          
        case 'emissiveTexture':
          updateEmissiveTexture(material, value);
          break;
          
        case 'occlusionTexture':
          updateOcclusionTexture(material, value);
          break;
          
        case 'alphaCutoff':
          updateAlphaCutoff(material, value);
          break;
          
        case 'alphaMode':
          updateAlphaMode(material, value);
          break;
          
        default:
          console.warn(`不支持的材质属性: ${property}`);
      }
      
    } catch (error) {
      console.error(`更新材质属性失败 [${property}]:`, error);
    }
  }, []);

  /**
   * 更新基础颜色
   */
  const updateBaseColor = useCallback((pbr: any, color: any) => {
    let colorArray: number[];
    
    if (Array.isArray(color)) {
      if (color.length === 3) {
        colorArray = [color[0], color[1], color[2], 1.0]; // RGB + Alpha
      } else if (color.length >= 4) {
        colorArray = [color[0], color[1], color[2], color[3]]; // RGBA
      } else {
        throw new Error(`不支持的颜色数组长度: ${color.length}`);
      }
    } else if (typeof color === 'object' && color !== null) {
      if ('r' in color && 'g' in color && 'b' in color) {
        colorArray = [
          color.r / 255.0,
          color.g / 255.0,
          color.b / 255.0,
          (color.a !== undefined ? color.a : 255) / 255.0
        ];
      } else if ('red' in color && 'green' in color && 'blue' in color) {
        colorArray = [
          color.red,
          color.green,
          color.blue,
          color.alpha !== undefined ? color.alpha : 1.0
        ];
      } else {
        throw new Error('不支持的颜色对象格式');
      }
    } else if (typeof color === 'string') {
      // 十六进制颜色
      const cesiumColor = Cesium.Color.fromCssColorString(color);
      colorArray = [cesiumColor.red, cesiumColor.green, cesiumColor.blue, cesiumColor.alpha];
    } else {
      throw new Error('不支持的颜色数据类型');
    }
    
    pbr.baseColorFactor = colorArray;
    console.log('已更新基础颜色:', colorArray);
  }, []);

  /**
   * 更新基础颜色贴图
   */
  const updateBaseColorTexture = useCallback(async (pbr: any, textureData: any) => {
    try {
      if (typeof textureData === 'string') {
        if (textureData.startsWith('data:')) {
          // Base64图像
          const texture = await loadTextureFromBase64(textureData);
          pbr.baseColorTexture = { index: texture.index };
        } else {
          // URL
          const texture = await loadTextureFromUrl(textureData);
          pbr.baseColorTexture = { index: texture.index };
        }
      } else if (typeof textureData === 'object' && textureData !== null) {
        if ('url' in textureData) {
          const texture = await loadTextureFromUrl(textureData.url);
          pbr.baseColorTexture = { 
            index: texture.index,
            texCoord: textureData.texCoord || 0
          };
        } else if ('base64' in textureData) {
          const texture = await loadTextureFromBase64(textureData.base64);
          pbr.baseColorTexture = { 
            index: texture.index,
            texCoord: textureData.texCoord || 0
          };
        }
      }
      
      console.log('已更新基础颜色贴图');
    } catch (error) {
      console.error('更新基础颜色贴图失败:', error);
    }
  }, []);

  /**
   * 更新金属度因子
   */
  const updateMetallicFactor = useCallback((pbr: any, factor: number) => {
    if (typeof factor !== 'number' || factor < 0 || factor > 1) {
      console.warn('金属度因子必须是0-1之间的数值');
      return;
    }
    
    pbr.metallicFactor = factor;
    console.log('已更新金属度因子:', factor);
  }, []);

  /**
   * 更新粗糙度因子
   */
  const updateRoughnessFactor = useCallback((pbr: any, factor: number) => {
    if (typeof factor !== 'number' || factor < 0 || factor > 1) {
      console.warn('粗糙度因子必须是0-1之间的数值');
      return;
    }
    
    pbr.roughnessFactor = factor;
    console.log('已更新粗糙度因子:', factor);
  }, []);

  /**
   * 更新发射光因子
   */
  const updateEmissiveFactor = useCallback((material: any, emissive: any) => {
    let emissiveArray: number[];
    
    if (Array.isArray(emissive) && emissive.length >= 3) {
      emissiveArray = [emissive[0], emissive[1], emissive[2]];
    } else if (typeof emissive === 'object' && emissive !== null) {
      if ('r' in emissive && 'g' in emissive && 'b' in emissive) {
        emissiveArray = [
          emissive.r / 255.0,
          emissive.g / 255.0,
          emissive.b / 255.0
        ];
      } else {
        throw new Error('不支持的发射光对象格式');
      }
    } else if (typeof emissive === 'string') {
      const cesiumColor = Cesium.Color.fromCssColorString(emissive);
      emissiveArray = [cesiumColor.red, cesiumColor.green, cesiumColor.blue];
    } else {
      throw new Error('不支持的发射光数据类型');
    }
    
    material.emissiveFactor = emissiveArray;
    console.log('已更新发射光因子:', emissiveArray);
  }, []);

  /**
   * 从URL加载贴图（简化实现）
   */
  const loadTextureFromUrl = useCallback(async (url: string): Promise<{ index: number }> => {
    // 这里应该实现实际的贴图加载逻辑
    // 返回一个模拟的贴图索引
    console.log(`加载贴图: ${url}`);
    return { index: 0 }; // 简化实现
  }, []);

  /**
   * 从Base64加载贴图（简化实现）
   */
  const loadTextureFromBase64 = useCallback(async (base64: string): Promise<{ index: number }> => {
    // 这里应该实现实际的Base64贴图加载逻辑
    console.log('加载Base64贴图');
    return { index: 0 }; // 简化实现
  }, []);

  /**
   * 更新其他贴图类型的简化实现
   */
  const updateMetallicRoughnessTexture = useCallback((pbr: any, textureData: any) => {
    console.log('更新金属粗糙度贴图:', textureData);
    // 实现逻辑类似 updateBaseColorTexture
  }, []);

  const updateNormalTexture = useCallback((material: any, textureData: any) => {
    console.log('更新法线贴图:', textureData);
    // 实现逻辑类似 updateBaseColorTexture
  }, []);

  const updateEmissiveTexture = useCallback((material: any, textureData: any) => {
    console.log('更新发射光贴图:', textureData);
    // 实现逻辑类似 updateBaseColorTexture
  }, []);

  const updateOcclusionTexture = useCallback((material: any, textureData: any) => {
    console.log('更新遮挡贴图:', textureData);
    // 实现逻辑类似 updateBaseColorTexture
  }, []);

  const updateAlphaCutoff = useCallback((material: any, cutoff: number) => {
    material.alphaCutoff = cutoff;
    console.log('已更新Alpha裁剪值:', cutoff);
  }, []);

  const updateAlphaMode = useCallback((material: any, mode: string) => {
    material.alphaMode = mode; // "OPAQUE", "MASK", "BLEND"
    console.log('已更新Alpha模式:', mode);
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
                  realtimeTransform={realtimeTransform}
                  viewerRef={viewerRef}
                  selectedModelId={selectedInstanceId}
                  animationState={animationState}
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
                onGaussianSplatDragStart={handleGaussianSplatDragStart}
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