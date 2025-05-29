from fastapi import APIRouter, HTTPException, Depends
from typing import List
from datetime import datetime
from bson import ObjectId

from app.models.stream import StreamCreate, StreamInDB
from app.auth.utils import get_current_user, db

router = APIRouter()

@router.post("/create", response_model=StreamInDB)
async def create_stream(
    stream: StreamCreate,
    current_user = Depends(get_current_user)
):
    stream_dict = stream.model_dump()
    stream_dict["create_time"] = datetime.utcnow()
    stream_dict["owner"] = current_user.username
    result = await db.streams.insert_one(stream_dict)
    stream_dict["_id"] = result.inserted_id
    return StreamInDB(**stream_dict)

@router.get("/list", response_model=List[StreamInDB])
async def list_streams(
    current_user = Depends(get_current_user)
):
    streams = await db.streams.find({"owner": current_user.username}).to_list(length=None)
    return [StreamInDB(**stream) for stream in streams]

@router.get("/{stream_id}", response_model=StreamInDB)
async def get_stream(
    stream_id: str,
    current_user = Depends(get_current_user)
):
    stream = await db.streams.find_one({"_id": ObjectId(stream_id), "owner": current_user.username})
    if not stream:
        raise HTTPException(status_code=404, detail="视频流不存在")
    return StreamInDB(**stream)

@router.put("/{stream_id}", response_model=StreamInDB)
async def update_stream(
    stream_id: str,
    stream: StreamCreate,
    current_user = Depends(get_current_user)
):
    # 先检查文档是否存在
    existing = await db.streams.find_one({"_id": ObjectId(stream_id), "owner": current_user.username})
    if not existing:
        raise HTTPException(status_code=404, detail="视频流不存在")
    
    # 只更新允许的字段，排除owner
    update_data = stream.model_dump(exclude_unset=True, exclude={"owner"})
    result = await db.streams.update_one(
        {"_id": ObjectId(stream_id), "owner": current_user.username},
        {"$set": update_data}
    )
    
    # 获取更新后的文档
    updated = await db.streams.find_one({"_id": ObjectId(stream_id), "owner": current_user.username})
    if not updated:
        raise HTTPException(status_code=404, detail="更新后未找到视频流数据")
    
    return StreamInDB(**updated)

@router.delete("/{stream_id}")
async def delete_stream(
    stream_id: str,
    current_user = Depends(get_current_user)
):
    result = await db.streams.delete_one({"_id": ObjectId(stream_id), "owner": current_user.username})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="视频流不存在")
    return {"message": "视频流删除成功"} 