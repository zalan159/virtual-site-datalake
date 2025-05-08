// hooks/useCesiumViewer.ts
import { useRef, useEffect } from 'react';
import { Viewer, Cartesian3 } from 'cesium';
import * as Cesium from 'cesium';

// 确保 Cesium 全局 Token 设置 (如果需要)
// Cesium.Ion.defaultAccessToken = 'YOUR_CESIUM_ION_TOKEN';

export const useCesiumViewer = (cesiumContainerRef: React.RefObject<HTMLDivElement>) => {
  const viewerRef = useRef<Viewer | null>(null);

  useEffect(() => {
    let viewer: Viewer | undefined;
    if (cesiumContainerRef.current && !viewerRef.current) { // 防止重复初始化
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
        selectionIndicator: false, // Gizmo 会处理选中指示
        // 如果需要更高质量的地形或影像，可以在这里配置
        // terrainProvider: await Cesium.createWorldTerrainAsync(),
        // imageryProvider: Cesium.createWorldImagery(),
      });

      viewer.camera.flyTo({
        destination: Cartesian3.fromDegrees(113.2644, 23.1291, 10000),
      });
      viewerRef.current = viewer;
    }

    return () => {
      if (viewerRef.current && !viewerRef.current.isDestroyed()) {
        viewerRef.current.destroy();
        viewerRef.current = null;
      }
    };
  }, [cesiumContainerRef]);

  return viewerRef;
};