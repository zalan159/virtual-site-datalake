// hooks/useCesiumViewer.ts
import { useRef, useEffect, useState, useCallback } from 'react';
import { Viewer, Cartesian3, Model, Transforms, Math as CesiumMath } from 'cesium';
import * as Cesium from 'cesium';
import { getSceneInstances } from '../services/sceneApi';
import modelAPI from '../services/modelApi'; // 导入模型API
import { downloadPublicModel } from '../services/publicModels'; // 导入公共模型API
import api from '../services/axiosConfig';

// 确保 Cesium 全局 Token 设置 (如果需要)
// Cesium.Ion.defaultAccessToken = 'YOUR_CESIUM_ION_TOKEN';

// 实例接口定义
interface SceneInstance {
  uid: string;
  name: string;
  transform: {
    location: number[];
    rotation: number[];
    scale: number[];
  };
  materials?: any[];
  asset_id: string;
  asset_type: string;
  tileset_url?: string;
}

export const useCesiumViewer = (
  cesiumContainerRef: React.RefObject<HTMLDivElement>,
  origin?: { longitude: number; latitude: number; height: number }
) => {
  const viewerRef = useRef<Viewer | null>(null);
  const [instances, setInstances] = useState<SceneInstance[]>([]);
  const [loadingInstances, setLoadingInstances] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState({ total: 0, loaded: 0 });
  const instanceModelsRef = useRef<Map<string, Cesium.Model | Cesium.Cesium3DTileset>>(new Map());
  const [sceneLoaded, setSceneLoaded] = useState<string | null>(null);

  // 初始化Viewer
  useEffect(() => {
    let viewer: Viewer | undefined;
    if (cesiumContainerRef.current && !viewerRef.current) {
      console.log('初始化Cesium Viewer');
      viewer = new Viewer(cesiumContainerRef.current, {
        timeline: false,
        animation: false,
        homeButton: false,
        sceneModePicker: false,
        baseLayerPicker: false,
        fullscreenButton: false,
        geocoder: false,
        navigationHelpButton: false,
        infoBox: false,
        selectionIndicator: true,
        contextOptions: {
            webgl: {
              preserveDrawingBuffer: true
            }
          }
      });

      // 移除默认影像图层
      viewer.imageryLayers.removeAll();

      viewerRef.current = viewer;
    }

    return () => {
      if (viewerRef.current && !viewerRef.current.isDestroyed()) {
        viewerRef.current.destroy();
        viewerRef.current = null;
      }
    };
  }, [cesiumContainerRef]); // 只在组件挂载时创建Viewer

  // 跟踪 origin 变化，更新相机位置
  useEffect(() => {
    if (viewerRef.current && !viewerRef.current.isDestroyed() && origin) {
      console.log('更新相机位置到origin:', origin);
      viewerRef.current.camera.flyTo({
        destination: Cartesian3.fromDegrees(
          origin.longitude,
          origin.latitude,
          origin.height || 1000
        ),
        duration: 1.5
      });
    }
  }, [origin]); // 只在origin变化时更新相机位置

  // 获取模型URI的函数
  const getModelUri = async (instance: SceneInstance): Promise<string | null> => {
    try {
      // 检查必要的字段是否存在
      if (!instance.asset_id || !instance.asset_type) {
        console.warn(`实例 "${instance.name}" (ID: ${instance.uid}) 缺少必要的资产信息:`, {
          asset_id: instance.asset_id,
          asset_type: instance.asset_type
        });
        return null;
      }

      if (instance.asset_type === 'model') {
        // 获取用户模型的下载URL
        const resp = await modelAPI.getConvertedModelDownloadUrl(instance.asset_id);
        return resp.data?.download_url || null;
      } else if (instance.asset_type === 'public_model') {
        // 获取公共模型的下载URL
        const resp = await downloadPublicModel(instance.asset_id);
        return resp.download_url || null;
      }
      return null;
    } catch (error) {
      console.error(`获取模型URI失败 (ID: ${instance.asset_id}, 类型: ${instance.asset_type}):`, error);
      return null;
    }
  };

  // 加载场景中的实例
  const loadSceneInstances = useCallback(async (sceneId: string) => {
    if (!viewerRef.current || !sceneId || !origin) return;
    
    if (loadingInstances || sceneId === sceneLoaded) return;
    
    try {
      setLoadingInstances(true);
      setLoadingProgress({ total: 0, loaded: 0 });
      console.log(`开始获取场景 ${sceneId} 的实例列表...`);
      
      const response = await getSceneInstances(sceneId);
      
      if (!response.data) {
        console.error('获取场景实例失败: 服务器未返回有效数据');
        setLoadingInstances(false);
        return;
      }
      
      const instancesData = response.data;
      console.log(`成功获取 ${instancesData.length} 个场景实例`);
      setInstances(instancesData);
      setLoadingProgress(prev => ({ ...prev, total: instancesData.length }));
      
      // 清除旧的模型实例
      for (const [_, model] of instanceModelsRef.current.entries()) {
        if (viewerRef.current.scene.primitives.contains(model)) {
          viewerRef.current.scene.primitives.remove(model);
        }
      }
      instanceModelsRef.current.clear();
      
      // 加载新的模型实例
      const successfulLoads = [];
      const failedLoads = [];
      
      for (const instance of instancesData) {
        try {
          // === 3DTiles类型特殊处理 ===
          if (instance.asset_type === 'threeDTiles') {
            let tilesetUrl = '';
            try {
              const resp = await api.get(`/3dtiles/${instance.asset_id}`);
              tilesetUrl = resp.data?.tileset_url;
            } catch (err) {
              console.warn(`实例 "${instance.name}" (ID: ${instance.uid}) 获取3DTiles详情失败，跳过加载`, err);
              failedLoads.push(instance.uid);
              setLoadingProgress(prev => ({ ...prev, loaded: prev.loaded + 1 }));
              continue;
            }
            if (!tilesetUrl) {
              console.warn(`实例 "${instance.name}" (ID: ${instance.uid}) 详情缺少tileset_url，跳过加载`);
              failedLoads.push(instance.uid);
              setLoadingProgress(prev => ({ ...prev, loaded: prev.loaded + 1 }));
              continue;
            }
            // 处理URL前缀
            let fullTilesetUrl = tilesetUrl;
            if (tilesetUrl.startsWith('/')) {
              const minioUrl = (import.meta as any).env?.VITE_MINIO_URL || '';
              fullTilesetUrl = `${minioUrl}${tilesetUrl}`;
            }
            try {
              const Cesium3DTileset = Cesium.Cesium3DTileset;
              const tileset = await Cesium3DTileset.fromUrl(fullTilesetUrl);
              (tileset as any).id = instance.uid;
              (tileset as any).name = instance.name;
              (tileset as any).instanceId = instance.uid;
              viewerRef.current.scene.primitives.add(tileset);
              instanceModelsRef.current.set(instance.uid, tileset);
              successfulLoads.push(instance.uid);
              setLoadingProgress(prev => ({ ...prev, loaded: prev.loaded + 1 }));
              console.log(`已加载3DTiles "${instance.name}" (ID: ${instance.uid})`);
            } catch (err) {
              console.error(`加载3DTiles "${instance.name}" 失败:`, err);
              failedLoads.push(instance.uid);
              setLoadingProgress(prev => ({ ...prev, loaded: prev.loaded + 1 }));
            }
            continue;
          }
          
          // === 高斯泼溅类型处理 ===
          if (instance.asset_type === 'gaussianSplat') {
            try {
              // 获取高斯泼溅数据
              const resp = await api.get(`/api/gaussian-splats/${instance.asset_id}`);
              const splatData = resp.data;
              
              if (!splatData) {
                console.warn(`实例 "${instance.name}" (ID: ${instance.uid}) 获取高斯泼溅详情失败，跳过加载`);
                failedLoads.push(instance.uid);
                setLoadingProgress(prev => ({ ...prev, loaded: prev.loaded + 1 }));
                continue;
              }
              
              // 计算世界坐标位置
              const originCartesian = Cesium.Cartesian3.fromDegrees(
                origin.longitude,
                origin.latitude,
                origin.height
              );
              
              // 使用局部坐标计算世界位置
              const [localX, localY, localZ] = instance.transform.location;
              const enuTransform = Cesium.Transforms.eastNorthUpToFixedFrame(originCartesian);
              const localPosition = new Cesium.Cartesian3(localX, localY, localZ);
              const worldPosition = new Cesium.Cartesian3();
              Cesium.Matrix4.multiplyByPoint(enuTransform, localPosition, worldPosition);
              
              // 创建一个简单的点云实体作为占位符（等待Cesium原生支持）
              const entity = viewerRef.current.entities.add({
                position: worldPosition,
                point: {
                  pixelSize: 20,
                  color: Cesium.Color.LIGHTBLUE,
                  outlineColor: Cesium.Color.BLUE,
                  outlineWidth: 2,
                  heightReference: Cesium.HeightReference.RELATIVE_TO_GROUND,
                },
                label: {
                  text: instance.name,
                  font: '12pt sans-serif',
                  pixelOffset: new Cesium.Cartesian2(0, -40),
                  fillColor: Cesium.Color.WHITE,
                  outlineColor: Cesium.Color.BLACK,
                  outlineWidth: 2,
                  style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                }
              });
              
              // 添加元数据
              (entity as any).id = instance.uid;
              (entity as any).name = instance.name;
              (entity as any).instanceId = instance.uid;
              (entity as any).assetType = 'gaussianSplat';
              (entity as any).splatData = splatData;
              
              successfulLoads.push(instance.uid);
              setLoadingProgress(prev => ({ ...prev, loaded: prev.loaded + 1 }));
              console.log(`已加载高斯泼溅 "${instance.name}" (ID: ${instance.uid}) - 使用占位符显示`);
              
            } catch (err) {
              console.error(`加载高斯泼溅 "${instance.name}" 失败:`, err);
              failedLoads.push(instance.uid);
              setLoadingProgress(prev => ({ ...prev, loaded: prev.loaded + 1 }));
            }
            continue;
          }
          
          // === 其他类型保持原有逻辑 ===
          // 获取模型URI
          const modelUri = await getModelUri(instance);
          if (!modelUri) {
            console.warn(`实例 "${instance.name}" (ID: ${instance.uid}) 无法获取模型URI，跳过加载`);
            failedLoads.push(instance.uid);
            setLoadingProgress(prev => ({ ...prev, loaded: prev.loaded + 1 }));
            continue;
          }

          console.log(`加载实例 "${instance.name}" (ID: ${instance.uid}) 的transform:`, {
            instanceTransform: instance.transform,
            sceneOrigin: origin
          });

          // 获取实例的位置信息（x, y, z是相对原点的局部坐标）
          const { location, rotation, scale } = instance.transform;
          
          // 创建场景原点的笛卡尔坐标
          const originCartesian = Cesium.Cartesian3.fromDegrees(
            origin.longitude, 
            origin.latitude, 
            origin.height || 0
          );
          
          // 创建东北上矩阵（局部坐标系）
          const enuMatrix = Transforms.eastNorthUpToFixedFrame(originCartesian);
          
          // 创建局部位置向量（注意：这里假设location是[东, 北, 上]的顺序）
          const localPosition = new Cesium.Cartesian3(
            location[0] || 0, // 东向偏移
            location[1] || 0, // 北向偏移
            location[2] || 0  // 上向偏移
          );
          
          // 将局部位置转换为世界坐标
          const worldPosition = Cesium.Matrix4.multiplyByPoint(
            enuMatrix, 
            localPosition, 
            new Cesium.Cartesian3()
          );
          
          // 使用ENU坐标系创建模型矩阵
          let modelMatrix = Transforms.eastNorthUpToFixedFrame(worldPosition);
          
          // 应用旋转（如果有）
          if (rotation && rotation.length === 3) {
            // 从实例数据中获取旋转角度(角度值，需要转换为弧度)
            const headingDeg = rotation[0] || 0;
            const pitchDeg = rotation[1] || 0;
            const rollDeg = rotation[2] || 0;
            
            // 转换为弧度
            const headingRad = CesiumMath.toRadians(headingDeg);
            const pitchRad = CesiumMath.toRadians(pitchDeg);
            const rollRad = CesiumMath.toRadians(rollDeg);
            
            // 创建heading-pitch-roll旋转对象
            const hpr = new Cesium.HeadingPitchRoll(headingRad, pitchRad, rollRad);
            
            // 使用HeadingPitchRoll创建旋转矩阵
            const rotationMatrix = Cesium.Matrix3.fromHeadingPitchRoll(hpr);
            
            // 将旋转矩阵转换为4x4矩阵
            const rotationMatrix4 = Cesium.Matrix4.fromRotation(rotationMatrix);
            
            // 将旋转应用到模型矩阵
            const rotatedMatrix = new Cesium.Matrix4();
            Cesium.Matrix4.multiply(modelMatrix, rotationMatrix4, rotatedMatrix);
            
            // 更新模型矩阵
            modelMatrix = rotatedMatrix;
            
            console.log(`应用旋转: [${headingDeg}°, ${pitchDeg}°, ${rollDeg}°] -> HPR(${headingRad}, ${pitchRad}, ${rollRad})`);
          }
          
          // 应用缩放（如果有）
          if (scale && scale.length === 3) {
            const scaleMatrix = Cesium.Matrix4.fromScale(
              new Cesium.Cartesian3(scale[0] || 1, scale[1] || 1, scale[2] || 1)
            );
            Cesium.Matrix4.multiply(modelMatrix, scaleMatrix, modelMatrix);
          }
          
          // 加载模型
          const model = await Model.fromGltfAsync({
            url: modelUri,
            modelMatrix: modelMatrix,
            scale: 1.0,
          });
          
          // 设置模型的额外属性
          (model as any).id = instance.uid;
          (model as any).name = instance.name;
          (model as any).instanceId = instance.uid;
          
          // 应用材质（如果有）
          if (instance.materials && instance.materials.length > 0) {
            // 这里应该根据实际情况处理材质应用
            // model.customShader = ...
          }
          
          // 添加到场景
          viewerRef.current.scene.primitives.add(model);
          
          // 保存引用以便后续清理
          instanceModelsRef.current.set(instance.uid, model);
          
          successfulLoads.push(instance.uid);
          setLoadingProgress(prev => ({ ...prev, loaded: prev.loaded + 1 }));
          console.log(`已加载模型 "${instance.name}" (ID: ${instance.uid})`);
        } catch (error) {
          console.error(`加载模型 "${instance.name}" 失败:`, error);
          failedLoads.push(instance.uid);
          setLoadingProgress(prev => ({ ...prev, loaded: prev.loaded + 1 }));
        }
      }
      
      console.log(`实例加载完成: ${successfulLoads.length} 个成功, ${failedLoads.length} 个失败`);
      setSceneLoaded(sceneId);
    } catch (error) {
      console.error('加载场景实例失败:', error);
    } finally {
      setLoadingInstances(false);
    }
  }, [viewerRef, origin, loadingInstances, sceneLoaded]);

  return {
    viewerRef,
    instances,
    loadingInstances,
    loadingProgress,
    loadSceneInstances
  };
};