// hooks/useModelAssets.ts
import { useState, useEffect } from 'react';
import { message } from 'antd';
import modelAPI from '../services/modelApi'; // 假设路径正确

export interface ModelAsset {
  _id: string;
  id?: string; // 兼容旧数据
  fileId?: string; // 兼容旧数据
  filename: string;
  name?: string; // 兼容旧数据
  preview_image?: string; // 添加预览图字段
  conversion?: {
    output_format?: string;
  };
  // 根据您的API响应添加其他必要字段
}

export const useModelAssets = () => {
  const [models, setModels] = useState<ModelAsset[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    modelAPI.getModels()
      .then(res => {
        const filtered = (Array.isArray(res.data) ? res.data : []).filter((item: any) => {
          return item.conversion && item.conversion.output_format && item.conversion.output_format.toUpperCase() === 'GLB';
        });
        setModels(filtered.map(m => ({ ...m, id: m.id || m._id || m.fileId, name: m.name || m.filename }))); // 统一id和name
      })
      .catch(() => {
        message.error('获取模型列表失败');
      })
      .finally(() => setLoading(false));
  }, []);

  return { models, loadingModels: loading };
};