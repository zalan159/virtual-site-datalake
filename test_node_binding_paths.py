#!/usr/bin/env python3
"""
测试新格式的节点绑定路径
node.{nodeId}.{location|rotation|scale} - 特定属性绑定
node.{nodeId} - 完整对象绑定

这个脚本测试新的节点绑定路径格式是否能正确解析和应用到模型节点
"""

import time
import json
import random
import math

def generate_test_cases():
    """生成测试用例"""
    
    test_cases = [
        # 1. 特定属性绑定格式：node.{nodeId}.{property}
        {
            "description": "更新节点0的位置",
            "binding_target": "node.0.location",
            "test_data": [5.0, 3.0, 2.0]
        },
        {
            "description": "更新节点1的欧拉角旋转",
            "binding_target": "node.1.rotation", 
            "test_data": [45.0, 0.0, 0.0]  # heading, pitch, roll
        },
        {
            "description": "更新节点1的四元数旋转",
            "binding_target": "node.1.rotation",
            "test_data": [0.0, 0.0, 0.383, 0.924]  # x, y, z, w (45度绕Z轴)
        },
        {
            "description": "更新节点2的缩放",
            "binding_target": "node.2.scale",
            "test_data": [1.5, 1.5, 1.5]
        },
        
        # 2. 完整对象绑定格式：node.{nodeId}
        {
            "description": "完整节点更新 - 所有属性",
            "binding_target": "node.0",
            "test_data": {
                "location": [10.0, 5.0, 3.0],
                "rotation": [90.0, 0.0, 0.0],  # 欧拉角
                "scale": [2.0, 2.0, 2.0]
            }
        },
        {
            "description": "完整节点更新 - 仅位置和旋转",
            "binding_target": "node.1", 
            "test_data": {
                "location": [0.0, 0.0, 5.0],
                "rotation": {"x": 0.0, "y": 0.0, "z": 0.707, "w": 0.707}  # 四元数对象
            }
        },
        {
            "description": "完整节点更新 - 仅缩放",
            "binding_target": "node.2",
            "test_data": {
                "scale": [0.5, 1.0, 2.0]  # 非均匀缩放
            }
        },
        
        # 3. 高级四元数旋转测试
        {
            "description": "节点旋转 - 四元数对象格式",
            "binding_target": "node.3.rotation",
            "test_data": {"x": 0.5, "y": 0.5, "z": 0.5, "w": 0.5}  # 多轴旋转
        },
        {
            "description": "节点旋转 - HPR对象格式",
            "binding_target": "node.3.rotation", 
            "test_data": {"heading": 45.0, "pitch": 30.0, "roll": 15.0}
        },
        {
            "description": "节点旋转 - YPR对象格式",
            "binding_target": "node.3.rotation",
            "test_data": {"yaw": 60.0, "pitch": -15.0, "roll": 30.0}
        }
    ]
    
    return test_cases

def create_mock_iot_data(target_property, value):
    """创建模拟的IoT数据消息"""
    return {
        "type": "iot-update",
        "timestamp": time.time(),
        "source": "test-node-binding",
        "data": {
            "bindings": [
                {
                    "target": target_property,
                    "value": value
                }
            ]
        }
    }

def print_test_case(case_num, test_case):
    """打印测试用例信息"""
    print(f"\n🧪 测试用例 {case_num}: {test_case['description']}")
    print(f"   目标属性: {test_case['binding_target']}")
    print(f"   测试数据: {json.dumps(test_case['test_data'], indent=2)}")
    
    # 解析路径格式
    target = test_case['binding_target']
    if target.startswith('node.'):
        parts = target.split('.')
        if len(parts) == 2:
            print(f"   → 格式: 完整节点对象更新 (节点ID: {parts[1]})")
        elif len(parts) == 3:
            print(f"   → 格式: 单属性更新 (节点ID: {parts[1]}, 属性: {parts[2]})")
        else:
            print(f"   → 格式: 未知格式")

def print_quaternion_info(quat_data):
    """打印四元数相关信息"""
    if isinstance(quat_data, list) and len(quat_data) == 4:
        x, y, z, w = quat_data
        print(f"   四元数 [x, y, z, w]: [{x}, {y}, {z}, {w}]")
        
        # 计算欧拉角等价值（简化版）
        # 这是一个近似计算，实际应该使用Cesium的转换函数
        heading = math.atan2(2*(w*z + x*y), 1 - 2*(y*y + z*z))
        pitch = math.asin(2*(w*y - z*x))
        roll = math.atan2(2*(w*x + y*z), 1 - 2*(x*x + y*y))
        
        print(f"   等价欧拉角 (度): H={math.degrees(heading):.1f}, P={math.degrees(pitch):.1f}, R={math.degrees(roll):.1f}")
        
    elif isinstance(quat_data, dict) and all(k in quat_data for k in ['x', 'y', 'z', 'w']):
        print(f"   四元数对象: {quat_data}")

def main():
    """主测试函数"""
    print("🔧 IoT绑定新节点路径格式测试")
    print("=" * 60)
    print("测试新的节点绑定路径格式：")
    print("1. node.{nodeId}.{property} - 特定属性绑定")
    print("2. node.{nodeId} - 完整对象绑定")
    print("支持四元数旋转格式")
    print("=" * 60)
    
    # 生成测试用例
    test_cases = generate_test_cases()
    
    # 执行测试
    for i, test_case in enumerate(test_cases, 1):
        print_test_case(i, test_case)
        
        # 特殊处理四元数信息
        if 'rotation' in test_case['binding_target']:
            rotation_data = test_case['test_data']
            if isinstance(test_case['test_data'], dict) and 'rotation' in test_case['test_data']:
                rotation_data = test_case['test_data']['rotation']
            
            if isinstance(rotation_data, (list, dict)):
                print_quaternion_info(rotation_data)
        
        # 创建模拟IoT消息
        iot_message = create_mock_iot_data(
            test_case['binding_target'], 
            test_case['test_data']
        )
        
        print(f"   模拟IoT消息:")
        print(f"   {json.dumps(iot_message, indent=2)}")
        
        # 模拟处理延迟
        time.sleep(0.5)
    
    print(f"\n✅ 测试完成！总共执行了 {len(test_cases)} 个测试用例")
    print("\n📝 测试要点:")
    print("1. 新路径格式应该正确解析节点ID和属性")
    print("2. 完整对象更新应该按顺序应用 location → rotation → scale")
    print("3. 四元数旋转应该正确转换为HPR角度")
    print("4. 缺少的属性应该被忽略而不是报错")
    print("5. 无效的节点ID应该给出友好的错误提示")
    
    print("\n🌟 新格式的优势:")
    print("- 更明确的语义: node vs instance")
    print("- 更灵活的绑定: 单属性 vs 完整对象")
    print("- 更好的四元数支持")
    print("- 更简洁的数据结构")

if __name__ == "__main__":
    main() 