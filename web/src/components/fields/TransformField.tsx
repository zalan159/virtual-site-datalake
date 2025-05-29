import React from 'react';
import { Form, Row, Col, InputNumber } from 'antd';
import { FieldMetadata } from '../DynamicPropertyForm';

interface TransformFieldProps {
  fieldName: string;
  value: { location?: number[]; rotation?: number[]; scale?: number[] } | undefined;
  meta: FieldMetadata;
  onChange: (value: any) => void;
}

const TransformField: React.FC<TransformFieldProps> = ({ fieldName, value, meta, onChange }) => {
  const transformValue = value || { location: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] };

  const handleChange = (key: 'location' | 'rotation' | 'scale', index: number, val: number | null) => {
    const arr = [...(transformValue[key] || [])];
    arr[index] = val || 0;
    onChange({ ...transformValue, [key]: arr });
  };

  return (
    <Form.Item label={meta.display_name} name={fieldName}>
      <Row gutter={[16, 16]}>
        <Col span={24}>
          <Form.Item label="位置" style={{ marginBottom: 8 }}>
            <Row gutter={8}>
              {[0, 1, 2].map(idx => (
                <Col span={8} key={`loc-${idx}`}>
                  <InputNumber
                    value={transformValue.location?.[idx]}
                    style={{ width: '100%' }}
                    onChange={val => handleChange('location', idx, val)}
                  />
                </Col>
              ))}
            </Row>
          </Form.Item>
        </Col>
        <Col span={24}>
          <Form.Item label="旋转" style={{ marginBottom: 8 }}>
            <Row gutter={8}>
              {[0, 1, 2].map(idx => (
                <Col span={8} key={`rot-${idx}`}>
                  <InputNumber
                    value={transformValue.rotation?.[idx]}
                    style={{ width: '100%' }}
                    onChange={val => handleChange('rotation', idx, val)}
                  />
                </Col>
              ))}
            </Row>
          </Form.Item>
        </Col>
        <Col span={24}>
          <Form.Item label="缩放" style={{ marginBottom: 0 }}>
            <Row gutter={8}>
              {[0, 1, 2].map(idx => (
                <Col span={8} key={`scale-${idx}`}>
                  <InputNumber
                    value={transformValue.scale?.[idx]}
                    style={{ width: '100%' }}
                    onChange={val => handleChange('scale', idx, val)}
                  />
                </Col>
              ))}
            </Row>
          </Form.Item>
        </Col>
      </Row>
    </Form.Item>
  );
};

export default TransformField;
