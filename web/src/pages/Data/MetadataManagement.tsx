import { Tree, Space, Typography, Card, Select, message, Spin } from 'antd';
import { useEffect, useState } from 'react';
import { metadataApi, ProductOccurrenceMetadata } from '../../services/metadataApi';
import { modelAPI } from '../../services/modelApi';
import type { DataNode } from 'antd/es/tree';

const { Title } = Typography;

interface FileInfo {
  id: string;
  name: string;
}

interface UserDataValue {
  Title: string;
  Type: string;
  Value: string;
}

const MetadataManagement = () => {
  const [loading, setLoading] = useState(false);
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [selectedFileId, setSelectedFileId] = useState<string>();
  const [metadata, setMetadata] = useState<ProductOccurrenceMetadata[]>([]);
  const [treeData, setTreeData] = useState<DataNode[]>([]);
  const [loadedKeys, setLoadedKeys] = useState<string[]>([]);

  // 获取文件列表
  useEffect(() => {
    const fetchFiles = async () => {
      try {
        const response = await modelAPI.getModels();
        setFiles(response.data.map((file: any) => ({
          id: file._id,
          name: file.filename
        })));
      } catch (error) {
        message.error('获取文件列表失败');
      }
    };
    fetchFiles();
  }, []);

  // 获取选中文件的元数据
  const fetchMetadata = async (fileId: string) => {
    setLoading(true);
    try {
      const response = await metadataApi.getMetadataByFileId(fileId);
      setMetadata(response.data);
      // 初始化顶层节点
      const initialTreeData = response.data.map((item, index) => ({
        key: `metadata-${index}`,
        title: item.name || `未命名元数据 #${index + 1}`,
        children: [],
        isLeaf: false,
      }));
      setTreeData(initialTreeData);
    } catch (error) {
      message.error('获取元数据失败');
      setMetadata([]);
      setTreeData([]);
    } finally {
      setLoading(false);
    }
  };

  // 处理文件选择
  const handleFileSelect = (value: string) => {
    setSelectedFileId(value);
    setLoadedKeys([]); // 重置已加载的节点
    fetchMetadata(value);
  };

  // 异步加载节点数据
  const loadNodeData = async (node: any): Promise<void> => {
    return new Promise((resolve) => {
      const { key } = node;
      const index = parseInt(key.split('-')[1]);
      const item = metadata[index];
      
      if (!item) {
        resolve();
        return;
      }

      const children: DataNode[] = [];

      // 添加基本属性
      const basicProps = [
        { key: 'pointer', title: '指针', value: item.pointer },
        { key: 'product_id', title: '产品ID', value: item.product_id },
        { key: 'name', title: '名称', value: item.name },
        { key: 'layer', title: '图层', value: item.layer },
        { key: 'style', title: '样式', value: item.style },
        { key: 'behaviour', title: '行为', value: item.behaviour },
        { key: 'modeller_type', title: '建模类型', value: item.modeller_type },
        { key: 'product_load_status', title: '产品加载状态', value: item.product_load_status },
        { key: 'product_flag', title: '产品标记', value: item.product_flag },
        { key: 'unit', title: '单位', value: item.unit },
        { key: 'density_volume_unit', title: '体积密度单位', value: item.density_volume_unit },
        { key: 'density_mass_unit', title: '质量密度单位', value: item.density_mass_unit },
        { key: 'unit_from_cad', title: 'CAD单位', value: item.unit_from_cad },
        { key: 'rgb', title: 'RGB颜色', value: item.rgb }
      ];

      // 添加基本属性到子节点
      basicProps.forEach(prop => {
        if (prop.value) {
          children.push({
            key: `${key}-${prop.key}`,
            title: `${prop.title}: ${prop.value}`,
            isLeaf: true
          });
        }
      });

      // 添加用户数据
      if (Object.keys(item.user_data).length > 0) {
        const userDataNode: DataNode = {
          key: `${key}-user-data`,
          title: '用户数据',
          children: Object.entries(item.user_data).map(([title, values]) => ({
            key: `${key}-user-${title}`,
            title: title,
            children: (values as UserDataValue[]).map((value, vIndex) => ({
              key: `${key}-user-${title}-${vIndex}`,
              title: `${value.Title}: ${value.Value} (${value.Type})`,
              isLeaf: true
            }))
          }))
        };
        children.push(userDataNode);
      }

      // 更新节点数据
      setTreeData(prevData => {
        const updateTreeData = (list: DataNode[], key: string, children: DataNode[]): DataNode[] => {
          return list.map(node => {
            if (node.key === key) {
              return { ...node, children };
            }
            if (node.children) {
              return { ...node, children: updateTreeData(node.children, key, children) };
            }
            return node;
          });
        };
        return updateTreeData(prevData, key, children);
      });

      setLoadedKeys(prevKeys => [...prevKeys, key]);
      resolve();
    });
  };

  return (
    <div>
      <Card>
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Title level={4}>元数据管理</Title>
            <Select
              style={{ width: 300 }}
              placeholder="请选择文件"
              onChange={handleFileSelect}
              value={selectedFileId}
              options={files.map(file => ({
                value: file.id,
                label: file.name
              }))}
            />
          </div>
          
          <Spin spinning={loading}>
            <Tree
              loadData={loadNodeData}
              treeData={treeData}
              loadedKeys={loadedKeys}
              showLine
              showIcon={false}
              height={400}
              itemHeight={28}
            />
          </Spin>
        </Space>
      </Card>
    </div>
  );
};

export default MetadataManagement; 