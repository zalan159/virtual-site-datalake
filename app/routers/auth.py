from fastapi import APIRouter, Depends, HTTPException, status, Query, Body
from fastapi.security import OAuth2PasswordRequestForm
from datetime import timedelta, datetime
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
from typing import Optional, Dict, Any

from app.models.user import UserCreate, User, Token, UserInDB
from app.auth.utils import (
    get_password_hash,
    authenticate_user,
    create_access_token,
    get_current_active_user,
    ACCESS_TOKEN_EXPIRE_MINUTES,
    db,
    verify_password
)
from app.utils.sms import sms_service
from app.utils.redis import redis_service

router = APIRouter()

@router.post("/register", response_model=User)
async def register(user: UserCreate):
    # 检查用户名是否已存在
    if await db.users.find_one({"username": user.username}):
        raise HTTPException(
            status_code=400,
            detail="Username already registered"
        )
    
    # 检查手机号是否已存在
    if await db.users.find_one({"phone": user.phone}):
        raise HTTPException(
            status_code=400,
            detail="Phone number already registered"
        )
    
    # 创建新用户
    user_dict = user.model_dump()
    user_dict["hashed_password"] = get_password_hash(user_dict.pop("password"))
    user_dict["id"] = str(ObjectId())
    
    await db.users.insert_one(user_dict)
    
    # 返回用户信息（不包含密码）
    return User(**user_dict)

@router.post("/send-code")
async def send_verification_code(phone: str):
    """发送验证码"""
    print(f"收到发送验证码请求，手机号: {phone}")
    if not phone:
        raise HTTPException(
            status_code=400,
            detail="Phone number is required"
        )
    if not phone.isdigit() or len(phone) != 11 or not phone.startswith('1'):
        raise HTTPException(
            status_code=400,
            detail="Invalid phone number format"
        )
    
    # 发送验证码
    success, result = await sms_service.send_verification_code(phone)
    print(f"发送验证码结果: success={success}, result={result}")

    if not success:
        raise HTTPException(
            status_code=400,
            detail=result
        )
    
    # 存储验证码到Redis
    redis_service.store_verification_code(phone, result)
    print(f"验证码已存储到Redis: {phone} -> {result}")
    
    return {"message": "Verification code sent successfully"}

@router.post("/check-username")
async def check_username(username_data: Dict[str, str] = Body(...)):
    """检查用户名是否已存在"""
    username = username_data.get("username")
    if not username:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="用户名是必需的"
        )
    
    user = await db.users.find_one({"username": username})
    return {"exists": user is not None}

@router.post("/login", response_model=Token)
async def login(
    login_data: Dict[str, Any] = Body(...)
):
    """统一的登录端点
    支持两种登录方式：
    1. 用户名/手机号+密码登录
    2. 手机号+验证码登录（如果用户不存在则自动创建）
    
    请求体格式：
    1. 用户名/手机号+密码登录:
    {
        "username": "用户名或手机号",
        "password": "密码"
    }
    
    2. 手机号+验证码登录:
    {
        "phone": "手机号",
        "code": "验证码"
    }
    """
    print(f"登录请求: {login_data}")
    
    # 检查是否是手机号+验证码登录
    if "phone" in login_data and "code" in login_data:
        phone = login_data["phone"]
        code = login_data["code"]
        
        print(f"尝试手机号验证码登录: phone={phone}, code={code}")
        stored_code = redis_service.get_verification_code(phone)
        print(f"从Redis获取的验证码: {stored_code}")
        
        if not stored_code or stored_code != code:
            print(f"验证码不匹配: 存储的={stored_code}, 提供的={code}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect verification code",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        # 验证成功后删除验证码
        redis_service.delete_verification_code(phone)
        print(f"验证码验证成功，已从Redis删除")
        
        # 获取用户信息
        user = await db.users.find_one({"phone": phone})
        if not user:
            # 用户不存在，自动创建用户
            print(f"用户不存在，自动创建用户: phone={phone}")
            username = f"user_{phone[-4:]}_{datetime.now().strftime('%Y%m%d%H%M%S')}"
            user_dict = {
                "username": username,
                "phone": phone,
                "hashed_password": "",  # 手机号登录不需要密码
                "id": str(ObjectId()),
                "is_active": True,
                "role": "user",
                "created_at": datetime.now(),
                "updated_at": datetime.now()
            }
            await db.users.insert_one(user_dict)
            user = user_dict
            print(f"已创建新用户: {username}")
        
        user = UserInDB(**user)
        print(f"用户登录成功: {user.username}")
    
    # 检查是否是用户名/手机号+密码登录
    elif "username" in login_data and "password" in login_data:
        username = login_data["username"]
        password = login_data["password"]
        
        print(f"尝试用户名/手机号+密码登录: username={username}")
        user = await authenticate_user(username, password)
        if not user:
            print(f"用户名/手机号或密码错误: username={username}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="用户名或密码错误",
                headers={"WWW-Authenticate": "Bearer"},
            )
        print(f"用户登录成功: {user.username}")
    
    else:
        print("登录请求缺少必要参数")
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Invalid login parameters. Use either username+password or phone+code",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # 生成访问令牌
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.username}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

@router.post("/token", response_model=Token)
async def login_for_access_token(
    form_data: Optional[OAuth2PasswordRequestForm] = Depends(),
    phone: Optional[str] = Query(None),
    code: Optional[str] = Query(None)
):
    """登录获取token
    支持两种方式：
    1. 用户名密码登录
    2. 手机号验证码登录
    """
    print(f"登录请求: form_data={form_data}, phone={phone}, code={code}")
    
    if phone and code:
        # 手机号验证码登录
        print(f"尝试手机号验证码登录: phone={phone}, code={code}")
        stored_code = redis_service.get_verification_code(phone)
        print(f"从Redis获取的验证码: {stored_code}")
        
        if not stored_code or stored_code != code:
            print(f"验证码不匹配: 存储的={stored_code}, 提供的={code}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect verification code",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        # 验证成功后删除验证码
        redis_service.delete_verification_code(phone)
        print(f"验证码验证成功，已从Redis删除")
        
        # 获取用户信息
        user = await db.users.find_one({"phone": phone})
        if not user:
            # 用户不存在，返回特殊状态码
            print(f"用户不存在: phone={phone}")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found",
                headers={"WWW-Authenticate": "Bearer"},
            )
        user = UserInDB(**user)
        print(f"用户登录成功: {user.username}")
    elif form_data:
        # 用户名密码登录
        print(f"尝试用户名密码登录: username={form_data.username}")
        user = await authenticate_user(form_data.username, form_data.password)
        if not user:
            print(f"用户名或密码错误: username={form_data.username}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="用户名或密码错误",
                headers={"WWW-Authenticate": "Bearer"},
            )
        print(f"用户登录成功: {user.username}")
    else:
        print("登录请求缺少必要参数")
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Either username/password or phone/code must be provided",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.username}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

@router.post("/phone-login", response_model=Token)
async def phone_login(phone: str, code: str):
    """手机号验证码登录专用端点"""
    print(f"手机号验证码登录请求: phone={phone}, code={code}")
    
    # 验证验证码
    stored_code = redis_service.get_verification_code(phone)
    print(f"从Redis获取的验证码: {stored_code}")
    
    if not stored_code or stored_code != code:
        print(f"验证码不匹配: 存储的={stored_code}, 提供的={code}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect verification code",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # 验证成功后删除验证码
    redis_service.delete_verification_code(phone)
    print(f"验证码验证成功，已从Redis删除")
    
    # 获取用户信息
    user = await db.users.find_one({"phone": phone})
    if not user:
        # 用户不存在，返回特殊状态码
        print(f"用户不存在: phone={phone}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
            headers={"WWW-Authenticate": "Bearer"},
        )
    user = UserInDB(**user)
    print(f"用户登录成功: {user.username}")
    
    # 生成访问令牌
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.username}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

@router.post("/complete-registration", response_model=User)
async def complete_registration(username: str, phone: str, email: Optional[str] = None):
    """完成用户注册（通过手机号验证码登录后）"""
    # 检查用户名是否已存在
    if await db.users.find_one({"username": username}):
        raise HTTPException(
            status_code=400,
            detail="Username already registered"
        )
    
    # 检查手机号是否已存在
    if await db.users.find_one({"phone": phone}):
        raise HTTPException(
            status_code=400,
            detail="Phone number already registered"
        )
    
    # 创建新用户
    user_dict = {
        "username": username,
        "phone": phone,
        "email": email,
        "hashed_password": "",  # 手机号登录不需要密码
        "id": str(ObjectId()),
        "is_active": True,
        "role": "user",
        "created_at": datetime.now(),
        "updated_at": datetime.now()
    }
    
    await db.users.insert_one(user_dict)
    
    # 返回用户信息
    return User(**user_dict)

@router.get("/users/me", response_model=User)
async def read_users_me(current_user: User = Depends(get_current_active_user)):
    return current_user

@router.put("/users/me/password")
async def update_password(
    password_data: Dict[str, str] = Body(...),
    current_user: UserInDB = Depends(get_current_active_user)
):
    """修改当前用户的密码
    
    - **password_data**: 包含旧密码和新密码的字典
    - **current_user**: 当前登录用户
    """
    old_password = password_data.get("old_password")
    new_password = password_data.get("new_password")
    
    if not old_password or not new_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="旧密码和新密码都是必需的"
        )
    
    # 验证旧密码
    if not verify_password(old_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="旧密码不正确"
        )
    
    # 更新密码
    hashed_password = get_password_hash(new_password)
    await db.users.update_one(
        {"_id": ObjectId(current_user.id)},
        {"$set": {"hashed_password": hashed_password}}
    )
    
    return {"message": "密码修改成功"}

@router.put("/users/me/username")
async def update_username(
    username_data: Dict[str, str] = Body(...),
    current_user: UserInDB = Depends(get_current_active_user)
):
    """修改当前用户的用户名
    
    - **username_data**: 包含新用户名的字典
    - **current_user**: 当前登录用户
    """
    new_username = username_data.get("new_username")
    
    if not new_username:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="新用户名是必需的"
        )
    
    # 检查新用户名是否已存在
    existing_user = await db.users.find_one({"username": new_username})
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="用户名已存在"
        )
    
    # 更新用户名
    await db.users.update_one(
        {"_id": ObjectId(current_user.id)},
        {"$set": {"username": new_username}}
    )
    
    return {"message": "用户名修改成功"}

@router.post("/users/me/set-password")
async def set_initial_password(
    password_data: Dict[str, str] = Body(...),
    current_user: UserInDB = Depends(get_current_active_user)
):
    """设置初始密码（用于手机验证码登录的用户）
    
    - **password_data**: 包含新密码的字典
    - **current_user**: 当前登录用户
    """
    new_password = password_data.get("new_password")
    
    if not new_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="新密码是必需的"
        )
    
    # 检查用户是否已有密码
    if current_user.hashed_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="用户已有密码，请使用修改密码接口"
        )
    
    # 设置密码
    hashed_password = get_password_hash(new_password)
    await db.users.update_one(
        {"_id": ObjectId(current_user.id)},
        {"$set": {"hashed_password": hashed_password}}
    )
    
    return {"message": "初始密码设置成功"}

@router.get("/users/me/has-password")
async def check_has_password(
    current_user: UserInDB = Depends(get_current_active_user)
):
    """检查当前用户是否已设置密码
    
    - **current_user**: 当前登录用户
    """
    return {"has_password": bool(current_user.hashed_password)}

@router.post("/logout")
async def logout(current_user: User = Depends(get_current_active_user)):
    """退出登录"""
    # 由于使用的是JWT token，服务器端不需要维护session
    # 客户端只需要删除token即可
    return {"message": "Successfully logged out"} 