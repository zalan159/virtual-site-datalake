import redis
from dotenv import load_dotenv
import os

# 加载 .env 文件
load_dotenv()

class RedisService:
    def __init__(self):
        self.redis_client = redis.Redis(
            host=os.getenv('REDIS_HOST'),
            port=int(os.getenv('REDIS_PORT')),
            db=int(os.getenv('REDIS_DB')),
            password=os.getenv('REDIS_PASSWORD'),
            decode_responses=True
        )
        self.verification_code_expire = int(os.getenv('REDIS_VERIFICATION_CODE_EXPIRE'))

    def store_verification_code(self, phone: str, code: str) -> None:
        """存储验证码"""
        key = f"verification_code:{phone}"
        self.redis_client.setex(key, self.verification_code_expire, code)

    def get_verification_code(self, phone: str) -> str:
        """获取验证码"""
        key = f"verification_code:{phone}"
        return self.redis_client.get(key)

    def delete_verification_code(self, phone: str) -> None:
        """删除验证码"""
        key = f"verification_code:{phone}"
        self.redis_client.delete(key)

redis_service = RedisService() 