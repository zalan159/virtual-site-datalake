import React, { useEffect, useRef, useState } from 'react';
import { Typography, Card, Row, Col, Button, Spin, message, Tabs } from 'antd';
import { DownloadOutlined } from '@ant-design/icons';
import { Viewer, Cartesian3, ScreenSpaceEventType, Scene, Model, Transforms, Cartesian2 } from 'cesium';
import { useParams } from 'react-router-dom';
import modelAPI from '../../services/modelApi';
import * as Cesium from 'cesium';
import CesiumGizmo from '../../../cesium-gizmo/src/CesiumGizmo.js';

const { Title } = Typography;

const SceneEditorStandalone: React.FC = () => {
  const cesiumContainerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Viewer | null>(null);
  const { sceneId } = useParams();
  const [models, setModels] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [dragModel, setDragModel] = useState<any>(null);
  const [dragLatLng, setDragLatLng] = useState<{lon: number, lat: number} | null>(null);
  const [materials] = useState([
    {
      id: 'red',
      name: '红色',
      icon: (
        <svg width={40} height={40} viewBox="0 0 40 40" fill="none">
          <rect x="8" y="8" width="24" height="24" rx="4" fill="#ff4d4f" stroke="#a8071a" strokeWidth="2" />
          <rect x="14" y="14" width="12" height="12" rx="2" fill="#fff1f0" stroke="#ff4d4f" strokeWidth="1.5" />
        </svg>
      ),
      customShader: new Cesium.CustomShader({
        fragmentShaderText: `
          void fragmentMain(FragmentInput fsInput, inout czm_modelMaterial material) {
            material.diffuse = vec3(1.0, 0.0, 0.0);
          }
        `
      })
    },
  ]);
  const [selectedModelProps, setSelectedModelProps] = useState<any>(null);
  // 用 useRef 持久化高亮状态，确保事件和渲染同步
  const lastHighlightedRef = useRef<any>(null);
  const lastColorRef = useRef<Cesium.Color | undefined>(undefined);
  const gizmoRef = useRef<any>(null);

  useEffect(() => {
    let viewer: Viewer | undefined;
    let handler: Cesium.ScreenSpaceEventHandler | undefined;

    if (cesiumContainerRef.current) {
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
      });
      viewer.camera.flyTo({
        destination: Cartesian3.fromDegrees(113.2644, 23.1291, 10000),
      });
      viewerRef.current = viewer;

      // 鼠标悬浮高亮
      handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
      handler.setInputAction((movement: any) => {
        // 先恢复上一个高亮模型
        if (lastHighlightedRef.current) { // 只要有高亮过的模型就尝试恢复
          if (lastColorRef.current === undefined) {
            // 如果原始颜色是 undefined (使用材质颜色)，则恢复为 undefined
            lastHighlightedRef.current.color = undefined;
          } else {
            // 否则恢复为之前保存的颜色
            lastHighlightedRef.current.color = Cesium.Color.clone(lastColorRef.current);
          }
          lastHighlightedRef.current = null;
          lastColorRef.current = undefined; // 清空，等待下次高亮
        }

        // 再判断当前是否拾取到新模型并高亮
        const picked = viewer!.scene.pick(movement.endPosition);
        if (picked && picked.primitive && picked.primitive instanceof Cesium.Model) {
          const currentModel = picked.primitive;
          // 保存当前模型的原始颜色（在它被高亮之前）
          lastColorRef.current = currentModel.color ? Cesium.Color.clone(currentModel.color) : undefined;
          lastHighlightedRef.current = currentModel;
          // 设置高亮颜色
          currentModel.color = Cesium.Color.YELLOW.withAlpha(0.7);
        }
      }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

      // 点击显示属性
      handler.setInputAction((movement: any) => {
        const picked = viewer!.scene.pick(movement.position);
        if (picked && picked.primitive && picked.primitive instanceof Cesium.Model) {
          setSelectedModelProps({
            id: picked.primitive.id,
            name: picked.primitive.name,
          });
          // 销毁上一个 gizmo
          if (gizmoRef.current) {
            gizmoRef.current.destroy();
            gizmoRef.current = null;
          }
          // 创建新的 gizmo
          gizmoRef.current = new CesiumGizmo(viewer, {
            item: picked.primitive,
            mode: CesiumGizmo.Mode.TRANSLATE,
            onDragMoving: ({type, result}) => {
              console.log(result);
            }
          });
        } else {
          setSelectedModelProps(null);
          // 关闭 gizmo
          if (gizmoRef.current) {
            gizmoRef.current.destroy();
            gizmoRef.current = null;
          }
        }
      }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
    }

    return () => {
      if (viewer) {
        viewer.destroy();
      }
      if (handler) {
        handler.destroy();
      }
      if (gizmoRef.current) {
        gizmoRef.current.destroy();
        gizmoRef.current = null;
      }
    };
  }, []);

  // 获取模型列表
  useEffect(() => {
    setLoading(true);
    modelAPI.getModels()
      .then(res => {
        // 只保留已转换为glb的模型（有conversion且output_format为GLB）
        const filtered = (Array.isArray(res.data) ? res.data : []).filter((item: any) => {
          return item.conversion && item.conversion.output_format && item.conversion.output_format.toUpperCase() === 'GLB';
        });
        setModels(filtered);
      })
      .catch(() => {
        message.error('获取模型列表失败');
      })
      .finally(() => setLoading(false));
  }, []);

  // 拖拽到Cesium容器时，获取经纬度
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!viewerRef.current) return;
    const rect = cesiumContainerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const scene = viewerRef.current.scene;
    // 用Cesium.Cartesian2
    const cartesian = scene.camera.pickEllipsoid(new Cartesian2(x, y), scene.globe.ellipsoid);
    if (cartesian) {
      const cartographic = Cesium.Cartographic.fromCartesian(cartesian);
      const lon = Cesium.Math.toDegrees(cartographic.longitude);
      const lat = Cesium.Math.toDegrees(cartographic.latitude);
      setDragLatLng({ lon, lat });
    } else {
      setDragLatLng(null);
    }
  };

  // 拖拽释放，加载glb
  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragLatLng(null);

    // 材质拖拽检测
    const materialId = e.dataTransfer.getData('materialId');
    if (materialId) {
      const rect = cesiumContainerRef.current?.getBoundingClientRect();
      if (!rect || !viewerRef.current) return;
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const windowPosition = new Cesium.Cartesian2(x, y);
      const picked = viewerRef.current.scene.pick(windowPosition);
      if (picked && picked.primitive && picked.primitive instanceof Cesium.Model) {
        const mat = materials.find(m => m.id === materialId);
        if (mat) {
          picked.primitive.customShader = mat.customShader;
          message.success('材质已应用');
        }
      }
      return;
    }

    const modelId = e.dataTransfer.getData('modelId');
    const model = models.find((m: any) => (m._id || m.id || m.fileId) === modelId);
    if (!model) return;

    try {
      const resp = await modelAPI.getConvertedModelDownloadUrl(modelId);
      const url = resp.data?.download_url;
      console.log('glb下载链接:', url);
      if (!url) {
        message.error('获取glb链接失败');
        return;
      }

      let lon = 113.2644, lat = 23.1291, height = 0;
      if (dragLatLng) {
        lon = dragLatLng.lon;
        lat = dragLatLng.lat;
      }

      if (viewerRef.current) {
        const modelMatrix = Cesium.Transforms.eastNorthUpToFixedFrame(
          Cesium.Cartesian3.fromDegrees(lon, lat, height)
        );
        const glbModel = await Cesium.Model.fromGltfAsync({
          url,
          modelMatrix,
          scale: 1.0,
        });

        glbModel.readyEvent.addEventListener(() => {
          message.success('模型已加载完成');
          // 移动镜头到模型上方
          // viewerRef.current!.camera.flyTo({
          //   destination: glbModel.boundingSphere.center,
          //   duration: 2,
          // });
          // 打印模型坐标
          console.log('模型坐标:', glbModel.boundingSphere.center);
          console.log('boundingSphere:', glbModel.boundingSphere);
        });
        viewerRef.current.scene.primitives.add(glbModel);
      }
    } catch (err) {
      console.error('加载glb异常', err);
      message.error('加载glb失败');
    }
  };

  // 下载模型
  const handleDownload = async (fileId: string) => {
    try {
      const response = await modelAPI.getModelDownloadUrl(fileId);
      if (response.data && response.data.download_url) {
        window.open(response.data.download_url, '_blank');
      } else {
        message.error('下载链接不可用');
      }
    } catch (error) {
      message.error('下载失败');
    }
  };

  // 自定义立方体图标，支持拖拽
  const CubeIcon: React.FC<{ size?: number; onDragStart?: (e: React.DragEvent) => void; draggable?: boolean }> = ({ size = 40, onDragStart, draggable }) => (
    <div
      style={{ display: 'inline-block', cursor: draggable ? 'grab' : 'default' }}
      draggable={draggable}
      onDragStart={onDragStart}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 40 40"
        fill="none"
      >
        <rect x="8" y="8" width="24" height="24" rx="4" fill="#1890ff" stroke="#0050b3" strokeWidth="2" />
        <rect x="14" y="14" width="12" height="12" rx="2" fill="#e6f7ff" stroke="#1890ff" strokeWidth="1.5" />
      </svg>
    </div>
  );

  return (
    <div style={{ height: '100vh', width: '100vw', background: '#fff', position: 'relative' }}>
      <Title level={3} style={{ position: 'absolute', zIndex: 10, left: 24, top: 16 }}>
        独立场景编辑器 {sceneId ? `(ID: ${sceneId})` : ''}
      </Title>
      <div
        ref={cesiumContainerRef}
        style={{ width: '100%', height: '100%' }}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onMouseLeave={() => {
          // 鼠标移出画布时恢复颜色
          if (lastHighlightedRef.current && lastColorRef.current) {
            lastHighlightedRef.current.color = Cesium.Color.clone(lastColorRef.current, lastHighlightedRef.current.color);
            lastHighlightedRef.current = null;
            lastColorRef.current = undefined;
          }
        }}
      />
      {/* 底部Tabs容器 */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          bottom: 0,
          width: '100%',
          height: '20%',
          background: '#fafafa',
          borderTop: '1px solid #eee',
          overflowY: 'auto',
          zIndex: 20,
          padding: 0,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <Tabs
          defaultActiveKey="models"
          style={{ flex: 1, padding: '0 16px' }}
          items={[{
            key: 'models',
            label: '模型',
            children: (
              loading ? (
                <Spin style={{ marginTop: 32 }} />
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, padding: '16px 0' }}>
                  {models.length === 0 ? (
                    <div style={{ color: '#888', width: '100%', textAlign: 'center', lineHeight: '80px' }}>暂无glb模型</div>
                  ) : (
                    models.map((model: any) => (
                      <div
                        key={model._id || model.id || model.fileId}
                        style={{
                          width: 80,
                          height: 80,
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: '#fff',
                          border: '1px solid #e6e6e6',
                          borderRadius: 8,
                          boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                        }}
                      >
                        <CubeIcon
                          draggable
                          onDragStart={e => {
                            e.dataTransfer.setData('modelId', model._id || model.id || model.fileId);
                          }}
                        />
                        <div style={{ fontSize: 12, color: '#333', margin: '4px 0', textAlign: 'center', width: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={model.filename || model.name}>
                          {model.filename || model.name}
                        </div>
                        <Button
                          type="link"
                          size="small"
                          icon={<DownloadOutlined />}
                          style={{ padding: 0, height: 20, fontSize: 14 }}
                          onClick={e => {
                            e.stopPropagation();
                            handleDownload(model._id || model.id || model.fileId);
                          }}
                        >
                          下载
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              )
            ),
          }, {
            key: 'materials',
            label: '材质',
            children: (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, padding: '16px 0' }}>
                {materials.map(mat => (
                  <div
                    key={mat.id}
                    draggable
                    onDragStart={e => e.dataTransfer.setData('materialId', mat.id)}
                    style={{ width: 80, height: 80, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#fff', border: '1px solid #e6e6e6', borderRadius: 8 }}
                  >
                    {mat.icon}
                    <div style={{ fontSize: 12, color: '#333', margin: '4px 0', textAlign: 'center' }}>{mat.name}</div>
                  </div>
                ))}
              </div>
            ),
          }]}
        />
      </div>
      {/* 拖拽时显示经纬度 */}
      {dragLatLng && (
        <div style={{ position: 'absolute', left: 16, bottom: '22%', zIndex: 100, background: '#fff', padding: '4px 12px', borderRadius: 4, boxShadow: '0 2px 8px rgba(0,0,0,0.08)', color: '#333', fontSize: 13 }}>
          经纬度：{dragLatLng.lon.toFixed(6)}, {dragLatLng.lat.toFixed(6)}
        </div>
      )}
      {/* 拓展：点击模型后显示属性弹窗 */}
      {selectedModelProps && (
        <div style={{
          position: 'absolute',
          right: 24,
          top: 24,
          zIndex: 100,
          background: '#fff',
          padding: '16px 24px',
          borderRadius: 8,
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
        }}>
          <div style={{fontWeight: 'bold', marginBottom: 8}}>模型属性</div>
          <div>ID: {selectedModelProps.id || '无'}</div>
          <div>名称: {selectedModelProps.name || '无'}</div>
          {/* 其他属性可在此补充 */}
          <Button size="small" style={{marginTop: 8}} onClick={() => setSelectedModelProps(null)}>关闭</Button>
        </div>
      )}
    </div>
  );
};

export default SceneEditorStandalone; 