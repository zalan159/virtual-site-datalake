#!/usr/bin/env python3
"""
扩展IoT绑定功能综合测试脚本

测试覆盖：
1. 旋转更新（欧拉角、四元数、多种格式）
2. 缩放更新（统一缩放、各轴独立缩放）
3. 骨骼节点变换更新（位置、旋转、缩放）
4. 材质属性更新（颜色、贴图、PBR属性）
"""

import json
import time
import paho.mqtt.client as mqtt
import asyncio
from typing import Dict, Any, List

# MQTT配置
MQTT_BROKER = "localhost"
MQTT_PORT = 1883
MQTT_TOPIC = "iot/model/update"

class IoTBindingTester:
    def __init__(self):
        self.client = mqtt.Client()
        self.client.on_connect = self.on_connect
        self.client.on_publish = self.on_publish
        self.test_results = []
        
    def on_connect(self, client, userdata, flags, rc):
        print(f"MQTT连接结果: {rc}")
        if rc == 0:
            print("已连接到MQTT代理")
        else:
            print(f"连接失败，错误代码: {rc}")

    def on_publish(self, client, userdata, mid):
        print(f"消息已发布: {mid}")

    async def run_tests(self):
        """运行所有测试用例"""
        try:
            # 连接到MQTT代理
            self.client.connect(MQTT_BROKER, MQTT_PORT, 60)
            self.client.loop_start()
            
            print("开始IoT绑定扩展功能测试...")
            print("=" * 80)
            
            # 1. 测试旋转更新
            await self.test_rotation_updates()
            
            # 2. 测试缩放更新
            await self.test_scale_updates()
            
            # 3. 测试节点变换更新
            await self.test_node_transform_updates()
            
            # 4. 测试材质属性更新
            await self.test_material_updates()
            
            # 5. 测试组合更新
            await self.test_combined_updates()
            
            print("\n" + "=" * 80)
            print("所有测试完成！")
            self.print_test_summary()
            
        except Exception as e:
            print(f"测试过程中发生错误: {e}")
        
        finally:
            # 清理连接
            self.client.loop_stop()
            self.client.disconnect()
            print("\nMQTT连接已关闭")

    async def test_rotation_updates(self):
        """测试旋转更新功能"""
        print("\n🔄 测试旋转更新功能")
        print("-" * 40)
        
        rotation_tests = [
            {
                "name": "欧拉角数组格式 [heading, pitch, roll]",
                "property": "rotation",
                "value": [30, 45, 60],  # 度数
                "description": "使用欧拉角数组更新旋转"
            },
            {
                "name": "四元数数组格式 [x, y, z, w]",
                "property": "rotation", 
                "value": [0.0, 0.0, 0.7071, 0.7071],  # 90度绕Z轴
                "description": "使用四元数数组更新旋转"
            },
            {
                "name": "HPR对象格式",
                "property": "rotation",
                "value": {"heading": 90, "pitch": 0, "roll": 0},
                "description": "使用HPR对象格式更新旋转"
            },
            {
                "name": "YPR对象格式",
                "property": "rotation",
                "value": {"yaw": 45, "pitch": 30, "roll": 15},
                "description": "使用YPR对象格式更新旋转"
            },
            {
                "name": "四元数对象格式",
                "property": "rotation",
                "value": {"x": 0.0, "y": 0.0, "z": 0.0, "w": 1.0},
                "description": "使用四元数对象格式更新旋转"
            }
        ]
        
        for test in rotation_tests:
            await self.send_test_data(test)
            await asyncio.sleep(3)  # 等待观察效果

    async def test_scale_updates(self):
        """测试缩放更新功能"""
        print("\n📏 测试缩放更新功能")
        print("-" * 40)
        
        scale_tests = [
            {
                "name": "统一缩放（数值）",
                "property": "scale",
                "value": 1.5,
                "description": "所有轴统一缩放1.5倍"
            },
            {
                "name": "统一缩放（数组）",
                "property": "scale",
                "value": [2.0],
                "description": "使用数组格式统一缩放"
            },
            {
                "name": "各轴独立缩放",
                "property": "scale",
                "value": [2.0, 1.0, 0.5],  # [x, y, z]
                "description": "X轴2倍，Y轴1倍，Z轴0.5倍"
            },
            {
                "name": "缩放对象格式",
                "property": "scale",
                "value": {"x": 1.2, "y": 1.5, "z": 0.8},
                "description": "使用对象格式各轴独立缩放"
            },
            {
                "name": "统一缩放对象格式",
                "property": "scale",
                "value": {"uniform": 0.7},
                "description": "使用uniform属性统一缩放"
            }
        ]
        
        for test in scale_tests:
            await self.send_test_data(test)
            await asyncio.sleep(3)

    async def test_node_transform_updates(self):
        """测试节点变换更新功能"""
        print("\n🦴 测试节点变换更新功能")
        print("-" * 40)
        
        node_tests = [
            {
                "name": "节点位置更新",
                "property": "node.transform.location",
                "value": {
                    "nodeId": "node_armature_001",  # 节点ID
                    "location": [1.0, 2.0, 0.5]
                },
                "description": "使用节点ID更新指定节点的位置"
            },
            {
                "name": "节点旋转更新",
                "property": "node.transform.rotation", 
                "value": {
                    "nodeId": "bone_head",
                    "rotation": [45, 0, 30]  # 欧拉角
                },
                "description": "使用节点ID更新指定节点的旋转"
            },
            {
                "name": "节点缩放更新",
                "property": "node.transform.scale",
                "value": {
                    "nodeId": "bone_left_arm",
                    "scale": [1.2, 1.0, 1.2]
                },
                "description": "使用节点ID更新指定节点的缩放"
            },
            {
                "name": "按索引更新节点",
                "property": "node.location",
                "value": {
                    "nodeId": 0,  # 节点索引
                    "location": {"x": 0.5, "y": 1.0, "z": 0.0}
                },
                "description": "使用节点索引更新位置"
            },
            {
                "name": "兼容nodeName格式",
                "property": "node.transform.rotation",
                "value": {
                    "nodeName": "Bone_Legacy",  # 兼容性测试
                    "rotation": [0, 90, 0]
                },
                "description": "测试向后兼容的nodeName格式"
            }
        ]
        
        for test in node_tests:
            await self.send_test_data(test)
            await asyncio.sleep(3)

    async def test_material_updates(self):
        """测试材质属性更新功能"""
        print("\n🎨 测试材质属性更新功能")
        print("-" * 40)
        
        material_tests = [
            {
                "name": "基础颜色更新（RGB数组）",
                "property": "material.baseColor",
                "value": [1.0, 0.5, 0.2, 1.0],  # RGBA
                "description": "使用RGBA数组更新基础颜色"
            },
            {
                "name": "基础颜色更新（颜色对象）",
                "property": "material.baseColor",
                "value": {"r": 255, "g": 128, "b": 64, "a": 255},
                "description": "使用颜色对象更新基础颜色"
            },
            {
                "name": "基础颜色更新（十六进制）",
                "property": "material.baseColor",
                "value": "#FF6B35",
                "description": "使用十六进制颜色更新"
            },
            {
                "name": "金属度因子更新",
                "property": "material.metallicFactor",
                "value": 0.8,
                "description": "更新金属度因子为0.8"
            },
            {
                "name": "粗糙度因子更新",
                "property": "material.roughnessFactor",
                "value": 0.3,
                "description": "更新粗糙度因子为0.3"
            },
            {
                "name": "发射光因子更新",
                "property": "material.emissiveFactor",
                "value": [0.2, 0.8, 1.0],  # RGB
                "description": "更新发射光颜色"
            },
            {
                "name": "基础颜色贴图更新",
                "property": "material.baseColorTexture",
                "value": "https://example.com/texture.jpg",
                "description": "更新基础颜色贴图URL"
            },
            {
                "name": "Alpha模式更新",
                "property": "material.alphaMode",
                "value": "BLEND",
                "description": "设置Alpha混合模式"
            },
            {
                "name": "指定材质索引更新",
                "property": "material.baseColor",
                "value": {
                    "materialIndex": 0,
                    "color": [0.0, 1.0, 0.0, 1.0]  # 绿色
                },
                "description": "只更新第一个材质的颜色"
            },
            {
                "name": "批量材质属性更新",
                "property": "material",
                "value": {
                    "materialIndex": "all",
                    "baseColorFactor": [1.0, 1.0, 0.0, 1.0],  # 黄色
                    "metallicFactor": 0.6,
                    "roughnessFactor": 0.4,
                    "emissiveFactor": [0.1, 0.1, 0.0]
                },
                "description": "批量更新所有材质的多个属性"
            }
        ]
        
        for test in material_tests:
            await self.send_test_data(test)
            await asyncio.sleep(4)  # 材质更新可能需要更多时间

    async def test_combined_updates(self):
        """测试组合更新功能"""
        print("\n🔗 测试组合更新功能")
        print("-" * 40)
        
        combined_tests = [
            {
                "name": "位置+旋转组合更新",
                "properties": ["instance.transform.location", "rotation"],
                "values": [
                    [5.0, 3.0, 1.0],  # 新位置
                    [0, 45, 0]        # 新旋转
                ],
                "description": "同时更新位置和旋转"
            },
            {
                "name": "缩放+材质组合更新",
                "properties": ["scale", "material.baseColor"],
                "values": [
                    2.0,                    # 统一缩放
                    [1.0, 0.0, 1.0, 1.0]   # 紫色
                ],
                "description": "同时更新缩放和材质颜色"
            },
            {
                "name": "节点+材质组合更新",
                "properties": ["node.transform.rotation", "material.emissiveFactor"],
                "values": [
                    {"nodeId": "bone_001", "rotation": [90, 0, 0]},
                    [1.0, 0.5, 0.0]  # 橙色发射光
                ],
                "description": "同时更新节点旋转和材质发射光"
            }
        ]
        
        for test in combined_tests:
            await self.send_combined_test_data(test)
            await asyncio.sleep(5)  # 组合更新需要更多观察时间

    async def send_test_data(self, test: Dict[str, Any]):
        """发送单个测试数据"""
        print(f"\n测试: {test['name']}")
        print(f"描述: {test['description']}")
        print(f"属性: {test['property']}")
        print(f"值: {test['value']}")
        
        # 构建IoT数据
        iot_data = {
            "timestamp": int(time.time() * 1000),
            "sensor_id": "extended_iot_test",
            "data": {
                test['property']: test['value']
            },
            "metadata": {
                "test_name": test['name'],
                "test_type": "single_property",
                "description": test['description']
            }
        }
        
        # 发布MQTT消息
        message = json.dumps(iot_data, indent=2)
        result = self.client.publish(MQTT_TOPIC, message, qos=0)
        
        if result.rc == mqtt.MQTT_ERR_SUCCESS:
            print(f"✅ 消息发送成功")
            self.test_results.append({"test": test['name'], "status": "sent"})
        else:
            print(f"❌ 消息发送失败: {result.rc}")
            self.test_results.append({"test": test['name'], "status": "failed"})

    async def send_combined_test_data(self, test: Dict[str, Any]):
        """发送组合测试数据"""
        print(f"\n组合测试: {test['name']}")
        print(f"描述: {test['description']}")
        
        # 构建包含多个属性的数据
        data = {}
        for prop, value in zip(test['properties'], test['values']):
            data[prop] = value
            print(f"  {prop}: {value}")
        
        iot_data = {
            "timestamp": int(time.time() * 1000),
            "sensor_id": "extended_iot_test",
            "data": data,
            "metadata": {
                "test_name": test['name'],
                "test_type": "combined_properties",
                "description": test['description']
            }
        }
        
        message = json.dumps(iot_data, indent=2)
        result = self.client.publish(MQTT_TOPIC, message, qos=0)
        
        if result.rc == mqtt.MQTT_ERR_SUCCESS:
            print(f"✅ 组合消息发送成功")
            self.test_results.append({"test": test['name'], "status": "sent"})
        else:
            print(f"❌ 组合消息发送失败: {result.rc}")
            self.test_results.append({"test": test['name'], "status": "failed"})

    def print_test_summary(self):
        """打印测试总结"""
        print("\n📊 测试总结")
        print("-" * 40)
        
        sent_count = sum(1 for result in self.test_results if result['status'] == 'sent')
        failed_count = sum(1 for result in self.test_results if result['status'] == 'failed')
        
        print(f"总测试数: {len(self.test_results)}")
        print(f"发送成功: {sent_count}")
        print(f"发送失败: {failed_count}")
        
        if failed_count > 0:
            print("\n失败的测试:")
            for result in self.test_results:
                if result['status'] == 'failed':
                    print(f"  ❌ {result['test']}")
        
        print("\n🎯 验证检查项:")
        print("□ 旋转更新：支持欧拉角、四元数、多种对象格式")
        print("□ 缩放更新：支持统一缩放、各轴独立缩放")
        print("□ 节点变换：支持骨骼节点的位置、旋转、缩放更新")
        print("□ 材质属性：支持颜色、贴图、PBR因子更新")
        print("□ 平滑插值：启用平滑过渡时动画效果正确")
        print("□ 错误处理：不支持的格式显示适当的警告信息")
        print("□ 性能稳定：连续更新不会导致内存泄漏或性能下降")

async def main():
    """主函数"""
    tester = IoTBindingTester()
    await tester.run_tests()

if __name__ == "__main__":
    asyncio.run(main()) 