import os
import uuid
import zipfile
import shutil
import tempfile
import json
import asyncio
import concurrent.futures
from typing import List, Optional, Any, Tuple
from datetime import datetime
from fastapi import UploadFile, HTTPException, status
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorClient

from app.core.minio_client import minio_client, THREEDTILES_BUCKET_NAME
from app.models.threedtiles import ThreeDTilesCreate, ThreeDTilesInDB, ThreeDTilesUpdate, ProcessStatus

# 创建线程池执行器
thread_pool = concurrent.futures.ThreadPoolExecutor(max_workers=10)

class ThreeDTilesService:
    def __init__(self, db: Any):
        self.db = db
        self.collection = db.threedtiles
        self.process_status_collection = db.threedtiles_process_status
        
    # 运行同步代码在线程池中的辅助方法
    async def run_in_threadpool(self, func, *args, **kwargs):
        """在线程池中运行同步函数"""
        return await asyncio.get_event_loop().run_in_executor(
            thread_pool, 
            lambda: func(*args, **kwargs)
        )
        
    async def create_process_status(self, process_id: str, status: str, message: str, tile_id: str = None) -> ProcessStatus:
        """
        创建或更新处理状态记录
        """
        now = datetime.utcnow()
        status_data = {
            "process_id": process_id,
            "status": status,
            "message": message,
            "updated_at": now
        }
        
        if tile_id:
            status_data["tile_id"] = tile_id
            
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
    
    async def get_process_status(self, process_id: str) -> Optional[ProcessStatus]:
        """
        获取处理状态记录
        """
        status_data = await self.process_status_collection.find_one({"process_id": process_id})
        if not status_data:
            return None
        return ProcessStatus(**status_data)
    
    async def process_minio_file_async(self, object_id: str, filename: str, threedtiles_data: ThreeDTilesCreate, process_id: str) -> dict:
        """
        异步处理已上传到MinIO的文件
        此方法会在后台执行，不会阻塞API响应
        
        Returns:
            dict: 包含处理结果的字典，包含tile_id和其他相关信息
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
                    THREEDTILES_BUCKET_NAME, 
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
            threedtiles_dict = threedtiles_data.model_dump()
            threedtiles_dict["created_at"] = datetime.utcnow()
            threedtiles_dict["updated_at"] = datetime.utcnow()
            threedtiles_dict["original_filename"] = filename
            
            # 先插入记录获取ID
            result = await self.collection.insert_one(threedtiles_dict)
            tile_id = str(result.inserted_id)
            
            # 更新状态
            await self.create_process_status(
                process_id=process_id,
                status="processing",
                message="正在解压文件",
                tile_id=tile_id
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
                        THREEDTILES_BUCKET_NAME, 
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
                    await self.collection.delete_one({"_id": ObjectId(tile_id)})
                    await self.create_process_status(
                        process_id=process_id,
                        status="failed",
                        message=f"从MinIO下载文件失败: {str(e)}"
                    )
                    return {"status": "failed", "message": f"从MinIO下载文件失败: {str(e)}"}
                
                # 解压文件到临时目录下的特定文件夹
                extract_dir = os.path.join(temp_dir, tile_id)
                await self.run_in_threadpool(
                    os.makedirs,
                    extract_dir, 
                    exist_ok=True
                )
                
                try:
                    # 在线程池中执行解压操作
                    await self.run_in_threadpool(
                        self._extract_zip_file,
                        temp_file_path, 
                        extract_dir
                    )
                except Exception as e:
                    # 如果解压失败，删除记录
                    await self.collection.delete_one({"_id": ObjectId(tile_id)})
                    await self.create_process_status(
                        process_id=process_id,
                        status="failed",
                        message=f"解压文件失败: {str(e)}"
                    )
                    return {"status": "failed", "message": f"解压文件失败: {str(e)}"}
                
                # 更新状态
                await self.create_process_status(
                    process_id=process_id,
                    status="processing",
                    message="正在验证文件结构",
                    tile_id=tile_id
                )
                
                # 验证解压后的文件中是否包含tileset.json
                tileset_path = os.path.join(extract_dir, "tileset.json")
                tileset_exists = await self.run_in_threadpool(
                    os.path.exists,
                    tileset_path
                )
                
                if not tileset_exists:
                    # 如果根目录没有，尝试查找子目录
                    tileset_path, found = await self.run_in_threadpool(
                        self._find_and_move_tileset,
                        extract_dir
                    )
                    
                    if not found:
                        # 删除已创建的MongoDB记录
                        await self.collection.delete_one({"_id": ObjectId(tile_id)})
                        await self.create_process_status(
                            process_id=process_id,
                            status="failed",
                            message="上传的文件中未找到tileset.json"
                        )
                        return {"status": "failed", "message": "上传的文件中未找到tileset.json"}
                
                # 从tileset.json中提取原点经纬度坐标
                longitude, latitude, height = await self.run_in_threadpool(
                    self._extract_coordinates_from_tileset,
                    tileset_path
                )
                    
                # 更新状态
                await self.create_process_status(
                    process_id=process_id,
                    status="processing",
                    message="正在上传处理后的文件到MinIO",
                    tile_id=tile_id
                )
                
                # 将解压后的文件上传到MinIO
                uploaded_files = await self.run_in_threadpool(
                    self._upload_files_to_minio,
                    extract_dir,
                    tile_id
                )
                
                if not uploaded_files:
                    # 如果上传失败
                    await self.run_in_threadpool(
                        self._clean_minio_files,
                        tile_id
                    )
                    await self.collection.delete_one({"_id": ObjectId(tile_id)})
                    await self.create_process_status(
                        process_id=process_id,
                        status="failed",
                        message="上传文件到MinIO失败"
                    )
                    return {"status": "failed", "message": "上传文件到MinIO失败"}
                
                # 删除原始上传的ZIP文件
                try:
                    await self.run_in_threadpool(
                        minio_client.remove_object,
                        THREEDTILES_BUCKET_NAME, 
                        f"{object_id}/{filename}"
                    )
                except Exception as e:
                    print(f"删除原始ZIP文件失败 (非致命错误): {str(e)}")
                
                # 构建tileset.json的URL - 使用相对路径而不是硬编码的域名
                tileset_url = f"/{THREEDTILES_BUCKET_NAME}/{tile_id}/tileset.json"
                minio_path = f"{THREEDTILES_BUCKET_NAME}/{tile_id}"
                
                # 更新数据库记录
                update_data = {
                    "tileset_url": tileset_url,
                    "minio_path": minio_path,
                    "file_size": file_size,
                    "longitude": longitude,
                    "latitude": latitude,
                    "height": height
                }
                
                await self.collection.update_one(
                    {"_id": ObjectId(tile_id)},
                    {"$set": update_data}
                )
                
                # 更新状态为完成
                await self.create_process_status(
                    process_id=process_id,
                    status="completed",
                    message="处理完成",
                    tile_id=tile_id
                )
                
                # 返回处理结果，包括tile_id和其他必要信息
                return {
                    "status": "completed", 
                    "tile_id": tile_id,
                    "tileset_url": tileset_url,
                    "minio_path": minio_path,
                    "file_size": file_size,
                    "longitude": longitude,
                    "latitude": latitude,
                    "height": height
                }
                
            finally:
                # 清理临时目录
                try:
                    await self.run_in_threadpool(
                        shutil.rmtree,
                        temp_dir,
                        ignore_errors=True
                    )
                except:
                    pass
                
        except Exception as e:
            # 处理过程中出现未知异常
            error_message = f"处理过程中出现错误: {str(e)}"
            print(f"[ERROR] {error_message}")
            await self.create_process_status(
                process_id=process_id,
                status="failed",
                message=error_message
            )
            # 如果已创建了tile记录，尝试删除
            if 'tile_id' in locals():
                try:
                    await self.run_in_threadpool(
                        self._clean_minio_files,
                        tile_id
                    )
                    await self.collection.delete_one({"_id": ObjectId(tile_id)})
                except:
                    pass
            return {"status": "failed", "message": error_message}
            
    # 辅助方法，用于在线程池中执行的操作
    def _extract_zip_file(self, zip_path, extract_dir):
        """解压ZIP文件到指定目录"""
        with zipfile.ZipFile(zip_path, 'r') as zip_ref:
            zip_ref.extractall(extract_dir)
            
    def _find_and_move_tileset(self, extract_dir):
        """查找tileset.json文件并移动内容到根目录"""
        # 如果根目录没有，尝试查找子目录
        for root, dirs, files in os.walk(extract_dir):
            for file in files:
                if file == "tileset.json":
                    tileset_path = os.path.join(root, file)
                    # 如果tileset.json在子目录中，将所有文件移动到父目录
                    if root != extract_dir:
                        for item in os.listdir(root):
                            shutil.move(os.path.join(root, item), extract_dir)
                    return os.path.join(extract_dir, "tileset.json"), True
        return None, False
        
    def _upload_files_to_minio(self, extract_dir, tile_id):
        """将文件上传到MinIO"""
        try:
            for root, dirs, files in os.walk(extract_dir):
                for file in files:
                    file_path = os.path.join(root, file)
                    # 确保使用tile_id作为目录前缀
                    object_name = f"{tile_id}/{os.path.relpath(file_path, extract_dir)}"
                    
                    # 上传文件到MinIO
                    minio_client.fput_object(
                        THREEDTILES_BUCKET_NAME, 
                        object_name, 
                        file_path
                    )
            return True
        except Exception as e:
            print(f"上传文件到MinIO失败: {str(e)}")
            return False
    
    async def process_minio_file(self, object_id: str, filename: str, threedtiles_data: ThreeDTilesCreate) -> ThreeDTilesInDB:
        """
        处理已上传到MinIO的文件，进行解压和数据库记录创建
        这是同步版本，建议使用异步版本process_minio_file_async
        """
        # 检查文件是否存在于MinIO
        object_name = f"{object_id}/{filename}"
        try:
            minio_client.stat_object(THREEDTILES_BUCKET_NAME, object_name)
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"MinIO中未找到文件: {str(e)}"
            )
            
        # 创建数据库记录获取ID
        threedtiles_dict = threedtiles_data.model_dump()
        threedtiles_dict["created_at"] = datetime.utcnow()
        threedtiles_dict["updated_at"] = datetime.utcnow()
        threedtiles_dict["original_filename"] = filename
        
        # 先插入记录获取ID
        result = await self.collection.insert_one(threedtiles_dict)
        tile_id = str(result.inserted_id)
        
        # 使用临时目录处理文件
        with tempfile.TemporaryDirectory() as temp_dir:
            # 从MinIO下载文件到临时目录
            temp_file_path = os.path.join(temp_dir, filename)
            try:
                minio_client.fget_object(
                    THREEDTILES_BUCKET_NAME, 
                    object_name,
                    temp_file_path
                )
                
                # 获取文件大小
                file_size = os.path.getsize(temp_file_path)
            except Exception as e:
                # 如果下载失败，删除记录
                await self.collection.delete_one({"_id": ObjectId(tile_id)})
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"从MinIO下载文件失败: {str(e)}"
                )
            
            # 解压文件到临时目录下的特定文件夹
            extract_dir = os.path.join(temp_dir, tile_id)
            os.makedirs(extract_dir, exist_ok=True)
            
            try:
                with zipfile.ZipFile(temp_file_path, 'r') as zip_ref:
                    zip_ref.extractall(extract_dir)
            except Exception as e:
                # 如果解压失败，删除记录
                await self.collection.delete_one({"_id": ObjectId(tile_id)})
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"解压文件失败: {str(e)}"
                )
            
            # 验证解压后的文件中是否包含tileset.json
            tileset_path = os.path.join(extract_dir, "tileset.json")
            tileset_dir = extract_dir
            if not os.path.exists(tileset_path):
                # 如果根目录没有，尝试查找子目录
                for root, dirs, files in os.walk(extract_dir):
                    for file in files:
                        if file == "tileset.json":
                            tileset_path = os.path.join(root, file)
                            tileset_dir = root
                            # 如果tileset.json在子目录中，将所有文件移动到父目录
                            if root != extract_dir:
                                for item in os.listdir(root):
                                    shutil.move(os.path.join(root, item), extract_dir)
                            break
                    if os.path.exists(os.path.join(extract_dir, "tileset.json")):
                        break
                
                if not os.path.exists(os.path.join(extract_dir, "tileset.json")):
                    # 删除已创建的MongoDB记录
                    await self.collection.delete_one({"_id": ObjectId(tile_id)})
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="上传的文件中未找到tileset.json"
                    )
            
            # 从tileset.json中提取原点经纬度坐标
            longitude, latitude, height = self._extract_coordinates_from_tileset(tileset_path)
                
            # 将解压后的文件上传到MinIO
            for root, dirs, files in os.walk(extract_dir):
                for file in files:
                    file_path = os.path.join(root, file)
                    # 确保使用tile_id作为目录前缀，而不是原始的object_id
                    object_name = f"{tile_id}/{os.path.relpath(file_path, extract_dir)}"
                    
                    # 上传文件到MinIO
                    try:
                        minio_client.fput_object(
                            THREEDTILES_BUCKET_NAME, 
                            object_name, 
                            file_path
                        )
                    except Exception as e:
                        # 如果上传失败，尝试删除已上传的文件
                        try:
                            self._clean_minio_files(tile_id)
                            await self.collection.delete_one({"_id": ObjectId(tile_id)})
                        except:
                            pass
                        raise HTTPException(
                            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                            detail=f"上传文件到MinIO失败: {str(e)}"
                        )
            
            # 删除原始上传的ZIP文件
            try:
                minio_client.remove_object(THREEDTILES_BUCKET_NAME, f"{object_id}/{filename}")
            except Exception as e:
                print(f"删除原始ZIP文件失败 (非致命错误): {str(e)}")
            
            # 构建tileset.json的URL - 使用相对路径而不是硬编码的域名
            tileset_url = f"/{THREEDTILES_BUCKET_NAME}/{tile_id}/tileset.json"
            minio_path = f"{THREEDTILES_BUCKET_NAME}/{tile_id}"
            
            # 更新数据库记录
            await self.collection.update_one(
                {"_id": ObjectId(tile_id)},
                {"$set": {
                    "tileset_url": tileset_url,
                    "minio_path": minio_path,
                    "file_size": file_size,
                    "longitude": longitude,
                    "latitude": latitude,
                    "height": height
                }}
            )
            
            # 获取完整记录
            threedtiles_db = await self.get_threedtiles(tile_id)
            return threedtiles_db
    
    async def create_threedtiles(self, file: UploadFile, threedtiles_data: ThreeDTilesCreate) -> ThreeDTilesInDB:
        """
        上传并创建一个新的3DTiles模型
        支持流式处理大文件
        """
        # 检查文件格式是否为zip或3tz
        if not file.filename.endswith(('.zip', '.3tz')):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="文件必须是.zip或.3tz格式"
            )
            
        # 创建数据库记录获取ID
        threedtiles_dict = threedtiles_data.model_dump()
        threedtiles_dict["created_at"] = datetime.utcnow()
        threedtiles_dict["updated_at"] = datetime.utcnow()
        threedtiles_dict["original_filename"] = file.filename
        
        # 先插入记录获取ID
        result = await self.collection.insert_one(threedtiles_dict)
        tile_id = str(result.inserted_id)
        
        # 使用临时目录处理文件
        with tempfile.TemporaryDirectory() as temp_dir:
            # 保存上传的文件，使用流式处理避免内存占用
            temp_file_path = os.path.join(temp_dir, file.filename)
            
            # 流式保存文件
            file_size = 0
            with open(temp_file_path, "wb") as temp_file:
                # 每次读取4MB数据以减少内存占用
                chunk_size = 4 * 1024 * 1024  # 4MB 
                chunk = await file.read(chunk_size)
                while chunk:
                    temp_file.write(chunk)
                    file_size += len(chunk)
                    chunk = await file.read(chunk_size)
            
            # 重置文件指针，以便再次使用
            await file.seek(0)
            
            # 解压文件到临时目录下的特定文件夹
            extract_dir = os.path.join(temp_dir, tile_id)
            os.makedirs(extract_dir, exist_ok=True)
            
            try:
                with zipfile.ZipFile(temp_file_path, 'r') as zip_ref:
                    zip_ref.extractall(extract_dir)
            except Exception as e:
                # 如果解压失败，删除记录并返回错误
                await self.collection.delete_one({"_id": ObjectId(tile_id)})
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"解压文件失败: {str(e)}"
                )
            
            # 验证解压后的文件中是否包含tileset.json
            tileset_path = os.path.join(extract_dir, "tileset.json")
            tileset_dir = extract_dir
            if not os.path.exists(tileset_path):
                # 如果根目录没有，尝试查找子目录
                for root, dirs, files in os.walk(extract_dir):
                    for file in files:
                        if file == "tileset.json":
                            tileset_path = os.path.join(root, file)
                            tileset_dir = root
                            # 如果tileset.json在子目录中，将所有文件移动到父目录
                            if root != extract_dir:
                                for item in os.listdir(root):
                                    shutil.move(os.path.join(root, item), extract_dir)
                            break
                    if os.path.exists(os.path.join(extract_dir, "tileset.json")):
                        break
                
                if not os.path.exists(os.path.join(extract_dir, "tileset.json")):
                    # 删除已创建的MongoDB记录
                    await self.collection.delete_one({"_id": ObjectId(tile_id)})
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="上传的文件中未找到tileset.json"
                    )
            
            # 从tileset.json中提取原点经纬度坐标
            longitude, latitude, height = self._extract_coordinates_from_tileset(tileset_path)
                
            # 将解压后的文件上传到MinIO
            for root, dirs, files in os.walk(extract_dir):
                for file in files:
                    file_path = os.path.join(root, file)
                    object_name = f"{tile_id}/{os.path.relpath(file_path, extract_dir)}"
                    
                    # 流式上传文件到MinIO
                    try:
                        minio_client.fput_object(
                            THREEDTILES_BUCKET_NAME, 
                            object_name, 
                            file_path
                        )
                    except Exception as e:
                        # 如果上传失败，尝试删除已上传的文件
                        try:
                            self._clean_minio_files(tile_id)
                            await self.collection.delete_one({"_id": ObjectId(tile_id)})
                        except:
                            pass
                        raise HTTPException(
                            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                            detail=f"上传文件到MinIO失败: {str(e)}"
                        )
            
            # 构建tileset.json的URL - 使用相对路径而不是硬编码的域名
            tileset_url = f"/{THREEDTILES_BUCKET_NAME}/{tile_id}/tileset.json"
            minio_path = f"{THREEDTILES_BUCKET_NAME}/{tile_id}"
            
            # 更新数据库记录
            await self.collection.update_one(
                {"_id": ObjectId(tile_id)},
                {"$set": {
                    "tileset_url": tileset_url,
                    "minio_path": minio_path,
                    "file_size": file_size,
                    "longitude": longitude,
                    "latitude": latitude,
                    "height": height
                }}
            )
            
            # 获取完整记录
            threedtiles_db = await self.get_threedtiles(tile_id)
            return threedtiles_db
    
    def _clean_minio_files(self, tile_id: str) -> None:
        """清理已上传的文件"""
        try:
            objects = minio_client.list_objects(THREEDTILES_BUCKET_NAME, prefix=f"{tile_id}/", recursive=True)
            for obj in objects:
                minio_client.remove_object(THREEDTILES_BUCKET_NAME, obj.object_name)
        except Exception as e:
            # 记录错误但不抛出异常
            print(f"清理MinIO文件失败: {str(e)}")
    
    def _extract_coordinates_from_tileset(self, tileset_path: str) -> Tuple[Optional[float], Optional[float], Optional[float]]:
        """
        从tileset.json中提取原点经纬度坐标
        返回经度、纬度和高度
        """
        try:
            with open(tileset_path, 'r') as f:
                tileset_data = json.load(f)
                
            # 尝试获取根瓦片的变换矩阵
            root_transform = None
            if 'root' in tileset_data and 'transform' in tileset_data['root']:
                root_transform = tileset_data['root']['transform']
            elif 'asset' in tileset_data and 'gltfUpAxis' in tileset_data['asset']:
                # 可能需要其他方式获取坐标
                pass
                
            if root_transform:
                # 3D Tiles中，transform是一个4x4矩阵，按行存储
                # 典型的ECEF坐标系中，最后一行的前三个值对应XYZ位置
                x, y, z = root_transform[12], root_transform[13], root_transform[14]
                
                # 转换ECEF坐标到经纬度（此处为近似转换，实际项目中应使用专业库如pyproj进行转换）
                # 这里仅作为示例，实际应用中请使用更精确的坐标转换方法
                import math
                a = 6378137.0  # WGS84椭球体长半轴
                e2 = 0.00669438  # WGS84椭球体偏心率平方
                
                p = math.sqrt(x*x + y*y)
                theta = math.atan2(z*a, p*(1-e2))
                
                longitude = math.atan2(y, x)
                latitude = math.atan2(
                    z + e2*(1-e2)/(1-e2*math.sin(theta)**2)*a*math.sin(theta)**3,
                    p - e2*a*math.cos(theta)**3
                )
                
                # 转换为度
                longitude = math.degrees(longitude)
                latitude = math.degrees(latitude)
                height = p/math.cos(latitude) - a
                
                return longitude, latitude, height
                
        except Exception as e:
            print(f"提取坐标时出错: {e}")
            
        return None, None, None
    
    async def get_threedtiles(self, tile_id: str) -> dict:
        tile = await self.collection.find_one({"_id": ObjectId(tile_id)})
        if not tile:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"ID为{tile_id}的3DTiles模型不存在"
            )
        return tile
    
    async def get_all_threedtiles(self, skip: int = 0, limit: int = 100) -> list:
        tiles = []
        cursor = self.collection.find().skip(skip).limit(limit)
        async for document in cursor:
            tiles.append(document)
        return tiles
    
    async def update_threedtiles(self, tile_id: str, update_data: ThreeDTilesUpdate) -> ThreeDTilesInDB:
        """
        更新3DTiles模型信息
        """
        tile = await self.collection.find_one({"_id": ObjectId(tile_id)})
        if not tile:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"ID为{tile_id}的3DTiles模型不存在"
            )
        
        update_dict = {k: v for k, v in update_data.model_dump().items() if v is not None}
        if update_dict:
            update_dict["updated_at"] = datetime.utcnow()
            await self.collection.update_one(
                {"_id": ObjectId(tile_id)},
                {"$set": update_dict}
            )
        
        return await self.get_threedtiles(tile_id)
    
    async def delete_threedtiles(self, tile_id: str) -> bool:
        """
        删除3DTiles模型
        """
        tile = await self.collection.find_one({"_id": ObjectId(tile_id)})
        if not tile:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"ID为{tile_id}的3DTiles模型不存在"
            )
        
        # 删除MinIO中的所有相关文件
        try:
            objects = minio_client.list_objects(THREEDTILES_BUCKET_NAME, prefix=f"{tile_id}/", recursive=True)
            for obj in objects:
                minio_client.remove_object(THREEDTILES_BUCKET_NAME, obj.object_name)
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"删除MinIO文件失败: {str(e)}"
            )
        
        # 删除MongoDB记录
        delete_result = await self.collection.delete_one({"_id": ObjectId(tile_id)})
        if delete_result.deleted_count == 0:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="删除数据库记录失败"
            )
            
        return True 