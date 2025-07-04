import os
import uuid
import zipfile
import shutil
import tempfile
import json
import asyncio
import concurrent.futures
import sqlite3
from typing import List, Optional, Any, Tuple
from datetime import datetime
from fastapi import UploadFile, HTTPException, status
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorClient

from app.core.minio_client import minio_client
from app.models.wmts import WMTSCreate, WMTSInDB, WMTSUpdate, WMTSProcessStatus

# WMTS专用存储桶
WMTS_BUCKET_NAME = "wmts"

# 创建线程池执行器
thread_pool = concurrent.futures.ThreadPoolExecutor(max_workers=10)

class WMTSService:
    def __init__(self, db: Any):
        self.db = db
        self.collection = db.wmts_layers
        self.process_status_collection = db.wmts_process_status
        
    # CRUD 操作
    async def create_wmts(self, wmts_data: WMTSCreate) -> WMTSInDB:
        """创建WMTS图层记录"""
        wmts_dict = wmts_data.model_dump()
        wmts_dict["created_at"] = datetime.utcnow()
        wmts_dict["updated_at"] = datetime.utcnow()
        
        result = await self.collection.insert_one(wmts_dict)
        created_wmts = await self.collection.find_one({"_id": result.inserted_id})
        # 确保_id字段正确转换为id，并删除原始_id
        created_wmts['id'] = str(created_wmts['_id'])
        del created_wmts['_id']
        return WMTSInDB(**created_wmts)
    
    async def get_wmts_list(self, skip: int = 0, limit: int = 20) -> List[WMTSInDB]:
        """获取WMTS图层列表"""
        cursor = self.collection.find().skip(skip).limit(limit).sort("created_at", -1)
        wmts_list = []
        async for wmts in cursor:
            # 确保_id字段正确转换为id，并删除原始_id
            wmts['id'] = str(wmts['_id'])
            del wmts['_id']
            wmts_list.append(WMTSInDB(**wmts))
        return wmts_list
    
    async def get_wmts_by_id(self, wmts_id: str) -> Optional[WMTSInDB]:
        """根据ID获取WMTS图层"""
        try:
            wmts = await self.collection.find_one({"_id": ObjectId(wmts_id)})
            if wmts:
                # 确保_id字段正确转换为id，并删除原始_id
                wmts['id'] = str(wmts['_id'])
                del wmts['_id']
                return WMTSInDB(**wmts)
            return None
        except Exception:
            return None
    
    async def update_wmts(self, wmts_id: str, update_data: WMTSUpdate) -> Optional[WMTSInDB]:
        """更新WMTS图层"""
        try:
            update_dict = {k: v for k, v in update_data.model_dump().items() if v is not None}
            if not update_dict:
                return await self.get_wmts_by_id(wmts_id)
            
            update_dict["updated_at"] = datetime.utcnow()
            
            result = await self.collection.update_one(
                {"_id": ObjectId(wmts_id)},
                {"$set": update_dict}
            )
            
            if result.modified_count > 0:
                return await self.get_wmts_by_id(wmts_id)
            return None
        except Exception:
            return None
    
    async def delete_wmts(self, wmts_id: str) -> bool:
        """删除WMTS图层"""
        try:
            # 先获取WMTS信息，如果是文件类型需要清理MinIO文件
            wmts = await self.get_wmts_by_id(wmts_id)
            if wmts and wmts.source_type == "file" and wmts.minio_path:
                # 异步清理MinIO文件
                await self.run_in_threadpool(self._clean_minio_files, wmts_id)
            
            result = await self.collection.delete_one({"_id": ObjectId(wmts_id)})
            return result.deleted_count > 0
        except Exception:
            return False
    
    # 运行同步代码在线程池中的辅助方法
    async def run_in_threadpool(self, func, *args, **kwargs):
        """在线程池中运行同步函数"""
        return await asyncio.get_event_loop().run_in_executor(
            thread_pool, 
            lambda: func(*args, **kwargs)
        )
        
    async def create_process_status(self, process_id: str, status: str, message: str, wmts_id: str = None) -> WMTSProcessStatus:
        """创建或更新处理状态记录"""
        now = datetime.utcnow()
        status_data = {
            "process_id": process_id,
            "status": status,
            "message": message,
            "updated_at": now
        }
        
        if wmts_id:
            status_data["wmts_id"] = wmts_id
            
        # 检查是否已存在
        existing = await self.process_status_collection.find_one({"process_id": process_id})
        if existing:
            # 更新现有记录
            await self.process_status_collection.update_one(
                {"process_id": process_id},
                {"$set": status_data}
            )
        else:
            # 创建新记录
            status_data["created_at"] = now
            await self.process_status_collection.insert_one(status_data)
            
        return await self.get_process_status(process_id)
    
    async def get_process_status(self, process_id: str) -> Optional[WMTSProcessStatus]:
        """获取处理状态记录"""
        status_data = await self.process_status_collection.find_one({"process_id": process_id})
        if not status_data:
            return None
        return WMTSProcessStatus(**status_data)
    
    async def process_tpkx_file_async(self, object_id: str, filename: str, wmts_data: WMTSCreate, process_id: str) -> dict:
        """
        异步处理已上传到MinIO的tpkx文件
        此方法会在后台执行，不会阻塞API响应
        """
        try:
            # 更新状态为处理中
            await self.create_process_status(
                process_id=process_id,
                status="processing",
                message="正在从MinIO下载文件"
            )
            
            # 检查文件是否存在于MinIO
            try:
                await self.run_in_threadpool(
                    minio_client.stat_object,
                    WMTS_BUCKET_NAME, 
                    f"{object_id}/{filename}"
                )
            except Exception as e:
                await self.create_process_status(
                    process_id=process_id,
                    status="failed",
                    message=f"MinIO中未找到文件: {str(e)}"
                )
                return {"status": "failed", "message": f"MinIO中未找到文件: {str(e)}"}
            
            # 创建数据库记录获取ID
            wmts_dict = wmts_data.model_dump()
            wmts_dict["source_type"] = "file"
            wmts_dict["created_at"] = datetime.utcnow()
            wmts_dict["updated_at"] = datetime.utcnow()
            wmts_dict["original_filename"] = filename
            
            # 先插入记录获取ID
            result = await self.collection.insert_one(wmts_dict)
            wmts_id = str(result.inserted_id)
            
            # 更新状态
            await self.create_process_status(
                process_id=process_id,
                status="processing",
                message="正在解压tpkx文件",
                wmts_id=wmts_id
            )
            
            # 创建临时目录
            temp_dir = tempfile.mkdtemp()
            try:
                # 从MinIO下载文件到临时目录
                temp_file_path = os.path.join(temp_dir, filename)
                object_name = f"{object_id}/{filename}"
                
                try:
                    # 在线程池中执行下载操作
                    await self.run_in_threadpool(
                        minio_client.fget_object,
                        WMTS_BUCKET_NAME, 
                        object_name,
                        temp_file_path
                    )
                    
                    # 获取文件大小
                    file_size = await self.run_in_threadpool(
                        os.path.getsize,
                        temp_file_path
                    )
                except Exception as e:
                    # 如果下载失败，删除记录
                    await self.collection.delete_one({"_id": ObjectId(wmts_id)})
                    await self.create_process_status(
                        process_id=process_id,
                        status="failed",
                        message=f"从MinIO下载文件失败: {str(e)}"
                    )
                    return {"status": "failed", "message": f"从MinIO下载文件失败: {str(e)}"}
                
                # 解压tpkx文件到临时目录下的特定文件夹
                extract_dir = os.path.join(temp_dir, wmts_id)
                await self.run_in_threadpool(
                    os.makedirs,
                    extract_dir, 
                    exist_ok=True
                )
                
                try:
                    # 在线程池中执行解压操作 (tpkx实际上是ZIP格式)
                    await self.run_in_threadpool(
                        self._extract_tpkx_file,
                        temp_file_path, 
                        extract_dir
                    )
                except Exception as e:
                    # 如果解压失败，删除记录
                    await self.collection.delete_one({"_id": ObjectId(wmts_id)})
                    await self.create_process_status(
                        process_id=process_id,
                        status="failed",
                        message=f"解压tpkx文件失败: {str(e)}"
                    )
                    return {"status": "failed", "message": f"解压tpkx文件失败: {str(e)}"}
                
                # 更新状态
                await self.create_process_status(
                    process_id=process_id,
                    status="processing",
                    message="正在解析tpkx元数据",
                    wmts_id=wmts_id
                )
                
                # 解析tpkx元数据
                metadata = await self.run_in_threadpool(
                    self._parse_tpkx_metadata,
                    extract_dir
                )
                
                if not metadata:
                    await self.collection.delete_one({"_id": ObjectId(wmts_id)})
                    await self.create_process_status(
                        process_id=process_id,
                        status="failed",
                        message="无法解析tpkx文件元数据"
                    )
                    return {"status": "failed", "message": "无法解析tpkx文件元数据"}
                
                # 更新状态
                await self.create_process_status(
                    process_id=process_id,
                    status="processing",
                    message="正在上传瓦片文件到MinIO",
                    wmts_id=wmts_id
                )
                
                # 将解压后的文件上传到MinIO
                uploaded_files = await self.run_in_threadpool(
                    self._upload_tiles_to_minio,
                    extract_dir,
                    wmts_id
                )
                
                if not uploaded_files:
                    # 如果上传失败
                    await self.run_in_threadpool(
                        self._clean_minio_files,
                        wmts_id
                    )
                    await self.collection.delete_one({"_id": ObjectId(wmts_id)})
                    await self.create_process_status(
                        process_id=process_id,
                        status="failed",
                        message="上传瓦片文件到MinIO失败"
                    )
                    return {"status": "failed", "message": "上传瓦片文件到MinIO失败"}
                
                # 删除原始上传的tpkx文件
                try:
                    await self.run_in_threadpool(
                        minio_client.remove_object,
                        WMTS_BUCKET_NAME, 
                        f"{object_id}/{filename}"
                    )
                except Exception as e:
                    print(f"删除原始tpkx文件失败 (非致命错误): {str(e)}")
                
                # 构建瓦片服务的URL模板 - 使用相对路径
                tile_url_template = f"/{WMTS_BUCKET_NAME}/{wmts_id}" + "/{z}/{x}/{y}.png"
                minio_path = f"{WMTS_BUCKET_NAME}/{wmts_id}"
                
                # 更新数据库记录
                update_data = {
                    "tile_url_template": tile_url_template,
                    "minio_path": minio_path,
                    "file_size": file_size,
                    "metadata": metadata,
                    "min_zoom": metadata.get("min_zoom", 0),
                    "max_zoom": metadata.get("max_zoom", 18),
                    "bounds": metadata.get("bounds"),
                    "format": metadata.get("format", "image/png")
                }
                
                await self.collection.update_one(
                    {"_id": ObjectId(wmts_id)},
                    {"$set": update_data}
                )
                
                # 更新状态为完成
                await self.create_process_status(
                    process_id=process_id,
                    status="completed",
                    message="处理完成",
                    wmts_id=wmts_id
                )
                
                # 返回处理结果
                return {
                    "status": "completed", 
                    "wmts_id": wmts_id,
                    "tile_url_template": tile_url_template,
                    "minio_path": minio_path,
                    "file_size": file_size,
                    "metadata": metadata
                }
                
            finally:
                # 清理临时目录
                try:
                    await self.run_in_threadpool(
                        shutil.rmtree,
                        temp_dir
                    )
                except Exception as e:
                    print(f"清理临时目录失败: {str(e)}")
                    
        except Exception as e:
            import traceback
            error_detail = f"{str(e)}\n{traceback.format_exc()}"
            print(f"[ERROR] 处理tpkx文件失败: {error_detail}")
            
            # 更新状态为失败
            await self.create_process_status(
                process_id=process_id,
                status="failed",
                message=f"处理tpkx文件失败: {str(e)}"
            )
            return {"status": "failed", "message": f"处理tpkx文件失败: {str(e)}"}
    
    # 同步方法 - 在线程池中运行
    def _extract_tpkx_file(self, tpkx_path: str, extract_dir: str):
        """解压tpkx文件 (实际上是ZIP格式)"""
        with zipfile.ZipFile(tpkx_path, 'r') as zip_ref:
            zip_ref.extractall(extract_dir)
    
    def _parse_tpkx_metadata(self, extract_dir: str) -> Optional[dict]:
        """解析tpkx文件的元数据"""
        try:
            metadata = {}
            
            # 查找conf.xml文件
            conf_xml_path = os.path.join(extract_dir, "conf.xml")
            if os.path.exists(conf_xml_path):
                # 解析XML配置文件
                import xml.etree.ElementTree as ET
                tree = ET.parse(conf_xml_path)
                root = tree.getroot()
                
                # 提取基本信息
                metadata["layer_name"] = root.get("name", "Unknown Layer")
                metadata["format"] = "image/png"  # tpkx通常是PNG格式
                
                # 查找LOD信息来确定缩放级别
                lod_infos = root.findall(".//LODInfo")
                if lod_infos:
                    levels = [int(lod.get("level", 0)) for lod in lod_infos]
                    metadata["min_zoom"] = min(levels)
                    metadata["max_zoom"] = max(levels)
                else:
                    metadata["min_zoom"] = 0
                    metadata["max_zoom"] = 18
                
                # 提取边界框信息
                extent = root.find(".//Extent")
                if extent is not None:
                    metadata["bounds"] = {
                        "west": float(extent.get("xmin", -180)),
                        "south": float(extent.get("ymin", -90)),
                        "east": float(extent.get("xmax", 180)),
                        "north": float(extent.get("ymax", 90))
                    }
            
            # 如果没有conf.xml，设置默认值
            if not metadata:
                metadata = {
                    "layer_name": "WMTS Layer",
                    "format": "image/png",
                    "min_zoom": 0,
                    "max_zoom": 18,
                    "bounds": {"west": -180, "south": -90, "east": 180, "north": 90}
                }
            
            return metadata
            
        except Exception as e:
            print(f"解析tpkx元数据失败: {str(e)}")
            return None
    
    def _upload_tiles_to_minio(self, extract_dir: str, wmts_id: str) -> bool:
        """将瓦片文件上传到MinIO"""
        try:
            for root, dirs, files in os.walk(extract_dir):
                for file in files:
                    file_path = os.path.join(root, file)
                    # 保持目录结构
                    object_name = f"{wmts_id}/{os.path.relpath(file_path, extract_dir)}"
                    
                    minio_client.fput_object(
                        WMTS_BUCKET_NAME, 
                        object_name, 
                        file_path
                    )
            return True
        except Exception as e:
            print(f"上传瓦片文件到MinIO失败: {str(e)}")
            return False
    
    def _clean_minio_files(self, wmts_id: str):
        """清理MinIO中的文件"""
        try:
            # 列出所有相关的对象
            objects = minio_client.list_objects(WMTS_BUCKET_NAME, prefix=f"{wmts_id}/", recursive=True)
            for obj in objects:
                minio_client.remove_object(WMTS_BUCKET_NAME, obj.object_name)
        except Exception as e:
            print(f"清理MinIO文件失败: {str(e)}")