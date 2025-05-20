from pydantic import BaseModel, Field
from datetime import datetime
from enum import Enum
from typing import Optional

from .user import PyObjectId


class TransactionType(str, Enum):
    RECHARGE = "recharge"
    DEDUCTION = "deduction"


class Transaction(BaseModel):
    id: PyObjectId = Field(default_factory=PyObjectId, alias="_id")
    user_id: PyObjectId
    amount: float
    type: TransactionType
    description: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.now)

    model_config = {"populate_by_name": True, "arbitrary_types_allowed": True}
