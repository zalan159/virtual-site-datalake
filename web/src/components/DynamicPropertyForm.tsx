import React, { useEffect, useState } from 'react';
import { Form, Spin, Collapse, Modal, Table, Button, App as AntdApp } from 'antd';
import type { UploadFile } from 'antd/es/upload/interface';
import type { ColumnsType } from 'antd/es/table';
import { subscriptionAPI, UserTopicSubscription } from '../services/iotService';
import { streamApi, Stream } from '../services/streamApi';
import { attachmentApi, Attachment } from '../services/attachmentApi';
import { updateInstanceProperties } from '../services/sceneApi';
import StringField from './fields/StringField';
import TextField from './fields/TextField';
import NumberField from './fields/NumberField';
import BooleanField from './fields/BooleanField';
import DateTimeField from './fields/DateTimeField';
import ImageField from './fields/ImageField';
import OriginField from './fields/OriginField';
import TransformField from './fields/TransformField';
import GenericObjectField from './fields/GenericObjectField';
import ArrayField from './fields/ArrayField';
import BindingField from './fields/BindingField';

const { Panel } = Collapse;

export interface FieldMetadata {
  display_name: string;
  editable: boolean;
  type: string;
  properties?: { [key: string]: any };
  min?: number;
  max?: number;
  options?: { label: string; value: any }[];
  description?: string;
}

export interface MetadataGroup {
  id: string;
  name: string;
  fields: string[];
}

export interface DynamicPropertyFormProps {
  entityId: string;
  data: any;
  metadata: {
    groups?: MetadataGroup[];
    fields: { [key: string]: FieldMetadata };
  };
  loading?: boolean;
  onSave?: (values: any) => Promise<void>;
  onRefresh?: () => void;
  sectionTitle?: string;
  onFlyToOrigin?: (origin: { longitude: number; latitude: number; height: number }) => void;
  onUpdatePreviewImage?: () => Promise<void>;
  startPickOrigin?: () => void;
  isPickingOrigin?: boolean;
  pickedOrigin?: { longitude: number; latitude: number; height: number } | null;
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
  onUpdatePreviewImage,
  startPickOrigin,
  isPickingOrigin,
}) => {
  const [form] = Form.useForm();
  const [formValues, setFormValues] = useState<any>(data || {});
  const [saving, setSaving] = useState(false);
  const { message } = AntdApp.useApp();

  const [bindModalType, setBindModalType] = useState<'iot' | 'video' | 'file' | null>(null);
  const [bindList, setBindList] = useState<any[]>([]);
  const [bindSelectedKeys, setBindSelectedKeys] = useState<string[]>([]);

  useEffect(() => {
    setFormValues(data || {});
    form.setFieldsValue(data || {});
  }, [data, form]);

  const handleSave = async () => {
    if (!onSave) return;
    setSaving(true);
    try {
      await onSave(formValues);
      onRefresh && onRefresh();
    } catch (err) {
      console.error('保存失败:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleFieldChange = (fieldName: string, value: any) => {
    setFormValues((prev: any) => ({ ...prev, [fieldName]: value }));
  };

  const handleFileUpload = async (_file: UploadFile, fieldName: string): Promise<string> => {
    const fakeUrl = 'https://example.com/fake-image-url.jpg';
    handleFieldChange(fieldName, fakeUrl);
    return fakeUrl;
  };

  const openBindModal = async (type: 'iot' | 'video' | 'file') => {
    try {
      let list: any[] = [];
      if (type === 'iot') {
        const res = await subscriptionAPI.list();
        list = res.data || [];
        setBindSelectedKeys(formValues.iot_binds || []);
      } else if (type === 'video') {
        const data = await streamApi.getList();
        list = data || [];
        setBindSelectedKeys(formValues.video_binds || []);
      } else if (type === 'file') {
        const data = await attachmentApi.getList();
        list = data || [];
        setBindSelectedKeys(formValues.file_binds || []);
      }
      setBindList(list);
      setBindModalType(type);
    } catch (err) {
      message.error('获取绑定数据失败');
    }
  };

  const handleBindOk = async () => {
    if (!bindModalType) return;
    const field = bindModalType === 'iot' ? 'iot_binds' : bindModalType === 'video' ? 'video_binds' : 'file_binds';
    try {
      await updateInstanceProperties(entityId, { [field]: bindSelectedKeys });
      handleFieldChange(field, bindSelectedKeys);
      message.success('绑定成功');
    } catch (err) {
      message.error('绑定失败');
    } finally {
      setBindModalType(null);
    }
  };

  const bindColumns = (): ColumnsType<any> => {
    if (bindModalType === 'iot') {
      return [
        { title: '主题', dataIndex: 'topic' },
        { title: 'ID', dataIndex: '_id' },
      ];
    }
    if (bindModalType === 'video') {
      return [
        { title: '名称', dataIndex: 'name' },
        { title: '协议', dataIndex: 'protocol' },
      ];
    }
    if (bindModalType === 'file') {
      return [
        { title: '文件名', dataIndex: 'filename' },
        { title: '扩展名', dataIndex: 'extension' },
      ];
    }
    return [];
  };

  const renderReadOnlyValue = (fieldName: string, value: any, meta: FieldMetadata) => {
    if (value === null || value === undefined) return <span style={{ color: '#888' }}>暂无数据</span>;
    switch (meta.type) {
      case 'datetime':
        return <span>{value ? new Date(value).toLocaleString() : '暂无数据'}</span>;
      case 'image':
        return <img src={value || '/logoonly.png'} style={{ width: 200 }} />;
      case 'boolean':
        return <span>{value ? '是' : '否'}</span>;
      default:
        return <span>{String(value)}</span>;
    }
  };

  const renderEditableField = (
    fieldName: string,
    value: any,
    meta: FieldMetadata,
    onChange: (val: any) => void,
  ) => {
    switch (meta.type) {
      case 'string':
        return <StringField fieldName={fieldName} value={value} meta={meta} onChange={onChange} />;
      case 'text':
        return <TextField fieldName={fieldName} value={value} meta={meta} onChange={onChange} />;
      case 'number':
        return <NumberField fieldName={fieldName} value={value} meta={meta} onChange={onChange} />;
      case 'boolean':
        return <BooleanField fieldName={fieldName} value={value} meta={meta} onChange={onChange} />;
      case 'datetime':
        return <DateTimeField fieldName={fieldName} value={value} meta={meta} onChange={onChange} />;
      case 'image':
        return (
          <ImageField
            fieldName={fieldName}
            value={value}
            meta={meta}
            onChange={onChange}
            onUpdatePreviewImage={onUpdatePreviewImage}
            onUpload={(file) => handleFileUpload(file, fieldName)}
          />
        );
      case 'object':
        if (fieldName === 'origin') {
          return (
            <OriginField
              fieldName={fieldName}
              value={value}
              meta={meta}
              onChange={onChange}
              onFlyToOrigin={onFlyToOrigin}
              startPickOrigin={startPickOrigin}
              isPickingOrigin={isPickingOrigin}
            />
          );
        }
        if (fieldName === 'transform') {
          return <TransformField fieldName={fieldName} value={value} meta={meta} onChange={onChange} />;
        }
        return <GenericObjectField fieldName={fieldName} value={value} meta={meta} onChange={onChange} />;
      case 'array':
        if (['iot_binds', 'video_binds', 'file_binds'].includes(fieldName)) {
          const type = fieldName === 'iot_binds' ? 'iot' : fieldName === 'video_binds' ? 'video' : 'file';
          return <BindingField fieldName={fieldName} value={value} meta={meta} onOpen={() => openBindModal(type)} />;
        }
        return <ArrayField fieldName={fieldName} value={value} meta={meta} onChange={onChange} />;
      default:
        return <StringField fieldName={fieldName} value={value} meta={meta} onChange={onChange} />;
    }
  };

  const renderField = (fieldName: string, value: any, meta: FieldMetadata, onChange: (val: any) => void) => {
    const itemProps = { label: fieldName, name: fieldName };
    if (!meta.editable) {
      return (
        <Form.Item key={fieldName} label={meta.display_name} name={fieldName}>
          {renderReadOnlyValue(fieldName, value, meta)}
        </Form.Item>
      );
    }
    return <React.Fragment key={fieldName}>{renderEditableField(fieldName, value, meta, onChange)}</React.Fragment>;
  };

  const renderGroup = (group: MetadataGroup, index: number) => {
    return (
      <Panel header={group.name} key={index.toString()}>
        <Form form={form} layout="horizontal" labelCol={{ span: 6 }} wrapperCol={{ span: 18 }} initialValues={formValues}>
          {group.fields.map((fieldName) => {
            const meta = metadata.fields[fieldName];
            if (!meta) return null;
            const groupData = formValues[group.id] || {};
            const value = fieldName in groupData ? groupData[fieldName] : formValues[fieldName];
            const handleChange = (val: any) => {
              const newGroup = { ...groupData, [fieldName]: val };
              handleFieldChange(group.id, newGroup);
            };
            return renderField(fieldName, value, meta, handleChange);
          })}
        </Form>
      </Panel>
    );
  };

  const renderUngrouped = () => (
    <Collapse
      defaultActiveKey={['1']}
      style={{ marginBottom: 16 }}
      items={[{
        key: '1',
        label: sectionTitle,
        children: (
          <>
            <Form form={form} layout="horizontal" labelCol={{ span: 6 }} wrapperCol={{ span: 18 }} initialValues={formValues}>
              {metadata && metadata.fields ? (
                Object.keys(metadata.fields).map((fieldName) => {
                  const meta = metadata.fields[fieldName];
                  const value = formValues[fieldName];
                  return renderField(fieldName, value, meta, (val) => handleFieldChange(fieldName, val));
                })
              ) : (
                <div style={{ padding: '20px', textAlign: 'center' }}>没有可用的属性字段。</div>
              )}
            </Form>
            <div style={{ textAlign: 'right', marginTop: 16 }}>
              <Button type="primary" onClick={handleSave} loading={saving} disabled={loading}>
                保存
              </Button>
            </div>
          </>
        ),
      }]}
    />
  );

  return (
    <Spin spinning={loading || saving}>
      {metadata?.groups ? (
        <Collapse defaultActiveKey={['0']} style={{ marginBottom: 16 }}>
          {metadata.groups.map((g, i) => renderGroup(g, i))}
        </Collapse>
      ) : (
        renderUngrouped()
      )}
      <Modal title="选择绑定项" open={!!bindModalType} onOk={handleBindOk} onCancel={() => setBindModalType(null)} destroyOnClose>
        <Table
          rowKey="_id"
          dataSource={bindList}
          columns={bindColumns()}
          rowSelection={{ selectedRowKeys: bindSelectedKeys, onChange: (keys) => setBindSelectedKeys(keys as string[]) }}
          pagination={false}
        />
      </Modal>
    </Spin>
  );
};

export default DynamicPropertyForm;
