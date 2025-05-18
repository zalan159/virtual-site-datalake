from pydantic import BaseModel, Field
from typing import Dict, List, Optional, Any
# from .user import PyObjectId # Uncomment if IDs like file_id, product_id are ObjectIds

class ProductOccurrenceMetadata(BaseModel):
    """产品出现元数据模型"""
    file_id: str # Consider PyObjectId if this is a MongoDB ObjectId
    pointer: Optional[str] = ""
    product_id: Optional[str] = "" # Consider PyObjectId if this is a MongoDB ObjectId
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
    user_data: Dict[str, List[Dict[str, Any]]] = Field(default_factory=dict)

    # Example of model_config if needed later:
    # model_config = {
    #     "extra": "ignore", # or "allow"
    #     "populate_by_name": True # if using aliases
    # } 