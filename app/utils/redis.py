import redis
from config import REDIS_CONFIG

class RedisService:
    def __init__(self):
        self.redis_client = redis.Redis(
            host=REDIS_CONFIG['host'],
            port=REDIS_CONFIG['port'],
            db=REDIS_CONFIG['db'],
            password=REDIS_CONFIG['password'],
            decode_responses=True
        )
        self.verification_code_expire = REDIS_CONFIG['verification_code_expire']

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