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
    THREEDTILES_PROCESSING = "threedtiles_processing"  # 3DTiles处理

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
        self.is_running = False
        self.worker_task = None
        self.task_queue_key = "task_queue"

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
            task_dict = task.to_dict()
            task_data = json.dumps(task_dict)
            
            # 保存任务详情到Redis
            self.redis.redis_client.setex(
                task_key, 
                TASK_EXPIRE_TIME, 
                task_data
            )
            
            # 保存任务到MongoDB
            await self.db.tasks.insert_one(task_dict)
            
            # 将任务添加到Redis队列
            try:
                # 使用rpush添加到队列末尾
                # 注意：这里直接使用task_data确保队列中的任务数据与Redis中一致
                self.redis.redis_client.rpush(self.task_queue_key, task_data)
                print(f"任务 {task_id} 已添加到队列")
            except redis.exceptions.RedisError as e:
                print(f"添加任务到Redis队列失败: {str(e)}")
                # 这里我们继续执行，因为任务数据已经保存到Redis和MongoDB
            
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
            print(f"[DEBUG] 开始更新任务 {task_id}")
            print(f"[DEBUG] 更新参数: status={status}, progress={progress}, current_step={current_step}")
            if result:
                print(f"[DEBUG] 更新result参数: {result}")
                
            task = await self.get_task(task_id)
            if not task:
                print(f"[ERROR] 未找到任务: {task_id}")
                return None
            
            # 打印任务当前状态
            print(f"[DEBUG] 任务当前状态: {task.status}, 进度: {task.progress}")
            print(f"[DEBUG] 任务当前result: {task.result}")
            
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
                # 如果是要完全替换result
                if isinstance(result, dict) and not task.result:
                    task.result = result
                # 如果是要更新已有result
                elif isinstance(result, dict) and isinstance(task.result, dict):
                    task.result.update(result)
                else:
                    task.result = result
            
            task.updated_at = datetime.now()
            
            # 打印更新后的状态
            print(f"[DEBUG] 更新后的任务状态: {task.status}, 进度: {task.progress}")
            print(f"[DEBUG] 更新后的任务result: {task.result}")
            
            # 更新Redis和数据库
            task_key = self._get_task_key(task_id)
            task_dict = task.to_dict()
            task_json = json.dumps(task_dict)
            
            print(f"[DEBUG] 将更新写入Redis，键: {task_key}")
            self.redis.redis_client.setex(
                task_key, 
                TASK_EXPIRE_TIME, 
                task_json
            )
            
            print(f"[DEBUG] 将更新写入MongoDB")
            await self.db.tasks.update_one(
                {"task_id": task_id},
                {"$set": task_dict}
            )
            
            print(f"[DEBUG] 任务 {task_id} 更新完成")
            return task
        except redis.exceptions.RedisError as e:
            # Redis错误时，只更新数据库
            print(f"[ERROR] Redis错误: {str(e)}")
            if task:
                await self.db.tasks.update_one(
                    {"task_id": task_id},
                    {"$set": task.to_dict()}
                )
            raise TaskError(f"Redis错误: {str(e)}")
        except Exception as e:
            print(f"[ERROR] 更新任务失败: {str(e)}")
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
        """处理队列中的任务"""
        while self.is_running:
            try:
                # 采用非阻塞方式检查任务队列
                # 使用lpop而不是blpop，避免阻塞主线程
                task_data = self.redis.redis_client.lpop(self.task_queue_key)
                
                if not task_data:
                    # 队列为空，等待5秒后再检查
                    await asyncio.sleep(5)
                    continue
                
                # 解析任务数据
                try:
                    print(f"[INFO] 从队列获取到新任务，开始处理...")
                    task_dict = json.loads(task_data)
                    queue_task = Task.from_dict(task_dict)
                    
                    # 重要：从Redis或数据库获取完整的任务数据
                    # 而不是直接使用队列中可能不完整的数据
                    print(f"[DEBUG] 从队列获取任务ID: {queue_task.task_id}，正在获取完整任务数据")
                    task = await self.get_task(queue_task.task_id)
                    
                    if not task:
                        print(f"[ERROR] 无法获取完整任务数据，ID: {queue_task.task_id}")
                        continue
                    
                    print(f"开始处理任务: {task.task_id}, 类型: {task.task_type}")
                    print(f"[DEBUG] 完整任务数据: result={task.result}")
                    
                    # 使用create_task创建新协程，不等待完成
                    # 这样可以避免阻塞主事件循环
                    if task.task_type == TaskType.FILE_CONVERSION:
                        print(f"[INFO] 创建文件转换任务协程，任务ID: {task.task_id}")
                        asyncio.create_task(
                            self._process_file_conversion_task(task)
                        )
                    elif task.task_type == TaskType.THREEDTILES_PROCESSING:
                        print(f"[INFO] 创建3DTiles处理任务协程，任务ID: {task.task_id}")
                        asyncio.create_task(
                            self._process_threedtiles_task(task)
                        )
                    else:
                        print(f"未知任务类型: {task.task_type}")
                    
                    # 主循环继续检查下一个任务，不等待当前任务完成
                    await asyncio.sleep(0.1)  # 短暂休眠，让出CPU给其他协程
                        
                except json.JSONDecodeError as e:
                    print(f"JSON解析错误: {str(e)}, 原始数据: {task_data}")
                    continue
                    
            except redis.exceptions.RedisError as e:
                # Redis连接错误，输出日志并等待一段时间
                print(f"Redis错误: {str(e)}")
                await asyncio.sleep(5)
            except Exception as e:
                # 其他错误
                print(f"处理任务队列时出错: {str(e)}")
                import traceback
                traceback.print_exc()
                # 等待一段时间后继续
                await asyncio.sleep(5)

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

    async def _process_threedtiles_task(self, task: Task):
        """处理3DTiles任务"""
        try:
            # 打印原始任务信息
            print(f"[DEBUG] 任务管理器开始处理3DTiles任务，任务ID: {task.task_id}")
            print(f"[DEBUG] 任务信息: 类型={task.task_type}, 状态={task.status}, 进度={task.progress}")
            print(f"[DEBUG] 任务结果数据: {task.result}")
            
            # 更新任务状态为处理中
            await self.update_task(
                task.task_id,
                status=TaskStatus.PROCESSING,
                current_step=ConversionStep.DOWNLOADING,
                progress=10
            )
            
            # 更新进度
            await self.update_task(
                task.task_id,
                progress=30,
                current_step=ConversionStep.CONVERTING
            )
            
            # 检查任务是否包含必要的数据
            if not task.result.get("object_id") or not task.result.get("filename"):
                error_msg = "任务缺少必要数据: object_id 或 filename"
                print(f"[ERROR] {error_msg}")
                await self.update_task(
                    task.task_id, 
                    status=TaskStatus.FAILED,
                    error_message=error_msg
                )
                return
                
            if task.result.get("threedtiles_data") is None:
                error_msg = "任务缺少必要数据: threedtiles_data"
                print(f"[ERROR] {error_msg}")
                await self.update_task(
                    task.task_id, 
                    status=TaskStatus.FAILED,
                    error_message=error_msg
                )
                return
            
            # 使用3DTiles处理器处理任务
            from app.tasks.threedtiles_processor import ThreeDTilesProcessor
            print(f"[DEBUG] 调用ThreeDTilesProcessor.process_threedtiles处理任务")
            success, error_message, result = await ThreeDTilesProcessor.process_threedtiles(task, self.db)
            
            if success:
                # 更新任务状态为完成
                print(f"[DEBUG] 任务处理成功，result: {result}")
                
                # 确保结果数据中包含原始任务数据和新的处理结果
                updated_result = task.result.copy() if task.result else {}
                if result:
                    updated_result.update(result)
                    # 确保tile_id存在于任务结果中，这对前端显示很重要
                    if "tile_id" in result:
                        print(f"[DEBUG] 任务结果包含tile_id: {result['tile_id']}")
                
                await self.update_task(
                    task.task_id,
                    status=TaskStatus.COMPLETED,
                    progress=100,
                    current_step=ConversionStep.COMPLETED,
                    result=updated_result
                )
            else:
                # 更新任务状态为失败
                print(f"[ERROR] 任务处理失败，错误信息: {error_message}")
                await self.update_task(
                    task.task_id,
                    status=TaskStatus.FAILED,
                    error_message=error_message
                )
        except Exception as e:
            # 更新任务状态为失败
            import traceback
            error_detail = f"{str(e)}\n{traceback.format_exc()}"
            print(f"[ERROR] 处理3DTiles任务失败: {error_detail}")
            
            await self.update_task(
                task.task_id,
                status=TaskStatus.FAILED,
                error_message=str(e)
            ) 