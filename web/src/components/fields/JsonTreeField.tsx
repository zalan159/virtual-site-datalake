import React, { useState, useCallback } from 'react';
import { Tree, Form, Button, Input, App as AntdApp } from 'antd';
import { EditOutlined } from '@ant-design/icons';
import type { DataNode } from 'antd/es/tree';
import { FieldMetadata } from '../DynamicPropertyForm';

// 扩展DataNode接口以支持data属性
interface ExtendedDataNode extends DataNode {
  data?: any;
}

interface JsonTreeFieldProps {
  fieldName: string;
  value: any;
  meta: FieldMetadata;
  onChange?: (value: any) => void;
  groupId?: string;
  pure?: boolean; // 纯树形模式，不包含Form.Item包装
}

const JsonTreeField: React.FC<JsonTreeFieldProps> = ({
  fieldName,
  value,
  meta,
  onChange,
  groupId,
  pure = false
}) => {
  const [treeData, setTreeData] = useState<ExtendedDataNode[]>([]);
  const [expandedKeys, setExpandedKeys] = useState<React.Key[]>([]);
  const [loadedKeys, setLoadedKeys] = useState<string[]>([]);
  const [editingKey, setEditingKey] = useState<string>('');
  const { message } = AntdApp.useApp();

  // 根据是否有groupId来确定表单字段名
  const formFieldName = groupId ? [groupId, fieldName] : fieldName;

  // 获取显示值（简化版本）
  const getDisplayValue = (val: any): string => {
    if (val === null || val === undefined) return '(空)';
    if (typeof val === 'object') {
      if (Array.isArray(val)) {
        return `[${val.length} 项]`;
      }
      return `{${Object.keys(val).length} 属性}`;
    }
    const str = String(val);
    return str.length > 50 ? str.substring(0, 50) + '...' : str;
  };

  // 构建初始树数据（只显示顶级节点，限制数量）
  const buildInitialTreeData = (obj: any, prefix = '', maxItems = 50): ExtendedDataNode[] => {
    if (!obj || typeof obj !== 'object') return [];

    const keys = Object.keys(obj);
    const limitedKeys = keys.slice(0, maxItems);
    const hasMore = keys.length > maxItems;

    const nodes = limitedKeys.map(key => {
      const nodeKey = prefix ? `${prefix}.${key}` : key;
      const nodeValue = obj[key];
      const hasChildren = nodeValue && typeof nodeValue === 'object' && 
        (Array.isArray(nodeValue) ? nodeValue.length > 0 : Object.keys(nodeValue).length > 0);

      return {
        key: nodeKey,
        title: `${key}: ${getDisplayValue(nodeValue)}`,
        children: hasChildren ? [] : undefined,
        isLeaf: !hasChildren,
        data: nodeValue
      };
    });

    // 如果有更多项，添加"加载更多"节点
    if (hasMore) {
      nodes.push({
        key: `${prefix}__load_more__`,
        title: `... 还有 ${keys.length - maxItems} 项，点击展开查看更多`,
        isLeaf: false,
        children: [],
        data: { __loadMore: true, __remainingKeys: keys.slice(maxItems), __prefix: prefix }
      });
    }

    return nodes;
  };

  // 初始化树数据
  React.useEffect(() => {
    if (value && typeof value === 'object') {
      const initialTreeData = buildInitialTreeData(value);
      setTreeData(initialTreeData);
    } else {
      setTreeData([]);
    }
  }, [value]);

  // 获取嵌套对象的值
  const getNestedValue = (obj: any, path: string): any => {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  };

  // 设置嵌套对象的值
  const setNestedValue = (obj: any, path: string, newValue: any): any => {
    const keys = path.split('.');
    const result = { ...obj };
    let current = result;
    
    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      current[key] = { ...current[key] };
      current = current[key];
    }
    
    const lastKey = keys[keys.length - 1];
    try {
      // 尝试解析为JSON，如果失败则作为字符串
      current[lastKey] = JSON.parse(newValue);
    } catch {
      current[lastKey] = newValue;
    }
    
    return result;
  };

  // 异步加载子节点
  const loadNodeData = useCallback(async (node: any): Promise<void> => {
    return new Promise((resolve) => {
      const { key, data } = node;
      
      // 处理"加载更多"节点
      if (data && data.__loadMore) {
        let moreNodes: ExtendedDataNode[] = [];

        if (data.__isArray && data.__remainingData) {
          // 处理数组的"加载更多"
          const { __remainingData, __parentKey } = data;
          const maxMore = 100;
          const limitedData = __remainingData.slice(0, maxMore);
          const hasMoreAfter = __remainingData.length > maxMore;
          
          // 计算起始索引
          const parentPath = __parentKey.split(/[\.\[\]]+/).filter(Boolean);
          const parentData = getNestedValue(value, parentPath.join('.'));
          const startIndex = Array.isArray(parentData) ? parentData.length - __remainingData.length : 0;

          limitedData.forEach((item: any, index: number) => {
            const actualIndex = startIndex + index;
            const childKey = `${__parentKey}[${actualIndex}]`;
            const hasChildren = item && typeof item === 'object' && 
              (Array.isArray(item) ? item.length > 0 : Object.keys(item).length > 0);
            
            moreNodes.push({
              key: childKey,
              title: `[${actualIndex}]: ${getDisplayValue(item)}`,
              children: hasChildren ? [] : undefined,
              isLeaf: !hasChildren,
              data: item
            });
          });

          // 如果还有更多数据，添加新的"加载更多"节点
          if (hasMoreAfter) {
            moreNodes.push({
              key: `${__parentKey}__array_load_more_${Date.now()}__`,
              title: `... 还有 ${__remainingData.length - maxMore} 项，点击查看更多`,
              isLeaf: false,
              children: [],
              data: { 
                __loadMore: true, 
                __remainingData: __remainingData.slice(maxMore),
                __parentKey: __parentKey,
                __isArray: true 
              }
            });
          }
        } else if (data.__remainingKeys && data.__parentData) {
          // 处理对象的"加载更多"
          const { __remainingKeys, __parentData, __parentKey } = data;
          const maxMore = 100;
          const limitedKeys = __remainingKeys.slice(0, maxMore);
          const hasMoreAfter = __remainingKeys.length > maxMore;

          limitedKeys.forEach((childKey: string) => {
            const fullKey = `${__parentKey}.${childKey}`;
            const childValue = __parentData[childKey];
            const hasChildren = childValue && typeof childValue === 'object' && 
              (Array.isArray(childValue) ? childValue.length > 0 : Object.keys(childValue).length > 0);

            moreNodes.push({
              key: fullKey,
              title: `${childKey}: ${getDisplayValue(childValue)}`,
              children: hasChildren ? [] : undefined,
              isLeaf: !hasChildren,
              data: childValue
            });
          });

          // 如果还有更多属性，添加新的"加载更多"节点
          if (hasMoreAfter) {
            moreNodes.push({
              key: `${__parentKey}__object_load_more_${Date.now()}__`,
              title: `... 还有 ${__remainingKeys.length - maxMore} 个属性，点击查看更多`,
              isLeaf: false,
              children: [],
              data: { 
                __loadMore: true, 
                __remainingKeys: __remainingKeys.slice(maxMore),
                __parentKey: __parentKey,
                __parentData: __parentData 
              }
            });
          }
        } else {
          // 处理旧版本的加载更多逻辑
          const { __remainingKeys, __prefix } = data;
          const parentObj = __prefix ? getNestedValue(value, __prefix) : value;
          
          moreNodes = __remainingKeys.map((childKey: string) => {
            const fullKey = __prefix ? `${__prefix}.${childKey}` : childKey;
            const childValue = parentObj[childKey];
            const hasChildren = childValue && typeof childValue === 'object' && 
              (Array.isArray(childValue) ? childValue.length > 0 : Object.keys(childValue).length > 0);

            return {
              key: fullKey,
              title: `${childKey}: ${getDisplayValue(childValue)}`,
              children: hasChildren ? [] : undefined,
              isLeaf: !hasChildren,
              data: childValue
            };
          });
        }

        // 更新树数据，移除"加载更多"节点并添加新节点
        setTreeData(prevData => {
          const updateTreeData = (list: ExtendedDataNode[], targetKey: string): ExtendedDataNode[] => {
            return list.reduce((acc: ExtendedDataNode[], item: ExtendedDataNode) => {
              if (item.key === targetKey) {
                // 移除"加载更多"节点，添加新节点
                return [...acc, ...moreNodes];
              }
              if (item.children) {
                return [...acc, { ...item, children: updateTreeData(item.children, targetKey) }];
              }
              return [...acc, item];
            }, []);
          };
          return updateTreeData(prevData, key);
        });

        setLoadedKeys(prev => [...prev, key]);
        resolve();
        return;
      }
      
      if (!data || typeof data !== 'object') {
        resolve();
        return;
      }

      const children: ExtendedDataNode[] = [];
      const maxChildren = 100; // 限制子节点数量

      if (Array.isArray(data)) {
        // 处理数组 - 分批加载
        const limitedData = data.slice(0, maxChildren);
        const hasMore = data.length > maxChildren;

        limitedData.forEach((item, index) => {
          const childKey = `${key}[${index}]`;
          const hasChildren = item && typeof item === 'object' && 
            (Array.isArray(item) ? item.length > 0 : Object.keys(item).length > 0);
          
          children.push({
            key: childKey,
            title: `[${index}]: ${getDisplayValue(item)}`,
            children: hasChildren ? [] : undefined,
            isLeaf: !hasChildren,
            data: item
          });
        });

        // 如果数组有更多项，添加"加载更多"节点
        if (hasMore) {
          children.push({
            key: `${key}__array_load_more__`,
            title: `... 还有 ${data.length - maxChildren} 项，点击查看更多`,
            isLeaf: false,
            children: [],
            data: { 
              __loadMore: true, 
              __remainingData: data.slice(maxChildren),
              __parentKey: key,
              __isArray: true 
            }
          });
        }
      } else {
        // 处理对象 - 分批加载
        const keys = Object.keys(data);
        const limitedKeys = keys.slice(0, maxChildren);
        const hasMore = keys.length > maxChildren;

        limitedKeys.forEach(childKey => {
          const fullKey = `${key}.${childKey}`;
          const childValue = data[childKey];
          const hasChildren = childValue && typeof childValue === 'object' && 
            (Array.isArray(childValue) ? childValue.length > 0 : Object.keys(childValue).length > 0);

          children.push({
            key: fullKey,
            title: `${childKey}: ${getDisplayValue(childValue)}`,
            children: hasChildren ? [] : undefined,
            isLeaf: !hasChildren,
            data: childValue
          });
        });

        // 如果对象有更多属性，添加"加载更多"节点
        if (hasMore) {
          children.push({
            key: `${key}__object_load_more__`,
            title: `... 还有 ${keys.length - maxChildren} 个属性，点击查看更多`,
            isLeaf: false,
            children: [],
            data: { 
              __loadMore: true, 
              __remainingKeys: keys.slice(maxChildren),
              __parentKey: key,
              __parentData: data 
            }
          });
        }
      }

      // 更新树数据
      setTreeData(prevData => {
        const updateTreeData = (list: ExtendedDataNode[], targetKey: string, newChildren: ExtendedDataNode[]): ExtendedDataNode[] => {
          return list.map(item => {
            if (item.key === targetKey) {
              return { ...item, children: newChildren };
            }
            if (item.children) {
              return { ...item, children: updateTreeData(item.children, targetKey, newChildren) };
            }
            return item;
          });
        };
        return updateTreeData(prevData, key, children);
      });

      setLoadedKeys(prev => [...prev, key]);
      resolve();
    });
  }, [value]);

  // 处理内联编辑
  const handleInlineEdit = (nodeKey: string, newValue: string) => {
    if (!onChange) return;
    
    try {
      const updatedValue = setNestedValue(value, nodeKey, newValue);
      onChange(updatedValue);
      setEditingKey('');
      message.success('修改成功');
    } catch (error) {
      message.error('保存失败，请检查输入格式');
    }
  };

  // 渲染树节点标题
  const renderTreeNodeTitle = (node: any) => {
    // 如果是"加载更多"节点，直接返回标题
    if (node.data && node.data.__loadMore) {
      return <span style={{ color: '#1890ff', cursor: 'pointer' }}>{node.title}</span>;
    }

    const nodeValue = getNestedValue(value, node.key);
    const isEditing = editingKey === node.key;
    
    // 如果节点标题已经包含了显示值（由buildInitialTreeData和loadNodeData设置），直接使用
    if (node.title.includes(':')) {
      // 标题已经格式化，直接显示
      if (meta.editable && node.isLeaf) {
        if (isEditing) {
          return (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%' }}>
              <span style={{ minWidth: '120px' }}>{node.title.split(':')[0]}:</span>
              <Input
                size="small"
                defaultValue={String(nodeValue || '')}
                onPressEnter={(e) => handleInlineEdit(node.key, (e.target as HTMLInputElement).value)}
                onBlur={(e) => handleInlineEdit(node.key, e.target.value)}
                autoFocus
                style={{ flex: 1 }}
              />
              <Button 
                size="small" 
                type="text" 
                onClick={() => setEditingKey('')}
              >
                取消
              </Button>
            </div>
          );
        } else {
          return (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
              <span>{node.title}</span>
              <Button 
                type="text" 
                size="small" 
                icon={<EditOutlined />}
                onClick={(e) => {
                  e.stopPropagation();
                  setEditingKey(node.key);
                }}
              />
            </div>
          );
        }
      }
      return <span>{node.title}</span>;
    }

    // 兼容旧格式：如果标题不包含值，计算显示值
    const displayValue = nodeValue === null || nodeValue === undefined 
      ? '(空)' 
      : typeof nodeValue === 'object' 
        ? `{...} (${Array.isArray(nodeValue) ? nodeValue.length : Object.keys(nodeValue).length} 项)`
        : String(nodeValue);

    if (meta.editable && node.isLeaf) {
      if (isEditing) {
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%' }}>
            <span style={{ minWidth: '120px' }}>{node.title}:</span>
            <Input
              size="small"
              defaultValue={String(nodeValue || '')}
              onPressEnter={(e) => handleInlineEdit(node.key, (e.target as HTMLInputElement).value)}
              onBlur={(e) => handleInlineEdit(node.key, e.target.value)}
              autoFocus
              style={{ flex: 1 }}
            />
            <Button 
              size="small" 
              type="text" 
              onClick={() => setEditingKey('')}
            >
              取消
            </Button>
          </div>
        );
      } else {
        return (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
            <span>{node.title}: {displayValue}</span>
            <Button 
              type="text" 
              size="small" 
              icon={<EditOutlined />}
              onClick={(e) => {
                e.stopPropagation();
                setEditingKey(node.key);
              }}
            />
          </div>
        );
      }
    }

    // 只读模式或非叶子节点
    return <span>{node.title}: {displayValue}</span>;
  };

  if (!value || typeof value !== 'object') {
    const content = (
      <div style={{ color: '#888', fontSize: '14px' }}>
        {value ? String(value) : '暂无数据'}
      </div>
    );
    
    if (pure) {
      return content;
    }
    
    return (
      <Form.Item label={meta.display_name} name={formFieldName}>
        {content}
      </Form.Item>
    );
  }

  const treeComponent = (
    <div style={{ border: '1px solid #d9d9d9', borderRadius: '6px', padding: '8px', maxHeight: '400px', overflow: 'auto' }}>
      <Tree
        loadData={loadNodeData}
        treeData={treeData}
        loadedKeys={loadedKeys}
        expandedKeys={expandedKeys}
        onExpand={setExpandedKeys}
        showLine
        showIcon={false}
        titleRender={renderTreeNodeTitle}
        virtual
        height={350}
        itemHeight={24}
        style={{ fontSize: '12px' }}
      />
    </div>
  );

  if (pure) {
    return treeComponent;
  }

  return (
    <Form.Item label={meta.display_name} name={formFieldName}>
      {treeComponent}
    </Form.Item>
  );
};

export default JsonTreeField; 