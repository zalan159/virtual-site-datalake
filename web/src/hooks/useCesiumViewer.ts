// hooks/useCesiumViewer.ts
import { useRef, useEffect } from 'react';
import { Viewer, Cartesian3 } from 'cesium';
import * as Cesium from 'cesium';

// 确保 Cesium 全局 Token 设置 (如果需要)
// Cesium.Ion.defaultAccessToken = 'YOUR_CESIUM_ION_TOKEN';

export const useCesiumViewer = (
  cesiumContainerRef: React.RefObject<HTMLDivElement>,
  origin?: { longitude: number; latitude: number; height: number }
) => {
  const viewerRef = useRef<Viewer | null>(null);

  useEffect(() => {
    let viewer: Viewer | undefined;
    if (cesiumContainerRef.current && !viewerRef.current) {
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
        selectionIndicator: false,  
        contextOptions: {
            webgl: {
              preserveDrawingBuffer: true
            }
          }
      });

      // 根据 origin 参数飞行到指定位置，如果没有则使用默认值
      const destination = origin
        ? Cartesian3.fromDegrees(origin.longitude, origin.latitude, origin.height)
        : Cartesian3.fromDegrees(113.2644, 23.1291, 10000); // 默认值

      viewer.camera.flyTo({
        destination,
      });

      viewerRef.current = viewer;
    }

    return () => {
      if (viewerRef.current && !viewerRef.current.isDestroyed()) {
        viewerRef.current.destroy();
        viewerRef.current = null;
      }
    };
  }, [cesiumContainerRef]); // 添加 origin 到依赖项


  // Effect for flying to origin when it changes or on initial load
  useEffect(() => {
    if (viewerRef.current && !viewerRef.current.isDestroyed() && origin) {
      console.log('useCesiumViewer: Flying to origin:', origin);
      viewerRef.current.camera.flyTo({
        destination: Cartesian3.fromDegrees(
            origin.longitude,
          origin.latitude,
          origin.height || 1000 // 提供一个默认高度以防万一
        ),
        duration: 1.5, // 可以调整飞行时间，首次加载可以设为0
      });
    }
  }, [origin]); // 依赖 currentOrigin


  return viewerRef;
};