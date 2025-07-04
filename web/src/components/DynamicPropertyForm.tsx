import React, { useEffect, useState } from 'react';
import { Form, Spin, Collapse, Modal, Table, Button, App as AntdApp } from 'antd';
import type { UploadFile } from 'antd/es/upload/interface';
import type { ColumnsType } from 'antd/es/table';
import { subscriptionAPI, UserTopicSubscription } from '../services/iotService';
import { streamApi, Stream } from '../services/streamApi';
import { attachmentApi, Attachment } from '../services/attachmentApi';
import chartApi, { Chart } from '../services/chartApi';
import { wmtsAPI, WMTSLayer } from '../services/wmtsApi';
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
import JsonTreeField from './fields/JsonTreeField';

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
  } | { [key: string]: FieldMetadata };
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

// 类型守卫函数
const hasGroupsAndFields = (metadata: any): metadata is { groups?: MetadataGroup[]; fields: { [key: string]: FieldMetadata } } => {
  return metadata && typeof metadata === 'object' && ('fields' in metadata || 'groups' in metadata);
};

const isDirectFieldsObject = (metadata: any): metadata is { [key: string]: FieldMetadata } => {
  return metadata && typeof metadata === 'object' && !('fields' in metadata) && !('groups' in metadata);
};

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

  const [bindModalType, setBindModalType] = useState<'iot' | 'video' | 'file' | 'chart' | 'tiles' | null>(null);
  const [bindList, setBindList] = useState<any[]>([]);
  const [bindSelectedKeys, setBindSelectedKeys] = useState<string[]>([]);

  useEffect(() => {
    const newFormValues = data || {};
    setFormValues(newFormValues);
    
    // 根据metadata类型设置表单初始值
    if (hasGroupsAndFields(metadata) && metadata.groups) {
      // 对于分组数据，设置嵌套的表单值
      const nestedFormValues: any = {};
      metadata.groups.forEach(group => {
        const groupData = newFormValues[group.id] || {};
        nestedFormValues[group.id] = groupData;
      });
      form.setFieldsValue(nestedFormValues);
    } else {
      // 对于非分组数据，直接设置表单值
      form.setFieldsValue(newFormValues);
    }
  }, [data, form, metadata]);

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

  const openBindModal = async (type: 'iot' | 'video' | 'file' | 'chart' | 'tiles') => {
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
      } else if (type === 'chart') {
        const res = await chartApi.getChartList();
        list = res.charts || [];
        setBindSelectedKeys(formValues.chart_binds || []);
      } else if (type === 'tiles') {
        const res = await wmtsAPI.getWMTSList();
        list = res.data || [];
        setBindSelectedKeys(formValues.tiles_binding?.wmts_id ? [formValues.tiles_binding.wmts_id] : []);
      }
      setBindList(list);
      setBindModalType(type);
    } catch (err) {
      message.error('获取绑定数据失败');
    }
  };

  const handleBindOk = async () => {
    if (!bindModalType) return;
    
    // 确定是实例属性还是场景属性
    const isInstanceBinding = ['iot', 'video', 'file'].includes(bindModalType);
    
    if (isInstanceBinding) {
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
    } else if (bindModalType === 'chart') {
      // 对于图表绑定，只更新表单状态，由用户手动保存
      const field = 'chart_binds';
      handleFieldChange(field, bindSelectedKeys);
      // 更新 antd Form 的值，以便UI能正确响应
      form.setFieldsValue({ [field]: bindSelectedKeys });
      message.info('图表选择已更新，请点击"保存"按钮来生效。');
      setBindModalType(null);
    } else if (bindModalType === 'tiles') {
      // 对于瓦片绑定，只更新表单状态，由用户手动保存
      const field = 'tiles_binding';
      const tilesBinding = bindSelectedKeys.length > 0 ? {
        wmts_id: bindSelectedKeys[0], // 只选择一个瓦片图层
        enabled: true
      } : {};
      handleFieldChange(field, tilesBinding);
      // 更新 antd Form 的值，以便UI能正确响应
      form.setFieldsValue({ [field]: tilesBinding });
      message.info('瓦片选择已更新，请点击"保存"按钮来生效。');
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
    if (bindModalType === 'chart') {
      return [
        { title: '图表名称', dataIndex: 'name' },
        { title: 'ID', dataIndex: 'uid' },
        { title: '状态', dataIndex: 'status' },
      ];
    }
    if (bindModalType === 'tiles') {
      return [
        { title: '瓦片名称', dataIndex: 'name' },
        { title: 'ID', dataIndex: 'id' },
        { title: '数据源类型', dataIndex: 'source_type' },
        { title: '瓦片格式', dataIndex: 'format' },
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
      case 'object':
      case 'array':
        // 使用JsonTreeField的纯模式，避免双重Form.Item包装
        return <JsonTreeField fieldName={fieldName} value={value} meta={meta} pure={true} />;
      default:
        return <span>{String(value)}</span>;
    }
  };

  const renderEditableField = (
    fieldName: string,
    value: any,
    meta: FieldMetadata,
    onChange: (val: any) => void,
    groupId?: string,
  ) => {
    switch (meta.type) {
      case 'string':
        return <StringField fieldName={fieldName} value={value} meta={meta} onChange={onChange} groupId={groupId} />;
      case 'text':
        return <TextField fieldName={fieldName} value={value} meta={meta} onChange={onChange} />;
      case 'number':
        return <NumberField fieldName={fieldName} value={value} meta={meta} onChange={onChange} groupId={groupId} />;
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
        if (fieldName === 'tiles_binding') {
          return <BindingField fieldName={fieldName} value={value} meta={meta} onOpen={() => openBindModal('tiles')} />;
        }
        // 对于其他对象类型，使用JsonTreeField
        return <JsonTreeField fieldName={fieldName} value={value} meta={meta} onChange={onChange} groupId={groupId} />;
      case 'array':
        if (['iot_binds', 'video_binds', 'file_binds', 'chart_binds'].includes(fieldName)) {
          const type = fieldName === 'iot_binds' ? 'iot' : 
                       fieldName === 'video_binds' ? 'video' :
                       fieldName === 'chart_binds' ? 'chart' : 'file';
          return <BindingField fieldName={fieldName} value={value} meta={meta} onOpen={() => openBindModal(type)} />;
        }
        return <ArrayField fieldName={fieldName} value={value} meta={meta} onChange={onChange} />;
      default:
        return <StringField fieldName={fieldName} value={value} meta={meta} onChange={onChange} groupId={groupId} />;
    }
  };

  const renderField = (fieldName: string, value: any, meta: FieldMetadata, onChange: (val: any) => void, groupId?: string) => {
    if (!meta.editable) {
      return (
        <Form.Item key={fieldName} label={meta.display_name} name={groupId ? [groupId, fieldName] : fieldName}>
          {renderReadOnlyValue(fieldName, value, meta)}
        </Form.Item>
      );
    }
    return <React.Fragment key={fieldName}>{renderEditableField(fieldName, value, meta, onChange, groupId)}</React.Fragment>;
  };

  const renderGroup = (group: MetadataGroup, index: number) => {
    return (
      <Panel header={group.name} key={index.toString()}>
        <Form form={form} layout="horizontal" labelCol={{ span: 6 }} wrapperCol={{ span: 18 }} initialValues={formValues}>
          {group.fields.map((fieldName) => {
            // 使用类型守卫来安全访问字段元数据
            let meta: FieldMetadata | undefined;
            if (hasGroupsAndFields(metadata)) {
              meta = metadata.fields[fieldName];
            } else if (isDirectFieldsObject(metadata)) {
              meta = metadata[fieldName];
            }
            
            if (!meta) return null;
            
            // 修复分组数据的字段值获取逻辑
            const groupData = formValues[group.id] || {};
            const value = groupData[fieldName]; // 分组数据中的字段值
            
            const handleChange = (val: any) => {
              // 更新分组数据
              const newGroupData = { ...groupData, [fieldName]: val };
              handleFieldChange(group.id, newGroupData);
              // 同时更新表单字段值，确保表单能正确显示
              form.setFieldValue([group.id, fieldName], val);
            };
            
            return renderField(fieldName, value, meta, handleChange, group.id);
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
              {metadata ? (
                // 支持两种格式：新格式（后端返回的直接字段对象）和旧格式（metadata.fields）
                (() => {
                  let fields: { [key: string]: FieldMetadata } = {};
                  if (hasGroupsAndFields(metadata)) {
                    fields = metadata.fields;
                  } else if (isDirectFieldsObject(metadata)) {
                    fields = metadata;
                  }
                  
                  return Object.keys(fields).map((fieldName) => {
                    const meta = fields[fieldName];
                    const value = formValues[fieldName];
                    return renderField(fieldName, value, meta, (val) => handleFieldChange(fieldName, val));
                  });
                })()
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
      {hasGroupsAndFields(metadata) && metadata.groups ? (
        <>
          <Collapse defaultActiveKey={['0']} style={{ marginBottom: 16 }}>
            {metadata.groups.map((g, i) => renderGroup(g, i))}
          </Collapse>
          {/* 分组模式下的保存按钮 */}
          <div style={{ textAlign: 'right', marginTop: 16 }}>
            <Button type="primary" onClick={handleSave} loading={saving} disabled={loading}>
              保存
            </Button>
          </div>
        </>
      ) : (
        renderUngrouped()
      )}
      <Modal title="选择绑定项" open={!!bindModalType} onOk={handleBindOk} onCancel={() => setBindModalType(null)} destroyOnClose>
        <Table
          rowKey={bindModalType === 'chart' ? 'uid' : bindModalType === 'tiles' ? 'id' : '_id'}
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
