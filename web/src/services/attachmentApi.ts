import api from './axiosConfig';

const API_BASE_URL = '/attachments';

export interface Attachment {
  _id: string;
  filename: string;
  size: number;
  extension: string;
  upload_time: string;
  related_instance: string | null;
}

export const attachmentApi = {
  // 获取附件列表
  getList: async (): Promise<Attachment[]> => {
    const response = await api.get(`${API_BASE_URL}/list`);
    return response.data;
  },

  // 上传附件
  upload: async (files: File[], relatedModel?: string, onProgress?: (percent: number) => void): Promise<Attachment[]> => {
    const formData = new FormData();
    files.forEach(file => {
      formData.append('files', file);
    });
    if (relatedModel) {
      formData.append('related_instance', relatedModel);
    }
    const response = await api.post(`${API_BASE_URL}/upload`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (progressEvent) => {
        if (progressEvent.total && onProgress) {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onProgress(percentCompleted);
        }
      },
    });
    return response.data;
  },

  // 下载附件
  download: async (id: string, onProgress?: (percent: number) => void): Promise<Blob> => {
    const response = await api.get(`${API_BASE_URL}/download/${id}`, {
      responseType: 'blob',
      onDownloadProgress: (progressEvent) => {
        if (progressEvent.total && onProgress) {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onProgress(percentCompleted);
        }
      },
    });
    return response.data;
  },

  // 获取下载URL（用于大文件下载）
  getDownloadUrl: async (id: string): Promise<string> => {
    // 获取当前认证令牌
    const token = localStorage.getItem('token') || '';
    // 获取预签名URL
    const response = await api.get(`${API_BASE_URL}/download/${id}?token=${token}`);
    return response.data.download_url;
  },

  // 删除附件
  delete: async (id: string): Promise<void> => {
    await api.delete(`${API_BASE_URL}/${id}`);
  },

  // 更新关联模型
  updateRelatedModel: async (id: string, relatedModel: string): Promise<void> => {
    await api.put(`${API_BASE_URL}/${id}/related-model`, { related_instance: relatedModel });
  },
}; 