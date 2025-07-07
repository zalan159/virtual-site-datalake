# 灵境孪生中台 - VirtualSite

<img width="1466" alt="image" src="https://github.com/user-attachments/assets/94022e80-f038-4b56-b7a9-3154a28a6149" />

## 版本信息
**当前版本：v0.3.0**

"灵境孪生中台"是面向数字孪生场景的数据服务平台，致力于为数字孪生管理和应用提供统一、标准化、多源异构数据的整合与服务能力。平台支持多种工业数据类型的接入、转换、存储、管理与分发，助力数字孪生场景的快速构建与高效运维。
测试demo：

http://www.virtual-site.com:3000

请使用移动手机验证码登录，测试联通好像收不到短信，回头看看阿里云的备案

演示视频：
https://www.bilibili.com/video/BV1cu7VziEty

## 更新 集成goview图表编辑器，链接到现有灵境孪生中台，在goview中新建视频流播放器，接收灵境中台中的视频流数据。
更新功能：
<img width="1906" alt="image" src="https://github.com/user-attachments/assets/279e483b-9a27-4fcf-ac9f-f17b7d6bd6fe" />
<img width="1900" alt="image" src="https://github.com/user-attachments/assets/64004fc6-b5c1-4d9b-9d4a-c421ab5586d9" />



## 项目目标

为数字孪生场景和客户端提供统一的数据服务，整合3D模型、IoT、视频流、GIS、附件等多源异构数据，实现数据标准化、统一管理和灵活绑定，支撑数字孪生场景的构建、可视化和智能化。

## 支持的数据类型


1. **3D工业模型数据**
   - 支持多种3D工业模型格式，统一转换为GLB格式存储。



https://github.com/user-attachments/assets/f6e44930-524d-48d8-bac3-e770dcf9d2d8




   - 元数据（如模型描述、结构、标签等）单独抽离存储于MongoDB。
<img width="1469" alt="image" src="https://github.com/user-attachments/assets/de122c88-f047-4709-9b80-5160a9dc2f36" />

   - 转换后的模型作为数字孪生场景的基础素材，可实例化为模型实例。


https://github.com/user-attachments/assets/100a5935-31ec-4698-ae4a-0e95752661e9


2. **模型实例与场景**
<img width="1465" alt="image" src="https://github.com/user-attachments/assets/3cac6721-c4d9-4643-8ad7-8878d3410628" />

   - 支持对基础模型进行实例化，形成模型实例。
   - 模型实例作为数字孪生数据的载体，组成场景结构。

4. **IoT数据**
   - 支持用户自定义输入MQTT数据源，通过连接池管理。
   - 平台自动订阅、实时缓存于Redis，并持久化至MongoDB。
   - 用户可查阅历史与实时MQTT数据，并可将订阅对象绑定到模型实例。

5. **附件数据**
   - 使用MinIO进行对象存储，支持各类附件上传。
   - 可将MinIO对象链接绑定到模型实例。

6. **视频流数据**
   - 支持多种实时视频流（如HLS、（计划支持）RTSP、（计划支持）海康SDK等）。
   - 视频流信息存储于MongoDB，通过平台统一转为标准接口（可扩展）。
   - 支持流送服务（不做视频存储），可绑定到模型实例。

7. **GIS数据**
   - 支持3DTiles数据上传，并可转换为TMS、WMS、WTMS等服务。
   - GIS数据可绑定到数字孪生场景。

8. **WebSocket数据源**
   - 支持WebSocket实时通信数据源管理。
   - 前端直连模式，无需后端代理，降低延迟。
   - 支持多种认证方式（无认证、基础认证、Token认证）。
   - 内置自动重连、心跳保活、错误处理机制。
   - 提供实时对话界面，支持双向消息传输。
   - WebSocket连接配置可绑定到模型实例。

9. **数据可视化**
   - 集成GoView数据可视化编辑工具，支持拖拽生成可视化报表。
   - 可视化报表可绑定并叠加到场景中。

## 支持的3D文件格式

平台支持多种主流的3D工业模型格式，具体支持列表如下：

| 格式 | 版本 | 文件扩展名 |
|------|------|------------|
| 3MF | 1.2.3 | 3MF |
| ACIS | Up to 2023 | SAT, SAB |
| AutoCAD - 2D | Up to AutoCAD 2024 | DWG, DXF |
| AutoCAD - 3D | Up to AutoCAD 2024 | DWG, DXF |
| Autodesk 3DS | Any | 3DS |
| Autodesk DWF | Any | DWF, DWFX |
| Autodesk Inventor | Up to 2025 | IPT, IAM |
| Autodesk Navisworks | From 2012 to 2025 | NWD |
| CATIA V4 | Up to 4.2.5 | MODEL, SESSION, DLV, EXP |
| CATIA V5 | Up to V5_6R2024 | CATDrawing, CATPart, CATProduct, CATShape, CGR |
| CATIA V6 / 3DExperience | Up to V5_6R2024 | 3DXML |
| COLLADA | Any | DAE |
| Creo - Pro/E | Pro/Engineer 19.0 to Creo 11.0 | ASM, NEU, PRT, XAS, XPR |
| DGN | 7, 8 | DGN |
| FBX | ASCII: from 7100 to 7500, Binary: All | FBX |
| GL Transmission Format | Version 2.0 only | GLTF, GLB |
| I-deas | Up to 13.x (NX 5), NX I-deas 6 | MF1, ARC, UNV, PKG |
| IFC | IFC2 up to 2.3.0.1, IFC4 up to 4.3 | IFC, IFCZIP |
| IGES | 5.1, 5.2, 5.3 | IGS, IGES |
| JT | Up to v10.9 | JT |
| NX - Unigraphics | UG11 to UG18, UG NX, NX5 to NX12, NX1847 to NX2412 | PRT |
| Parasolid | Up to 37.1 | X_B, X_T, XMT, XMT_TXT |
| PDF | All Versions | PDF |
| PRC | All Versions | PRC |
| Revit | 2015 to 2025 | RVT, RFA |
| Rhino3D | From 4 to 8 | 3DM |
| Solid Edge | 1 to 20, ST1 to ST10, 2019 to 2025 | ASM, PAR, PWD, PSM |
| SolidWorks | From 97 up to 2025 | SLDASM, SLDPRT |
| STEP | AP 203 Ed1, Ed2, AP 214, AP 242 Ed1, Ed2, Ed3 | STP, STEP, STPZ |
| STEP/XML | Any | STPX, STPXZ |
| Stereo Lithography (STL) | All Versions | STL |
| U3D | ECMA-363 | U3D |
| VDA-FS | Version 1.0 and 2.0 | VDA |
| VRML | V1.0 and V2.0 | WRL, VRML |
| Wavefront OBJ | Any | OBJ |

## 场景编辑器特性

平台内置强大的场景编辑器，提供完整的数字孪生场景构建能力：

- **三维可视化引擎**：基于Cesium.js构建，提供高性能的三维渲染和交互能力
- **图数据库关系管理**：使用Neo4j图数据库记录场景内元素的关联关系，支持复杂的关系查询和分析
- **数据源绑定**：支持将IoT数据、视频流、附件等多种数据源绑定到3D模型（孪生体）上
- **孪生体关系组织**：可视化创建和管理孪生体之间的层级关系、依赖关系和业务关系
- **场景层次管理**：支持场景的嵌套组织，便于大型复杂场景的管理
- **实时数据展示**：绑定的IoT数据可在3D场景中实时显示，提供动态的孪生体状态监控

## 平台特性

- 多源异构数据标准化与统一管理
- 灵活的数据绑定与场景构建能力
- 支持多种3D模型格式自动转换与存储
- IoT数据实时采集、缓存与历史查询
- 附件、视频流、GIS等多类型数据统一接入
- 可视化报表编辑与场景叠加
- 基于Cesium.js的高性能三维场景编辑器
- Neo4j图数据库支持的关系管理
- Web端管理页面与API服务
- Docker化部署，支持多种数据库组合
- 默认数据环境：MongoDB、Redis、MinIO、Neo4j

## 系统架构

平台采用微服务与容器化架构，核心服务包括：
- 数据接入与转换服务
- 统一数据存储与管理服务
- 实时数据流与缓存服务
- Web管理与API服务
- 可视化编辑与展示服务
- 图数据库关系管理服务

## 部署流程

### 系统要求

支持以下操作系统：
- Windows 10/11
- Linux (Ubuntu 20.04+)
- macOS 10.14+

### 环境配置

1. **配置环境变量**
   ```bash
   # 复制环境变量模板文件
   cp .example .env
   ```
   
   编辑 `.env` 文件，配置各项环境变量参数，包括：
   - MongoDB 连接信息
   - Redis 连接信息  
   - MinIO 对象存储配置
   - Neo4j 图数据库配置
   - JWT 认证配置
   - 阿里云短信服务配置（可选）

2. **格式转换程序配置**
   
   ⚠️ **重要说明**：由于格式转换程序是作者自行付费购买的商业软件，您需要：
   - 自行购买3D格式转换工具
   - 在后端 `app/tasks/file_converter.py` 中修改格式转换功能命令
   - 或者联系作者付费获得格式转换器程序

### 安装步骤

1. **启动数据库服务**
   ```bash
   docker-compose -f docker-compose.dev.yml up -d
   ```

2. **安装Python依赖管理工具**
   ```bash
   # 安装uv (推荐的Python包管理器)
   curl -LsSf https://astral.sh/uv/install.sh | sh
   # 或在Windows上使用
   # powershell -c "irm https://astral.sh/uv/install.ps1 | iex"
   ```

3. **启动WebSocket测试服务器（可选）**
   
   为了测试WebSocket功能，项目提供了一个本地测试服务器：
   ```bash
   # Linux/macOS
   cd test
   ./start-websocket-server.sh
   
   # Windows
   cd test
   start-websocket-server.bat
   
   # 手动启动
   cd test
   npm install
   npm start
   ```
   
   测试服务器配置：
   - **URL**: `ws://localhost:8080`
   - **功能**: Echo服务器，回复所有消息
   - **认证**: 无需认证
   - **用途**: WebSocket功能测试和开发

4. **设置Python虚拟环境**
   ```bash
   # 创建虚拟环境
   uv venv
   # 激活虚拟环境
   source .venv/bin/activate  # Linux/macOS
   # .venv\Scripts\activate   # Windows
   ```

4. **安装后端依赖**
   ```bash
   uv sync
   ```

5. **安装前端依赖**
   ```bash
   cd web
   npm install
   cd ..
   ```

6. **启动应用**
   ```bash
   # Linux/macOS
   ./run.sh
   
   # Windows
   run.bat
   ```

### 验证部署

部署完成后，您可以通过以下方式验证：

- 后端API服务：`http://localhost:8000`
- 前端Web界面：`http://localhost:3000`
- API文档：`http://localhost:8000/docs`

### 默认管理员账户

系统会自动创建默认的管理员账户，用于初始登录和系统管理：

- **用户名**：`admin`
- **密码**：`admin123`

⚠️ **安全提醒**：
- 首次登录后，请立即修改默认密码
- 建议在生产环境中使用强密码
- 可通过用户设置页面修改密码

### 故障排除

如遇到问题，请检查：
1. Docker服务是否正常运行
2. 环境变量配置是否正确
3. 各数据库服务是否正常启动
4. 网络端口是否被占用
5. 格式转换程序是否正确配置
## WebSocket功能快速开始

### 🚀 测试WebSocket连接

1. **启动本地测试服务器**
   ```bash
   cd test
   ./start-websocket-server.sh  # Linux/macOS
   # 或
   start-websocket-server.bat   # Windows
   ```

2. **在Web界面中测试**
   - 访问 `http://localhost:3000/data/websockets`
   - 点击"添加WebSocket"按钮
   - 填写配置：
     - 名称：本地测试
     - URL：`ws://localhost:8080`
     - 认证类型：无认证
   - 保存后点击"对话"按钮
   - 点击"连接"开始WebSocket通信

3. **推荐的测试服务器**
   - **Postman Echo**: `wss://ws.postman-echo.com/raw` (推荐)
   - **本地服务器**: `ws://localhost:8080`
   - **Heroku Echo**: `wss://websocket-echo-server.herokuapp.com`

### 📖 相关文档

- **使用指南**: `web/src/docs/websocket-usage.md`
- **排错指南**: `web/src/docs/websocket-troubleshooting.md`
- **Hook源码**: `web/src/hooks/useWebSocketConnection.ts`

### ⚠️ 常见问题

**连接失败代码1006**：
- 检查网络连接和防火墙设置
- 确认WebSocket服务器正在运行
- 如果是wss://，请确保SSL证书有效
- 尝试使用推荐的测试服务器

**消息发送失败**：
- 确认WebSocket连接状态为"已连接"
- 检查消息格式和大小限制
- 查看浏览器控制台的详细错误信息

# 加入开发者社区

<img src="https://github.com/user-attachments/assets/ce19b80a-e830-43e3-b2a4-d0cb1f669f2c" alt="image" width="30%" />

## 版本 0.3.0 重大更新

### 🚀 IoT绑定系统全面升级
- **智能连接池管理**：按sourceId分组绑定，避免重复连接，一个连接可服务多个绑定
- **统一管理路由**：新增IoT连接统一管理API，支持MQTT和HTTP协议
- **数据路径助手**：智能解析多协议格式（MQTT+JSON、WebSocket/HTTP+JSON等）
- **条件引擎**：支持复杂的数据条件判断和处理逻辑
- **实时数据处理器**：高效的IoT数据实时处理和分发系统

### 📡 WebSocket数据源支持
- **实时双向通信**：支持WebSocket协议的实时数据传输
- **多种认证方式**：无认证、基础认证、Token认证
- **自动重连机制**：内置心跳保活、错误处理和断线重连
- **测试服务器**：提供本地WebSocket测试环境
- **可视化对话界面**：支持实时消息收发和状态监控

### 🗺️ 地图服务和高级渲染
- **WMTS地图服务**：支持Web地图瓦片服务（WMTS）标准
- **高斯泼溅渲染**：新增Gaussian Splat 3D点云渲染技术
- **天地图集成**：支持天地图API的地图底图服务
- **瓦片数据管理**：完整的地理瓦片数据上传、转换、服务化流程
- **元数据懒加载**：优化大型数据集的加载性能

### 📊 图表绑定和可视化增强
- **场景图表绑定**：支持将GoView图表直接绑定到3D场景中
- **透明背景处理**：图表在3D场景中的无缝集成显示
- **动态属性表单**：支持图表选择和动态配置
- **实时数据联动**：图表与IoT数据的实时联动更新

### 🎬 动画系统增强
- **动画节点管理**：支持3D模型的动画节点控制
- **动画序列编辑**：可视化的动画时间轴和序列编辑
- **实时变换控制**：支持模型的实时位移、旋转、缩放
- **动画事件绑定**：动画与IoT数据事件的联动触发

### 🔧 系统优化
- **文档结构重组**：统一整理技术文档到docs目录
- **Neo4j插件支持**：增强图数据库的查询和分析能力
- **API接口优化**：统一API代理配置，优化CORS支持
- **前端组件重构**：提升用户体验和交互流畅度
