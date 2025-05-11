

### **API 文档：认证模块**

#### **1. 用户注册**
- **端点**: `POST /register`
- **功能**: 注册新用户。
- **请求体**:
  ```json
  {
    "username": "string",
    "phone": "string",
    "password": "string"
  }
  ```
- **响应**:
  - 成功: 返回注册的用户信息（不包含密码）。
  - 失败: 
    - `400 Bad Request`: 用户名或手机号已存在。

---

#### **2. 发送验证码**
- **端点**: `POST /send-code`
- **功能**: 向指定手机号发送验证码。
- **请求体**:
  ```json
  {
    "phone": "string"
  }
  ```
- **响应**:
  - 成功: 返回 `{"message": "Verification code sent successfully"}`。
  - 失败: 
    - `400 Bad Request`: 手机号格式无效或发送失败。

---

#### **3. 检查用户名是否已存在**
- **端点**: `POST /check-username`
- **功能**: 检查用户名是否已被注册。
- **请求体**:
  ```json
  {
    "username": "string"
  }
  ```
- **响应**:
  - 返回 `{"exists": true/false}`。

---

#### **4. 登录**
- **端点**: `POST /login`
- **功能**: 支持用户名/手机号+密码或手机号+验证码登录。
- **请求体**:
  - 用户名/手机号+密码:
    ```json
    {
      "username": "string",
      "password": "string"
    }
    ```
  - 手机号+验证码:
    ```json
    {
      "phone": "string",
      "code": "string"
    }
    ```
- **响应**:
  - 成功: 返回访问令牌 `{"access_token": "string", "token_type": "bearer"}`。
  - 失败: 
    - `401 Unauthorized`: 用户名/密码错误或验证码不匹配。
    - `422 Unprocessable Entity`: 请求参数无效。

---

#### **5. 手机号验证码登录（专用端点）**
- **端点**: `POST /phone-login`
- **功能**: 仅支持手机号+验证码登录。
- **请求体**:
  ```json
  {
    "phone": "string",
    "code": "string"
  }
  ```
- **响应**:
  - 成功: 返回访问令牌。
  - 失败: 
    - `401 Unauthorized`: 验证码不匹配。
    - `404 Not Found`: 用户不存在。

---

#### **6. 完成注册**
- **端点**: `POST /complete-registration`
- **功能**: 通过手机号验证码登录后，补充用户信息。
- **请求体**:
  ```json
  {
    "username": "string",
    "phone": "string",
    "email": "string (可选)"
  }
  ```
- **响应**:
  - 成功: 返回用户信息。
  - 失败: 
    - `400 Bad Request`: 用户名或手机号已存在。

---

#### **7. 获取当前用户信息**
- **端点**: `GET /users/me`
- **功能**: 获取当前登录用户的信息。
- **响应**:
  - 成功: 返回用户信息。

---

#### **8. 修改密码**
- **端点**: `PUT /users/me/password`
- **功能**: 修改当前用户的密码。
- **请求体**:
  ```json
  {
    "old_password": "string",
    "new_password": "string"
  }
  ```
- **响应**:
  - 成功: 返回 `{"message": "密码修改成功"}`。
  - 失败: 
    - `400 Bad Request`: 旧密码或新密码缺失。
    - `401 Unauthorized`: 旧密码不正确。

---

#### **9. 修改用户名**
- **端点**: `PUT /users/me/username`
- **功能**: 修改当前用户的用户名。
- **请求体**:
  ```json
  {
    "new_username": "string"
  }
  ```
- **响应**:
  - 成功: 返回 `{"message": "用户名修改成功"}`。
  - 失败: 
    - `400 Bad Request`: 新用户名已存在。

---

#### **10. 设置初始密码**
- **端点**: `POST /users/me/set-password`
- **功能**: 为通过手机验证码登录的用户设置初始密码。
- **请求体**:
  ```json
  {
    "new_password": "string"
  }
  ```
- **响应**:
  - 成功: 返回 `{"message": "初始密码设置成功"}`。
  - 失败: 
    - `400 Bad Request`: 用户已有密码。

---

#### **11. 检查是否已设置密码**
- **端点**: `GET /users/me/has-password`
- **功能**: 检查当前用户是否已设置密码。
- **响应**:
  - 返回 `{"has_password": true/false}`。

---

#### **12. 退出登录**
- **端点**: `POST /logout`
- **功能**: 退出登录（客户端需删除令牌）。
- **响应**:
  - 返回 `{"message": "Successfully logged out"}`。

---
