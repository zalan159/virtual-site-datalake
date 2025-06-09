import { onUnmounted } from 'vue';
import html2canvas from 'html2canvas'
import { getUUID, httpErrorHandle, fetchRouteParamsLocation, base64toFile, JSONStringify, JSONParse } from '@/utils'
import { useChartEditStore } from '@/store/modules/chartEditStore/chartEditStore'
import { EditCanvasTypeEnum, ChartEditStoreEnum, ProjectInfoEnum, ChartEditStorage } from '@/store/modules/chartEditStore/chartEditStore.d'
import { useChartHistoryStore } from '@/store/modules/chartHistoryStore/chartHistoryStore'
import { StylesSetting } from '@/components/Pages/ChartItemSetting'
import { useSystemStore } from '@/store/modules/systemStore/systemStore'
import { useChartLayoutStore } from '@/store/modules/chartLayoutStore/chartLayoutStore'
import { ChartLayoutStoreEnum } from '@/store/modules/chartLayoutStore/chartLayoutStore.d'
import { fetchChartComponent, fetchConfigComponent, createComponent } from '@/packages/index'
import { saveInterval } from '@/settings/designSetting'
import throttle from 'lodash/throttle'
// 接口状态
import { ResultEnum } from '@/enums/httpEnum'
// 接口
import { saveProjectApi, fetchProjectApi, uploadFile, updateProjectApi } from '@/api/path'
// 画布枚举
import { SyncEnum } from '@/enums/editPageEnum'
import { CreateComponentType, CreateComponentGroupType, ConfigType } from '@/packages/index.d'
import { BaseEvent, EventLife } from '@/enums/eventEnum'
import { PublicGroupConfigClass } from '@/packages/public/publicConfig'
import merge from 'lodash/merge'

/**
 * * 画布-版本升级对旧数据无法兼容的补丁
 * @param object
 */
const canvasVersionUpdatePolyfill = (object: any) => {
  return object
}

/**
 * * 组件-版本升级对旧数据无法兼容的补丁
 * @param newObject
 * @param sources
 */
const componentVersionUpdatePolyfill = (newObject: any, sources: any) => {
  try {
    // 判断是否是组件
    if (sources.id) {
      // 处理事件补丁
      const hasVnodeBeforeMount = 'vnodeBeforeMount' in sources.events
      const hasVnodeMounted = 'vnodeMounted' in sources.events

      if (hasVnodeBeforeMount) {
        newObject.events.advancedEvents.vnodeBeforeMount = sources?.events.vnodeBeforeMount
      }
      if (hasVnodeMounted) {
        newObject.events.advancedEvents.vnodeMounted = sources?.events.vnodeMounted
      }
      if (hasVnodeBeforeMount || hasVnodeMounted) {
        sources.events = {
          baseEvent: {
            [BaseEvent.ON_CLICK]: undefined,
            [BaseEvent.ON_DBL_CLICK]: undefined,
            [BaseEvent.ON_MOUSE_ENTER]: undefined,
            [BaseEvent.ON_MOUSE_LEAVE]: undefined
          },
          advancedEvents: {
            [EventLife.VNODE_MOUNTED]: undefined,
            [EventLife.VNODE_BEFORE_MOUNT]: undefined
          },
          interactEvents: []
        }
      }
      return newObject
    }
  } catch (error) {
    return newObject
  }
}

/**
 * * 合并处理
 * @param newObject 新的模板数据
 * @param sources 新拿到的数据
 * @returns object
 */
const componentMerge = (newObject: any, sources: any, notComponent = false) => {
  // 处理组件补丁
  componentVersionUpdatePolyfill(newObject, sources)

  // 非组件不处理
  if (notComponent) return merge(newObject, sources)
  // 组件排除 newObject
  const option = sources.option
  if (!option) return merge(newObject, sources)

  // 为 undefined 的 sources 来源对象属性将被跳过详见 https://www.lodashjs.com/docs/lodash.merge
  sources.option = undefined
  if (option) {
    return {
      ...merge(newObject, sources),
      option: option
    }
  }
}

// 请求处理
export const useSync = () => {
  const chartEditStore = useChartEditStore()
  const chartHistoryStore = useChartHistoryStore()
  const systemStore = useSystemStore()
  const chartLayoutStore = useChartLayoutStore()
  /**
   * * 组件动态注册
   * @param projectData 项目数据
   * @param isReplace 是否替换数据
   * @returns
   */
  const updateComponent = async (projectData: ChartEditStorage, isReplace = false, changeId = false) => {
    // 类型检查：确保projectData是对象而不是字符串
    if (typeof projectData === 'string' || !projectData || typeof projectData !== 'object') {
      console.error('DEBUG: projectData类型错误:', typeof projectData, projectData)
      // 使用默认配置
      projectData = {
        editCanvasConfig: chartEditStore.getEditCanvasConfig,
        requestGlobalConfig: chartEditStore.getRequestGlobalConfig,
        componentList: []
      } as ChartEditStorage
    }

    // 确保必要的属性存在
    if (!projectData.editCanvasConfig) {
      projectData.editCanvasConfig = chartEditStore.getEditCanvasConfig
    }
    
    if (!projectData.requestGlobalConfig) {
      projectData.requestGlobalConfig = chartEditStore.getRequestGlobalConfig
    }
    
    if (!projectData.componentList) {
      projectData.componentList = []
    }

    if (isReplace) {
      // 清除列表
      chartEditStore.componentList = []
      // 清除历史记录
      chartHistoryStore.clearBackStack()
      chartHistoryStore.clearForwardStack()
    }
    // 画布补丁处理
    projectData.editCanvasConfig = canvasVersionUpdatePolyfill(projectData.editCanvasConfig)

    // 列表组件注册
    projectData.componentList.forEach(async (e: CreateComponentType | CreateComponentGroupType) => {
      const intComponent = (target: CreateComponentType) => {
        if (!window['$vue'].component(target.chartConfig.chartKey)) {
          window['$vue'].component(target.chartConfig.chartKey, fetchChartComponent(target.chartConfig))
          window['$vue'].component(target.chartConfig.conKey, fetchConfigComponent(target.chartConfig))
        }
      }

      if (e.isGroup) {
        (e as CreateComponentGroupType).groupList.forEach(groupItem => {
          intComponent(groupItem)
        })
      } else {
        intComponent(e as CreateComponentType)
      }
    })

    // 创建函数-重新创建是为了处理类种方法消失的问题
    const create = async (
      _componentInstance: CreateComponentType,
      callBack?: (componentInstance: CreateComponentType) => void
    ) => {
      // 补充 class 上的方法
      let newComponent: CreateComponentType = await createComponent(_componentInstance.chartConfig)
      if (_componentInstance.chartConfig.redirectComponent) {
        _componentInstance.chartConfig.dataset && (newComponent.option.dataset = _componentInstance.chartConfig.dataset)
        newComponent.chartConfig.title = _componentInstance.chartConfig.title
        newComponent.chartConfig.chartFrame = _componentInstance.chartConfig.chartFrame
      }
      if (callBack) {
        if (changeId) {
          callBack(componentMerge(newComponent, { ..._componentInstance, id: getUUID() }))
        } else {
          callBack(componentMerge(newComponent, _componentInstance))
        }
      } else {
        if (changeId) {
          chartEditStore.addComponentList(
            componentMerge(newComponent, { ..._componentInstance, id: getUUID() }),
            false,
            true
          )
        } else {
          chartEditStore.addComponentList(componentMerge(newComponent, _componentInstance), false, true)
        }
      }
    }

    // 数据赋值
    for (const key in projectData) {
      // 组件
      if (key === ChartEditStoreEnum.COMPONENT_LIST) {
        let loadIndex = 0
        const listLength = projectData[key].length
        for (const comItem of projectData[key]) {
          // 设置加载数量
          let percentage = parseInt((parseFloat(`${++loadIndex / listLength}`) * 100).toString())
          chartLayoutStore.setItemUnHandle(ChartLayoutStoreEnum.PERCENTAGE, percentage)
          // 判断类型
          if (comItem.isGroup) {
            // 创建分组
            let groupClass = new PublicGroupConfigClass()
            if (changeId) {
              groupClass = componentMerge(groupClass, { ...comItem, id: getUUID() })
            } else {
              groupClass = componentMerge(groupClass, comItem)
            }

            // 异步注册子应用
            const targetList: CreateComponentType[] = []
            for (const groupItem of (comItem as CreateComponentGroupType).groupList) {
              await create(groupItem, e => {
                targetList.push(e)
              })
            }
            groupClass.groupList = targetList

            // 分组插入到列表
            chartEditStore.addComponentList(groupClass, false, true)
          } else {
            await create(comItem as CreateComponentType)
          }
          if (percentage === 100) {
            // 清除历史记录
            chartHistoryStore.clearBackStack()
            chartHistoryStore.clearForwardStack()
          }
        }
      } else if (key === ChartEditStoreEnum.EDIT_CANVAS_CONFIG || key === ChartEditStoreEnum.REQUEST_GLOBAL_CONFIG) {
        componentMerge(chartEditStore[key], projectData[key], true)
      }
    }

    // 清除数量
    chartLayoutStore.setItemUnHandle(ChartLayoutStoreEnum.PERCENTAGE, 0)
  }

  /**
   * * 赋值全局数据
   * @param projectData 项目数据
   * @returns
   */
  const updateStoreInfo = (projectData: {
    id: string,
    projectName: string,
    indexImage: string,
    remarks: string,
    state: number
  }) => {
    const { id, projectName, remarks, indexImage, state } = projectData
    // 直接修改store的state，因为没有对应的action方法
    chartEditStore.projectInfo[ProjectInfoEnum.PROJECT_ID] = id
    chartEditStore.projectInfo[ProjectInfoEnum.PROJECT_NAME] = projectName
    chartEditStore.projectInfo[ProjectInfoEnum.REMARKS] = remarks
    chartEditStore.projectInfo[ProjectInfoEnum.THUMBNAIL] = indexImage
    chartEditStore.projectInfo[ProjectInfoEnum.RELEASE] = state === 1
  }

  // * 数据获取
  const dataSyncFetch = async () => {
    // FIX:重新执行dataSyncFetch需清空chartEditStore.componentList,否则会导致图层重复
    // 切换语言等操作会导致重新执行 dataSyncFetch,此时pinia中并未清空chartEditStore.componentList，导致图层重复
    chartEditStore.componentList = []
    chartEditStore.setEditCanvas(EditCanvasTypeEnum.SAVE_STATUS, SyncEnum.START)
    
    const projectId = fetchRouteParamsLocation()
    console.log('DEBUG: 当前URL:', document.location.hash)
    console.log('DEBUG: 解析的项目ID:', projectId)
    
    try {
      const res = await fetchProjectApi({ projectId })
      console.log('DEBUG: API响应:', res)
      
      if (res && res.code === ResultEnum.SUCCESS) {
        if (res.data) {
          updateStoreInfo(res.data)
          console.log('DEBUG: 已调用updateStoreInfo设置项目信息')
          // 更新全局数据
          try {
            console.log('DEBUG: 开始解析content:', res.data.content.substring(0, 100) + '...')
            const parsedContent = JSONParse(res.data.content)
            console.log('DEBUG: content解析成功:', parsedContent)
            await updateComponent(parsedContent)
          } catch (parseError) {
            console.log('DEBUG: JSONParse解析错误:', parseError)
            // 尝试直接用JSON.parse解析
            try {
              const fallbackContent = JSON.parse(res.data.content)
              console.log('DEBUG: 使用原生JSON.parse解析成功:', fallbackContent)
              await updateComponent(fallbackContent)
            } catch (fallbackError) {
              console.log('DEBUG: 原生JSON.parse也失败:', fallbackError)
              throw parseError
            }
          }
          return
        }else {
          chartEditStore.projectInfo[ProjectInfoEnum.PROJECT_ID] = fetchRouteParamsLocation()
        }
        setTimeout(() => {
          chartEditStore.setEditCanvas(EditCanvasTypeEnum.SAVE_STATUS, SyncEnum.SUCCESS)
        }, 1000)
        return
      }
      console.log('DEBUG: API响应代码不匹配，期望:', ResultEnum.SUCCESS, '实际:', res?.code)
      chartEditStore.setEditCanvas(EditCanvasTypeEnum.SAVE_STATUS, SyncEnum.FAILURE)
    } catch (error) {
      console.log('DEBUG: API调用异常:', error)
      chartEditStore.setEditCanvas(EditCanvasTypeEnum.SAVE_STATUS, SyncEnum.FAILURE)
      httpErrorHandle()
    }
  }

  // * 数据保存
  const dataSyncUpdate = throttle(async (updateImg = true) => {
    if(!fetchRouteParamsLocation()) return

    let projectId = chartEditStore.getProjectInfo[ProjectInfoEnum.PROJECT_ID];
    if(projectId === null || projectId === ''){
      window['$message'].error('数据初未始化成功,请刷新页面！')
      return
    }

    chartEditStore.setEditCanvas(EditCanvasTypeEnum.SAVE_STATUS, SyncEnum.START)

    // 异常处理：缩略图上传失败不影响JSON的保存
    try {
      if (updateImg) {
        // 获取缩略图片
        const range = document.querySelector('.go-edit-range') as HTMLElement
        // 生成图片
        const canvasImage: HTMLCanvasElement = await html2canvas(range, {
          backgroundColor: null,
          allowTaint: true,
          useCORS: true
        })

        // 上传预览图
        let uploadParams = new FormData()
        uploadParams.append('object', base64toFile(canvasImage.toDataURL(), `${fetchRouteParamsLocation()}_index_preview.png`))
        const uploadRes = await uploadFile(uploadParams)
        // 保存预览图
        if(uploadRes && uploadRes.code === ResultEnum.SUCCESS) {
          if (uploadRes.data.fileurl) {
            await updateProjectApi({
              id: fetchRouteParamsLocation(),
              indexImage: `${uploadRes.data.fileurl}`
            })
          } else {
            await updateProjectApi({
              id: fetchRouteParamsLocation(),
              indexImage: `${systemStore.getFetchInfo.OSSUrl}${uploadRes.data.fileName}`
            })
          }
        }
      }
    } catch (e) {
      console.log(e)
    }

    // 保存数据
    let params = new FormData()
    params.append('projectId', projectId)
    
    // 获取存储信息并清理函数字段
    const storageInfo = chartEditStore.getStorageInfo() || {}
    console.log('DEBUG: 准备保存的原始数据:', storageInfo)
    
    // 使用原生JSON.stringify避免函数序列化问题
    let contentString: string
    try {
      contentString = JSON.stringify(storageInfo, (key, value) => {
        // 跳过函数类型的值
        if (typeof value === 'function') {
          console.log('DEBUG: 跳过函数字段:', key)
          return undefined
        }
        return value
      })
      
      // 检查结果是否有效
      if (!contentString || contentString === 'undefined') {
        console.log('DEBUG: JSON.stringify返回无效结果，使用fallback')
        contentString = JSON.stringify(storageInfo)
      }
    } catch (error) {
      console.error('DEBUG: JSON序列化失败:', error)
      // fallback：使用默认序列化
      contentString = JSON.stringify(storageInfo)
    }
    
    console.log('DEBUG: 序列化后的内容长度:', contentString?.length || 0)
    params.append('content', contentString || '{}')
    const res= await saveProjectApi(params)

    if (res && res.code === ResultEnum.SUCCESS) {
      console.log('DEBUG: 保存成功')
      // 显示成功提示
      window['$message'].success('项目保存成功！')
      // 成功状态
      setTimeout(() => {
        chartEditStore.setEditCanvas(EditCanvasTypeEnum.SAVE_STATUS, SyncEnum.SUCCESS)
      }, 1000)
      return
    }
    console.log('DEBUG: 保存失败，响应:', res)
    // 显示失败提示
    window['$message'].error('项目保存失败，请重试！')
    // 失败状态
    chartEditStore.setEditCanvas(EditCanvasTypeEnum.SAVE_STATUS, SyncEnum.FAILURE)
  }, 3000)

  // * 定时处理
  const intervalDataSyncUpdate = () => {
    // 定时获取数据
    const syncTiming = setInterval(() => {
      dataSyncUpdate()
    }, saveInterval * 1000)

    // 销毁
    onUnmounted(() => {
      clearInterval(syncTiming)
    })
  }

  return {
    updateComponent,
    updateStoreInfo,
    dataSyncFetch,
    dataSyncUpdate,
    intervalDataSyncUpdate
  }
}
