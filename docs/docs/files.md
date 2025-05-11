
---

### **API 接口文档**

#### **1. 获取支持的文件格式**
- **路径**: `/supported-formats`
- **方法**: `GET`
- **描述**: 获取所有支持的文件格式及其扩展名。
- **返回示例**:
  ```json
  [
    {"format": "GLTF", "extensions": ["GLTF", "GLB"]},
    {"format": "OBJ", "extensions": ["OBJ"]}
  ]
  ```

---

#### **2. 上传文件**
- **路径**: `/upload`
- **方法**: `POST`
- **描述**: 上传 3D 模型文件。
- **参数**:
  - `file` (文件): 3D 模型文件。
  - `metadata` (字符串, 可选): 文件元数据（JSON 字符串）。
- **返回示例**:
  ```json
  {
    "filename": "example.glb",
    "file_path": "user_id/20240101_120000_example.glb",
    "upload_date": "2024-01-01T12:00:00",
    "file_size": 1024,
    "user_id": "user_id",
    "username": "username",
    "is_public": false,
    "tags": []
  }
  ```

---

#### **3. 获取文件列表**
- **路径**: `/list`
- **方法**: `GET`
- **描述**: 获取当前用户的所有文件列表。
- **返回示例**:
  ```json
  [
    {
      "filename": "example.glb",
      "file_path": "user_id/20240101_120000_example.glb",
      "upload_date": "2024-01-01T12:00:00",
      "file_size": 1024,
      "user_id": "user_id",
      "username": "username",
      "is_public": false,
      "tags": []
    }
  ]
  ```

---

#### **4. 获取文件详情**
- **路径**: `/{file_path}`
- **方法**: `GET`
- **描述**: 获取特定文件的详情和下载链接。
- **参数**:
  - `file_path` (字符串): 文件路径。
- **返回示例**:
  ```json
  {
    "filename": "example.glb",
    "file_path": "user_id/20240101_120000_example.glb",
    "download_url": "https://minio.example.com/presigned-url",
    "conversion": {
      "output_file_path": "converted/example.gltf",
      "download_url": "https://minio.example.com/presigned-url"
    }
  }
  ```

---

#### **5. 删除文件**
- **路径**: `/{file_id}`
- **方法**: `DELETE`
- **描述**: 删除文件。
- **参数**:
  - `file_id` (字符串): 文件 ID。
- **返回示例**:
  ```json
  {"message": "文件删除成功"}
  ```

---

#### **6. 更新文件信息**
- **路径**: `/{file_id}`
- **方法**: `PUT`
- **描述**: 更新文件信息（如描述、标签、公开状态）。
- **参数**:
  - `file_id` (字符串): 文件 ID。
  - `update_data` (JSON): 更新数据（如 `description`、`tags`、`is_public`）。
- **返回示例**:
  ```json
  {
    "filename": "example.glb",
    "description": "更新后的描述",
    "tags": ["tag1", "tag2"],
    "is_public": true
  }
  ```

---

#### **7. 分享文件**
- **路径**: `/{file_id}/share`
- **方法**: `POST`
- **描述**: 分享文件给其他用户。
- **参数**:
  - `file_id` (字符串): 文件 ID。
  - `share_info` (JSON): 分享信息（如 `shared_with`）。
- **返回示例**:
  ```json
  {
    "shared_with": "user_id_2",
    "updated_at": "2024-01-01T12:00:00"
  }
  ```

---

#### **8. 获取分享的文件列表**
- **路径**: `/shared/list`
- **方法**: `GET`
- **描述**: 获取分享给当前用户的文件列表。
- **返回示例**:
  ```json
  [
    {
      "filename": "shared_example.glb",
      "file_path": "user_id_2/20240101_120000_shared_example.glb",
      "upload_date": "2024-01-01T12:00:00",
      "file_size": 1024,
      "user_id": "user_id_2",
      "username": "username_2",
      "is_public": false,
      "tags": []
    }
  ]
  ```

---

#### **9. 获取文件下载链接**
- **路径**: `/download/{file_id}`
- **方法**: `GET`
- **描述**: 根据文件 ID 获取下载链接。
- **参数**:
  - `file_id` (字符串): 文件 ID。
- **返回示例**:
  ```json
  {
    "file_id": "file_id",
    "filename": "example.glb",
    "download_url": "https://minio.example.com/presigned-url"
  }
  ```

---

#### **10. 转换文件格式**
- **路径**: `/{file_id}/convert`
- **方法**: `POST`
- **描述**: 转换文件格式。
- **参数**:
  - `file_id` (字符串): 文件 ID。
  - `output_format` (字符串, 可选): 输出格式（如 `GLTF`、`OBJ`）。
- **返回示例**:
  ```json
  {
    "message": "文件转换任务已创建",
    "task_id": "task_id",
    "status": "PENDING",
    "progress": 0
  }
  ```

---

#### **11. 获取转换任务状态**
- **路径**: `/convert/status/{task_id}`
- **方法**: `GET`
- **描述**: 获取转换任务状态。
- **参数**:
  - `task_id` (字符串): 任务 ID。
- **返回示例**:
  ```json
  {
    "task_id": "task_id",
    "status": "COMPLETED",
    "progress": 100,
    "current_step": "完成",
    "error_message": null,
    "result": "converted/example.gltf"
  }
  ```

---
