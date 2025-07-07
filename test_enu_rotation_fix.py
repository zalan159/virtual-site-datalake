#!/usr/bin/env python3
"""
测试ENU坐标系旋转修复的效果

验证以下修复：
1. IoT绑定实例ID修复 - 每个绑定现在包含明确的实例ID
2. ENU坐标系方向修复 - 使用原始HPR角度而不是提取的旋转矩阵
3. 平滑动画过渡和相机跟踪清除
"""

import json
import time
import paho.mqtt.client as mqtt

# MQTT配置
MQTT_BROKER = "localhost"
MQTT_PORT = 1883
MQTT_TOPIC = "iot/sensor/location"

def on_connect(client, userdata, flags, rc):
    print(f"MQTT连接结果: {rc}")
    if rc == 0:
        print("已连接到MQTT代理")
    else:
        print(f"连接失败，错误代码: {rc}")

def on_publish(client, userdata, mid):
    print(f"消息已发布: {mid}")

def test_enu_rotation_fix():
    """测试ENU坐标系旋转修复"""
    
    # 创建MQTT客户端
    client = mqtt.Client()
    client.on_connect = on_connect
    client.on_publish = on_publish
    
    try:
        # 连接到MQTT代理
        client.connect(MQTT_BROKER, MQTT_PORT, 60)
        client.loop_start()
        
        print("开始测试ENU坐标系旋转修复...")
        print("=" * 60)
        
        # 测试数据 - 同一个位置的多次发送
        test_positions = [
            # 位置1: 固定位置，多次发送验证旋转一致性
            {"east": 10.0, "north": 15.0, "up": 2.0, "description": "位置1 - 第1次"},
            {"east": 10.0, "north": 15.0, "up": 2.0, "description": "位置1 - 第2次"},
            {"east": 10.0, "north": 15.0, "up": 2.0, "description": "位置1 - 第3次"},
            
            # 位置2: 不同位置
            {"east": 20.0, "north": 25.0, "up": 3.0, "description": "位置2 - 新位置"},
            
            # 位置3: 回到位置1
            {"east": 10.0, "north": 15.0, "up": 2.0, "description": "位置1 - 回归测试"},
        ]
        
        for i, pos in enumerate(test_positions):
            print(f"\n测试 {i+1}: {pos['description']}")
            print(f"发送ENU坐标: East={pos['east']}, North={pos['north']}, Up={pos['up']}")
            
            # 构建IoT数据
            iot_data = {
                "timestamp": int(time.time() * 1000),
                "sensor_id": "location_sensor_001",
                "data": {
                    "location": [pos["east"], pos["north"], pos["up"]]
                },
                "metadata": {
                    "coordinate_system": "ENU",
                    "description": pos["description"],
                    "test_sequence": i + 1
                }
            }
            
            # 发布MQTT消息
            message = json.dumps(iot_data)
            result = client.publish(MQTT_TOPIC, message, qos=0)
            
            if result.rc == mqtt.MQTT_ERR_SUCCESS:
                print(f"✅ 消息发送成功")
                print(f"   数据: {message}")
            else:
                print(f"❌ 消息发送失败: {result.rc}")
            
            # 等待一段时间观察效果
            print("等待5秒观察模型更新效果...")
            time.sleep(5)
        
        print("\n" + "=" * 60)
        print("测试完成！")
        print("\n预期结果:")
        print("1. 相同坐标的多次发送应该保持模型在同一位置和方向")
        print("2. 模型不应该出现异常旋转或方向变化")
        print("3. 相机视角应该保持稳定，不会跳转")
        print("4. 控制台应该显示使用原始HPR角度的日志")
        
        print("\n验证检查项：")
        print("□ 模型位置更新正确")
        print("□ 模型方向保持一致")
        print("□ 相机视角稳定")
        print("□ 控制台显示原始旋转数据")
        print("□ 动画过渡平滑")
        
    except Exception as e:
        print(f"测试过程中发生错误: {e}")
    
    finally:
        # 清理连接
        client.loop_stop()
        client.disconnect()
        print("\nMQTT连接已关闭")

if __name__ == "__main__":
    test_enu_rotation_fix() 