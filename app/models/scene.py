# models/scene_graph.py
from neomodel import (
    StructuredNode, StructuredRel, UniqueIdProperty, StringProperty,
    IntegerProperty, FloatProperty, JSONProperty, DateTimeProperty,
    RelationshipTo, RelationshipFrom, Relationship,One
)
from datetime import datetime
from pydantic import BaseModel, Field
from typing import Optional

# ------------------------------------------------------------------------------
#  关系类型（带属性的边）
# ------------------------------------------------------------------------------

class ParentRel(StructuredRel):
    """节点层级关系 (:Instance)-[:PARENT_OF]->(:Instance)"""
    order = IntegerProperty(default=0)  # 同级顺序，可选
    created_at = DateTimeProperty(default_now=True)

class SceneParentRel(StructuredRel):
    """场景层级关系 (:Scene)-[:PARENT_OF]->(:Scene)"""
    created_at = DateTimeProperty(default_now=True)

# ------------------------------------------------------------------------------
#  场景与实例化节点
# ------------------------------------------------------------------------------

class Scene(StructuredNode):
    uid          = UniqueIdProperty()
    name         = StringProperty()
    owner        = StringProperty()  # 新增，记录用户id
    preview_image = StringProperty()  # 新增，minio预览图链接
    created_at   = DateTimeProperty(default_now=True)
    updated_at   = DateTimeProperty(default=lambda: datetime.utcnow())
    origin       = JSONProperty(default=lambda: {"longitude": 0.0, "latitude": 0.0, "height": 0.0})  # 新增，场景原点

    # 根节点（单向；场景只有一个 ROOT）
    root         = RelationshipTo('Instance', 'ROOT', cardinality=One)

    # 场景层级关系
    parent_scene = RelationshipFrom('Scene', 'SCENE_PARENT_OF', model=SceneParentRel)
    child_scenes = RelationshipTo('Scene', 'SCENE_PARENT_OF', model=SceneParentRel)
    def save(self):
        # 先保存 Scene
        super().save()
        # 自动创建并关联根节点
        if not self.root:
            root_instance = Instance(name=f"Root of {self.name}").save()
            self.root.connect(root_instance)
        return self
class Instance(StructuredNode):
    """场景中的实例化节点，可嵌套"""
    uid        = UniqueIdProperty()
    name       = StringProperty()
    
    # 资产信息
    asset_id   = StringProperty(index=True)                # 资产ID
    asset_type = StringProperty(default="model")           # 资产类型：model, 3dtiles, gis_layer 等

    transform  = JSONProperty(default=lambda: {           # 位置、旋转、缩放的3×3矩阵
        'location': [1,0,0],
        'rotation': [0,0,0],
        'scale': [1,1,1]
    })
    properties = JSONProperty(default=dict)
    materials  = JSONProperty(default=list)

    # 绑定属性数组
    iot_binds  = JSONProperty(default=list)               # Mongo 文档 _id 数组
    video_binds = JSONProperty(default=list)              # Mongo 文档 _id 数组
    file_binds  = JSONProperty(default=list)              # Mongo 文档 _id 数组

    # 关系
    parent     = RelationshipFrom('Instance', 'PARENT_OF', model=ParentRel)
    children   = RelationshipTo('Instance', 'PARENT_OF', model=ParentRel)

    # 场景引用
    scenes     = RelationshipFrom(Scene, 'HAS_INSTANCE')

class SceneCreate(BaseModel):
    name: str
    origin: Optional[dict] = None  # 新增

class SceneUpdate(BaseModel):
    name: Optional[str] = None
    origin: Optional[dict] = None  # 新增
    # 允许额外字段
    class Config:
        extra = "allow"

class ScenePreviewUpdate(BaseModel):
    preview_image: str

class InstanceCreate(BaseModel):
    name: str
    asset_id: str 
    asset_type: str = Field(default="model")
    parent_uid: Optional[str] = None
    transform: Optional[dict] = None
    properties: Optional[dict] = None
    materials: Optional[list] = None
    iot_binds: Optional[list] = None
    video_binds: Optional[list] = None
    file_binds: Optional[list] = None

class InstanceUpdate(BaseModel):
    name: Optional[str] = None
    asset_id: Optional[str] = None 
    asset_type: Optional[str] = None
    transform: Optional[dict] = None
    properties: Optional[dict] = None
    materials: Optional[list] = None
    iot_binds: Optional[list] = None
    video_binds: Optional[list] = None
    file_binds: Optional[list] = None