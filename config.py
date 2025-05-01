import yaml
import os

# 加载YAML配置文件
def load_config():
    config_path = os.path.join(os.path.dirname(__file__), 'config.yaml')
    with open(config_path, 'r', encoding='utf-8') as f:
        return yaml.safe_load(f)

# 加载配置
config = load_config()

# 导出配置变量
MONGO_CONFIG = config['mongo']
MINIO_CONFIG = config['minio']
REDIS_CONFIG = config['redis']
ALIYUN_SMS_CONFIG = config['aliyun_sms']
JWT_CONFIG = config['jwt']
FILE_FORMATS = config['file_formats']
CONVERTER_CONFIG = config['converter']

# 数据库连接 URL
MONGO_URL = f"mongodb://{MONGO_CONFIG['username']}:{MONGO_CONFIG['password']}@{MONGO_CONFIG['host']}:{MONGO_CONFIG['port']}/{MONGO_CONFIG['db_name']}?authSource=admin"

# 获取所有支持的文件扩展名
def get_all_supported_extensions():
    extensions = []
    for file_format in FILE_FORMATS:
        extensions.extend(file_format['extensions'])
    return extensions 