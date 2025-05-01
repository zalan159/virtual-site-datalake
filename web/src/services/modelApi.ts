import api from './api';

// 模型相关API
export const modelAPI = {
  // 获取模型列表
  getModels: () => {
    return api.get('/files/list');
  },
  
  // 上传模型
  uploadModel: (file: File, metadata?: any) => {
    const formData = new FormData();
    formData.append('file', file);
    if (metadata) {
      formData.append('metadata', JSON.stringify(metadata));
    }
    return api.post('/files/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },
  
  // 获取模型详情
  getModelDetail: (filePath: string) => {
    return api.get(`/files/${filePath}`);
  },
  
  // 获取模型下载链接
  getModelDownloadUrl: (fileId: string) => {
    return api.get(`/files/download/${fileId}`);
  },
  
  // 获取转换后模型下载链接
  getConvertedModelDownloadUrl: (fileId: string) => {
    return api.get(`/files/download/converted/${fileId}`);
  },
  
  // 删除模型
  deleteModel: (fileId: string) => {
    return api.delete(`/files/${fileId}`);
  },
  
  // 更新模型信息
  updateModel: (fileId: string, data: any) => {
    return api.put(`/files/${fileId}`, data);
  },
  
  // 分享模型
  shareModel: (fileId: string, sharedWith: string, permissions: string[]) => {
    return api.post(`/files/${fileId}/share`, {
      shared_with: sharedWith,
      permissions,
    });
  },
  
  // 获取分享模型列表
  getSharedModels: () => {
    return api.get('/files/shared/list');
  },
  
  // 转换模型
  convertModel: (fileId: string, outputFormat?: string) => {
    console.log('转换模型请求参数:', { fileId, outputFormat });
    
    // 使用FormData传递参数
    const formData = new FormData();
    if (outputFormat) {
      formData.append('output_format', outputFormat);
    }
    
    return api.post(`/files/${fileId}/convert`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
      .then(response => {
        console.log('转换模型成功响应:', response.data);
        return response;
      })
      .catch(error => {
        console.error('转换模型失败:', error.response?.data || error);
        throw error;
      });
  },
  
  // 获取转换状态
  getConversionStatus: (taskId: string) => {
    return api.get(`/files/convert/status/${taskId}`)
      .then(response => {
        console.log('获取转换状态成功:', response.data);
        return response;
      })
      .catch(error => {
        console.error('获取转换状态失败:', error.response?.data || error);
        throw error;
      });
  },
};

export default modelAPI; 