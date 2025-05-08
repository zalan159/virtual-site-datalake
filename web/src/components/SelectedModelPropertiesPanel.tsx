// components/SelectedModelPropertiesPanel.tsx
import React from 'react';
import { Button, Card } from 'antd'; // 使用 Card 组件美化
import { SelectedModelInfo } from '../hooks/useCesiumInteractions';

interface SelectedModelPropertiesPanelProps {
  selectedModelInfo: SelectedModelInfo | null;
  onClose: () => void;
}

export const SelectedModelPropertiesPanel: React.FC<SelectedModelPropertiesPanelProps> = ({
  selectedModelInfo,
  onClose,
}) => {
  if (!selectedModelInfo) return null;

  return (
    <Card
        title="模型属性"
        size="small"
        style={{
            position: 'absolute',
            right: 24,
            top: 70, // 调整位置避免与标题重叠
            zIndex: 100,
            width: 280, // 固定宽度
            background: '#fff',
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
        }}
        extra={<Button type="link" size="small" onClick={onClose}>关闭</Button>}
    >
      <p><strong>ID:</strong> {selectedModelInfo.id || '无'}</p>
      <p><strong>名称:</strong> {selectedModelInfo.name || '无'}</p>
      {/* 可以在这里添加更多属性，例如从 selectedModelInfo.primitive 中读取 */}
      {/* 例如：<p><strong>位置:</strong> {selectedModelInfo.primitive.modelMatrix ? '查看控制台' : 'N/A'}</p> */}
      {/* selectedModelInfo.primitive.modelMatrix 是一个 Matrix4，需要转换成可读格式 */}
    </Card>
  );
};