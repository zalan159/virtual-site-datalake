# IoT绑定Target路径规则重构实现

## 概述

根据新的Target字段规则要求，对IoT绑定系统进行了重构，实现了标准化的target路径格式，并新增了material材质绑定支持。

## Target路径规则

### 1. Instance属性绑定
**格式**: `instance.{instance property}.{key inside property(if property value is json obj and key exist)}`

**示例**:
- `instance.position` - 绑定到实例的position属性
- `instance.material.color` - 绑定到实例材质的color子属性
- `instance.transform.scale.x` - 绑定到变换矩阵scale的x分量

### 2. Node节点绑定  
**格式**: `node.{nodeId}.{key inside node property(if property value is json obj and key exist)}`

**示例**:
- `node.0.translation` - 绑定到节点0的translation属性
- `node.1.rotation` - 绑定到节点1的rotation属性
- `node.2.scale` - 绑定到节点2的scale属性

### 3. Material材质绑定
**格式**: `material.{materialId}.{key inside material property(if property value is json obj and key exist)}`

**示例**:
- `material.material_0.baseColorFactor` - 绑定到材质0的基础颜色因子
- `material.material_1.metallicFactor` - 绑定到材质1的金属因子
- `material.material_2.baseColorTexture` - 绑定到材质2的基础颜色纹理（支持base64数据）

## 修改的文件

### 1. IoT绑定API数据模型 (`/web/src/services/iotBindingApi.ts`)

**新增内容**:
- `TargetType` 枚举：定义三种target类型（INSTANCE, NODE, MATERIAL）
- `TargetPath` 接口：标准化的target路径结构
- Target路径规则说明字段添加到 `IoTBinding` 接口
- Target路径解析和构建工具函数：
  - `parseTargetPath()` - 解析target路径字符串
  - `buildTargetPath()` - 构建标准格式的target路径
  - `validateTargetPath()` - 验证target路径格式

### 2. 数据路径助手组件 (`/web/src/components/DataPathHelper.tsx`)

**重构内容**:

#### PropertySelectorModal增强
- 添加了三个标签页：
  - **实例属性** - 选择instance属性
  - **模型节点** - 选择node节点属性
  - **模型材质** - 选择material材质属性

#### 新增函数
- `fetchModelMaterials()` - 获取模型材质数据
- `buildMaterialTree()` - 构建材质属性树结构
- 重构 `buildNodeTree()` - 使用标准node路径格式
- 重构 `buildPropertyTree()` - 使用标准instance路径格式

#### UI改进
- 三标签页界面设计
- 动态标题和帮助文本
- 标准化的路径显示格式
- 移除了之前的nodeindex逻辑

## 新功能：Material材质绑定

### 支持的材质属性
基于PBR材质模型，支持以下属性绑定：
- `baseColorFactor` - 基础颜色因子 [R,G,B,A]
- `metallicFactor` - 金属因子 (0-1)
- `roughnessFactor` - 粗糙度因子 (0-1) 
- `emissiveFactor` - 发射因子 [R,G,B]
- `baseColorTexture` - 基础颜色纹理 (支持base64)
- `metallicRoughnessTexture` - 金属粗糙度纹理
- `normalTexture` - 法线纹理
- `emissiveTexture` - 发射纹理

### Base64纹理绑定
特别支持IMAGE_BASE64类型的IoT数据绑定到材质纹理属性，实现：
- 实时纹理更新
- 动态材质变化
- 支持各种图像格式的base64编码

## 使用方式

### 1. 选择Instance属性
1. 在IoT绑定配置中点击"选择属性"
2. 选择"实例属性"标签页
3. 浏览实例属性树结构
4. 选择目标属性，路径自动生成为 `instance.{property}.{key}` 格式

### 2. 选择Node节点
1. 在IoT绑定配置中点击"选择属性" 
2. 选择"模型节点"标签页
3. 浏览模型节点树结构
4. 选择节点的变换属性，路径自动生成为 `node.{nodeId}.{property}` 格式

### 3. 选择Material材质
1. 在IoT绑定配置中点击"选择属性"
2. 选择"模型材质"标签页  
3. 浏览材质属性树结构
4. 选择材质属性，路径自动生成为 `material.{materialId}.{property}` 格式

## 兼容性说明

### 后向兼容
- 现有的IoT绑定配置继续有效
- API接口保持兼容
- 数据格式向前兼容

### 数据获取
目前材质和节点数据使用示例数据，生产环境中可以：
- 通过 `window.cesiumViewer.animationState.boneNodes` 获取真实节点数据
- 通过 `window.cesiumViewer.materials` 获取真实材质数据
- 或实现专门的API来获取模型的节点和材质信息

## 测试指导

### 测试Target路径格式
1. 创建IoT绑定并选择不同类型的target
2. 验证生成的路径符合规范格式
3. 确认路径解析函数正确工作

### 测试Material绑定
1. 选择材质属性作为target
2. 使用IMAGE_BASE64类型的IoT数据源
3. 验证材质纹理能够正确更新

### 测试节点和实例绑定
1. 分别测试节点和实例属性选择
2. 确认路径格式正确
3. 验证数据绑定能够正常工作

## 未来扩展

### 1. 更多材质类型支持
- 添加更多材质模型支持（如Phong、Lambert等）
- 支持自定义材质属性

### 2. 节点层次绑定
- 支持深层节点层次结构
- 添加节点查找和筛选功能

### 3. 批量绑定
- 支持批量创建多个target绑定
- 模板化的绑定配置

这次重构确保了IoT绑定系统的target路径格式标准化，并为future的功能扩展打下了良好的基础。