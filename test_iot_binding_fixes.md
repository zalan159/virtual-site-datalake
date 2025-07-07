# IoT绑定修复测试

## 修复内容

### 1. 连接配置下拉框高度溢出问题修复
- **问题**: MQTT、WebSocket、HTTP连接配置的下拉框占位是一行，但下拉框内容是2行，导致了下拉选中后高度溢出
- **解决方案**: 
  - 添加了`optionLabelProp="label"`属性到Select组件
  - 为Option组件添加了`label`属性，显示简化的连接名称
  - 保持下拉选项中的详细信息（名称+连接信息）

### 2. 目标属性选择弹窗增加node属性支持
- **问题**: 在绑定映射选择目标属性的弹窗中，只提供了instance属性以供选择，缺少instance的node属性选择
- **解决方案**:
  - 为PropertySelectorModal添加了标签页功能，支持"实例属性"和"模型节点"两个标签
  - 添加了`buildNodeTree`函数来构建节点树结构
  - 添加了`fetchModelNodes`函数来获取模型节点数据
  - 支持从骨骼节点中选择translation、rotation、scale属性

### 3. 确保选中node后将node.nodeindex写入目标属性
- **问题**: 选中node后需要自动包含nodeindex信息用于后续解析定位
- **解决方案**:
  - 修改了`handleTreeSelect`函数，当选择节点相关属性时，自动在路径后添加`.nodeindex=${nodeIndex}`
  - 扩展了ExtendedDataNode接口，支持nodeIndex字段
  - 在构建节点树时为每个节点属性包含nodeIndex信息

## 修改的文件

1. **IoTBindingConfigModal.tsx**
   - 修复了连接配置下拉框的高度溢出问题
   - 添加了`optionLabelProp`和`label`属性

2. **DataPathHelper.tsx**
   - 添加了模型节点支持
   - 增加了标签页切换功能
   - 实现了标准化的node路径格式

## 测试指导

### 测试连接配置下拉框修复
1. 进入IoT绑定配置页面
2. 选择MQTT、WebSocket或HTTP协议
3. 打开连接配置下拉框
4. **预期结果**: 下拉选项应该正确显示，选中后不会出现高度溢出

### 测试node属性选择功能
1. 进入IoT绑定配置页面
2. 在绑定映射配置中点击"选择属性"按钮
3. 在弹出的属性选择器中切换到"模型节点"标签
4. **预期结果**: 
   - 能看到模型的节点树结构
   - 每个节点都有translation、rotation、scale子属性
   - 选择节点属性后，路径格式正确

### 测试nodeindex包含
1. 选择任一模型节点的transformation属性
2. **预期结果**: 选中的路径格式为 `node_X.translation.nodeindex=X`

## 进一步优化内容

### 4. 优化节点数据获取机制
- **改进**: 实现了多层级的节点数据获取策略，按优先级尝试不同数据源
- **获取顺序**:
  1. 从全局动画状态获取 (`window.cesiumAnimationState`)
  2. 从Cesium Viewer获取 (`window.cesiumViewer.animationState`)
  3. 从当前模型直接解析（待实现）
  4. 使用示例数据（回退方案）

### 5. 添加用户指导提示
- **改进**: 在节点选择标签页中添加了详细的用户指导信息
- **内容**: 说明节点数据来源的获取顺序和开发环境的调试方法
- **示例数据**: 提供了更丰富的层次化示例节点数据

### 6. 代码质量提升
- **改进**: 清理了未使用的导入和TypeScript警告
- **优化**: 简化了复杂的逻辑，提高了代码可维护性

## 技术实现细节

### 节点数据结构
```typescript
interface BoneNode {
  id: string;           // 节点ID，格式：node_X
  name: string;         // 节点名称
  translation?: [number, number, number];  // 位移
  rotation?: [number, number, number, number];  // 旋转（四元数）
  scale?: [number, number, number];  // 缩放
  children?: BoneNode[]; // 子节点
}
```

### 目标路径格式
- **实例属性**: `properties.temperature` 
- **节点属性**: `node_1.translation.nodeindex=1`
- **nodeindex作用**: 用于后端定位具体的3D模型节点

## 开发环境调试

如果你在开发环境中想要测试真实的节点数据，可以在浏览器控制台中设置：

```javascript
// 设置全局动画状态（最高优先级）
window.cesiumAnimationState = {
  boneNodes: [
    {
      id: 'node_0',
      name: 'RealRootNode',
      translation: [0, 0, 0],
      rotation: [0, 0, 0, 1],
      scale: [1, 1, 1],
      children: []
    }
  ]
};

// 或者设置Cesium Viewer状态
window.cesiumViewer = {
  animationState: {
    boneNodes: [/* 真实节点数据 */]
  }
};
```

## 注意事项

- 节点数据获取已实现多重回退机制，确保在任何情况下都能提供可用的节点选择功能
- 示例数据提供了完整的层次化结构，包含父子节点关系
- 所有节点属性选择后都会自动包含nodeindex信息，无需手动添加
- 用户界面提供了清晰的指导信息，帮助开发者理解数据来源和调试方法