<!-- eslint-disable vue/multi-word-component-names -->
<!-- eslint-disable vue/no-mutating-props -->
<template>
  <collapse-item name="视频流" expanded>
    <setting-item-box name="视频源" alone>
      <setting-item name="视频流地址" alone>
        <n-input 
          v-model:value="optionData.dataset" 
          size="small"
          placeholder="请输入视频流地址或从下拉框选择"
          clearable
        ></n-input>
      </setting-item>
      <setting-item name="快速选择" alone>
        <div style="display: flex; gap: 8px; align-items: center;">
          <n-select 
            :value="null"
            :key="selectKey"
            size="small"
            placeholder="从后端选择视频流（将更新上方地址）"
            :options="streamOptions"
            :loading="loading"
            clearable
            style="flex: 1;"
            @update:value="handleStreamSelect"
          />
          <n-button 
            size="small" 
            @click="refreshStreamList"
            :loading="loading"
            secondary
          >
            刷新
          </n-button>
        </div>
      </setting-item>
    </setting-item-box>

    <setting-item-box name="播放控制">
      <setting-item>
        <n-checkbox v-model:checked="optionData.autoplay" size="small">自动播放</n-checkbox>
      </setting-item>
      <setting-item>
        <n-checkbox v-model:checked="optionData.loop" size="small">循环播放</n-checkbox>
      </setting-item>
      <setting-item>
        <n-checkbox v-model:checked="optionData.muted" size="small">静音</n-checkbox>
      </setting-item>
      <setting-item>
        <n-checkbox v-model:checked="optionData.controls" size="small">显示控制条</n-checkbox>
      </setting-item>
    </setting-item-box>

    <setting-item-box name="显示样式">
      <setting-item name="适应类型">
        <n-select v-model:value="optionData.fit" size="small" :options="fitList"></n-select>
      </setting-item>
      <setting-item name="圆角大小">
        <n-input-number 
          v-model:value="optionData.borderRadius" 
          size="small" 
          :min="0" 
          :max="50"
          :step="1"
        ></n-input-number>
      </setting-item>
    </setting-item-box>

    <setting-item-box name="HLS高级配置">
      <setting-item>
        <n-checkbox v-model:checked="optionData.hlsConfig.debug" size="small">调试模式</n-checkbox>
      </setting-item>
      <setting-item>
        <n-checkbox v-model:checked="optionData.hlsConfig.enableWorker" size="small">启用Web Worker</n-checkbox>
      </setting-item>
      <setting-item>
        <n-checkbox v-model:checked="optionData.hlsConfig.lowLatencyMode" size="small">低延迟模式</n-checkbox>
      </setting-item>
      <setting-item name="缓冲长度(秒)">
        <n-input-number 
          v-model:value="optionData.hlsConfig.backBufferLength" 
          size="small" 
          :min="30" 
          :max="300"
          :step="10"
        ></n-input-number>
      </setting-item>
    </setting-item-box>
  </collapse-item>
</template>

<script setup lang="ts">
import { PropType, ref, onMounted, watch, nextTick } from 'vue'
import { option } from './config'
import { CollapseItem, SettingItemBox, SettingItem } from '@/components/Pages/ChartItemSetting'
import { streamsApi, type StreamItem } from '@/api/streamsApi'

// 适应类型选项
const fitList = [
  {
    value: 'fill',
    label: 'fill - 填满容器'
  },
  {
    value: 'contain',
    label: 'contain - 等比适应'
  },
  {
    value: 'cover',
    label: 'cover - 等比覆盖'
  },
  {
    value: 'scale-down',
    label: 'scale-down - 缩小适应'
  },
  {
    value: 'none',
    label: 'none - 原始尺寸'
  }
]

const props = defineProps({
  optionData: {
    type: Object as PropType<typeof option>,
    required: true
  }
})

// 响应式数据
const loading = ref(false)
const streamList = ref<StreamItem[]>([])
const selectKey = ref(0) // 用于强制重新渲染select组件

// 使用ref代替computed解决响应式更新问题
const streamOptions = ref<Array<{label: string, value: string, disabled: boolean}>>([])

// 更新选项的方法
const updateStreamOptions = () => {
  const options = streamList.value.map(stream => ({
    label: `${stream.name} (${stream.protocol.toUpperCase()})`,
    value: stream._id,
    disabled: !stream.url
  }))
  console.log('Config updateStreamOptions 结果:', options)
  streamOptions.value = options
}

// 获取视频流列表
const fetchStreamList = async () => {
  loading.value = true
  console.log('=== VideoStream Config: 开始获取视频流列表 ===')
  
  try {
    const data = await streamsApi.getStreamList()
    console.log('Config API响应数据:', data)
    console.log('Config API响应数据类型:', Array.isArray(data) ? 'Array' : typeof data)
    console.log('Config API响应完整数据:', JSON.stringify(data, null, 2))
    
    if (Array.isArray(data)) {
      streamList.value = data
      console.log('Config设置streamList.value:', streamList.value)
      console.log('Config streamList长度:', streamList.value.length)
      if (streamList.value.length > 0) {
        console.log('Config第一个stream对象的所有键:', Object.keys(streamList.value[0]))
        console.log('Config第一个stream完整对象:', streamList.value[0])
      }
      // 更新选项数据
      updateStreamOptions()
      
      // 强制重新渲染select组件
      selectKey.value++
      nextTick(() => {
        console.log('Config 更新后的streamOptions:', streamOptions.value)
      })
    } else {
      console.warn('获取视频流列表失败: 数据格式不正确', data)
      window['$message']?.warning('获取视频流列表失败')
    }
  } catch (error) {
    console.error('Config获取视频流列表异常:', error)
    if (error instanceof Error) {
      console.error('Config错误详情:', error.message)
    }
    window['$message']?.error('获取视频流列表失败，请检查网络连接')
    // 如果API调用失败，清空列表
    streamList.value = []
  } finally {
    loading.value = false
    console.log('=== VideoStream Config: 获取视频流列表完成 ===')
  }
}

// 刷新视频流列表
const refreshStreamList = () => {
  fetchStreamList()
}

// 处理视频流选择
const handleStreamSelect = (value: string | null) => {
  console.log('Config选择了视频流:', value)
  
  if (value && streamList.value.length > 0) {
    // 根据选中的ID找到对应的视频流对象
    const selectedStream = streamList.value.find(stream => stream._id === value)
    if (selectedStream && selectedStream.url) {
      // 直接更新dataset字段
      props.optionData.dataset = selectedStream.url
      console.log('Config更新视频流地址为:', selectedStream.url)
    } else {
      console.warn('Config未找到对应的视频流或URL为空')
    }
  }
  // 注意：不清空dataset，让用户可以手动删除
}

// 监控streamOptions变化
watch(streamOptions, (newOptions) => {
  console.log('Config streamOptions变化:', newOptions)
  console.log('Config streamOptions长度:', newOptions.length)
  // 强制刷新DOM
  nextTick(() => {
    console.log('Config DOM更新完成')
  })
}, { immediate: true, deep: true })

// 监控streamList变化
watch(streamList, (newList) => {
  console.log('Config streamList变化:', newList)
  console.log('Config streamList长度:', newList.length)
}, { immediate: true, deep: true })

// 组件挂载时获取数据
onMounted(() => {
  console.log('Config组件挂载，开始获取数据')
  fetchStreamList()
})
</script> 