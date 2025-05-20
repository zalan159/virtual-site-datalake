import api from "./axiosConfig";

// 认证相关API
export const authAPI = {
  // 统一登录方法
  login: (data: {
    username?: string;
    password?: string;
    phone?: string;
    code?: string;
  }) => {
    return api.post("/auth/login", data);
  },

  // 账号密码登录
  loginWithUsername: (username: string, password: string) => {
    return api.post("/auth/login", { username, password });
  },

  // 发送验证码
  sendVerificationCode: (phone: string) => {
    return api.post(`/auth/send-code?phone=${phone}`);
  },

  // 手机号验证码登录
  loginWithPhone: (phone: string, code: string) => {
    return api.post("/auth/login", { phone, code });
  },

  // 检查用户名是否存在
  checkUsername: (username: string) => {
    return api.post("/auth/check-username", { username });
  },

  // 完成注册（通过手机号验证码登录后）
  completeRegistration: (username: string, phone: string, email?: string) => {
    return api.post("/auth/complete-registration", {
      username,
      phone,
      email,
    });
  },

  // 获取当前用户信息
  getCurrentUser: () => {
    // 期望返回 { username, role, ... }
    return api.get("/auth/users/me");
  },

  // 修改密码
  updatePassword: (oldPassword: string, newPassword: string) => {
    return api.put("/auth/users/me/password", {
      old_password: oldPassword,
      new_password: newPassword,
    });
  },

  // 修改用户名
  updateUsername: (newUsername: string) => {
    return api.put("/auth/users/me/username", {
      new_username: newUsername,
    });
  },

  // 设置初始密码
  setInitialPassword: (newPassword: string) => {
    return api.post("/auth/users/me/set-password", {
      new_password: newPassword,
    });
  },

  // 检查用户是否有密码
  checkHasPassword: () => {
    return api.get("/auth/users/me/has-password");
  },

  // 退出登录
  logout: () => {
    return api.post("/auth/logout");
  },
};

// 文件相关API
export const fileAPI = {
  // 获取文件列表
  getFiles: () => {
    return api.get("/files/list");
  },

  // 上传文件
  uploadFile: (file: File, metadata?: any) => {
    const formData = new FormData();
    formData.append("file", file);
    if (metadata) {
      formData.append("metadata", JSON.stringify(metadata));
    }
    return api.post("/files/upload", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
  },

  // 获取文件详情
  getFileDetail: (filePath: string) => {
    return api.get(`/files/${filePath}`);
  },

  // 删除文件
  deleteFile: (fileId: string) => {
    return api.delete(`/files/${fileId}`);
  },

  // 更新文件信息
  updateFile: (fileId: string, data: any) => {
    return api.put(`/files/${fileId}`, data);
  },

  // 分享文件
  shareFile: (fileId: string, sharedWith: string, permissions: string[]) => {
    return api.post(`/files/${fileId}/share`, {
      shared_with: sharedWith,
      permissions,
    });
  },

  // 获取分享文件列表
  getSharedFiles: () => {
    return api.get("/files/shared/list");
  },
};

// 支付相关API
export const paymentAPI = {
  createRecharge: (amount: number) => {
    return api.post("/payments/recharge", { amount });
  },
  confirmRecharge: (orderId: string) => {
    return api.post(`/payments/confirm/${orderId}`);
  },
};

export default api;
