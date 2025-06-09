from fastapi import APIRouter, HTTPException, Depends, Query, UploadFile, File, Form
from typing import List, Optional, Dict, Any
from datetime import datetime
import json
import base64

from app.models.chart import (
    Chart, ChartTemplate,
    ChartResponse
)
from app.auth.utils import get_current_user_optional, get_current_active_user
from app.models.user import UserInDB
import os
from app.core.minio_client import MinioClient
from pydantic import BaseModel

router = APIRouter(prefix="/api/goview", tags=["goview"])
minio_client = MinioClient()





class ProjectListItem(BaseModel):
    """GoView项目列表项"""
    id: str
    projectName: str
    state: int  # -1: 未发布, 1: 已发布
    createTime: str
    indexImage: str
    createUserId: str
    remarks: str


class ProjectDetail(BaseModel):
    """GoView项目详情"""
    id: str
    projectName: str
    state: int
    createTime: str
    indexImage: str
    createUserId: str
    remarks: str
    content: str  # 项目配置JSON字符串


class CreateProjectRequest(BaseModel):
    """创建项目请求"""
    projectName: str
    remarks: Optional[str] = ""


class SaveProjectRequest(BaseModel):
    """保存项目请求"""
    projectId: str
    content: str


class EditProjectRequest(BaseModel):
    """编辑项目请求"""
    id: str
    projectName: Optional[str] = None
    remarks: Optional[str] = None
    indexImage: Optional[str] = None  # 新增预览图字段


class PublishProjectRequest(BaseModel):
    """发布项目请求"""
    id: str
    state: int  # -1: 取消发布, 1: 发布


@router.get("/project/list")
async def get_project_list(
    current_user: dict = Depends(get_current_user_optional)
):
    """获取项目列表 - 使用token进行权限隔离"""
    try:
        # 检查用户认证
        if not current_user:
            return {
                "code": 200,
                "data": [],
                "count": 0,
                "message": "success"
            }
        
        user_id = current_user.get("user_id")
        if not user_id:
            return {
                "code": 200,
                "data": [],
                "count": 0,
                "message": "success"
            }
        
        # 获取用户的图表项目，使用owner_id进行权限隔离
        try:
            charts = Chart.nodes.filter(owner_id=user_id).order_by("-updated_at")
            
            projects = []
            for chart in charts:
                # 转换为GoView期望的格式
                project = ProjectListItem(
                    id=chart.uid,
                    projectName=chart.name,
                    state=1 if chart.status == "published" else -1,
                    createTime=chart.created_at.isoformat(),
                    indexImage=chart.preview_image or "",
                    createUserId=chart.owner_id,
                    remarks=chart.description or ""
                )
                projects.append(project)
        except Exception as e:
            print(f"查询图表失败: {str(e)}")
            projects = []
        
        return {
            "code": 200,
            "data": [project.model_dump() for project in projects],
            "count": len(projects),
            "message": "success"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取项目列表失败: {str(e)}")


@router.post("/project/create")
async def create_project(
    request: CreateProjectRequest,
    current_user: dict = Depends(get_current_user_optional)
):
    """创建新项目"""
    try:
        # 检查用户认证
        if not current_user:
            raise HTTPException(status_code=401, detail="需要登录才能创建项目")
        
        user_id = current_user.get("user_id")
        if not user_id:
            raise HTTPException(status_code=401, detail="用户ID无效")
        
        # 创建新的图表项目
        # 默认的GoView画布配置，参考chartEditStore.ts的默认值
        default_config = {
            "editCanvasConfig": {
                "width": 1920,
                "height": 1080,
                "filterShow": False,
                "hueRotate": 0,
                "saturate": 1,
                "contrast": 1,
                "brightness": 1,
                "opacity": 1,
                "rotateZ": 0,
                "rotateX": 0,
                "rotateY": 0,
                "skewX": 0,
                "skewY": 0,
                "blendMode": "normal",
                "background": "rgba(13, 42, 67, 1)",
                "backgroundImage": None,
                "selectColor": True,
                "chartThemeColor": "dark",
                "chartCustomThemeColorInfo": None,
                "chartThemeSetting": {
                    "color": [
                        "#00BAFF",
                        "#3DE7C9",
                        "#FF6C6C",
                        "#FFE700",
                        "#8A2BE2",
                        "#00CED1",
                        "#FF1493",
                        "#228B22"
                    ]
                },
                "previewScaleType": "fit"
            },
            "requestGlobalConfig": {
                "requestDataPond": [],
                "requestOriginUrl": "",
                "requestInterval": 30,
                "requestIntervalUnit": "second",
                "requestParams": {
                    "Body": {
                        "form-data": {},
                        "x-www-form-urlencoded": {},
                        "json": "",
                        "xml": ""
                    },
                    "Header": {},
                    "Params": {}
                }
            },
            "componentList": []
        }
        
        chart = Chart(
            name=request.projectName,
            description=request.remarks,
            owner=user_id,  # 保持兼容性
            owner_id=user_id,  # 权限隔离字段
            config=default_config,
            status="draft"
        ).save()
        
        return {
            "code": 200,
            "data": {"id": chart.uid},
            "message": "创建成功"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"创建项目失败: {str(e)}")


@router.get("/project/getData")
async def get_project_data(
    projectId: str = Query(..., alias="projectId"),
    current_user: dict = Depends(get_current_user_optional)
):
    """获取项目数据"""
    try:
        chart = Chart.nodes.get_or_none(uid=projectId)
        if not chart:
            raise HTTPException(status_code=404, detail="项目不存在")
        
        # 处理配置数据
        content_str = "{}"
        if chart.config:
            if isinstance(chart.config, str):
                # 如果config是字符串，检查是否是函数字符串
                if chart.config.strip().startswith('function'):
                    print(f"警告: 数据库中存储了函数字符串，项目ID: {projectId}")
                    # 使用默认配置
                    default_config = {
                        "editCanvasConfig": {
                            "width": 1920,
                            "height": 1080,
                            "background": "#ffffff"
                        },
                        "componentList": []
                    }
                    content_str = json.dumps(default_config)
                    # 同时更新数据库
                    chart.config = default_config
                    chart.save()
                else:
                    # 字符串形式的JSON
                    content_str = chart.config
            else:
                # 对象形式，序列化为JSON
                content_str = json.dumps(chart.config)
        
        # 构造GoView期望的格式
        project_detail = ProjectDetail(
            id=chart.uid,
            projectName=chart.name,
            state=1 if chart.status == "published" else -1,
            createTime=chart.created_at.isoformat(),
            indexImage=chart.preview_image or "",
            createUserId=chart.owner,
            remarks=chart.description or "",
            content=content_str
        )
        
        print(f"项目 {projectId} 数据获取成功，content长度: {len(content_str)}")
        
        return {
            "code": 200,
            "data": project_detail.model_dump(),
            "message": "success"
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取项目数据失败: {str(e)}")


@router.post("/project/save/data")
async def save_project_data(
    projectId: str = Form(...),
    content: str = Form(...),
    current_user: dict = Depends(get_current_user_optional)
):
    """保存项目数据"""
    try:
        chart = Chart.nodes.get_or_none(uid=projectId)
        if not chart:
            raise HTTPException(status_code=404, detail="项目不存在")
        
        # 解析并保存项目配置
        try:
            # 检查content是否是函数字符串（异常情况）
            if content.strip().startswith('function'):
                print(f"警告: 接收到函数字符串作为content: {content[:100]}...")
                # 如果是函数字符串，使用默认配置
                config_data = {
                    "editCanvasConfig": {
                        "width": 1920,
                        "height": 1080,
                        "background": "#ffffff"
                    },
                    "componentList": []
                }
            else:
                config_data = json.loads(content)
            
            chart.config = config_data
            chart.save()
            print(f"成功保存项目 {projectId} 的配置数据")
        except json.JSONDecodeError as e:
            print(f"JSON解析错误: {str(e)}, content: {content[:200]}...")
            raise HTTPException(status_code=400, detail="项目配置格式错误")
        
        return {
            "code": 200,
            "data": None,
            "message": "保存成功"
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"保存项目数据失败: {str(e)}")


@router.post("/project/edit")
async def edit_project(
    request: EditProjectRequest,
    current_user: dict = Depends(get_current_user_optional)
):
    """编辑项目基础信息"""
    try:
        chart = Chart.nodes.get_or_none(uid=request.id)
        if not chart:
            raise HTTPException(status_code=404, detail="项目不存在")
        
        # 更新项目信息
        if request.projectName:
            chart.name = request.projectName
        if request.remarks is not None:
            chart.description = request.remarks
        if request.indexImage is not None:  # 新增预览图更新逻辑
            # 如果有旧的预览图，先删除
            if chart.preview_image and chart.preview_image != request.indexImage:
                try:
                    # 提取文件名
                    old_object_name = chart.preview_image.split('/')[-1]
                    # 从MinIO删除旧预览图
                    minio_client.remove_object("goview-files", old_object_name)
                except Exception as e:
                    print(f"删除旧预览图失败: {str(e)}")
            
            chart.preview_image = request.indexImage
        
        chart.save()
        
        return {
            "code": 200,
            "data": None,
            "message": "编辑成功"
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"编辑项目失败: {str(e)}")


@router.delete("/project/delete")
async def delete_project(
    ids: str = Query(...),  # 改为ids以匹配前端参数名
    current_user: dict = Depends(get_current_user_optional)
):
    """删除项目"""
    try:
        chart = Chart.nodes.get_or_none(uid=ids)
        if not chart:
            raise HTTPException(status_code=404, detail="项目不存在")
        
        # 删除预览图
        if chart.preview_image:
            try:
                object_name = chart.preview_image.split('/')[-1]
                minio_client.remove_object("chart-previews", object_name)
            except Exception as e:
                print(f"删除预览图失败: {str(e)}")
        
        chart.delete()
        
        return {
            "code": 200,
            "data": None,
            "message": "删除成功"
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"删除项目失败: {str(e)}")


@router.put("/project/publish")
async def publish_project(
    request: PublishProjectRequest,
    current_user: dict = Depends(get_current_user_optional)
):
    """发布/取消发布项目"""
    try:
        chart = Chart.nodes.get_or_none(uid=request.id)
        if not chart:
            raise HTTPException(status_code=404, detail="项目不存在")
        
        # 更新发布状态
        chart.status = "published" if request.state == 1 else "draft"
        chart.save()
        
        return {
            "code": 200,
            "data": None,
            "message": "状态更新成功"
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"更新状态失败: {str(e)}")


@router.post("/project/upload")
async def upload_file_for_project(
    object: UploadFile = File(...),  # 改为object以匹配前端参数名
    current_user: dict = Depends(get_current_user_optional)
):
    """上传文件"""
    try:
        # 读取文件内容
        file_content = await object.read()
        
        # 生成文件名
        timestamp = int(datetime.now().timestamp())
        file_name = f"goview_upload_{timestamp}_{object.filename}"
        
        # 上传到MinIO
        file_url = minio_client.upload_file_data(
            bucket_name="goview-files",
            object_name=file_name,
            file_data=file_content,
            content_type=object.content_type or "application/octet-stream"
        )
        
        return {
            "code": 200,
            "data": {
                "fileName": object.filename,
                "fileurl": file_url
            },
            "message": "上传成功"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"上传文件失败: {str(e)}")


# 系统相关接口
@router.get("/sys/getOssInfo")
async def get_oss_info():
    """获取OSS信息（GoView需要）"""
    return {
        "code": 200,
        "data": {
            "region": "us-east-1",
            "accessKeyId": "",
            "accessKeySecret": "",
            "bucketName": "goview-files"
        },
        "message": "success"
    } 