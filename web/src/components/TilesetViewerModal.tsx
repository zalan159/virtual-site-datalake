import React, { useRef, useEffect } from 'react';
import * as Cesium from 'cesium';

interface TilesetViewerProps {
  tileset_url: string;
  style?: React.CSSProperties;
}

const TilesetViewer: React.FC<TilesetViewerProps> = ({
  tileset_url,
  style = { width: '100%', height: '100%' }
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Cesium.Viewer | null>(null);
  const tilesetRef = useRef<Cesium.Cesium3DTileset | null>(null);

  // 初始化Cesium
  useEffect(() => {
    if (containerRef.current && !viewerRef.current) {
      // 创建Cesium查看器
      viewerRef.current = new Cesium.Viewer(containerRef.current, {
        timeline: false,
        animation: false,
        baseLayerPicker: false,
        fullscreenButton: false,
        homeButton: false,
        navigationHelpButton: false,
        sceneModePicker: false,
        geocoder: false,
        infoBox: false,
      });

      // 加载3DTiles
      if (tileset_url) {
        loadTileset();
      }
    }

    // 清理函数
    return () => {
      if (viewerRef.current && !viewerRef.current.isDestroyed()) {
        viewerRef.current.destroy();
        viewerRef.current = null;
      }
    };
  }, [tileset_url]);

  // 加载3D Tiles
  const loadTileset = async () => {
    if (!viewerRef.current || !tileset_url) return;

    try {
      // 先移除旧的tileset
      if (tilesetRef.current) {
        viewerRef.current.scene.primitives.remove(tilesetRef.current);
        tilesetRef.current = null;
      }

      // 处理URL，如果是相对路径则添加VITE_MINIO_URL前缀
      let fullTilesetUrl = tileset_url;
      if (tileset_url.startsWith('/')) {
        const minioUrl = import.meta.env.VITE_MINIO_URL || '';
        fullTilesetUrl = `${minioUrl}${tileset_url}`;
      }

      // 加载新的tileset
      tilesetRef.current = await Cesium.Cesium3DTileset.fromUrl(fullTilesetUrl);
      viewerRef.current.scene.primitives.add(tilesetRef.current);

      // 自动聚焦到模型
      viewerRef.current.zoomTo(tilesetRef.current);
    } catch (error) {
      console.error('加载3DTiles失败:', error);
    }
  };

  return (
    <div 
      ref={containerRef} 
      style={style}
    />
  );
};

export default TilesetViewer; 