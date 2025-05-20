import React from 'react';
import { Form, Row, Col, InputNumber, Button } from 'antd';
import { FieldMetadata } from '../DynamicPropertyForm';

interface OriginFieldProps {
  fieldName: string;
  value: { longitude: number; latitude: number; height: number } | undefined;
  meta: FieldMetadata;
  onChange: (value: { longitude: number; latitude: number; height: number }) => void;
  onFlyToOrigin?: (origin: { longitude: number; latitude: number; height: number }) => void;
  startPickOrigin?: () => void;
  isPickingOrigin?: boolean;
}

const OriginField: React.FC<OriginFieldProps> = ({ fieldName, value, meta, onChange, onFlyToOrigin, startPickOrigin, isPickingOrigin }) => {
  const originValue = value || { longitude: 0, latitude: 0, height: 0 };

  const handleChange = (key: keyof typeof originValue, val: number | null) => {
    onChange({ ...originValue, [key]: val || 0 });
  };

  return (
    <Form.Item label={meta.display_name} name={fieldName}>
      <Row gutter={[16, 16]}>
        <Col span={24} style={{ textAlign: 'right', marginBottom: 8 }}>
          {onFlyToOrigin && (
            <Button size="small" type="default" onClick={() => onFlyToOrigin(originValue)} style={{ marginRight: 8 }}>
              飞到原点
            </Button>
          )}
          {startPickOrigin && (
            <Button size="small" type="primary" onClick={startPickOrigin} loading={isPickingOrigin}>
              {isPickingOrigin ? '正在选点...' : '地图选点'}
            </Button>
          )}
        </Col>
        <Col span={24}>
          <Form.Item label="经度" style={{ marginBottom: 8 }}>
            <InputNumber
              value={originValue.longitude}
              min={meta.properties?.longitude?.min || -180}
              max={meta.properties?.longitude?.max || 180}
              step={0.000001}
              style={{ width: '100%' }}
              onChange={val => handleChange('longitude', val)}
            />
          </Form.Item>
        </Col>
        <Col span={24}>
          <Form.Item label="纬度" style={{ marginBottom: 8 }}>
            <InputNumber
              value={originValue.latitude}
              min={meta.properties?.latitude?.min || -90}
              max={meta.properties?.latitude?.max || 90}
              step={0.000001}
              style={{ width: '100%' }}
              onChange={val => handleChange('latitude', val)}
            />
          </Form.Item>
        </Col>
        <Col span={24}>
          <Form.Item label="高程" style={{ marginBottom: 0 }}>
            <InputNumber
              value={originValue.height}
              min={meta.properties?.height?.min || -10000}
              max={meta.properties?.height?.max || 10000}
              step={0.01}
              style={{ width: '100%' }}
              onChange={val => handleChange('height', val)}
            />
          </Form.Item>
        </Col>
      </Row>
    </Form.Item>
  );
};

export default OriginField;
