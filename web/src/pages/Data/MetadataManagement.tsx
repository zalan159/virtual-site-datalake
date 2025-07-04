import { Tree, Space, Typography, Card, Select, message, Spin, Button } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import { useEffect, useState, useCallback } from 'react';
import { metadataApi } from '../../services/metadataApi';
import { modelAPI } from '../../services/modelApi';
import type { DataNode } from 'antd/es/tree';

const { Title } = Typography;

interface FileInfo {
  id: string;
  name: string;
}

const MetadataManagement = () => {
  const [loading, setLoading] = useState(false);
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [selectedFileId, setSelectedFileId] = useState<string>();
  const [treeData, setTreeData] = useState<DataNode[]>([]);
  const [loadedKeys, setLoadedKeys] = useState<string[]>([]);
  const [expandedKeys, setExpandedKeys] = useState<React.Key[]>([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [hasMoreData, setHasMoreData] = useState(false);
  const [totalCount, setTotalCount] = useState(0);

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

  // 获取根节点数据
  const fetchRootNodes = async (fileId: string, page: number = 0, append: boolean = false) => {
    setLoading(true);
    try {
      const response = await metadataApi.getMetadataTreeNodes(fileId, undefined, page, 50);
      const { nodes, hasMore, total } = response.data;
      
      setTotalCount(total);
      setHasMoreData(hasMore);
      setCurrentPage(page);
      
      if (append) {
        setTreeData(prevData => [...prevData, ...nodes]);
      } else {
        setTreeData(nodes);
      }
    } catch (error) {
      message.error('获取元数据失败');
      if (!append) {
        setTreeData([]);
        setTotalCount(0);
        setHasMoreData(false);
      }
    } finally {
      setLoading(false);
    }
  };

  // 处理文件选择
  const handleFileSelect = (value: string) => {
    setSelectedFileId(value);
    setLoadedKeys([]);
    setExpandedKeys([]);
    setCurrentPage(0);
    fetchRootNodes(value, 0, false);
  };

  // 加载更多根节点
  const loadMoreRootNodes = () => {
    if (selectedFileId && hasMoreData && !loading) {
      fetchRootNodes(selectedFileId, currentPage + 1, true);
    }
  };

  // 异步加载节点数据
  const loadNodeData = useCallback(async (node: any): Promise<void> => {
    if (!selectedFileId) return;

    const { key } = node;
    
    // 如果是用户数据节点，使用专门的API
    if (key.includes('-user-data')) {
      try {
        const response = await metadataApi.getUserDataNodes(selectedFileId, key);
        const { nodes } = response.data;
        
        // 更新树数据
        setTreeData(prevData => {
          const updateTreeData = (list: DataNode[], targetKey: string, children: DataNode[]): DataNode[] => {
            return list.map(node => {
              if (node.key === targetKey) {
                return { ...node, children };
              }
              if (node.children) {
                return { ...node, children: updateTreeData(node.children, targetKey, children) };
              }
              return node;
            });
          };
          return updateTreeData(prevData, key, nodes);
        });
        
        setLoadedKeys(prevKeys => [...prevKeys, key]);
      } catch (error) {
        message.error('获取用户数据失败');
      }
      return;
    }
    
    // 普通节点加载
    try {
      const response = await metadataApi.getMetadataTreeNodes(selectedFileId, key);
      const { nodes } = response.data;
      
      // 更新树数据
      setTreeData(prevData => {
        const updateTreeData = (list: DataNode[], targetKey: string, children: DataNode[]): DataNode[] => {
          return list.map(node => {
            if (node.key === targetKey) {
              return { ...node, children };
            }
            if (node.children) {
              return { ...node, children: updateTreeData(node.children, targetKey, children) };
            }
            return node;
          });
        };
        return updateTreeData(prevData, key, nodes);
      });
      
      setLoadedKeys(prevKeys => [...prevKeys, key]);
    } catch (error) {
      message.error('加载节点数据失败');
    }
  }, [selectedFileId]);

  // 处理节点展开
  const handleExpand = (expandedKeysValue: React.Key[]) => {
    setExpandedKeys(expandedKeysValue);
  };

  // 刷新当前数据
  const handleRefresh = () => {
    if (selectedFileId) {
      setLoadedKeys([]);
      setExpandedKeys([]);
      setCurrentPage(0);
      fetchRootNodes(selectedFileId, 0, false);
    }
  };

  return (
    <div>
      <Card>
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Title level={4}>元数据管理 - 懒加载版本</Title>
            <Space>
              <Button 
                icon={<ReloadOutlined />} 
                onClick={handleRefresh}
                disabled={!selectedFileId}
              >
                刷新
              </Button>
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
            </Space>
          </div>
          
          {selectedFileId && (
            <div style={{ marginBottom: 16, color: '#666' }}>
              <Space>
                <span>总计: {totalCount} 项元数据</span>
                <span>已加载: {treeData.length} 项</span>
                {hasMoreData && (
                  <Button 
                    type="link" 
                    size="small" 
                    onClick={loadMoreRootNodes}
                    loading={loading}
                  >
                    加载更多...
                  </Button>
                )}
              </Space>
            </div>
          )}
          
          <Spin spinning={loading}>
            <Tree
              loadData={loadNodeData}
              treeData={treeData}
              loadedKeys={loadedKeys}
              expandedKeys={expandedKeys}
              onExpand={handleExpand}
              showLine
              showIcon={false}
              height={500}
              virtual
              itemHeight={28}
            />
          </Spin>
        </Space>
      </Card>
    </div>
  );
};

export default MetadataManagement; 