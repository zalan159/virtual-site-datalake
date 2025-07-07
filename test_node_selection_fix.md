# IoT绑定节点选择修复测试

## 修复内容

我已经完成了IoT绑定系统中获取真实模型节点的修复工作。现在系统能够正确地从Cesium viewer获取模型的骨骼节点数据。

### 修复的关键问题

1. **参数传递链路完整化**：
   - `SceneEditorStandalone` → `SelectedModelPropertiesPanel` → `DynamicPropertyForm` → `IoTBindingModal` → `IoTBindingConfigModal` → `DataPathHelper` → `PropertySelectorModal`
   - 每个组件都正确接收和传递了 `viewerRef` 和 `selectedModelId` 参数

2. **真实节点数据获取**：
   - 修改了 `PropertySelectorModal` 中的 `fetchModelNodes` 函数
   - 优先使用传入的 `viewerRef` 和 `selectedModelId`
   - 使用 `extractModelNodesFromCesium` 函数从真实的Cesium模型中提取节点数据
   - 保留了示例数据作为后备方案

3. **调试信息增强**：
   - 添加了详细的控制台日志，帮助追踪数据流
   - 显示获取到的节点数量
   - 明确显示使用的是真实数据还是示例数据

### 修改的文件列表

1. **DataPathHelper.tsx**：
   - 增加了 `viewerRef` 和 `selectedModelId` 接口支持
   - 修改了 `fetchModelNodes` 函数来使用真实的viewer数据
   - 增强了 `extractModelNodesFromCesium` 函数

2. **IoTBindingConfigModal.tsx**：
   - 增加了 `viewerRef` 和 `selectedModelId` 接口支持
   - 传递参数到 `DataPathHelper`

3. **IoTBindingModal.tsx**：
   - 增加了 `viewerRef` 和 `selectedModelId` 接口支持
   - 传递参数到 `IoTBindingConfigModal`

4. **DynamicPropertyForm.tsx**：
   - 增加了 `viewerRef` 和 `selectedModelId` 接口支持
   - 传递参数到 `IoTBindingModal`

5. **SelectedModelPropertiesPanel.tsx**：
   - 增加了 `viewerRef` 和 `selectedModelId` 接口支持
   - 传递参数到 `DynamicPropertyForm`

6. **SceneEditorStandalone.tsx**：
   - 传递 `viewerRef` 和 `selectedInstanceId` 到 `SelectedModelPropertiesPanel`

### 数据流路径

```
SceneEditorStandalone (有viewerRef和selectedInstanceId)
    ↓
SelectedModelPropertiesPanel (接收viewerRef和selectedModelId)
    ↓
DynamicPropertyForm (接收viewerRef和selectedModelId)
    ↓ (当点击IoT绑定按钮时)
IoTBindingModal (接收viewerRef和selectedModelId)
    ↓
IoTBindingConfigModal (接收viewerRef和selectedModelId)
    ↓
DataPathHelper (接收viewerRef和selectedModelId)
    ↓
PropertySelectorModal (接收viewerRef和selectedModelId)
    ↓
fetchModelNodes() 使用真实的Cesium viewer数据
```

### 测试步骤

1. **启动应用**：
   ```bash
   cd web && npm run dev
   ```

2. **进入场景编辑器**：
   - 访问场景编辑器页面
   - 加载一个包含GLB模型的场景
   - 选择一个GLB模型实例

3. **打开IoT绑定配置**：
   - 在右侧属性面板中点击"IoT绑定"按钮
   - 点击"新增IoT绑定"
   - 进入绑定配置页面

4. **测试节点选择功能**：
   - 在绑定映射配置中点击"选择属性"按钮
   - 切换到"模型节点"标签页
   - **期望结果**：应该看到真实的模型节点数据，而不是示例数据

5. **验证日志输出**：
   - 打开浏览器开发者工具
   - 查看控制台输出
   - **期望结果**：应该看到类似以下的日志：
     ```
     🔍 开始获取模型节点...
     🔍 viewerRef: Object (Cesium Viewer)
     🔍 selectedModelId: instance_12345
     📍 使用模型ID: instance_12345
     ✅ 成功获取Cesium viewer
     ✅ 成功获取到 X 个模型节点
     ```

6. **验证节点数据**：
   - 展开节点树查看具体的节点名称和属性
   - **期望结果**：节点名称应该是真实的模型节点名称（如 "RootNode", "Mesh_01" 等），而不是示例的 "RootNode", "Mesh_1", "Bone_1"

### 故障排除

如果仍然显示示例数据，请检查：

1. **GLB模型是否正确加载**：
   - 确保选择的是GLB格式的3D模型
   - 模型必须已经完全加载到Cesium viewer中

2. **模型ID传递**：
   - 在控制台中检查 `selectedModelId` 是否正确传递
   - 确保模型ID与Cesium中的实例ID匹配

3. **Cesium viewer状态**：
   - 确保 `viewerRef.current` 不为null
   - 检查Cesium viewer是否已经初始化完成

4. **模型节点结构**：
   - 某些GLB模型可能没有骨骼节点或动画节点
   - 在这种情况下会回退到示例数据

### 预期的改进效果

修复后，用户将能够：
- ✅ 看到真实的模型节点结构而不是示例数据
- ✅ 正确选择模型的实际节点属性（translation、rotation、scale）
- ✅ 获得准确的 nodeindex 信息用于IoT数据绑定
- ✅ 实现真正的模型节点动画控制