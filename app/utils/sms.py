import random
import os
from dotenv import load_dotenv
from alibabacloud_dysmsapi20170525.client import Client
from alibabacloud_tea_openapi import models as open_api_models
from alibabacloud_dysmsapi20170525 import models as dysmsapi_models

# 加载环境变量
load_dotenv()

class SMSService:
    def __init__(self):
        config = open_api_models.Config()
        config.access_key_id = os.getenv('ALIYUN_SMS_ACCESS_KEY_ID')
        config.access_key_secret = os.getenv('ALIYUN_SMS_ACCESS_KEY_SECRET')
        self.client = Client(config)

    def generate_code(self) -> str:
        """生成6位数字验证码"""
        return ''.join(random.choices('0123456789', k=6))

    async def send_verification_code(self, phone_number: str) -> tuple[bool, str]:
        """发送验证码
        Returns:
            tuple[bool, str]: (是否成功, 验证码或错误信息)
        """
        try:
            # 生成验证码
            code = self.generate_code()
            
            # 构建请求
            send_sms_request = dysmsapi_models.SendSmsRequest(
                phone_numbers=phone_number,
                sign_name=os.getenv('ALIYUN_SMS_SIGN_NAME'),
                template_code=os.getenv('ALIYUN_SMS_TEMPLATE_CODE'),
                template_param=os.getenv('ALIYUN_SMS_TEMPLATE_PARAM') % code
            )
            
            # 发送短信
            response = await self.client.send_sms_async(send_sms_request)
            
            if response.body.code == 'OK':
                return True, code
            else:
                return False, f"发送失败: {response.body.message}"
                
        except Exception as e:
            return False, f"发送异常: {str(e)}"

# 创建全局实例
sms_service = SMSService() 