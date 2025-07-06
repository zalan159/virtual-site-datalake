"""
HTTP连接配置路由

管理HTTP/HTTPS连接配置的CRUD操作，用于前端驱动的IoT绑定系统。
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from typing import List
import logging
from datetime import datetime
from bson import ObjectId
from pymongo import ReturnDocument

from app.db.mongo_db import get_database
from app.models.http import HTTPCreate, HTTPInDB, HTTPUpdate
from app.auth.utils import get_current_active_user

logger = logging.getLogger(__name__)

router = APIRouter()

@router.post("/", response_model=HTTPInDB)
async def create_http_config(
    http_data: HTTPCreate,
    db=Depends(get_database),
    user=Depends(get_current_active_user)
):
    """Create a new HTTP connection configuration"""
    try:
        http_dict = http_data.model_dump(exclude_unset=True)
        http_dict["created_at"] = datetime.utcnow()
        http_dict["updated_at"] = datetime.utcnow()
        
        result = await db.http_sources.insert_one(http_dict)
        
        created_doc = await db.http_sources.find_one({"_id": result.inserted_id})
        if not created_doc:
            raise HTTPException(status_code=500, detail="Failed to retrieve created HTTP configuration")
            
        return created_doc
    except Exception as e:
        logger.error(f"Error creating HTTP configuration: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/", response_model=List[HTTPInDB])
async def get_http_config_list(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db=Depends(get_database),
    user=Depends(get_current_active_user)
):
    """Get paginated list of HTTP connection configurations"""
    try:
        cursor = db.http_sources.find({}).skip(skip).limit(limit).sort("created_at", -1)
        http_list = await cursor.to_list(length=limit)
        return http_list
    except Exception as e:
        logger.error(f"Error getting HTTP configuration list: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{http_id}", response_model=HTTPInDB)
async def get_http_config_by_id(
    http_id: str,
    db=Depends(get_database),
    user=Depends(get_current_active_user)
):
    """Get HTTP connection configuration by ID"""
    if not ObjectId.is_valid(http_id):
        raise HTTPException(status_code=400, detail=f"'{http_id}' is not a valid ObjectId")
        
    try:
        doc = await db.http_sources.find_one({"_id": ObjectId(http_id)})
        if not doc:
            raise HTTPException(status_code=404, detail="HTTP configuration not found")
        return doc
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting HTTP configuration by ID: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/{http_id}", response_model=HTTPInDB)
async def update_http_config(
    http_id: str,
    update_data: HTTPUpdate,
    db=Depends(get_database),
    user=Depends(get_current_active_user)
):
    """Update HTTP connection configuration"""
    if not ObjectId.is_valid(http_id):
        raise HTTPException(status_code=400, detail=f"'{http_id}' is not a valid ObjectId")
        
    try:
        update_dict = update_data.model_dump(exclude_unset=True)
        update_dict["updated_at"] = datetime.utcnow()
        
        doc = await db.http_sources.find_one_and_update(
            {"_id": ObjectId(http_id)},
            {"$set": update_dict},
            return_document=ReturnDocument.AFTER
        )
        
        if not doc:
            raise HTTPException(status_code=404, detail="HTTP configuration not found")
        
        return doc
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating HTTP configuration: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{http_id}", status_code=204)
async def delete_http_config(
    http_id: str,
    db=Depends(get_database),
    user=Depends(get_current_active_user)
):
    """Delete HTTP connection configuration"""
    if not ObjectId.is_valid(http_id):
        raise HTTPException(status_code=400, detail=f"'{http_id}' is not a valid ObjectId")
        
    try:
        result = await db.http_sources.delete_one({"_id": ObjectId(http_id)})
        
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="HTTP configuration not found")
        
        return
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting HTTP configuration: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{http_id}/test")
async def test_http_connection(
    http_id: str,
    db=Depends(get_database),
    user=Depends(get_current_active_user)
):
    """Test HTTP connection configuration"""
    if not ObjectId.is_valid(http_id):
        raise HTTPException(status_code=400, detail=f"'{http_id}' is not a valid ObjectId")
        
    try:
        http_config = await db.http_sources.find_one({"_id": ObjectId(http_id)})
        if not http_config:
            raise HTTPException(status_code=404, detail="HTTP configuration not found")
        
        # Note: Actual connection testing should be implemented by frontend
        # This endpoint provides configuration validation and basic checks
        
        validation_result = {
            "valid": True,
            "errors": [],
            "warnings": []
        }
        
        # Basic validation
        if not http_config.get("base_url"):
            validation_result["errors"].append("Base URL is required")
        else:
            base_url = http_config.get("base_url")
            if not base_url.startswith(("http://", "https://")):
                validation_result["errors"].append("Base URL must start with http:// or https://")
            
        # Timeout validation
        timeout = http_config.get("timeout", 30)
        if timeout <= 0:
            validation_result["errors"].append("Timeout must be greater than 0")
            
        # Method validation
        method = http_config.get("method", "GET")
        if method not in ["GET", "POST", "PUT", "DELETE", "PATCH"]:
            validation_result["errors"].append("Invalid HTTP method")
            
        # Authentication validation
        auth_type = http_config.get("auth_type", "none")
        if auth_type == "basic":
            if not http_config.get("auth_username"):
                validation_result["errors"].append("Username is required for basic authentication")
        elif auth_type == "bearer":
            if not http_config.get("auth_token"):
                validation_result["errors"].append("Token is required for bearer authentication")
        elif auth_type == "api_key":
            if not http_config.get("api_key"):
                validation_result["errors"].append("API key is required for API key authentication")
        elif auth_type == "oauth2":
            if not http_config.get("oauth2_client_id"):
                validation_result["errors"].append("Client ID is required for OAuth2 authentication")
            if not http_config.get("oauth2_token_url"):
                validation_result["errors"].append("Token URL is required for OAuth2 authentication")
                
        # SSL validation
        if not http_config.get("verify_ssl", True):
            validation_result["warnings"].append("SSL certificate verification is disabled")
            
        # Polling validation
        if http_config.get("poll_enabled", False):
            poll_interval = http_config.get("poll_interval")
            if not poll_interval or poll_interval <= 0:
                validation_result["errors"].append("Poll interval must be greater than 0 when polling is enabled")
                
        validation_result["valid"] = len(validation_result["errors"]) == 0
        
        return {
            "config_id": http_id,
            "connection_test": "frontend_driven",
            "validation": validation_result,
            "message": "Use frontend HTTP client to test actual connection"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error testing HTTP connection: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{http_id}/execute")
async def execute_http_request(
    http_id: str,
    db=Depends(get_database),
    user=Depends(get_current_active_user)
):
    """Execute a single HTTP request for testing (returns configuration for frontend execution)"""
    if not ObjectId.is_valid(http_id):
        raise HTTPException(status_code=400, detail=f"'{http_id}' is not a valid ObjectId")
        
    try:
        http_config = await db.http_sources.find_one({"_id": ObjectId(http_id)})
        if not http_config:
            raise HTTPException(status_code=404, detail="HTTP configuration not found")
        
        # Return configuration for frontend to execute
        # Remove sensitive information from response
        safe_config = {
            "id": str(http_config["_id"]),
            "name": http_config.get("name"),
            "base_url": http_config.get("base_url"),
            "method": http_config.get("method", "GET"),
            "headers": http_config.get("headers", {}),
            "default_params": http_config.get("default_params", {}),
            "timeout": http_config.get("timeout", 30),
            "response_format": http_config.get("response_format", "json"),
            "json_path": http_config.get("json_path"),
            "encoding": http_config.get("encoding", "utf-8"),
            "execution_mode": "frontend_driven",
            "message": "Execute this request using frontend HTTP client"
        }
        
        return safe_config
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error preparing HTTP request execution: {e}")
        raise HTTPException(status_code=500, detail=str(e)) 