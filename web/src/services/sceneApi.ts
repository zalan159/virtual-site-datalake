import api from './axiosConfig';

// 获取场景列表
export const getSceneList = () => {
  return api.get('/scenes');
};

// 获取场景详情
export const getSceneDetail = (sceneId: string) => {
  return api.get(`/scenes/${sceneId}`);
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

// 获取实例详情
export const getInstanceDetail = (instanceId: string) => {
  return api.get(`/instances/${instanceId}`);
};

// 更新实例属性
export const updateInstanceProperty = (instanceId: string, fieldName: string, value: any) => {
  return api.put(`/instances/${instanceId}`, { [fieldName]: value });
};

// 删除场景
export const deleteScene = (sceneId: string) => {
  return api.delete(`/scenes/${sceneId}`);
};

// 新建场景
export const createScene = (name: string) => {
  return api.post('/scenes', { name });
}; 