# 生产环境部署配置指南

## CORS跨域问题解决方案

### 问题描述
GoView子应用在iframe中运行时，API请求被CORS策略阻止。错误信息：
```
Access to XMLHttpRequest at 'http://127.0.0.1:8000/api/goview/project/getData' 
from origin 'http://www.virtual-site.com:3000' has been blocked by CORS policy
```

### 解决方案概述
通过修改GoView的axios配置和nginx代理配置，让所有API请求通过主应用进行代理转发。

## 配置修改说明

### 1. GoView Axios配置修改
已修改 `web/go-view/src/api/axios.ts`：

```typescript
// 生产环境使用相对路径，开发环境使用完整URL
const axiosInstance = axios.create({
  baseURL: import.meta.env.PROD ? axiosPre : `${import.meta.env.VITE_DEV_PATH}${axiosPre}`,
  timeout: ResultEnum.TIMEOUT
})
```

这样：
- **开发环境**: 使用 `http://127.0.0.1:8000/api/goview`
- **生产环境**: 使用 `/api/goview` (相对路径)

### 2. 主应用代理配置
已修改 `web/vite.config.ts`，添加专门的GoView API代理：

```typescript
proxy: {
  '/api/goview': {
    target: env.VITE_BASE_URL,
    changeOrigin: true,
    rewrite: (path) => path.replace(/^\/api\/goview/, '/api/goview'),
  },
  '/api': {
    target: env.VITE_BASE_URL,
    changeOrigin: true,
    rewrite: (path) => path.replace(/^\/api/, ''),
  },
  // ... 其他配置
}
```

## Nginx生产环境配置

创建或更新nginx配置文件：

```nginx
server {
    listen 80;
    server_name www.virtual-site.com;
    root /path/to/web/dist;
    index index.html;

    # GoView子应用静态文件
    location /goview/ {
        alias /path/to/web/dist/goview/;
        try_files $uri $uri/ /goview/index.html;
        
        # 添加必要的headers
        add_header Cache-Control "no-cache, no-store, must-revalidate";
        add_header Pragma "no-cache";
        add_header Expires "0";
    }

    # GoView API代理 - 重要！必须在通用API代理之前
    location /api/goview/ {
        proxy_pass http://127.0.0.1:8000/api/goview/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # CORS headers
        add_header Access-Control-Allow-Origin *;
        add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS";
        add_header Access-Control-Allow-Headers "DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization";
        
        # 处理预检请求
        if ($request_method = 'OPTIONS') {
            add_header Access-Control-Allow-Origin *;
            add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS";
            add_header Access-Control-Allow-Headers "DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization";
            add_header Access-Control-Max-Age 1728000;
            add_header Content-Type 'text/plain; charset=utf-8';
            add_header Content-Length 0;
            return 204;
        }
    }

    # 通用API代理
    location /api/ {
        proxy_pass http://127.0.0.1:8000/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # React主应用
    location / {
        try_files $uri $uri/ /index.html;
    }

    # 静态资源缓存
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

## 部署步骤

### 1. 构建应用
```bash
cd web
npm run build:all
```

### 2. 检查构建结果
确认目录结构：
```
web/dist/
├── index.html                 # React主应用
├── assets/                    # React资源
├── goview/                    # GoView子应用
│   ├── index.html
│   └── static/
└── ...
```

### 3. 更新nginx配置
```bash
# 备份现有配置
sudo cp /etc/nginx/sites-available/default /etc/nginx/sites-available/default.backup

# 更新配置文件
sudo nano /etc/nginx/sites-available/default

# 测试配置
sudo nginx -t

# 重载nginx
sudo systemctl reload nginx
```

### 4. 验证部署
1. ✅ 访问主应用: `http://www.virtual-site.com`
2. ✅ 访问GoView: `http://www.virtual-site.com/goview/`
3. ✅ 检查iframe加载是否正常
4. ✅ 检查API请求是否通过代理正常工作

## 故障排除

### 1. API请求仍然被CORS阻止
- 检查nginx配置中的API代理顺序
- 确认 `/api/goview/` 代理在 `/api/` 之前
- 查看nginx错误日志: `sudo tail -f /var/log/nginx/error.log`

### 2. 静态资源404
- 确认GoView构建输出到正确目录
- 检查nginx的alias路径是否正确
- 验证文件权限: `ls -la /path/to/web/dist/goview/`

### 3. iframe无法加载
- 检查浏览器控制台错误
- 确认GoView的base路径配置正确
- 验证路由配置是否支持子路径

### 4. token认证问题
- 确认token正确传递到GoView
- 检查后端API是否正确处理代理请求的headers
- 验证token有效期

## 环境变量说明

### GoView环境变量配置
创建 `web/go-view/.env` 文件：
```bash
# GoView环境配置 
VITE_DEV_PATH=http://127.0.0.1:8000
VITE_PRO_PATH=
```

说明：
- **开发环境**: `VITE_DEV_PATH` 指向后端API服务器
- **生产环境**: `VITE_PRO_PATH` 为空，使用相对路径通过主应用代理

### 开发环境
- GoView使用vite代理将 `/api/goview` 和 `/api/streams` 转发到 `http://127.0.0.1:8000`
- 主应用代理将 `/goview` 转发到 `http://localhost:3001`

### 生产环境
- 所有API请求使用相对路径 `/api/*`
- Nginx统一代理所有 `/api/` 请求到后端服务器

## 安全建议

1. **生产环境移除CORS allow origin ***: 
   ```nginx
   add_header Access-Control-Allow-Origin "http://www.virtual-site.com";
   ```

2. **启用HTTPS**:
   ```nginx
   listen 443 ssl;
   ssl_certificate /path/to/cert.pem;
   ssl_certificate_key /path/to/key.pem;
   ```

3. **添加安全headers**:
   ```nginx
   add_header X-Frame-Options "SAMEORIGIN";
   add_header X-Content-Type-Options "nosniff";
   add_header X-XSS-Protection "1; mode=block";
   ```

通过以上配置，GoView子应用的CORS问题将得到彻底解决。 