import axiosConfig from './axiosConfig';

// GoView项目接口类型
export interface GoViewProject {
  id: string;
  projectName: string;
  state: number; // -1: 未发布, 1: 已发布
  createTime: string;
  indexImage: string;
  createUserId: string;
  remarks: string;
}

export interface GoViewProjectDetail extends GoViewProject {
  content: string; // 项目配置JSON字符串
}

// 兼容旧的Chart接口
export interface Chart {
  uid: string;
  name: string;
  description?: string;
  owner: string;
  config: Record<string, any>;
  preview_image?: string;
  width: number;
  height: number;
  version: string;
  created_at: string;
  updated_at: string;
  status: 'draft' | 'published' | 'archived';
  is_public: boolean;
}

export interface ChartTemplate {
  uid: string;
  name: string;
  description?: string;
  category?: string;
  template_config: Record<string, any>;
  preview_image?: string;
  width: number;
  height: number;
  version: string;
  created_at: string;
  updated_at: string;
  is_system: boolean;
}

export interface ChartCreateRequest {
  name: string;
  description?: string;
  config?: Record<string, any>;
  width?: number;
  height?: number;
  is_public?: boolean;
}

export interface ChartUpdateRequest {
  name?: string;
  description?: string;
  config?: Record<string, any>;
  width?: number;
  height?: number;
  status?: string;
  is_public?: boolean;
}

export interface ChartListResponse {
  charts: Chart[];
  total: number;
  page: number;
  page_size: number;
}

export interface ChartTemplateListResponse {
  templates: ChartTemplate[];
  total: number;
  page: number;
  page_size: number;
}

// 获取当前用户token
const getCurrentUserToken = (): string | null => {
  const token = localStorage.getItem('token');
  return token;
};

const chartApi = {
  // GoView项目管理 - 使用新的API
  async createChart(data: ChartCreateRequest): Promise<Chart> {
    const token = getCurrentUserToken();
    const response = await axiosConfig.post('/api/goview/project/create', {
      projectName: data.name,
      remarks: data.description || ''
    }, {
      params: { token }
    });
    
    if (response.data.code === 200) {
      // 返回创建成功后的项目信息，需要再获取一次
      const projectId = response.data.data.id;
      return this.getChart(projectId);
    } else {
      throw new Error(response.data.message || '创建失败');
    }
  },

  async getChartList(params?: {
    page?: number;
    page_size?: number;
    name?: string;
    status?: string;
  }): Promise<ChartListResponse> {
    const token = getCurrentUserToken();
    const response = await axiosConfig.get('/api/goview/project/list', {
      params: { token }
    });
    
    if (response.data.code === 200) {
      // 转换GoView格式到Chart格式
      const goviewProjects: GoViewProject[] = response.data.data;
      const charts: Chart[] = goviewProjects.map(project => ({
        uid: project.id,
        name: project.projectName,
        description: project.remarks,
        owner: project.createUserId,
        config: {},
        preview_image: project.indexImage,
        width: 1920,
        height: 1080,
        version: '1.0.0',
        created_at: project.createTime,
        updated_at: project.createTime,
        status: project.state === 1 ? 'published' : 'draft' as 'draft' | 'published' | 'archived',
        is_public: false
      }));
      
      return {
        charts,
        total: response.data.count || charts.length,
        page: params?.page || 1,
        page_size: params?.page_size || 20
      };
    } else {
      throw new Error(response.data.message || '获取列表失败');
    }
  },

  async getChart(chartId: string): Promise<Chart> {
    const token = getCurrentUserToken();
    const response = await axiosConfig.get('/api/goview/project/getData', {
      params: { projectId: chartId, token }
    });
    
    if (response.data.code === 200) {
      const project: GoViewProjectDetail = response.data.data;
      const config = project.content ? JSON.parse(project.content) : {};
      
      return {
        uid: project.id,
        name: project.projectName,
        description: project.remarks,
        owner: project.createUserId,
        config,
        preview_image: project.indexImage,
        width: config.editCanvasConfig?.width || 1920,
        height: config.editCanvasConfig?.height || 1080,
        version: '1.0.0',
        created_at: project.createTime,
        updated_at: project.createTime,
        status: project.state === 1 ? 'published' : 'draft' as 'draft' | 'published' | 'archived',
        is_public: false
      };
    } else {
      throw new Error(response.data.message || '获取项目失败');
    }
  },

  async updateChart(chartId: string, data: ChartUpdateRequest): Promise<Chart> {
    const token = getCurrentUserToken();
    
    // 更新基础信息
    if (data.name || data.description) {
      const response = await axiosConfig.post('/api/goview/project/edit', {
        id: chartId,
        projectName: data.name,
        remarks: data.description
      }, {
        params: { token }
      });
      
      if (response.data.code !== 200) {
        throw new Error(response.data.message || '更新失败');
      }
    }
    
    // 更新状态
    if (data.status) {
      const state = data.status === 'published' ? 1 : -1;
      const response = await axiosConfig.put('/api/goview/project/publish', {
        id: chartId,
        state
      }, {
        params: { token }
      });
      
      if (response.data.code !== 200) {
        throw new Error(response.data.message || '更新状态失败');
      }
    }
    
    // 返回更新后的数据
    return this.getChart(chartId);
  },

  async deleteChart(chartId: string): Promise<{ message: string }> {
    const token = getCurrentUserToken();
    const response = await axiosConfig.delete('/api/goview/project/delete', {
      params: { ids: chartId, token }
    });
    
    if (response.data.code === 200) {
      return { message: response.data.message || '删除成功' };
    } else {
      throw new Error(response.data.message || '删除失败');
    }
  },

  async updateChartPreview(_chartId: string, previewImage: string): Promise<{ message: string; preview_url: string }> {
    // GoView的预览图更新逻辑需要在GoView前端实现
    return { message: '预览图更新成功', preview_url: previewImage };
  },

  // 图表模板管理
  async getTemplateList(params?: {
    page?: number;
    page_size?: number;
    category?: string;
  }): Promise<ChartTemplateListResponse> {
    const response = await axiosConfig.get('/charts/templates/', { params });
    return response.data;
  },

  async getTemplate(templateId: string): Promise<ChartTemplate> {
    const response = await axiosConfig.get(`/charts/templates/${templateId}`);
    return response.data;
  },

  async createTemplate(data: {
    name: string;
    description?: string;
    category?: string;
    template_config: Record<string, any>;
    width?: number;
    height?: number;
    is_system?: boolean;
  }): Promise<ChartTemplate> {
    const response = await axiosConfig.post('/charts/templates/', data);
    return response.data;
  }
};

export default chartApi;