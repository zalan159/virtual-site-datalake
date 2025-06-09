from neomodel import (
    StructuredNode, UniqueIdProperty, StringProperty,
    IntegerProperty, FloatProperty, JSONProperty, DateTimeProperty,
    RelationshipTo, RelationshipFrom, BooleanProperty
)
from datetime import datetime
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any


class Chart(StructuredNode):
    """GoView图表项目模型"""
    uid = UniqueIdProperty()
    name = StringProperty(required=True)
    description = StringProperty()
    owner = StringProperty(required=True)  # 用户ID (保持兼容性)
    owner_id = StringProperty(required=True)  # 项目所有者ID，用于权限隔离
    
    # 图表配置数据 - GoView完整配置结构
    config = JSONProperty(default=lambda: {
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
                    "#00BAFF", "#3DE7C9", "#FF6C6C", "#FFE700",
                    "#8A2BE2", "#00CED1", "#FF1493", "#228B22"
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
                "Body": {"form-data": {}, "x-www-form-urlencoded": {}, "json": "", "xml": ""},
                "Header": {},
                "Params": {}
            }
        },
        "componentList": []
    })
    preview_image = StringProperty()  # 预览图链接
    
    # 元数据
    width = IntegerProperty(default=1920)
    height = IntegerProperty(default=1080)
    version = StringProperty(default="1.0.0")
    
    # 时间戳
    created_at = DateTimeProperty(default_now=True)
    updated_at = DateTimeProperty(default=lambda: datetime.utcnow())
    
    # 状态
    status = StringProperty(default="draft", choices={
        "draft": "草稿",
        "published": "已发布",
        "archived": "已归档"
    })
    
    # 访问权限
    is_public = BooleanProperty(default=False)
    
    def save(self):
        self.updated_at = datetime.utcnow()
        return super().save()


class ChartTemplate(StructuredNode):
    """GoView图表模板"""
    uid = UniqueIdProperty()
    name = StringProperty(required=True)
    description = StringProperty()
    category = StringProperty()  # 模板分类
    
    # 模板配置
    template_config = JSONProperty(default=dict)
    preview_image = StringProperty()
    
    # 元数据
    width = IntegerProperty(default=1920)
    height = IntegerProperty(default=1080)
    version = StringProperty(default="1.0.0")
    
    # 时间戳
    created_at = DateTimeProperty(default_now=True)
    updated_at = DateTimeProperty(default=lambda: datetime.utcnow())
    
    # 是否为系统模板
    is_system = BooleanProperty(default=False)


# Pydantic模型用于API
class ChartCreate(BaseModel):
    name: str
    description: Optional[str] = None
    config: Optional[Dict[str, Any]] = None
    width: Optional[int] = 1920
    height: Optional[int] = 1080
    is_public: Optional[bool] = False


class ChartUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    config: Optional[Dict[str, Any]] = None
    width: Optional[int] = None
    height: Optional[int] = None
    status: Optional[str] = None
    is_public: Optional[bool] = None
    
    model_config = {
        "extra": "allow"
    }


class ChartPreviewUpdate(BaseModel):
    preview_image: str


class ChartTemplateCreate(BaseModel):
    name: str
    description: Optional[str] = None
    category: Optional[str] = None
    template_config: Dict[str, Any]
    width: Optional[int] = 1920
    height: Optional[int] = 1080
    is_system: Optional[bool] = False


class ChartTemplateUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    template_config: Optional[Dict[str, Any]] = None
    width: Optional[int] = None
    height: Optional[int] = None
    
    model_config = {
        "extra": "allow"
    }


# 响应模型
class ChartResponse(BaseModel):
    uid: str
    name: str
    description: Optional[str]
    owner: str
    config: Dict[str, Any]
    preview_image: Optional[str]
    width: int
    height: int
    version: str
    created_at: datetime
    updated_at: datetime
    status: str
    is_public: bool


class ChartTemplateResponse(BaseModel):
    uid: str
    name: str
    description: Optional[str]
    category: Optional[str]
    template_config: Dict[str, Any]
    preview_image: Optional[str]
    width: int
    height: int
    version: str
    created_at: datetime
    updated_at: datetime
    is_system: bool


class ChartListResponse(BaseModel):
    charts: List[ChartResponse]
    total: int
    page: int
    page_size: int


class ChartTemplateListResponse(BaseModel):
    templates: List[ChartTemplateResponse]
    total: int
    page: int
    page_size: int