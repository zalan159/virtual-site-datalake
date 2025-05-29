import React from 'react';
import { Form, Input } from 'antd';
import { FieldMetadata } from '../DynamicPropertyForm';

const { TextArea } = Input;

interface TextFieldProps {
  fieldName: string;
  value: any;
  meta: FieldMetadata;
  onChange: (value: string) => void;
}

const TextField: React.FC<TextFieldProps> = ({ fieldName, value, meta, onChange }) => (
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
    <TextArea rows={4} value={value} placeholder={`请输入${meta.display_name}`} onChange={e => onChange(e.target.value)} />
  </Form.Item>
);

export default TextField;
