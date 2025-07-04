import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

export interface GaussianSplat {
  id: string;
  filename: string;
  file_path: string;
  user_id: string;
  username: string;
  description?: string;
  tags: string[];
  is_public: boolean;
  upload_date: string;
  file_size: number;
  preview_image?: string;
  format: string;
  point_count?: number;
  position?: number[];
  rotation?: number[];
  scale?: number[];
  opacity: number;
  show: boolean;
}

export interface GaussianSplatCreate {
  filename: string;
  description?: string;
  tags: string[];
  is_public: boolean;
  format: string;
  position?: number[];
  rotation?: number[];
  scale?: number[];
  opacity: number;
  show: boolean;
}

export interface GaussianSplatUpdate {
  description?: string;
  tags?: string[];
  is_public?: boolean;
  position?: number[];
  rotation?: number[];
  scale?: number[];
  opacity?: number;
  show?: boolean;
}

export const gaussianSplatApi = {
  // 上传高斯泼溅文件
  async uploadGaussianSplat(
    file: File,
    description?: string,
    tags: string[] = [],
    isPublic: boolean = false
  ): Promise<GaussianSplat> {
    const formData = new FormData();
    formData.append('file', file);
    if (description) formData.append('description', description);
    if (tags.length > 0) formData.append('tags', tags.join(','));
    formData.append('is_public', isPublic.toString());

    const response = await axios.post(`${API_BASE_URL}/gaussian-splats/upload`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  // 获取高斯泼溅列表
  async getGaussianSplats(
    skip: number = 0,
    limit: number = 100,
    tags?: string,
    isPublic?: boolean
  ): Promise<GaussianSplat[]> {
    const params = new URLSearchParams();
    params.append('skip', skip.toString());
    params.append('limit', limit.toString());
    if (tags) params.append('tags', tags);
    if (isPublic !== undefined) params.append('is_public', isPublic.toString());

    const response = await axios.get(`${API_BASE_URL}/gaussian-splats?${params}`);
    return response.data;
  },

  // 获取单个高斯泼溅
  async getGaussianSplat(id: string): Promise<GaussianSplat> {
    const response = await axios.get(`${API_BASE_URL}/gaussian-splats/${id}`);
    return response.data;
  },

  // 更新高斯泼溅
  async updateGaussianSplat(id: string, data: GaussianSplatUpdate): Promise<GaussianSplat> {
    const response = await axios.put(`${API_BASE_URL}/gaussian-splats/${id}`, data);
    return response.data;
  },

  // 删除高斯泼溅
  async deleteGaussianSplat(id: string): Promise<void> {
    await axios.delete(`${API_BASE_URL}/gaussian-splats/${id}`);
  },

  // 下载高斯泼溅文件
  async downloadGaussianSplat(id: string): Promise<Blob> {
    const response = await axios.get(`${API_BASE_URL}/gaussian-splats/${id}/download`, {
      responseType: 'blob',
    });
    return response.data;
  },

  // 获取文件URL
  getFileUrl(filePath: string): string {
    return `${API_BASE_URL}/files/download/${encodeURIComponent(filePath)}`;
  },
};