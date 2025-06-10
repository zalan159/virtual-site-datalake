import React, { useState, useCallback } from 'react';
import { Tree, Form, Button, Space, Modal, Input, App as AntdApp } from 'antd';
import { EditOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons';
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
  const [editingValue, setEditingValue] = useState<string>('');
  const { message } = AntdApp.useApp();

  // 根据是否有groupId来确定表单字段名
  const formFieldName = groupId ? [groupId, fieldName] : fieldName;

  // 初始化树数据
  React.useEffect(() => {
    if (value && typeof value === 'object') {
      const initialTreeData = buildInitialTreeData(value);
      setTreeData(initialTreeData);
    } else {
      setTreeData([]);
    }
  }, [value]);

  // 构建初始树数据（只显示顶级节点）
  const buildInitialTreeData = (obj: any, prefix = ''): ExtendedDataNode[] => {
    if (!obj || typeof obj !== 'object') return [];

    return Object.keys(obj).map(key => {
      const nodeKey = prefix ? `${prefix}.${key}` : key;
      const nodeValue = obj[key];
      const hasChildren = nodeValue && typeof nodeValue === 'object' && Object.keys(nodeValue).length > 0;

      return {
        key: nodeKey,
        title: key,
        children: hasChildren ? [] : undefined, // 有子节点但暂不加载
        isLeaf: !hasChildren,
        data: nodeValue
      };
    });
  };

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
      
      if (!data || typeof data !== 'object') {
        resolve();
        return;
      }

      const children: ExtendedDataNode[] = [];

      if (Array.isArray(data)) {
        // 处理数组
        data.forEach((item, index) => {
          const childKey = `${key}[${index}]`;
          const hasChildren = item && typeof item === 'object' && Object.keys(item).length > 0;
          
          children.push({
            key: childKey,
            title: `[${index}]`,
            children: hasChildren ? [] : undefined,
            isLeaf: !hasChildren,
            data: item
          });
        });
      } else {
        // 处理对象
        Object.keys(data).forEach(childKey => {
          const fullKey = `${key}.${childKey}`;
          const childValue = data[childKey];
          const hasChildren = childValue && typeof childValue === 'object' && Object.keys(childValue).length > 0;

          children.push({
            key: fullKey,
            title: childKey,
            children: hasChildren ? [] : undefined,
            isLeaf: !hasChildren,
            data: childValue
          });
        });
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
  }, []);

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
    const nodeValue = getNestedValue(value, node.key);
    const isEditing = editingKey === node.key;
    
    // 显示值
    const displayValue = nodeValue === null || nodeValue === undefined 
      ? '(空)' 
      : typeof nodeValue === 'object' 
        ? `{...} (${Object.keys(nodeValue).length} 项)`
        : String(nodeValue);

    if (meta.editable && node.isLeaf) {
      if (isEditing) {
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%' }}>
            <span style={{ minWidth: '80px' }}>{node.title}:</span>
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
    <div style={{ border: '1px solid #d9d9d9', borderRadius: '6px', padding: '8px', maxHeight: '300px', overflow: 'auto' }}>
      <Tree
        loadData={loadNodeData}
        treeData={treeData}
        loadedKeys={loadedKeys}
        expandedKeys={expandedKeys}
        onExpand={setExpandedKeys}
        showLine
        showIcon={false}
        titleRender={renderTreeNodeTitle}
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