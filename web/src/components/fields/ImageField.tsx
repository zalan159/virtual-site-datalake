import React from 'react';
import { Form, Image, Upload, Button } from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import type { UploadFile } from 'antd/es/upload/interface';
import { FieldMetadata } from '../DynamicPropertyForm';

interface ImageFieldProps {
  fieldName: string;
  value: string | undefined;
  meta: FieldMetadata;
  onChange: (value: string) => void;
  onUpdatePreviewImage?: () => Promise<void>;
  onUpload: (file: UploadFile) => Promise<string>;
}

const ImageField: React.FC<ImageFieldProps> = ({ fieldName, value, meta, onChange, onUpdatePreviewImage, onUpload }) => {
  if (fieldName === 'preview_image' && onUpdatePreviewImage) {
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
        name={fieldName}
      >
        <div style={{ position: 'relative', display: 'inline-block' }}>
          <Image src={value || '/logoonly.png'} width={200} style={{ marginBottom: 8 }} fallback="/logoonly.png" preview />
          <div style={{ position: 'absolute', top: 8, left: 8 }}>
            <Button size="small" type="primary" icon={<UploadOutlined />} onClick={() => onUpdatePreviewImage()}>更新</Button>
          </div>
        </div>
      </Form.Item>
    );
  }

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
      name={fieldName}
    >
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
        <Image src={value || '/logoonly.png'} width={200} style={{ marginBottom: 8 }} fallback="/logoonly.png" />
        <Upload beforeUpload={file => { onUpload(file); return false; }} showUploadList={false}>
          <Button icon={<UploadOutlined />}>{value ? '更换图片' : '上传图片'}</Button>
        </Upload>
      </div>
    </Form.Item>
  );
};

export default ImageField;
