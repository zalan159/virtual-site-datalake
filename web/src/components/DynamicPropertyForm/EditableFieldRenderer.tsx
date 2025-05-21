import React from 'react';
import { Form, Input, InputNumber, Switch, DatePicker, Image, Upload, Button, Space } from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import type { UploadFile } from 'antd/es/upload/interface';
import moment from 'moment';

import { FieldMetadata } from './types';
import { renderOriginField, renderTransformField, renderGenericObjectField } from './objectFieldRenderers';
import { renderArrayField, renderBindingField } from './arrayFieldRenderers';

const { TextArea } = Input;

export interface EditableFieldRendererProps {
  fieldName: string;
  fieldValue: any;
  meta: FieldMetadata;
  itemProps: any; // Props for Form.Item (label, name, etc.)
  handleFieldChange: (fieldName: string, value: any) => void;
  
  // Props for specific field types
  onUpdatePreviewImage?: () => Promise<void>;
  handleFileUploadForField: (file: UploadFile) => Promise<string>; // Wraps original handleFileUpload

  objectRenderProps: {
    onFlyToOrigin?: (origin: { longitude: number; latitude: number; height: number }) => void;
    startPickOrigin?: () => void;
    isPickingOrigin?: boolean;
  };
  arrayRenderProps: {
    onShowBindingModal: (type: 'iot' | 'video' | 'file', fieldName: string, groupId?: string) => void; // Updated to include groupId
  };
  
  formValues: any; // Full formValues state for image hover logic
  setFormValues: React.Dispatch<React.SetStateAction<any>>; // For setting hover state
  
  // Optional groupId for grouped fields, to pass to onShowBindingModal
  groupId?: string | null; 
}

const EditableFieldRenderer: React.FC<EditableFieldRendererProps> = ({
  fieldName,
  fieldValue,
  meta,
  itemProps,
  handleFieldChange,
  onUpdatePreviewImage,
  handleFileUploadForField,
  objectRenderProps,
  arrayRenderProps,
  formValues,
  setFormValues,
  groupId,
}) => {

  switch (meta.type) {
    case 'string':
      return (
        <Form.Item {...itemProps}>
          <Input
            value={fieldValue}
            placeholder={`请输入${meta.display_name}`}
            onChange={(e) => handleFieldChange(fieldName, e.target.value)}
          />
        </Form.Item>
      );
    case 'text':
      return (
        <Form.Item {...itemProps}>
          <TextArea
            rows={4}
            value={fieldValue}
            placeholder={`请输入${meta.display_name}`}
            onChange={(e) => handleFieldChange(fieldName, e.target.value)}
          />
        </Form.Item>
      );
    case 'number':
      return (
        <Form.Item {...itemProps}>
          <InputNumber
            style={{ width: '100%' }}
            min={meta.min}
            max={meta.max}
            value={fieldValue}
            onChange={(val) => handleFieldChange(fieldName, val)}
          />
        </Form.Item>
      );
    case 'boolean':
      return (
        <Form.Item {...itemProps} valuePropName="checked">
          <Switch
            checked={!!fieldValue}
            onChange={(checked) => handleFieldChange(fieldName, checked)}
          />
        </Form.Item>
      );
    case 'datetime':
      return (
        <Form.Item {...itemProps}>
          <DatePicker
            style={{ width: '100%' }}
            showTime
            value={fieldValue ? moment(fieldValue) : undefined}
            onChange={(date) => {
              handleFieldChange(fieldName, date ? date.toISOString() : null);
            }}
          />
        </Form.Item>
      );
    case 'image':
      if (fieldName === 'preview_image' && typeof onUpdatePreviewImage === 'function') {
        return (
          <Form.Item {...itemProps}>
            <div
              style={{ position: 'relative', display: 'inline-block' }}
              onMouseEnter={() => setFormValues((prev: any) => ({ ...prev, [`${fieldName}_hover`]: true }))}
              onMouseLeave={() => setFormValues((prev: any) => ({ ...prev, [`${fieldName}_hover`]: false }))}
            >
              <Image
                src={fieldValue || '/logoonly.png'}
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
                    onClick={onUpdatePreviewImage}
                  >
                    更新
                  </Button>
                </div>
              )}
            </div>
          </Form.Item>
        );
      }
      // Generic image field
      return (
        <Form.Item {...itemProps}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
            <Image
              src={fieldValue || '/logoonly.png'}
              width={200}
              style={{ marginBottom: 8 }}
              fallback="/logoonly.png"
            />
            <Upload
              beforeUpload={(file) => {
                handleFileUploadForField(file); // This now calls the field-specific wrapper
                return false; // Prevent antd default upload
              }}
              showUploadList={false}
            >
              <Button icon={<UploadOutlined />}>
                {fieldValue ? '更换图片' : '上传图片'}
              </Button>
            </Upload>
          </div>
        </Form.Item>
      );
    case 'object':
      if (fieldName === 'origin') {
        return renderOriginField(fieldName, fieldValue, meta, handleFieldChange, objectRenderProps);
      } else if (fieldName === 'transform') {
        return renderTransformField(fieldName, fieldValue, meta, handleFieldChange);
      }
      return renderGenericObjectField(fieldName, fieldValue, meta, handleFieldChange);
      
    case 'array':
      const arrayValue = Array.isArray(fieldValue) ? fieldValue : [];
      if (['iot_binds', 'video_binds', 'file_binds'].includes(fieldName)) {
        return renderBindingField(fieldName, arrayValue, meta, (type, fName) => arrayRenderProps.onShowBindingModal(type, fName, groupId));
      }
      return renderArrayField(fieldName, arrayValue, meta, handleFieldChange);

    default:
      // Fallback for unknown types, or could throw an error
      return (
        <Form.Item {...itemProps}>
          <Input
            value={fieldValue}
            placeholder={`未知类型: ${meta.display_name}`}
            onChange={(e) => handleFieldChange(fieldName, e.target.value)}
            disabled
          />
        </Form.Item>
      );
  }
};

export default EditableFieldRenderer;
