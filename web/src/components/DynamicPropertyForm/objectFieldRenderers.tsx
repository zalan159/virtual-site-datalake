import React from 'react';
import { Form, Input, InputNumber, Button, Row, Col } from 'antd';
import { FieldMetadata } from './types';

const { TextArea } = Input;

// Props for renderOriginField, including those passed from the parent component
interface RenderOriginFieldProps {
  onFlyToOrigin?: (origin: { longitude: number; latitude: number; height: number }) => void;
  startPickOrigin?: () => void;
  isPickingOrigin?: boolean;
}

export const renderOriginField = (
  fieldName: string,
  value: any,
  meta: FieldMetadata,
  handleFieldChange: (fieldName: string, value: any) => void,
  originProps: RenderOriginFieldProps
): React.ReactNode => {
  const originValue = value || { longitude: 0, latitude: 0, height: 0 };
  const { onFlyToOrigin, startPickOrigin, isPickingOrigin } = originProps;

  const handleOriginChange = (key: string, val: number | null) => { // Allow null for InputNumber
    const newOrigin = { ...originValue, [key]: val };
    handleFieldChange(fieldName, newOrigin);
  };

  return (
    <Form.Item label={meta.display_name} key={fieldName}>
      <Row gutter={[16, 16]}>
        <Col span={24} style={{ textAlign: 'right', marginBottom: 8 }}>
          {typeof originValue.longitude === 'number' &&
            typeof originValue.latitude === 'number' &&
            onFlyToOrigin && (
              <Button
                size="small"
                type="default"
                onClick={() => onFlyToOrigin(originValue)}
                style={{ marginRight: 8 }}
              >
                飞到原点
              </Button>
            )}
          {startPickOrigin && (
            <Button
              size="small"
              type="primary"
              onClick={startPickOrigin}
              loading={isPickingOrigin}
            >
              {isPickingOrigin ? '正在选点...' : '地图选点'}
            </Button>
          )}
        </Col>
        <Col span={24}>
          <Form.Item label="经度" style={{ marginBottom: 8 }}>
            <InputNumber
              value={originValue.longitude}
              min={meta.properties?.longitude?.min ?? -180}
              max={meta.properties?.longitude?.max ?? 180}
              step={0.000001}
              style={{ width: '100%' }}
              onChange={(val) => handleOriginChange('longitude', val)}
            />
          </Form.Item>
        </Col>
        <Col span={24}>
          <Form.Item label="纬度" style={{ marginBottom: 8 }}>
            <InputNumber
              value={originValue.latitude}
              min={meta.properties?.latitude?.min ?? -90}
              max={meta.properties?.latitude?.max ?? 90}
              step={0.000001}
              style={{ width: '100%' }}
              onChange={(val) => handleOriginChange('latitude', val)}
            />
          </Form.Item>
        </Col>
        <Col span={24}>
          <Form.Item label="高程" style={{ marginBottom: 0 }}>
            <InputNumber
              value={originValue.height}
              min={meta.properties?.height?.min ?? -10000}
              max={meta.properties?.height?.max ?? 10000}
              step={0.01}
              style={{ width: '100%' }}
              onChange={(val) => handleOriginChange('height', val)}
            />
          </Form.Item>
        </Col>
      </Row>
    </Form.Item>
  );
};

export const renderTransformField = (
  fieldName: string,
  value: any,
  meta: FieldMetadata,
  handleFieldChange: (fieldName: string, value: any) => void
): React.ReactNode => {
  const transformValue = value || {
    location: [0, 0, 0],
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
  };

  const handleTransformChange = (key: string, index: number, val: number | null) => { // Allow null
    const newArray = [...(transformValue[key] || [0,0,0])]; // Ensure array exists
    newArray[index] = val ?? 0; // Default to 0 if null
    const newTransform = { ...transformValue, [key]: newArray };
    handleFieldChange(fieldName, newTransform);
  };

  return (
    <Form.Item label={meta.display_name} key={fieldName}>
      <Row gutter={[16, 16]}>
        {/* 位置 */}
        <Col span={24}>
          <Form.Item label="位置" style={{ marginBottom: 8 }}>
            <Row gutter={8}>
              <Col span={8}>
                <InputNumber
                  value={transformValue.location?.[0]}
                  style={{ width: '100%' }}
                  onChange={(val) => handleTransformChange('location', 0, val)}
                />
              </Col>
              <Col span={8}>
                <InputNumber
                  value={transformValue.location?.[1]}
                  style={{ width: '100%' }}
                  onChange={(val) => handleTransformChange('location', 1, val)}
                />
              </Col>
              <Col span={8}>
                <InputNumber
                  value={transformValue.location?.[2]}
                  style={{ width: '100%' }}
                  onChange={(val) => handleTransformChange('location', 2, val)}
                />
              </Col>
            </Row>
          </Form.Item>
        </Col>
        {/* 旋转 */}
        <Col span={24}>
          <Form.Item label="旋转" style={{ marginBottom: 8 }}>
            <Row gutter={8}>
              <Col span={8}>
                <InputNumber
                  value={transformValue.rotation?.[0]}
                  style={{ width: '100%' }}
                  onChange={(val) => handleTransformChange('rotation', 0, val)}
                />
              </Col>
              <Col span={8}>
                <InputNumber
                  value={transformValue.rotation?.[1]}
                  style={{ width: '100%' }}
                  onChange={(val) => handleTransformChange('rotation', 1, val)}
                />
              </Col>
              <Col span={8}>
                <InputNumber
                  value={transformValue.rotation?.[2]}
                  style={{ width: '100%' }}
                  onChange={(val) => handleTransformChange('rotation', 2, val)}
                />
              </Col>
            </Row>
          </Form.Item>
        </Col>
        {/* 缩放 */}
        <Col span={24}>
          <Form.Item label="缩放" style={{ marginBottom: 0 }}>
            <Row gutter={8}>
              <Col span={8}>
                <InputNumber
                  value={transformValue.scale?.[0]}
                  style={{ width: '100%' }}
                  onChange={(val) => handleTransformChange('scale', 0, val)}
                />
              </Col>
              <Col span={8}>
                <InputNumber
                  value={transformValue.scale?.[1]}
                  style={{ width: '100%' }}
                  onChange={(val) => handleTransformChange('scale', 1, val)}
                />
              </Col>
              <Col span={8}>
                <InputNumber
                  value={transformValue.scale?.[2]}
                  style={{ width: '100%' }}
                  onChange={(val) => handleTransformChange('scale', 2, val)}
                />
              </Col>
            </Row>
          </Form.Item>
        </Col>
      </Row>
    </Form.Item>
  );
};

export const renderGenericObjectField = (
  fieldName: string,
  value: any,
  meta: FieldMetadata,
  handleFieldChange: (fieldName: string, value: any) => void
): React.ReactNode => {
  return (
    <Form.Item label={meta.display_name} key={fieldName}>
      <TextArea
        rows={4}
        value={value ? JSON.stringify(value, null, 2) : ''}
        onChange={(e) => {
          try {
            const newValue = JSON.parse(e.target.value);
            handleFieldChange(fieldName, newValue);
          } catch (error) {
            // 解析错误时不更新, 可以添加用户反馈，例如message.error
            console.error('JSON解析错误:', error);
          }
        }}
      />
    </Form.Item>
  );
};
