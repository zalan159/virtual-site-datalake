// hooks/useCesiumDragAndDrop.ts
import { useState, useCallback } from 'react';
import { Viewer, Cartesian2, Cartesian3, Cartographic, Math as CesiumMath, Transforms, Model, CustomShader } from 'cesium';
import * as Cesium from 'cesium';
import { message } from 'antd';
import modelAPI from '../services/modelApi'; // 假设路径正确
import { downloadPublicModel } from '../services/publicModels'; // 导入公共模型下载API
import { ModelAsset } from './useModelAssets'; // 引入模型类型
import { PublicModelMetadata } from '../services/publicModels'; // 引入公共模型类型

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
  publicModels: PublicModelMetadata[] = [] // 新增公共模型参数
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

  const handleDrop = useCallback(async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!viewerRef.current || !cesiumContainerRef.current) return;

    const viewer = viewerRef.current;
    setDragLatLng(null); // 清除拖拽时显示的经纬度

    const materialId = e.dataTransfer.getData('materialId');
    const modelId = e.dataTransfer.getData('modelId');
    const publicModelId = e.dataTransfer.getData('publicModelId');

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

    const modelMatrix = Transforms.eastNorthUpToFixedFrame(
      Cartesian3.fromDegrees(lon, lat, height)
    );

    if (modelId) {
      // 处理用户模型
      const modelData = models.find(m => (m._id || m.id || m.fileId) === modelId);
      if (!modelData) {
        messageApi.error('未找到模型数据');
        return;
      }

      try {
        const resp = await modelAPI.getConvertedModelDownloadUrl(modelData._id || modelData.id! || modelData.fileId!); // 确保使用正确的ID
        const url = resp.data?.download_url;
        if (!url) {
          messageApi.error('获取GLB链接失败');
          return;
        }

        const glbModel = await Model.fromGltfAsync({
          url,
          modelMatrix,
          scale: 1.0, // 默认缩放
        });
        (glbModel as any).id = modelData._id || modelData.id; // Cesium.Model 没有直接的 id 属性，可以这样附加
        (glbModel as any).name = modelData.name || modelData.filename;

        viewer.scene.primitives.add(glbModel);
        messageApi.success(`模型 "${modelData.name || modelData.filename}" 已加载`);

        // 拖放模型后刷新图层条目
        if (refreshLayerStates) refreshLayerStates();
      } catch (err) {
        console.error('加载GLB异常', err);
        messageApi.error('加载GLB失败');
      }
    } else if (publicModelId) {
      // 处理公共模型
      const publicModelData = publicModels.find(m => m._id === publicModelId);
      if (!publicModelData) {
        messageApi.error('未找到公共模型数据');
        return;
      }

      try {
        const resp = await downloadPublicModel(publicModelId);
        const url = resp.download_url;
        if (!url) {
          messageApi.error('获取公共模型下载链接失败');
          return;
        }

        const glbModel = await Model.fromGltfAsync({
          url,
          modelMatrix,
          scale: 1.0, // 默认缩放
        });
        (glbModel as any).id = publicModelData._id; 
        (glbModel as any).name = publicModelData.filename;

        viewer.scene.primitives.add(glbModel);
        messageApi.success(`公共模型 "${publicModelData.filename}" 已加载`);

        // 拖放模型后刷新图层条目
        if (refreshLayerStates) refreshLayerStates();
      } catch (err) {
        console.error('加载公共模型异常', err);
        messageApi.error('加载公共模型失败');
      }
    }
  }, [viewerRef, cesiumContainerRef, models, materials, messageApi, refreshLayerStates, publicModels]);

  const resetDragLatLng = () => setDragLatLng(null);

  return { dragLatLng, handleDragOver, handleDrop, resetDragLatLng };
};