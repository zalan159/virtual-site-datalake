from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
import os
from fastapi import Depends
from app.utils.mongo_init import get_mongo_url

# 加载 .env 文件
load_dotenv()

# MongoDB连接
MONGO_URL = get_mongo_url()
MONGO_DB_NAME = os.getenv("MONGO_DB_NAME")
client = AsyncIOMotorClient(MONGO_URL)
db = client[MONGO_DB_NAME]

# 数据库依赖项
async def get_database():
    """
    获取数据库连接作为依赖项
    """
    return db 