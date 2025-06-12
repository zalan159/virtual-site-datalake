<!-- eslint-disable vue/multi-word-component-names -->
<template>
  <div class="go-video-stream" :style="{ borderRadius: `${option.borderRadius}px` }">
    <!-- 重要：需要设置 crossOrigin="anonymous"，否则保存画板缩略图会失败 -->
    <video
      ref="vVideoRef"
      class="go-video-stream-player"
      preload="metadata"
      crossOrigin="anonymous"
      playsinline
      :autoplay="option.autoplay"
      :loop="option.loop"
      :muted="option.muted"
      :controls="option.controls"
      :width="w"
      :height="h"
      @error="handleVideoError"
      @loadstart="handleLoadStart"
      @loadeddata="handleLoadedData"
    ></video>
    
    <!-- 加载状态 -->
    <div v-if="loading" class="video-loading">
      <div class="loading-spinner"></div>
      <span>加载视频流中...</span>
    </div>
    
    <!-- 错误状态 -->
    <div v-if="error" class="video-error" @click="handlePlayClick">
      <div class="error-icon">{{ error.includes('点击播放') ? '▶️' : '⚠️' }}</div>
      <div class="error-text">{{ error }}</div>
      <div v-if="error.includes('点击播放')" class="play-hint">点击此处开始播放</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { PropType, toRefs, shallowReactive, watch, ref, onMounted, onBeforeUnmount } from 'vue'
import { useChartDataFetch } from '@/hooks'
import { CreateComponentType } from '@/packages/index.d'
import { useChartEditStore } from '@/store/modules/chartEditStore/chartEditStore'
import { option as configOption } from './config'
import Hls from 'hls.js'

const props = defineProps({
  chartConfig: {
    type: Object as PropType<CreateComponentType>,
    required: true
  }
})

const { w, h } = toRefs(props.chartConfig.attr)
let option = shallowReactive({ ...configOption })

const vVideoRef = ref<HTMLVideoElement | null>(null)
const loading = ref(false)
const error = ref('')
let hls: Hls | null = null

// 处理视频错误
const handleVideoError = (event: Event) => {
  console.error('视频播放错误:', event)
  error.value = '视频流加载失败，请检查网络连接或视频源'
  loading.value = false
}

// 处理加载开始
const handleLoadStart = () => {
  loading.value = true
  error.value = ''
}

// 处理数据加载完成
const handleLoadedData = () => {
  loading.value = false
  error.value = ''
}

// 处理播放按钮点击
const handlePlayClick = () => {
  if (error.value.includes('点击播放') && vVideoRef.value) {
    error.value = ''
    vVideoRef.value.play().catch(err => {
      console.warn('手动播放失败:', err.message)
      error.value = '播放失败，请检查视频源'
    })
  }
}

// 注释：删除了fetchStreamList函数，因为现在直接使用dataset字段，不需要API请求

// 获取最终的视频URL
const getFinalVideoUrl = (): string => {
  // 直接使用dataset字段
  console.log('getFinalVideoUrl - 当前option.dataset:', option.dataset)
  if (option.dataset && option.dataset.trim()) {
    console.log('getFinalVideoUrl - 返回URL:', option.dataset.trim())
    return option.dataset.trim()
  }
  
  console.log('getFinalVideoUrl - 没有有效的dataset，返回空字符串')
  return ''
}

// 初始化HLS播放器
const initHlsPlayer = (url: string) => {
  if (!vVideoRef.value) return

  const video = vVideoRef.value
  
  // 清理之前的HLS实例
  if (hls) {
    hls.destroy()
    hls = null
  }

  // 检查是否为HLS视频
  if (url.includes('.m3u8')) {
    if (Hls.isSupported()) {
      // 使用hls.js
      hls = new Hls({
        debug: option.hlsConfig.debug,
        enableWorker: option.hlsConfig.enableWorker,
        lowLatencyMode: option.hlsConfig.lowLatencyMode,
        backBufferLength: option.hlsConfig.backBufferLength
      })
      
      hls.loadSource(url)
      hls.attachMedia(video)
      
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        console.log('HLS manifest 解析完成')
        if (option.autoplay) {
          video.play().catch(err => {
            console.warn('自动播放失败，需要用户交互:', err.message)
            // 自动播放失败时，显示播放按钮供用户点击
            error.value = '点击播放按钮开始播放视频'
          })
        }
      })
      
      hls.on(Hls.Events.ERROR, (event, data) => {
        console.error('HLS播放错误:', event, data)
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              error.value = '网络错误，无法加载视频流'
              hls?.startLoad()
              break
            case Hls.ErrorTypes.MEDIA_ERROR:
              error.value = '媒体错误，视频格式不支持'
              hls?.recoverMediaError()
              break
            default:
              error.value = '未知错误，视频流播放失败'
              break
          }
        }
      })
      
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Safari原生支持HLS
      video.src = url
      if (option.autoplay) {
        video.play().catch(err => {
          console.warn('自动播放失败，需要用户交互:', err.message)
          // 自动播放失败时，显示播放按钮供用户点击
          error.value = '点击播放按钮开始播放视频'
        })
      }
    } else {
      error.value = '当前浏览器不支持HLS视频流播放'
    }
  } else {
    // 普通视频文件
    video.src = url
    if (option.autoplay) {
      video.play().catch(err => {
        console.warn('自动播放失败，需要用户交互:', err.message)
        // 自动播放失败时，显示播放按钮供用户点击
        error.value = '点击播放按钮开始播放视频'
      })
    }
  }
}

// 预览更新
useChartDataFetch(props.chartConfig, useChartEditStore, (newData: any) => {
  console.log('useChartDataFetch 收到新数据:', newData)
  option = newData
  const finalUrl = getFinalVideoUrl()
  console.log('useChartDataFetch 获取到的finalUrl:', finalUrl)
  if (finalUrl) {
    initHlsPlayer(finalUrl)
  }
})

// 编辑更新
watch(
  () => props.chartConfig.option,
  (newData: any) => {
    option = newData
    if (vVideoRef.value) {
      const video = vVideoRef.value
      video.loop = option.loop
      video.muted = option.muted
      video.controls = option.controls
      
      // 获取最终URL并检查是否发生变化
      const finalUrl = getFinalVideoUrl()
      if (video.src !== finalUrl && finalUrl) {
        initHlsPlayer(finalUrl)
      }
    }
  },
  {
    immediate: false,
    deep: true
  }
)

// 组件挂载时初始化
onMounted(() => {
  console.log('组件挂载 - props.chartConfig:', props.chartConfig)
  console.log('组件挂载 - 当前option:', option)
  
  // 确保使用最新的配置数据
  if (props.chartConfig.option) {
    option = { ...option, ...props.chartConfig.option }
    console.log('组件挂载 - 更新后的option:', option)
  }
  
  // 直接初始化播放器
  const finalUrl = getFinalVideoUrl()
  console.log('组件挂载 - 获取到的finalUrl:', finalUrl)
  if (finalUrl) {
    initHlsPlayer(finalUrl)
  }
})

// 组件销毁时清理资源
onBeforeUnmount(() => {
  if (hls) {
    hls.destroy()
    hls = null
  }
})
</script>

<style lang="scss" scoped>
@include go('video-stream') {
  position: relative;
  display: block;
  overflow: hidden;
  
  &-player {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: v-bind('option.fit');
  }
  
  .video-loading {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    background-color: rgba(0, 0, 0, 0.8);
    color: white;
    font-size: 14px;
    
    .loading-spinner {
      width: 24px;
      height: 24px;
      border: 3px solid rgba(255, 255, 255, 0.3);
      border-top: 3px solid #ffffff;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin-bottom: 8px;
    }
  }
  
  .video-error {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    background-color: rgba(0, 0, 0, 0.8);
    color: white;
    font-size: 14px;
    text-align: center;
    padding: 20px;
    cursor: pointer;
    transition: background-color 0.3s ease;
    
    &:hover {
      background-color: rgba(0, 0, 0, 0.9);
    }
    
    .error-icon {
      font-size: 32px;
      margin-bottom: 8px;
    }
    
    .error-text {
      line-height: 1.4;
      margin-bottom: 8px;
    }
    
    .play-hint {
      font-size: 12px;
      opacity: 0.8;
      color: #ccc;
    }
  }
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
</style> 