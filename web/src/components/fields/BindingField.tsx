import React from 'react';
import { Form, Button, Space } from 'antd';
import { FieldMetadata } from '../DynamicPropertyForm';

interface BindingFieldProps {
  fieldName: string;
  value: any[] | undefined;
  meta: FieldMetadata;
  onOpen: () => void;
}

const BindingField: React.FC<BindingFieldProps> = ({ fieldName, value, meta, onOpen }) => {
  let bindingText = '未绑定';
  
  if (fieldName === 'tiles_binding') {
    // tiles_binding 是对象格式: {"wmts_id": "xxx", "enabled": true}
    const tilesBinding = value || {};
    bindingText = tilesBinding.wmts_id ? '已绑定' : '未绑定';
  } else {
    // 其他绑定字段是数组格式
    const binds = value || [];
    bindingText = binds.length ? `${binds.length}项` : '未绑定';
  }
  
  return (
    <Form.Item label={meta.display_name} name={fieldName}>
      <Space>
        <Button onClick={onOpen}>绑定</Button>
        <span>{bindingText}</span>
      </Space>
    </Form.Item>
  );
};

export default BindingField;
