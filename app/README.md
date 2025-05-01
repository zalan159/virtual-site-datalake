# GLTF文件存储系统 API 文档

## 基础信息
- 基础URL: `http://localhost:8000`
- 所有需要认证的接口都需要在请求头中携带 `Authorization: Bearer {token}`

## 认证相关接口

### 用户注册
- **接口**: `/auth/register`
- **方法**: POST
- **描述**: 注册新用户
- **请求体**:
  ```json
  {
    "username": "string",
    "email": "string",
    "password": "string"
  }
  ```
- **响应**: 返回用户信息（不包含密码）

### 用户登录
- **接口**: `/auth/token`
- **方法**: POST
- **描述**: 获取访问令牌
- **请求体**:
  ```
  username=string&password=string
  ```
- **响应**:
  ```json
  {
    "access_token": "string",
    "token_type": "bearer"
  }
  ```

### 获取当前用户信息
- **接口**: `/auth/users/me`
- **方法**: GET
- **描述**: 获取当前登录用户的信息
- **需要认证**: 是
- **响应**: 返回当前用户信息

## 文件操作接口

### 上传GLTF文件
- **接口**: `/files/upload`
- **方法**: POST
- **描述**: 上传GLTF文件
- **需要认证**: 是
- **请求参数**:
  - `file`: GLTF文件（multipart/form-data）
  - `metadata`: 文件元数据（可选，JSON字符串）
- **响应**: 返回文件元数据信息

### 获取文件列表
- **接口**: `/files/list`
- **方法**: GET
- **描述**: 获取当前用户的所有文件列表
- **需要认证**: 是
- **响应**: 返回文件元数据列表

### 获取文件详情
- **接口**: `/files/{file_path}`
- **方法**: GET
- **描述**: 获取特定文件的详情和下载链接
- **需要认证**: 是
- **路径参数**:
  - `file_path`: 文件路径
- **响应**: 返回文件详情和下载链接

### 删除文件
- **接口**: `/files/{file_id}`
- **方法**: DELETE
- **描述**: 删除指定文件
- **需要认证**: 是
- **路径参数**:
  - `file_id`: 文件ID
- **响应**: 返回删除成功消息

### 更新文件信息
- **接口**: `/files/{file_id}`
- **方法**: PUT
- **描述**: 更新文件信息
- **需要认证**: 是
- **路径参数**:
  - `file_id`: 文件ID
- **请求参数**:
  - `description`: 文件描述（可选）
  - `tags`: 文件标签列表（可选）
  - `is_public`: 是否公开（可选）
- **响应**: 返回更新后的文件信息

### 分享文件
- **接口**: `/files/{file_id}/share`
- **方法**: POST
- **描述**: 分享文件给其他用户
- **需要认证**: 是
- **路径参数**:
  - `file_id`: 文件ID
- **请求体**:
  ```json
  {
    "shared_with": "string",  // 被分享用户的ID
    "permissions": ["read", "write"]  // 权限列表
  }
  ```
- **响应**: 返回分享信息

### 获取分享文件列表
- **接口**: `/files/shared/list`
- **方法**: GET
- **描述**: 获取分享给当前用户的文件列表
- **需要认证**: 是
- **响应**: 返回分享文件列表

## 数据模型

### 文件元数据 (FileMetadata)
```json
{
  "id": "string",
  "filename": "string",
  "file_path": "string",
  "upload_date": "datetime",
  "file_size": "integer",
  "user_id": "string",
  "username": "string",
  "is_public": "boolean",
  "tags": ["string"],
  "description": "string",
  "share_info": {
    "shared_with": "string",
    "permissions": ["string"],
    "updated_at": "datetime"
  }
}
```

### 文件分享信息 (FileShare)
```json
{
  "shared_with": "string",
  "permissions": ["string"],
  "updated_at": "datetime"
}
``` 