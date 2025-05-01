import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Spin, message, App } from 'antd';
import { Engine3D, Scene3D, Object3D, Camera3D, DirectLight, HoverCameraController, Color, View3D, AtmosphericComponent } from '@orillusion/core';
import modelAPI from '../../services/modelApi';

const ModelPreviewStandalone = () => {
  const { modelId } = useParams<{ modelId: string }>();
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modelUrl, setModelUrl] = useState<string | null>(null);
  const viewRef = useRef<View3D | null>(null);
  const { message: appMessage } = App.useApp();

  useEffect(() => {
    const fetchModelUrl = async () => {
      if (!modelId) return;
      
      try {
        setLoading(true);
        const response = await modelAPI.getConvertedModelDownloadUrl(modelId);
        if (response.data && response.data.download_url) {
          setModelUrl(response.data.download_url);
        } else {
          setError('无法获取模型URL');
        }
      } catch (error: any) {
        console.error('获取模型URL失败:', error);
        setError(`获取模型URL失败: ${error.response?.data?.detail || error.message || '未知错误'}`);
      } finally {
        setLoading(false);
      }
    };

    fetchModelUrl();
  }, [modelId]);

  useEffect(() => {
    if (!modelUrl || !containerRef.current) return;

    const initEngine = async () => {
      try {
        // 初始化引擎
        await Engine3D.init();
        
        // 创建新场景作为根节点
        const scene3D: Scene3D = new Scene3D();
        
        // 添加大气天空环境
        const sky = scene3D.addComponent(AtmosphericComponent);
        sky.sunY = 0.6;
        
        // 创建相机
        const cameraObj: Object3D = new Object3D();
        const camera = cameraObj.addComponent(Camera3D);
        
        // 调整相机视角
        camera.perspective(60, Engine3D.aspect, 1, 5000.0);
        
        // 设置相机控制器
        const controller = cameraObj.addComponent(HoverCameraController);
        controller.setCamera(0, -20, 15);
        
        // 添加相机节点
        scene3D.addChild(cameraObj);
        
        // 创建光源
        const light: Object3D = new Object3D();
        
        // 添加平行光组件
        const component: DirectLight = light.addComponent(DirectLight);
        
        // 调整光照
        light.rotationX = 45;
        light.rotationY = 30;
        component.lightColor = new Color(1.0, 1.0, 1.0, 1.0);
        component.intensity = 1;
        
        // 添加光源对象
        scene3D.addChild(light);
        
        // 加载GLTF模型 https路径正常读取
        // const model = await Engine3D.res.loadGltf('https://cdn.orillusion.com/PBR/DragonAttenuation/DragonAttenuation.gltf');
        // 本地路径public下读取提示失败：@orillusion_core.js?v=ac4a54d9:19264 Uncaught (in promise) TypeError: Cannot read properties of undefined (reading 'onError')
            // at @orillusion_core.js?v=ac4a54d9:19264:11
            // Promise.catch		
            // initEngine	@	ModelPreviewStandalone.tsx:85
            // await in initEngine		
            // (anonymous)	@	ModelPreviewStandalone.tsx:115
            // <ModelPreviewStandalone>		
            // (anonymous)	@	index.tsx:98
            
        const model = await Engine3D.res.loadGltf(modelUrl);
        scene3D.addChild(model);
        
        // 创建canvas元素
        const canvas = document.createElement('canvas');
        canvas.style.width = '100%';
        canvas.style.height = '100%';
        
        // 创建视图，设置目标场景和相机
        const view = new View3D();
        view.scene = scene3D;
        view.camera = camera;
        // @ts-ignore
        view.canvas = canvas;
        viewRef.current = view;
        
        // 将canvas添加到容器
        if (containerRef.current) {
          containerRef.current.innerHTML = '';
          containerRef.current.appendChild(canvas);
        }
        
        // 开始渲染
        Engine3D.startRenderView(view);
      } catch (error) {
        console.error('初始化引擎失败:', error);
        setError('初始化引擎失败');
      }
    };

    initEngine();

    // 清理函数
    return () => {
      if (viewRef.current) {
        // @ts-ignore
        Engine3D.stopRenderView(viewRef.current);
      }
      // @ts-ignore
      Engine3D.dispose();
    };
  }, [modelUrl]);

  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden' }}>
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
          <Spin size="large" tip="加载中..." />
        </div>
      ) : error ? (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: 'red' }}>
          {error}
        </div>
      ) : (
        <div 
          ref={containerRef} 
          style={{ width: '100%', height: '100%' }}
        />
      )}
    </div>
  );
};

export default ModelPreviewStandalone; 