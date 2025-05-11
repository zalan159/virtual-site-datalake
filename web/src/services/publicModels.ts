import api from './axiosConfig';
import { AxiosResponse } from 'axios';

// 模型数据接口定义
export interface PublicModelMetadata {
  _id: string;
  filename: string;
  file_path: string;
  category: string;
  sub_category?: string;
  description?: string;
  upload_date: Date;
  file_size: number;
  created_by: string;
  created_by_username: string;
  download_count: number;
  is_featured: boolean;
  tags: string[];
  download_url?: string;
  preview_image?: string;
}

// 分页响应接口
export interface PaginatedResponse {
  items: PublicModelMetadata[];
  total: number;
  page: number;
  size: number;
  pages: number;
  category?: string;
  sub_category?: string;
  query?: string;
}

// 分类标签响应接口
export interface CategoriesResponse {
  [category: string]: string[];
}

// 标签响应接口
export interface TagsResponse {
  [category: string]: string[] | { tags: string[] };
}

// 获取公共模型列表
export const getPublicModels = async (
  page: number = 1,
  limit: number = 10,
  category?: string,
  sub_category?: string,
  tag?: string,
  search?: string,
  featured?: boolean
): Promise<PaginatedResponse> => {
  const params: any = { page, limit };
  
  if (category) params.category = category;
  if (sub_category) params.sub_category = sub_category;
  if (tag) params.tag = tag;
  if (search) params.search = search;
  if (featured !== undefined) params.featured = featured;
  
  const response: AxiosResponse<PaginatedResponse> = await api.get('/public-models/list', { params });
  return response.data;
};

// 获取所有分类和子分类
export const getCategories = async (): Promise<CategoriesResponse> => {
  const response: AxiosResponse<CategoriesResponse> = await api.get('/public-models/categories');
  return response.data;
};

// 获取标签
export const getTags = async (category?: string): Promise<TagsResponse> => {
  const params = category ? { category } : {};
  const response: AxiosResponse<TagsResponse> = await api.get('/public-models/tags', { params });
  return response.data;
};

// 搜索公共模型
export const searchPublicModels = async (
  query: string,
  category?: string,
  tags?: string[],
  page: number = 1,
  limit: number = 10
): Promise<PaginatedResponse> => {
  const params: any = { query, page, limit };
  
  if (category) params.category = category;
  if (tags) params.tags = tags;
  
  const response: AxiosResponse<PaginatedResponse> = await api.get('/public-models/search', { params });
  return response.data;
};

// 按分类获取公共模型
export const getModelsByCategory = async (
  category: string,
  sub_category?: string,
  page: number = 1,
  limit: number = 10,
  featured?: boolean
): Promise<PaginatedResponse> => {
  const params: any = { page, limit };
  
  if (sub_category) params.sub_category = sub_category;
  if (featured !== undefined) params.featured = featured;
  
  const response: AxiosResponse<PaginatedResponse> = await api.get(`/public-models/by-category/${category}`, { params });
  return response.data;
};

// 获取公共模型详情
export const getPublicModelDetail = async (fileId: string): Promise<PublicModelMetadata> => {
  const response: AxiosResponse<PublicModelMetadata> = await api.get(`/public-models/${fileId}`);
  return response.data;
};

// 上传公共模型（仅管理员）
export const uploadPublicModel = async (file: File, metadata: any): Promise<PublicModelMetadata> => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('metadata', JSON.stringify(metadata));
  
  const response: AxiosResponse<PublicModelMetadata> = await api.post('/public-models/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
  
  return response.data;
};

// 删除公共模型（仅管理员）
export const deletePublicModel = async (fileId: string): Promise<{ message: string }> => {
  const response: AxiosResponse<{ message: string }> = await api.delete(`/public-models/${fileId}`);
  return response.data;
};

// 更新公共模型信息（仅管理员）
export const updatePublicModel = async (fileId: string, updateData: Partial<PublicModelMetadata>): Promise<PublicModelMetadata> => {
  const response: AxiosResponse<PublicModelMetadata> = await api.put(`/public-models/${fileId}`, updateData);
  return response.data;
};

// 记录下载并获取下载链接
export const downloadPublicModel = async (fileId: string): Promise<{ file_id: string, filename: string, download_url: string }> => {
  const response: AxiosResponse<{ file_id: string, filename: string, download_url: string }> = await api.post(`/public-models/${fileId}/download`);
  return response.data;
};

// 更新公共模型预览图（仅管理员）
export const updatePublicModelPreview = async (fileId: string, previewImageBase64: string): Promise<{ file_id: string, preview_image: string }> => {
  const response: AxiosResponse<{ file_id: string, preview_image: string }> = await api.put(`/public-models/${fileId}/preview-image`, {
    preview_image: previewImageBase64
  });
  
  return response.data;
};

// 获取推荐公共模型
export const getFeaturedModels = async (limit: number = 10): Promise<PublicModelMetadata[]> => {
  const response: AxiosResponse<PublicModelMetadata[]> = await api.get('/public-models/featured/list', { params: { limit } });
  return response.data;
};

// 获取热门公共模型（按下载量排序）
export const getPopularModels = async (limit: number = 10, category?: string): Promise<PublicModelMetadata[]> => {
  const params: any = { limit };
  if (category) params.category = category;
  
  const response: AxiosResponse<PublicModelMetadata[]> = await api.get('/public-models/popular/list', { params });
  return response.data;
};

// 获取最新公共模型
export const getLatestModels = async (limit: number = 10, category?: string): Promise<PublicModelMetadata[]> => {
  const params: any = { limit };
  if (category) params.category = category;
  
  const response: AxiosResponse<PublicModelMetadata[]> = await api.get('/public-models/latest/list', { params });
  return response.data;
};