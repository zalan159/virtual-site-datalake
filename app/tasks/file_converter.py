import os
import tempfile
import asyncio
import shlex
from datetime import datetime
from typing import Optional, Tuple

from app.core.minio_client import minio_client, SOURCE_BUCKET_NAME, CONVERTED_BUCKET_NAME
from config import CONVERTER_CONFIG

class FileConverter:
    """文件转换器，负责处理文件转换任务"""
    
    @staticmethod
    async def convert_file(task) -> Tuple[bool, Optional[str], Optional[str]]:
        """
        转换文件
        
        Args:
            task: 转换任务
            
        Returns:
            Tuple[bool, Optional[str], Optional[str]]: (是否成功, 错误信息, 输出文件路径)
        """
        try:
            # 创建临时目录
            with tempfile.TemporaryDirectory() as temp_dir:
                # 下载文件
                input_filename = os.path.basename(task.input_file_path)
                input_file_path = os.path.join(temp_dir, input_filename)
                
                # 从MinIO下载文件
                minio_client.fget_object(
                    SOURCE_BUCKET_NAME,
                    task.input_file_path,
                    input_file_path
                )
                
                # 设置输出文件路径
                output_filename = f"{os.path.splitext(input_filename)[0]}.{task.output_format.lower()}"
                output_file_path = os.path.join(temp_dir, output_filename)
                
                # 构建转换命令
                converter_path = CONVERTER_CONFIG.get("path", "ImportExport")
                program_name = CONVERTER_CONFIG.get("program_name", "ImportExport")
                
                # 使用shlex.quote()转义文件路径中的空格
                input_file_path_quoted = shlex.quote(input_file_path)
                output_file_path_quoted = shlex.quote(output_file_path)
                
                # 使用shell=True并先cd到指定目录，然后执行程序
                cmd = f"cd {converter_path} && ./{program_name} {input_file_path_quoted} {output_file_path_quoted}"
                
                # 异步执行转换命令
                process = await asyncio.create_subprocess_shell(
                    cmd,
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE
                )
                
                stdout, stderr = await process.communicate()
                
                if process.returncode != 0:
                    error_message = stderr.decode() if stderr else "转换失败，未知错误"
                    return False, error_message, None
                
                # 上传转换后的文件到MinIO
                converted_file_path = f"{task.user_id}/{datetime.now().strftime('%Y%m%d_%H%M%S')}_{output_filename}"
                minio_client.fput_object(
                    CONVERTED_BUCKET_NAME,
                    converted_file_path,
                    output_file_path
                )
                
                return True, None, converted_file_path
                
        except Exception as e:
            return False, str(e), None 