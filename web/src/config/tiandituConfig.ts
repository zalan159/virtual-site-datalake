// 天地图WMTS服务配置
export interface TiandituWMTSConfig {
  baseUrl: string;
  token: string;
  layers: {
    [key: string]: {
      name: string;
      layer: string;
      format: string;
      description: string;
    };
  };
}

// 天地图WMTS服务默认配置
export const TIANDITU_WMTS_CONFIG: TiandituWMTSConfig = {
  baseUrl: 'http://t0.tianditu.gov.cn',
  token: '', // 需要在环境变量中配置: VITE_TIANDITU_TOKEN
  layers: {
    // 影像底图
    img: {
      name: '影像底图',
      layer: 'img',
      format: 'image/png',
      description: '天地图影像底图服务'
    },
    // 矢量底图
    vec: {
      name: '矢量底图',
      layer: 'vec',
      format: 'image/png',
      description: '天地图矢量底图服务'
    },
    // 地形底图
    ter: {
      name: '地形底图',
      layer: 'ter',
      format: 'image/png',
      description: '天地图地形底图服务'
    },
    // 影像注记
    cia: {
      name: '影像注记',
      layer: 'cia',
      format: 'image/png',
      description: '天地图影像注记图层，需要叠加在影像底图上'
    },
    // 矢量注记
    cva: {
      name: '矢量注记',
      layer: 'cva',
      format: 'image/png',
      description: '天地图矢量注记图层，需要叠加在矢量底图上'
    },
    // 地形注记
    cta: {
      name: '地形注记',
      layer: 'cta',
      format: 'image/png',
      description: '天地图地形注记图层，需要叠加在地形底图上'
    }
  }
};

/**
 * 构建天地图WMTS服务URL
 * @param layerType 图层类型 (img, vec, ter, cia, cva, cta)
 * @param token 天地图开发者令牌
 * @returns 完整的WMTS服务URL
 */
export function buildTiandituWMTSUrl(layerType: string, token?: string): string {
  const actualToken = token || import.meta.env.VITE_TIANDITU_TOKEN || '';
  
  if (!actualToken) {
    console.warn('天地图token未配置，请在环境变量中设置VITE_TIANDITU_TOKEN');
  }
  
  const layer = TIANDITU_WMTS_CONFIG.layers[layerType]?.layer || layerType;
  
  // 构建基础URL，注意这里使用c坐标系
  const baseUrl = `${TIANDITU_WMTS_CONFIG.baseUrl}/${layer}_c/wmts`;
  
  // 添加token参数 - 如果URL中已经有参数，使用&连接，否则使用?
  if (actualToken) {
    const separator = baseUrl.includes('?') ? '&' : '?';
    return `${baseUrl}${separator}tk=${actualToken}`;
  }
  
  return baseUrl;
}

/**
 * 获取天地图图层配置信息
 * @param layerType 图层类型
 * @returns 图层配置对象，包含完整的服务配置
 */
export function getTiandituLayerConfig(layerType: string, token?: string) {
  const layer = TIANDITU_WMTS_CONFIG.layers[layerType];
  
  if (!layer) {
    return {
      name: `未知图层 (${layerType})`,
      layer: layerType,
      format: 'image/png',
      description: '未知的天地图图层类型',
      serviceUrl: buildTiandituWMTSUrl(layerType, token),
      layerName: layerType,
      tileMatrixSet: 'c'
    };
  }
  
  return {
    ...layer,
    serviceUrl: buildTiandituWMTSUrl(layerType, token),
    layerName: layer.layer,
    tileMatrixSet: 'c'
  };
}

/**
 * 验证天地图token格式
 * @param token 要验证的token
 * @returns 是否为有效格式
 */
export function validateTiandituToken(token: string): boolean {
  // 天地图token通常是32位的字母数字组合
  return /^[a-f0-9]{32}$/i.test(token);
}

// 天地图常用图层配置选项
export const TIANDITU_LAYER_OPTIONS = [
  { value: 'img', label: '影像底图' },
  { value: 'vec', label: '矢量底图' },
  { value: 'ter', label: '地形底图' },
  { value: 'cia', label: '影像注记' },
  { value: 'cva', label: '矢量注记' },
  { value: 'cta', label: '地形注记' }
];

// 天地图常用图层组合
export const TIANDITU_LAYER_COMBINATIONS = {
  // 影像+注记
  satellite: {
    base: 'img',
    overlay: 'cia',
    name: '卫星影像'
  },
  // 矢量+注记
  vector: {
    base: 'vec',
    overlay: 'cva',
    name: '矢量地图'
  },
  // 地形+注记
  terrain: {
    base: 'ter',
    overlay: 'cta',
    name: '地形地图'
  }
}; 