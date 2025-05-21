import React from 'react';
import { Typography, Image, Switch, Form } from 'antd';
import { FieldMetadata } from './types';

const { Text } = Typography;

export const renderReadOnlyValue = (fieldName: string, value: any, meta: FieldMetadata): React.ReactNode => {
  if (value === null || value === undefined) {
    return <Text type="secondary">暂无数据</Text>;
  }

  switch (meta.type) {
    case 'datetime':
      return <Text>{value ? new Date(value).toLocaleString() : '暂无数据'}</Text>;
      
    case 'image':
      return <Image src={value || '/logoonly.png'} width={200} fallback="/logoonly.png" />;
      
    case 'boolean':
      return <Switch checked={value} disabled />;
      
    case 'object':
      if (fieldName === 'origin' && value) {
        return (
          <Form layout="horizontal" labelCol={{ span: 6 }} wrapperCol={{ span: 18 }}>
            <Form.Item key="longitude" label="经度">
              <Text>{value.longitude}</Text>
            </Form.Item>
            <Form.Item key="latitude" label="纬度">
              <Text>{value.latitude}</Text>
            </Form.Item>
            <Form.Item key="height" label="高程">
              <Text>{value.height}</Text>
            </Form.Item>
          </Form>
        );
      } else if (fieldName === 'transform' && value) {
        return (
          <Form layout="horizontal" labelCol={{ span: 6 }} wrapperCol={{ span: 18 }}>
            <Form.Item key="location" label="位置">
              <Text>[{value.location?.join(', ')}]</Text>
            </Form.Item>
            <Form.Item key="rotation" label="旋转">
              <Text>[{value.rotation?.join(', ')}]</Text>
            </Form.Item>
            <Form.Item key="scale" label="缩放">
              <Text>[{value.scale?.join(', ')}]</Text>
            </Form.Item>
          </Form>
        );
      }
      return (
        <Form layout="horizontal" labelCol={{ span: 8 }} wrapperCol={{ span: 16 }}>
          {Object.entries(value).map(([key, val]) => (
            <Form.Item key={key} label={key}>
              <Text>{JSON.stringify(val)}</Text>
            </Form.Item>
          ))}
        </Form>
      );
      
    case 'array':
      return (
        <Form layout="horizontal" labelCol={{ span: 8 }} wrapperCol={{ span: 16 }}>
          {value.map((item: any, index: number) => (
            <Form.Item key={`item-${index}`} label={`[${index}]`}>
              <Text>{JSON.stringify(item)}</Text>
            </Form.Item>
          ))}
        </Form>
      );
      
    default:
      return <Text>{String(value)}</Text>;
  }
};
