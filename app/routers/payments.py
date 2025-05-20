from fastapi import APIRouter, Depends, HTTPException
from bson import ObjectId
from datetime import datetime
import uuid
import os

from app.auth.utils import get_current_active_user, db
from app.models.user import UserInDB
from app.models.transaction import TransactionType

router = APIRouter(prefix="/payments", tags=["充值"])

ALLOWED_AMOUNTS = [50, 100, 200, 500]


@router.post("/recharge")
async def create_recharge(amount: int, current_user: UserInDB = Depends(get_current_active_user)):
    if amount not in ALLOWED_AMOUNTS:
        raise HTTPException(status_code=400, detail="无效的充值金额")
    order_id = str(uuid.uuid4())
    await db.recharges.insert_one(
        {
            "order_id": order_id,
            "user_id": str(current_user.id),
            "amount": amount,
            "status": "pending",
            "created_at": datetime.now(),
            "updated_at": datetime.now(),
        }
    )
    pay_url = f"https://openapi.alipay.com/gateway.do?order_id={order_id}"
    return {"order_id": order_id, "pay_url": pay_url}


@router.post("/confirm/{order_id}")
async def confirm_recharge(order_id: str, current_user: UserInDB = Depends(get_current_active_user)):
    recharge = await db.recharges.find_one({"order_id": order_id, "user_id": str(current_user.id)})
    if not recharge or recharge.get("status") != "pending":
        raise HTTPException(status_code=404, detail="订单不存在")
    new_balance = current_user.balance + recharge["amount"]
    await db.users.update_one({"_id": ObjectId(current_user.id)}, {"$set": {"balance": new_balance}})
    await db.recharges.update_one(
        {"order_id": order_id}, {"$set": {"status": "completed", "updated_at": datetime.now()}}
    )
    await db.transactions.insert_one(
        {
            "user_id": str(current_user.id),
            "amount": recharge["amount"],
            "type": TransactionType.RECHARGE,
            "description": f"Alipay recharge {order_id}",
            "created_at": datetime.now(),
        }
    )
    return {"balance": new_balance}
