import React, { useState, useEffect } from 'react';
import { Modal, Table } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { subscriptionAPI } from '../../services/iotService';
import { streamApi } from '../../services/streamApi';
import { attachmentApi } from '../../services/attachmentApi';

// Define the props for the BindingModal component
export interface BindingModalProps {
  entityId: string;
  modalType: 'iot' | 'video' | 'file' | null;
  initialSelectedKeys: string[];
  onOk: (selectedKeys: string[]) => void; // Simplified: just passes selected keys
  onCancel: () => void;
  messageApi: any; // Passed from AntdApp.useApp().message
  updateInstanceProperties: (entityId: string, properties: any) => Promise<void>; // Passed as prop
  handleFieldChange: (fieldName: string, value: any) => void; // Passed as prop
  targetField: string | null; // The field name like 'iot_binds' to update
}

const BindingModal: React.FC<BindingModalProps> = ({
  entityId,
  modalType,
  initialSelectedKeys,
  onOk,
  onCancel,
  messageApi,
  updateInstanceProperties, // Available as a prop
  handleFieldChange,      // Available as a prop
  targetField,            // Available as a prop
}) => {
  const [bindList, setBindList] = useState<any[]>([]);
  const [currentSelectedKeys, setCurrentSelectedKeys] = useState<string[]>([]);

  useEffect(() => {
    // Initialize or update currentSelectedKeys when initialSelectedKeys or modalType changes
    setCurrentSelectedKeys(initialSelectedKeys);
  }, [initialSelectedKeys, modalType]);

  useEffect(() => {
    if (!modalType) {
      setBindList([]); // Clear list if modal is not visible
      return;
    }

    const fetchData = async () => {
      try {
        let list: any[] = [];
        if (modalType === 'iot') {
          const res = await subscriptionAPI.list();
          list = res.data || [];
        } else if (modalType === 'video') {
          const data = await streamApi.getList();
          list = data || [];
        } else if (modalType === 'file') {
          const data = await attachmentApi.getList();
          list = data || [];
        }
        setBindList(list);
      } catch (err) {
        if (messageApi && typeof messageApi.error === 'function') {
            messageApi.error('获取绑定数据失败');
        } else {
            console.error('获取绑定数据失败:', err);
        }
        setBindList([]); // Clear list on error
      }
    };

    fetchData();
  }, [modalType, entityId, messageApi]);

  const getColumns = (): ColumnsType<any> => {
    if (modalType === 'iot') {
      return [
        { title: '主题', dataIndex: 'topic' },
        { title: 'ID', dataIndex: '_id' },
      ];
    }
    if (modalType === 'video') {
      return [
        { title: '名称', dataIndex: 'name' },
        { title: '协议', dataIndex: 'protocol' },
      ];
    }
    if (modalType === 'file') {
      return [
        { title: '文件名', dataIndex: 'filename' },
        { title: '扩展名', dataIndex: 'extension' },
      ];
    }
    return [];
  };

  const handleModalOk = () => {
    onOk(currentSelectedKeys);
  };

  const handleModalCancel = () => {
    onCancel();
  };

  return (
    <Modal
      title="选择绑定项"
      open={!!modalType}
      onOk={handleModalOk}
      onCancel={handleModalCancel}
      destroyOnClose
      width={800} 
    >
      <Table
        rowKey="_id" 
        dataSource={bindList}
        columns={getColumns()}
        rowSelection={{
          type: 'checkbox',
          selectedRowKeys: currentSelectedKeys,
          onChange: (keys) => setCurrentSelectedKeys(keys as string[]),
        }}
        pagination={{ pageSize: 10 }} 
        scroll={{ y: 300 }} 
      />
    </Modal>
  );
};

export default BindingModal;
