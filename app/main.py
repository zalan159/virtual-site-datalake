from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
import asyncio
from datetime import datetime
from fastapi.responses import JSONResponse
import traceback
import sys
from fastapi.staticfiles import StaticFiles

from app.routers import auth, files, tasks, attachments, metadata, scene, public_models , streams
from app.routers import iot_bindings  # 新的IoT绑定系统
from app.routers import iot_connections  # 新增IoT连接统一管理路由
from app.routers import threedtiles  # 新增3DTiles路由
from app.routers import wmts  # 新增WMTS路由
from app.routers import gaussian_splat  # 新增高斯泼溅路由
from app.routers import websocket  # 新增WebSocket路由
from app.routers import mqtt  # 新增MQTT连接配置路由
from app.routers import http  # 新增HTTP连接配置路由
# from app.routers import charts  # 新增图表管理路由
from app.routers import goview  # 新增GoView路由
from app.models.user import UserRole
from app.auth.utils import get_password_hash
from app.core.minio_client import check_and_create_bucket
from app.tasks import task_manager
from app.utils.mongo_init import init_mongodb_indexes
from app.utils.mongo_init import get_mongo_url
import asyncio

import os
from dotenv import load_dotenv

# 加载 .env 文件
load_dotenv()

# 替换原有的 MONGO_CONFIG 和 MONGO_URL
MONGO_URL = get_mongo_url()
MONGO_CONFIG = {
    'db_name': os.getenv('MONGO_DB_NAME')
}

from neomodel import config

# 从环境变量获取 Neo4j 配置信息
NEO4J_HOST = os.getenv('NEO4J_HOST', 'localhost')
NEO4J_PORT = os.getenv('NEO4J_PORT', '7687')
NEO4J_USERNAME = os.getenv('NEO4J_USERNAME', 'neo4j')
NEO4J_PASSWORD = os.getenv('NEO4J_PASSWORD', 'password')
config.DATABASE_URL = f"bolt://{NEO4J_USERNAME}:{NEO4J_PASSWORD}@{NEO4J_HOST}:{NEO4J_PORT}"

# Windows 下强制使用 SelectorEventLoop
if os.name == "nt":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
app = FastAPI(
    title="灵境孪生中台",
    description="支持用户认证的GLTF文件存储系统API",
    version="1.0.0"
)

# 配置 CORS 中间件
origins = [
    "http://localhost:5173", # 允许的前端开发服务器
    "http://127.0.0.1:5173",
    "http://localhost:3000", # 添加你的前端源
    "http://127.0.0.1:3000",
    "http://localhost:3001", # GoView前端服务器
    "http://127.0.0.1:3001",
    "http://localhost:8000", # 允许本地后端访问
    "http://127.0.0.1:8000",
    # 你可以添加更多的源
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"], # 允许所有方法
    allow_headers=["*"], # 允许所有头部
    expose_headers=["*"],  # 允许前端访问响应头
    max_age=3600,  # 预检请求的缓存时间
)

# 包含路由
app.include_router(auth.router, prefix="/auth", tags=["认证"])
app.include_router(files.router, prefix="/files", tags=["文件操作"])
app.include_router(tasks.router, prefix="/tasks", tags=["任务管理"])
app.include_router(attachments.router, prefix="/attachments", tags=["附件管理"])
app.include_router(metadata.router, prefix="/metadata", tags=["元数据管理"])
app.include_router(scene.router, prefix="", tags=["场景管理"])
app.include_router(public_models.router, prefix="/public-models", tags=["公共模型"])  # 添加公共模型路由
app.include_router(threedtiles.router, prefix="/3dtiles", tags=["3DTiles模型"])  # 添加3DTiles路由
app.include_router(wmts.router, prefix="/wmts", tags=["WMTS瓦片服务"])  # 添加WMTS路由
app.include_router(gaussian_splat.router, prefix="/gaussian-splats", tags=["高斯泼溅"])  # 添加高斯泼溅路由
app.include_router(streams.router, prefix="/streams", tags=["视频流管理"])  # 新增视频流路由
app.include_router(websocket.router, prefix="/websockets", tags=["WebSocket数据源"])  # 新增WebSocket路由
app.include_router(mqtt.router, prefix="/mqtt", tags=["MQTT连接配置"])  # 新增MQTT连接配置路由
app.include_router(http.router, prefix="/http", tags=["HTTP连接配置"])  # 新增HTTP连接配置路由
app.include_router(iot_connections.router, prefix="/iot", tags=["IoT连接统一管理"])  # 新增IoT连接统一管理路由
app.include_router(iot_bindings.router, prefix="", tags=["IoT绑定"])  # 新的IoT绑定系统
# app.include_router(charts.router, prefix="/charts", tags=["图表管理"])  # 新增图表管理路由
app.include_router(goview.router, prefix="/goview", tags=["GoView"])  # 新增GoView路由

# MongoDB连接
client = AsyncIOMotorClient(MONGO_URL)
db = client[MONGO_CONFIG['db_name']]

# 检查并创建超级管理员用户
async def check_and_create_admin():
    admin_user = await db.users.find_one({"username": "admin"})
    if not admin_user:
        admin_dict = {
            "username": "admin",
            "email": "admin@example.com",
            "phone": "10000000000",  # 添加默认手机号
            "hashed_password": get_password_hash("admin123"),
            "is_active": True,
            "role": UserRole.ADMIN,
            "created_at": datetime.now(),
            "updated_at": datetime.now()
        }
        await db.users.insert_one(admin_dict)
        print("超级管理员用户已创建")

@app.on_event("startup")
async def startup_event():
    await check_and_create_admin()
    check_and_create_bucket()
    # 初始化MongoDB索引
    await init_mongodb_indexes()
    # 启动任务管理器
    await task_manager.start()
    print("任务管理器已启动")

@app.on_event("shutdown")
async def shutdown_event():
    # 停止任务管理器
    await task_manager.stop()
    print("任务管理器已停止")

# 添加全局异常处理器
@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    print(f"HTTP异常: {exc.status_code} - {exc.detail}")
    print(f"请求路径: {request.url.path}")
    print(f"请求方法: {request.method}")
    print(f"请求头: {request.headers}")
    
    # 尝试获取请求体
    try:
        body = await request.body()
        print(f"请求体: {body.decode()}")
    except Exception as e:
        print(f"无法读取请求体: {str(e)}")
    
    # 输出堆栈跟踪
    print("堆栈跟踪:")
    traceback.print_exc(file=sys.stdout)
    
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail},
    )

# 添加422错误处理器
@app.exception_handler(422)
async def validation_exception_handler(request: Request, exc):
    print(f"验证错误 (422): {exc}")
    print(f"请求路径: {request.url.path}")
    print(f"请求方法: {request.method}")
    print(f"请求头: {request.headers}")
    
    # 尝试获取请求体
    try:
        body = await request.body()
        print(f"请求体: {body.decode()}")
    except Exception as e:
        print(f"无法读取请求体: {str(e)}")
    
    # 输出堆栈跟踪
    print("堆栈跟踪:")
    traceback.print_exc(file=sys.stdout)
    
    return JSONResponse(
        status_code=422,
        content={"detail": str(exc)},
    )
