import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Spin, App } from 'antd';
import { 
  Engine, 
  Scene, 
  FreeCamera, 
  Vector3, 
  HemisphericLight, 
  MeshBuilder, 
  StandardMaterial, 
  Color3,
  SceneLoader,
  PointerEventTypes
} from '@babylonjs/core';
import '@babylonjs/loaders/glTF';
import modelAPI from '../../services/modelApi';

const ModelPreviewStandalone = () => {
  const { modelId } = useParams<{ modelId: string }>();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modelUrl, setModelUrl] = useState<string | null>(null);
  const engineRef = useRef<Engine | null>(null);
  const sceneRef = useRef<Scene | null>(null);
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
        <canvas 
          ref={canvasRef} 
          style={{ width: '100%', height: '100%' }}
        />
      )}
    </div>
  );
};

export default ModelPreviewStandalone; 