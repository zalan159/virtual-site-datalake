import asyncio
import uuid
from datetime import datetime, timedelta
from enum import Enum
from typing import Dict, Optional, List, Callable, Any
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorClient
import os
import json
import redis.exceptions
from dotenv import load_dotenv

from app.core.minio_client import minio_client
from app.utils.redis import RedisService
from app.utils.mongo_init import get_mongo_url
from app.models.file import ConversionStatus, FileConversion

# 加载 .env 文件
load_dotenv()

# 动态生成 MONGO_URL
MONGO_USERNAME = os.getenv("MONGO_USERNAME", "admin")
MONGO_PASSWORD = os.getenv("MONGO_PASSWORD", "admin123")
MONGO_HOST = os.getenv("MONGO_HOST", "localhost")
MONGO_PORT = os.getenv("MONGO_PORT", "27017")
MONGO_DB_NAME = os.getenv("MONGO_DB_NAME", "virtualsite")
MONGO_URL = get_mongo_url()

# 转换程序配置
CONVERTER_CONFIG = {
    "path": os.getenv("CONVERTER_PATH", ""),
    "program_name": os.getenv("CONVERTER_PROGRAM_NAME", ""),
    "default_output_format": os.getenv("CONVERTER_DEFAULT_OUTPUT_FORMAT", "GLB"),
}

# 定义任务状态枚举
class TaskStatus(str, Enum):
    PENDING = "pending"  # 等待处理
    PROCESSING = "processing"  # 处理中
    COMPLETED = "completed"  # 已完成
    FAILED = "failed"  # 失败

# 定义转换步骤枚举
class ConversionStep(str, Enum):
    INITIALIZED = "initialized"  # 初始化
    DOWNLOADING = "downloading"  # 下载文件
    CONVERTING = "converting"  # 转换文件
    UPLOADING = "uploading"  # 上传转换后的文件
    COMPLETED = "completed"  # 完成

# 定义任务类型枚举
class TaskType(str, Enum):
    FILE_CONVERSION = "file_conversion"  # 文件转换

# 任务过期时间（秒）
TASK_EXPIRE_TIME = 7 * 24 * 60 * 60  # 7天

class TaskError(Exception):
    """任务相关错误"""
    pass

class Task:
    def __init__(
        self,
        task_id: str,
        task_type: TaskType,
        user_id: str,
        file_id: str,
        input_file_path: str,
        output_format: str,
        status: TaskStatus = TaskStatus.PENDING,
        progress: int = 0,
        current_step: ConversionStep = ConversionStep.INITIALIZED,
        error_message: Optional[str] = None,
        result: Optional[Dict] = None,
        created_at: datetime = None,
        updated_at: datetime = None
    ):
        self.task_id = task_id
        self.task_type = task_type
        self.user_id = user_id
        self.file_id = file_id
        self.input_file_path = input_file_path
        self.output_format = output_format
        self.status = status
        self.progress = progress
        self.current_step = current_step
        self.error_message = error_message
        self.result = result or {}
        self.created_at = created_at or datetime.now()
        self.updated_at = updated_at or datetime.now()

    def to_dict(self) -> Dict:
        """将任务转换为字典格式"""
        return {
            "task_id": self.task_id,
            "task_type": self.task_type,
            "user_id": self.user_id,
            "file_id": self.file_id,
            "input_file_path": self.input_file_path,
            "output_format": self.output_format,
            "status": self.status,
            "progress": self.progress,
            "current_step": self.current_step,
            "error_message": self.error_message,
            "result": self.result,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat()
        }

    @classmethod
    def from_dict(cls, data: Dict) -> 'Task':
        """从字典创建任务对象"""
        # 处理日期时间字段
        created_at = None
        updated_at = None
        
        if data.get("created_at"):
            if isinstance(data["created_at"], str):
                created_at = datetime.fromisoformat(data["created_at"])
            elif isinstance(data["created_at"], datetime):
                created_at = data["created_at"]
                
        if data.get("updated_at"):
            if isinstance(data["updated_at"], str):
                updated_at = datetime.fromisoformat(data["updated_at"])
            elif isinstance(data["updated_at"], datetime):
                updated_at = data["updated_at"]
        
        return cls(
            task_id=data.get("task_id"),
            task_type=data.get("task_type"),
            user_id=data.get("user_id"),
            file_id=data.get("file_id"),
            input_file_path=data.get("input_file_path"),
            output_format=data.get("output_format"),
            status=data.get("status"),
            progress=data.get("progress", 0),
            current_step=data.get("current_step"),
            error_message=data.get("error_message"),
            result=data.get("result"),
            created_at=created_at,
            updated_at=updated_at
        )

class TaskManager:
    def __init__(self):
        self.db = AsyncIOMotorClient(MONGO_URL).get_database()
        self.redis = RedisService()
        self.task_queue = asyncio.Queue()
        self.is_running = False
        self.worker_task = None

    async def start(self):
        """启动任务管理器"""
        if not self.is_running:
            self.is_running = True
            self.worker_task = asyncio.create_task(self._process_tasks())
            print("任务管理器已启动")

    async def stop(self):
        """停止任务管理器"""
        if self.is_running:
            self.is_running = False
            if self.worker_task:
                self.worker_task.cancel()
                try:
                    await self.worker_task
                except asyncio.CancelledError:
                    pass
            print("任务管理器已停止")

    def _get_task_key(self, task_id: str) -> str:
        """获取任务在Redis中的键名"""
        return f"task:{task_id}"

    async def create_task(
        self,
        task_type: TaskType,
        user_id: str,
        file_id: str,
        input_file_path: str,
        output_format: str
    ) -> Task:
        """创建新任务"""
        try:
            task_id = str(uuid.uuid4())
            task = Task(
                task_id=task_id,
                task_type=task_type,
                user_id=user_id,
                file_id=file_id,
                input_file_path=input_file_path,
                output_format=output_format
            )
            
            # 保存任务到Redis和数据库
            task_key = self._get_task_key(task_id)
            self.redis.redis_client.setex(
                task_key, 
                TASK_EXPIRE_TIME, 
                json.dumps(task.to_dict())
            )
            await self.db.tasks.insert_one(task.to_dict())
            
            # 将任务添加到队列
            await self.task_queue.put(task)
            
            return task
        except redis.exceptions.RedisError as e:
            raise TaskError(f"Redis错误: {str(e)}")
        except Exception as e:
            raise TaskError(f"创建任务失败: {str(e)}")

    async def get_task(self, task_id: str) -> Optional[Task]:
        """获取任务"""
        try:
            # 从Redis获取
            task_key = self._get_task_key(task_id)
            task_data = self.redis.redis_client.get(task_key)
            
            if task_data:
                return Task.from_dict(json.loads(task_data))
            
            # 如果Redis中没有，从数据库获取
            task_data = await self.db.tasks.find_one({"task_id": task_id})
            if task_data:
                task = Task.from_dict(task_data)
                # 保存到Redis
                self.redis.redis_client.setex(
                    task_key, 
                    TASK_EXPIRE_TIME, 
                    json.dumps(task.to_dict())
                )
                return task
            
            return None
        except redis.exceptions.RedisError as e:
            # Redis错误时，尝试从数据库获取
            task_data = await self.db.tasks.find_one({"task_id": task_id})
            if task_data:
                return Task.from_dict(task_data)
            raise TaskError(f"Redis错误: {str(e)}")
        except Exception as e:
            raise TaskError(f"获取任务失败: {str(e)}")

    async def update_task(
        self,
        task_id: str,
        status: Optional[TaskStatus] = None,
        progress: Optional[int] = None,
        current_step: Optional[ConversionStep] = None,
        error_message: Optional[str] = None,
        result: Optional[Dict] = None
    ) -> Optional[Task]:
        """更新任务状态"""
        try:
            task = await self.get_task(task_id)
            if not task:
                return None
            
            # 更新任务属性
            if status is not None:
                task.status = status
            if progress is not None:
                task.progress = progress
            if current_step is not None:
                task.current_step = current_step
            if error_message is not None:
                task.error_message = error_message
            if result is not None:
                task.result.update(result)
            
            task.updated_at = datetime.now()
            
            # 更新Redis和数据库
            task_key = self._get_task_key(task_id)
            self.redis.redis_client.setex(
                task_key, 
                TASK_EXPIRE_TIME, 
                json.dumps(task.to_dict())
            )
            await self.db.tasks.update_one(
                {"task_id": task_id},
                {"$set": task.to_dict()}
            )
            
            return task
        except redis.exceptions.RedisError as e:
            # Redis错误时，只更新数据库
            if task:
                await self.db.tasks.update_one(
                    {"task_id": task_id},
                    {"$set": task.to_dict()}
                )
            raise TaskError(f"Redis错误: {str(e)}")
        except Exception as e:
            raise TaskError(f"更新任务失败: {str(e)}")

    async def delete_task(self, task_id: str) -> bool:
        """删除任务"""
        try:
            # 从Redis删除
            task_key = self._get_task_key(task_id)
            self.redis.redis_client.delete(task_key)
            
            # 从数据库删除
            result = await self.db.tasks.delete_one({"task_id": task_id})
            
            return result.deleted_count > 0
        except redis.exceptions.RedisError as e:
            # Redis错误时，只删除数据库中的任务
            result = await self.db.tasks.delete_one({"task_id": task_id})
            raise TaskError(f"Redis错误: {str(e)}")
        except Exception as e:
            raise TaskError(f"删除任务失败: {str(e)}")

    async def get_user_tasks(self, user_id: str) -> List[Task]:
        """获取用户的所有任务"""
        try:
            # 从数据库获取所有任务
            task_data_list = await self.db.tasks.find({"user_id": user_id}).to_list(length=None)
            tasks = []
            
            for task_data in task_data_list:
                # 确保日期时间字段格式正确
                if "created_at" in task_data and isinstance(task_data["created_at"], datetime):
                    task_data["created_at"] = task_data["created_at"].isoformat()
                if "updated_at" in task_data and isinstance(task_data["updated_at"], datetime):
                    task_data["updated_at"] = task_data["updated_at"].isoformat()
                
                task = Task.from_dict(task_data)
                # 更新Redis缓存
                task_key = self._get_task_key(task.task_id)
                self.redis.redis_client.setex(
                    task_key, 
                    TASK_EXPIRE_TIME, 
                    json.dumps(task.to_dict())
                )
                tasks.append(task)
                
            return tasks
        except redis.exceptions.RedisError as e:
            # Redis错误时，只返回数据库中的任务
            task_data_list = await self.db.tasks.find({"user_id": user_id}).to_list(length=None)
            return [Task.from_dict(task_data) for task_data in task_data_list]
        except Exception as e:
            raise TaskError(f"获取用户任务失败: {str(e)}")

    async def _process_tasks(self):
        """处理任务队列中的任务"""
        while self.is_running:
            try:
                # 从队列中获取任务
                task = await self.task_queue.get()
                
                # 根据任务类型处理任务
                if task.task_type == TaskType.FILE_CONVERSION:
                    await self._process_file_conversion_task(task)
                
                # 标记任务已完成
                self.task_queue.task_done()
            except asyncio.CancelledError:
                break
            except Exception as e:
                print(f"处理任务时出错: {str(e)}")
                if task:
                    await self.update_task(
                        task.task_id,
                        status=TaskStatus.FAILED,
                        error_message=str(e)
                    )

    async def _process_file_conversion_task(self, task: Task):
        """处理文件转换任务"""
        try:
            # 更新任务状态为处理中
            await self.update_task(
                task.task_id,
                status=TaskStatus.PROCESSING,
                current_step=ConversionStep.DOWNLOADING,
                progress=10
            )
            
            # 更新任务状态为转换中
            await self.update_task(
                task.task_id,
                current_step=ConversionStep.CONVERTING,
                progress=30
            )
            
            # 更新任务状态为上传中
            await self.update_task(
                task.task_id,
                current_step=ConversionStep.UPLOADING,
                progress=70
            )
            
            # 使用文件转换器转换文件
            from app.tasks.file_converter import FileConverter
            success, error_message, output_file_path = await FileConverter.convert_file(task)
            
            if success:
                # 更新任务状态为完成
                await self.update_task(
                    task.task_id,
                    status=TaskStatus.COMPLETED,
                    current_step=ConversionStep.COMPLETED,
                    progress=100,
                    result={"output_file_path": output_file_path}
                )
                
                # 更新文件元数据
                await self._update_file_metadata(task, output_file_path)
            else:
                # 更新任务状态为失败
                await self.update_task(
                    task.task_id,
                    status=TaskStatus.FAILED,
                    error_message=error_message
                )
            
        except Exception as e:
            # 更新任务状态为失败
            await self.update_task(
                task.task_id,
                status=TaskStatus.FAILED,
                error_message=str(e)
            )
            raise e
            
    async def _update_file_metadata(self, task: Task, output_file_path: str):
        """更新文件元数据"""
        from app.models.file import ConversionStatus, FileConversion
        
        # 获取文件元数据
        file_metadata = await self.db.files.find_one({"_id": ObjectId(task.file_id)})
        if not file_metadata:
            return
        
        # 更新转换信息
        conversion = FileConversion(
            status=ConversionStatus.COMPLETED,
            input_format=os.path.splitext(file_metadata["file_path"])[1][1:].upper(),
            output_format=task.output_format,
            input_file_path=file_metadata["file_path"],
            output_file_path=output_file_path,
            task_id=task.task_id,
            progress=100,
            created_at=task.created_at,
            updated_at=datetime.now()
        )
        
        # 更新数据库
        await self.db.files.update_one(
            {"_id": ObjectId(task.file_id)},
            {"$set": {"conversion": conversion.dict()}}
        ) 