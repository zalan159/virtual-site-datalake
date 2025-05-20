import React from 'react';
import { Form, InputNumber } from 'antd';
import { FieldMetadata } from '../DynamicPropertyForm';

interface NumberFieldProps {
  fieldName: string;
  value: number | undefined;
  meta: FieldMetadata;
  onChange: (value: number | null) => void;
}

const NumberField: React.FC<NumberFieldProps> = ({ fieldName, value, meta, onChange }) => (
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
  >
    <InputNumber style={{ width: '100%' }} min={meta.min} max={meta.max} value={value} onChange={val => onChange(val)} />
  </Form.Item>
);

export default NumberField;
