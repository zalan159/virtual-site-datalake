import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from config import MONGO_CONFIG, MONGO_URL
from app.auth.utils import get_password_hash

async def update_admin_password():
    # 连接MongoDB
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[MONGO_CONFIG['db_name']]
    
    # 新的密码哈希
    new_password = "Front123@"
    hashed_password = get_password_hash(new_password)
    
    # 更新admin用户的密码
    result = await db.users.update_one(
        {"username": "admin"},
        {"$set": {"hashed_password": hashed_password}}
    )
    
    if result.modified_count > 0:
        print("Admin password updated successfully!")
    else:
        print("No changes made. Admin user might not exist.")
    
    # 关闭连接
    client.close()

if __name__ == "__main__":
    asyncio.run(update_admin_password()) 