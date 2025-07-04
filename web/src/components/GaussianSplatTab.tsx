import React, { useState, useEffect } from 'react';
import { Spin, Empty, Card, Typography, Space, Input, Select, Button, message } from 'antd';
import { SearchOutlined, EyeOutlined, CloudOutlined } from '@ant-design/icons';
import { gaussianSplatApi, GaussianSplat } from '../services/gaussianSplatApi';
import { formatFileSize } from '../utils/formatters';

const { Text } = Typography;
const { Option } = Select;

// 高斯泼溅卡片组件
interface GaussianSplatCardProps {
  splat: GaussianSplat;
  onDragStart: (e: React.DragEvent, splat: GaussianSplat) => void;
}

const GaussianSplatCard: React.FC<GaussianSplatCardProps> = ({ splat, onDragStart }) => {
  const handlePreview = () => {
    const url = `/gaussian-splat-preview/${splat.id}`;
    window.open(url, '_blank');
  };

  return (
    <Card
      style={{ 
        width: 80, 
        padding: 0, 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center', 
        justifyContent: 'center',
        cursor: 'grab',
        position: 'relative'
      }}
      styles={{
        body: { padding: 8, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }
      }}
      draggable
      onDragStart={e => onDragStart(e, splat)}
    >
      {/* 预览按钮 */}
      <Button
        type="text"
        size="small"
        icon={<EyeOutlined />}
        onClick={handlePreview}
        style={{
          position: 'absolute',
          top: 2,
          right: 2,
          zIndex: 1,
          width: 20,
          height: 20,
          padding: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 10,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          color: 'white',
          borderRadius: '50%',
        }}
      />
      
      {/* 高斯泼溅图标 */}
      <div style={{ 
        width: 60, 
        height: 60, 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        backgroundColor: '#f0f8ff',
        borderRadius: 4,
        border: '2px solid #1890ff',
        marginBottom: 4
      }}>
        <CloudOutlined style={{ fontSize: 24, color: '#1890ff' }} />
      </div>
      
      {/* 文件名 */}
      <Text 
        ellipsis={{ tooltip: splat.filename }}
        style={{ 
          fontSize: 11, 
          margin: 0,
          textAlign: 'center', 
          width: '100%', 
          padding: '0 4px',
          display: '-webkit-box',
          WebkitBoxOrient: 'vertical',
          WebkitLineClamp: 2,
          overflow: 'hidden',
          wordWrap: 'break-word',
          wordBreak: 'break-all',
          whiteSpace: 'normal',
          lineHeight: 1.2
        }}
      >
        {splat.filename}
      </Text>
      
      {/* 文件信息 */}
      <Text 
        type="secondary" 
        style={{ 
          fontSize: 10, 
          margin: 0,
          textAlign: 'center'
        }}
      >
        {splat.format.toUpperCase()} · {formatFileSize(splat.file_size)}
      </Text>
    </Card>
  );
};

// 高斯泼溅标签页组件
interface GaussianSplatTabProps {
  onGaussianSplatDragStart?: (e: React.DragEvent, splat: GaussianSplat) => void;
}

export const GaussianSplatTab: React.FC<GaussianSplatTabProps> = ({ onGaussianSplatDragStart }) => {
  const [gaussianSplats, setGaussianSplats] = useState<GaussianSplat[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [filterPublic, setFilterPublic] = useState<boolean | undefined>();
  const [filterTags, setFilterTags] = useState<string[]>([]);

  // 获取高斯泼溅列表
  const fetchGaussianSplats = async () => {
    setLoading(true);
    try {
      const data = await gaussianSplatApi.getGaussianSplats(
        0,
        50, // 限制数量，避免加载过多
        filterTags.length > 0 ? filterTags.join(',') : undefined,
        filterPublic
      );
      setGaussianSplats(data);
    } catch (error) {
      message.error('获取高斯泼溅列表失败');
      console.error('Error fetching gaussian splats:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGaussianSplats();
  }, [filterTags, filterPublic]);

  // 处理搜索
  const handleSearch = () => {
    // 这里可以添加搜索逻辑
    fetchGaussianSplats();
  };

  // 处理拖拽开始
  const handleDragStart = (e: React.DragEvent, splat: GaussianSplat) => {
    e.dataTransfer.setData('gaussianSplatId', splat.id);
    e.dataTransfer.setData('gaussianSplatData', JSON.stringify(splat));
    if (onGaussianSplatDragStart) {
      onGaussianSplatDragStart(e, splat);
    }
  };

  // 过滤高斯泼溅
  const filteredSplats = gaussianSplats.filter(splat =>
    splat.filename.toLowerCase().includes(searchText.toLowerCase()) ||
    splat.description?.toLowerCase().includes(searchText.toLowerCase())
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* 搜索和筛选区域 */}
      <Space style={{ marginBottom: 16, flexWrap: 'wrap' }} size={[8, 16]}>
        <Input
          placeholder="搜索高斯泼溅"
          value={searchText}
          onChange={e => setSearchText(e.target.value)}
          onPressEnter={handleSearch}
          suffix={<SearchOutlined onClick={handleSearch} style={{ cursor: 'pointer' }} />}
          style={{ width: 200 }}
        />
        
        <Select 
          placeholder="公开状态" 
          style={{ width: 120 }}
          allowClear
          value={filterPublic}
          onChange={setFilterPublic}
        >
          <Option value={true}>公开</Option>
          <Option value={false}>私有</Option>
        </Select>
        
        <Select
          mode="tags"
          placeholder="标签筛选"
          value={filterTags}
          onChange={setFilterTags}
          style={{ width: 150 }}
        />
      </Space>
      
      {/* 高斯泼溅列表区域 */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <Spin spinning={loading}>
          {filteredSplats.length === 0 ? (
            <Empty 
              description="暂无高斯泼溅文件" 
              style={{ margin: '40px 0' }}
              image={<CloudOutlined style={{ fontSize: 48, color: '#d9d9d9' }} />}
            />
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, padding: '16px 0' }}>
              {filteredSplats.map(splat => (
                <GaussianSplatCard
                  key={splat.id}
                  splat={splat}
                  onDragStart={handleDragStart}
                />
              ))}
            </div>
          )}
        </Spin>
      </div>
    </div>
  );
};