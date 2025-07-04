// components/animation/AnimationNodesTab.tsx
import React, { useState, useCallback } from 'react';
import { Tree, Card, Typography, Space, Input, Empty, InputNumber, Row, Col, message, theme } from 'antd';
import type { DataNode } from 'antd/es/tree';
import { SearchOutlined, NodeIndexOutlined } from '@ant-design/icons';
import { AnimationManagerState, BoneNode } from '../../types/animation';

const { Text } = Typography;
const { Search } = Input;

interface AnimationNodesTabProps {
  animationState: AnimationManagerState;
  viewerRef: React.RefObject<any>;
  onNodeTransformUpdate?: (nodeId: string, transform: {
    translation?: [number, number, number];
    rotation?: [number, number, number, number];
    scale?: [number, number, number];
  }) => void;
}

export const AnimationNodesTab: React.FC<AnimationNodesTabProps> = ({
  animationState,
  viewerRef,
  onNodeTransformUpdate,
}) => {
  const { token } = theme.useToken();
  const { boneNodes, isLoading } = animationState;
  const [selectedNodeKey, setSelectedNodeKey] = useState<string | null>(null);
  const [searchValue, setSearchValue] = useState('');
  const [expandedKeys, setExpandedKeys] = useState<React.Key[]>([]);
  const [autoExpandParent, setAutoExpandParent] = useState(true);

  // 渲染节点标题
  const renderNodeTitle = useCallback((node: BoneNode) => {
    const index = searchValue ? node.name.indexOf(searchValue) : -1;
    const beforeStr = node.name.substring(0, index);
    const afterStr = node.name.substring(index + searchValue.length);
    
    const title = index > -1 ? (
      <span>
        {beforeStr}
        <span style={{ backgroundColor: token.colorWarning, color: token.colorTextBase }}>{searchValue}</span>
        {afterStr}
      </span>
    ) : (
      <span>{node.name}</span>
    );

    return (
      <Space>
        <NodeIndexOutlined style={{ color: token.colorPrimary }} />
        {title}
      </Space>
    );
  }, [searchValue, token]);

  // 将BoneNode转换为DataNode
  const convertToTreeData = useCallback((nodes: BoneNode[]): DataNode[] => {
    return nodes.map(node => ({
      key: node.id,
      title: renderNodeTitle(node),
      children: node.children ? convertToTreeData(node.children) : undefined,
      isLeaf: !node.children || node.children.length === 0,
      data: node,
    }));
  }, [renderNodeTitle]);

  // 获取所有节点的key
  const getAllKeys = (nodes: BoneNode[]): React.Key[] => {
    let keys: React.Key[] = [];
    nodes.forEach(node => {
      keys.push(node.id);
      if (node.children && node.children.length > 0) {
        keys = [...keys, ...getAllKeys(node.children)];
      }
    });
    return keys;
  };

  // 获取匹配搜索条件的节点key
  const getMatchedKeys = (nodes: BoneNode[], searchValue: string): React.Key[] => {
    let keys: React.Key[] = [];
    nodes.forEach(node => {
      if (node.name.toLowerCase().includes(searchValue.toLowerCase())) {
        keys.push(node.id);
      }
      if (node.children && node.children.length > 0) {
        keys = [...keys, ...getMatchedKeys(node.children, searchValue)];
      }
    });
    return keys;
  };

  // 获取指定节点的父节点key
  const getParentKeys = (nodes: BoneNode[], targetKey: string): React.Key[] => {
    const findParents = (nodes: BoneNode[], targetKey: string, parentKeys: React.Key[] = []): React.Key[] | null => {
      for (const node of nodes) {
        if (node.id === targetKey) {
          return parentKeys;
        }
        if (node.children && node.children.length > 0) {
          const result = findParents(node.children, targetKey, [...parentKeys, node.id]);
          if (result) {
            return result;
          }
        }
      }
      return null;
    };
    return findParents(nodes, targetKey) || [];
  };

  // 处理搜索
  const handleSearch = (value: string) => {
    setSearchValue(value);
    if (!value) {
      setExpandedKeys([]);
      setAutoExpandParent(false);
      return;
    }

    const matchedKeys = getMatchedKeys(boneNodes, value);
    const parentKeys: React.Key[] = [];
    
    matchedKeys.forEach(key => {
      const parents = getParentKeys(boneNodes, key as string);
      parentKeys.push(...parents);
    });

    setExpandedKeys([...new Set([...matchedKeys, ...parentKeys])]);
    setAutoExpandParent(true);
  };

  // 处理节点选择
  const handleNodeSelect = (selectedKeys: React.Key[]) => {
    const selectedKey = selectedKeys[0] as string;
    setSelectedNodeKey(selectedKey || null);
  };

  // 处理节点展开
  const handleExpand = (expandedKeys: React.Key[]) => {
    setExpandedKeys(expandedKeys);
    setAutoExpandParent(false);
  };

  // 查找选中的节点
  const findNodeById = (nodes: BoneNode[], id: string): BoneNode | null => {
    for (const node of nodes) {
      if (node.id === id) {
        return node;
      }
      if (node.children && node.children.length > 0) {
        const found = findNodeById(node.children, id);
        if (found) return found;
      }
    }
    return null;
  };

  const selectedNode = selectedNodeKey ? findNodeById(boneNodes, selectedNodeKey) : null;
  const treeData = convertToTreeData(boneNodes);

  // 更新节点变换值
  const updateNodeTransform = useCallback((
    type: 'translation' | 'rotation' | 'scale',
    index: number,
    value: number | null
  ) => {
    if (!selectedNode || !onNodeTransformUpdate) return;
    
    const currentTransform = {
      translation: [...(selectedNode.translation || [0, 0, 0])] as [number, number, number],
      rotation: [...(selectedNode.rotation || [0, 0, 0, 1])] as [number, number, number, number],
      scale: [...(selectedNode.scale || [1, 1, 1])] as [number, number, number],
    };
    
    const newArray = [...currentTransform[type]];
    newArray[index] = value || 0;
    currentTransform[type] = newArray as any;
    
    try {
      onNodeTransformUpdate(selectedNode.id, currentTransform);
    } catch (error) {
      message.error('更新节点变换失败');
      console.error('节点变换更新失败:', error);
    }
  }, [selectedNode, onNodeTransformUpdate]);

  if (isLoading) {
    return (
      <div style={{ padding: 20, textAlign: 'center' }}>
        <Text>加载节点数据...</Text>
      </div>
    );
  }

  if (boneNodes.length === 0) {
    return (
      <div style={{ padding: 20, textAlign: 'center' }}>
        <Empty description="该模型没有骨骼节点数据" />
      </div>
    );
  }

  return (
    <div style={{ padding: 16, height: '100%', overflow: 'auto' }}>
      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        
        {/* 搜索框 */}
        <Search
          placeholder="搜索节点名称"
          allowClear
          onSearch={handleSearch}
          style={{ marginBottom: 8 }}
          prefix={<SearchOutlined />}
        />

        {/* 左右布局：骨骼树 + 节点详情 */}
        <Row gutter={16}>
          {/* 左侧：节点树 */}
          <Col span={6}>
            <Card size="small" title={`骨骼节点树 (${boneNodes.length} 个节点)`}>
              <Tree
                showLine
                showIcon={false}
                expandedKeys={expandedKeys}
                autoExpandParent={autoExpandParent}
                selectedKeys={selectedNodeKey ? [selectedNodeKey] : []}
                onSelect={handleNodeSelect}
                onExpand={handleExpand}
                treeData={treeData}
                height={400}
                style={{ backgroundColor: token.colorBgLayout }}
              />
            </Card>
          </Col>

          {/* 右侧：节点详情和编辑 */}
          <Col span={18}>
            {selectedNode ? (
              <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                {/* 节点详情和编辑 */}
                                 <Card 
                   size="small" 
                   title={`节点详情: ${selectedNode.name}`}
                 >
                  <Space direction="vertical" style={{ width: '100%' }}>
                    {/* 基本信息（只读） */}
                    <Row gutter={16}>
                      <Col span={12}>
                        <Text strong>节点ID:</Text> <Text code>{selectedNode.id}</Text>
                      </Col>
                      <Col span={12}>
                        <Text strong>子节点数量:</Text> <Text>{selectedNode.children?.length || 0}</Text>
                      </Col>
                    </Row>

                    {/* 平移编辑 */}
                    <div>
                      <Text strong style={{ marginBottom: 8, display: 'block' }}>平移 (X, Y, Z)</Text>
                      <Row gutter={8}>
                        {[0, 1, 2].map(index => (
                          <Col span={8} key={`translation-${index}`}>
                            <InputNumber
                              size="small"
                              value={selectedNode.translation?.[index] || 0}
                              onChange={(value) => updateNodeTransform('translation', index, value)}
                              placeholder={['X', 'Y', 'Z'][index]}
                              step={0.1}
                              style={{ width: '100%' }}
                            />
                          </Col>
                        ))}
                      </Row>
                    </div>

                    {/* 旋转编辑 */}
                    <div>
                      <Text strong style={{ marginBottom: 8, display: 'block' }}>旋转 (X, Y, Z, W) - 四元数</Text>
                      <Row gutter={8}>
                        {[0, 1, 2, 3].map(index => (
                          <Col span={6} key={`rotation-${index}`}>
                            <InputNumber
                              size="small"
                              value={selectedNode.rotation?.[index] || (index === 3 ? 1 : 0)}
                              onChange={(value) => updateNodeTransform('rotation', index, value)}
                              placeholder={['X', 'Y', 'Z', 'W'][index]}
                              step={0.1}
                              min={index === 3 ? undefined : -1}
                              max={index === 3 ? undefined : 1}
                              style={{ width: '100%' }}
                            />
                          </Col>
                        ))}
                      </Row>
                    </div>

                    {/* 缩放编辑 */}
                    <div>
                      <Text strong style={{ marginBottom: 8, display: 'block' }}>缩放 (X, Y, Z)</Text>
                      <Row gutter={8}>
                        {[0, 1, 2].map(index => (
                          <Col span={8} key={`scale-${index}`}>
                            <InputNumber
                              size="small"
                              value={selectedNode.scale?.[index] || 1}
                              onChange={(value) => updateNodeTransform('scale', index, value)}
                              placeholder={['X', 'Y', 'Z'][index]}
                              step={0.1}
                              min={0.01}
                              style={{ width: '100%' }}
                            />
                          </Col>
                        ))}
                      </Row>
                    </div>

                    {/* 编辑提示 */}
                    <div style={{ fontSize: 12, color: token.colorTextSecondary, marginTop: 8 }}>
                      💡 提示：修改数值会实时应用到3D模型中
                    </div>
                  </Space>
                </Card>
              </Space>
                         ) : (
               <Card size="small" title="节点详情">
                 <Empty description="请选择一个节点查看详情" />
               </Card>
             )}
          </Col>
        </Row>

      </Space>
    </div>
  );
};