import React, { useEffect, useState } from 'react';
import { Card, Spin, Tooltip, Button, Typography } from 'antd';
import { EnvironmentOutlined } from '@ant-design/icons';
import api from '../services/axiosConfig';

const { Text } = Typography;

// mountain风格图标
const MountainIcon: React.FC<{ size?: number }> = ({ size = 40 }) => (
  <svg width={size} height={size} viewBox="0 0 40 40" fill="none">
    <rect x="2" y="32" width="36" height="6" rx="2" fill="#b7eb8f" />
    <polygon points="6,32 20,8 34,32" fill="#91d5ff" stroke="#1890ff" strokeWidth="2" />
    <polygon points="20,8 25,18 20,16 15,22" fill="#fffbe6" stroke="#faad14" strokeWidth="1" />
    <circle cx="32" cy="10" r="3" fill="#ffe58f" />
  </svg>
);

interface ThreeDTilesItem {
  _id: string;
  name: string;
  description: string;
  tileset_url: string;
  minio_path: string;
  created_at: string;
  updated_at: string;
  is_public: boolean;
  tags: string[];
  original_filename: string;
  file_size: number;
  metadata: any;
  longitude: number | null;
  latitude: number | null;
  height: number | null;
}

interface ThreeDTilesTabProps {
  onThreeDTilesDragStart?: (e: React.DragEvent, item: ThreeDTilesItem) => void;
}

// const formatFileSize = (size: number) => {
//   if (!size) return '未知';
//   if (size < 1024) {
//     return size + ' B';
//   } else if (size < 1024 * 1024) {
//     return (size / 1024).toFixed(2) + ' KB';
//   } else if (size < 1024 * 1024 * 1024) {
//     return (size / (1024 * 1024)).toFixed(2) + ' MB';
//   } else {
//     return (size / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
//   }
// };

// const formatTime = (timeStr: string) => {
//   if (!timeStr) return '';
//   const date = new Date(timeStr);
//   return date.toLocaleString('zh-CN');
// };

// const formatCoordinate = (value: number | null) => {
//   if (value === null || value === undefined) return '未知';
//   return value.toFixed(6);
// };

export const ThreeDTilesTab: React.FC<ThreeDTilesTabProps> = ({ onThreeDTilesDragStart }) => {
  const [data, setData] = useState<ThreeDTilesItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    // 挂载到window和document，便于拖拽时全局查找
    if (typeof window !== 'undefined') {
      (window as any).threeDTilesList = data;
    }
    if (typeof document !== 'undefined') {
      (document as any).threeDTilesListCache = data;
    }
  }, [data]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const response = await api.get('/3dtiles');
      setData(response.data);
    } catch (error) {
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  const handleViewMap = (record: ThreeDTilesItem) => {
    const params = new URLSearchParams();
    params.set('url', record.tileset_url);
    params.set('name', record.name);
    if (record.longitude !== null && record.latitude !== null) {
      params.set('longitude', record.longitude.toString());
      params.set('latitude', record.latitude.toString());
      params.set('height', (record.height || 0).toString());
    }
    window.open(`/tileset-viewer?${params.toString()}`, '_blank');
  };

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, padding: '16px 0', minHeight: 200 }}>
      {loading ? (
        <Spin style={{ margin: '40px auto' }} />
      ) : data.length === 0 ? (
        <div style={{ color: '#888', width: '100%', textAlign: 'center', lineHeight: '80px' }}>暂无3DTiles数据</div>
      ) : (
        data.map(item => (
          <Card
            key={item._id}
            style={{ width: 80, padding: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative' }}
            bodyStyle={{ padding: 8, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}
            draggable
            onDragStart={e => onThreeDTilesDragStart && onThreeDTilesDragStart(e, item)}
          >
            <div style={{ position: 'absolute', top: 4, right: 4 }}>
              <Tooltip title="查看3D模型">
                <Button
                  type="text"
                  icon={<EnvironmentOutlined />}
                  size="small"
                  onClick={() => handleViewMap(item)}
                />
              </Tooltip>
            </div>
            <MountainIcon size={40} />
            <Text
              ellipsis={{ tooltip: item.name }}
              style={{
                fontSize: 12,
                margin: '4px 0',
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
              }}
            >
              {item.name}
            </Text>
            <Text style={{ fontSize: 10, color: '#888', marginTop: 2 }} ellipsis={{ tooltip: item.original_filename }}>
              {item.original_filename}
            </Text>
          </Card>
        ))
      )}
    </div>
  );
}; 