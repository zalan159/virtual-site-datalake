from fastapi import APIRouter, Depends, HTTPException, status
from typing import Optional, List
import httpx
from app.models.user import UserInDB
from app.auth.utils import get_current_active_user
from app.core.minio_client import minio_client, CONVERTED_BUCKET_NAME
import os
import tempfile
import asyncio
from pydantic import BaseModel
import logging
from io import BytesIO

# 配置日志
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

router = APIRouter()

# 修改Sketchfab API URL，使用正确的OAuth2认证端点
SKETCHFAB_API_URL = "https://api.sketchfab.com/v3"
SKETCHFAB_AUTH_URL = "https://sketchfab.com/oauth2/token/"  # 确保以斜杠结尾

# 添加Pydantic模型用于接收请求体
class SketchfabAuthRequest(BaseModel):
    username: str
    password: str

@router.post("/auth", response_model=dict)
async def sketchfab_auth(auth_data: SketchfabAuthRequest):
    """
    使用用户名和密码获取Sketchfab API token
    """
    try:
        logger.debug(f"接收到的认证数据: username={auth_data.username}, password长度={len(auth_data.password)}")
        
        # 创建支持自动跟随重定向的客户端
        async with httpx.AsyncClient(follow_redirects=True) as client:
            logger.debug(f"准备发送请求到: {SKETCHFAB_AUTH_URL}")
            
            # 构建请求数据
            request_data = {
                "username": auth_data.username,
                "password": auth_data.password,
                "grant_type": "password"
            }
            logger.debug(f"请求数据: {request_data}")
            
            response = await client.post(
                SKETCHFAB_AUTH_URL,
                data=request_data
            )
            
            logger.debug(f"Sketchfab API响应状态码: {response.status_code}")
            logger.debug(f"Sketchfab API响应内容: {response.text}")
            
            if response.status_code != 200:
                logger.error(f"Sketchfab认证失败: 状态码={response.status_code}, 响应={response.text}")
                raise HTTPException(
                    status_code=response.status_code,
                    detail=f"Sketchfab认证失败: {response.text}"
                )
                
            return response.json()
    except Exception as e:
        logger.exception("Sketchfab认证过程中发生异常")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/models", response_model=dict)
async def list_models(
    token: str,
    search: Optional[str] = None,
    sort_by: Optional[str] = None,
    current_user: UserInDB = Depends(get_current_active_user)
):
    """
    获取Sketchfab模型列表
    """
    try:
        headers = {"Authorization": f"Bearer {token}"}
        params = {}
        
        if search:
            params["q"] = search
        if sort_by:
            params["sort_by"] = sort_by
            
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{SKETCHFAB_API_URL}/models",
                headers=headers,
                params=params
            )
            
            if response.status_code != 200:
                raise HTTPException(
                    status_code=response.status_code,
                    detail="获取模型列表失败"
                )
                
            return response.json()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/models/{uid}/download", response_model=dict)
async def download_model(
    uid: str,
    token: str,
    current_user: UserInDB = Depends(get_current_active_user)
):
    """
    下载Sketchfab模型并上传到MinIO
    """
    try:
        headers = {"Authorization": f"Bearer {token}"}
        
        # 1. 获取下载信息
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{SKETCHFAB_API_URL}/models/{uid}/download",
                headers=headers
            )
            
            if response.status_code != 200:
                raise HTTPException(
                    status_code=response.status_code,
                    detail="获取下载信息失败"
                )
            
            download_info = response.json()
            glb_url = None
            
            # 查找GLB格式的下载链接
            for download in download_info.get("gltf", []):
                if download.get("format") == "glb":
                    glb_url = download.get("url")
                    break
                    
            if not glb_url:
                raise HTTPException(
                    status_code=404,
                    detail="未找到GLB格式的下载链接"
                )
            
            # 2. 下载GLB文件
            response = await client.get(glb_url)
            if response.status_code != 200:
                raise HTTPException(
                    status_code=response.status_code,
                    detail="下载模型失败"
                )
            
            # 3. 上传到MinIO
            file_data = response.content
            file_path = f"{current_user.id}/sketchfab/{uid}.glb"
            
            minio_client.put_object(
                CONVERTED_BUCKET_NAME,
                file_path,
                BytesIO(file_data),
                len(file_data),
                content_type="model/gltf-binary"
            )
            
            return {
                "message": "下载成功",
                "file_path": file_path
            }
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) 