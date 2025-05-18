from fastapi import APIRouter, Depends, HTTPException, status, Query
from typing import List, Optional, Dict, Any
from datetime import datetime
from bson import ObjectId
from enum import Enum
import json

from app.models.user import UserInDB
from app.auth.utils import get_current_active_user, db
from app.tasks.task_manager import TaskManager, TaskType, TaskStatus, ConversionStep
from app.services.threedtiles_service import ThreeDTilesService

router = APIRouter(
    tags=["任务管理"]
)

class TaskTypeQuery(str, Enum):
    """任务类型查询枚举，用于URL查询参数"""
    FILE_CONVERSION = "file_conversion"  
    THREEDTILES_PROCESSING = "threedtiles_processing"

class TaskStatusQuery(str, Enum):
    """任务状态查询枚举，用于URL查询参数"""
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"

# 添加一个工具函数来处理ObjectId
def handle_object_id(obj: Dict[str, Any]) -> Dict[str, Any]:
    """
    递归处理字典中的ObjectId，将其转换为字符串
    """
    if isinstance(obj, dict):
        for key, value in list(obj.items()):
            if isinstance(value, ObjectId):
                obj[key] = str(value)
            elif isinstance(value, dict):
                obj[key] = handle_object_id(value)
            elif isinstance(value, list):
                obj[key] = [handle_object_id(item) if isinstance(item, (dict, list)) else
                           str(item) if isinstance(item, ObjectId) else item
                           for item in value]
    return obj

@router.get("/list", response_model=List[dict])
async def list_tasks(
    status: Optional[TaskStatusQuery] = None,
    task_type: Optional[TaskTypeQuery] = None,
    current_user: UserInDB = Depends(get_current_active_user)
):
    """
    获取当前用户的所有任务
    
    - **status**: 可选的状态过滤
    - **task_type**: 可选的任务类型过滤
    - **current_user**: 当前登录用户
    """
    try:
        query = {"user_id": str(current_user.id)}
        
        if status:
            query["status"] = status
        
        if task_type:
            query["task_type"] = task_type
        
        tasks_cursor = db.tasks.find(query)
        tasks = await tasks_cursor.to_list(length=None)
        
        # 格式化日期时间字段并处理ObjectId
        for task in tasks:
            # 处理ObjectId
            task = handle_object_id(task)
            
            # 处理日期时间
            if "created_at" in task and isinstance(task["created_at"], datetime):
                task["created_at"] = task["created_at"].isoformat()
            if "updated_at" in task and isinstance(task["updated_at"], datetime):
                task["updated_at"] = task["updated_at"].isoformat()
                
            # 如果是threedtiles任务，添加额外的处理信息
            if task.get("task_type") == TaskType.THREEDTILES_PROCESSING and task.get("result"):
                # 确保结果数据中包含必要的信息
                if not task.get("resource_name") and task["result"].get("filename"):
                    task["resource_name"] = task["result"].get("filename")
                    
                # 添加处理状态信息
                task["process_status"] = {
                    "status": task.get("status"),
                    "message": task.get("error_message", ""),
                }
                
                # 如果任务完成且包含tile_id，添加到状态中
                if task.get("status") == TaskStatus.COMPLETED and task["result"].get("tile_id"):
                    task["process_status"]["tile_id"] = task["result"]["tile_id"]
        
        return tasks
    except Exception as e:
        import traceback
        print(f"获取任务列表失败: {str(e)}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"获取任务列表失败: {str(e)}")

@router.get("/{task_id}", response_model=dict)
async def get_task(
    task_id: str,
    current_user: UserInDB = Depends(get_current_active_user)
):
    """
    获取特定任务的详情
    
    - **task_id**: 任务ID
    - **current_user**: 当前登录用户
    """
    try:
        # 获取任务
        task_manager = TaskManager()
        task = await task_manager.get_task(task_id)
        
        if not task:
            raise HTTPException(status_code=404, detail="任务不存在")
        
        # 检查权限
        if task.user_id != str(current_user.id) and current_user.role != "admin":
            raise HTTPException(status_code=403, detail="没有权限查看此任务")
        
        task_dict = task.to_dict()
        
        # 处理ObjectId
        task_dict = handle_object_id(task_dict)
        
        # 如果是threedtiles任务，添加额外的处理信息
        if task.task_type == TaskType.THREEDTILES_PROCESSING and task.result:
            # 确保结果数据中包含必要的信息
            if not task_dict.get("resource_name") and task.result.get("filename"):
                task_dict["resource_name"] = task.result.get("filename")
                
            # 添加处理状态信息
            task_dict["process_status"] = {
                "status": task.status,
                "message": task.error_message or "",
            }
            
            # 如果任务完成且包含tile_id，添加到状态中
            if task.status == TaskStatus.COMPLETED and task.result.get("tile_id"):
                task_dict["process_status"]["tile_id"] = task.result["tile_id"]
        
        return task_dict
    except Exception as e:
        import traceback
        print(f"获取任务失败: {str(e)}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"获取任务失败: {str(e)}")

@router.delete("/{task_id}", response_model=dict)
async def delete_task(
    task_id: str,
    current_user: UserInDB = Depends(get_current_active_user)
):
    """
    删除任务
    
    - **task_id**: 任务ID
    - **current_user**: 当前登录用户
    """
    try:
        # 获取任务
        task_manager = TaskManager()
        task = await task_manager.get_task(task_id)
        
        if not task:
            raise HTTPException(status_code=404, detail="任务不存在")
        
        # 检查权限
        if task.user_id != str(current_user.id) and current_user.role != "admin":
            raise HTTPException(status_code=403, detail="没有权限删除此任务")
        
        # 删除任务
        deleted = await task_manager.delete_task(task_id)
        
        if not deleted:
            raise HTTPException(status_code=500, detail="删除任务失败")
        
        return {"message": "任务已删除"}
    except Exception as e:
        import traceback
        print(f"删除任务失败: {str(e)}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"删除任务失败: {str(e)}")

@router.get("/status/{task_id}", response_model=dict)
async def get_task_status(
    task_id: str,
    current_user: UserInDB = Depends(get_current_active_user)
):
    """
    获取任务状态
    
    - **task_id**: 任务ID
    - **current_user**: 当前登录用户
    """
    try:
        # 获取任务
        task_manager = TaskManager()
        task = await task_manager.get_task(task_id)
        
        if not task:
            raise HTTPException(status_code=404, detail="任务不存在")
        
        # 检查权限
        if task.user_id != str(current_user.id) and current_user.role != "admin":
            raise HTTPException(status_code=403, detail="没有权限查看此任务")
        
        result = {
            "task_id": task.task_id,
            "status": task.status,
            "progress": task.progress,
            "current_step": task.current_step,
            "error_message": task.error_message,
        }
        
        # 添加结果数据，如果有的话
        if task.result:
            result["result"] = handle_object_id(task.result)
            
            # 对于threedtiles任务，添加额外的处理信息
            if task.task_type == TaskType.THREEDTILES_PROCESSING:
                result["process_status"] = {
                    "status": task.status,
                    "message": task.error_message or "",
                }
                
                # 如果任务完成且包含tile_id，添加到状态中
                if task.status == TaskStatus.COMPLETED and task.result.get("tile_id"):
                    result["process_status"]["tile_id"] = str(task.result["tile_id"])
                    
                # 添加资源名称，如果有的话
                if task.result.get("filename"):
                    result["resource_name"] = task.result["filename"]
        
        return result
    except Exception as e:
        import traceback
        print(f"获取任务状态失败: {str(e)}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"获取任务状态失败: {str(e)}") 