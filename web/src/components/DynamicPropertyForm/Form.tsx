import React, { useState, useEffect } from 'react';
import { Form, Input, InputNumber, Button, Spin, Typography, Image, Upload, Switch, Space, DatePicker, Row, Col, Collapse, Modal, Table, App as AntdApp } from 'antd';
import { UploadOutlined, PlusOutlined, MinusCircleOutlined } from '@ant-design/icons';
import type { UploadFile } from 'antd/es/upload/interface';
import moment from 'moment';
import type { ColumnsType } from 'antd/es/table';
import { subscriptionAPI, UserTopicSubscription } from '../../services/iotService'; // Not used directly in component after refactor, but BindingModal uses it
import { streamApi, Stream } from '../../services/streamApi'; // Not used directly in component after refactor, but BindingModal uses it
import { attachmentApi, Attachment } from '../../services/attachmentApi'; // Not used directly in component after refactor, but BindingModal uses it
import { updateInstanceProperties } from '../../services/sceneApi';
import { FieldMetadata, MetadataGroup, DynamicPropertyFormProps } from './types';
import { renderReadOnlyValue } from './renderReadOnlyValue';
// Removed renderOriginField, renderTransformField, renderGenericObjectField, renderArrayField, renderBindingField
import BindingModal from './BindingModal';
import EditableFieldRenderer from './EditableFieldRenderer'; // Added import

const { Text } = Typography;
const { TextArea } = Input;
const { Panel } = Collapse;

const DynamicPropertyForm: React.FC<DynamicPropertyFormProps> = ({
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
  // 添加console.log来打印data和metadata
  console.log('DynamicPropertyForm data:', data);
  console.log('DynamicPropertyForm metadata:', metadata);

  const [form] = Form.useForm();
  const [formValues, setFormValues] = useState<any>(data || {});
  const [saving, setSaving] = useState(false);
  const { message } = AntdApp.useApp();

  // New binding modal state
  const [bindingModalState, setBindingModalState] = useState<{
    visible: boolean;
    type: 'iot' | 'video' | 'file' | null;
    fieldName: string | null;
    initialKeys: string[];
    groupId?: string | null; // Added for group context
  }>({ visible: false, type: null, fieldName: null, initialKeys: [], groupId: null });

  useEffect(() => {
    setFormValues(data || {});
    form.setFieldsValue(data || {});
  }, [data]);

  // New binding modal functions (group-aware)
  const showBindingModal = (type: 'iot' | 'video' | 'file', fieldName: string, groupId?: string) => {
    const keys = groupId ? (formValues[groupId]?.[fieldName] || []) : (formValues[fieldName] || []);
    setBindingModalState({
      visible: true,
      type,
      fieldName,
      initialKeys: keys,
      groupId: groupId || null,
    });
  };

  const handleBindingModalOk = async (selectedKeys: string[]) => {
    const { fieldName, type, groupId } = bindingModalState;
    if (!fieldName || !type) return;

    try {
      if (groupId) {
        // For grouped fields, updateInstanceProperties might need the full path or specific group handling.
        // This example assumes the API might need a nested structure or the backend handles flat properties with group context.
        // The critical part for the UI state is updating formValues correctly.
        // Adjust the API call { [groupId]: { ...formValues[groupId], [fieldName]: selectedKeys } } if your backend expects nested updates.
        // Or, if properties are flat but grouped logically in metadata: await updateInstanceProperties(entityId, { [fieldName]: selectedKeys });
        // For this example, let's assume the property name itself is unique enough for the backend, or it's handled by fieldName mapping if necessary.
        await updateInstanceProperties(entityId, { [fieldName]: selectedKeys }); // Assuming fieldName is unique or mapped
        
        const groupData = { ...(formValues[groupId] || {}) };
        groupData[fieldName] = selectedKeys;
        handleFieldChange(groupId, groupData); // Update formValues for the group
      } else {
        // Logic for non-grouped field update
        await updateInstanceProperties(entityId, { [fieldName]: selectedKeys });
        handleFieldChange(fieldName, selectedKeys); // Update root formValues
      }
      message.success('绑定成功');
    } catch (err) {
      message.error('绑定失败');
      console.error('Binding failed:', err);
    } finally {
      setBindingModalState({ visible: false, type: null, fieldName: null, initialKeys: [], groupId: null });
    }
  };

  const handleBindingModalCancel = () => {
    setBindingModalState({ visible: false, type: null, fieldName: null, initialKeys: [], groupId: null });
  };

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
  const handleFileUpload = async (_file: UploadFile, fieldName: string): Promise<string> => {
    // 模拟文件上传过程，实际应该调用文件上传接口
    const fakeUrl = 'https://example.com/fake-image-url.jpg';
    handleFieldChange(fieldName, fakeUrl);
    return fakeUrl; // 返回URL以便分组模式下使用
  };

  // 根据字段类型渲染不同的表单组件
  const renderFormItem = (fieldName: string) => {
    const meta = metadata.fields ? metadata.fields[fieldName] : (metadata as any)[fieldName];
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

    // Replace the switch statement with EditableFieldRenderer for non-grouped logic
    return (
      <EditableFieldRenderer
        fieldName={fieldName}
        fieldValue={value} // value from renderFormItem's scope
        meta={meta}
        itemProps={itemProps} // itemProps from renderFormItem's scope
        handleFieldChange={handleFieldChange} // The main handleFieldChange
        onUpdatePreviewImage={onUpdatePreviewImage}
        handleFileUploadForField={(file) => handleFileUpload(file, fieldName)} // Pass the original handleFileUpload
        objectRenderProps={{ onFlyToOrigin, startPickOrigin, isPickingOrigin }}
        arrayRenderProps={{
          onShowBindingModal: (type, fName) => showBindingModal(type, fName, undefined) // Pass undefined for groupId
        }}
        formValues={formValues}
        setFormValues={setFormValues}
        groupId={undefined} // Explicitly undefined for non-grouped
      />
    );
  return (
    <Spin spinning={loading || saving}>
      {metadata?.groups ? (
        // 新的分组渲染逻辑 - 每个分组一个折叠面板
        <Collapse defaultActiveKey={['0']} style={{ marginBottom: 16 }}>
          {metadata.groups.map((group, index) => (
            <Panel header={group.name} key={index.toString()}>
              <Form
                form={form}
                layout="horizontal"
                labelCol={{ span: 6 }}
                wrapperCol={{ span: 18 }}
                initialValues={formValues}
              >
                {group.fields.map(fieldName => {
                  // 获取正确的字段值
                  let value;
                  
                  // 优先尝试从数据中获取分组下的值
                  if (formValues && formValues[group.id] && fieldName in formValues[group.id]) {
                    value = formValues[group.id][fieldName];
                  } 
                  // 如果分组中没有，则尝试从根级别获取（兼容旧数据结构）
                  else if (formValues && fieldName in formValues) {
                    value = formValues[fieldName];
                  }
                  
                  // 打印当前字段信息，便于调试
                  console.log(`字段 ${fieldName}，分组 ${group.id}，值:`, value);
                  
                  // 获取元数据
                  const meta = metadata.fields[fieldName];
                  if (!meta) return null;
                  
                  // 构建表单项属性
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

                  // Replace the switch statement with EditableFieldRenderer for grouped logic
                  // Define group-specific handleFieldChange for simple fields
                  const groupSpecificHandleFieldChange = (fName: string, val: any) => {
                    // group.id should always exist in this context
                    const currentGroupData = { ...(formValues[group.id] || {}) };
                    currentGroupData[fName] = val; // fName is the fieldName within the group
                    handleFieldChange(group.id, currentGroupData); // Update the entire group object in formValues
                  };

                  // Define group-specific handleFileUpload
                  const groupSpecificHandleFileUpload = async (file: UploadFile) => {
                    // handleFileUpload is from the outer scope, it updates formValues at the root level.
                    // For grouped fields, we need to ensure it updates the correct nested property.
                    // The original handleFileUpload updates formValues[fieldName], so we need to adapt.
                    // It should update formValues[group.id][fieldName]
                    const url = await handleFileUpload(file, fieldName); // Call original to upload and get URL
                    
                    // Now, correctly update the formValues state for the grouped field
                    const currentGroupData = { ...(formValues[group.id] || {}) };
                    currentGroupData[fieldName] = url; // fieldName is the key within the group
                    handleFieldChange(group.id, currentGroupData); // Update the group in formValues
                    return url; // Return URL, though EditableFieldRenderer might not use promise directly
                  };

                  return (
                    <EditableFieldRenderer
                      fieldName={fieldName}
                      fieldValue={value} // value from the group mapping scope
                      meta={meta} // meta from the group mapping scope
                      itemProps={itemProps} // itemProps from the group mapping scope
                      handleFieldChange={groupSpecificHandleFieldChange} // Use the group-aware one
                      onUpdatePreviewImage={onUpdatePreviewImage} // This might need group context if preview_image can be in a group
                      handleFileUploadForField={groupSpecificHandleFileUpload} // Use the group-aware one
                      objectRenderProps={{ onFlyToOrigin, startPickOrigin, isPickingOrigin }}
                      arrayRenderProps={{
                        onShowBindingModal: (type, fName) => showBindingModal(type, fName, group.id)
                      }}
                      formValues={formValues}
                      setFormValues={setFormValues}
                      groupId={group.id}
                    />
                  );
                  // The previously unreachable code block (a default return for a switch that no longer exists) was here and has been removed.
                })}
              </Form>
            </Panel>
          ))}
          <div style={{ textAlign: 'right', marginTop: 16 }}>
            <Button type="primary" onClick={handleSave} loading={saving} disabled={loading}>
              保存
            </Button>
          </div>
        </Collapse>
      ) : (
        // 旧的非分组渲染逻辑，使用单一折叠面板
        <Collapse
          defaultActiveKey={['1']}
          style={{ marginBottom: 16 }}
          items={[
            {
              key: '1',
              label: sectionTitle,
              children: (
                <>
                  <Form
                    form={form}
                    layout="horizontal"
                    labelCol={{ span: 6 }}
                    wrapperCol={{ span: 18 }}
                    initialValues={formValues}
                  >
                    {formValues && metadata && Object.keys(metadata.fields || metadata).map(fieldName => renderFormItem(fieldName))}
                  </Form>
                  <div style={{ textAlign: 'right', marginTop: 16 }}>
                    <Button type="primary" onClick={handleSave} loading={saving} disabled={loading}>
                      保存
                    </Button>
                  </div>
                </>
              )
            }
          ]}
        />
      )}
      <BindingModal
        entityId={entityId} // Correctly pass entityId
        modalType={bindingModalState.type}
        initialSelectedKeys={bindingModalState.initialKeys}
        onOk={handleBindingModalOk}
        onCancel={handleBindingModalCancel}
        messageApi={message}
        updateInstanceProperties={updateInstanceProperties}
        handleFieldChange={handleFieldChange} // Pass the root handleFieldChange; BindingModal's props allow it but might not use it if onOk is self-sufficient.
        targetField={bindingModalState.fieldName} // This helps BindingModal know which field it's for.
        // The updateInstanceProperties and handleFieldChange props in BindingModal are for its own potential direct use,
        // but the primary interaction for saving is via onOk -> handleBindingModalOk in the parent.
      />
    </Spin>
  );
};

export default DynamicPropertyForm; 