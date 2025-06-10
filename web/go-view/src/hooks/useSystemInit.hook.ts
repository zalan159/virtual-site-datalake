import { useSystemStore } from '@/store/modules/systemStore/systemStore'
import { SystemStoreEnum } from '@/store/modules/systemStore/systemStore.d'
import { ResultEnum } from '@/enums/httpEnum'
import { ossUrlApi } from '@/api/path'
import { fetchRouteParamsLocation } from '@/utils'


// * 初始化
export const useSystemInit = async () => {
  const systemStore = useSystemStore()

  // 处理透明背景
  const search = new URLSearchParams(fetchRouteParamsLocation())
  if (search.get('transparentBg') === 'true') {
    const rootStyle = document.documentElement.style
    rootStyle.setProperty('background-color', 'transparent', 'important')
    
    const bodyStyle = document.body.style
    bodyStyle.setProperty('background-color', 'transparent', 'important')
  }

  // 获取 OSS 信息的 url 地址，用来拼接展示图片的地址
  const getOssUrl = async () => {
    const res = await ossUrlApi({})
    if (res && res.code === ResultEnum.SUCCESS) {
      systemStore.setItem(SystemStoreEnum.FETCH_INFO, {
        OSSUrl: res.data?.bucketURL
      })
    }
  }

  // 执行
  getOssUrl()
}