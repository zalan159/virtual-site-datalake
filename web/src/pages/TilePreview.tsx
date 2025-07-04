import React, { useRef, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Spin, Alert, Button, Typography } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import * as Cesium from 'cesium';
import { wmtsAPI, WMTSLayer } from '../services/wmtsApi';

const { Title } = Typography;

const TilePreview: React.FC = () => {
  const [searchParams] = useSearchParams();
  const wmtsId = searchParams.get('wmtsId');
  
  const cesiumContainerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Cesium.Viewer | null>(null);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [wmtsData, setWmtsData] = useState<WMTSLayer | null>(null);

  // 初始化Cesium Viewer
  useEffect(() => {
    if (cesiumContainerRef.current && !viewerRef.current) {
      try {
        // 使用默认配置创建Viewer
        const viewer = new Cesium.Viewer(cesiumContainerRef.current);
        viewerRef.current = viewer;
      } catch (err) {
        console.error('初始化Cesium失败:', err);
        setError('初始化3D视图失败');
        setLoading(false);
      }
    }

    return () => {
      if (viewerRef.current && !viewerRef.current.isDestroyed()) {
        viewerRef.current.destroy();
        viewerRef.current = null;
      }
    };
  }, []);

  // 加载WMTS数据
  useEffect(() => {
    if (!wmtsId || !viewerRef.current) {
      if (!wmtsId) {
        setError('缺少瓦片图层ID');
        setLoading(false);
      }
      return;
    }

    const loadWMTSData = async () => {
      try {
        setLoading(true);
        const response = await wmtsAPI.getWMTSById(wmtsId);
        const wmtsLayer = response.data;
        setWmtsData(wmtsLayer);

        if (wmtsLayer) {
          await loadWMTSLayer(wmtsLayer);
        }
      } catch (err: any) {
        console.error('加载WMTS数据失败:', err);
        setError(err.response?.data?.detail || '加载瓦片数据失败');
      } finally {
        setLoading(false);
      }
    };

    loadWMTSData();
  }, [wmtsId, viewerRef.current]);

  const loadWMTSLayer = async (wmtsLayer: WMTSLayer) => {
    if (!viewerRef.current) return;

    try {
      let imageryProvider;

      if (wmtsLayer.source_type === 'file' && wmtsLayer.tile_url_template) {
        // 文件类型的WMTS (tpkx)
        const minioUrl = import.meta.env.VITE_MINIO_URL || '';
        const tileUrl = `${minioUrl}${wmtsLayer.tile_url_template}`;

        imageryProvider = new Cesium.UrlTemplateImageryProvider({
          url: tileUrl,
          minimumLevel: wmtsLayer.min_zoom || 0,
          maximumLevel: wmtsLayer.max_zoom || 18,
          rectangle: wmtsLayer.bounds ? Cesium.Rectangle.fromDegrees(
            wmtsLayer.bounds.west,
            wmtsLayer.bounds.south,
            wmtsLayer.bounds.east,
            wmtsLayer.bounds.north
          ) : undefined
        });
      } else if (wmtsLayer.source_type === 'url' && wmtsLayer.service_url) {
        // URL类型的WMTS服务
        let serviceUrl = wmtsLayer.service_url;
        
        // 如果是天地图服务，需要特殊处理
        if (serviceUrl.includes('tianditu.gov.cn')) {
          imageryProvider = new Cesium.WebMapTileServiceImageryProvider({
            url: serviceUrl,
            layer: wmtsLayer.layer_name || 'img', // 天地图默认使用img图层, 'vec' for vector
            style: 'default',
            format: wmtsLayer.format || 'image/png',
            tileMatrixSetID: wmtsLayer.tile_matrix_set || 'c', // 天地图wgs84
            maximumLevel: wmtsLayer.max_zoom || 18,
            minimumLevel: wmtsLayer.min_zoom || 0,
            subdomains: ['t0','t1','t2','t3','t4','t5','t6','t7'] //天地图负载均衡
          });
        } else {
          // 其他WMTS服务
          imageryProvider = new Cesium.WebMapTileServiceImageryProvider({
            url: serviceUrl,
            layer: wmtsLayer.layer_name || '',
            style: 'default',
            format: wmtsLayer.format || 'image/png',
            tileMatrixSetID: wmtsLayer.tile_matrix_set || 'GoogleMapsCompatible',
            maximumLevel: wmtsLayer.max_zoom || 18,
            minimumLevel: wmtsLayer.min_zoom || 0
          });
        }
      }

      if (imageryProvider) {
        // 清除现有图层
        viewerRef.current.imageryLayers.removeAll();
        
        // 添加WMTS图层
        viewerRef.current.imageryLayers.addImageryProvider(imageryProvider);
        
        // 如果有边界信息，飞到该区域
        if (wmtsLayer.bounds) {
          const rectangle = Cesium.Rectangle.fromDegrees(
            wmtsLayer.bounds.west,
            wmtsLayer.bounds.south,
            wmtsLayer.bounds.east,
            wmtsLayer.bounds.north
          );
          
          viewerRef.current.camera.flyTo({
            destination: rectangle
          });
        }
      }
    } catch (err) {
      console.error('加载WMTS图层失败:', err);
      setError('加载瓦片图层失败');
    }
  };

  const handleGoBack = () => {
    // 如果是新页签，尝试关闭页签，否则回到上一页
    if (window.history.length > 1) {
      window.history.back();
    } else {
      window.close();
    }
  };

  if (error) {
    return (
      <div style={{ 
        height: '100vh', 
        display: 'flex', 
        flexDirection: 'column',
        justifyContent: 'center', 
        alignItems: 'center',
        padding: '20px'
      }}>
        <Alert
          message="加载失败"
          description={error}
          type="error"
          showIcon
          style={{ marginBottom: '16px', maxWidth: '400px' }}
        />
        <Button onClick={handleGoBack} icon={<ArrowLeftOutlined />}>
          关闭页面
        </Button>
      </div>
    );
  }

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Cesium容器 */}
      <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
        {loading && (
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 1000
          }}>
            <Spin size="large" />
            <div style={{ marginTop: '16px', textAlign: 'center' }}>
              正在加载瓦片数据...
            </div>
          </div>
        )}
        <div
          ref={cesiumContainerRef}
          style={{ 
            width: '100%', 
            height: '100%',
            opacity: loading ? 0.3 : 1,
            transition: 'opacity 0.3s'
          }}
        />
      </div>
    </div>
  );
};

export default TilePreview;