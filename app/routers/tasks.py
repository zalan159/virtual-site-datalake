from fastapi import APIRouter, Depends, HTTPException, status
from typing import List, Optional
from datetime import datetime
from bson import ObjectId

from app.models.user import UserInDB
from app.auth.utils import get_current_active_user
from app.tasks.task_manager import TaskManager, TaskType, TaskStatus, ConversionStep, TaskError

router = APIRouter()

@router.get("/list", response_model=List[dict])
async def list_tasks(
    status: Optional[TaskStatus] = None,
    task_type: Optional[TaskType] = None,
    current_user: UserInDB = Depends(get_current_active_user)
):
    """
    获取当前用户的任务列表
    
    - **status**: 任务状态过滤（可选）
    - **task_type**: 任务类型过滤（可选）
    - **current_user**: 当前登录用户（自动获取）
    """
    try:
        # 创建任务管理器实例
        task_manager = TaskManager()
        
        # 获取用户的所有任务
        tasks = await task_manager.get_user_tasks(str(current_user.id))
        
        # 根据状态和类型过滤任务
        filtered_tasks = []
        for task in tasks:
            if status and task.status != status:
                continue
            if task_type and task.task_type != task_type:
                continue
            filtered_tasks.append(task.to_dict())
        
        return filtered_tasks
    except TaskError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取任务列表失败: {str(e)}")

@router.delete("/{task_id}")
async def delete_task(
    task_id: str,
    current_user: UserInDB = Depends(get_current_active_user)
):
    """
    删除任务
    
    - **task_id**: 任务ID
    - **current_user**: 当前登录用户（自动获取）
    """
    try:
        # 创建任务管理器实例
        task_manager = TaskManager()
        
        # 获取任务
        task = await task_manager.get_task(task_id)
        
        if not task:
            raise HTTPException(status_code=404, detail="任务不存在")
        
        # 检查权限
        if task.user_id != str(current_user.id) and current_user.role != "admin":
            raise HTTPException(status_code=403, detail="没有权限删除此任务")
        
        # 删除任务
        await task_manager.delete_task(task_id)
        
        return {"message": "任务已删除"}
    except HTTPException:
        raise
    except TaskError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"删除任务失败: {str(e)}") 