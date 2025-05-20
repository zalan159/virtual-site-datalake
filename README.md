# 灵境孪生中台 / Virtual Twin Data Platform

“灵境孪生中台”是面向数字孪生场景的数据服务平台，致力于为数字孪生管理和应用提供统一、标准化、多源异构数据的整合与服务能力。平台支持多种工业数据类型的接入、转换、存储、管理与分发，助力数字孪生场景的快速构建与高效运维。

The **Virtual Twin Data Platform** is a data service solution for digital twin scenarios. It provides unified and standardized access, transformation, storage and distribution for heterogeneous industrial data sources. The platform helps quickly build and operate digital twin projects by supporting a variety of industrial data types.

## 项目目标 / Project Goals

为数字孪生场景和客户端提供统一的数据服务，整合3D模型、IoT、视频流、GIS、附件等多源异构数据，实现数据标准化、统一管理和灵活绑定，支撑数字孪生场景的构建、可视化和智能化。

Provide unified data services for digital twin scenes and clients. It integrates 3D models, IoT, video streams, GIS data and attachments into a standardized repository that can be flexibly bound to scenes for visualization and intelligent analysis.

## 支持的数据类型 / Supported Data Types

1. **3D工业模型数据 / 3D Industrial Models**
   - 支持多种3D工业模型格式，统一转换为GLB或FBX格式存储。
   - 元数据（如模型描述、结构、标签等）单独抽离存储于MongoDB。
   - 转换后的模型作为数字孪生场景的基础素材，可实例化为模型实例。

   The platform converts various industrial model formats to GLB or FBX. Metadata such as descriptions, structure and tags are stored separately in MongoDB. The converted models can then be instantiated in scenes.

2. **模型实例与场景 / Model Instances and Scenes**
   - 支持对基础模型进行实例化，形成模型实例。
   - 模型实例作为数字孪生数据的载体，组成场景结构。

   Base models can be instantiated to become model instances. Scenes are composed of these instances and serve as carriers for digital twin data.

3. **IoT数据 / IoT Data**
   - 支持用户自定义输入MQTT数据源，通过连接池管理。
   - 平台自动订阅、实时缓存于Redis，并持久化至MongoDB。
   - 用户可查阅历史与实时MQTT数据，并可将订阅对象绑定到模型实例。

   Custom MQTT data sources can be added and managed with connection pools. Data is subscribed automatically, cached in Redis and persisted to MongoDB for history queries. MQTT topics can be bound to model instances.

4. **附件数据 / Attachments**
   - 使用MinIO进行对象存储，支持各类附件上传。
   - 可将MinIO对象链接绑定到模型实例。

   Files are stored in MinIO object storage and can be linked to model instances.

5. **视频流数据 / Video Streams**
   - 支持多种实时视频流（如HLS、RTSP、海康SDK等）。
   - 视频流信息存储于MongoDB，通过平台统一转为标准接口（可扩展）。
   - 支持流送服务（不做视频存储），可绑定到模型实例。

   Multiple live stream formats (HLS, RTSP, SDKs) are supported. Stream information is stored in MongoDB and exposed through unified APIs. Streams can be bound to instances without storing the video.

6. **GIS数据 / GIS Data**
   - 支持3DTiles数据上传，并可转换为TMS、WMS、WTMS等服务。
   - GIS数据可绑定到数字孪生场景。

   3DTiles uploads are supported and can be converted to TMS/WMS/WTMS services. GIS data can be bound to scenes.

7. **数据可视化 / Data Visualization**
   - 集成GoView数据可视化编辑工具，支持拖拽生成可视化报表。
   - 可视化报表可绑定并叠加到场景中。

   The GoView visualization editor is integrated so reports can be built via drag‑and‑drop and overlaid in scenes.

## 平台特性 / Features

- 多源异构数据标准化与统一管理
- 灵活的数据绑定与场景构建能力
- 支持多种3D模型格式自动转换与存储
- IoT数据实时采集、缓存与历史查询
- 附件、视频流、GIS等多类型数据统一接入
- 可视化报表编辑与场景叠加
- Web端管理页面与API服务
- Docker化部署，支持多种数据库组合
- 默认数据环境：MongoDB、Redis、MinIO

Standardized management for heterogeneous data, flexible scene binding, automatic model conversion, real-time IoT data handling, unified attachments/video/GIS access, visualization tools, web management APIs and Docker-based deployment with MongoDB, Redis and MinIO by default.

## 系统架构 / System Architecture

平台采用微服务与容器化架构，核心服务包括：
- 数据接入与转换服务
- 统一数据存储与管理服务
- 实时数据流与缓存服务
- Web管理与API服务
- 可视化编辑与展示服务

The system is built with microservices and containers. Core services include data ingestion/conversion, unified storage, real-time data and caching, web management APIs, and visualization.

## 环境配置 / Environment Setup

### 开发环境 / Development

开发环境只启动MongoDB、Redis和MinIO服务，方便本地开发和调试：

1. 启动开发环境服务：
```bash
docker-compose -f docker-compose.dev.yml up -d
```

2. 运行本地开发服务器：
```bash
uvicorn app.main:app --reload
```

Only MongoDB, Redis and MinIO are started in development. Use the above commands to run the services and start the server with hot reload.

### 生产环境 / Production

生产环境使用完整的Docker配置，包含所有服务：

1. 启动所有服务：
```bash
docker-compose -f docker-compose.prod.yml up -d
```

## 服务访问 / Service Endpoints

- Web管理端: http://localhost:8000
- MinIO控制台: http://localhost:9001
- MongoDB: localhost:27017
- Redis: localhost:6379

Access the management UI at `http://localhost:8000`. MinIO console runs on `http://localhost:9001`. MongoDB and Redis are available on the listed ports.

## 配置文件 / Configuration File

系统使用YAML格式的配置文件（`config.yaml`）来管理所有配置项，包括：
- MongoDB配置
- Redis配置
- MinIO配置
- JWT配置
- 支持的数据类型与格式配置

All configuration is stored in a `config.yaml` file, covering MongoDB, Redis, MinIO, JWT and supported data formats.

## 环境变量 / Environment Variables

- MONGO_URL: MongoDB连接URL
- REDIS_URL: Redis连接URL
- MINIO_ENDPOINT: MinIO服务端点
- MINIO_ACCESS_KEY: MinIO访问密钥
- MINIO_SECRET_KEY: MinIO密钥
- SECRET_KEY: JWT密钥（用于token生成）

## 开发 / Development Workflow

1. 安装依赖：
```bash
pip install -r requirements.txt
```

2. 确保开发环境服务已启动：
```bash
docker-compose -f docker-compose.dev.yml up -d
```

3. 运行开发服务器：
```bash
uvicorn app.main:app --reload
```

