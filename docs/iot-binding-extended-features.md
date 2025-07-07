# IoT绑定系统扩展功能使用指南

## 📋 概述

本文档详细介绍了IoT绑定系统的扩展功能，包括旋转更新、缩放更新、骨骼节点变换和材质属性更新。

## 🔄 旋转更新功能

### 支持的旋转数据格式

#### 1. 欧拉角数组格式
```javascript
// [heading, pitch, roll] 或 [yaw, pitch, roll] (度数)
{
  "rotation": [30, 45, 60]
}
```

#### 2. 四元数数组格式
```javascript
// [x, y, z, w]
{
  "rotation": [0.0, 0.0, 0.7071, 0.7071]
}
```

#### 3. HPR对象格式
```javascript
{
  "rotation": {
    "heading": 90,
    "pitch": 0, 
    "roll": 0
  }
}
```

#### 4. YPR对象格式
```javascript
{
  "rotation": {
    "yaw": 45,
    "pitch": 30,
    "roll": 15
  }
}
```

#### 5. 四元数对象格式
```javascript
{
  "rotation": {
    "x": 0.0,
    "y": 0.0,
    "z": 0.0,
    "w": 1.0
  }
}
```

### 平滑旋转插值

系统使用SLERP（球面线性插值）实现平滑旋转过渡：

```javascript
// 启用平滑过渡的旋转更新
{
  "rotation": [45, 30, 60],
  "_smooth": true  // 可选：强制启用平滑过渡
}
```

## 📏 缩放更新功能

### 支持的缩放数据格式

#### 1. 统一缩放（数值）
```javascript
{
  "scale": 1.5  // 所有轴统一缩放1.5倍
}
```

#### 2. 统一缩放（数组）
```javascript
{
  "scale": [2.0]  // 数组格式的统一缩放
}
```

#### 3. 各轴独立缩放（数组）
```javascript
{
  "scale": [2.0, 1.0, 0.5]  // [x, y, z]
}
```

#### 4. 缩放对象格式
```javascript
{
  "scale": {
    "x": 1.2,
    "y": 1.5,
    "z": 0.8
  }
}
```

#### 5. 统一缩放对象格式
```javascript
{
  "scale": {
    "uniform": 0.7  // 统一缩放因子
  }
}
```

## 🦴 骨骼节点变换更新

### 🆕 新格式节点绑定路径

#### 路径格式说明

**特定属性绑定：**
- `node.{nodeId}.location` - 节点位置
- `node.{nodeId}.rotation` - 节点旋转  
- `node.{nodeId}.scale` - 节点缩放

**完整对象绑定：**
- `node.{nodeId}` - 完整节点对象（包含location、rotation、scale）

### 特定属性更新

#### 节点位置更新
```javascript
// 按节点ID更新位置
{
  "target": "node.0.location",
  "value": [5.0, 3.0, 2.0]
}

// 按节点名称或索引（字符串格式）
{
  "target": "node.bone_head.location", 
  "value": [1.0, 2.0, 0.5]
}
```

#### 节点旋转更新
```javascript
// 欧拉角格式
{
  "target": "node.1.rotation",
  "value": [45, 0, 0]  // [heading, pitch, roll] 度数
}

// 四元数数组格式 [x, y, z, w]
{
  "target": "node.1.rotation",
  "value": [0.0, 0.0, 0.383, 0.924]
}

// 四元数对象格式
{
  "target": "node.1.rotation", 
  "value": {"x": 0.0, "y": 0.0, "z": 0.707, "w": 0.707}
}

// HPR对象格式
{
  "target": "node.2.rotation",
  "value": {"heading": 45, "pitch": 30, "roll": 15}
}

// YPR对象格式
{
  "target": "node.2.rotation",
  "value": {"yaw": 60, "pitch": -15, "roll": 30}
}
```

#### 节点缩放更新
```javascript
// 统一缩放
{
  "target": "node.2.scale",
  "value": [1.5, 1.5, 1.5]
}

// 非均匀缩放
{
  "target": "node.3.scale", 
  "value": [2.0, 1.0, 0.5]
}
```

### 完整对象更新

#### 所有属性更新
```javascript
{
  "target": "node.0",
  "value": {
    "location": [10.0, 5.0, 3.0],
    "rotation": [90.0, 0.0, 0.0],  // 欧拉角
    "scale": [2.0, 2.0, 2.0]
  }
}
```

#### 部分属性更新
```javascript
// 仅位置和旋转
{
  "target": "node.1",
  "value": {
    "location": [0.0, 0.0, 5.0],
    "rotation": {"x": 0.0, "y": 0.0, "z": 0.707, "w": 0.707}  // 四元数对象
  }
}

// 仅缩放
{
  "target": "node.2",
  "value": {
    "scale": [0.5, 1.0, 2.0]  // 非均匀缩放
  }
}
```

### 🌟 新格式优势

**语义明确：**
- `node` vs `instance` 清楚区分节点和实例操作
- 路径更简洁直观：`node.0.location` vs `{nodeId: 0, location: [...]}`

**灵活的绑定方式：**
- 单属性绑定：精确控制单个变换属性
- 完整对象绑定：批量更新多个属性

**完整四元数支持：**
- 数组格式：`[x, y, z, w]`
- 对象格式：`{x, y, z, w}`  
- HPR对象：`{heading, pitch, roll}`
- YPR对象：`{yaw, pitch, roll}`

**向后兼容：**
- 内部仍使用nodeId进行节点查找
- 支持字符串形式的节点名称

## 🎨 材质属性更新

### 基础颜色更新

#### RGBA数组格式
```javascript
{
  "material.baseColor": [1.0, 0.5, 0.2, 1.0]  // RGBA (0-1范围)
}
```

#### 颜色对象格式（255范围）
```javascript
{
  "material.baseColor": {
    "r": 255,
    "g": 128, 
    "b": 64,
    "a": 255
  }
}
```

#### 颜色对象格式（0-1范围）
```javascript
{
  "material.baseColor": {
    "red": 1.0,
    "green": 0.5,
    "blue": 0.25,
    "alpha": 1.0
  }
}
```

#### 十六进制颜色
```javascript
{
  "material.baseColor": "#FF6B35"
}
```

#### 指定材质索引
```javascript
{
  "material.baseColor": {
    "materialIndex": 0,  // 只更新第一个材质
    "color": [0.0, 1.0, 0.0, 1.0]
  }
}
```

### PBR材质属性

#### 金属度和粗糙度
```javascript
{
  "material.metallicFactor": 0.8,  // 0-1范围
  "material.roughnessFactor": 0.3
}

// 指定材质更新
{
  "material.metallicFactor": {
    "materialIndex": 1,
    "factor": 0.6
  }
}
```

#### 发射光颜色
```javascript
{
  "material.emissiveFactor": [0.2, 0.8, 1.0]  // RGB
}

// 十六进制格式
{
  "material.emissiveFactor": "#33CCFF"
}
```

### 贴图更新

#### 基础颜色贴图
```javascript
{
  "material.baseColorTexture": "https://example.com/texture.jpg"
}

// Base64格式
{
  "material.baseColorTexture": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA..."
}

// 详细格式
{
  "material.baseColorTexture": {
    "url": "https://example.com/texture.jpg",
    "texCoord": 0  // 纹理坐标集索引
  }
}
```

#### 其他贴图类型
```javascript
{
  "material.normalTexture": "https://example.com/normal.jpg",
  "material.metallicRoughnessTexture": "https://example.com/metallic_roughness.jpg",
  "material.emissiveTexture": "https://example.com/emissive.jpg",
  "material.occlusionTexture": "https://example.com/occlusion.jpg"
}
```

### Alpha属性
```javascript
{
  "material.alphaMode": "BLEND",    // "OPAQUE", "MASK", "BLEND"
  "material.alphaCutoff": 0.5       // Alpha裁剪值（MASK模式）
}
```

### 批量材质属性更新
```javascript
{
  "material": {
    "materialIndex": "all",  // 更新所有材质
    "baseColorFactor": [1.0, 1.0, 0.0, 1.0],
    "metallicFactor": 0.6,
    "roughnessFactor": 0.4,
    "emissiveFactor": [0.1, 0.1, 0.0]
  }
}
```

## 🔗 组合更新

### 多属性同时更新
```javascript
{
  "instance.transform.location": [5.0, 3.0, 1.0],
  "rotation": [0, 45, 0],
  "scale": 1.5,
  "material.baseColor": [1.0, 0.0, 1.0, 1.0]
}
```

### 节点和材质组合更新
```javascript
{
  "node.transform.rotation": {
    "nodeId": "bone_001",
    "rotation": [90, 0, 0]
  },
  "material.emissiveFactor": [1.0, 0.5, 0.0],
  "material.metallicFactor": 0.8
}
```

## ⚙️ 配置选项

### 平滑过渡配置
```javascript
// 在IoT绑定配置中设置
{
  "iotAnimationConfig": {
    "enableSmoothTransition": true,
    "transitionDuration": 2.0,      // 动画持续时间（秒）
    "usePathAnimation": false,       // 是否使用路径动画
    "maxPathPoints": 10,            // 路径动画最大点数
    "clearCameraTracking": true     // 是否清除相机跟踪
  }
}
```

## 🧪 测试验证

### 运行测试脚本
```bash
# 运行基础功能测试
python test_enu_rotation_fix.py

# 运行扩展功能测试
python test_extended_iot_bindings.py
```

### 验证检查项
- ✅ 旋转更新：支持多种格式，SLERP插值正确
- ✅ 缩放更新：统一和独立缩放正确
- ✅ 节点变换：骨骼节点正确响应
- ✅ 材质属性：颜色、贴图、PBR属性正确更新
- ✅ 平滑插值：动画过渡自然
- ✅ 错误处理：不支持格式显示警告
- ✅ 性能稳定：无内存泄漏或性能下降

## 🐛 故障排除

### 常见问题

#### 1. 旋转异常
**症状**：模型旋转到意外的方向
**解决**：检查旋转数据格式，确保欧拉角顺序正确

#### 2. 节点未找到
**症状**：控制台显示"未找到节点"警告
**解决**：检查节点ID或索引是否正确，确保模型已完全加载。优先使用nodeId而不是nodeName

#### 3. 材质不更新
**症状**：材质属性没有变化
**解决**：检查材质索引范围，确保模型有PBR材质信息

#### 4. 贴图加载失败
**症状**：贴图URL无法加载
**解决**：检查URL有效性和跨域设置

### 调试技巧

1. **查看控制台日志**：所有更新操作都有详细日志
2. **检查数据格式**：确保IoT数据符合预期格式
3. **渐进式测试**：先测试单个属性，再组合测试
4. **性能监控**：观察内存和CPU使用情况

## 📚 API参考

### 核心函数

#### `updateModelRotation(primitive, rotation, smooth)`
更新模型旋转

#### `updateModelScale(primitive, scale, smooth)`  
更新模型缩放

#### `updateModelNodeTransform(primitive, nodeId, property, value, smooth)`
更新节点变换（支持节点ID、索引或名称）

#### `updateModelMaterial(primitive, materialIndex, property, value)`
更新材质属性

### 支持的属性类型

| 属性类别 | 属性名称 | 支持格式 | 描述 |
|---------|---------|---------|------|
| 变换 | `location` | 数组/对象 | 模型位置 |
| 变换 | `rotation` | 欧拉角/四元数 | 模型旋转 |
| 变换 | `scale` | 数值/数组/对象 | 模型缩放 |
| 节点 | `node.transform.*` | 对象 | 节点变换 |
| 材质 | `material.*` | 多种 | 材质属性 |

---

*文档版本：v2.0*  
*最后更新：2024年* 