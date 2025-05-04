from pydantic import BaseModel
from typing import Dict, List, Optional, Any

class ProductOccurrenceMetadata(BaseModel):
    """产品出现元数据模型"""
    file_id: str
    pointer: Optional[str] = ""
    product_id: Optional[str] = ""
    name: Optional[str] = ""
    layer: Optional[str] = ""
    style: Optional[str] = ""
    behaviour: Optional[str] = ""
    modeller_type: Optional[str] = ""
    product_load_status: Optional[str] = ""
    product_flag: Optional[str] = ""
    unit: Optional[str] = ""
    density_volume_unit: Optional[str] = ""
    density_mass_unit: Optional[str] = ""
    unit_from_cad: Optional[str] = ""
    rgb: Optional[str] = ""
    user_data: Dict[str, List[Dict[str, Any]]] = {} 