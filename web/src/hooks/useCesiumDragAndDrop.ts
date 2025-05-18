// hooks/useCesiumDragAndDrop.ts
import { useState, useCallback } from 'react';
import { Viewer, Cartesian2, Cartesian3, Cartographic, Math as CesiumMath, Transforms, Model, CustomShader } from 'cesium';
import * as Cesium from 'cesium';
import modelAPI from '../services/modelApi'; // 假设路径正确
import { downloadPublicModel } from '../services/publicModels'; // 导入公共模型下载API
import { ModelAsset } from './useModelAssets'; // 引入模型类型
import { PublicModelMetadata } from '../services/publicModels'; // 引入公共模型类型
import { createSceneInstance } from '../services/sceneApi'; // 导入创建实例的API

export interface MaterialDefinition {
  id: string;
  name: string;
  icon: JSX.Element;
  customShader: CustomShader;
}

export const useCesiumDragAndDrop = (
  viewerRef: React.RefObject<Viewer | null>,
  cesiumContainerRef: React.RefObject<HTMLDivElement>,
  models: ModelAsset[], // 从 useModelAssets 获取
  materials: MaterialDefinition[], // 从主组件或其他地方传入
  messageApi: any, // 新增参数
  refreshLayerStates?: () => void, // 新增参数，可选
  publicModels: PublicModelMetadata[] = [], // 新增公共模型参数
  sceneId?: string, // 新增场景ID参数
  sceneOrigin?: { longitude: number, latitude: number, height: number }, // 新增场景原点参数
  fetchInstanceTreeRef?: React.RefObject<(() => void) | undefined> // 类型兼容
) => {
  const [dragLatLng, setDragLatLng] = useState<{ lon: number; lat: number } | null>(null);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!viewerRef.current || !cesiumContainerRef.current) return;

    const rect = cesiumContainerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const scene = viewerRef.current.scene;
    const cartesian = scene.camera.pickEllipsoid(new Cartesian2(x, y), scene.globe.ellipsoid);

    if (cartesian) {
      const cartographic = Cartographic.fromCartesian(cartesian);
      const lon = CesiumMath.toDegrees(cartographic.longitude);
      const lat = CesiumMath.toDegrees(cartographic.latitude);
      setDragLatLng({ lon, lat });
    } else {
      setDragLatLng(null);
    }
  }, [viewerRef, cesiumContainerRef]);

  // 计算一个点相对于场景原点的局部坐标
  const calculateLocalPosition = (longitude: number, latitude: number, height: number) => {
    if (!sceneOrigin) {
      return [0, 0, 0]; // 如果没有原点，默认为[0,0,0]
    }

    // 创建原点的笛卡尔坐标
    const originCartesian = Cesium.Cartesian3.fromDegrees(
      sceneOrigin.longitude,
      sceneOrigin.latitude,
      sceneOrigin.height
    );

    // 创建当前点的笛卡尔坐标
    const pointCartesian = Cesium.Cartesian3.fromDegrees(
      longitude,
      latitude,
      height
    );

    // 计算从原点到当前点的向量（局部XYZ坐标）
    const localVector = new Cesium.Cartesian3();
    Cesium.Cartesian3.subtract(pointCartesian, originCartesian, localVector);

    // 创建局部坐标系的东北上(ENU)坐标系
    const enuTransform = Cesium.Transforms.eastNorthUpToFixedFrame(originCartesian);
    
    // 创建逆变换矩阵，用于将全局坐标转换为局部坐标
    const inverseEnuTransform = new Cesium.Matrix4();
    Cesium.Matrix4.inverse(enuTransform, inverseEnuTransform);
    
    // 将全局向量转换为局部坐标系中的向量
    const localCoordinates = new Cesium.Cartesian3();
    Cesium.Matrix4.multiplyByPoint(inverseEnuTransform, pointCartesian, localCoordinates);
    
    // 返回局部XYZ坐标作为数组
    return [localCoordinates.x, localCoordinates.y, localCoordinates.z];
  };

  // 创建实例到数据库的函数
  const createInstanceInDB = async (
    name: string,
    assetId: string,
    modelUrl: string, // 保留用于Cesium加载，但不传给后端
    position: { longitude: number, latitude: number, height: number },
    assetType: string = "model" // 新增参数，默认为"model"
  ) => {
    if (!sceneId) {
      console.warn('无法创建实例: 未提供场景ID');
      return null;
    }

    try {
      let transform;
      if (assetType === 'threeDTiles') {
        // 3DTiles transform写默认值
        transform = {
          location: [0, 0, 0],
          rotation: [0, 0, 0],
          scale: [1, 1, 1]
        };
      } else {
        // 其他模型正常计算
        const localPosition = calculateLocalPosition(
          position.longitude,
          position.latitude,
          position.height
        );
        transform = {
          location: localPosition, // 使用局部坐标而不是经纬度坐标
          rotation: [0, 0, 0],
          scale: [1, 1, 1]
        };
      }

      // 调用API创建实例
      const response = await createSceneInstance(sceneId, {
        name,
        asset_id: assetId,      // 资产ID，用于标识模型
        asset_type: assetType,  // 使用传入的资产类型
        transform
      });

      return { instanceId: response.uid, modelUrl }; // 返回实例ID和模型URL供Cesium使用
    } catch (error) {
      console.error('创建实例失败:', error);
      return null;
    }
  };

  const handleDrop = useCallback(async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!viewerRef.current || !cesiumContainerRef.current) return;

    const viewer = viewerRef.current;
    setDragLatLng(null); // 清除拖拽时显示的经纬度

    const materialId = e.dataTransfer.getData('materialId');
    const modelId = e.dataTransfer.getData('modelId');
    const publicModelId = e.dataTransfer.getData('publicModelId');
    const threeDTilesId = e.dataTransfer.getData('threeDTilesId');

    if (materialId) {
      const rect = cesiumContainerRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const windowPosition = new Cartesian2(x, y);
      const picked = viewer.scene.pick(windowPosition);

      if (picked && picked.primitive && picked.primitive instanceof Model) {
        const mat = materials.find(m => m.id === materialId);
        if (mat) {
          picked.primitive.customShader = mat.customShader;
          messageApi.success(`材质 "${mat.name}" 已应用`);
        }
      }
      return;
    }

    // 获取放置位置的经纬度
    let lon = 113.2644, lat = 23.1291, height = 0; // 默认位置
    const dropPositionCartesian = viewer.scene.camera.pickEllipsoid(
      new Cartesian2(e.clientX - cesiumContainerRef.current.getBoundingClientRect().left, e.clientY - cesiumContainerRef.current.getBoundingClientRect().top),
      viewer.scene.globe.ellipsoid
    );

    if (dropPositionCartesian) {
      const cartographic = Cartographic.fromCartesian(dropPositionCartesian);
      lon = CesiumMath.toDegrees(cartographic.longitude);
      lat = CesiumMath.toDegrees(cartographic.latitude);
    }

    if (modelId) {
      // 处理用户模型
      const modelData = models.find(m => (m._id || m.id || m.fileId) === modelId);
      if (!modelData) {
        messageApi.error('未找到模型数据');
        return;
      }

      try {
        // 先获取下载URL
        const resp = await modelAPI.getConvertedModelDownloadUrl(modelData._id || modelData.id! || modelData.fileId!);
        const url = resp.data?.download_url;
        if (!url) {
          messageApi.error('获取GLB链接失败');
          return;
        }

        // 先创建实例到数据库
        const modelName = modelData.name || modelData.filename;
        const modelAssetId = modelData._id || modelData.id! || modelData.fileId!;
        const result = await createInstanceInDB(
          modelName,
          modelAssetId,
          url,
          { longitude: lon, latitude: lat, height },
          "model" // 明确指定为普通模型
        );
        
        if (!result) {
          messageApi.error(`模型 "${modelName}" 实例化失败`);
          return;
        }

        const { instanceId, modelUrl } = result;
        
        // 数据库保存成功后，在Cesium中显示模型
        // 创建世界坐标位置
        const worldPosition = Cartesian3.fromDegrees(lon, lat, height);
        
        // 使用ENU坐标系创建模型矩阵
        const modelMatrix = Transforms.eastNorthUpToFixedFrame(worldPosition);
        
        const glbModel = await Model.fromGltfAsync({
          url: modelUrl,
          modelMatrix,
          scale: 1.0, // 默认缩放
        });
        (glbModel as any).id = instanceId; // 关键：模型id与实例id一致
        (glbModel as any).name = modelName;
        (glbModel as any).instanceId = instanceId; // 保存实例ID到模型对象

        viewer.scene.primitives.add(glbModel);
        messageApi.success(`模型 "${modelName}" 已加载并实例化`);

        // 拖放模型后刷新图层条目
        if (refreshLayerStates) refreshLayerStates();
        // 拖放模型后刷新实例树
        if (fetchInstanceTreeRef && fetchInstanceTreeRef.current) fetchInstanceTreeRef.current();
      } catch (err) {
        console.error('处理模型异常', err);
        messageApi.error('加载或实例化模型失败');
      }
    } else if (publicModelId) {
      // 处理公共模型
      const publicModelData = publicModels.find(m => m._id === publicModelId);
      if (!publicModelData) {
        messageApi.error('未找到公共模型数据');
        return;
      }

      try {
        // 先获取下载URL
        const resp = await downloadPublicModel(publicModelId);
        const url = resp.download_url;
        if (!url) {
          messageApi.error('获取公共模型下载链接失败');
          return;
        }

        // 先创建实例到数据库
        const modelName = publicModelData.filename;
        const result = await createInstanceInDB(
          modelName,
          publicModelData._id,
          url,
          { longitude: lon, latitude: lat, height },
          "public_model" // 明确指定为公共模型
        );
        
        if (!result) {
          messageApi.error(`公共模型 "${modelName}" 实例化失败`);
          return;
        }

        const { instanceId, modelUrl } = result;
        
        // 数据库保存成功后，在Cesium中显示模型
        // 创建世界坐标位置
        const worldPosition = Cartesian3.fromDegrees(lon, lat, height);
        
        // 使用ENU坐标系创建模型矩阵
        const modelMatrix = Transforms.eastNorthUpToFixedFrame(worldPosition);
        
        const glbModel = await Model.fromGltfAsync({
          url: modelUrl,
          modelMatrix,
          scale: 1.0, // 默认缩放
        });
        (glbModel as any).id = instanceId; // 关键：模型id与实例id一致
        (glbModel as any).name = modelName;
        (glbModel as any).instanceId = instanceId; // 保存实例ID到模型对象

        viewer.scene.primitives.add(glbModel);
        messageApi.success(`公共模型 "${modelName}" 已加载并实例化`);

        // 拖放模型后刷新图层条目
        if (refreshLayerStates) refreshLayerStates();
        // 拖放模型后刷新实例树
        if (fetchInstanceTreeRef && fetchInstanceTreeRef.current) fetchInstanceTreeRef.current();
      } catch (err) {
        console.error('处理公共模型异常', err);
        messageApi.error('加载或实例化公共模型失败');
      }
    } else if (threeDTilesId) {
      // 处理3DTiles拖拽
      try {
        // 1. 查找3DTiles数据（假设3DTilesTab数据结构与接口一致）
        const tilesData = (window as any).threeDTilesList || [];
        let threeDTilesItem = null;
        if (tilesData.length > 0) {
          threeDTilesItem = tilesData.find((item: any) => item._id === threeDTilesId);
        }
        console.log('[3DTiles] window.threeDTilesList:', tilesData);
        console.log('[3DTiles] 查找结果 threeDTilesItem:', threeDTilesItem);
        // 若window未挂载，则尝试从DOM缓存（后续可优化为全局状态）
        if (!threeDTilesItem && typeof document !== 'undefined') {
          const cache = (document as any).threeDTilesListCache;
          console.log('[3DTiles] document.threeDTilesListCache:', cache);
          if (cache && Array.isArray(cache)) {
            threeDTilesItem = cache.find((item: any) => item._id === threeDTilesId);
            console.log('[3DTiles] 从document缓存查找结果:', threeDTilesItem);
          }
        }
        // 若仍未找到，提示用户
        if (!threeDTilesItem) {
          console.error('[3DTiles] 未找到3DTiles数据，threeDTilesId:', threeDTilesId);
          messageApi.error('未找到3DTiles数据，请刷新资源面板后重试');
          return;
        }
        // 2. 创建instance
        const modelName = threeDTilesItem.name;
        const assetId = threeDTilesItem._id;
        const tilesetUrl = threeDTilesItem.tileset_url;
        console.log('[3DTiles] 创建实例参数:', { modelName, assetId, tilesetUrl, lon, lat, height });
        const result = await createInstanceInDB(
          modelName,
          assetId,
          tilesetUrl,
          { longitude: lon, latitude: lat, height },
          'threeDTiles'
        );
        console.log('[3DTiles] createInstanceInDB结果:', result);
        if (!result) {
          messageApi.error(`3DTiles "${modelName}" 实例化失败`);
          return;
        }
        const { instanceId } = result;
        // 3. Cesium加载3DTiles
        let fullTilesetUrl = tilesetUrl;
        if (tilesetUrl.startsWith('/')) {
          const minioUrl = (import.meta as any).env?.VITE_MINIO_URL || '';
          fullTilesetUrl = `${minioUrl}${tilesetUrl}`;
        }
        console.log('[3DTiles] 加载Cesium3DTileset，fullTilesetUrl:', fullTilesetUrl);
        const Cesium3DTileset = Cesium.Cesium3DTileset;
        try {
          const tileset = await Cesium3DTileset.fromUrl(fullTilesetUrl);
          (tileset as any).id = instanceId;
          (tileset as any).name = modelName;
          (tileset as any).instanceId = instanceId;
          console.log('[3DTiles] tileset对象:', tileset);
          viewer.scene.primitives.add(tileset);
          console.log('[3DTiles] 已添加到scene.primitives');
          messageApi.success(`3DTiles "${modelName}" 已加载并实例化`);
        } catch (err) {
          console.error('[3DTiles] 加载tileset异常:', err);
          messageApi.error('加载或实例化3DTiles失败');
        }
        // 4. 拖拽后刷新图层和实例树
        if (refreshLayerStates) refreshLayerStates();
        if (fetchInstanceTreeRef && fetchInstanceTreeRef.current) fetchInstanceTreeRef.current();
        // 5. gisbinding如有接口后续补充
      } catch (err) {
        console.error('处理3DTiles异常', err);
        messageApi.error('加载或实例化3DTiles失败');
      }
    }
  }, [viewerRef, cesiumContainerRef, models, materials, messageApi, refreshLayerStates, publicModels, sceneId, sceneOrigin, fetchInstanceTreeRef]);

  const resetDragLatLng = () => setDragLatLng(null);

  return { dragLatLng, handleDragOver, handleDrop, resetDragLatLng };
};