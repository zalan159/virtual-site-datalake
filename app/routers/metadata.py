from fastapi import APIRouter, HTTPException
from typing import List, Optional
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
import os
from app.models.metadata import ProductOccurrenceMetadata
from app.utils.redis import redis_service
import json
from app.utils.mongo_init import get_mongo_url

# 加载 .env 文件
load_dotenv()

# 从环境变量中获取 MongoDB 配置
MONGO_USERNAME = os.getenv("MONGO_USERNAME")
MONGO_PASSWORD = os.getenv("MONGO_PASSWORD")
MONGO_HOST = os.getenv("MONGO_HOST")
MONGO_PORT = os.getenv("MONGO_PORT")
MONGO_DB_NAME = os.getenv("MONGO_DB_NAME")

# 构建 MongoDB 连接 URL
MONGO_URL = get_mongo_url()

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

@router.get("/{file_id}/tree")
async def get_metadata_tree_nodes(
    file_id: str, 
    parent_key: Optional[str] = None,
    page: int = 0,
    page_size: int = 100
):
    """
    分层获取元数据树节点，支持懒加载
    
    Args:
        file_id: 文件ID
        parent_key: 父节点key，为空时获取根节点
        page: 页码，从0开始
        page_size: 每页大小
        
    Returns:
        dict: 包含节点数据和分页信息
    """
    try:
        # 先尝试从Redis缓存获取完整数据
        cache_key = f"metadata:{file_id}"
        cached_data = redis_service.redis_client.get(cache_key)
        
        if cached_data:
            metadata_list = json.loads(cached_data)
        else:
            # 从MongoDB获取
            db = AsyncIOMotorClient(MONGO_URL).get_database()
            cursor = db.metadata.find({"file_id": file_id})
            metadata_list = await cursor.to_list(length=None)
            
            if not metadata_list:
                raise HTTPException(status_code=404, detail="未找到相关元数据")
                
            # 缓存数据
            redis_service.redis_client.setex(
                cache_key,
                3600,
                json.dumps(metadata_list, default=str)
            )
        
        # 如果是根节点请求
        if not parent_key:
            total = len(metadata_list)
            start = page * page_size
            end = start + page_size
            page_data = metadata_list[start:end]
            
            nodes = []
            for i, item in enumerate(page_data):
                actual_index = start + i
                nodes.append({
                    "key": f"metadata-{actual_index}",
                    "title": item.get("name") or f"未命名元数据 #{actual_index + 1}",
                    "isLeaf": False,
                    "hasChildren": True
                })
            
            return {
                "nodes": nodes,
                "total": total,
                "hasMore": end < total,
                "page": page,
                "pageSize": page_size
            }
        
        # 如果是子节点请求
        index = int(parent_key.split('-')[1])
        if index >= len(metadata_list):
            raise HTTPException(status_code=404, detail="节点不存在")
            
        item = metadata_list[index]
        children = []
        
        # 添加基本属性
        basic_props = [
            {"key": "pointer", "title": "指针", "value": item.get("pointer")},
            {"key": "product_id", "title": "产品ID", "value": item.get("product_id")},
            {"key": "name", "title": "名称", "value": item.get("name")},
            {"key": "layer", "title": "图层", "value": item.get("layer")},
            {"key": "style", "title": "样式", "value": item.get("style")},
            {"key": "behaviour", "title": "行为", "value": item.get("behaviour")},
            {"key": "modeller_type", "title": "建模类型", "value": item.get("modeller_type")},
            {"key": "product_load_status", "title": "产品加载状态", "value": item.get("product_load_status")},
            {"key": "product_flag", "title": "产品标记", "value": item.get("product_flag")},
            {"key": "unit", "title": "单位", "value": item.get("unit")},
            {"key": "density_volume_unit", "title": "体积密度单位", "value": item.get("density_volume_unit")},
            {"key": "density_mass_unit", "title": "质量密度单位", "value": item.get("density_mass_unit")},
            {"key": "unit_from_cad", "title": "CAD单位", "value": item.get("unit_from_cad")},
            {"key": "rgb", "title": "RGB颜色", "value": item.get("rgb")}
        ]
        
        for prop in basic_props:
            if prop["value"]:
                children.append({
                    "key": f"{parent_key}-{prop['key']}",
                    "title": f"{prop['title']}: {prop['value']}",
                    "isLeaf": True
                })
        
        # 添加用户数据
        user_data = item.get("user_data", {})
        if user_data:
            children.append({
                "key": f"{parent_key}-user-data",
                "title": f"用户数据 ({len(user_data)} 项)",
                "isLeaf": False,
                "hasChildren": True,
                "userData": user_data
            })
        
        return {
            "nodes": children,
            "total": len(children),
            "hasMore": False,
            "parentKey": parent_key
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取元数据节点失败: {str(e)}")

@router.get("/{file_id}/user-data/{parent_key}")
async def get_user_data_nodes(file_id: str, parent_key: str):
    """
    获取用户数据子节点
    
    Args:
        file_id: 文件ID  
        parent_key: 父节点key，格式为 metadata-{index}-user-data
        
    Returns:
        dict: 用户数据节点列表
    """
    try:
        # 从parent_key解析索引
        parts = parent_key.split('-')
        if len(parts) < 4 or parts[3] != "data":
            raise HTTPException(status_code=400, detail="无效的父节点key")
            
        index = int(parts[1])
        
        # 获取缓存数据
        cache_key = f"metadata:{file_id}"
        cached_data = redis_service.redis_client.get(cache_key)
        
        if cached_data:
            metadata_list = json.loads(cached_data)
        else:
            db = AsyncIOMotorClient(MONGO_URL).get_database()
            cursor = db.metadata.find({"file_id": file_id})
            metadata_list = await cursor.to_list(length=None)
            
        if index >= len(metadata_list):
            raise HTTPException(status_code=404, detail="节点不存在")
            
        item = metadata_list[index]
        user_data = item.get("user_data", {})
        
        children = []
        for title, values in user_data.items():
            child_nodes = []
            for i, value in enumerate(values):
                child_nodes.append({
                    "key": f"{parent_key}-{title}-{i}",
                    "title": f"{value.get('Title', '')}: {value.get('Value', '')} ({value.get('Type', '')})",
                    "isLeaf": True
                })
            
            children.append({
                "key": f"{parent_key}-{title}",
                "title": f"{title} ({len(values)} 项)",
                "children": child_nodes
            })
        
        return {
            "nodes": children,
            "total": len(children),
            "parentKey": parent_key
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取用户数据节点失败: {str(e)}")

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