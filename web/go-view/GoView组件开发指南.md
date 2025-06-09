# GoView 组件开发指南

本文档总结了如何在 GoView 项目中开发自定义组件的完整流程，以视频流组件为例。

## 📋 目录

1. [项目结构理解](#项目结构理解)
2. [组件开发流程](#组件开发流程)
3. [文件结构和功能](#文件结构和功能)
4. [核心概念](#核心概念)
5. [开发实践](#开发实践)
6. [注意事项](#注意事项)
7. [调试技巧](#调试技巧)

## 🏗️ 项目结构理解

### 组件分类目录

GoView 的组件按功能分类存放在 `src/packages/components/` 下：

```
src/packages/components/
├── Charts/          # 图表组件
├── Decorates/       # 装饰组件
├── Icons/           # 图标组件
├── Informations/    # 信息组件
├── Photos/          # 图片组件
└── Tables/          # 表格组件
```

### 信息组件子分类

以信息组件为例，进一步分为子类：

```
Informations/
├── Inputs/          # 输入控件
├── Mores/           # 更多组件
├── Texts/           # 文本组件
├── Titles/          # 标题组件
└── index.d.ts       # 类型定义
```

## 🚀 组件开发流程

### 第一步：创建组件目录

在相应的分类下创建组件文件夹：

```bash
mkdir -p src/packages/components/Informations/Mores/VideoStream
```

### 第二步：创建必需文件

每个组件需要以下4个核心文件：

```
VideoStream/
├── index.ts         # 组件配置声明
├── index.vue        # 组件渲染模板
├── config.ts        # 数据配置类
└── config.vue       # 设置界面
```

### 第三步：添加组件图标

```bash
# 将图标放在对应的图片目录
cp video_stream.png src/assets/images/chart/informations/
```

### 第四步：注册组件

在相应的 `index.ts` 文件中导出组件配置：

```typescript
// src/packages/components/Informations/Mores/index.ts
import { VideoStreamConfig } from './VideoStream/index'

export default [...otherConfigs, VideoStreamConfig]
```

## 📁 文件结构和功能

### 1. index.ts - 组件配置声明

```typescript
import { ConfigType, PackagesCategoryEnum, ChartFrameEnum } from '@/packages/index.d'
import { ChatCategoryEnum, ChatCategoryEnumName } from '../../index.d'

export const VideoStreamConfig: ConfigType = {
  key: 'VideoStream',              // 唯一标识符
  chartKey: 'VVideoStream',        // 渲染组件名 (V + key)
  conKey: 'VCVideoStream',         // 配置组件名 (VC + key)
  title: '视频流',                 // 显示名称
  category: ChatCategoryEnum.MORE, // 子分类
  categoryName: ChatCategoryEnumName.MORE,
  package: PackagesCategoryEnum.INFORMATIONS, // 包分类
  chartFrame: ChartFrameEnum.COMMON,          // 框架类型
  image: 'video_stream.png'                   // 组件图标
}
```

**关键点：**
- `key` 必须与文件夹名称一致
- `chartKey` 和 `conKey` 有固定的命名规范
- `chartFrame` 分为 `ECHARTS` 和 `COMMON` 两种类型

### 2. config.ts - 数据配置类

```typescript
import { PublicConfigClass } from '@/packages/public'
import { CreateComponentType } from '@/packages/index.d'
import { VideoStreamConfig } from './index'
import cloneDeep from 'lodash/cloneDeep'

// 默认配置选项
export const option = {
  dataset: 'https://example.com/stream.m3u8',
  loop: false,
  muted: false,
  // ... 其他配置项
}

// 配置类
export default class Config extends PublicConfigClass implements CreateComponentType {
  public key = VideoStreamConfig.key
  public chartConfig = cloneDeep(VideoStreamConfig)
  public option = cloneDeep(option)
}
```

**关键点：**
- 继承 `PublicConfigClass`
- 实现 `CreateComponentType` 接口
- 使用深拷贝避免引用问题

### 3. index.vue - 组件渲染模板

```vue
<template>
  <div class="go-video-stream">
    <!-- 组件内容 -->
  </div>
</template>

<script setup lang="ts">
import { PropType, toRefs, shallowReactive } from 'vue'
import { useChartDataFetch } from '@/hooks'
import { CreateComponentType } from '@/packages/index.d'
import { useChartEditStore } from '@/store/modules/chartEditStore/chartEditStore'
import { option as configOption } from './config'

const props = defineProps({
  chartConfig: {
    type: Object as PropType<CreateComponentType>,
    required: true
  }
})

const { w, h } = toRefs(props.chartConfig.attr)
let option = shallowReactive({ ...configOption })

// 数据更新处理
useChartDataFetch(props.chartConfig, useChartEditStore, (newData: any) => {
  option = newData
})
</script>
```

**关键点：**
- 必须接收 `chartConfig` prop
- 使用 `useChartDataFetch` 处理数据更新
- 使用 `shallowReactive` 提高性能

### 4. config.vue - 设置界面

```vue
<template>
  <collapse-item name="组件名称" expanded>
    <setting-item-box name="配置分组">
      <setting-item name="配置项">
        <!-- 具体的配置控件 -->
      </setting-item>
    </setting-item-box>
  </collapse-item>
</template>

<script setup lang="ts">
import { PropType } from 'vue'
import { option } from './config'
import { CollapseItem, SettingItemBox, SettingItem } from '@/components/Pages/ChartItemSetting'

defineProps({
  optionData: {
    type: Object as PropType<typeof option>,
    required: true
  }
})
</script>
```

## 🎯 核心概念

### 1. 组件生命周期

- **创建阶段**：执行 `new Config()` 创建组件实例
- **渲染阶段**：Vue 组件挂载和渲染
- **数据更新**：通过 `useChartDataFetch` 监听数据变化
- **销毁阶段**：组件卸载时清理资源

### 2. 数据流

```
用户操作 → config.vue → option数据 → index.vue → 视觉呈现
    ↑                                         ↓
配置面板 ←← useChartDataFetch ←← 数据源更新
```

### 3. 主题系统

组件需要支持全局主题切换：

```typescript
// 在组件中接收主题参数
const props = defineProps({
  themeSetting: { type: Object, required: true },
  themeColor: { type: Object, required: true },
  chartConfig: { type: Object, required: true }
})
```

### 4. 样式规范

使用 SCSS 和 BEM 命名规范：

```scss
@include go('video-stream') {
  &-player {
    width: 100%;
    height: 100%;
  }
  
  &-loading {
    // 加载状态样式
  }
}
```

## 💡 开发实践

### 1. API 集成

```typescript
import { get, post } from '@/api/http'

// 获取数据
const fetchData = async () => {
  try {
    const res = await get<ResponseType>('/api/endpoint')
    if (res.data && res.data.code === 0) {
      // 处理成功响应
    }
  } catch (error) {
    console.error('API调用失败:', error)
  }
}
```

### 2. 错误处理

```typescript
// 统一的错误处理
const handleError = (error: string) => {
  console.error(error)
  window['$message']?.error(error)
}
```

### 3. 性能优化

- 使用 `shallowReactive` 而不是 `reactive`
- 合理使用 `watch` 的 `immediate` 和 `deep` 选项
- 及时清理定时器和事件监听器

### 4. 类型安全

```typescript
// 定义清晰的接口类型
interface ComponentOption {
  dataset: string
  loop: boolean
  // ... 其他配置
}

// 使用泛型确保类型安全
const res = await get<{code: number, data: DataType[]}>('/api')
```

## ⚠️ 注意事项

### 1. 命名规范

- 组件key必须与文件夹名称一致
- chartKey = 'V' + key
- conKey = 'VC' + key
- 图片文件放在对应的images目录

### 2. 依赖管理

- 第三方库需要先安装：`npm install library-name`
- TypeScript类型：`npm install -D @types/library-name`
- 在组件中按需导入

### 3. 跨域和安全

- 视频组件需要设置 `crossOrigin="anonymous"`
- API调用需要处理CORS问题
- 避免在客户端暴露敏感信息

### 4. 浏览器兼容性

- 使用现代浏览器API时要做兼容性检查
- 提供优雅的降级方案

### 5. Vue 响应式问题

#### computed 属性更新问题

在某些情况下，Vue 3 的 `computed` 属性可能不会正确响应数据变化，特别是在异步数据更新后。

**问题现象：**
```typescript
// 这种写法可能导致下拉框不显示数据
const options = computed(() => {
  return dataList.value.map(item => ({
    label: item.name,
    value: item.id
  }))
})
```

**解决方案：**
```typescript
// 使用 ref + 手动更新方法
const options = ref<Array<{label: string, value: string}>>([])

const updateOptions = () => {
  options.value = dataList.value.map(item => ({
    label: item.name,
    value: item.id
  }))
}

// 在数据更新后调用
await fetchData()
updateOptions()
```

#### 强制重新渲染组件

当数据更新但组件未响应时，可以使用 `key` 属性强制重新渲染：

```vue
<template>
  <n-select 
    :key="selectKey"
    :options="options"
  />
</template>

<script setup>
const selectKey = ref(0)

// 数据更新后强制重新渲染
const updateData = async () => {
  await fetchData()
  updateOptions()
  selectKey.value++ // 强制重新渲染
}
</script>
```

#### 异步数据处理最佳实践

```typescript
const loading = ref(false)
const dataList = ref([])

const fetchData = async () => {
  loading.value = true
  try {
    const res = await api.getData()
    dataList.value = res.data
    // 立即更新依赖的计算数据
    updateDependentData()
  } catch (error) {
    console.error('数据获取失败:', error)
  } finally {
    loading.value = false
  }
}
```

## 🔧 调试技巧

### 1. 开发环境

```bash
npm run dev  # 启动开发服务器
```

### 2. 控制台调试

```typescript
// 在关键位置添加日志
console.log('组件配置:', props.chartConfig)
console.log('当前选项:', option)
```

### 3. Vue DevTools

- 安装 Vue DevTools 浏览器扩展
- 查看组件状态和props变化

### 4. 构建测试

```bash
npm run build  # 测试生产构建
```

## 📚 扩展学习

### 推荐资源

- [Vue 3 官方文档](https://vuejs.org/)
- [TypeScript 文档](https://www.typescriptlang.org/)
- [Naive UI 组件库](https://www.naiveui.com/)
- [ECharts 文档](https://echarts.apache.org/)

### 进阶技巧

- 学习 ECharts 组件开发（支持 dataset）
- 掌握复杂数据处理和转换
- 了解组件间通信机制
- 研究高级动画和交互效果

---

## 总结

GoView 组件开发遵循清晰的目录结构和命名规范，通过标准化的4个文件实现组件的声明、渲染、配置和设置。关键是理解数据流、主题系统和组件生命周期，并遵循最佳实践进行开发。

开发新组件时，建议先参考现有组件的实现，然后按照本指南的流程逐步开发和测试。 