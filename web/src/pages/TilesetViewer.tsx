import React, { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import * as Cesium from 'cesium';

// 定义图层类型接口
interface TileLayerInfo {
  id: string;
  name: string;
  boundingSphere?: Cesium.BoundingSphere;
}

const TilesetViewer: React.FC = () => {
  const location = useLocation();
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Cesium.Viewer | null>(null);
  const tilesetRef = useRef<Cesium.Cesium3DTileset | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [customLocation, setCustomLocation] = useState<{
    longitude: string;
    latitude: string;
    height: string;
  }>({
    longitude: '116.3912',  // 天安门默认坐标
    latitude: '39.9060',
    height: '500'
  });
  const [tileLayers, setTileLayers] = useState<TileLayerInfo[]>([]);
  const [showLayerList, setShowLayerList] = useState<boolean>(true);
  const [hoveredLayerId, setHoveredLayerId] = useState<string | null>(null);

  // 初始化Cesium Viewer
  useEffect(() => {
    if (!containerRef.current || viewerRef.current) return;
    
    viewerRef.current = new Cesium.Viewer(containerRef.current, {
      timeline: false,
      animation: false,
      baseLayerPicker: false,
      homeButton: true,
      sceneModePicker: true,
      navigationHelpButton: true,
      geocoder: false,
      fullscreenButton: true,
      infoBox: true,
      // 启用地球以便更好地定位
      globe: new Cesium.Globe(Cesium.Ellipsoid.WGS84)
    });
    
    console.log('Cesium Viewer 初始化完成 - 已启用地球');
    
    // 组件卸载时清理
    return () => {
      if (viewerRef.current && !viewerRef.current.isDestroyed()) {
        viewerRef.current.destroy();
        viewerRef.current = null;
      }
    };
  }, []);

  // 飞行到指定位置
  const flyToLocation = (longitude: number, latitude: number, height: number) => {
    if (!viewerRef.current) return;
    
    console.log('直接飞行到位置:', { longitude, latitude, height });
    
    // 直接使用简单的flyTo方法
    viewerRef.current.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(longitude, latitude, height),
      orientation: {
        heading: Cesium.Math.toRadians(0),
        pitch: Cesium.Math.toRadians(-45),
        roll: 0
      },
      duration: 2,
      complete: function() {
        console.log('相机直接飞行完成');
      },
      cancel: function() {
        console.log('相机直接飞行被取消');
      }
    });
  };

  // 飞行到指定的边界球体
  const flyToBoundingSphere = (boundingSphere: Cesium.BoundingSphere) => {
    if (!viewerRef.current) return;
    
    console.log('飞行到边界球体:', boundingSphere);
    
    // 使用flyToBoundingSphere方法
    viewerRef.current.camera.flyToBoundingSphere(boundingSphere, {
      duration: 1.5,
      offset: new Cesium.HeadingPitchRange(
        0.0,
        Cesium.Math.toRadians(-30.0),
        boundingSphere.radius * 2
      ),
      complete: function() {
        console.log('飞行到边界球体完成');
      },
      cancel: function() {
        console.log('飞行到边界球体被取消');
      }
    });
  };

  // 收集3DTiles图层信息
  const collectTileLayers = (tileset: Cesium.Cesium3DTileset) => {
    const layers: TileLayerInfo[] = [];
    
    // 添加根图层
    layers.push({
      id: 'root',
      name: '根图层（整个模型）',
      boundingSphere: tileset.boundingSphere
    });
    
    // 尝试收集子图层
    // 注意：这里的实现可能需要根据实际的3DTiles数据结构进行调整
    try {
      if (tileset.root) {
        // 递归函数，用于遍历tileset的结构
        const processTile = (tile: any, prefix: string, depth: number) => {
          if (!tile) return;
          
          // 只处理有内容的图层
          if (tile.contentReady && tile.content && tile.boundingVolume) {
            const id = `${prefix}-${depth}`;
            const name = `子图层 ${id}`;
            
            // 创建边界球体（如果有边界体积）
            let boundingSphere;
            if (tile.boundingVolume.boundingSphere) {
              boundingSphere = tile.boundingVolume.boundingSphere;
            } else if (tile.content.boundingSphere) {
              boundingSphere = tile.content.boundingSphere;
            }
            
            if (boundingSphere) {
              layers.push({
                id,
                name,
                boundingSphere
              });
            }
          }
          
          // 处理子图层
          if (tile.children && tile.children.length > 0) {
            tile.children.forEach((child: any, index: number) => {
              processTile(child, `${prefix}-${index}`, depth + 1);
            });
          }
        };
        
        // 开始处理根tile的子图层
        if (tileset.root.children && tileset.root.children.length > 0) {
          tileset.root.children.forEach((child: any, index: number) => {
            processTile(child, `${index}`, 1);
          });
        }
      }
    } catch (err) {
      console.warn('收集图层信息时发生错误:', err);
    }
    
    console.log('收集到的图层信息:', layers);
    return layers;
  };

  // 加载模型并处理相机
  useEffect(() => {
    if (!viewerRef.current) return;
    
    // 从URL参数中获取tileset_url和其他信息
    const params = new URLSearchParams(location.search);
    let tilesetUrl = params.get('url');
    const name = params.get('name') || '3DTiles模型';
    const longitude = parseFloat(params.get('longitude') || '0');
    const latitude = parseFloat(params.get('latitude') || '0');
    const height = parseFloat(params.get('height') || '0');
    
    // 如果tilesetUrl是相对路径，则添加VITE_MINIO_URL前缀
    if (tilesetUrl && tilesetUrl.startsWith('/')) {
      const minioUrl = import.meta.env.VITE_MINIO_URL || '';
      tilesetUrl = `${minioUrl}${tilesetUrl}`;
    }

    console.log('解析URL参数:', {
      tilesetUrl,
      name,
      longitude,
      latitude,
      height
    });

    document.title = `查看模型: ${name}`;

    if (!tilesetUrl) {
      setError('没有提供有效的模型URL');
      setLoading(false);
      return;
    }

    // 清理旧的tileset
    if (tilesetRef.current) {
      viewerRef.current.scene.primitives.remove(tilesetRef.current);
      tilesetRef.current = null;
    }

    // 清空图层列表
    setTileLayers([]);

    // 加载3DTiles模型
    const loadTileset = async () => {
      if (!viewerRef.current || !tilesetUrl) return;
      
      try {
        setLoading(true);
        console.log('开始加载3DTiles模型:', tilesetUrl);
        const tileset = await Cesium.Cesium3DTileset.fromUrl(tilesetUrl);
        tilesetRef.current = tileset;
        viewerRef.current.scene.primitives.add(tileset);
        console.log('3DTiles模型加载成功');

        // 创建一个包含模型的BoundingSphere
        const boundingSphere = tileset.boundingSphere;
        console.log('模型边界球体:', boundingSphere);

        // 收集图层信息
        const layers = collectTileLayers(tileset);
        setTileLayers(layers);

        // 如果有坐标信息，则设置相机位置
        if (longitude && latitude) {
          console.log('准备飞行到指定位置:', { longitude, latitude, height });
          
          // 使用简单的flyTo方法
          viewerRef.current.camera.flyTo({
            destination: Cesium.Cartesian3.fromDegrees(longitude, latitude, height || 500),
            orientation: {
              heading: Cesium.Math.toRadians(0),
              pitch: Cesium.Math.toRadians(-45),
              roll: 0
            },
            duration: 2,
            complete: function() {
              console.log('相机飞行完成');
            },
            cancel: function() {
              console.log('相机飞行被取消');
            }
          });
          console.log('相机飞行指令已发出(flyTo)');
        } else {
          // 否则自动定位到模型
          console.log('未提供坐标信息，使用zoomTo自动定位到模型');
          viewerRef.current.zoomTo(tileset);
        }
        setLoading(false);
      } catch (err) {
        console.error('加载3DTiles模型失败:', err);
        setError('加载模型失败，请检查URL是否正确');
        setLoading(false);
      }
    };

    loadTileset();
  }, [location.search]);

  // 处理自定义位置输入变化
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setCustomLocation({
      ...customLocation,
      [name]: value
    });
  };

  // 处理飞行按钮点击
  const handleFlyButtonClick = () => {
    const longitude = parseFloat(customLocation.longitude);
    const latitude = parseFloat(customLocation.latitude);
    const height = parseFloat(customLocation.height);
    
    if (isNaN(longitude) || isNaN(latitude) || isNaN(height)) {
      alert('请输入有效的坐标值');
      return;
    }
    
    flyToLocation(longitude, latitude, height);
  };

  // 处理图层项点击
  const handleLayerClick = (layer: TileLayerInfo) => {
    if (layer.boundingSphere) {
      flyToBoundingSphere(layer.boundingSphere);
    }
  };

  // 切换图层列表显示状态
  const toggleLayerList = () => {
    setShowLayerList(!showLayerList);
  };

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh' }}>
      {loading && (
        <div style={{ 
          position: 'absolute', 
          top: '50%', 
          left: '50%', 
          transform: 'translate(-50%, -50%)',
          background: 'rgba(0, 0, 0, 0.5)',
          color: 'white',
          padding: '20px',
          borderRadius: '5px',
          zIndex: 1000
        }}>
          正在加载模型...
        </div>
      )}
      
      {error && (
        <div style={{ 
          position: 'absolute', 
          top: '50%', 
          left: '50%', 
          transform: 'translate(-50%, -50%)',
          background: 'rgba(255, 0, 0, 0.7)',
          color: 'white',
          padding: '20px',
          borderRadius: '5px',
          zIndex: 1000
        }}>
          错误: {error}
        </div>
      )}
      
      {/* 自定义位置输入控件 */}
      <div style={{
        position: 'absolute',
        top: '10px',
        left: '10px',
        background: 'rgba(255, 255, 255, 0.8)',
        padding: '10px',
        borderRadius: '5px',
        zIndex: 1000
      }}>
        <div>
          <label style={{ display: 'block', marginBottom: '5px' }}>
            经度:
            <input
              type="text"
              name="longitude"
              value={customLocation.longitude}
              onChange={handleInputChange}
              style={{ marginLeft: '5px', width: '80px' }}
            />
          </label>
        </div>
        <div>
          <label style={{ display: 'block', marginBottom: '5px' }}>
            纬度:
            <input
              type="text"
              name="latitude"
              value={customLocation.latitude}
              onChange={handleInputChange}
              style={{ marginLeft: '5px', width: '80px' }}
            />
          </label>
        </div>
        <div>
          <label style={{ display: 'block', marginBottom: '10px' }}>
            高度:
            <input
              type="text"
              name="height"
              value={customLocation.height}
              onChange={handleInputChange}
              style={{ marginLeft: '5px', width: '80px' }}
            />
          </label>
        </div>
        <button 
          onClick={handleFlyButtonClick}
          style={{
            padding: '5px 10px',
            background: '#2c7fb8',
            color: 'white',
            border: 'none',
            borderRadius: '3px',
            cursor: 'pointer',
            width: '100%',
            marginBottom: '10px'
          }}
        >
          飞行到指定位置
        </button>
        
        <button 
          onClick={toggleLayerList}
          style={{
            padding: '5px 10px',
            background: '#7fb82c',
            color: 'white',
            border: 'none',
            borderRadius: '3px',
            cursor: 'pointer',
            width: '100%'
          }}
        >
          {showLayerList ? '隐藏图层列表' : '显示图层列表'}
        </button>
      </div>
      
      {/* 3DTiles图层列表 */}
      {showLayerList && tileLayers.length > 0 && (
        <div style={{
          position: 'absolute',
          top: '10px',
          right: '10px',
          background: 'rgba(255, 255, 255, 0.8)',
          padding: '10px',
          borderRadius: '5px',
          maxHeight: '80vh',
          overflowY: 'auto',
          maxWidth: '300px',
          zIndex: 1000
        }}>
          <h3 style={{ margin: '0 0 10px 0', textAlign: 'center' }}>3DTiles图层列表</h3>
          <div style={{ marginBottom: '5px', color: '#666', fontSize: '12px' }}>
            点击图层可飞行至该图层的位置
          </div>
          <ul style={{ 
            listStyle: 'none', 
            padding: '0', 
            margin: '0',
            maxHeight: '70vh',
            overflowY: 'auto' 
          }}>
            {tileLayers.map((layer) => (
              <li 
                key={layer.id}
                onClick={() => handleLayerClick(layer)}
                onMouseEnter={() => setHoveredLayerId(layer.id)}
                onMouseLeave={() => setHoveredLayerId(null)}
                style={{
                  padding: '8px 10px',
                  margin: '5px 0',
                  background: hoveredLayerId === layer.id ? '#e0e0e0' : '#f0f0f0',
                  borderRadius: '3px',
                  cursor: 'pointer',
                  transition: 'background 0.2s'
                }}
              >
                {layer.name}
              </li>
            ))}
          </ul>
        </div>
      )}
      
      <div 
        ref={containerRef} 
        style={{ width: '100%', height: '100%' }}
      />
    </div>
  );
};

export default TilesetViewer; 