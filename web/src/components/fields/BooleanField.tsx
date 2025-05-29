import React from 'react';
import { Form, Switch } from 'antd';
import { FieldMetadata } from '../DynamicPropertyForm';

interface BooleanFieldProps {
  fieldName: string;
  value: boolean;
  meta: FieldMetadata;
  onChange: (value: boolean) => void;
}

const BooleanField: React.FC<BooleanFieldProps> = ({ fieldName, value, meta, onChange }) => (
  <Form.Item
    label={
      <span>
        {meta.display_name}
        {meta.description && (
          <span style={{ fontSize: '12px', color: '#888', marginLeft: '8px' }}>
            ({meta.description})
          </span>
        )}
      </span>
    }
    name={fieldName}
    valuePropName="checked"
  >
    <Switch checked={!!value} onChange={checked => onChange(checked)} />
  </Form.Item>
);

export default BooleanField;
