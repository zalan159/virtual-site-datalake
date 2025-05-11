import React, { useState, useEffect } from 'react';
import { Form, Input, InputNumber, Button, Spin, Typography, Image, Upload, Switch, Space, DatePicker, Row, Col, Collapse } from 'antd';
import { UploadOutlined, PlusOutlined, MinusCircleOutlined } from '@ant-design/icons';
import type { UploadFile } from 'antd/es/upload/interface';
import moment from 'moment';

const { Title, Text } = Typography;
const { TextArea } = Input;

// 定义字段元数据类型
export interface FieldMetadata {
  display_name: string;
  editable: boolean;
  type: string;
  properties?: {
    [key: string]: any;
  };
  min?: number;
  max?: number;
  options?: { label: string; value: any }[];
  description?: string;
}

// 定义组件属性
export interface DynamicPropertyFormProps {
  entityId: string; // 实体ID (可能是sceneId, instanceId等)
  data: any;        // 实体数据
  metadata: {       // 字段元数据
    [key: string]: FieldMetadata;
  };
  loading?: boolean;
  onSave?: (values: any) => Promise<void>; // 新增，保存时回调
  onRefresh?: () => void;
  sectionTitle?: string;
  onFlyToOrigin?: (origin: {longitude: number, latitude: number, height: number}) => void; // 新增
  onUpdatePreviewImage?: () => Promise<void>; // 修改为无参数
}

const DynamicPropertyForm: React.FC<DynamicPropertyFormProps> = ({
  entityId,
  data,
  metadata,
  loading = false,
  onSave,
  onRefresh,
  sectionTitle = '属性',
  onFlyToOrigin,
  onUpdatePreviewImage
}) => {
  const [form] = Form.useForm();
  const [formValues, setFormValues] = useState<any>(data || {});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setFormValues(data || {});
    form.setFieldsValue(data || {});
  }, [data]);

  // 统一保存
  const handleSave = async () => {
    if (!onSave) return;
    setSaving(true);
    try {
      await onSave(formValues);
      if (onRefresh) onRefresh();
    } catch (error) {
      console.error('保存失败:', error);
    } finally {
      setSaving(false);
    }
  };

  // 字段变更时只更新本地状态
  const handleFieldChange = (fieldName: string, value: any) => {
    setFormValues((prev: any) => ({ ...prev, [fieldName]: value }));
  };

  // 处理上传文件
  const handleFileUpload = async (file: UploadFile, fieldName: string) => {
    // 模拟文件上传过程，实际应该调用文件上传接口
    const fakeUrl = 'https://example.com/fake-image-url.jpg';
    handleFieldChange(fieldName, fakeUrl);
    return false; // 阻止默认上传行为
  };

  // 根据字段类型渲染不同的表单组件
  const renderFormItem = (fieldName: string) => {
    const meta = metadata[fieldName];
    if (!meta) return null;

    const value = formValues[fieldName];
    // 构建共有的表单项属性
    const itemProps = {
      label: (
        <span>
          {meta.display_name}
          {meta.description && (
            <span style={{ fontSize: '12px', color: '#888', marginLeft: '8px' }}>
              ({meta.description})
            </span>
          )}
        </span>
      ),
      name: fieldName,
    };

    // 如果字段不可编辑，显示只读内容
    if (!meta.editable) {
      return (
        <Form.Item key={fieldName} {...itemProps}>
          {renderReadOnlyValue(fieldName, value, meta)}
        </Form.Item>
      );
    }

    // 根据类型渲染可编辑表单控件
    switch (meta.type) {
      case 'string':
        return (
          <Form.Item key={fieldName} {...itemProps}>
            <Input
              value={value}
              placeholder={`请输入${meta.display_name}`}
              onChange={(e) => handleFieldChange(fieldName, e.target.value)}
            />
          </Form.Item>
        );
      case 'text':
        return (
          <Form.Item key={fieldName} {...itemProps}>
            <TextArea
              rows={4}
              value={value}
              placeholder={`请输入${meta.display_name}`}
              onChange={(e) => handleFieldChange(fieldName, e.target.value)}
            />
          </Form.Item>
        );
      case 'number':
        return (
          <Form.Item key={fieldName} {...itemProps}>
            <InputNumber
              style={{ width: '100%' }}
              min={meta.min}
              max={meta.max}
              value={value}
              onChange={(val) => handleFieldChange(fieldName, val)}
            />
          </Form.Item>
        );
      case 'boolean':
        return (
          <Form.Item key={fieldName} {...itemProps} valuePropName="checked">
            <Switch
              checked={!!value}
              onChange={(checked) => handleFieldChange(fieldName, checked)}
            />
          </Form.Item>
        );
      case 'datetime':
        return (
          <Form.Item key={fieldName} {...itemProps}>
            <DatePicker
              style={{ width: '100%' }}
              showTime
              value={value ? moment(value) : undefined}
              onChange={(date) => {
                if (date) {
                  const isoString = date.toISOString();
                  handleFieldChange(fieldName, isoString);
                } else {
                  handleFieldChange(fieldName, null);
                }
              }}
            />
          </Form.Item>
        );
      case 'image':
        // 仅 preview_image 字段支持更新按钮
        if (fieldName === 'preview_image' && typeof onUpdatePreviewImage === 'function') {
          return (
            <Form.Item key={fieldName} {...itemProps}>
              <div
                style={{ position: 'relative', display: 'inline-block' }}
                onMouseEnter={() => setFormValues((prev: any) => ({ ...prev, [`${fieldName}_hover`]: true }))}
                onMouseLeave={() => setFormValues((prev: any) => ({ ...prev, [`${fieldName}_hover`]: false }))}
              >
                <Image
                  src={value || '/logoonly.png'}
                  width={200}
                  style={{ marginBottom: 8 }}
                  fallback="/logoonly.png"
                  preview={true}
                />
                {formValues[`${fieldName}_hover`] && (
                  <div style={{
                    position: 'absolute',
                    top: 8,
                    left: 8,
                    background: 'rgba(0,0,0,0.5)',
                    color: '#fff',
                    borderRadius: 4,
                    padding: '2px 8px',
                    zIndex: 10,
                    display: 'flex',
                    gap: 8
                  }}>
                    <Button
                      size="small"
                      type="primary"
                      icon={<UploadOutlined />}
                      onClick={() => onUpdatePreviewImage()}
                    >
                      更新
                    </Button>
                  </div>
                )}
              </div>
            </Form.Item>
          );
        }
        // 其他 image 字段保持原有逻辑
        return (
          <Form.Item key={fieldName} {...itemProps}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
              <Image 
                src={value || '/logoonly.png'} 
                width={200} 
                style={{ marginBottom: 8 }} 
                fallback="/logoonly.png"
              />
              <Upload
                beforeUpload={(file) => handleFileUpload(file, fieldName)}
                showUploadList={false}
              >
                <Button
                  icon={<UploadOutlined />}
                >
                  {value ? '更换图片' : '上传图片'}
                </Button>
              </Upload>
            </div>
          </Form.Item>
        );
      case 'object':
        if (fieldName === 'origin') {
          return renderOriginField(fieldName, value, meta);
        } else if (fieldName === 'transform') {
          return renderTransformField(fieldName, value, meta);
        }
        return renderGenericObjectField(fieldName, value, meta);
      case 'array':
        return renderArrayField(fieldName, value, meta);
      default:
        return (
          <Form.Item key={fieldName} {...itemProps}>
            <Input
              value={value}
              onChange={(e) => handleFieldChange(fieldName, e.target.value)}
            />
          </Form.Item>
        );
    }
  };

  // 渲染只读值
  const renderReadOnlyValue = (fieldName: string, value: any, meta: FieldMetadata) => {
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

  // 渲染原点字段
  const renderOriginField = (fieldName: string, value: any, meta: FieldMetadata) => {
    const originValue = value || { longitude: 0, latitude: 0, height: 0 };
    const handleOriginChange = (key: string, val: number) => {
      const newOrigin = { ...originValue, [key]: val };
      handleFieldChange(fieldName, newOrigin);
    };
    return (
      <Form.Item label={meta.display_name} key={fieldName}>
        <Row gutter={[16, 16]}>
          <Col span={24}>
            <Form.Item label="经度" style={{ marginBottom: 8 }}>
              <InputNumber
                value={originValue.longitude}
                min={meta.properties?.longitude?.min || -180}
                max={meta.properties?.longitude?.max || 180}
                step={0.000001}
                style={{ width: '100%' }}
                onChange={(value) => handleOriginChange('longitude', value as number)}
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
                onChange={(value) => handleOriginChange('latitude', value as number)}
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
                onChange={(value) => handleOriginChange('height', value as number)}
              />
            </Form.Item>
          </Col>
          <Col span={24} style={{ textAlign: 'right' }}>
            {typeof originValue.longitude === 'number' && typeof originValue.latitude === 'number' && onFlyToOrigin && (
              <Button
                size="small"
                type="default"
                onClick={() => onFlyToOrigin!(originValue)}
                style={{ marginTop: 8 }}
              >
                飞到原点
              </Button>
            )}
          </Col>
        </Row>
      </Form.Item>
    );
  };

  // 渲染变换字段 (position, rotation, scale)
  const renderTransformField = (fieldName: string, value: any, meta: FieldMetadata) => {
    const transformValue = value || {
      location: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1]
    };
    const handleTransformChange = (key: string, index: number, val: number) => {
      const newArray = [...(transformValue[key] || [])];
      newArray[index] = val;
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
                    onChange={(value) => handleTransformChange('location', 0, value as number)}
                  />
                </Col>
                <Col span={8}>
                  <InputNumber
                    value={transformValue.location?.[1]}
                    style={{ width: '100%' }}
                    onChange={(value) => handleTransformChange('location', 1, value as number)}
                  />
                </Col>
                <Col span={8}>
                  <InputNumber
                    value={transformValue.location?.[2]}
                    style={{ width: '100%' }}
                    onChange={(value) => handleTransformChange('location', 2, value as number)}
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
                    onChange={(value) => handleTransformChange('rotation', 0, value as number)}
                  />
                </Col>
                <Col span={8}>
                  <InputNumber
                    value={transformValue.rotation?.[1]}
                    style={{ width: '100%' }}
                    onChange={(value) => handleTransformChange('rotation', 1, value as number)}
                  />
                </Col>
                <Col span={8}>
                  <InputNumber
                    value={transformValue.rotation?.[2]}
                    style={{ width: '100%' }}
                    onChange={(value) => handleTransformChange('rotation', 2, value as number)}
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
                    onChange={(value) => handleTransformChange('scale', 0, value as number)}
                  />
                </Col>
                <Col span={8}>
                  <InputNumber
                    value={transformValue.scale?.[1]}
                    style={{ width: '100%' }}
                    onChange={(value) => handleTransformChange('scale', 1, value as number)}
                  />
                </Col>
                <Col span={8}>
                  <InputNumber
                    value={transformValue.scale?.[2]}
                    style={{ width: '100%' }}
                    onChange={(value) => handleTransformChange('scale', 2, value as number)}
                  />
                </Col>
              </Row>
            </Form.Item>
          </Col>
        </Row>
      </Form.Item>
    );
  };

  // 渲染通用对象字段
  const renderGenericObjectField = (fieldName: string, value: any, meta: FieldMetadata) => {
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
              // 解析错误时不更新
              console.error('JSON解析错误:', error);
            }
          }}
        />
      </Form.Item>
    );
  };

  // 渲染数组字段
  const renderArrayField = (fieldName: string, value: any[], meta: FieldMetadata) => {
    const arrayValue = value || [];
    return (
      <Form.Item label={meta.display_name} key={fieldName}>
        <Form.List name={fieldName} initialValue={arrayValue}>
          {(fields, { add, remove }) => (
            <>
              {fields.map((field, index) => (
                <Space key={field.key} style={{ display: 'flex', marginBottom: 8 }} align="baseline">
                  <Form.Item
                    {...field}
                    style={{ marginBottom: 0 }}
                  >
                    <Input
                      value={arrayValue[index]}
                      onChange={(e) => {
                        const newArray = [...arrayValue];
                        newArray[index] = e.target.value;
                        handleFieldChange(fieldName, newArray);
                      }}
                    />
                  </Form.Item>
                  <MinusCircleOutlined
                    onClick={() => {
                      remove(field.name);
                      const newArray = [...arrayValue];
                      newArray.splice(index, 1);
                      handleFieldChange(fieldName, newArray);
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

  return (
    <Collapse
      defaultActiveKey={['1']}
      style={{ marginBottom: 16 }}
      items={[
        {
          key: '1',
          label: sectionTitle,
          children: (
            <Spin spinning={loading || saving}>
              <Form
                form={form}
                layout="horizontal"
                labelCol={{ span: 6 }}
                wrapperCol={{ span: 18 }}
                initialValues={formValues}
              >
                {formValues && metadata && Object.keys(metadata).map(fieldName => renderFormItem(fieldName))}
              </Form>
              <div style={{ textAlign: 'right', marginTop: 16 }}>
                <Button type="primary" onClick={handleSave} loading={saving} disabled={loading}>
                  保存
                </Button>
              </div>
            </Spin>
          )
        }
      ]}
    />
  );
};

export default DynamicPropertyForm; 