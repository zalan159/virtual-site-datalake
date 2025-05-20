import api from './axiosConfig';

// 获取场景列表
export const getSceneList = () => {
  return api.get('/scenes');
};

// 获取场景详情
export const getSceneDetail = (sceneId: string) => {
  return api.get(`/scenes/${sceneId}`);
};

// 获取场景实例列表（平铺）
export const getSceneInstances = (sceneId: string) => {
  return api.get(`/scenes/${sceneId}/instances`);
};

// 重命名场景
export const renameScene = (sceneId: string, name: string) => {
  return api.put(`/scenes/${sceneId}`, { name });
};

// 更新场景原点
export const updateSceneOrigin = (sceneId: string, origin: any) => {
  return api.put(`/scenes/${sceneId}`, { origin });
};

// 更新场景预览图（新版，接收 base64 字符串）
export const updateScenePreviewImage = (sceneId: string, base64: string) => {
  return api.put(`/scenes/${sceneId}/preview-image`, { preview_image: base64 });
};

// 更新场景任意属性（支持批量，始终忽略预览图）
export const updateSceneProperty = (sceneId: string, data: Record<string, any>) => {
  // 只PUT非预览图字段
  const { preview_image, ...rest } = data;
  return api.put(`/scenes/${sceneId}`, rest);
};

// // 获取实例详情 弃用
// export const getInstanceDetail = (instanceId: string) => {
//   return api.get(`/instances/${instanceId}`);
// };

// // 更新实例属性  弃用
// export const updateInstanceProperty = (instanceId: string, fieldName: string, value: any) => {
//   return api.put(`/instances/${instanceId}`, { [fieldName]: value });
// };

// 删除场景
export const deleteScene = (sceneId: string) => {
  return api.delete(`/scenes/${sceneId}`);
};

// 新建场景
export const createScene = (name: string) => {
  return api.post('/scenes', { name });
};

// 创建场景实例
export const createSceneInstance = (sceneId: string, instanceData: {
  name: string,
  asset_id: string,
  asset_type: string,
  parent_uid?: string,
  transform?: any,
  properties?: any,
  materials?: any[],
  iot_binds?: string[],
  video_binds?: string[],
  file_binds?: string[]
}) => {
  return api.post(`/scenes/${sceneId}/instances`, instanceData).then(response => response.data);
};

// 获取场景实例树结构
export const getSceneInstanceTree = (sceneId: string) => {
  return api.get(`/scenes/${sceneId}/instance-tree`);
};

// 更新实例的父级关系
export const changeInstanceParent = (instanceId: string, newParentId: string) => {
  return api.post(`/instances/${instanceId}/change-parent`, { new_parent_id: newParentId });
};

// 获取实例的详细属性（包含分组和元数据）
export const getInstanceProperties = (instanceId: string) => {
  return api.get(`/instances/${instanceId}/properties`);
};

// 更新实例的多个属性
export const updateInstanceProperties = (instanceId: string, data: Record<string, any>) => {
  return api.put(`/instances/${instanceId}`, data);
};

// 批量更新多个实例的属性
export const updateInstancesProperties = (updates: Array<{id: string, transform: any}>) => {
  return api.post(`/instances/batch-update`, { updates });
};

// 获取实例的绑定关系
export const getInstanceBindings = (instanceId: string) => {
  return api.get(`/instances/${instanceId}/bindings`);
}; 