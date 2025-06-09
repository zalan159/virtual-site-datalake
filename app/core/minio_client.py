from minio import Minio
from dotenv import load_dotenv
import os
import json

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
PREVIEW_BUCKET_NAME = "preview"
PUBLIC_MODEL_BUCKET_NAME = "public-models"  # 公共模型存储桶
THREEDTILES_BUCKET_NAME = "threedtiles"  # 3DTiles存储桶
CHART_PREVIEWS_BUCKET_NAME = "chart-previews"  # 图表预览图存储桶
GOVIEW_FILES_BUCKET_NAME = "goview-files"  # GoView文件存储桶

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

        # 检查并创建预览图存储桶
        if not minio_client.bucket_exists(PREVIEW_BUCKET_NAME):
            minio_client.make_bucket(PREVIEW_BUCKET_NAME)
            print(f"MinIO bucket '{PREVIEW_BUCKET_NAME}' 已创建")
        else:
            print(f"MinIO bucket '{PREVIEW_BUCKET_NAME}' 已存在")

        # 检查并创建公共模型存储桶
        if not minio_client.bucket_exists(PUBLIC_MODEL_BUCKET_NAME):
            minio_client.make_bucket(PUBLIC_MODEL_BUCKET_NAME)
            print(f"MinIO bucket '{PUBLIC_MODEL_BUCKET_NAME}' 已创建")
        else:
            print(f"MinIO bucket '{PUBLIC_MODEL_BUCKET_NAME}' 已存在")
            
        # 检查并创建3DTiles存储桶
        if not minio_client.bucket_exists(THREEDTILES_BUCKET_NAME):
            minio_client.make_bucket(THREEDTILES_BUCKET_NAME)
            print(f"MinIO bucket '{THREEDTILES_BUCKET_NAME}' 已创建")
        else:
            print(f"MinIO bucket '{THREEDTILES_BUCKET_NAME}' 已存在")

        # 检查并创建图表预览图存储桶
        if not minio_client.bucket_exists(CHART_PREVIEWS_BUCKET_NAME):
            minio_client.make_bucket(CHART_PREVIEWS_BUCKET_NAME)
            print(f"MinIO bucket '{CHART_PREVIEWS_BUCKET_NAME}' 已创建")
        else:
            print(f"MinIO bucket '{CHART_PREVIEWS_BUCKET_NAME}' 已存在")

        # 检查并创建GoView文件存储桶
        if not minio_client.bucket_exists(GOVIEW_FILES_BUCKET_NAME):
            minio_client.make_bucket(GOVIEW_FILES_BUCKET_NAME)
            print(f"MinIO bucket '{GOVIEW_FILES_BUCKET_NAME}' 已创建")
        else:
            print(f"MinIO bucket '{GOVIEW_FILES_BUCKET_NAME}' 已存在")

        # 设置scene-preview桶为公开
        policy_readonly = {
            "Version": "2012-10-17",
            "Statement": [
                {
                    "Effect": "Allow",
                    "Principal": {"AWS": ["*"]},
                    "Action": ["s3:GetObject"],
                    "Resource": [f"arn:aws:s3:::{PREVIEW_BUCKET_NAME}/*"]
                }
            ]
        }
        minio_client.set_bucket_policy(PREVIEW_BUCKET_NAME, json.dumps(policy_readonly))
        print(f"MinIO bucket '{PREVIEW_BUCKET_NAME}' 已设置为公开")

        # 设置 public-models 桶为公开
        policy_readonly_public = {
            "Version": "2012-10-17",
            "Statement": [
                {
                    "Effect": "Allow",
                    "Principal": {"AWS": ["*"]},
                    "Action": ["s3:GetObject"],
                    "Resource": [f"arn:aws:s3:::{PUBLIC_MODEL_BUCKET_NAME}/*"]
                }
            ]
        }
        minio_client.set_bucket_policy(PUBLIC_MODEL_BUCKET_NAME, json.dumps(policy_readonly_public))
        print(f"MinIO bucket '{PUBLIC_MODEL_BUCKET_NAME}' 已设置为公开")
        
        # 设置 threedtiles 桶为公开
        policy_readonly_threedtiles = {
            "Version": "2012-10-17",
            "Statement": [
                {
                    "Effect": "Allow",
                    "Principal": {"AWS": ["*"]},
                    "Action": ["s3:GetObject"],
                    "Resource": [f"arn:aws:s3:::{THREEDTILES_BUCKET_NAME}/*"]
                }
            ]
        }
        minio_client.set_bucket_policy(THREEDTILES_BUCKET_NAME, json.dumps(policy_readonly_threedtiles))
        print(f"MinIO bucket '{THREEDTILES_BUCKET_NAME}' 已设置为公开")
        
        # 设置 chart-previews 桶为公开
        policy_readonly_chart_previews = {
            "Version": "2012-10-17",
            "Statement": [
                {
                    "Effect": "Allow",
                    "Principal": {"AWS": ["*"]},
                    "Action": ["s3:GetObject"],
                    "Resource": [f"arn:aws:s3:::{CHART_PREVIEWS_BUCKET_NAME}/*"]
                }
            ]
        }
        minio_client.set_bucket_policy(CHART_PREVIEWS_BUCKET_NAME, json.dumps(policy_readonly_chart_previews))
        print(f"MinIO bucket '{CHART_PREVIEWS_BUCKET_NAME}' 已设置为公开")
        
        # 设置 goview-files 桶为公开
        policy_readonly_goview_files = {
            "Version": "2012-10-17",
            "Statement": [
                {
                    "Effect": "Allow",
                    "Principal": {"AWS": ["*"]},
                    "Action": ["s3:GetObject"],
                    "Resource": [f"arn:aws:s3:::{GOVIEW_FILES_BUCKET_NAME}/*"]
                }
            ]
        }
        minio_client.set_bucket_policy(GOVIEW_FILES_BUCKET_NAME, json.dumps(policy_readonly_goview_files))
        print(f"MinIO bucket '{GOVIEW_FILES_BUCKET_NAME}' 已设置为公开")
    except Exception as e:
        print(f"创建MinIO bucket时出错: {str(e)}")


class MinioClient:
    """MinIO客户端包装类"""
    
    def __init__(self):
        self.client = minio_client
    
    def upload_file_data(self, bucket_name: str, object_name: str, file_data: bytes, content_type: str = None) -> str:
        """上传文件数据到MinIO并返回文件URL"""
        from io import BytesIO
        
        # 确保bucket存在
        if not self.client.bucket_exists(bucket_name):
            self.client.make_bucket(bucket_name)
        
        # 上传文件
        self.client.put_object(
            bucket_name=bucket_name,
            object_name=object_name,
            data=BytesIO(file_data),
            length=len(file_data),
            content_type=content_type
        )
        
        # 返回文件URL
        return f"http://{os.getenv('MINIO_HOST')}:{os.getenv('MINIO_PORT')}/{bucket_name}/{object_name}"
    
    def remove_object(self, bucket_name: str, object_name: str):
        """删除对象"""
        try:
            self.client.remove_object(bucket_name, object_name)
        except Exception as e:
            print(f"删除对象失败: {str(e)}")
    
    def get_object_url(self, bucket_name: str, object_name: str) -> str:
        """获取对象URL"""
        return f"http://{os.getenv('MINIO_HOST')}:{os.getenv('MINIO_PORT')}/{bucket_name}/{object_name}" 