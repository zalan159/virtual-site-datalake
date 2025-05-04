from fastapi import APIRouter, HTTPException
from typing import List, Optional
from motor.motor_asyncio import AsyncIOMotorClient
from config import MONGO_URL
from app.models.metadata import ProductOccurrenceMetadata
from app.utils.redis import redis_service
import json

router = APIRouter(
    tags=["metadata"]
)

@router.get("/{file_id}", response_model=List[ProductOccurrenceMetadata])
async def get_metadata_by_file_id(file_id: str):
    """
    获取指定文件ID的所有元数据
    
    Args:
        file_id: 文件ID
        
    Returns:
        List[ProductOccurrenceMetadata]: 元数据列表
    """
    print(f"获取元数据: {file_id}")
    try:
        # 先尝试从Redis缓存获取
        cache_key = f"metadata:{file_id}"
        cached_data = redis_service.redis_client.get(cache_key)
        
        if cached_data:
            # 如果有缓存，直接返回
            print(f"从缓存获取元数据: {file_id}")
            return json.loads(cached_data)
            
        # 如果没有缓存，从MongoDB获取
        db = AsyncIOMotorClient(MONGO_URL).get_database()
        cursor = db.metadata.find({"file_id": file_id})
        metadata_list = await cursor.to_list(length=None)
        
        if not metadata_list:
            raise HTTPException(status_code=404, detail="未找到相关元数据")
            
        # 将结果存入Redis缓存，设置过期时间为1小时
        redis_service.redis_client.setex(
            cache_key,
            3600,  # 1小时过期
            json.dumps(metadata_list, default=str)  # 使用default=str处理日期类型
        )
            
        return metadata_list
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取元数据失败: {str(e)}")

@router.get("/search/", response_model=List[ProductOccurrenceMetadata])
async def search_metadata(
    keyword: str,
    fields: Optional[List[str]] = None
):
    """
    搜索元数据
    
    Args:
        keyword: 搜索关键词
        fields: 要搜索的字段列表，如果不指定则搜索所有文本字段
        
    Returns:
        List[ProductOccurrenceMetadata]: 匹配的元数据列表
    """
    try:
        # 连接MongoDB
        db = AsyncIOMotorClient(MONGO_URL).get_database()
        
        # 如果没有指定字段，则在所有文本字段中搜索
        if not fields:
            fields = [
                "pointer", "product_id", "name", "layer", 
                "style", "behaviour", "modeller_type",
                "product_load_status", "product_flag"
            ]
            
        # 构建查询条件
        search_conditions = []
        for field in fields:
            search_conditions.append({field: {"$regex": keyword, "$options": "i"}})
            
        # 执行查询
        cursor = db.metadata.find({"$or": search_conditions})
        metadata_list = await cursor.to_list(length=None)
        
        if not metadata_list:
            raise HTTPException(status_code=404, detail="未找到匹配的元数据")
            
        return metadata_list
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"搜索元数据失败: {str(e)}") 