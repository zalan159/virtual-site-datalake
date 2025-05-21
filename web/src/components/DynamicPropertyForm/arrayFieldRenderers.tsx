import React from 'react';
import { Form, Input, Button, Space } from 'antd';
import { MinusCircleOutlined, PlusOutlined } from '@ant-design/icons';
import { FieldMetadata } from './types';

export const renderArrayField = (
  fieldName: string,
  value: any[],
  meta: FieldMetadata,
  handleFieldChange: (fieldName: string, value: any) => void
): React.ReactNode => {
  const arrayValue = Array.isArray(value) ? value : []; // Ensure value is an array

  return (
    <Form.Item label={meta.display_name} key={fieldName}>
      <Form.List name={fieldName} initialValue={arrayValue}>
        {(fields, { add, remove }) => (
          <>
            {fields.map((field, index) => (
              <Space key={field.key} style={{ display: 'flex', marginBottom: 8 }} align="baseline">
                <Form.Item
                  {...field}
                  style={{ marginBottom: 0, flexGrow: 1 }} // Allow input to grow
                >
                  <Input
                    value={arrayValue[index]} // Controlled component: value comes from state
                    onChange={(e) => {
                      const newArray = [...arrayValue];
                      newArray[index] = e.target.value;
                      handleFieldChange(fieldName, newArray);
                    }}
                  />
                </Form.Item>
                <MinusCircleOutlined
                  onClick={() => {
                    const newArray = [...arrayValue];
                    newArray.splice(index, 1);
                    handleFieldChange(fieldName, newArray);
                    // remove(field.name) should be called if Form.List is directly managing state,
                    // but here we manage state via handleFieldChange and parent component.
                    // If AntD's Form.List's `remove` is essential for its internal state,
                    // and `handleFieldChange` is also updating the parent's state,
                    // ensure they are compatible or choose one source of truth.
                    // For now, assuming handleFieldChange is the primary mechanism.
                  }}
                />
              </Space>
            ))}
            <Form.Item>
              <Button
                type="dashed"
                onClick={() => {
                  // add() function from Form.List can be called to add a new field to the list.
                  // It can optionally take an initial value for the new field.
                  // add(undefined, fields.length); // Adds to the end
                  const newArray = [...arrayValue, '']; // Add a default empty string or a more suitable default
                  handleFieldChange(fieldName, newArray);
                }}
                block
                icon={<PlusOutlined />}
              >
                添加项
              </Button>
            </Form.Item>
          </>
        )}
      </Form.List>
    </Form.Item>
  );
};

export const renderBindingField = (
  fieldName: string,
  value: any[],
  meta: FieldMetadata,
  onShowBindingModal: (type: 'iot' | 'video' | 'file', fieldName: string) => void
): React.ReactNode => {
  const binds = Array.isArray(value) ? value : [];
  let type: 'iot' | 'video' | 'file' = 'file'; // Default or throw error
  if (fieldName === 'iot_binds') {
    type = 'iot';
  } else if (fieldName === 'video_binds') {
    type = 'video';
  } else if (fieldName === 'file_binds') {
    type = 'file';
  } else {
    // This case should ideally not happen if used correctly
    console.error("Unsupported binding fieldName:", fieldName);
    // Optionally return null or an error message component
  }

  return (
    <Form.Item label={meta.display_name} key={fieldName}>
      <Space>
        <Button onClick={() => onShowBindingModal(type, fieldName)}>绑定</Button>
        <span>{binds.length > 0 ? `${binds.length}项已绑定` : '未绑定'}</span>
      </Space>
    </Form.Item>
  );
};
