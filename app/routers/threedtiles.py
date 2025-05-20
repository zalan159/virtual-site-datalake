from typing import List
from fastapi import APIRouter, Depends, File, UploadFile, Form, Query, HTTPException, status
from fastapi.responses import JSONResponse
from pydantic import parse_obj_as
import json
import uuid
from datetime import timedelta

from app.db.mongo_db import get_database
from app.services.threedtiles_service import ThreeDTilesService
from app.models.threedtiles import ThreeDTilesCreate, ThreeDTilesInDB, ThreeDTilesUpdate, ProcessStatus
from app.core.minio_client import minio_client, minio_external_client, THREEDTILES_BUCKET_NAME
from app.tasks import task_manager
from app.tasks.task_manager import TaskType, TaskStatus, ConversionStep
from app.auth.utils import get_current_active_user

router = APIRouter(
    tags=["3DTiles"]
)

@router.post("/upload-url", response_model=dict)
async def get_upload_url(
    filename: str = Form(...),
    db = Depends(get_database)
):
    """
    获取MinIO预签名上传URL，实现前端直传
    """
    # 检查文件格式是否为zip或3tz
    if not filename.endswith(('.zip', '.3tz')):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="文件必须是.zip或.3tz格式"
        )
    
    # 生成唯一ID作为对象键
    object_id = str(uuid.uuid4())
    object_name = f"{object_id}/{filename}"
    
    # 创建7天有效的预签名URL
    try:
        upload_url = minio_external_client.presigned_put_object(
            THREEDTILES_BUCKET_NAME,
            object_name,
            expires=timedelta(days=7)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"生成上传URL失败: {str(e)}"
        )
    
    return {
        "upload_url": upload_url,
        "object_id": object_id,
        "object_name": object_name
    }

@router.post("/process", response_model=dict)
async def process_uploaded_file(
    object_id: str = Form(...),
    filename: str = Form(...),
    name: str = Form(...),
    description: str = Form(None),
    metadata: str = Form(None),
    tags: str = Form(None),
    is_public: bool = Form(True),
    db = Depends(get_database),
    current_user = Depends(get_current_active_user)
):
    """
    处理已上传到MinIO的文件，进行解压和数据库记录创建
    现在使用任务队列处理，不会阻塞API响应
    """
    # 解析元数据和标签
    metadata_dict = {}
    if metadata:
        try:
            metadata_dict = json.loads(metadata)
        except json.JSONDecodeError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, 
                detail="元数据必须是有效的JSON格式"
            )
    
    tags_list = []
    if tags:
        try:
            tags_list = json.loads(tags)
            if not isinstance(tags_list, list):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="标签必须是JSON数组格式"
                )
        except json.JSONDecodeError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="标签必须是有效的JSON格式"
            )
    
    # 创建模型数据对象
    threedtiles_data = ThreeDTilesCreate(
        name=name,
        description=description,
        metadata=metadata_dict,
        tags=tags_list,
        is_public=is_public
    )
    
    # 打印日志: 查看threedtiles_data内容
    print(f"[DEBUG] 创建的threedtiles_data对象: {threedtiles_data}")
    print(f"[DEBUG] threedtiles_data.model_dump()内容: {threedtiles_data.model_dump()}")
    
    try:
        # 检查文件存在性
        object_name = f"{object_id}/{filename}"
        minio_client.stat_object(THREEDTILES_BUCKET_NAME, object_name)
        
        # 创建任务
        task = await task_manager.create_task(
            task_type=TaskType.THREEDTILES_PROCESSING,
            user_id=str(current_user.id),
            file_id=object_id,
            input_file_path=object_name,
            output_format="3DTILES"
        )
        
        # 添加额外信息到任务结果中
        task_result = {
            "object_id": object_id,
            "filename": filename,
            "threedtiles_data": threedtiles_data.model_dump()
        }
        
        # 打印日志: 查看task_result内容
        print(f"[DEBUG] 更新任务的task_result: {task_result}")
        
        updated_task = await task_manager.update_task(
            task_id=task.task_id,
            result=task_result
        )
        
        # 打印日志: 查看更新后的任务
        print(f"[DEBUG] 更新后的任务result: {updated_task.result if updated_task else 'None'}")
        
        # 重要：更新任务后，我们需要将更新后的完整任务重新添加到队列
        # 这确保队列中任务包含最新的完整数据
        if updated_task:
            try:
                # 更新后再次添加到队列，确保队列中的任务数据是最新的
                task_dict = updated_task.to_dict()
                task_data = json.dumps(task_dict)
                
                # 清理并重新添加到队列
                task_manager.redis.redis_client.lrem(task_manager.task_queue_key, 0, json.dumps(task.to_dict()))
                task_manager.redis.redis_client.rpush(task_manager.task_queue_key, task_data)
                print(f"[DEBUG] 已将更新后的任务重新添加到队列，task_id: {task.task_id}")
            except Exception as e:
                print(f"[ERROR] 重新添加任务到队列失败: {str(e)}")
                # 任务仍在Redis和MongoDB中，处理器会找到它
        
        return {
            "status": "processing",
            "message": "已加入任务队列，请在任务列表中查看进度",
            "process_id": task.task_id,
            "task_id": task.task_id  # 添加任务ID以便前端跳转到任务列表
        }
        
    except Exception as e:
        print(f"[ERROR] 处理文件失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"处理文件失败: {str(e)}"
        )

@router.get("/process-status/{process_id}", response_model=ProcessStatus)
async def get_process_status(
    process_id: str,
    db = Depends(get_database)
):
    """
    获取文件处理状态
    """
    # 尝试从任务管理器获取任务状态
    try:
        task = await task_manager.get_task(process_id)
        if task:
            # 打印任务详情以便调试
            print(f"[DEBUG] 获取任务状态: {task.status}, 任务ID: {process_id}")
            print(f"[DEBUG] 任务结果: {task.result}")
            
            # 将任务状态转换为ProcessStatus
            status_value = "processing"
            if task.status == TaskStatus.COMPLETED:
                status_value = "completed"
            elif task.status == TaskStatus.FAILED:
                status_value = "failed"
                
            message = task.error_message or f"当前步骤: {task.current_step}, 进度: {task.progress}%"
            
            # 从任务结果中获取tile_id
            tile_id = None
            if task.result:
                # 直接从结果字典中获取tile_id
                tile_id = task.result.get("tile_id")
                # 如果没有直接的tile_id字段，检查嵌套字典
                if not tile_id and isinstance(task.result, dict):
                    for key, value in task.result.items():
                        if key == "tile_id":
                            tile_id = value
                            break
            
            print(f"[DEBUG] 从任务中提取的tile_id: {tile_id}")
            
            return ProcessStatus(
                process_id=task.task_id,
                status=status_value,
                message=message,
                created_at=task.created_at,
                updated_at=task.updated_at,
                tile_id=tile_id
            )
    except Exception as e:
        print(f"[ERROR] 从任务管理器获取状态失败: {str(e)}")
        # 如果从任务管理器获取失败，回退到原有方法
        pass
        
    # 使用原有方式获取状态
    threedtiles_service = ThreeDTilesService(db)
    status = await threedtiles_service.get_process_status(process_id)
    if not status:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="处理任务不存在"
        )
    return status

@router.post("/", response_model=ThreeDTilesInDB)
async def create_threedtiles(
    file: UploadFile = File(...),
    name: str = Form(...),
    description: str = Form(None),
    metadata: str = Form(None),
    tags: str = Form(None),
    is_public: bool = Form(True),
    db = Depends(get_database)
):
    """
    上传3DTiles模型（.zip或.3tz格式）
    支持大文件上传，无大小限制
    注意: 此接口已被新的直传接口替代，但保留用于向后兼容
    """
    # 解析元数据和标签
    metadata_dict = {}
    if metadata:
        try:
            metadata_dict = json.loads(metadata)
        except json.JSONDecodeError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, 
                detail="元数据必须是有效的JSON格式"
            )
    
    tags_list = []
    if tags:
        try:
            tags_list = json.loads(tags)
            if not isinstance(tags_list, list):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="标签必须是JSON数组格式"
                )
        except json.JSONDecodeError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="标签必须是有效的JSON格式"
            )
    
    # 创建模型数据对象
    threedtiles_data = ThreeDTilesCreate(
        name=name,
        description=description,
        metadata=metadata_dict,
        tags=tags_list,
        is_public=is_public
    )
    
    # 调用服务上传并创建模型
    threedtiles_service = ThreeDTilesService(db)
    return await threedtiles_service.create_threedtiles(file, threedtiles_data)

@router.get("/{tile_id}", response_model=ThreeDTilesInDB)
async def get_threedtiles(
    tile_id: str,
    db = Depends(get_database)
):
    """
    获取单个3DTiles模型信息
    """
    threedtiles_service = ThreeDTilesService(db)
    return await threedtiles_service.get_threedtiles(tile_id)

@router.get("/", response_model=List[ThreeDTilesInDB])
async def get_all_threedtiles(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100),
    db = Depends(get_database)
):
    """
    获取所有3DTiles模型列表
    """
    threedtiles_service = ThreeDTilesService(db)
    return await threedtiles_service.get_all_threedtiles(skip, limit)

@router.put("/{tile_id}", response_model=ThreeDTilesInDB)
async def update_threedtiles(
    tile_id: str,
    name: str = Form(None),
    description: str = Form(None),
    metadata: str = Form(None),
    tags: str = Form(None),
    is_public: bool = Form(None),
    longitude: float = Form(None),
    latitude: float = Form(None),
    height: float = Form(None),
    db = Depends(get_database)
):
    """
    更新3DTiles模型信息
    """
    # 解析元数据和标签
    metadata_dict = None
    if metadata:
        try:
            metadata_dict = json.loads(metadata)
        except json.JSONDecodeError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, 
                detail="元数据必须是有效的JSON格式"
            )
    
    tags_list = None
    if tags:
        try:
            tags_list = json.loads(tags)
            if not isinstance(tags_list, list):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="标签必须是JSON数组格式"
                )
        except json.JSONDecodeError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="标签必须是有效的JSON格式"
            )
    
    # 创建更新数据对象
    update_data = ThreeDTilesUpdate(
        name=name,
        description=description,
        metadata=metadata_dict,
        tags=tags_list,
        is_public=is_public,
        longitude=longitude,
        latitude=latitude,
        height=height
    )
    
    threedtiles_service = ThreeDTilesService(db)
    return await threedtiles_service.update_threedtiles(tile_id, update_data)

@router.delete("/{tile_id}")
async def delete_threedtiles(
    tile_id: str,
    db = Depends(get_database)
):
    """
    删除3DTiles模型
    """
    threedtiles_service = ThreeDTilesService(db)
    result = await threedtiles_service.delete_threedtiles(tile_id)
    if result:
        return JSONResponse(
            status_code=status.HTTP_200_OK,
            content={"detail": f"成功删除ID为{tile_id}的3DTiles模型"}
        ) 