import React from 'react';
import { Form, Input } from 'antd';
import { FieldMetadata } from '../DynamicPropertyForm';

const { TextArea } = Input;

interface GenericObjectFieldProps {
  fieldName: string;
  value: any;
  meta: FieldMetadata;
  onChange: (value: any) => void;
}

const GenericObjectField: React.FC<GenericObjectFieldProps> = ({ fieldName, value, meta, onChange }) => (
  <Form.Item label={meta.display_name} name={fieldName}>
    <TextArea
      rows={4}
      value={value ? JSON.stringify(value, null, 2) : ''}
      onChange={e => {
        try {
          const newValue = JSON.parse(e.target.value);
          onChange(newValue);
        } catch {
          // ignore
        }
      }}
    />
  </Form.Item>
);

export default GenericObjectField;
