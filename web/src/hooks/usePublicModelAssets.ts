import { useState, useEffect } from 'react';
import { message } from 'antd';
import * as publicModelsAPI from '../services/publicModels';
import type { PublicModelMetadata } from '../services/publicModels';

interface PublicModelAssetsOptions {
  category?: string;
  subCategory?: string;
  tag?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

export const usePublicModelAssets = (options: PublicModelAssetsOptions = {}) => {
  const [models, setModels] = useState<PublicModelMetadata[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [categories, setCategories] = useState<{[key: string]: string[]}>({});
  const [tags, setTags] = useState<{[key: string]: string[]}>({});

  // 加载分类和标签
  useEffect(() => {
    const loadCategoriesAndTags = async () => {
      try {
        const categoriesResponse = await publicModelsAPI.getCategories();
        setCategories(categoriesResponse);

        const tagsResponse = await publicModelsAPI.getTags();
        const processedTags: {[key: string]: string[]} = {};
        
        Object.entries(tagsResponse).forEach(([key, value]) => {
          if (Array.isArray(value)) {
            processedTags[key] = value;
          } else if (typeof value === 'object' && value !== null && 'tags' in value) {
            // @ts-ignore
            processedTags[key] = value.tags;
          }
        });
        
        setTags(processedTags);
      } catch (error) {
        console.error('加载分类和标签失败:', error);
      }
    };

    loadCategoriesAndTags();
  }, []);

  // 加载模型数据
  useEffect(() => {
    const fetchModels = async () => {
      try {
        setLoading(true);
        const { category, subCategory, tag, search, page = 1, pageSize = 20 } = options;
        
        const response = await publicModelsAPI.getPublicModels(
          page,
          pageSize,
          category,
          subCategory,
          tag,
          search
        );
        
        setModels(response.items);
        setTotal(response.total);
      } catch (error) {
        console.error('获取公共模型列表失败:', error);
        message.error('获取公共模型列表失败');
      } finally {
        setLoading(false);
      }
    };

    fetchModels();
  }, [options.category, options.subCategory, options.tag, options.search, options.page, options.pageSize]);

  return { 
    publicModels: models, 
    loadingPublicModels: loading, 
    publicModelsTotal: total,
    categories,
    tags
  };
}; 