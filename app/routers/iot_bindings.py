"""
IoT绑定路由

管理场景实例的IoT绑定配置。根据升级计划，采用前端驱动的实时连接模型。
"""

from fastapi import APIRouter, HTTPException, Depends, Body, Query
from typing import List, Optional, Dict, Any
from uuid import uuid4
import json
import logging

from app.auth.utils import get_current_active_user
from app.models.user import UserInDB
from app.models.scene import Scene, Instance
from app.models.iot_bindings import (
    IoTBinding, IoTBindingCreate, IoTBindingUpdate, IoTBindingValidation,
    IoTBindingBatchCreate, IoTBindingBatchUpdate, IoTProtocolType, IoTDataType
)

router = APIRouter(tags=["iot-bindings"])
logger = logging.getLogger(__name__)

# ------------------------------------------------------------------------------
#  测试端点
# ------------------------------------------------------------------------------

@router.get("/test")
async def test_route():
    """测试路由是否工作"""
    return {"message": "IoT绑定路由工作正常", "timestamp": "2024-01-01"}

# ------------------------------------------------------------------------------
#  调试端点
# ------------------------------------------------------------------------------

@router.get("/debug/scenes/{scene_id}/instances/{instance_id}/info")
async def debug_scene_instance_info(
    scene_id: str,
    instance_id: str,
    current_user: UserInDB = Depends(get_current_active_user)
):
    """调试端点：获取场景和实例信息"""
    result = {
        "scene_id": scene_id,
        "instance_id": instance_id,
        "user_id": str(current_user.id),
        "scene_exists": False,
        "instance_exists": False,
        "scene_owner_match": False,
        "instance_in_scene": False,
        "root_instance_exists": False,
        "iot_binds_count": 0
    }
    
    try:
        # 检查场景
        scene = Scene.nodes.get_or_none(uid=scene_id)
        result["scene_exists"] = scene is not None
        
        if scene:
            result["scene_owner_match"] = scene.owner == str(current_user.id)
            
            # 检查根实例
            try:
                root_instance = scene.root.single()
                result["root_instance_exists"] = root_instance is not None
            except Exception as e:
                logger.error(f"获取根实例失败: {e}")
        
        # 检查实例
        instance = Instance.nodes.get_or_none(uid=instance_id)
        result["instance_exists"] = instance is not None
        
        if instance and scene and scene.root.single():
            result["instance_in_scene"] = _is_instance_in_scene(instance, scene.root.single())
            result["iot_binds_count"] = len(getattr(instance, 'iot_binds', []) or [])
        
        return result
        
    except Exception as e:
        logger.error(f"调试信息获取失败: {e}")
        result["error"] = str(e)
        return result

# ------------------------------------------------------------------------------
#  场景实例IoT绑定管理
# ------------------------------------------------------------------------------

@router.get("/scenes/{scene_id}/instances/{instance_id}/iot-bindings", response_model=List[IoTBinding])
async def get_instance_iot_bindings(
    scene_id: str,
    instance_id: str,
    current_user: UserInDB = Depends(get_current_active_user)
):
    """获取场景实例的IoT绑定配置"""
    try:
        logger.info(f"获取IoT绑定: scene_id={scene_id}, instance_id={instance_id}, user_id={current_user.id}")
        
        # 验证场景所有权
        scene = Scene.nodes.get_or_none(uid=scene_id, owner=str(current_user.id))
        if not scene:
            raise HTTPException(status_code=404, detail="场景不存在或无访问权限")
        
        # 获取实例
        instance = Instance.nodes.get_or_none(uid=instance_id)
        if not instance:
            raise HTTPException(status_code=404, detail="实例不存在")
        
        # 验证实例属于该场景
        try:
            root_instance = scene.root.single()
            if not root_instance:
                raise HTTPException(status_code=404, detail="场景根实例不存在")
            
            if not _is_instance_in_scene(instance, root_instance):
                raise HTTPException(status_code=404, detail="实例不属于该场景")
        except Exception as e:
            logger.error(f"场景验证失败: {e}")
            raise HTTPException(status_code=404, detail=f"场景验证失败: {str(e)}")
        
        # 解析IoT绑定配置
        bindings = []
        iot_binds = getattr(instance, 'iot_binds', None) or []
        logger.info(f"实例IoT绑定数量: {len(iot_binds)}")
        
        for binding_data in iot_binds:
            try:
                binding = IoTBinding(**binding_data)
                bindings.append(binding)
            except Exception as e:
                logger.warning(f"跳过无效绑定配置: {e}")
                continue
        
        logger.info(f"返回有效绑定数量: {len(bindings)}")
        return bindings
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取IoT绑定失败: {e}")
        raise HTTPException(status_code=500, detail=f"内部服务器错误: {str(e)}")

@router.get("/scenes/{scene_id}/instances/{instance_id}/iot-bindings/{binding_id}", response_model=IoTBinding)
async def get_instance_iot_binding(
    scene_id: str,
    instance_id: str,
    binding_id: str,
    current_user: UserInDB = Depends(get_current_active_user)
):
    """获取场景实例的单个IoT绑定配置"""
    try:
        # 验证场景所有权
        scene = Scene.nodes.get_or_none(uid=scene_id, owner=str(current_user.id))
        if not scene:
            raise HTTPException(status_code=404, detail="场景不存在或无访问权限")
        
        # 获取实例
        instance = Instance.nodes.get_or_none(uid=instance_id)
        if not instance:
            raise HTTPException(status_code=404, detail="实例不存在")
        
        # 验证实例属于该场景
        if not scene.root.single() or not _is_instance_in_scene(instance, scene.root.single()):
            raise HTTPException(status_code=404, detail="实例不属于该场景")
        
        # 查找指定的绑定
        iot_binds = getattr(instance, 'iot_binds', None) or []
        
        for binding_data in iot_binds:
            if binding_data.get("id") == binding_id:
                try:
                    binding = IoTBinding(**binding_data)
                    return binding
                except Exception as e:
                    logger.error(f"绑定数据解析失败: {e}")
                    raise HTTPException(status_code=500, detail=f"绑定数据格式错误: {str(e)}")
        
        raise HTTPException(status_code=404, detail="IoT绑定不存在")
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取IoT绑定失败: {e}")
        raise HTTPException(status_code=500, detail=f"内部服务器错误: {str(e)}")

@router.post("/scenes/{scene_id}/instances/{instance_id}/iot-bindings", response_model=IoTBinding)
async def create_instance_iot_binding(
    scene_id: str,
    instance_id: str,
    binding_data: IoTBindingCreate,
    current_user: UserInDB = Depends(get_current_active_user)
):
    """为场景实例创建IoT绑定"""
    try:
        # 验证场景所有权
        scene = Scene.nodes.get_or_none(uid=scene_id, owner=str(current_user.id))
        if not scene:
            raise HTTPException(status_code=404, detail="场景不存在或无访问权限")
        
        # 获取实例
        instance = Instance.nodes.get_or_none(uid=instance_id)
        if not instance:
            raise HTTPException(status_code=404, detail="实例不存在")
        
        # 验证实例属于该场景
        if not scene.root.single() or not _is_instance_in_scene(instance, scene.root.single()):
            raise HTTPException(status_code=404, detail="实例不属于该场景")
        
        # 验证绑定数据
        try:
            # 创建新的绑定ID
            binding_id = str(uuid4())
            
            # 创建绑定对象
            binding = IoTBinding(
                id=binding_id,
                **binding_data.model_dump(exclude_unset=True)
            )
            
            # 验证绑定配置
            _validate_binding_config(binding)
            
            # 检查与已有绑定的冲突
            current_bindings = instance.iot_binds or []
            _validate_binding_conflicts(binding, current_bindings)
            
        except Exception as e:
            logger.error(f"绑定配置验证失败: {e}")
            raise HTTPException(status_code=400, detail=f"绑定配置无效: {str(e)}")
        
        # 更新实例的绑定列表
        current_bindings = instance.iot_binds or []
        current_bindings.append(binding.model_dump())
        instance.iot_binds = current_bindings
        instance.save()
        
        logger.info(f"创建IoT绑定成功: binding_id={binding_id}")
        return binding
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"创建IoT绑定失败: {e}")
        raise HTTPException(status_code=500, detail=f"内部服务器错误: {str(e)}")

@router.put("/scenes/{scene_id}/instances/{instance_id}/iot-bindings/{binding_id}", response_model=IoTBinding)
async def update_instance_iot_binding(
    scene_id: str,
    instance_id: str,
    binding_id: str,
    binding_update: IoTBindingUpdate,
    current_user: UserInDB = Depends(get_current_active_user)
):
    """更新场景实例的IoT绑定"""
    try:
        # 验证场景所有权
        scene = Scene.nodes.get_or_none(uid=scene_id, owner=str(current_user.id))
        if not scene:
            raise HTTPException(status_code=404, detail="场景不存在或无访问权限")
        
        # 获取实例
        instance = Instance.nodes.get_or_none(uid=instance_id)
        if not instance:
            raise HTTPException(status_code=404, detail="实例不存在")
        
        # 验证实例属于该场景
        if not scene.root.single() or not _is_instance_in_scene(instance, scene.root.single()):
            raise HTTPException(status_code=404, detail="实例不属于该场景")
        
        # 查找并更新绑定
        current_bindings = instance.iot_binds or []
        binding_index = -1
        current_binding = None
        
        for i, binding_data in enumerate(current_bindings):
            if binding_data.get("id") == binding_id:
                binding_index = i
                current_binding = IoTBinding(**binding_data)
                break
        
        if binding_index == -1:
            raise HTTPException(status_code=404, detail="IoT绑定不存在")
        
        # 更新绑定数据
        update_data = binding_update.model_dump(exclude_unset=True)
        updated_binding_data = current_binding.model_dump()
        updated_binding_data.update(update_data)
        
        try:
            updated_binding = IoTBinding(**updated_binding_data)
            _validate_binding_config(updated_binding)
            
            # 检查与已有绑定的冲突（排除当前正在编辑的绑定）
            _validate_binding_conflicts(updated_binding, current_bindings, exclude_binding_id=binding_id)
            
        except Exception as e:
            logger.error(f"更新后的绑定配置验证失败: {e}")
            raise HTTPException(status_code=400, detail=f"更新后的绑定配置无效: {str(e)}")
        
        current_bindings[binding_index] = updated_binding.model_dump()
        instance.iot_binds = current_bindings
        instance.save()
        
        logger.info(f"更新IoT绑定成功: binding_id={binding_id}")
        return updated_binding
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"更新IoT绑定失败: {e}")
        raise HTTPException(status_code=500, detail=f"内部服务器错误: {str(e)}")

@router.delete("/scenes/{scene_id}/instances/{instance_id}/iot-bindings/{binding_id}")
async def delete_instance_iot_binding(
    scene_id: str,
    instance_id: str,
    binding_id: str,
    current_user: UserInDB = Depends(get_current_active_user)
):
    """删除场景实例的IoT绑定"""
    try:
        # 验证场景所有权
        scene = Scene.nodes.get_or_none(uid=scene_id, owner=str(current_user.id))
        if not scene:
            raise HTTPException(status_code=404, detail="场景不存在或无访问权限")
        
        # 获取实例
        instance = Instance.nodes.get_or_none(uid=instance_id)
        if not instance:
            raise HTTPException(status_code=404, detail="实例不存在")
        
        # 验证实例属于该场景
        if not scene.root.single() or not _is_instance_in_scene(instance, scene.root.single()):
            raise HTTPException(status_code=404, detail="实例不属于该场景")
        
        # 查找并删除绑定
        current_bindings = instance.iot_binds or []
        binding_index = -1
        
        for i, binding_data in enumerate(current_bindings):
            if binding_data.get("id") == binding_id:
                binding_index = i
                break
        
        if binding_index == -1:
            raise HTTPException(status_code=404, detail="IoT绑定不存在")
        
        # 删除绑定
        removed_binding = current_bindings.pop(binding_index)
        instance.iot_binds = current_bindings
        instance.save()
        
        logger.info(f"删除IoT绑定成功: binding_id={binding_id}")
        return {
            "message": "IoT绑定已删除",
            "binding_id": binding_id,
            "removed_binding": removed_binding
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"删除IoT绑定失败: {e}")
        raise HTTPException(status_code=500, detail=f"内部服务器错误: {str(e)}")

@router.post("/scenes/{scene_id}/instances/{instance_id}/iot-bindings/batch", response_model=List[IoTBinding])
async def batch_create_instance_iot_bindings(
    scene_id: str,
    instance_id: str,
    batch_data: IoTBindingBatchCreate,
    current_user: UserInDB = Depends(get_current_active_user)
):
    """批量创建场景实例的IoT绑定"""
    try:
        # 验证场景所有权
        scene = Scene.nodes.get_or_none(uid=scene_id, owner=str(current_user.id))
        if not scene:
            raise HTTPException(status_code=404, detail="场景不存在或无访问权限")
        
        # 获取实例
        instance = Instance.nodes.get_or_none(uid=instance_id)
        if not instance:
            raise HTTPException(status_code=404, detail="实例不存在")
        
        # 验证实例属于该场景
        if not scene.root.single() or not _is_instance_in_scene(instance, scene.root.single()):
            raise HTTPException(status_code=404, detail="实例不属于该场景")
        
        # 创建多个绑定
        created_bindings = []
        current_bindings = instance.iot_binds or []
        validation_errors = []
        
        for i, binding_data in enumerate(batch_data.bindings):
            try:
                binding_id = str(uuid4())
                binding = IoTBinding(
                    id=binding_id,
                    **binding_data.model_dump(exclude_unset=True)
                )
                
                # 验证绑定配置
                _validate_binding_config(binding)
                
                # 检查与已有绑定的冲突（包括当前批次中已处理的绑定）
                _validate_binding_conflicts(binding, current_bindings)
                
                current_bindings.append(binding.model_dump())
                created_bindings.append(binding)
                
            except Exception as e:
                validation_errors.append(f"绑定 {i+1}: {str(e)}")
        
        if validation_errors:
            raise HTTPException(
                status_code=400, 
                detail=f"部分绑定配置无效: {'; '.join(validation_errors)}"
            )
        
        instance.iot_binds = current_bindings
        instance.save()
        
        logger.info(f"批量创建IoT绑定成功: 创建了 {len(created_bindings)} 个绑定")
        return created_bindings
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"批量创建IoT绑定失败: {e}")
        raise HTTPException(status_code=500, detail=f"内部服务器错误: {str(e)}")

@router.put("/scenes/{scene_id}/instances/{instance_id}/iot-bindings/batch")
async def batch_update_instance_iot_bindings(
    scene_id: str,
    instance_id: str,
    batch_data: IoTBindingBatchUpdate,
    current_user: UserInDB = Depends(get_current_active_user)
):
    """批量更新场景实例的IoT绑定"""
    try:
        # 验证场景所有权
        scene = Scene.nodes.get_or_none(uid=scene_id, owner=str(current_user.id))
        if not scene:
            raise HTTPException(status_code=404, detail="场景不存在或无访问权限")
        
        # 获取实例
        instance = Instance.nodes.get_or_none(uid=instance_id)
        if not instance:
            raise HTTPException(status_code=404, detail="实例不存在")
        
        # 验证实例属于该场景
        if not scene.root.single() or not _is_instance_in_scene(instance, scene.root.single()):
            raise HTTPException(status_code=404, detail="实例不属于该场景")
        
        # 批量更新绑定
        current_bindings = instance.iot_binds or []
        update_results = []
        validation_errors = []
        
        for update_item in batch_data.updates:
            binding_id = update_item.get("id")
            if not binding_id:
                validation_errors.append("缺少绑定ID")
                continue
            
            # 查找绑定
            binding_index = -1
            for i, binding_data in enumerate(current_bindings):
                if binding_data.get("id") == binding_id:
                    binding_index = i
                    break
            
            if binding_index == -1:
                validation_errors.append(f"绑定 {binding_id} 不存在")
                continue
            
            try:
                # 更新绑定数据
                current_binding_data = current_bindings[binding_index]
                update_data = {k: v for k, v in update_item.items() if k != "id"}
                current_binding_data.update(update_data)
                
                # 验证更新后的绑定
                updated_binding = IoTBinding(**current_binding_data)
                _validate_binding_config(updated_binding)
                
                # 检查与已有绑定的冲突（排除当前正在编辑的绑定）
                _validate_binding_conflicts(updated_binding, current_bindings, exclude_binding_id=binding_id)
                
                current_bindings[binding_index] = updated_binding.model_dump()
                update_results.append({
                    "binding_id": binding_id,
                    "status": "success",
                    "updated_binding": updated_binding
                })
                
            except Exception as e:
                validation_errors.append(f"绑定 {binding_id}: {str(e)}")
        
        if validation_errors:
            raise HTTPException(
                status_code=400, 
                detail=f"部分绑定更新失败: {'; '.join(validation_errors)}"
            )
        
        instance.iot_binds = current_bindings
        instance.save()
        
        logger.info(f"批量更新IoT绑定成功: 更新了 {len(update_results)} 个绑定")
        return {
            "message": "批量更新完成",
            "updated_count": len(update_results),
            "results": update_results
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"批量更新IoT绑定失败: {e}")
        raise HTTPException(status_code=500, detail=f"内部服务器错误: {str(e)}")

# ------------------------------------------------------------------------------
#  IoT绑定验证和测试
# ------------------------------------------------------------------------------

@router.post("/iot-bindings/validate")
async def validate_iot_binding(
    validation_data: IoTBindingValidation,
    current_user: UserInDB = Depends(get_current_active_user)
):
    """验证IoT绑定配置"""
    try:
        binding = validation_data.binding
        test_data = validation_data.testData or {}
        
        # 执行基本验证
        validation_result = {
            "valid": True,
            "errors": [],
            "warnings": []
        }
        
        # 使用内部验证函数
        try:
            _validate_binding_config(binding)
        except Exception as e:
            validation_result["errors"].append(str(e))
        
        # 验证数据源ID
        if not binding.sourceId:
            validation_result["errors"].append("数据源ID不能为空")
        
        # 验证绑定映射
        if not binding.bindings:
            validation_result["warnings"].append("未定义绑定映射关系")
        
        # 验证HTTP配置
        if binding.protocol == IoTProtocolType.HTTP and not binding.httpConfig:
            validation_result["errors"].append("HTTP协议需要配置httpConfig")
        
        # 验证条件触发配置
        if binding.conditions and not binding.triggerResults:
            validation_result["warnings"].append("定义了触发条件但未配置触发结果")
        
        # 验证节点绑定
        if binding.nodeBindings:
            for node_binding in binding.nodeBindings:
                if not node_binding.nodeName:
                    validation_result["errors"].append("节点绑定需要指定nodeName")
        
        # 验证数值映射
        if binding.valueMapping:
            vm = binding.valueMapping
            if vm.inputMin >= vm.inputMax:
                validation_result["warnings"].append("输入范围无效: inputMin应小于inputMax")
            if vm.outputMin >= vm.outputMax:
                validation_result["warnings"].append("输出范围无效: outputMin应小于outputMax")
        
        # 添加关于目标属性冲突的提示
        if binding.bindings:
            validation_result["warnings"].append("请注意：保存时将检查目标属性是否与其他绑定冲突")
        
        validation_result["valid"] = len(validation_result["errors"]) == 0
        
        return validation_result
        
    except Exception as e:
        logger.error(f"绑定验证失败: {e}")
        return {
            "valid": False,
            "errors": [f"验证失败: {str(e)}"],
            "warnings": []
        }

@router.post("/iot-bindings/test")
async def test_iot_binding(
    test_data: Dict[str, Any] = Body(...),
    current_user: UserInDB = Depends(get_current_active_user)
):
    """测试IoT绑定配置"""
    try:
        binding_data = test_data.get("binding")
        sample_data = test_data.get("sampleData", {})
        
        if not binding_data:
            raise HTTPException(status_code=400, detail="缺少绑定配置")
        
        binding = IoTBinding(**binding_data)
        
        # 模拟数据处理
        result = {
            "success": True,
            "processedData": sample_data,
            "appliedMappings": [],
            "triggeredResults": [],
            "validationResult": "通过"
        }
        
        # 验证绑定配置
        try:
            _validate_binding_config(binding)
        except Exception as e:
            result["validationResult"] = f"配置验证失败: {str(e)}"
            result["success"] = False
            return result
        
        # 模拟数值映射
        if binding.valueMapping and sample_data:
            for key, value in sample_data.items():
                if isinstance(value, (int, float)):
                    mapped_value = _apply_value_mapping(value, binding.valueMapping)
                    result["appliedMappings"].append({
                        "field": key,
                        "original": value,
                        "mapped": mapped_value
                    })
        
        # 模拟条件触发
        if binding.conditions and binding.triggerResults:
            for condition in binding.conditions:
                if _evaluate_condition(condition, sample_data):
                    result["triggeredResults"].extend([
                        trigger.model_dump() for trigger in binding.triggerResults
                    ])
        
        # 模拟数据转换
        if binding.transform and sample_data:
            try:
                # 这里可以添加JavaScript表达式的模拟执行
                result["transformResult"] = f"转换表达式: {binding.transform}"
            except Exception as e:
                result["transformError"] = str(e)
        
        return result
        
    except Exception as e:
        logger.error(f"绑定测试失败: {e}")
        return {
            "success": False,
            "error": str(e)
        }

# ------------------------------------------------------------------------------
#  实时数据API
# ------------------------------------------------------------------------------

@router.get("/iot-bindings/{binding_id}/data/realtime")
async def get_realtime_data(
    binding_id: str,
    current_user: UserInDB = Depends(get_current_active_user)
):
    """获取IoT绑定的实时数据（前端连接实现）"""
    # 这个端点主要是文档用途，实际数据获取由前端直接连接实现
    return {
        "message": "实时数据获取已改为前端驱动模式",
        "instructions": "请使用前端MQTT/WebSocket/HTTP客户端直接连接数据源",
        "binding_id": binding_id,
        "protocols": {
            "mqtt": "使用 MQTT 客户端订阅主题",
            "websocket": "建立 WebSocket 连接",
            "http": "发送 HTTP 请求（支持轮询）"
        }
    }

@router.get("/iot-bindings/{binding_id}/data/history")
async def get_history_data(
    binding_id: str,
    start_time: Optional[str] = Query(None, description="开始时间 (ISO 8601)"),
    end_time: Optional[str] = Query(None, description="结束时间 (ISO 8601)"),
    limit: Optional[int] = Query(100, le=1000, description="返回记录数限制"),
    current_user: UserInDB = Depends(get_current_active_user)
):
    """获取IoT绑定的历史数据"""
    # 这个端点可以保留用于查询历史记录
    return {
        "message": "历史数据查询功能待实现",
        "binding_id": binding_id,
        "query_params": {
            "start_time": start_time,
            "end_time": end_time,
            "limit": limit
        },
        "note": "可以集成时序数据库或MongoDB存储历史数据"
    }

@router.post("/iot-bindings/{binding_id}/command")
async def send_command(
    binding_id: str,
    command: Dict[str, Any] = Body(...),
    current_user: UserInDB = Depends(get_current_active_user)
):
    """发送命令到IoT设备（双向通信）"""
    return {
        "message": "命令发送功能已改为前端驱动模式",
        "instructions": "请使用前端直接发送命令到设备",
        "binding_id": binding_id,
        "command": command,
        "note": "前端可以通过MQTT发布、WebSocket发送或HTTP POST来执行命令"
    }

# ------------------------------------------------------------------------------
#  统计和查询API
# ------------------------------------------------------------------------------

@router.get("/scenes/{scene_id}/iot-bindings/summary")
async def get_scene_iot_bindings_summary(
    scene_id: str,
    current_user: UserInDB = Depends(get_current_active_user)
):
    """获取场景中所有IoT绑定的统计信息"""
    try:
        # 验证场景所有权
        scene = Scene.nodes.get_or_none(uid=scene_id, owner=str(current_user.id))
        if not scene:
            raise HTTPException(status_code=404, detail="场景不存在或无访问权限")
        
        root_instance = scene.root.single()
        if not root_instance:
            raise HTTPException(status_code=404, detail="场景根实例不存在")
        
        # 收集所有实例的绑定信息
        summary = {
            "scene_id": scene_id,
            "scene_name": scene.name,
            "total_instances": 0,
            "instances_with_bindings": 0,
            "total_bindings": 0,
            "bindings_by_protocol": {},
            "bindings_by_data_type": {},
            "enabled_bindings": 0,
            "disabled_bindings": 0,
            "instance_details": []
        }
        
        def collect_instance_bindings(instance: Instance):
            summary["total_instances"] += 1
            iot_binds = getattr(instance, 'iot_binds', None) or []
            
            if iot_binds:
                summary["instances_with_bindings"] += 1
                
                instance_info = {
                    "instance_id": instance.uid,
                    "instance_name": instance.name,
                    "bindings_count": len(iot_binds),
                    "enabled_count": 0,
                    "protocols": [],
                    "data_types": []
                }
                
                for binding_data in iot_binds:
                    try:
                        binding = IoTBinding(**binding_data)
                        summary["total_bindings"] += 1
                        
                        # 统计协议类型
                        protocol = binding.protocol.value
                        summary["bindings_by_protocol"][protocol] = summary["bindings_by_protocol"].get(protocol, 0) + 1
                        if protocol not in instance_info["protocols"]:
                            instance_info["protocols"].append(protocol)
                        
                        # 统计数据类型
                        data_type = binding.dataType.value
                        summary["bindings_by_data_type"][data_type] = summary["bindings_by_data_type"].get(data_type, 0) + 1
                        if data_type not in instance_info["data_types"]:
                            instance_info["data_types"].append(data_type)
                        
                        # 统计启用状态
                        if binding.enabled:
                            summary["enabled_bindings"] += 1
                            instance_info["enabled_count"] += 1
                        else:
                            summary["disabled_bindings"] += 1
                            
                    except Exception as e:
                        logger.warning(f"跳过无效绑定: {e}")
                
                summary["instance_details"].append(instance_info)
            
            # 递归处理子实例
            for child in instance.children:
                collect_instance_bindings(child)
        
        # 从根实例开始收集
        collect_instance_bindings(root_instance)
        
        return summary
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取场景IoT绑定统计失败: {e}")
        raise HTTPException(status_code=500, detail=f"内部服务器错误: {str(e)}")

# ------------------------------------------------------------------------------
#  辅助函数
# ------------------------------------------------------------------------------

def _is_instance_in_scene(instance: Instance, root_instance: Instance) -> bool:
    """检查实例是否属于场景"""
    if instance.uid == root_instance.uid:
        return True
    
    # 递归检查子实例
    for child in root_instance.children:
        if _is_instance_in_scene(instance, child):
            return True
    
    return False

def _validate_binding_conflicts(binding: IoTBinding, existing_bindings: List[dict], exclude_binding_id: str = None) -> None:
    """验证绑定是否与已有绑定存在目标属性冲突"""
    if not binding.bindings:
        return
    
    # 获取当前绑定的目标属性
    current_target_paths = set()
    for binding_map in binding.bindings:
        if isinstance(binding_map, dict) and "target" in binding_map:
            current_target_paths.add(binding_map["target"])
    
    # 检查与已有绑定的冲突
    for existing_binding_data in existing_bindings:
        existing_binding_id = existing_binding_data.get("id")
        
        # 跳过当前正在编辑的绑定
        if exclude_binding_id and existing_binding_id == exclude_binding_id:
            continue
        
        # 获取已有绑定的目标属性
        existing_bindings_maps = existing_binding_data.get("bindings", [])
        for existing_binding_map in existing_bindings_maps:
            if isinstance(existing_binding_map, dict) and "target" in existing_binding_map:
                existing_target_path = existing_binding_map["target"]
                
                # 检查是否有冲突
                if existing_target_path in current_target_paths:
                    existing_binding_name = existing_binding_data.get("name") or f"绑定 {existing_binding_id}"
                    raise ValueError(f"目标属性 '{existing_target_path}' 已被 {existing_binding_name} 使用，不能重复绑定")


def _validate_binding_config(binding: IoTBinding) -> None:
    """验证IoT绑定配置"""
    # 验证基本字段
    if not binding.id:
        raise ValueError("绑定ID不能为空")
    
    if not binding.sourceId:
        raise ValueError("数据源ID不能为空")
    
    # 验证协议特定配置
    if binding.protocol == IoTProtocolType.HTTP:
        if not binding.httpConfig:
            raise ValueError("HTTP协议需要配置httpConfig")
        
        # 验证HTTP配置
        if binding.httpConfig.timeout <= 0:
            raise ValueError("HTTP超时时间必须大于0")
        
        if binding.httpConfig.pollInterval is not None and binding.httpConfig.pollInterval <= 0:
            raise ValueError("HTTP轮询间隔必须大于0")
    
    # 验证绑定映射
    if binding.bindings:
        target_paths = set()
        for i, binding_map in enumerate(binding.bindings):
            if not isinstance(binding_map, dict):
                raise ValueError(f"绑定映射 {i+1} 必须是字典格式")
            
            if "source" not in binding_map or "target" not in binding_map:
                raise ValueError(f"绑定映射 {i+1} 必须包含 source 和 target 字段")
            
            # 检查当前绑定内部是否有重复的目标属性
            target_path = binding_map["target"]
            if target_path in target_paths:
                raise ValueError(f"绑定映射 {i+1} 的目标属性 '{target_path}' 在当前绑定中重复定义")
            target_paths.add(target_path)
    
    # 验证数值映射
    if binding.valueMapping:
        vm = binding.valueMapping
        if vm.inputMin >= vm.inputMax:
            raise ValueError("数值映射的输入范围无效")
        if vm.outputMin >= vm.outputMax:
            raise ValueError("数值映射的输出范围无效")
    
    # 验证插值配置
    if binding.interpolation:
        if binding.interpolation.duration <= 0:
            raise ValueError("插值持续时间必须大于0")
    
    # 验证条件配置
    if binding.conditions:
        for i, condition in enumerate(binding.conditions):
            if not condition.field:
                raise ValueError(f"条件 {i+1} 的字段路径不能为空")
            
            if condition.operator not in ["eq", "ne", "gt", "lt", "gte", "lte", "in", "contains"]:
                raise ValueError(f"条件 {i+1} 的操作符无效")
    
    # 验证节点绑定
    if binding.nodeBindings:
        for i, node_binding in enumerate(binding.nodeBindings):
            if not node_binding.nodeName:
                raise ValueError(f"节点绑定 {i+1} 的节点名称不能为空")
            
            if node_binding.bindingType not in ["translation", "rotation", "scale", "morph_weights"]:
                raise ValueError(f"节点绑定 {i+1} 的绑定类型无效")

def _apply_value_mapping(value: float, mapping) -> float:
    """应用数值映射"""
    from app.models.iot_bindings import ValueMapping
    
    if not isinstance(mapping, ValueMapping):
        return value
    
    # 线性映射
    input_range = mapping.inputMax - mapping.inputMin
    output_range = mapping.outputMax - mapping.outputMin
    
    if input_range == 0:
        return mapping.outputMin
    
    # 计算映射值
    normalized = (value - mapping.inputMin) / input_range
    mapped = mapping.outputMin + normalized * output_range
    
    # 是否限制范围
    if mapping.clamp:
        mapped = max(mapping.outputMin, min(mapping.outputMax, mapped))
    
    return mapped

def _evaluate_condition(condition, data: Dict[str, Any]) -> bool:
    """评估条件表达式"""
    from app.models.iot_bindings import BindingCondition
    
    if not isinstance(condition, BindingCondition):
        return False
    
    # 获取字段值
    field_value = _get_nested_value(data, condition.field)
    
    # 评估操作符
    try:
        if condition.operator == "eq":
            return field_value == condition.value
        elif condition.operator == "ne":
            return field_value != condition.value
        elif condition.operator == "gt":
            return field_value > condition.value
        elif condition.operator == "lt":
            return field_value < condition.value
        elif condition.operator == "gte":
            return field_value >= condition.value
        elif condition.operator == "lte":
            return field_value <= condition.value
        elif condition.operator == "in":
            return field_value in condition.value
        elif condition.operator == "contains":
            return condition.value in field_value
    except Exception as e:
        logger.warning(f"条件评估失败: {e}")
        return False
    
    return False

def _get_nested_value(data: Dict[str, Any], field_path: str) -> Any:
    """获取嵌套字段值"""
    keys = field_path.split(".")
    value = data
    
    for key in keys:
        if isinstance(value, dict) and key in value:
            value = value[key]
        else:
            return None
    
    return value 