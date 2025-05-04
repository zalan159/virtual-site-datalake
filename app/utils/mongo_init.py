from motor.motor_asyncio import AsyncIOMotorClient
from config import MONGO_URL

async def init_mongodb_indexes():
    """
    初始化MongoDB索引
    """
    try:
        client = AsyncIOMotorClient(MONGO_URL)
        db = client.get_database()
        
        # 为metadata集合创建file_id索引
        await db.metadata.create_index("file_id")
        print("MongoDB索引初始化成功")
        
    except Exception as e:
        print(f"MongoDB索引初始化失败: {str(e)}") 