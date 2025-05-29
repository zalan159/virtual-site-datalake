# 贡献指南

感谢您对灵境孪生中台项目的关注！我们欢迎任何形式的贡献。

## 如何贡献

### 报告问题

如果您发现了bug或有功能建议，请：

1. 查看现有的Issues，确认问题尚未被报告
2. 创建新的Issue，详细描述问题或建议
3. 提供尽可能多的上下文信息，包括：
   - 操作系统版本
   - Python版本
   - 详细的错误信息
   - 重现步骤

### 提交代码

1. **Fork项目**：点击页面右上角的Fork按钮

2. **克隆项目**：
   ```bash
   git clone https://github.com/yourusername/VirtualSite.git
   cd VirtualSite
   ```

3. **创建分支**：
   ```bash
   git checkout -b feature/your-feature-name
   ```

4. **设置开发环境**：
   ```bash
   # 复制环境变量文件
   cp .example .env
   
   # 启动数据库服务
   docker-compose -f docker-compose.dev.yml up -d
   
   # 安装后端依赖
   uv sync
   
   # 安装前端依赖
   cd web
   npm install
   ```

5. **进行更改**：
   - 编写代码
   - 添加测试
   - 更新文档

6. **代码风格**：
   确保代码符合项目规范：
   ```bash
   # Python代码格式化
   black app/
   isort app/
   
   # 前端代码检查
   cd web
   npm run lint
   ```

7. **测试**：
   ```bash
   # 运行测试
   pytest
   ```

8. **提交更改**：
   ```bash
   git add .
   git commit -m "feat: 添加新功能描述"
   ```

9. **推送分支**：
   ```bash
   git push origin feature/your-feature-name
   ```

10. **创建Pull Request**：
    在GitHub上创建Pull Request，详细描述您的更改。

## 代码规范

### Python代码规范

- 使用Black进行代码格式化
- 使用isort进行import排序
- 遵循PEP 8规范
- 添加类型提示
- 编写docstring

### 前端代码规范

- 使用TypeScript
- 遵循ESLint配置
- 使用Vue 3 Composition API

### 提交信息规范

使用约定式提交规范：

- `feat:` 新功能
- `fix:` 修复bug
- `docs:` 文档更新
- `style:` 代码格式化
- `refactor:` 重构
- `test:` 添加测试
- `chore:` 构建过程或辅助工具的变动

## 开发指南

### 项目结构

```
VirtualSite/
├── app/                    # 后端应用
│   ├── routers/           # API路由
│   ├── models/            # 数据模型
│   ├── services/          # 业务逻辑
│   ├── tasks/             # 异步任务
│   └── main.py            # 应用入口
├── web/                   # 前端应用
│   ├── src/               # 源代码
│   └── public/            # 静态资源
├── docker-compose.dev.yml # 开发环境配置
└── README.md              # 项目说明
```

### 数据库迁移

如果您的更改涉及数据库结构修改，请：

1. 更新相应的模型文件
2. 创建迁移脚本（如需要）
3. 在Pull Request中详细说明变更

### 测试

我们使用pytest进行测试。请为新功能添加相应的测试：

```bash
# 运行所有测试
pytest

# 运行特定测试
pytest tests/test_specific.py

# 生成覆盖率报告
pytest --cov=app tests/
```

## 许可证

通过贡献代码，您同意您的贡献将在MIT许可证下发布。

## 获取帮助

如果您在贡献过程中遇到问题，可以：

1. 查看项目文档
2. 在Issues中提问
3. 联系项目维护者

感谢您的贡献！ 