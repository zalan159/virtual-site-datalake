"""
MQTT连接配置路由

管理MQTT broker连接配置的CRUD操作，用于前端驱动的IoT绑定系统。
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from typing import List
import logging
from datetime import datetime
from bson import ObjectId
from pymongo import ReturnDocument

from app.db.mongo_db import get_database
from app.models.mqtt import MQTTCreate, MQTTInDB, MQTTUpdate
from app.auth.utils import get_current_active_user

logger = logging.getLogger(__name__)

router = APIRouter()

@router.post("/", response_model=MQTTInDB)
async def create_mqtt_config(
    mqtt_data: MQTTCreate,
    db=Depends(get_database),
    user=Depends(get_current_active_user)
):
    """Create a new MQTT connection configuration"""
    try:
        mqtt_dict = mqtt_data.model_dump(exclude_unset=True)
        mqtt_dict["created_at"] = datetime.utcnow()
        mqtt_dict["updated_at"] = datetime.utcnow()
        
        # Auto-generate client_id if not provided
        if not mqtt_dict.get("client_id"):
            mqtt_dict["client_id"] = f"iot_client_{ObjectId()}"
        
        result = await db.mqtt_sources.insert_one(mqtt_dict)
        
        created_doc = await db.mqtt_sources.find_one({"_id": result.inserted_id})
        if not created_doc:
            raise HTTPException(status_code=500, detail="Failed to retrieve created MQTT configuration")
            
        return created_doc
    except Exception as e:
        logger.error(f"Error creating MQTT configuration: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/", response_model=List[MQTTInDB])
async def get_mqtt_config_list(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db=Depends(get_database),
    user=Depends(get_current_active_user)
):
    """Get paginated list of MQTT connection configurations"""
    try:
        cursor = db.mqtt_sources.find({}).skip(skip).limit(limit).sort("created_at", -1)
        mqtt_list = await cursor.to_list(length=limit)
        return mqtt_list
    except Exception as e:
        logger.error(f"Error getting MQTT configuration list: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{mqtt_id}", response_model=MQTTInDB)
async def get_mqtt_config_by_id(
    mqtt_id: str,
    db=Depends(get_database),
    user=Depends(get_current_active_user)
):
    """Get MQTT connection configuration by ID"""
    if not ObjectId.is_valid(mqtt_id):
        raise HTTPException(status_code=400, detail=f"'{mqtt_id}' is not a valid ObjectId")
        
    try:
        doc = await db.mqtt_sources.find_one({"_id": ObjectId(mqtt_id)})
        if not doc:
            raise HTTPException(status_code=404, detail="MQTT configuration not found")
        return doc
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting MQTT configuration by ID: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/{mqtt_id}", response_model=MQTTInDB)
async def update_mqtt_config(
    mqtt_id: str,
    update_data: MQTTUpdate,
    db=Depends(get_database),
    user=Depends(get_current_active_user)
):
    """Update MQTT connection configuration"""
    if not ObjectId.is_valid(mqtt_id):
        raise HTTPException(status_code=400, detail=f"'{mqtt_id}' is not a valid ObjectId")
        
    try:
        update_dict = update_data.model_dump(exclude_unset=True)
        update_dict["updated_at"] = datetime.utcnow()
        
        doc = await db.mqtt_sources.find_one_and_update(
            {"_id": ObjectId(mqtt_id)},
            {"$set": update_dict},
            return_document=ReturnDocument.AFTER
        )
        
        if not doc:
            raise HTTPException(status_code=404, detail="MQTT configuration not found")
        
        return doc
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating MQTT configuration: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{mqtt_id}", status_code=204)
async def delete_mqtt_config(
    mqtt_id: str,
    db=Depends(get_database),
    user=Depends(get_current_active_user)
):
    """Delete MQTT connection configuration"""
    if not ObjectId.is_valid(mqtt_id):
        raise HTTPException(status_code=400, detail=f"'{mqtt_id}' is not a valid ObjectId")
        
    try:
        result = await db.mqtt_sources.delete_one({"_id": ObjectId(mqtt_id)})
        
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="MQTT configuration not found")
        
        return
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting MQTT configuration: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{mqtt_id}/test")
async def test_mqtt_connection(
    mqtt_id: str,
    db=Depends(get_database),
    user=Depends(get_current_active_user)
):
    """Test MQTT connection configuration"""
    if not ObjectId.is_valid(mqtt_id):
        raise HTTPException(status_code=400, detail=f"'{mqtt_id}' is not a valid ObjectId")
        
    try:
        mqtt_config = await db.mqtt_sources.find_one({"_id": ObjectId(mqtt_id)})
        if not mqtt_config:
            raise HTTPException(status_code=404, detail="MQTT configuration not found")
        
        # Note: Actual connection testing should be implemented by frontend
        # This endpoint provides configuration validation and basic checks
        
        validation_result = {
            "valid": True,
            "errors": [],
            "warnings": []
        }
        
        # Basic validation
        if not mqtt_config.get("hostname"):
            validation_result["errors"].append("Hostname is required")
            
        port = mqtt_config.get("port", 1883)
        if not (1 <= port <= 65535):
            validation_result["errors"].append("Port must be between 1 and 65535")
            
        # TLS validation
        if mqtt_config.get("use_tls") and mqtt_config.get("tls_insecure"):
            validation_result["warnings"].append("TLS is enabled but certificate verification is disabled")
            
        # Authentication validation
        auth_type = mqtt_config.get("auth_type", "none")
        if auth_type == "username_password":
            if not mqtt_config.get("username"):
                validation_result["errors"].append("Username is required for username/password authentication")
                
        validation_result["valid"] = len(validation_result["errors"]) == 0
        
        return {
            "config_id": mqtt_id,
            "connection_test": "frontend_driven",
            "validation": validation_result,
            "message": "Use frontend MQTT client to test actual connection"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error testing MQTT connection: {e}")
        raise HTTPException(status_code=500, detail=str(e)) 