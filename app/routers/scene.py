from fastapi import APIRouter, Depends, HTTPException, Body, Query
from typing import List, Optional, Dict, Any
from app.auth.utils import get_current_active_user, db
from app.models.user import UserInDB
from app.models.scene import Scene, Instance, Asset
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
    scenes = Scene.nodes.all()
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
    update_dict = data.dict(exclude_unset=True)
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
    if data.parent_id:
        parent = Instance.nodes.get_or_none(uid=data.parent_id)
        if not parent:
            raise HTTPException(404, "父节点不存在")
    inst = Instance(name=data.name)
    if data.transform:
        inst.transform = data.transform
    if data.properties:
        inst.properties = data.properties
    if data.materials:
        inst.materials = data.materials
    inst.save()
    if data.asset_id:
        asset = Asset.nodes.get_or_none(asset_id=data.asset_id)
        if asset:
            inst.asset.connect(asset)
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
    # 平铺所有instance
    result = []
    def flatten(inst):
        result.append({
            "uid": inst.uid,
            "name": inst.name,
            "transform": inst.transform,
            "materials": inst.materials,
            "asset_uri": inst.asset.single().uri if inst.asset.single() else None
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
            "properties": inst.properties,
            "iot_binds": inst.iot_binds,
            "file_binds": inst.file_binds,
            "video_binds": inst.video_binds,
            "gis_layers": inst.gis_layers,
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
    if data.transform:
        inst.transform = data.transform
    if data.properties:
        inst.properties = data.properties
    if data.materials:
        inst.materials = data.materials
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

# ---------------------- 绑定/解绑接口 ----------------------

@router.post("/instances/{instance_id}/bind-iot", response_model=dict)
async def bind_iot(instance_id: str, iot_id: str = Body(...), current_user: UserInDB = Depends(get_current_active_user)):
    inst = Instance.nodes.get_or_none(uid=instance_id)
    if not inst:
        raise HTTPException(404, "实例不存在")
    # 校验iot_id存在
    iot_doc = await db.iot.find_one({"_id": ObjectId(iot_id)})
    if not iot_doc:
        raise HTTPException(404, "iot对象不存在")
    inst.iot_binds = iot_id
    inst.save()
    return {"message": "已绑定"}

@router.post("/instances/{instance_id}/unbind-iot", response_model=dict)
async def unbind_iot(instance_id: str, current_user: UserInDB = Depends(get_current_active_user)):
    inst = Instance.nodes.get_or_none(uid=instance_id)
    if not inst:
        raise HTTPException(404, "实例不存在")
    inst.iot_binds = None
    inst.save()
    return {"message": "已解绑"}

@router.post("/instances/{instance_id}/bind-attachment", response_model=dict)
async def bind_attachment(instance_id: str, attachment_id: str = Body(...), current_user: UserInDB = Depends(get_current_active_user)):
    inst = Instance.nodes.get_or_none(uid=instance_id)
    if not inst:
        raise HTTPException(404, "实例不存在")
    # 校验attachment_id存在
    att_doc = await db.attachments.find_one({"_id": ObjectId(attachment_id)})
    if not att_doc:
        raise HTTPException(404, "附件不存在")
    inst.file_binds = attachment_id
    inst.save()
    # 同步更新attachment的related_instance
    await db.attachments.update_one({"_id": ObjectId(attachment_id)}, {"$set": {"related_instance": instance_id}})
    return {"message": "已绑定"}

@router.post("/instances/{instance_id}/unbind-attachment", response_model=dict)
async def unbind_attachment(instance_id: str, current_user: UserInDB = Depends(get_current_active_user)):
    inst = Instance.nodes.get_or_none(uid=instance_id)
    if not inst:
        raise HTTPException(404, "实例不存在")
    # 同步更新attachment的related_instance
    if inst.file_binds:
        await db.attachments.update_one({"_id": ObjectId(inst.file_binds)}, {"$set": {"related_instance": None}})
    inst.file_binds = None
    inst.save()
    return {"message": "已解绑"}

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
        "iot_binds": inst.iot_binds,
        "file_binds": inst.file_binds,
        "video_binds": inst.video_binds,
        "gis_layers": inst.gis_layers
    }
