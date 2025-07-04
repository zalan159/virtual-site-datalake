import { AxiosResponse } from 'axios';
import api from './axiosConfig';

export interface ProductOccurrenceMetadata {
  file_id: string;
  pointer: string;
  product_id: string;
  name: string;
  layer: string;
  style: string;
  behaviour: string;
  modeller_type: string;
  product_load_status: string;
  product_flag: string;
  unit: string;
  density_volume_unit: string;
  density_mass_unit: string;
  unit_from_cad: string;
  rgb: string;
  user_data: Record<string, Array<Record<string, any>>>;
}

export interface MetadataTreeResponse {
  nodes: Array<{
    key: string;
    title: string;
    isLeaf: boolean;
    hasChildren?: boolean;
    children?: any[];
    userData?: Record<string, any>;
  }>;
  total: number;
  hasMore: boolean;
  page?: number;
  pageSize?: number;
  parentKey?: string;
}

export const metadataApi = {
  // 获取指定文件的元数据
  getMetadataByFileId: (fileId: string): Promise<AxiosResponse<ProductOccurrenceMetadata[]>> => {
    return api.get(`/metadata/${fileId}`);
  },

  // 分层获取元数据树节点，支持懒加载
  getMetadataTreeNodes: (
    fileId: string, 
    parentKey?: string,
    page: number = 0,
    pageSize: number = 100
  ): Promise<AxiosResponse<MetadataTreeResponse>> => {
    const params = new URLSearchParams();
    if (parentKey) {
      params.append('parent_key', parentKey);
    }
    params.append('page', page.toString());
    params.append('page_size', pageSize.toString());
    return api.get(`/metadata/${fileId}/tree?${params.toString()}`);
  },

  // 获取用户数据子节点
  getUserDataNodes: (fileId: string, parentKey: string): Promise<AxiosResponse<MetadataTreeResponse>> => {
    return api.get(`/metadata/${fileId}/user-data/${encodeURIComponent(parentKey)}`);
  },

  // 搜索元数据
  searchMetadata: (keyword: string, fields?: string[]): Promise<AxiosResponse<ProductOccurrenceMetadata[]>> => {
    const params = new URLSearchParams();
    params.append('keyword', keyword);
    if (fields) {
      fields.forEach(field => params.append('fields', field));
    }
    return api.get(`/metadata/search/?${params.toString()}`);
  }
}; 