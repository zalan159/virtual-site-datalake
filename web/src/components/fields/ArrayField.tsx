import React from 'react';
import { Form, Input, Button, Space } from 'antd';
import { MinusCircleOutlined, PlusOutlined } from '@ant-design/icons';
import { FieldMetadata } from '../DynamicPropertyForm';

interface ArrayFieldProps {
  fieldName: string;
  value: any[] | undefined;
  meta: FieldMetadata;
  onChange: (value: any[]) => void;
}

const ArrayField: React.FC<ArrayFieldProps> = ({ fieldName, value, meta, onChange }) => {
  const arrayValue = value || [];
  return (
    <Form.Item label={meta.display_name} name={fieldName}>
      <Form.List name={fieldName} initialValue={arrayValue}>
        {(fields, { add, remove }) => (
          <>
            {fields.map((field, index) => (
              <Space key={field.key} style={{ display: 'flex', marginBottom: 8 }} align="baseline">
                <Form.Item {...field} style={{ marginBottom: 0 }}>
                  <Input
                    value={arrayValue[index]}
                    onChange={e => {
                      const newArray = [...arrayValue];
                      newArray[index] = e.target.value;
                      onChange(newArray);
                    }}
                  />
                </Form.Item>
                <MinusCircleOutlined
                  onClick={() => {
                    remove(field.name);
                    const newArray = [...arrayValue];
                    newArray.splice(index, 1);
                    onChange(newArray);
                  }}
                />
              </Space>
            ))}
            <Form.Item>
              <Button
                type="dashed"
                onClick={() => {
                  add();
                  const newArray = [...arrayValue, ''];
                  onChange(newArray);
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

export default ArrayField;
