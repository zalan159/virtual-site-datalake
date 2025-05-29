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
  const binds = value || [];
  return (
    <Form.Item label={meta.display_name} name={fieldName}>
      <Space>
        <Button onClick={onOpen}>绑定</Button>
        <span>{binds.length ? `${binds.length}项` : '未绑定'}</span>
      </Space>
    </Form.Item>
  );
};

export default BindingField;
