import { buildTiandituWMTSUrl, getTiandituLayerConfig } from '../config/tiandituConfig';

/**
 * 测试天地图配置是否正确
 */
export function testTiandituConfig(token: string) {
  console.log('=== 天地图配置测试 ===');
  
  // 测试不同图层的URL生成
  const layers = ['img', 'vec', 'ter', 'cia', 'cva', 'cta'];
  
  layers.forEach(layer => {
    const url = buildTiandituWMTSUrl(layer, token);
    const config = getTiandituLayerConfig(layer, token);
    
    console.log(`图层 ${layer}:`);
    console.log(`  URL: ${url}`);
    console.log(`  配置:`, config);
    console.log('---');
  });
  
  // 生成标准的WMTS GetTile请求URL示例
  const sampleUrl = buildTiandituWMTSUrl('img', token);
  const getTileUrl = `${sampleUrl}&service=WMTS&request=GetTile&version=1.0.0&layer=img&style=default&tilematrixSet=c&format=image/png&tilematrix=12&tilecol=3370&tilerow=1559`;
  
  console.log('=== 示例GetTile请求URL ===');
  console.log(getTileUrl);
  
  return {
    baseUrl: buildTiandituWMTSUrl('img', token),
    sampleGetTileUrl: getTileUrl
  };
}

/**
 * 验证天地图请求URL是否正确
 */
export function validateTiandituUrl(url: string): boolean {
  try {
    const urlObj = new URL(url);
    
    // 检查域名
    if (!urlObj.hostname.includes('tianditu.gov.cn')) {
      console.error('无效的天地图域名');
      return false;
    }
    
    // 检查是否包含token
    const token = urlObj.searchParams.get('tk');
    if (!token) {
      console.error('缺少token参数(tk)');
      return false;
    }
    
    // 检查token格式
    if (!/^[a-f0-9]{32}$/i.test(token)) {
      console.warn('token格式可能不正确，标准格式为32位十六进制字符');
    }
    
    console.log('URL验证通过');
    return true;
    
  } catch (error) {
    console.error('URL格式错误:', error);
    return false;
  }
} 