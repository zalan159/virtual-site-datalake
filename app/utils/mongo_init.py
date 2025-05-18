from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
import os

load_dotenv()  # 加载 .env 文件中的环境变量

async def init_mongodb_indexes():
    """
    初始化MongoDB索引
    """
    try:
        # 从 .env 文件中获取 MongoDB 配置
        mongo_username = os.getenv("MONGO_USERNAME")
        mongo_password = os.getenv("MONGO_PASSWORD")
        mongo_host = os.getenv("MONGO_HOST")
        mongo_port = os.getenv("MONGO_PORT")
        mongo_db_name = os.getenv("MONGO_DB_NAME")

        # 构建 MongoDB 连接 URL
        mongo_url = f"mongodb://{mongo_username}:{mongo_password}@{mongo_host}:{mongo_port}/{mongo_db_name}?authSource=admin"

        client = AsyncIOMotorClient(mongo_url)
        db = client.get_database()
        
        # 为metadata集合创建file_id索引
        await db.metadata.create_index("file_id")
        
        # 为公共模型集合创建索引
        await db.public_models.create_index("tags")  # 标签索引
        await db.public_models.create_index("category")  # 分类索引
        await db.public_models.create_index("sub_category")  # 子分类索引
        await db.public_models.create_index("is_featured")  # 推荐模型索引
        await db.public_models.create_index("download_count")  # 下载次数索引
        await db.public_models.create_index([("category", 1), ("sub_category", 1)])  # 复合索引
        await db.public_models.create_index([("category", 1), ("tags", 1)])  # 分类+标签复合索引
        await db.public_models.create_index("filename", unique=False)  # 文件名索引
        
        # 为3DTiles模型集合创建索引
        await db.threedtiles.create_index("name")  # 名称索引
        await db.threedtiles.create_index("tags")  # 标签索引
        await db.threedtiles.create_index("is_public")  # 公开状态索引
        await db.threedtiles.create_index("created_at")  # 创建时间索引
        await db.threedtiles.create_index([("name", "text"), ("description", "text")])  # 全文索引
        
        print("MongoDB索引初始化成功")
        
    except Exception as e:
        print(f"MongoDB索引初始化失败: {str(e)}")

def get_mongo_url():
    """
    统一获取MongoDB连接URL
    """
    mongo_username = os.getenv("MONGO_USERNAME")
    mongo_password = os.getenv("MONGO_PASSWORD")
    mongo_host = os.getenv("MONGO_HOST")
    mongo_port = os.getenv("MONGO_PORT")
    mongo_db_name = os.getenv("MONGO_DB_NAME")
    return f"mongodb://{mongo_username}:{mongo_password}@{mongo_host}:{mongo_port}/{mongo_db_name}?authSource=admin" 