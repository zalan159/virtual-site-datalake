import { PublicConfigClass } from '@/packages/public'
import { CreateComponentType } from '@/packages/index.d'
import { VideoStreamConfig } from './index'
import cloneDeep from 'lodash/cloneDeep'

export const option = {
  // HLS视频流地址（输入框）
  dataset: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
  // 选择框视频源ID（从后端获取的视频流）
  selectedStreamId: '',
  // 循环播放
  loop: false,
  // 静音
  muted: false,
  // 自动播放
  autoplay: true,
  // 显示控制条
  controls: true,
  // 适应方式
  fit: 'contain',
  // 圆角
  borderRadius: 10,
  // 播放器配置
  hlsConfig: {
    debug: false,
    enableWorker: true,
    lowLatencyMode: false,
    backBufferLength: 90
  }
}

export default class Config extends PublicConfigClass implements CreateComponentType {
  public key = VideoStreamConfig.key
  public chartConfig = cloneDeep(VideoStreamConfig)
  public option = cloneDeep(option)
} 