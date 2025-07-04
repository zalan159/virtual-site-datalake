import api from './api';

export interface WMTSLayer {
  id: string;
  _id?: string; // MongoDB ObjectId fallback
  name: string;
  description?: string;
  source_type: 'file' | 'url';
  service_url?: string;
  layer_name?: string;
  format?: string;
  tile_matrix_set?: string;
  minio_path?: string;
  tile_url_template?: string;
  min_zoom?: number;
  max_zoom?: number;
  bounds?: {
    west: number;
    south: number;
    east: number;
    north: number;
  };
  attribution?: string;
  tags: string[];
  is_public: boolean;
  metadata?: any;
  created_at: string;
  updated_at: string;
  original_filename?: string;
  file_size?: number;
}

export interface WMTSCreateData {
  name: string;
  description?: string;
  source_type: 'file' | 'url';
  service_url?: string;
  layer_name?: string;
  format?: string;
  tile_matrix_set?: string;
  tags?: string[];
  is_public?: boolean;
  metadata?: any;
}

export interface WMTSProcessStatus {
  process_id: string;
  status: string;
  message: string;
  wmts_id?: string;
  created_at: string;
  updated_at: string;
}

// WMTS瓦片服务相关API
export const wmtsAPI = {
  // 获取WMTS图层列表
  getWMTSList: (params?: { skip?: number; limit?: number }) => {
    const queryParams = new URLSearchParams();
    if (params?.skip !== undefined) queryParams.append('skip', params.skip.toString());
    if (params?.limit !== undefined) queryParams.append('limit', params.limit.toString());
    
    const queryString = queryParams.toString();
    return api.get(`/wmts${queryString ? `?${queryString}` : ''}`);
  },

  // 根据ID获取WMTS图层详情
  getWMTSById: (wmtsId: string) => {
    return api.get(`/wmts/${wmtsId}`);
  },

  // 创建基于URL的WMTS服务
  createWMTSFromUrl: (data: WMTSCreateData) => {
    return api.post('/wmts/create-url', data);
  },

  // 获取tpkx文件上传URL
  getUploadUrl: (filename: string) => {
    const formData = new FormData();
    formData.append('filename', filename);
    return api.post('/wmts/upload-url', formData);
  },

  // 处理已上传的tpkx文件
  processUploadedFile: (data: {
    object_id: string;
    filename: string;
    name: string;
    description?: string;
    metadata?: any;
    tags?: string[];
    is_public?: boolean;
  }) => {
    const formData = new FormData();
    formData.append('object_id', data.object_id);
    formData.append('filename', data.filename);
    formData.append('name', data.name);
    if (data.description) formData.append('description', data.description);
    if (data.metadata) formData.append('metadata', JSON.stringify(data.metadata));
    if (data.tags) formData.append('tags', JSON.stringify(data.tags));
    if (data.is_public !== undefined) formData.append('is_public', data.is_public.toString());
    
    return api.post('/wmts/process', formData);
  },

  // 获取处理状态
  getProcessStatus: (processId: string) => {
    return api.get(`/wmts/process-status/${processId}`);
  },

  // 更新WMTS图层
  updateWMTS: (wmtsId: string, data: Partial<WMTSCreateData>) => {
    return api.put(`/wmts/${wmtsId}`, data);
  },

  // 删除WMTS图层
  deleteWMTS: (wmtsId: string) => {
    return api.delete(`/wmts/${wmtsId}`);
  },

  // 上传tpkx文件并处理
  uploadAndProcessTpkx: async (
    file: File,
    metadata: {
      name: string;
      description?: string;
      tags?: string[];
      is_public?: boolean;
      metadata?: any;
    }
  ) => {
    try {
      // 1. 获取上传URL
      const uploadUrlResponse = await wmtsAPI.getUploadUrl(file.name);
      const { upload_url, object_id } = uploadUrlResponse.data;

      // 2. 直接上传文件到MinIO
      const uploadResponse = await fetch(upload_url, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': 'application/octet-stream',
        },
      });

      if (!uploadResponse.ok) {
        throw new Error('文件上传失败');
      }

      // 3. 通知后端处理文件
      const processResponse = await wmtsAPI.processUploadedFile({
        object_id,
        filename: file.name,
        ...metadata,
      });

      return processResponse.data;
    } catch (error) {
      console.error('上传和处理tpkx文件失败:', error);
      throw error;
    }
  },

  // 轮询处理状态直到完成
  pollProcessStatus: async (
    processId: string,
    onProgress?: (status: WMTSProcessStatus) => void,
    maxAttempts: number = 100,
    interval: number = 2000
  ): Promise<WMTSProcessStatus> => {
    let attempts = 0;
    
    return new Promise((resolve, reject) => {
      const checkStatus = async () => {
        try {
          attempts++;
          const response = await wmtsAPI.getProcessStatus(processId);
          const status: WMTSProcessStatus = response.data;
          
          if (onProgress) {
            onProgress(status);
          }
          
          if (status.status === 'completed') {
            resolve(status);
          } else if (status.status === 'failed') {
            reject(new Error(status.message || '处理失败'));
          } else if (attempts >= maxAttempts) {
            reject(new Error('处理超时'));
          } else {
            setTimeout(checkStatus, interval);
          }
        } catch (error) {
          reject(error);
        }
      };
      
      checkStatus();
    });
  },
};

export default wmtsAPI;