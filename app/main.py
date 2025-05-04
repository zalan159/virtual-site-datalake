from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
import asyncio
from datetime import datetime
from fastapi.responses import JSONResponse
import traceback
import sys


from app.routers import auth, files, tasks, attachments, metadata
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



# Windows 下强制使用 SelectorEventLoop
if os.name == "nt":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
app = FastAPI(
    title="GLTF文件存储系统",
    description="支持用户认证的GLTF文件存储系统API",
    version="1.0.0"
)

# CORS设置
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],  # 允许前端开发服务器
    allow_credentials=True,  # 允许携带凭证
    allow_methods=["*"],  # 允许所有HTTP方法
    allow_headers=["*"],  # 允许所有头部
    expose_headers=["*"],  # 允许前端访问响应头
    max_age=3600,  # 预检请求的缓存时间
)

# 包含路由
app.include_router(auth.router, prefix="/auth", tags=["认证"])
app.include_router(files.router, prefix="/files", tags=["文件操作"])
app.include_router(tasks.router, prefix="/tasks", tags=["任务管理"])
app.include_router(attachments.router, prefix="/attachments", tags=["附件管理"])
app.include_router(metadata.router, prefix="/metadata", tags=["元数据管理"])

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
            "hashed_password": get_password_hash("Front123@"),
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