// hooks/useCesiumDragAndDrop.ts
import { useState, useCallback } from 'react';
import { Viewer, Cartesian2, Cartesian3, Cartographic, Math as CesiumMath, Transforms, Model, CustomShader } from 'cesium';
import * as Cesium from 'cesium';
import { message } from 'antd';
import modelAPI from '../services/modelApi'; // 假设路径正确
import { ModelAsset } from './useModelAssets'; // 引入模型类型

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
  materials: MaterialDefinition[] // 从主组件或其他地方传入
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
          message.success(`材质 "${mat.name}" 已应用`);
        }
      }
      return;
    }

    if (modelId) {
      const modelData = models.find(m => (m._id || m.id || m.fileId) === modelId);
      if (!modelData) {
        message.error('未找到模型数据');
        return;
      }

      try {
        const resp = await modelAPI.getConvertedModelDownloadUrl(modelData._id || modelData.id! || modelData.fileId!); // 确保使用正确的ID
        const url = resp.data?.download_url;
        if (!url) {
          message.error('获取GLB链接失败');
          return;
        }

        let lon = 113.2644, lat = 23.1291, height = 0; // 默认位置
        const dropPositionCartesian = viewer.scene.camera.pickEllipsoid(
          new Cartesian2(e.clientX - cesiumContainerRef.current.getBoundingClientRect().left, e.clientY - cesiumContainerRef.current.getBoundingClientRect().top),
          viewer.scene.globe.ellipsoid
        );

        if (dropPositionCartesian) {
          const cartographic = Cartographic.fromCartesian(dropPositionCartesian);
          lon = CesiumMath.toDegrees(cartographic.longitude);
          lat = CesiumMath.toDegrees(cartographic.latitude);
          // height = cartographic.height; // 可以获取地形高度，但通常模型放置在0或指定高度
        }

        const modelMatrix = Transforms.eastNorthUpToFixedFrame(
          Cartesian3.fromDegrees(lon, lat, height)
        );

        const glbModel = await Model.fromGltfAsync({
          url,
          modelMatrix,
          scale: 1.0, // 默认缩放
          // id: modelData._id || modelData.id, // 给模型设置一个ID，便于后续识别
        });
        (glbModel as any).id = modelData._id || modelData.id; // Cesium.Model 没有直接的 id 属性，可以这样附加
        (glbModel as any).name = modelData.name || modelData.filename;


        viewer.scene.primitives.add(glbModel);
        message.success(`模型 "${modelData.name || modelData.filename}" 已加载`);

        // 可选：加载完成后，将相机飞到模型
        // viewer.flyTo(glbModel);

      } catch (err) {
        console.error('加载GLB异常', err);
        message.error('加载GLB失败');
      }
    }
  }, [viewerRef, cesiumContainerRef, models, materials]);

  const resetDragLatLng = () => setDragLatLng(null);

  return { dragLatLng, handleDragOver, handleDrop, resetDragLatLng };
};