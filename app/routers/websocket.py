from fastapi import APIRouter, Depends, HTTPException, Query
from typing import List
import logging
from datetime import datetime
from bson import ObjectId
from pymongo import ReturnDocument

from app.db.mongo_db import get_database
from app.models.websocket import WebSocketCreate, WebSocketInDB, WebSocketUpdate
from app.auth.utils import get_current_active_user

logger = logging.getLogger(__name__)

router = APIRouter()

@router.post("/", response_model=WebSocketInDB)
async def create_websocket(
    websocket_data: WebSocketCreate,
    db=Depends(get_database),
    user=Depends(get_current_active_user)
):
    """Create a new WebSocket data source"""
    try:
        websocket_dict = websocket_data.model_dump(exclude_unset=True)
        websocket_dict["created_at"] = datetime.utcnow()
        websocket_dict["updated_at"] = datetime.utcnow()
        
        result = await db.websocket_sources.insert_one(websocket_dict)
        
        created_doc = await db.websocket_sources.find_one({"_id": result.inserted_id})
        if not created_doc:
            raise HTTPException(status_code=500, detail="Failed to retrieve created WebSocket data source")
            
        return created_doc
    except Exception as e:
        logger.error(f"Error creating WebSocket: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/", response_model=List[WebSocketInDB])
async def get_websocket_list(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db=Depends(get_database),
    user=Depends(get_current_active_user)
):
    """Get paginated list of WebSocket data sources"""
    try:
        cursor = db.websocket_sources.find({}).skip(skip).limit(limit).sort("created_at", -1)
        websockets_list = await cursor.to_list(length=limit)
        return websockets_list
    except Exception as e:
        logger.error(f"Error getting WebSocket list: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{websocket_id}", response_model=WebSocketInDB)
async def get_websocket_by_id(
    websocket_id: str,
    db=Depends(get_database),
    user=Depends(get_current_active_user)
):
    """Get WebSocket data source by ID"""
    if not ObjectId.is_valid(websocket_id):
        raise HTTPException(status_code=400, detail=f"'{websocket_id}' is not a valid ObjectId")
        
    try:
        doc = await db.websocket_sources.find_one({"_id": ObjectId(websocket_id)})
        if not doc:
            raise HTTPException(status_code=404, detail="WebSocket not found")
        return doc
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting WebSocket by ID: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/{websocket_id}", response_model=WebSocketInDB)
async def update_websocket(
    websocket_id: str,
    update_data: WebSocketUpdate,
    db=Depends(get_database),
    user=Depends(get_current_active_user)
):
    """Update WebSocket data source"""
    if not ObjectId.is_valid(websocket_id):
        raise HTTPException(status_code=400, detail=f"'{websocket_id}' is not a valid ObjectId")
        
    try:
        update_dict = update_data.model_dump(exclude_unset=True)
        update_dict["updated_at"] = datetime.utcnow()
        
        doc = await db.websocket_sources.find_one_and_update(
            {"_id": ObjectId(websocket_id)},
            {"$set": update_dict},
            return_document=ReturnDocument.AFTER
        )
        
        if not doc:
            raise HTTPException(status_code=404, detail="WebSocket not found")
        
        return doc
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating WebSocket: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{websocket_id}", status_code=204)
async def delete_websocket(
    websocket_id: str,
    db=Depends(get_database),
    user=Depends(get_current_active_user)
):
    """Delete WebSocket data source"""
    if not ObjectId.is_valid(websocket_id):
        raise HTTPException(status_code=400, detail=f"'{websocket_id}' is not a valid ObjectId")
        
    try:
        result = await db.websocket_sources.delete_one({"_id": ObjectId(websocket_id)})
        
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="WebSocket not found")
        
        return
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting WebSocket: {e}")
        raise HTTPException(status_code=500, detail=str(e))