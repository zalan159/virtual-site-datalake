from minio import Minio
from dotenv import load_dotenv
import os

# 加载.env文件
load_dotenv()

# MinIO客户端
minio_client = Minio(
    f"{os.getenv('MINIO_HOST')}:{os.getenv('MINIO_PORT')}",
    access_key=os.getenv('MINIO_USERNAME'),
    secret_key=os.getenv('MINIO_PASSWORD'),
    secure=False
)

# 定义存储桶名称
SOURCE_BUCKET_NAME = "sourece-files"  # 源文件存储桶
CONVERTED_BUCKET_NAME = "converted-files"  # 转换后文件存储桶
ATTACHMENT_BUCKET_NAME = "attachments"  # 附件存储桶

# 检查并创建MinIO bucket
def check_and_create_bucket():
    try:
        # 检查并创建源文件存储桶
        if not minio_client.bucket_exists(SOURCE_BUCKET_NAME):
            minio_client.make_bucket(SOURCE_BUCKET_NAME)
            print(f"MinIO bucket '{SOURCE_BUCKET_NAME}' 已创建")
        else:
            print(f"MinIO bucket '{SOURCE_BUCKET_NAME}' 已存在")
            
        # 检查并创建转换后文件存储桶
        if not minio_client.bucket_exists(CONVERTED_BUCKET_NAME):
            minio_client.make_bucket(CONVERTED_BUCKET_NAME)
            print(f"MinIO bucket '{CONVERTED_BUCKET_NAME}' 已创建")
        else:
            print(f"MinIO bucket '{CONVERTED_BUCKET_NAME}' 已存在")

        # 检查并创建附件存储桶
        if not minio_client.bucket_exists(ATTACHMENT_BUCKET_NAME):
            minio_client.make_bucket(ATTACHMENT_BUCKET_NAME)
            print(f"MinIO bucket '{ATTACHMENT_BUCKET_NAME}' 已创建")
        else:
            print(f"MinIO bucket '{ATTACHMENT_BUCKET_NAME}' 已存在")
    except Exception as e:
        print(f"创建MinIO bucket时出错: {str(e)}") 