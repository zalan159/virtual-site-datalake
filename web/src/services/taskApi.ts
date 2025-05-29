import api from './axiosConfig';

// 任务状态枚举
export enum TaskStatus {
  PENDING = "pending",  // 等待处理
  PROCESSING = "processing",  // 处理中
  COMPLETED = "completed",  // 已完成
  FAILED = "failed"  // 失败
}

// 转换步骤枚举
export enum ConversionStep {
  INITIALIZED = "initialized",  // 初始化
  DOWNLOADING = "downloading",  // 下载文件
  CONVERTING = "converting",  // 转换文件
  UPLOADING = "uploading",  // 上传转换后的文件
  COMPLETED = "completed"  // 完成
}

// 任务类型 - 使用const而不是enum以便更灵活处理字符串值
export const TaskType = {
  FILE_CONVERSION: "file_conversion",  // 文件转换
  THREEDTILES_PROCESSING: "threedtiles_processing"  // 3DTiles处理
} as const;

// TaskType类型
export type TaskType = typeof TaskType[keyof typeof TaskType];

// 处理状态接口
export interface ProcessStatus {
  status: string;
  message: string;
  tile_id?: string;
}

// 任务接口
export interface Task {
  task_id: string;
  task_type: string | TaskType;  // 支持直接字符串或TaskType枚举值
  user_id: string;
  file_id: string;
  input_file_path: string;
  output_format: string;
  status: TaskStatus;
  progress: number;
  current_step: ConversionStep;
  error_message?: string;
  result?: any;
  created_at: string;
  updated_at: string;
  resource_name?: string;  // 关联资源名称
  process_status?: ProcessStatus;  // 3DTiles处理状态
  resource_info?: {        // 关联资源详情
    name: string;
    size: number;
    type: string;
  };
}

// 错误处理函数
const handleError = (error: any) => {
  console.error('API错误:', error);
  
  // 提取错误信息
  let errorMessage = '操作失败';
  if (error.response) {
    // 服务器响应了，但状态码不在2xx范围内
    errorMessage = error.response.data?.detail || error.response.statusText || '服务器错误';
  } else if (error.request) {
    // 请求已发出，但没有收到响应
    errorMessage = '无法连接到服务器，请检查网络连接';
  } else {
    // 请求设置时出错
    errorMessage = error.message || '请求错误';
  }
  
  throw new Error(errorMessage);
};

// 任务相关API
export const taskAPI = {
  // 获取任务列表
  getTasks: async (status?: TaskStatus, taskType?: TaskType) => {
    try {
      let url = '/tasks/list';
      const params = new URLSearchParams();
      
      if (status) {
        params.append('status', status);
      }
      
      if (taskType) {
        params.append('task_type', taskType);
      }
      
      if (params.toString()) {
        url += `?${params.toString()}`;
      }
      
      const response = await api.get(url);
      return response.data;
    } catch (error) {
      return handleError(error);
    }
  },
  
  // 获取任务详情
  getTask: async (taskId: string) => {
    try {
      const response = await api.get(`/tasks/${taskId}`);
      return response.data;
    } catch (error) {
      return handleError(error);
    }
  },
  
  // 获取任务状态
  getTaskStatus: async (taskId: string) => {
    try {
      const response = await api.get(`/tasks/status/${taskId}`);
      return response.data;
    } catch (error) {
      return handleError(error);
    }
  },
  
  // 创建任务
  createTask: async (taskData: Partial<Task>) => {
    try {
      const response = await api.post('/tasks/create', taskData);
      return response.data;
    } catch (error) {
      return handleError(error);
    }
  },
  
  // 删除任务
  deleteTask: async (taskId: string) => {
    try {
      const response = await api.delete(`/tasks/${taskId}`);
      return response.data;
    } catch (error) {
      return handleError(error);
    }
  }
};

export default taskAPI; 