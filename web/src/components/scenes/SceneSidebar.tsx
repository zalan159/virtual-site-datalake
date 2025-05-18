import React, { useState, useCallback, useEffect } from 'react';
import { Card, Input, Tabs, Spin, App as AntdApp } from 'antd';
import * as Cesium from 'cesium';
import { SelectedModelInfo } from '../../hooks/useCesiumInteractions';
import { getSceneDetail, updateSceneProperty, updateScenePreviewImage, getSceneInstanceTree, changeInstanceParent } from '../../services/sceneApi';
import DynamicPropertyForm from '../../components/DynamicPropertyForm';
import InstanceTree from './InstanceTree';

interface SceneSidebarProps {
  sceneId?: string;
  viewerRef?: React.RefObject<any>;
  style?: React.CSSProperties;
  selectedInstanceId?: string | null;
  onInstanceSelect?: (instanceId: string | null) => void;
  gizmoRef?: React.MutableRefObject<any | null>;
  onModelSelect?: (modelInfo: SelectedModelInfo | null) => void;
  setFetchInstanceTree?: (fn: () => void) => void;
}

const SceneSidebar: React.FC<SceneSidebarProps> = ({
  sceneId,
  viewerRef,
  style,
  selectedInstanceId,
  onInstanceSelect,
  gizmoRef,
  onModelSelect,
  setFetchInstanceTree
}) => {
  const [sceneInfo, setSceneInfo] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const { message } = AntdApp.useApp();
  
  // 实例树状态
  const [instanceTreeData, setInstanceTreeData] = useState<any[]>([]);
  const [loadingInstanceTree, setLoadingInstanceTree] = useState(false);
  const [expandedKeys, setExpandedKeys] = useState<React.Key[]>([]);
  const [selectedKeys, setSelectedKeys] = useState<React.Key[]>([]);
  
  // 搜索相关状态
  const [searchValue, setSearchValue] = useState('');
  const [autoExpandParent, setAutoExpandParent] = useState(true);
  
  const [isPickingOrigin, setIsPickingOrigin] = useState(false); // 是否处于选点模式
  const [pickedOrigin, setPickedOrigin] = useState<{longitude: number, latitude: number, height: number} | null>(null); // 选中的原点
  
  const fetchSceneData = useCallback(() => {
    if (!sceneId) return;
    setLoading(true);
    getSceneDetail(sceneId)
      .then(res => {
        console.log('场景数据:', res.data);
        setSceneInfo(res.data);
      })
      .finally(() => setLoading(false));
  }, [sceneId]);

  // 获取实例树数据
  const fetchInstanceTree = useCallback(() => {
    if (!sceneId) return;
    setLoadingInstanceTree(true);
    getSceneInstanceTree(sceneId)
      .then(res => {
        // 将后端返回的树结构转换为Ant Design Tree所需的结构
        const convertToTreeData = (node: any) => {
          return {
            key: node.uid,
            title: node.name,
            data: node,
            children: node.children?.map(convertToTreeData) || [],
            isLeaf: node.children?.length === 0
          };
        };
        
        // 预处理数据，返回的是ROOT节点的子节点数组
        const children = res.data.children || [];
        const treeData = children.map(convertToTreeData);
        
        setInstanceTreeData(treeData);
        // 默认展开所有节点
        const allKeys = getAllKeys(treeData);
        setExpandedKeys(allKeys);
      })
      .catch(err => {
        console.error('获取实例树失败:', err);
        message.error('获取实例树失败');
      })
      .finally(() => setLoadingInstanceTree(false));
  }, [sceneId, message]);
  
  // 递归获取所有节点的key用于默认展开
  const getAllKeys = (data: any[]): React.Key[] => {
    let keys: React.Key[] = [];
    data.forEach(item => {
      keys.push(item.key);
      if (item.children && item.children.length > 0) {
        keys = [...keys, ...getAllKeys(item.children)];
      }
    });
    return keys;
  };

  useEffect(() => {
    fetchSceneData();
    fetchInstanceTree();
  }, [fetchSceneData, fetchInstanceTree]);

  // 保存所有属性（忽略预览图）
  const handleSave = async (values: any): Promise<void> => {
    if (!sceneId) return;
    // 只保存非预览图字段
    const { preview_image, ...rest } = values || {};
    if (Object.keys(rest).length > 0) {
      await updateSceneProperty(sceneId, rest);
      // 如果有 origin 字段被更新，则刷新整个页面
      if (rest.origin) {
        window.location.reload();
      }
    }
  };

  // 处理拖拽
  const onDragEnter = (info: any) => {
    console.log('Drag enter:', info);
  };

  const onDrop = (info: any) => {
    const dropKey = info.node.key;
    const dragKey = info.dragNode.key;
    
    // 阻止拖拽到根节点（如需特殊处理根节点的情况）
    if (!dropKey) return;
    
    // 阻止自己拖到自己身上
    if (dragKey === dropKey) return;
    
    // 确认将实例移动到新父级
    message.loading('正在更新实例结构...', 0);
    
    changeInstanceParent(dragKey, dropKey)
      .then(() => {
        message.destroy();
        message.success('实例结构已更新');
        // 重新获取实例树数据
        fetchInstanceTree();
      })
      .catch(err => {
        message.destroy();
        message.error('更新实例结构失败: ' + (err.response?.data?.detail || err.message));
      });
  };

  // 飞到原点
  const handleFlyToOrigin = (origin: {longitude: number, latitude: number, height: number}) => {
    if (!origin || !viewerRef?.current) return;
    const { longitude, latitude, height } = origin;
    if (
      typeof longitude === 'number' &&
      typeof latitude === 'number' &&
      typeof height === 'number'
    ) {
      viewerRef.current.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(longitude, latitude, height || 1000),
        duration: 1.5
      });
    }
  };

  // 更新预览图
  const handleUpdatePreviewImage = async () => {
    if (!sceneId || !viewerRef?.current) return;
    try {
      // 强制渲染一帧
      viewerRef.current.scene.requestRender();
      // 等待下一帧（确保渲染完成）
      await new Promise(resolve => setTimeout(resolve, 100));
      // 获取 Cesium canvas 截图
      const canvas = viewerRef.current.scene.canvas;
      const base64 = canvas.toDataURL('image/png');
      await updateScenePreviewImage(sceneId, base64);
      message.success('预览图已更新');
      fetchSceneData();
    } catch (e) {
      message.error('预览图更新失败');
    }
  };

  // 当外部 selectedInstanceId 改变时更新内部 selectedKeys
  useEffect(() => {
    if (selectedInstanceId) {
      setSelectedKeys([selectedInstanceId]);
    } else {
      setSelectedKeys([]);
    }
  }, [selectedInstanceId]);

  // 递归查找所有包含关键字的 key
  const getParentKey = (key: React.Key, tree: any[]): React.Key | null => {
    let parentKey: React.Key | null = null;
    for (let node of tree) {
      if (node.children) {
        if (node.children.some((child: any) => child.key === key)) {
          parentKey = node.key;
        } else if (getParentKey(key, node.children)) {
          parentKey = getParentKey(key, node.children);
        }
      }
    }
    return parentKey;
  };

  // 搜索时展开所有包含关键字的父节点
  const onSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { value } = e.target;
    setSearchValue(value);
    if (!value) {
      setExpandedKeys(getAllKeys(instanceTreeData));
      setAutoExpandParent(false);
      return;
    }
    const expandedKeys = instanceTreeData
      .reduce((acc: React.Key[], node: any) => {
        const search = (n: any): React.Key[] => {
          let keys: React.Key[] = [];
          if (n.title && n.title.indexOf(value) > -1) {
            keys.push(n.key);
          }
          if (n.children) {
            n.children.forEach((child: any) => {
              keys = keys.concat(search(child));
            });
          }
          return keys;
        };
        return acc.concat(search(node));
      }, [])
      .map((key: React.Key) => getParentKey(key, instanceTreeData) as React.Key)
      .filter((key, i, self) => key && self.indexOf(key) === i);
    setExpandedKeys(expandedKeys as React.Key[]);
    setAutoExpandParent(true);
  };

  // 传递 fetchInstanceTree 给父组件
  useEffect(() => {
    if (setFetchInstanceTree) {
      setFetchInstanceTree(fetchInstanceTree);
    }
  }, [setFetchInstanceTree, fetchInstanceTree]);

  // 触发地图选点
  const startPickOrigin = () => {
    setIsPickingOrigin(true);
  };

  // 选点完成后回调
  const handlePickOriginComplete = (origin: {longitude: number, latitude: number, height: number}) => {
    setIsPickingOrigin(false);
    setPickedOrigin(origin);
    // 更新场景原点属性（假设属性名为origin）
    if (sceneId && origin) {
      updateSceneProperty(sceneId, { origin });
      setSceneInfo((prev: any) => {
        if (!prev) return prev;
        return {
          ...prev,
          data: {
            ...prev.data,
            origin,
          }
        };
      });
      // 选点后也刷新整个页面
      window.location.reload();
    }
  };

  useEffect(() => {
    if (!isPickingOrigin || !viewerRef?.current) return;
    const viewer = viewerRef.current;
    const canvas = viewer.scene.canvas;
    // 设置鼠标样式
    canvas.style.cursor = 'crosshair';

    // 创建悬浮div显示坐标
    let coordDiv = document.createElement('div');
    coordDiv.style.position = 'absolute';
    coordDiv.style.top = '10px';
    coordDiv.style.left = '50%';
    coordDiv.style.transform = 'translateX(-50%)';
    coordDiv.style.background = 'rgba(0,0,0,0.7)';
    coordDiv.style.color = '#fff';
    coordDiv.style.padding = '4px 12px';
    coordDiv.style.borderRadius = '4px';
    coordDiv.style.zIndex = '9999';
    coordDiv.style.pointerEvents = 'none';
    coordDiv.innerText = '请在地图上选点（按ESC取消）';
    canvas.parentElement?.appendChild(coordDiv);

    // 鼠标移动事件
    const mouseMoveHandler = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const cartesian = viewer.camera.pickEllipsoid(new Cesium.Cartesian2(x, y), viewer.scene.globe.ellipsoid);
      if (cartesian) {
        const carto = Cesium.Cartographic.fromCartesian(cartesian);
        const lon = Cesium.Math.toDegrees(carto.longitude);
        const lat = Cesium.Math.toDegrees(carto.latitude);
        // 获取地形高程
        let height = 0;
        if (viewer.scene.globe) {
          height = viewer.scene.globe.getHeight(carto) || 0;
        }
        coordDiv.innerText = `经度: ${lon.toFixed(6)}  纬度: ${lat.toFixed(6)}  高程: ${height.toFixed(2)}m  （按ESC取消）`;
      } else {
        coordDiv.innerText = '请在地图上选点（按ESC取消）';
      }
    };
    canvas.addEventListener('mousemove', mouseMoveHandler);

    // 鼠标点击事件
    const clickHandler = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const cartesian = viewer.camera.pickEllipsoid(new Cesium.Cartesian2(x, y), viewer.scene.globe.ellipsoid);
      if (cartesian) {
        const carto = Cesium.Cartographic.fromCartesian(cartesian);
        const lon = Cesium.Math.toDegrees(carto.longitude);
        const lat = Cesium.Math.toDegrees(carto.latitude);
        let height = 0;
        if (viewer.scene.globe) {
          height = viewer.scene.globe.getHeight(carto) || 0;
        }
        handlePickOriginComplete({ longitude: lon, latitude: lat, height });
      } else {
        handlePickOriginComplete({ longitude: 0, latitude: 0, height: 0 });
      }
    };
    canvas.addEventListener('click', clickHandler);

    // 屏蔽Cesium默认点击事件（如模型选中等）
    const preventCesiumClick = (e: MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
    };
    canvas.addEventListener('mousedown', preventCesiumClick, true);
    canvas.addEventListener('mouseup', preventCesiumClick, true);

    // esc键取消
    const escHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsPickingOrigin(false);
      }
    };
    document.addEventListener('keydown', escHandler);

    return () => {
      canvas.style.cursor = '';
      canvas.removeEventListener('mousemove', mouseMoveHandler);
      canvas.removeEventListener('click', clickHandler);
      canvas.removeEventListener('mousedown', preventCesiumClick, true);
      canvas.removeEventListener('mouseup', preventCesiumClick, true);
      document.removeEventListener('keydown', escHandler);
      coordDiv.remove();
    };
  }, [isPickingOrigin, viewerRef, handlePickOriginComplete]);

  return (
    <Card
      style={{
        position: 'absolute',
        top: 0,
        right: 0,
        width: '20vw',
        height: '80vh',
        zIndex: 100,
        borderRadius: '8px 0 0 8px',
        overflow: 'auto',
        padding: 0,
        ...style
      }}
      styles={{
        body: { padding: '16px 0', height: '100%', overflow: 'auto' }
      }}
    >

      {!sceneInfo ? (
        <Spin spinning={loading} style={{ margin: '100px auto', display: 'block', textAlign: 'center' }}>
          <div>加载场景数据...</div>
        </Spin>
      ) : (
        <Tabs 
          defaultActiveKey="scene" 
          style={{ width: '100%', height: '100%' }}
          tabBarStyle={{ margin: 0 }}
          items={[
            {
              key: 'scene',
              label: '场景设置',
              children: (
                <DynamicPropertyForm
                  entityId={sceneId || ''}
                  data={sceneInfo.data}
                  metadata={sceneInfo.metadata}
                  loading={loading}
                  onSave={handleSave}
                  onRefresh={fetchSceneData}
                  sectionTitle="场景属性"
                  onFlyToOrigin={handleFlyToOrigin}
                  onUpdatePreviewImage={handleUpdatePreviewImage}
                  startPickOrigin={startPickOrigin}
                  isPickingOrigin={isPickingOrigin}
                  pickedOrigin={pickedOrigin}
                />
              )
            },
            {
              key: 'instance',
              label: '实例管理',
              children: (

                  
                    <InstanceTree 
                      instanceTreeData={instanceTreeData}
                      loadingInstanceTree={loadingInstanceTree}
                      searchValue={searchValue}
                      expandedKeys={expandedKeys}
                      selectedKeys={selectedKeys}
                      autoExpandParent={autoExpandParent}
                      viewerRef={viewerRef}
                      gizmoRef={gizmoRef}
                      onModelSelect={onModelSelect}
                      onInstanceSelect={onInstanceSelect}
                      selectedInstanceId={selectedInstanceId}
                      onDragEnter={onDragEnter}
                      onDrop={onDrop}
                      onExpand={setExpandedKeys}
                      fetchInstanceTree={fetchInstanceTree}
                    />
                 

              )
            }
          ]}
        />
      )}
    </Card>
  );
};

export default SceneSidebar; 