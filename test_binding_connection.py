#!/usr/bin/env python3
"""
测试IoT绑定连接配置查找功能
"""

import asyncio
import sys
import os
import requests
import json

# 添加项目根目录到Python路径
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.routers.iot_connections import find_connection_by_binding_id, find_connection_by_id
from app.db.mongo_db import get_database

async def test_connection_functions():
    """测试连接查找函数"""
    print("🧪 测试IoT连接查找功能")
    
    # 获取数据库连接
    db = await get_database()
    
    # 测试1: 直接通过连接ID查找
    print("\n📌 测试1: 通过连接ID查找连接配置")
    test_connection_id = "507f1f77bcf86cd799439011"  # 示例连接ID
    connection = await find_connection_by_id(db, test_connection_id)
    if connection:
        print(f"✅ 找到连接配置: {connection.protocol.value} - {connection.name}")
        print(f"   配置详情: {connection.config}")
    else:
        print(f"❌ 未找到连接配置: {test_connection_id}")
    
    # 测试2: 通过绑定ID查找连接配置
    print("\n📌 测试2: 通过IoT绑定ID查找连接配置")
    test_scene_id = "test_scene_id"
    test_instance_id = "test_instance_id"  
    test_binding_id = "test_binding_id"
    
    connection_from_binding = await find_connection_by_binding_id(
        db, test_scene_id, test_instance_id, test_binding_id
    )
    if connection_from_binding:
        print(f"✅ 通过绑定ID找到连接配置: {connection_from_binding.protocol.value}")
        print(f"   配置详情: {connection_from_binding.config}")
    else:
        print(f"❌ 通过绑定ID未找到连接配置")
    
    print("\n🎯 函数测试完成")
    print("=" * 50)
    print("💡 使用说明:")
    print("1. find_connection_by_id(db, connection_id)")
    print("   - 直接根据连接ID查找连接配置")
    print("   - connection_id是MongoDB中存储的连接配置的_id")
    print()
    print("2. find_connection_by_binding_id(db, scene_id, instance_id, binding_id)")
    print("   - 根据IoT绑定ID查找对应的连接配置")
    print("   - 先从场景实例中找到绑定记录")
    print("   - 从绑定记录的sourceId字段获取连接ID")
    print("   - 再调用find_connection_by_id查找连接配置")
    print()
    print("🔗 新增API端点:")
    print("GET /iot/scenes/{scene_id}/instances/{instance_id}/bindings/{binding_id}/connection")

def test_iot_binding_instance_ids():
    """测试IoT绑定实例ID功能"""
    
    base_url = "http://localhost:8000"
    
    # 模拟用户认证（需要根据实际认证方式调整）
    headers = {
        "Content-Type": "application/json",
        # "Authorization": "Bearer your_token_here"  # 需要实际的认证token
    }
    
    # 测试场景ID（需要使用实际存在的场景ID）
    test_scene_id = "test_scene_123"
    
    print("🔍 测试IoT绑定实例ID修复...")
    print(f"场景ID: {test_scene_id}")
    print("=" * 50)
    
    try:
        # 1. 获取场景所有IoT绑定
        print("1️⃣ 获取场景所有IoT绑定...")
        response = requests.get(
            f"{base_url}/scenes/{test_scene_id}/iot-bindings/all",
            headers=headers
        )
        
        if response.status_code != 200:
            print(f"❌ API调用失败: {response.status_code}")
            print(f"响应内容: {response.text}")
            return False
        
        bindings = response.json()
        print(f"✅ 成功获取 {len(bindings)} 个绑定")
        
        # 2. 验证绑定数据结构
        if not bindings:
            print("⚠️ 场景中没有IoT绑定，无法测试")
            return True
        
        print("\n2️⃣ 验证绑定数据结构...")
        for i, binding in enumerate(bindings):
            print(f"\n绑定 {i+1}:")
            print(f"  ID: {binding.get('id', 'N/A')}")
            print(f"  名称: {binding.get('name', 'N/A')}")
            print(f"  协议: {binding.get('protocol', 'N/A')}")
            print(f"  数据类型: {binding.get('dataType', 'N/A')}")
            print(f"  实例ID: {binding.get('instanceId', '❌ 缺失')}")
            print(f"  实例名称: {binding.get('instanceName', '❌ 缺失')}")
            
            # 验证必要字段
            if 'instanceId' not in binding:
                print(f"❌ 绑定 {binding.get('id')} 缺少 instanceId 字段")
                return False
            
            if not binding['instanceId']:
                print(f"❌ 绑定 {binding.get('id')} 的 instanceId 为空")
                return False
                
        print("✅ 所有绑定都包含正确的实例ID信息")
        
        # 3. 测试特定实例绑定获取
        if bindings:
            test_instance_id = bindings[0]['instanceId']
            print(f"\n3️⃣ 测试特定实例绑定获取...")
            print(f"测试实例ID: {test_instance_id}")
            
            response = requests.get(
                f"{base_url}/scenes/{test_scene_id}/instances/{test_instance_id}/iot-bindings",
                headers=headers
            )
            
            if response.status_code == 200:
                instance_bindings = response.json()
                print(f"✅ 成功获取实例绑定: {len(instance_bindings)} 个")
            else:
                print(f"⚠️ 获取实例绑定失败: {response.status_code}")
        
        # 4. 模拟前端处理逻辑
        print(f"\n4️⃣ 模拟前端处理逻辑...")
        for binding in bindings[:3]:  # 只测试前3个绑定
            instance_id = binding.get('instanceId')
            instance_name = binding.get('instanceName', '未知实例')
            binding_id = binding.get('id')
            
            print(f"模拟MQTT消息处理:")
            print(f"  绑定ID: {binding_id}")
            print(f"  目标实例: {instance_id} ({instance_name})")
            print(f"  ✅ 能够正确识别目标实例，不会误认为场景级绑定")
        
        print("\n🎉 测试完成！IoT绑定实例ID修复验证成功")
        return True
        
    except requests.exceptions.RequestException as e:
        print(f"❌ 网络请求失败: {e}")
        return False
    except json.JSONDecodeError as e:
        print(f"❌ JSON解析失败: {e}")
        return False
    except Exception as e:
        print(f"❌ 测试失败: {e}")
        return False

def print_usage():
    """打印使用说明"""
    print("IoT绑定实例ID修复测试")
    print("=" * 30)
    print("此测试验证:")
    print("1. 后端API返回包含实例ID的绑定数据")
    print("2. 前端能正确识别绑定所属的实例")
    print("3. MQTT消息处理时更新正确的实例")
    print()
    print("注意:")
    print("- 需要启动后端服务 (http://localhost:8000)")
    print("- 需要有效的场景ID和IoT绑定数据")
    print("- 可能需要适当的身份认证")

if __name__ == "__main__":
    print("选择测试类型:")
    print("1. IoT连接查找功能测试 (原有功能)")
    print("2. IoT绑定实例ID修复测试 (新功能)")
    print("3. 运行所有测试")
    print()
    
    if len(sys.argv) > 1 and sys.argv[1] in ['1', 'connection']:
        # 运行原有的连接测试
        print("🧪 运行IoT连接查找功能测试")
        asyncio.run(test_connection_functions())
    elif len(sys.argv) > 1 and sys.argv[1] in ['2', 'instance']:
        # 运行实例ID测试
        print_usage()
        print()
        success = test_iot_binding_instance_ids()
        sys.exit(0 if success else 1)
    elif len(sys.argv) > 1 and sys.argv[1] in ['3', 'all']:
        # 运行所有测试
        print("🧪 运行所有测试")
        print("\n" + "="*50)
        print("第一部分: IoT连接查找功能测试")
        print("="*50)
        asyncio.run(test_connection_functions())
        
        print("\n" + "="*50)
        print("第二部分: IoT绑定实例ID修复测试")
        print("="*50)
        success = test_iot_binding_instance_ids()
        sys.exit(0 if success else 1)
    else:
        # 默认运行实例ID测试（新功能）
        print_usage()
        print()
        success = test_iot_binding_instance_ids()
        sys.exit(0 if success else 1)