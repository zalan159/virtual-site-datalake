import React from 'react';
import { Form, Input } from 'antd';
import { FieldMetadata } from '../DynamicPropertyForm';

interface StringFieldProps {
  fieldName: string;
  value: any;
  meta: FieldMetadata;
  onChange: (value: string) => void;
  groupId?: string;
}

const StringField: React.FC<StringFieldProps> = ({ fieldName, value, meta, onChange, groupId }) => {
  const formFieldName = groupId ? [groupId, fieldName] : fieldName;
  
  return (
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
      name={formFieldName}
    >
      <Input 
        value={value} 
        placeholder={`请输入${meta.display_name}`} 
        onChange={e => onChange(e.target.value)} 
      />
    </Form.Item>
  );
};

export default StringField;
