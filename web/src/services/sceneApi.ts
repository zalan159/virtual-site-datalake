import api from './axiosConfig';

// 获取场景列表
export const getSceneList = () => {
  return api.get('/scenes');
};

// 重命名场景
export const renameScene = (sceneId: string, name: string) => {
  return api.put(`/scenes/${sceneId}`, { name });
};

// 删除场景
export const deleteScene = (sceneId: string) => {
  return api.delete(`/scenes/${sceneId}`);
};

// 新建场景
export const createScene = (name: string) => {
  return api.post('/scenes', { name });
}; 