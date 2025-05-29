import React, { useEffect, useCallback } from 'react';
import { Button, Modal, Space, Spin, Tree, Typography, App as AntdApp } from 'antd';
import { EyeOutlined, EyeInvisibleOutlined, AimOutlined, DeleteOutlined } from '@ant-design/icons';
import * as Cesium from 'cesium';
import { SelectedModelInfo } from '../../hooks/useCesiumInteractions';
// @ts-ignore
import CesiumGizmo from '../../../cesium-gizmo/src/CesiumGizmo.js';
import api from '../../services/axiosConfig';
import { useCesiumGizmo } from '../../hooks/useCesiumGizmo';

interface InstanceTreeProps {
  instanceTreeData: any[];
  loadingInstanceTree: boolean;
  searchValue: string;
  expandedKeys: React.Key[];
  selectedKeys: React.Key[];
  autoExpandParent: boolean;
  viewerRef?: React.RefObject<any>;
  gizmoRef?: React.MutableRefObject<any | null>;
  onModelSelect?: (modelInfo: SelectedModelInfo | null) => void;
  onInstanceSelect?: (instanceId: string | null) => void;
  selectedInstanceId?: string | null;
  onDragEnter: (info: any) => void;
  onDrop: (info: any) => void;
  onExpand: (expandedKeys: React.Key[]) => void;
  fetchInstanceTree: () => void;
}

const InstanceTree: React.FC<InstanceTreeProps> = ({
  instanceTreeData,
  loadingInstanceTree,
  searchValue,
  expandedKeys,
  selectedKeys,
  autoExpandParent,
  viewerRef,
  gizmoRef,
  onModelSelect,
  onInstanceSelect,
  selectedInstanceId,
  onDragEnter,
  onDrop,
  onExpand,
  fetchInstanceTree
}) => {
  const { message } = AntdApp.useApp();
  
  // 为了避免类型错误，直接实现清除和设置 gizmo 的函数
  const clearGizmoSafely = useCallback(() => {
    if (gizmoRef?.current) {
      gizmoRef.current.destroy();
      gizmoRef.current = null;
    }
  }, [gizmoRef]);
  
  const setupGizmoSafely = useCallback((primitive: Cesium.Model) => {
    if (viewerRef?.current && gizmoRef) {
      gizmoRef.current = new CesiumGizmo(viewerRef.current, {
        item: primitive,
        mode: CesiumGizmo.Mode.TRANSLATE,
        onDragEnd: ({type, result}: {type: any, result: any}) => {
          console.log('Gizmo drag end:', type, result);
        }
      });
    }
  }, [viewerRef, gizmoRef]);

  // 处理实例点击
  const handleInstanceSelect = (selectedKeys: React.Key[], info: any) => {
    if (selectedKeys.length > 0 && info.node?.data) {
      console.log('选中实例:', info.node.data);
      onInstanceSelect?.(info.node.data.uid);
      
      if (viewerRef?.current && info.node.data.uid) {
        // 找到该实例并定位到它
        const scene = viewerRef.current.scene;
        const primitives = scene.primitives;
        
        // 先清除所有模型的高亮状态
        for (let i = 0; i < primitives.length; i++) {
          const primitive = primitives.get(i);
          if (primitive instanceof Cesium.Model) {
            // 恢复原始颜色
            primitive.color = Cesium.Color.WHITE;
            // 清除轮廓效果
            if (primitive.silhouetteColor && primitive.silhouetteSize) {
              primitive.silhouetteColor = Cesium.Color.WHITE;
              primitive.silhouetteSize = 0;
            }
          }
        }
        
        // 遍历所有图元找到匹配的模型
        for (let i = 0; i < primitives.length; i++) {
          const primitive = primitives.get(i);
          if (primitive instanceof Cesium.Model && primitive.id === info.node.data.uid) {
            // 直接调用模型选中逻辑
            const modelInfo = {
              id: primitive.id || 'N/A',
              name: (primitive as any).name || 'Unnamed Model',
              primitive: primitive
            };
            
            // 清除之前的高亮和 gizmo
            clearGizmoSafely();
            
            // 创建新的 gizmo
            setupGizmoSafely(primitive);
            
            // 设置选中模型的边缘高亮效果
            primitive.color = Cesium.Color.ORANGE.withAlpha(0.8);
            
            // 如果模型支持轮廓效果，设置轮廓
            if (primitive.silhouetteColor && primitive.silhouetteSize) {
              primitive.silhouetteColor = Cesium.Color.ORANGE;
              primitive.silhouetteSize = 2.0;
            }
            
            // 通知父组件模型被选中
            onModelSelect?.(modelInfo);
            break;
          }
        }
      }
    } else {
      onInstanceSelect?.(null);
      
      // 清除所有模型的高亮状态
      if (viewerRef?.current) {
        const scene = viewerRef.current.scene;
        const primitives = scene.primitives;
        for (let i = 0; i < primitives.length; i++) {
          const primitive = primitives.get(i);
          if (primitive instanceof Cesium.Model) {
            primitive.color = Cesium.Color.WHITE;
            if (primitive.silhouetteColor && primitive.silhouetteSize) {
              primitive.silhouetteColor = Cesium.Color.WHITE;
              primitive.silhouetteSize = 0;
            }
          }
        }
      }
      
      // 清除 gizmo
      clearGizmoSafely();
    }
  };

  // 处理实例显示/隐藏
  const handleToggleVisibility = (node: any, e: React.MouseEvent) => {
    e.stopPropagation(); // 阻止事件冒泡，避免触发节点选中
    if (!viewerRef?.current) return;

    const scene = viewerRef.current.scene;
    const primitives = scene.primitives;
    
    // 查找对应的模型
    for (let i = 0; i < primitives.length; i++) {
      const primitive = primitives.get(i);
      if (primitive instanceof Cesium.Model && primitive.id === node.data.uid) {
        // 切换显示状态
        primitive.show = !primitive.show;
        // 更新节点数据
        node.data.show = primitive.show;
        // 强制触发重新渲染
        // 注意：这里不再直接修改 instanceTreeData，而是通过调用 fetchInstanceTree 来更新树
        fetchInstanceTree();
        break;
      }
    }
  };

  // 处理跳转到实例
  const handleFlyTo = (node: any, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!viewerRef?.current) return;

    const scene = viewerRef.current.scene;
    const primitives = scene.primitives;
    console.log('[handleFlyTo] node.data:', node.data);
    console.log('[handleFlyTo] assetType:', node.data.asset_type);
    // 判断是否为threeDTiles类型
    if (node.data.asset_type === 'threeDTiles') {
      console.log('[handleFlyTo] 进入threeDTiles分支');
      // 查找对应的3DTileset
      for (let i = 0; i < primitives.length; i++) {
        const primitive = primitives.get(i);
        console.log(`[handleFlyTo] primitive[${i}] type:`, primitive?.constructor?.name, 'id:', (primitive as any).id);
        if (
          primitive instanceof Cesium.Cesium3DTileset &&
          (primitive as any).id === node.data.uid
        ) {
          console.log('[handleFlyTo] 找到匹配的Cesium3DTileset:', primitive);
          // 跳到root层
          const boundingSphere = primitive.boundingSphere;
          if (boundingSphere) {
            console.log('[handleFlyTo] 调用flyToBoundingSphere, boundingSphere:', boundingSphere);
            viewerRef.current.camera.flyToBoundingSphere(boundingSphere, {
              duration: 1.5,
              offset: new Cesium.HeadingPitchRange(0, -Math.PI / 4, boundingSphere.radius * 2)
            });
          } else {
            console.warn('[handleFlyTo] 找到3DTileset但没有boundingSphere');
          }
          break;
        }
      }
    } else {
      // 查找对应的模型
      for (let i = 0; i < primitives.length; i++) {
        const primitive = primitives.get(i);
        console.log(`[handleFlyTo] primitive[${i}] type:`, primitive?.constructor?.name, 'id:', (primitive as any).id);
        if (primitive instanceof Cesium.Model && primitive.id === node.data.uid) {
          // 计算模型的包围盒
          const boundingSphere = primitive.boundingSphere;
          if (boundingSphere) {
            console.log('[handleFlyTo] 调用flyToBoundingSphere, boundingSphere:', boundingSphere);
            // 飞到模型位置
            viewerRef.current.camera.flyToBoundingSphere(boundingSphere, {
              duration: 1.5,
              offset: new Cesium.HeadingPitchRange(0, -Math.PI / 4, boundingSphere.radius * 2)
            });
          } else {
            console.warn('[handleFlyTo] 找到Model但没有boundingSphere');
          }
          break;
        }
      }
    }
  };

  // 递归收集所有子节点 uid
  const collectAllInstanceUids = (node: any): string[] => {
    let uids: string[] = [node.data.uid];
    if (node.children && node.children.length > 0) {
      node.children.forEach((child: any) => {
        uids = uids.concat(collectAllInstanceUids(child));
      });
    }
    return uids;
  };

  // 处理删除实例
  const handleDelete = (node: any, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!node.data.uid) return;

    // 弹出确认框
    Modal.confirm({
      title: '确认删除实例',
      content: '此操作会删除该实例及其所有子实例，且不可恢复。是否继续？',
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        message.loading('正在删除实例...', 0);
        // 递归收集所有要删除的 uid（先删子节点再删自己）
        const allUids = collectAllInstanceUids(node);
        // 先删子节点（不包括自己）
        for (let i = 1; i < allUids.length; i++) {
          try {
            await api.delete(`/instances/${allUids[i]}`);
            // 同步移除 Cesium 模型
            if (viewerRef?.current) {
              const scene = viewerRef.current.scene;
              const primitives = scene.primitives;
              for (let j = 0; j < primitives.length; j++) {
                const primitive = primitives.get(j);
                if (primitive instanceof Cesium.Model && primitive.id === allUids[i]) {
                  primitives.remove(primitive);
                  break;
                }
              }
            }
          } catch (err: any) {
            // 忽略单个子节点删除失败
          }
        }
        // 最后删自己
        try {
          await api.delete(`/instances/${allUids[0]}`);
          // 同步移除 Cesium 模型
          if (viewerRef?.current) {
            const scene = viewerRef.current.scene;
            const primitives = scene.primitives;
            for (let j = 0; j < primitives.length; j++) {
              const primitive = primitives.get(j);
              if (primitive instanceof Cesium.Model && primitive.id === allUids[0]) {
                primitives.remove(primitive);
                break;
              }
            }
          }
          message.destroy();
          message.success('实例及其所有子实例已删除');
          fetchInstanceTree();
          if (selectedInstanceId && allUids.includes(selectedInstanceId)) {
            onInstanceSelect?.(null);
          }
        } catch (err: any) {
          message.destroy();
          message.error('删除实例失败: ' + (err.response?.data?.detail || err.message));
        }
      }
    });
  };

  // 高亮匹配内容
  const titleRender = (node: any) => {
    const index = node.title.indexOf(searchValue);
    const beforeStr = node.title.substring(0, index);
    const afterStr = node.title.substring(index + searchValue.length);
    const match = node.title.substr(index, searchValue.length);
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
        <span>
          {index > -1 ? (
            <>
              {beforeStr}
              <span style={{ color: '#f50', fontWeight: 600 }}>{match}</span>
              {afterStr}
            </>
          ) : (
            node.title
          )}
        </span>
        <Space size="small" onClick={e => e.stopPropagation()}>
          <Button
            type="text"
            size="small"
            icon={node.data.show !== false ? <EyeOutlined /> : <EyeInvisibleOutlined />}
            onClick={(e) => handleToggleVisibility(node, e)}
          />
          <Button
            type="text"
            size="small"
            icon={<AimOutlined />}
            onClick={(e) => handleFlyTo(node, e)}
          />
          <Button
            type="text"
            size="small"
            danger
            icon={<DeleteOutlined />}
            onClick={(e) => handleDelete(node, e)}
          />
        </Space>
      </div>
    );
  };

  return (
    <Spin spinning={loadingInstanceTree} style={{ height: '100%' }}>
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography.Text strong>场景实例树</Typography.Text>
          <Button 
            type="text" 
            size="small" 
            onClick={fetchInstanceTree}
          >
            刷新
          </Button>
        </div>
        <div className="instance-tree-container" style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
          {instanceTreeData.length > 0 ? (
            <Tree
              showLine={{ showLeafIcon: false }}
              showIcon={false}
              draggable
              blockNode
              expandedKeys={expandedKeys}
              selectedKeys={selectedKeys}
              onExpand={onExpand}
              autoExpandParent={autoExpandParent}
              onDragEnter={onDragEnter}
              onDrop={onDrop}
              onSelect={handleInstanceSelect}
              treeData={instanceTreeData}
              titleRender={titleRender}
              filterTreeNode={node => !!searchValue && node.title.indexOf(searchValue) > -1}
              style={{ height: '100%' }}
            />
          ) : (
            <div style={{ color: '#999', textAlign: 'center', marginTop: '20px' }}>
              {loadingInstanceTree ? '正在加载...' : '暂无实例数据'}
            </div>
          )}
        </div>
        <div style={{ marginTop: '16px', fontSize: '12px', color: '#999' }}>
          提示: 拖拽实例可以改变其在场景中的层级结构
        </div>
      </div>
    </Spin>
  );
};

export default InstanceTree; 