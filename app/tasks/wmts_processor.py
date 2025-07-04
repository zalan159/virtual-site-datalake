import asyncio
from datetime import datetime
from typing import Tuple, Dict, Any, Optional

from app.services.wmts_service import WMTSService
from app.models.wmts import WMTSCreate
from pydantic import parse_obj_as
from app.tasks.task_manager import Task, TaskStatus, ConversionStep

class WMTSProcessor:
    """WMTS处理器，用于处理WMTS转换任务"""
    
    @staticmethod
    async def process_wmts(task: Task, db) -> Tuple[bool, Optional[str], Optional[Dict[str, Any]]]:
        """
        处理WMTS任务
        
        Args:
            task: 任务对象
            db: 数据库对象
            
        Returns:
            Tuple[bool, Optional[str], Optional[Dict[str, Any]]]: 
                (是否成功, 错误信息(如果有), 结果数据(如果成功))
        """
        try:
            # 打印任务信息
            print(f"[DEBUG] 开始处理WMTS任务，任务ID: {task.task_id}")
            print(f"[DEBUG] 任务类型: {task.task_type}, 状态: {task.status}")
            print(f"[DEBUG] 任务结果字段内容: {task.result}")
            
            # 解析任务数据
            object_id = task.result.get("object_id")
            filename = task.result.get("filename")
            wmts_data_dict = task.result.get("wmts_data")
            process_id = task.task_id  # 使用任务ID作为处理ID
            
            # 打印解析出的数据
            print(f"[DEBUG] 解析出的object_id: {object_id}")
            print(f"[DEBUG] 解析出的filename: {filename}")
            print(f"[DEBUG] 解析出的wmts_data_dict: {wmts_data_dict}")
            print(f"[DEBUG] wmts_data_dict类型: {type(wmts_data_dict)}")
            
            # 检查必要的数据是否存在
            if not object_id or not filename:
                error_msg = "缺少必要的数据：object_id 或 filename"
                print(f"[ERROR] {error_msg}")
                return False, error_msg, None
                
            # 检查wmts_data_dict是否为None
            if wmts_data_dict is None:
                error_msg = "wmts_data 不能为空"
                print(f"[ERROR] {error_msg}")
                return False, error_msg, None
            
            # 打印将要解析的数据
            print(f"[DEBUG] 将要解析为WMTSCreate的数据: {wmts_data_dict}")
            
            # 从字典创建WMTSCreate对象
            try:
                wmts_data = WMTSCreate.model_validate(wmts_data_dict)
                print(f"[DEBUG] 成功解析为WMTSCreate对象: {wmts_data}")
            except Exception as e:
                error_msg = f"解析WMTSCreate对象失败: {str(e)}"
                print(f"[ERROR] {error_msg}")
                return False, error_msg, None
            
            # 获取服务实例
            wmts_service = WMTSService(db)
            
            # 调用处理函数
            print(f"[DEBUG] 开始调用process_tpkx_file_async处理文件")
            result = await wmts_service.process_tpkx_file_async(
                object_id=object_id,
                filename=filename,
                wmts_data=wmts_data,
                process_id=process_id
            )
            
            print(f"[DEBUG] 处理完成，结果: {result}")
            return True, None, result
        except Exception as e:
            import traceback
            error_detail = f"{str(e)}\n{traceback.format_exc()}"
            print(f"[ERROR] 处理WMTS任务失败: {error_detail}")
            return False, str(e), None