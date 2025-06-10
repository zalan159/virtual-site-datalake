<template>
  <div :class="['go-preview', localStorageInfo.editCanvasConfig.previewScaleType]" @mousedown="dragCanvas">
    <template v-if="showEntity">
      <!-- 实体区域 -->
      <div ref="entityRef" class="go-preview-entity">
        <!-- 缩放层 -->
        <div ref="previewRef" class="go-preview-scale">
          <!-- 展示层 -->
          <div :style="previewRefStyle" v-if="show">
            <!-- 渲染层 -->
            <preview-render-list></preview-render-list>
          </div>
        </div>
      </div>
    </template>
    <template v-else>
      <!-- 缩放层 -->
      <div ref="previewRef" class="go-preview-scale">
        <!-- 展示层 -->
        <div :style="previewRefStyle" v-if="show">
          <!-- 渲染层 -->
          <preview-render-list></preview-render-list>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, nextTick, watch } from 'vue'
import { PreviewRenderList } from './components/PreviewRenderList'
import { getFilterStyle, setTitle } from '@/utils'
import { getEditCanvasConfigStyle, keyRecordHandle, dragCanvas } from './utils'
import { useComInstall } from './hooks/useComInstall.hook'
import { useScale } from './hooks/useScale.hook'
import { useSync } from '@/views/chart/hooks/useSync.hook'
import { PreviewScaleEnum } from '@/enums/styleEnum'
import type { ChartEditStorageType } from './index.d'
import { useChartEditStore } from '@/store/modules/chartEditStore/chartEditStore'

const chartEditStore = useChartEditStore()
const { dataSyncFetch } = useSync()

// 从 sessionStorage 或 API 获取数据
await dataSyncFetch()

const localStorageInfo: ChartEditStorageType = {
  id: chartEditStore.getProjectInfo.projectId,
  editCanvasConfig: {
    ...chartEditStore.getEditCanvasConfig,
    projectName: chartEditStore.getProjectInfo.projectName,
  },
  componentList: chartEditStore.getComponentList,
  requestGlobalConfig: chartEditStore.getRequestGlobalConfig
}

setTitle(`预览-${localStorageInfo.editCanvasConfig.projectName}`)

const previewRefStyle = computed(() => {
  return {
    overflow: 'hidden',
    ...getEditCanvasConfigStyle(localStorageInfo.editCanvasConfig),
    ...getFilterStyle(localStorageInfo.editCanvasConfig)
  }
})

const showEntity = computed(() => {
  const type = localStorageInfo.editCanvasConfig.previewScaleType
  return type === PreviewScaleEnum.SCROLL_Y || type === PreviewScaleEnum.SCROLL_X
})

const { entityRef, previewRef } = useScale(localStorageInfo)
const { show } = useComInstall(localStorageInfo)

const calculateChartBounds = () => {
  const bounds: Array<{ x: number; y: number; width: number; height: number }> = []
  const chartItems = document.querySelectorAll('.chart-item')
  
  chartItems.forEach((item) => {
    // 排除背景组件
    if (item.classList.contains('is-background')) return
    
    const rect = item.getBoundingClientRect()
    if (rect.width > 0 && rect.height > 0) {
      bounds.push({
        x: rect.left,
        y: rect.top,
        width: rect.width,
        height: rect.height
      })
    }
  })

  if (window.parent && window.parent !== window) {
    window.parent.postMessage({
      type: 'CHART_BOUNDS_UPDATE',
      bounds: bounds
    }, '*')
  }
}

watch(() => chartEditStore.getComponentList, () => {
  nextTick(() => {
    setTimeout(calculateChartBounds, 100)
  })
}, { deep: true })

onMounted(() => {
  setTimeout(calculateChartBounds, 500)
  
  // 强制设置背景透明
  document.documentElement.style.background = 'transparent'
  document.body.style.background = 'transparent'
})

keyRecordHandle()
</script>

<style lang="scss" scoped>
@include go('preview') {
  position: relative;
  height: 100vh;
  width: 100vw;
  // 移除所有 pointer-events 相关的样式
  
  &.fit,
  &.full {
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    .go-preview-scale {
      transform-origin: center center;
    }
  }
  &.scrollY {
    overflow-x: hidden;
    .go-preview-scale {
      transform-origin: left top;
    }
  }
  &.scrollX {
    overflow-y: hidden;
    .go-preview-scale {
      transform-origin: left top;
    }
  }
  .go-preview-entity {
    overflow: hidden;
  }
}
</style>
