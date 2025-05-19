from fastapi import APIRouter, Depends, HTTPException, Body, Query
from typing import List, Optional, Dict, Any
from app.auth.utils import get_current_active_user, db
from app.models.user import UserInDB
from app.models.scene import Scene, Instance
from bson import ObjectId
from datetime import datetime
from neomodel import db as neo_db
from app.models.scene import SceneCreate, SceneUpdate, ScenePreviewUpdate, InstanceCreate, InstanceUpdate
import base64
from io import BytesIO
from PIL import Image
import uuid
from app.core.minio_client import minio_client, PREVIEW_BUCKET_NAME
import os

router = APIRouter(tags=["scene"])

# ---------------------- 场景相关接口 ----------------------

@router.post("/scenes", response_model=dict)
async def create_scene(
    data: SceneCreate,
    current_user: UserInDB = Depends(get_current_active_user)
):
    scene = Scene(name=data.name, owner=str(current_user.id))
    if data.origin:
        scene.origin = data.origin
    else:
        scene.origin = {"longitude": 113, "latitude": 23, "height": 50}
    scene.save()
    return {"uid": scene.uid, "name": scene.name, "owner": scene.owner, "origin": scene.origin}

@router.get("/scenes", response_model=List[dict])
async def list_scenes(current_user: UserInDB = Depends(get_current_active_user)):
    scenes = Scene.nodes.filter(owner=str(current_user.id))
    return [{
        "uid": s.uid,
        "name": s.name,
        "created_at": s.created_at,
        "owner": getattr(s, 'owner', None),
        "preview_image": getattr(s, 'preview_image', None)
    } for s in scenes]

@router.get("/scenes/{scene_id}", response_model=dict)
async def get_scene(scene_id: str, current_user: UserInDB = Depends(get_current_active_user)):
    scene = Scene.nodes.get_or_none(uid=scene_id)
    if not scene:
        raise HTTPException(404, "场景不存在")
    
    # 定义字段元数据
    field_metadata = {
        "uid": {
            "display_name": "场景ID",
            "editable": False,
            "type": "string"
        },
        "name": {
            "display_name": "场景名称",
            "editable": True,
            "type": "string"
        },
        "created_at": {
            "display_name": "创建时间",
            "editable": False,
            "type": "datetime"
        },
        "updated_at": {
            "display_name": "更新时间",
            "editable": False,
            "type": "datetime"
        },
        "owner": {
            "display_name": "所有者",
            "editable": False,
            "type": "string"
        },
        "preview_image": {
            "display_name": "预览图",
            "editable": True,
            "type": "image"
        },
        "origin": {
            "display_name": "场景原点",
            "editable": True,
            "type": "object",
            "properties": {
                "longitude": {"display_name": "经度", "type": "number", "min": -180, "max": 180},
                "latitude": {"display_name": "纬度", "type": "number", "min": -90, "max": 90},
                "height": {"display_name": "高程", "type": "number", "min": -10000, "max": 10000}
            }
        }
    }
    
    # 构建场景数据
    scene_data = {
        "uid": scene.uid,
        "name": scene.name,
        "created_at": scene.created_at,
        "updated_at": getattr(scene, 'updated_at', None),
        "owner": getattr(scene, 'owner', None),
        "origin": getattr(scene, 'origin', None),
        "preview_image": getattr(scene, 'preview_image', None)
    }
    
    # 返回带元数据的结果
    return {
        "data": scene_data,
        "metadata": field_metadata
    }

@router.put("/scenes/{scene_id}", response_model=dict)
async def update_scene(scene_id: str, data: SceneUpdate, current_user: UserInDB = Depends(get_current_active_user)):
    scene = Scene.nodes.get_or_none(uid=scene_id)
    if not scene:
        raise HTTPException(404, "场景不存在")
    update_dict = data.model_dump(exclude_unset=True)
    # 不允许通过此接口更新preview_image和只读字段
    for field in ["preview_image", "created_at", "uid", "owner", "root"]:
        update_dict.pop(field, None)
    for key, value in update_dict.items():
        setattr(scene, key, value)
    scene.updated_at = datetime.utcnow()
    scene.save()
    # 返回所有可见字段
    return {"uid": scene.uid, "name": scene.name, "updated_at": scene.updated_at, "origin": getattr(scene, 'origin', None), "owner": getattr(scene, 'owner', None)}

@router.delete("/scenes/{scene_id}", response_model=dict)
async def delete_scene(scene_id: str, current_user: UserInDB = Depends(get_current_active_user)):
    scene = Scene.nodes.get_or_none(uid=scene_id)
    if not scene:
        raise HTTPException(404, "场景不存在")
    # 检查所有instance是否被其他场景引用
    root = scene.root.single()
    if root:
        to_delete = []
        def collect_instances(inst):
            # 检查是否被其他场景引用
            if len(inst.scenes) <= 1:
                to_delete.append(inst)
            for child in inst.children:
                collect_instances(child)
        collect_instances(root)
        # 删除instance及其property
        for inst in to_delete:
            # 删除绑定的property（Mongo）
            if inst.properties and "_id" in inst.properties:
                await db.instance_properties.delete_one({"_id": ObjectId(inst.properties["_id"])})
            inst.delete()
    scene.delete()
    return {"message": "场景及未被引用的实例已删除"}

# ---------------------- Instance相关接口 ----------------------

@router.post("/scenes/{scene_id}/instances", response_model=dict)
async def create_instance(
    scene_id: str,
    data: InstanceCreate,
    current_user: UserInDB = Depends(get_current_active_user)
):
    scene = Scene.nodes.get_or_none(uid=scene_id)
    if not scene:
        raise HTTPException(404, "场景不存在")
    parent = None
    if data.parent_uid:
        parent = Instance.nodes.get_or_none(uid=data.parent_uid)
        if not parent:
            raise HTTPException(404, "父节点不存在")
    inst = Instance(name=data.name)
    
    # 设置资产信息
    if data.asset_id:
        inst.asset_id = data.asset_id
    if data.asset_type:
        inst.asset_type = data.asset_type
        
    if data.transform:
        inst.transform = data.transform
    if data.properties:
        inst.properties = data.properties
    if data.materials:
        inst.materials = data.materials
    if data.iot_binds:
        inst.iot_binds = data.iot_binds
    if data.video_binds:
        inst.video_binds = data.video_binds
    if data.file_binds:
        inst.file_binds = data.file_binds
    inst.save()
    
    if parent:
        parent.children.connect(inst)
    else:
        # 作为场景根节点的子节点
        root = scene.root.single()
        if root:
            root.children.connect(inst)
    # 关联到场景
    inst.scenes.connect(scene)
    return {"uid": inst.uid, "name": inst.name}

@router.get("/scenes/{scene_id}/instances", response_model=List[dict])
async def list_instances(scene_id: str, current_user: UserInDB = Depends(get_current_active_user)):
    scene = Scene.nodes.get_or_none(uid=scene_id)
    if not scene:
        raise HTTPException(404, "场景不存在")
    root = scene.root.single()
    if not root:
        return []
    # 平铺所有instance，但排除根节点
    result = []
    def flatten(inst):
        # 跳过根节点
        if inst != root:
            result.append({
                "uid": inst.uid,
                "name": inst.name,
                "transform": inst.transform,
                "materials": inst.materials,
                "asset_id": inst.asset_id,
                "asset_type": inst.asset_type
            })
        for child in inst.children:
            flatten(child)
    flatten(root)
    return result

@router.get("/scenes/{scene_id}/instance-tree", response_model=dict)
async def get_instance_tree(scene_id: str, current_user: UserInDB = Depends(get_current_active_user)):
    scene = Scene.nodes.get_or_none(uid=scene_id)
    if not scene:
        raise HTTPException(404, "场景不存在")
    root = scene.root.single()
    if not root:
        return {}
    def build_tree(inst):
        return {
            "uid": inst.uid,
            "name": inst.name,
            "asset_id": inst.asset_id,
            "asset_type": inst.asset_type,
            "properties": inst.properties,
            "iot_binds": inst.iot_binds,
            "video_binds": inst.video_binds,
            "file_binds": inst.file_binds,
            "children": [build_tree(child) for child in inst.children]
        }
    return build_tree(root)

@router.put("/instances/{instance_id}", response_model=dict)
async def update_instance(instance_id: str, data: InstanceUpdate, current_user: UserInDB = Depends(get_current_active_user)):
    inst = Instance.nodes.get_or_none(uid=instance_id)
    if not inst:
        raise HTTPException(404, "实例不存在")
    if data.name:
        inst.name = data.name
    if data.asset_id:
        inst.asset_id = data.asset_id
    if data.asset_type:
        inst.asset_type = data.asset_type
    if data.transform:
        inst.transform = data.transform
    if data.properties:
        inst.properties = data.properties
    if data.materials:
        inst.materials = data.materials
    if data.iot_binds:
        inst.iot_binds = data.iot_binds
    if data.video_binds:
        inst.video_binds = data.video_binds
    if data.file_binds:
        inst.file_binds = data.file_binds
    inst.save()
    return {"uid": inst.uid, "name": inst.name}

@router.delete("/instances/{instance_id}", response_model=dict)
async def delete_instance(instance_id: str, current_user: UserInDB = Depends(get_current_active_user)):
    inst = Instance.nodes.get_or_none(uid=instance_id)
    if not inst:
        raise HTTPException(404, "实例不存在")
    # 检查是否被多个场景引用
    if len(inst.scenes) > 1:
        raise HTTPException(400, "该实例被多个场景引用，不能直接删除")
    # 删除绑定的property（Mongo）
    if inst.properties and "_id" in inst.properties:
        await db.instance_properties.delete_one({"_id": ObjectId(inst.properties["_id"])})
    inst.delete()
    return {"message": "实例已删除"}



@router.put("/scenes/{scene_id}/preview-image", response_model=dict)
async def update_scene_preview_image(
    scene_id: str,
    data: ScenePreviewUpdate,
    current_user: UserInDB = Depends(get_current_active_user)
):
    scene = Scene.nodes.get_or_none(uid=scene_id)
    if not scene:
        raise HTTPException(404, "场景不存在")

    # 1. 解析base64字符串
    try:
        header, b64data = data.preview_image.split(',', 1) if ',' in data.preview_image else ('', data.preview_image)
        image_data = base64.b64decode(b64data)
        image = Image.open(BytesIO(image_data))
    except Exception as e:
        raise HTTPException(400, f"图片解码失败: {str(e)}")

    # 2. 保存为PNG到内存
    buffer = BytesIO()
    image.save(buffer, format="PNG")
    buffer.seek(0)

    # 3. 上传到MinIO（preview桶，文件名直接放根目录）
    filename = f"{scene_id}_{uuid.uuid4().hex}.png"
    minio_client.put_object(
        PREVIEW_BUCKET_NAME,
        filename,
        buffer,
        length=buffer.getbuffer().nbytes,
        content_type="image/png"
    )

    # 4. 获取公开URL
    minio_scheme = "https" if os.getenv("MINIO_SECURE", "false").lower() == "true" else "http"
    minio_host = f"{minio_scheme}://{os.getenv('MINIO_HOST')}:{os.getenv('MINIO_PORT')}"
    preview_url = f"{minio_host}/{PREVIEW_BUCKET_NAME}/{filename}"

    # 5. 更新scene
    scene.preview_image = preview_url
    scene.updated_at = datetime.utcnow()
    scene.save()
    return {"uid": scene.uid, "preview_image": scene.preview_image, "updated_at": scene.updated_at}

@router.get("/instances/{instance_id}/bindings", response_model=dict)
async def get_instance_bindings(instance_id: str, current_user: UserInDB = Depends(get_current_active_user)):
    inst = Instance.nodes.get_or_none(uid=instance_id)
    if not inst:
        raise HTTPException(404, "实例不存在")
    return {
        "iot_binds": inst.iot_binds or [],
        "file_binds": inst.file_binds or [],
        "video_binds": inst.video_binds or []
    }

@router.get("/instances/{instance_id}/properties", response_model=dict)
async def get_instance_properties(instance_id: str, current_user: UserInDB = Depends(get_current_active_user)):
    inst = Instance.nodes.get_or_none(uid=instance_id)
    if not inst:
        raise HTTPException(404, "实例不存在")
    
    # 定义字段元数据
    field_metadata = {
        # 增加分组信息
        "groups": [
            {
                "id": "asset",
                "name": "资产信息",
                "fields": ["asset_id", "asset_type", "asset_metadata"]
            },
            {
                "id": "instance",
                "name": "实例属性",
                "fields": ["uid", "name", "transform", "materials", "properties"]
            },
            {
                "id": "bindings",
                "name": "绑定关系",
                "fields": ["iot_binds", "file_binds", "video_binds"]
            }
        ],
        # 各字段的详细元数据
        "fields": {
            # 第一组：资产数据（不可编辑）
            "asset_id": {
                "display_name": "资产ID",
                "editable": False,
                "type": "string"
            },
            "asset_type": {
                "display_name": "资产类型",
                "editable": False,
                "type": "string"
            },
            "asset_metadata": {
                "display_name": "资产元数据",
                "editable": False,
                "type": "object"
            },
            
            # 第二组：实例数据（可编辑）
            "uid": {
                "display_name": "实例ID",
                "editable": False,  # 实例ID不可编辑
                "type": "string"
            },
            "name": {
                "display_name": "实例名称",
                "editable": True,
                "type": "string"
            },
            "transform": {
                "display_name": "变换",
                "editable": True,
                "type": "object",
                "properties": {
                    "location": {"display_name": "位置", "type": "array"},
                    "rotation": {"display_name": "旋转", "type": "array"},
                    "scale": {"display_name": "缩放", "type": "array"}
                }
            },
            "materials": {
                "display_name": "材质",
                "editable": True,
                "type": "array"
            },
            "properties": {
                "display_name": "属性",
                "editable": True,
                "type": "object"
            },
            
            # 第三组：绑定数据（可编辑）
            "iot_binds": {
                "display_name": "IoT设备绑定",
                "editable": True,
                "type": "array"
            },
            "file_binds": {
                "display_name": "文件绑定",
                "editable": True,
                "type": "array"
            },
            "video_binds": {
                "display_name": "视频绑定",
                "editable": True,
                "type": "array"
            }
        }
    }
    
    # 构建实例数据，并分组
    instance_data = {
        # 资产数据组
        "asset": {
            "asset_id": inst.asset_id,
            "asset_type": inst.asset_type,
            "asset_metadata": {}  # 为空，需要另行懒加载
        },
        
        # 实例数据组
        "instance": {
            "uid": inst.uid,
            "name": inst.name,
            "transform": inst.transform,
            "materials": inst.materials,
            "properties": inst.properties
        },
        
        # 绑定数据组
        "bindings": {
            "iot_binds": inst.iot_binds or [],
            "file_binds": inst.file_binds or [],
            "video_binds": inst.video_binds or []
        }
    }
    
    # 返回带元数据的结果
    return {
        "data": instance_data,
        "metadata": field_metadata
    }

# 添加更新实例嵌套关系的API
@router.post("/instances/{instance_id}/change-parent", response_model=dict)
async def change_instance_parent(
    instance_id: str, 
    data: dict = Body(...), 
    current_user: UserInDB = Depends(get_current_active_user)
):
    """更改实例的父级关系"""
    # 从请求体获取新父级ID
    new_parent_id = data.get("new_parent_id")
    if not new_parent_id:
        raise HTTPException(400, "missing new_parent_id")
        
    # 获取实例
    instance = Instance.nodes.get_or_none(uid=instance_id)
    if not instance:
        raise HTTPException(404, "实例不存在")
    
    # 获取新父级
    new_parent = Instance.nodes.get_or_none(uid=new_parent_id)
    if not new_parent:
        raise HTTPException(404, "新父级不存在")
    
    # 检查是否形成循环引用
    def check_cycle(node, target_id):
        if node.uid == target_id:
            return True
        for child in node.children:
            if check_cycle(child, target_id):
                return True
        return False
    
    if check_cycle(instance, new_parent_id):
        raise HTTPException(400, "不能形成循环引用")
    
    # 事务操作：断开旧连接，建立新连接
    with neo_db.transaction:
        # 断开与当前父级的连接
        for parent in instance.parent:
            parent.children.disconnect(instance)
        
        # 建立与新父级的连接
        new_parent.children.connect(instance)
    
    return {"message": "实例父级已更新", "instance_id": instance_id, "new_parent_id": new_parent_id}
