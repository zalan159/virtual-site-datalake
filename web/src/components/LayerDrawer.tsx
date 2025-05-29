import React from 'react';
import { Drawer, List, Switch } from 'antd';
import { EyeOutlined, EyeInvisibleOutlined } from '@ant-design/icons';

export interface LayerInfo {
  id: string;
  name: string;
  show: boolean;
}

interface LayerDrawerProps {
  visible: boolean;
  onClose: () => void;
  layers: LayerInfo[];
  onToggleLayer: (id: string, show: boolean) => void;
}

export const LayerDrawer: React.FC<LayerDrawerProps> = ({
  visible,
  onClose,
  layers,
  onToggleLayer,
}) => (
  <Drawer
    title="图层管理"
    placement="left"
    onClose={onClose}
    open={visible}
    width={280}
    mask={false}
    style={{ zIndex: 1001 }}
  >
    <List
      dataSource={layers}
      renderItem={layer => (
        <List.Item
          actions={[
            <Switch
              checked={layer.show}
              onChange={checked => onToggleLayer(layer.id, checked)}
              checkedChildren={<EyeOutlined />}
              unCheckedChildren={<EyeInvisibleOutlined />}
            />
          ]}
        >
          <span>{layer.name}</span>
        </List.Item>
      )}
    />
  </Drawer>
); 