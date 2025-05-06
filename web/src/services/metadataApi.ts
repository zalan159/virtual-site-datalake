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

export const metadataApi = {
  // 获取指定文件的元数据
  getMetadataByFileId: (fileId: string): Promise<AxiosResponse<ProductOccurrenceMetadata[]>> => {
    return api.get(`/metadata/${fileId}`);
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