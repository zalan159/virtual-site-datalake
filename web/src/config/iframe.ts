// iframe集成配置
export interface IframeConfig {
  editorUrl: string;
  viewerUrl: string;
  targetOrigin: string;
}

/**
 * 获取GoView的iframe配置
 */
export function getGoViewIframeConfig(): IframeConfig {
  const isDev = !import.meta.env.PROD;
  
  if (isDev) {
    // 开发环境 - 使用独立的GoView服务
    const editorUrl = import.meta.env.VITE_REACT_APP_GOVIEW_EDITOR_URL || 'http://localhost:3001';
    const viewerUrl = import.meta.env.VITE_REACT_APP_GOVIEW_VIEWER_URL || 'http://localhost:3001';
    
    return {
      editorUrl,
      viewerUrl,
      targetOrigin: new URL(editorUrl).origin
    };
  } else {
    // 生产环境 - 使用同源的子应用
    const baseUrl = `${window.location.origin}/goview`;
    
    return {
      editorUrl: baseUrl,
      viewerUrl: baseUrl,
      targetOrigin: window.location.origin
    };
  }
}

/**
 * 验证消息来源是否有效
 */
export function isValidMessageSource(event: MessageEvent, iframeRef: React.RefObject<HTMLIFrameElement>): boolean {
  if (import.meta.env.PROD) {
    // 生产环境下，检查消息是否来自同源的iframe
    return event.source === iframeRef.current?.contentWindow;
  } else {
    // 开发环境下，检查origin
    const config = getGoViewIframeConfig();
    return event.origin === config.targetOrigin;
  }
}

/**
 * 发送消息到GoView iframe
 */
export function postMessageToGoView(
  iframeRef: React.RefObject<HTMLIFrameElement>, 
  message: any
): void {
  if (!iframeRef.current?.contentWindow) return;
  
  const config = getGoViewIframeConfig();
  iframeRef.current.contentWindow.postMessage(message, config.targetOrigin);
}

/**
 * 构建GoView编辑器URL
 */
export function buildGoViewEditorUrl(chartId: string, token?: string): string {
  const config = getGoViewIframeConfig();
  const params = new URLSearchParams();
  
  if (token) {
    params.set('token', token);
  }
  
  const queryString = params.toString();
  const separator = queryString ? '?' : '';
  
  return `${config.editorUrl}/#/chart/home/${chartId}${separator}${queryString}`;
}

/**
 * 构建GoView预览器URL  
 */
export function buildGoViewViewerUrl(projectId: string, token?: string): string {
  const config = getGoViewIframeConfig();
  const params = new URLSearchParams();
  
  params.set('projectId', projectId);
  if (token) {
    params.set('token', token);
  }
  
  const queryString = params.toString();
  
  return `${config.viewerUrl}/project-view?${queryString}`;
} 