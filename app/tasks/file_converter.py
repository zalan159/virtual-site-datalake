import os
import tempfile
import asyncio
import shlex
from datetime import datetime
from typing import Optional, Tuple, List
import subprocess
import xml.etree.ElementTree as ET
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

from app.core.minio_client import minio_client, SOURCE_BUCKET_NAME, CONVERTED_BUCKET_NAME
from app.models.metadata import ProductOccurrenceMetadata
from app.utils.mongo_init import get_mongo_url

# 加载 .env 文件
load_dotenv()

class FileConverter:
    """文件转换器，负责处理文件转换任务"""
    
    @staticmethod
    async def _parse_and_store_metadata(xml_file_path: str, file_id: str):
        """解析XML文件并存储元数据到MongoDB"""
        try:
            # 从环境变量中获取 MongoDB 配置
            mongo_username = os.getenv("MONGO_USERNAME")
            mongo_password = os.getenv("MONGO_PASSWORD")
            mongo_host = os.getenv("MONGO_HOST")
            mongo_port = os.getenv("MONGO_PORT")
            mongo_db_name = os.getenv("MONGO_DB_NAME")
            
            # 构建 MongoDB 连接 URL
            mongo_url = get_mongo_url()
            
            # 连接MongoDB
            db = AsyncIOMotorClient(mongo_url).get_database()
            
            # 解析XML文件
            tree = ET.parse(xml_file_path)
            root = tree.getroot()
            
            # 查找所有ModelFile节点
            for model_file in root.findall(".//ModelFile"):
                try:
                    # 查找所有ProductOccurrence节点
                    for product_occurrence in model_file.findall(".//ProductOccurrence"):
                        try:
                            # 获取节点属性，使用get方法提供默认值
                            attributes = product_occurrence.attrib
                            
                            # 解析UserData
                            user_data = {}
                            for user_data_elem in product_occurrence.findall("UserData"):
                                try:
                                    title = user_data_elem.get("Title", "")
                                    if not title:  # 跳过没有标题的UserData
                                        continue
                                        
                                    values = []
                                    for user_value in user_data_elem.findall("UserValue"):
                                        try:
                                            value_data = {
                                                "Title": user_value.get("Title", ""),
                                                "Type": user_value.get("Type", ""),
                                                "Value": user_value.get("Value", "")
                                            }
                                            values.append(value_data)
                                        except Exception as e:
                                            print(f"解析UserValue时出错: {str(e)}")
                                            continue
                                            
                                    if values:  # 只添加有值的数据
                                        user_data[title] = values
                                except Exception as e:
                                    print(f"解析UserData元素时出错: {str(e)}")
                                    continue
                            
                            # 创建元数据对象
                            metadata = ProductOccurrenceMetadata(
                                file_id=file_id,
                                pointer=attributes.get("pointer", ""),
                                product_id=attributes.get("Id", ""),
                                name=attributes.get("Name", ""),
                                layer=attributes.get("Layer", ""),
                                style=attributes.get("Style", ""),
                                behaviour=attributes.get("Behaviour", ""),
                                modeller_type=attributes.get("ModellerType", ""),
                                product_load_status=attributes.get("ProductLoadStatus", ""),
                                product_flag=attributes.get("ProductFlag", ""),
                                unit=attributes.get("Unit", ""),
                                density_volume_unit=attributes.get("DensityVolumeUnit", ""),
                                density_mass_unit=attributes.get("DensityMassUnit", ""),
                                unit_from_cad=attributes.get("UnitFromCAD", ""),
                                rgb=attributes.get("RGB", ""),
                                user_data=user_data
                            )
                            
                            # 存储到MongoDB
                            await db.metadata.insert_one(metadata.dict())
                        except Exception as e:
                            print(f"处理ProductOccurrence节点时出错: {str(e)}")
                            continue
                except Exception as e:
                    print(f"处理ModelFile节点时出错: {str(e)}")
                    continue
                    
        except Exception as e:
            print(f"解析和存储元数据时出错: {str(e)}")
            # 不抛出异常，让程序继续运行
            return False
        
        return True
    
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
            # 从环境变量中获取转换程序配置
            converter_path = os.getenv("CONVERTER_PATH")
            program_name = os.getenv("CONVERTER_PROGRAM_NAME")
            
            # 使用自动删除的临时目录
            with tempfile.TemporaryDirectory(prefix="file_conversion_") as temp_dir:
                print(f"DEBUG - 临时目录创建于: {temp_dir}")

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
                
                # 使用完整路径执行程序
                if os.name == 'nt':  # Windows系统
                    program_path = os.path.join(converter_path, f"{program_name}.exe")
                else:
                    program_path = os.path.join(converter_path, program_name)
                
                # 输入输出路径直接使用原始路径（后续由双引号包裹）
                input_file_path_quoted = input_file_path
                output_file_path_quoted = output_file_path
                
                # 在执行cmd前添加
                print(f"输入文件存在: {os.path.exists(input_file_path)}")
                print(f"输出目录可写: {os.access(os.path.dirname(output_file_path), os.W_OK)}")
                print(f"转换工具存在: {os.path.exists(os.path.join(converter_path, f'{program_name}.exe'))}")
                
                # 区分操作系统处理
                if os.name == 'nt':
                    args = [
                        f'"{program_path}"',
                        f'"{input_file_path}"',
                        f'"{output_file_path}"'
                    ]
                    cwd = converter_path
                    shell = True
                else:
                    if not os.access(program_path, os.X_OK):
                        raise PermissionError(f"转换程序无执行权限: {program_path}")
                    args = [
                        f"./{program_name}",
                        input_file_path,
                        output_file_path
                    ]
                    cwd = converter_path
                    shell = False

                print(f"执行参数: {' '.join(args)}")

                def run_subprocess():
                    if shell:
                        return subprocess.run(
                            ' '.join(args),
                            stdout=subprocess.PIPE,
                            stderr=subprocess.PIPE,
                            cwd=cwd,
                            shell=shell,
                            universal_newlines=True,
                            text=True
                        )
                    else:
                        return subprocess.run(
                            args,
                            stdout=subprocess.PIPE,
                            stderr=subprocess.PIPE,
                            cwd=cwd,
                            shell=shell,
                            universal_newlines=True,
                            text=True
                        )
                print(f"converter_path: {converter_path}")
                print(f"program_name: {program_name}")
                print(f"program_path: {program_path}")
                print(f"目录下文件: {os.listdir(converter_path)}")
                print(f"args: {args}")
                process = await asyncio.to_thread(run_subprocess)
                
                return_code = process.returncode
                
                if return_code != 0:
                    error_output = process.stderr
                    print(f"转换失败，错误代码: {return_code}")
                    print(f"完整错误输出:\n{error_output}")
                    return False, f"转换失败: {error_output[:200]}", None
                
                # 上传转换后的文件到MinIO
                converted_file_path = f"{task.user_id}/{datetime.now().strftime('%Y%m%d_%H%M%S')}_{output_filename}"
                minio_client.fput_object(
                    CONVERTED_BUCKET_NAME,
                    converted_file_path,
                    output_file_path
                )
                
                # 搜索并解析转换目录中的XML文件
                for file in os.listdir(temp_dir):
                    if file.lower().endswith('.xml'):
                        xml_file_path = os.path.join(temp_dir, file)
                        await FileConverter._parse_and_store_metadata(xml_file_path, task.file_id)
                
                return True, None, converted_file_path
                
        except Exception as e:
            import traceback
            traceback.print_exc()
            return False, f"系统错误: {str(e)}", None 