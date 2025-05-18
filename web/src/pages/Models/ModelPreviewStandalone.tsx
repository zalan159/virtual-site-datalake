import { useEffect, useRef, useState } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import { Spin, App } from 'antd';
import { 
  Engine, 
  Scene, 
  FreeCamera, 
  Vector3, 
  HemisphericLight, 
  SceneLoader,
  Tools
} from '@babylonjs/core';
import '@babylonjs/loaders/glTF';
import modelAPI from '../../services/modelApi';
import * as publicModelsAPI from '../../services/publicModels';

const ModelPreviewStandalone = () => {
  const { modelId } = useParams<{ modelId: string }>();
  const location = useLocation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modelUrl, setModelUrl] = useState<string | null>(null);
  const engineRef = useRef<Engine | null>(null);
  const sceneRef = useRef<Scene | null>(null);
  const { message: appMessage } = App.useApp();

  // 解析URL参数
  const searchParams = new URLSearchParams(location.search);
  const hasPreviewImage = searchParams.get('hasPreviewImage') === 'true';
  const isPublicModel = searchParams.get('isPublicModel') === 'true';

  useEffect(() => {
    const fetchModelUrl = async () => {
      if (!modelId) return;
      
      try {
        setLoading(true);
        
        let response;
        if (isPublicModel) {
          // 获取公共模型下载链接
          response = await publicModelsAPI.downloadPublicModel(modelId);
          if (response && response.download_url) {
            setModelUrl(response.download_url);
          } else {
            setError('无法获取公共模型URL');
          }
        } else {
          // 获取用户模型下载链接
          response = await modelAPI.getConvertedModelDownloadUrl(modelId);
          if (response.data && response.data.download_url) {
            setModelUrl(response.data.download_url);
          } else {
            setError('无法获取模型URL');
          }
        }
      } catch (error: any) {
        console.error('获取模型URL失败:', error);
        setError(`获取模型URL失败: ${error.response?.data?.detail || error.message || '未知错误'}`);
      } finally {
        setLoading(false);
      }
    };

    fetchModelUrl();
  }, [modelId, isPublicModel]);

  // 生成预览图并上传到服务器
  const generateAndUpdatePreviewImage = (engine: Engine, scene: Scene) => {
    if (!modelId) return;
    
    // 确保场景完全渲染
    scene.executeWhenReady(() => {
      // 延迟一帧以确保所有内容都已渲染
      setTimeout(() => {
        try {
          // 创建截图
          Tools.CreateScreenshot(engine, scene.activeCamera!, 
            { width: 300, height: 300 }, 
            (data) => {
              // data是base64格式的图像
              console.log('预览图生成成功');
              
              // 根据模型类型上传预览图到服务器
              if (isPublicModel) {
                // 上传公共模型预览图
                publicModelsAPI.updatePublicModelPreview(modelId, data)
                  .then(() => {
                    console.log('公共模型预览图上传成功');
                    appMessage.success('预览图已更新');
                  })
                  .catch((error) => {
                    console.error('公共模型预览图上传失败:', error);
                    appMessage.error('预览图上传失败');
                  });
              } else {
                // 上传用户模型预览图
                modelAPI.updatePreviewImage(modelId, data)
                  .then(() => {
                    console.log('预览图上传成功');
                    appMessage.success('预览图已更新');
                  })
                  .catch((error) => {
                    console.error('预览图上传失败:', error);
                    appMessage.error('预览图上传失败');
                  });
              }
            });
        } catch (error) {
          console.error('生成预览图失败:', error);
          appMessage.error('生成预览图失败');
        }
      }, 500); // 延迟500毫秒以确保渲染完成
    });
  };

  useEffect(() => {
    if (!modelUrl || !canvasRef.current) return;

    const initEngine = async () => {
      try {
        // 初始化引擎
        const canvas = canvasRef.current;
        const engine = new Engine(canvas, true);
        engineRef.current = engine;

        // 创建场景
        const scene = new Scene(engine);
        sceneRef.current = scene;

        // 创建相机
        const camera = new FreeCamera(
          "camera",
          new Vector3(0, 5, -10),
          scene
        );
        camera.setTarget(Vector3.Zero());
        camera.attachControl(canvas, true);

        // 创建光源
        const light = new HemisphericLight(
          "light",
          new Vector3(0, 1, 0),
          scene
        );
        light.intensity = 0.7;

        // 加载模型
        try {
          await SceneLoader.ImportMeshAsync("", "", modelUrl, scene, undefined, ".glb");
          // 自动调整相机视角以适应模型
          scene.createDefaultCameraOrLight(true, true, true);
          
          // 如果模型没有预览图，则生成并上传
          if (!hasPreviewImage) {
            generateAndUpdatePreviewImage(engine, scene);
          }
        } catch (error) {
          console.error('加载模型失败:', error);
          setError('加载模型失败');
        }

        // 开始渲染循环
        engine.runRenderLoop(() => {
          scene.render();
        });

        // 处理窗口大小变化
        window.addEventListener('resize', () => {
          engine.resize();
        });

      } catch (error) {
        console.error('初始化引擎失败:', error);
        setError('初始化引擎失败');
      }
    };

    initEngine();

    // 清理函数
    return () => {
      if (engineRef.current) {
        engineRef.current.dispose();
      }
      if (sceneRef.current) {
        sceneRef.current.dispose();
      }
    };
  }, [modelUrl, hasPreviewImage, modelId, isPublicModel]);

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
        <canvas 
          ref={canvasRef} 
          style={{ width: '100%', height: '100%' }}
        />
      )}
    </div>
  );
};

export default ModelPreviewStandalone; 