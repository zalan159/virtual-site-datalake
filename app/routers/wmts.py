from typing import List
from fastapi import APIRouter, Depends, File, UploadFile, Form, Query, HTTPException, status
from fastapi.responses import JSONResponse
from pydantic import parse_obj_as
import json
import uuid
from datetime import datetime, timedelta

from app.db.mongo_db import get_database
from app.services.wmts_service import WMTSService, WMTS_BUCKET_NAME
from app.models.wmts import WMTSCreate, WMTSInDB, WMTSUpdate, WMTSProcessStatus
from app.core.minio_client import minio_client
from app.tasks import task_manager
from app.tasks.task_manager import TaskType, TaskStatus, ConversionStep
from app.auth.utils import get_current_active_user

def convert_objectid_to_str(obj):
    """递归转换ObjectId和datetime为字符串，处理JSON序列化问题"""
    if hasattr(obj, '__class__') and obj.__class__.__name__ == 'ObjectId':
        return str(obj)
    elif isinstance(obj, datetime):
        return obj.isoformat()
    elif isinstance(obj, dict):
        return {k: convert_objectid_to_str(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [convert_objectid_to_str(v) for v in obj]
    return obj

def prepare_wmts_response(wmts_dict):
    """准备WMTS响应数据，处理ObjectId和id字段"""
    # 递归转换所有ObjectId
    wmts_dict = convert_objectid_to_str(wmts_dict)
    
    # 确保有id字段
    if '_id' in wmts_dict and 'id' not in wmts_dict:
        wmts_dict['id'] = wmts_dict['_id']
        
    # 移除_id字段避免混淆
    if '_id' in wmts_dict:
        del wmts_dict['_id']
        
    return wmts_dict

router = APIRouter(
    tags=["WMTS"]
)

@router.post("/upload-url", response_model=dict)
async def get_upload_url(
    filename: str = Form(...),
    db = Depends(get_database)
):
    """
    获取MinIO预签名上传URL，实现前端直传tpkx文件
    """
    # 检查文件格式是否为tpkx
    if not filename.endswith('.tpkx'):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="文件必须是.tpkx格式"
        )
    
    # 生成唯一ID作为对象键
    object_id = str(uuid.uuid4())
    object_name = f"{object_id}/{filename}"
    
    # 创建7天有效的预签名URL
    try:
        upload_url = minio_client.presigned_put_object(
            WMTS_BUCKET_NAME,
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
    处理已上传到MinIO的tpkx文件，进行解压和数据库记录创建
    使用任务队列处理，不会阻塞API响应
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
    wmts_data = WMTSCreate(
        name=name,
        description=description,
        metadata=metadata_dict,
        tags=tags_list,
        is_public=is_public,
        source_type="file"
    )
    
    print(f"[DEBUG] 创建的wmts_data对象: {wmts_data}")
    print(f"[DEBUG] wmts_data.model_dump()内容: {wmts_data.model_dump()}")
    
    try:
        # 检查文件存在性
        object_name = f"{object_id}/{filename}"
        minio_client.stat_object(WMTS_BUCKET_NAME, object_name)
        
        # 创建任务 (使用新的WMTS任务类型)
        task = await task_manager.create_task(
            task_type=TaskType.WMTS_PROCESSING,
            user_id=str(current_user.id),
            file_id=object_id,
            input_file_path=object_name,
            output_format="WMTS"
        )
        
        # 添加额外信息到任务结果中
        task_result = {
            "object_id": object_id,
            "filename": filename,
            "wmts_data": wmts_data.model_dump()
        }
        
        print(f"[DEBUG] 更新任务的task_result: {task_result}")
        
        updated_task = await task_manager.update_task(
            task_id=task.task_id,
            result=task_result
        )
        
        print(f"[DEBUG] 更新后的任务result: {updated_task.result if updated_task else 'None'}")
        
        # 重新添加到队列确保数据最新
        if updated_task:
            try:
                task_dict = updated_task.to_dict()
                task_data = json.dumps(task_dict)
                
                task_manager.redis.redis_client.lrem(task_manager.task_queue_key, 0, json.dumps(task.to_dict()))
                task_manager.redis.redis_client.rpush(task_manager.task_queue_key, task_data)
                print(f"[DEBUG] 已将更新后的任务重新添加到队列，task_id: {task.task_id}")
            except Exception as e:
                print(f"[ERROR] 重新添加任务到队列失败: {str(e)}")
        
        return {
            "status": "processing",
            "message": "已加入任务队列，请在任务列表中查看进度",
            "process_id": task.task_id,
            "task_id": task.task_id
        }
        
    except Exception as e:
        print(f"[ERROR] 处理文件失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"处理文件失败: {str(e)}"
        )

@router.post("/create-url", response_model=WMTSInDB)
async def create_wmts_from_url(
    wmts_data: WMTSCreate,
    db = Depends(get_database),
    current_user = Depends(get_current_active_user)
):
    """
    创建基于URL的WMTS服务记录
    """
    if wmts_data.source_type != "url":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="此接口仅用于创建URL类型的WMTS服务"
        )
    
    if not wmts_data.service_url:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="URL类型的WMTS服务必须提供service_url"
        )
    
    try:
        wmts_service = WMTSService(db)
        wmts = await wmts_service.create_wmts(wmts_data)
        wmts_dict = wmts.model_dump(by_alias=True)
        return JSONResponse(content=prepare_wmts_response(wmts_dict))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"创建WMTS服务失败: {str(e)}"
        )

@router.get("/process-status/{process_id}", response_model=WMTSProcessStatus)
async def get_process_status(
    process_id: str,
    db = Depends(get_database)
):
    """
    获取文件处理状态
    """
    try:
        task = await task_manager.get_task(process_id)
        if task:
            print(f"[DEBUG] 获取任务状态: {task.status}, 任务ID: {process_id}")
            print(f"[DEBUG] 任务结果: {task.result}")
            
            # 将任务状态转换为WMTSProcessStatus
            status_value = "processing"
            if task.status == TaskStatus.COMPLETED:
                status_value = "completed"
            elif task.status == TaskStatus.FAILED:
                status_value = "failed"
                
            message = task.error_message or f"当前步骤: {task.current_step}, 进度: {task.progress}%"
            
            return WMTSProcessStatus(
                process_id=process_id,
                status=status_value,
                message=message,
                wmts_id=task.result.get("wmts_id") if task.result else None
            )
        else:
            # 如果任务管理器中没有找到，尝试从WMTS服务中获取
            wmts_service = WMTSService(db)
            status = await wmts_service.get_process_status(process_id)
            if status:
                return status
            else:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="未找到指定的处理任务"
                )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"获取处理状态失败: {str(e)}"
        )

@router.get("/", response_model=List[WMTSInDB])
async def get_wmts_list(
    skip: int = Query(0, description="跳过的记录数"),
    limit: int = Query(20, description="返回的记录数"),
    db = Depends(get_database)
):
    """
    获取WMTS图层列表
    """
    try:
        wmts_service = WMTSService(db)
        wmts_list = await wmts_service.get_wmts_list(skip=skip, limit=limit)
        
        # 确保所有记录都有正确的id字段并处理ObjectId序列化
        result_list = []
        for wmts in wmts_list:
            wmts_dict = wmts.model_dump(by_alias=True)
            result_list.append(prepare_wmts_response(wmts_dict))
        
        return JSONResponse(content=result_list)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"获取WMTS列表失败: {str(e)}"
        )

@router.get("/{wmts_id}", response_model=WMTSInDB)
async def get_wmts_by_id(
    wmts_id: str,
    db = Depends(get_database)
):
    """
    根据ID获取WMTS图层详情
    """
    try:
        wmts_service = WMTSService(db)
        wmts = await wmts_service.get_wmts_by_id(wmts_id)
        if not wmts:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="未找到指定的WMTS图层"
            )
        
        # 确保正确序列化，特别是id字段
        wmts_dict = wmts.model_dump(by_alias=True)
        return JSONResponse(content=prepare_wmts_response(wmts_dict))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"获取WMTS详情失败: {str(e)}"
        )

@router.put("/{wmts_id}", response_model=WMTSInDB)
async def update_wmts(
    wmts_id: str,
    update_data: WMTSUpdate,
    db = Depends(get_database),
    current_user = Depends(get_current_active_user)
):
    """
    更新WMTS图层信息
    """
    try:
        wmts_service = WMTSService(db)
        wmts = await wmts_service.update_wmts(wmts_id, update_data)
        if not wmts:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="未找到指定的WMTS图层"
            )
        
        # 确保正确序列化，特别是id字段
        wmts_dict = wmts.model_dump(by_alias=True)
        return JSONResponse(content=prepare_wmts_response(wmts_dict))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"更新WMTS失败: {str(e)}"
        )

@router.delete("/{wmts_id}")
async def delete_wmts(
    wmts_id: str,
    db = Depends(get_database),
    current_user = Depends(get_current_active_user)
):
    """
    删除WMTS图层
    """
    try:
        wmts_service = WMTSService(db)
        success = await wmts_service.delete_wmts(wmts_id)
        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="未找到指定的WMTS图层"
            )
        return {"status": "success", "message": "WMTS图层已删除"}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"删除WMTS失败: {str(e)}"
        )