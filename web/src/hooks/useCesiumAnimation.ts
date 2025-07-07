// hooks/useCesiumAnimation.ts
import { useState, useCallback, useRef, useEffect } from 'react';
import * as Cesium from 'cesium';
import { 
  GLBAnimationClip, 
  BoneNode, 
  AnimationPlayerState, 
  AnimationSettings,
  AnimationPlayState,
  AnimationPlayMode,
  AnimationTriggerType,
  AnimationEvent,
  AnimationManagerState
} from '../types/animation';
import { animationEventService } from '../services/animationEventService';

export const useCesiumAnimation = (
  viewerRef: React.RefObject<Cesium.Viewer | null>,
  selectedModelId: string | null
) => {
  // 辅助方法：扁平化节点树
  const flattenNodeTree = (node: BoneNode): BoneNode[] => {
    const flattened: BoneNode[] = [node];
    if (node.children) {
      node.children.forEach(child => {
        flattened.push(...flattenNodeTree(child));
      });
    }
    return flattened;
  };
  // 动画管理器状态
  const [animationState, setAnimationState] = useState<AnimationManagerState>({
    selectedModelId: null,
    animations: [],
    boneNodes: [],
    playerState: {
      currentTime: 0,
      totalDuration: 0,
      playState: AnimationPlayState.STOPPED,
      playMode: AnimationPlayMode.ONCE,
      playbackRate: 1.0,
      selectedClipId: null,
    },
    settings: {
      triggerType: AnimationTriggerType.AUTO,
      autoPlayClips: [],
      playSequentially: true,
      randomPlay: false,
      loopPlayback: false,
      iotBindings: [],
    },
    isLoading: false,
  });

  // Cesium动画相关引用
  const animationCollectionRef = useRef<any>(null);
  const activeAnimationsRef = useRef<Map<string, any>>(new Map());
  const requestAnimationRef = useRef<number | null>(null);

  // 启动动画循环（用于更新时间轴）
  const startAnimationLoop = useCallback(() => {
    if (requestAnimationRef.current) return;

    const updateLoop = () => {
      if (!viewerRef.current) return;

      const viewer = viewerRef.current;
      const clock = viewer.clock;

      if (clock.shouldAnimate) {
        const currentSeconds = Cesium.JulianDate.secondsDifference(clock.currentTime, clock.startTime);
        const totalSeconds = Cesium.JulianDate.secondsDifference(clock.stopTime, clock.startTime);
        
        // 检查动画是否播放完成
        const isCompleted = currentSeconds >= totalSeconds;
        
        if (isCompleted && clock.clockRange !== Cesium.ClockRange.LOOP_STOP) {
          // 动画播放完成且不是循环模式，停止动画
          clock.shouldAnimate = false;
          
          // 清理模型动画
          const primitives = viewer.scene.primitives;
          for (let i = 0; i < primitives.length; i++) {
            const primitive = primitives.get(i);
            if (primitive instanceof Cesium.Model && primitive.activeAnimations) {
              // 检查是否有活动动画需要清理
              if (primitive.activeAnimations.length > 0) {
                primitive.activeAnimations.removeAll();
              }
              break;
            }
          }
          
          // 清除活动动画引用
          activeAnimationsRef.current.clear();
          
          setAnimationState(prev => ({
            ...prev,
            playerState: {
              ...prev.playerState,
              currentTime: totalSeconds,
              playState: AnimationPlayState.STOPPED,
            },
          }));
          
          // 停止动画循环
          if (requestAnimationRef.current) {
            cancelAnimationFrame(requestAnimationRef.current);
            requestAnimationRef.current = null;
          }
          return;
        }
        
        setAnimationState(prev => ({
          ...prev,
          playerState: {
            ...prev.playerState,
            currentTime: Math.max(0, Math.min(currentSeconds, totalSeconds)),
          },
        }));

        requestAnimationRef.current = requestAnimationFrame(updateLoop);
      } else {
        // 时钟停止，停止动画循环
        if (requestAnimationRef.current) {
          cancelAnimationFrame(requestAnimationRef.current);
          requestAnimationRef.current = null;
        }
      }
    };

    requestAnimationRef.current = requestAnimationFrame(updateLoop);
  }, [viewerRef]);

  // 停止动画循环
  const stopAnimationLoop = useCallback(() => {
    if (requestAnimationRef.current) {
      cancelAnimationFrame(requestAnimationRef.current);
      requestAnimationRef.current = null;
    }
  }, []);

  // 获取选中模型的动画信息
  const loadModelAnimations = useCallback(async (modelId: string) => {
    console.log('🔍 loadModelAnimations 函数执行:', { 
      modelId, 
      hasViewer: !!viewerRef.current 
    });
    
    if (!viewerRef.current || !modelId) {
      console.log('❌ loadModelAnimations 条件不满足:', { 
        hasViewer: !!viewerRef.current, 
        hasModelId: !!modelId 
      });
      return;
    }

    console.log('⏳ 开始加载动画，设置 isLoading = true');
    setAnimationState(prev => ({ ...prev, isLoading: true }));

    try {
      const viewer = viewerRef.current;
      const primitives = viewer.scene.primitives;
      
      // 查找对应的模型
      let targetModel: Cesium.Model | null = null;
      console.log('🔍 开始查找目标模型:', { 
        modelId, 
        primitivesCount: primitives.length 
      });
      
      for (let i = 0; i < primitives.length; i++) {
        const primitive = primitives.get(i);
        
        if (primitive instanceof Cesium.Model) {
          const instanceId = (primitive as any).instanceId;
          const id = (primitive as any).id;
          
          console.log(`📦 检查模型 ${i}:`, {
            instanceId,
            id,
            targetModelId: modelId,
            instanceIdMatch: instanceId === modelId,
            idMatch: id === modelId
          });
          
          if (instanceId === modelId || id === modelId) {
            targetModel = primitive;
            console.log('✅ 找到目标模型:', { modelIndex: i, targetModel });
            break;
          }
        }
      }

      if (!targetModel) {
        console.log('❌ 未找到目标模型，设置空状态');
        setAnimationState(prev => ({
          ...prev,
          isLoading: false,
          animations: [],
          boneNodes: [],
        }));
        return;
      }

      // 等待模型加载完成
      if (!targetModel.ready) {
        await new Promise<void>((resolve) => {
          const checkReady = () => {
            if (targetModel!.ready) {
              resolve();
            } else {
              setTimeout(checkReady, 100);
            }
          };
          checkReady();
        });
      }

      // 获取动画信息
      const animations: GLBAnimationClip[] = [];
      
      // 检查模型的activeAnimations属性（这是Cesium提供的API）
      if (targetModel.activeAnimations) {
        // 从activeAnimations获取动画信息
        for (let i = 0; i < targetModel.activeAnimations.length; i++) {
          const animation = targetModel.activeAnimations.get(i);
          
          if (animation && animation.name) {
            const duration = animation.stopTime && animation.startTime ? 
              Cesium.JulianDate.secondsDifference(animation.stopTime, animation.startTime) : 
              1.0;
            
            animations.push({
              id: `animation_${i}`,
              name: animation.name || `Animation ${i}`,
              duration: duration,
              startTime: 0,
              endTime: duration
            });
          }
        }
      }

      // 如果activeAnimations为空，尝试通过addAll方法来发现动画
      if (animations.length === 0) {
        try {
          // 尝试添加所有可用的动画来发现它们
          const addedAnimations = targetModel.activeAnimations.addAll({
            loop: Cesium.ModelAnimationLoop.NONE,
          });
          
          // 从添加的动画中提取信息
          addedAnimations.forEach((animation, index) => {
            const duration = animation.stopTime && animation.startTime ? 
              Cesium.JulianDate.secondsDifference(animation.stopTime, animation.startTime) : 
              1.0;
            
            animations.push({
              id: `animation_${index}`,
              name: animation.name || `Animation ${index + 1}`,
              duration: duration,
              startTime: 0,
              endTime: duration,
            });
          });
          
          // 移除测试添加的动画
          targetModel.activeAnimations.removeAll();
          
        } catch (error) {
          // 静默处理错误
        }
      }

      // 获取节点信息
      const modelNodes: BoneNode[] = [];
      
      try {
        // 存储所有节点数据
        const allNodesData = new Map<number, any>();
        const nodeHierarchy = new Map<number, number[]>(); // nodeId -> childrenIds
        const nodeParent = new Map<number, number>(); // nodeId -> parentId
        
        // 首先，尝试从 _sceneGraph._runtimeNodes 获取节点数据
        if ((targetModel as any)._sceneGraph && (targetModel as any)._sceneGraph._runtimeNodes) {
          const runtimeNodes = (targetModel as any)._sceneGraph._runtimeNodes;
          
          runtimeNodes.forEach((node: any, index: number) => {
            if (node) {
              // 存储节点数据
              allNodesData.set(index, {
                runtimeNode: node,
                index: index,
                name: node.name || node.id || `runtimeNode_${index}`,
                transform: node.transform || node.matrix || node.computedTransform,
                // 尝试获取节点的children属性
                children: node.children || [],
                parent: node.parent
              });
            }
          });
        }
        
        // 然后，尝试从runtime nodes的children属性构建层次结构
        // 首先从runtime nodes获取层次结构信息
        allNodesData.forEach((nodeData, index) => {
          const runtimeNode = nodeData.runtimeNode;
          const children = runtimeNode.children || [];
          
          // 从runtime node的children构建层次结构
          if (children.length > 0) {
            // 注意：runtime node的children可能是对象数组而不是索引数组
            const childIndices: number[] = [];
            
            children.forEach((child: any, childIdx: number) => {
              // 尝试找到对应的runtime node索引
              let childIndex = -1;
              if (typeof child === 'number') {
                // 如果child直接是索引
                childIndex = child;
              } else if (child && typeof child === 'object') {
                // 如果child是对象，尝试通过比较找到对应的索引
                allNodesData.forEach((otherNodeData, otherIndex) => {
                  if (otherNodeData.runtimeNode === child) {
                    childIndex = otherIndex;
                  }
                });
              }
              
              if (childIndex >= 0 && childIndex < allNodesData.size) {
                childIndices.push(childIndex);
                nodeParent.set(childIndex, index);
              }
            });
            
            nodeHierarchy.set(index, childIndices);
          } else {
            nodeHierarchy.set(index, []);
          }
        });
        
        // 尝试从 glTF JSON 获取补充信息（如果可用）
        let gltfNodes: any[] = [];
        let gltfScenes: any[] = [];
        
        if ((targetModel as any)._loader && (targetModel as any)._loader._gltfJson) {
          const gltfJson = (targetModel as any)._loader._gltfJson;
          
          if (gltfJson.nodes) {
            gltfNodes = gltfJson.nodes;
          }
          
          if (gltfJson.scenes) {
            gltfScenes = gltfJson.scenes;
          }
        }
        
        // 构建最终的树状结构
        const buildNodeTree = (nodeIndex: number, depth: number = 0): BoneNode => {
          // 获取节点数据
          const runtimeData = allNodesData.get(nodeIndex);
          const gltfData = gltfNodes[nodeIndex];
          
          // 合并节点信息
          const nodeName = gltfData?.name || runtimeData?.name || `node_${nodeIndex}`;
          
          // 获取变换信息
          let translation: [number, number, number] | undefined;
          let rotation: [number, number, number, number] | undefined;
          let scale: [number, number, number] | undefined;
              
          // 尝试从runtime数据获取变换
          if (runtimeData?.transform) {
            const transform = runtimeData.transform;
            try {
              if (Array.isArray(transform) && transform.length >= 16) {
                // 4x4变换矩阵，提取位移部分（第4列的前3行）
                translation = [transform[12], transform[13], transform[14]];
                
                // 从变换矩阵提取旋转四元数和缩放
                try {
                  // 构建Cesium Matrix4 (列主序)
                  const matrix4 = new Cesium.Matrix4(
                    transform[0], transform[4], transform[8], transform[12],
                    transform[1], transform[5], transform[9], transform[13],
                    transform[2], transform[6], transform[10], transform[14],
                    transform[3], transform[7], transform[11], transform[15]
                  );
                  
                  // 使用Cesium API提取缩放
                  const scaleResult = new Cesium.Cartesian3();
                  if (Cesium.Matrix4.getScale) {
                    Cesium.Matrix4.getScale(matrix4, scaleResult);
                    scale = [scaleResult.x, scaleResult.y, scaleResult.z];
                  }
                  
                  // 使用Cesium API提取旋转矩阵，然后转换为四元数
                  const rotationMatrix = new Cesium.Matrix3();
                  if (Cesium.Matrix4.getRotation) {
                    Cesium.Matrix4.getRotation(matrix4, rotationMatrix);
                    
                    // 从旋转矩阵转换为四元数
                    if (Cesium.Quaternion.fromRotationMatrix) {
                      const quaternion = Cesium.Quaternion.fromRotationMatrix(rotationMatrix);
                      rotation = [quaternion.x, quaternion.y, quaternion.z, quaternion.w];
                    }
                  }
                } catch (cesiumError) {
                  // 静默处理错误
                }
              } else if (transform && typeof transform === 'object' && transform[12] !== undefined) {
                // 这是一个Matrix4对象，直接通过索引访问位移
                translation = [transform[12], transform[13], transform[14]];
                
                // 尝试从Matrix4对象中提取缩放和旋转
                try {
                  // 检查是否是Cesium Matrix4对象
                  if (transform.constructor && transform.constructor.name === 'Matrix4') {
                    // 使用Cesium API从Matrix4对象提取缩放
                    const scaleResult = new Cesium.Cartesian3();
                    if (Cesium.Matrix4.getScale) {
                      Cesium.Matrix4.getScale(transform, scaleResult);
                      scale = [scaleResult.x, scaleResult.y, scaleResult.z];
                    }
                    
                    // 使用Cesium API从Matrix4对象提取旋转
                    const rotationMatrix = new Cesium.Matrix3();
                    if (Cesium.Matrix4.getRotation) {
                      Cesium.Matrix4.getRotation(transform, rotationMatrix);
                      
                      if (Cesium.Quaternion.fromRotationMatrix) {
                        const quaternion = Cesium.Quaternion.fromRotationMatrix(rotationMatrix);
                        rotation = [quaternion.x, quaternion.y, quaternion.z, quaternion.w];
                      }
                    }
                  }
                } catch (matrix4Error) {
                  // 静默处理错误
                }
              }
            } catch (e) {
              // 静默处理错误
            }
          }
          
          // 尝试从runtime节点的直接属性获取变换
          if (runtimeData) {
            try {
              // 尝试获取直接的TRS属性
              if (runtimeData.translation && typeof runtimeData.translation === 'object') {
                if (runtimeData.translation.x !== undefined) {
                  translation = [runtimeData.translation.x, runtimeData.translation.y, runtimeData.translation.z];
                }
              }
              
              if (runtimeData.rotation && typeof runtimeData.rotation === 'object') {
                if (runtimeData.rotation.x !== undefined) {
                  rotation = [runtimeData.rotation.x, runtimeData.rotation.y, runtimeData.rotation.z, runtimeData.rotation.w];
                }
              }
              
              if (runtimeData.scale && typeof runtimeData.scale === 'object') {
                if (runtimeData.scale.x !== undefined) {
                  scale = [runtimeData.scale.x, runtimeData.scale.y, runtimeData.scale.z];
                }
              }
            } catch (e) {
              // 静默处理错误
            }
          }
          
          // 尝试从glTF数据获取变换
          if (!translation && gltfData?.translation) {
            if (Array.isArray(gltfData.translation) && gltfData.translation.length >= 3) {
              translation = [gltfData.translation[0], gltfData.translation[1], gltfData.translation[2]];
            }
          }
          
          if (!rotation && gltfData?.rotation && Array.isArray(gltfData.rotation) && gltfData.rotation.length >= 4) {
            rotation = [gltfData.rotation[0], gltfData.rotation[1], gltfData.rotation[2], gltfData.rotation[3]];
          }
          
          if (!scale && gltfData?.scale && Array.isArray(gltfData.scale) && gltfData.scale.length >= 3) {
            scale = [gltfData.scale[0], gltfData.scale[1], gltfData.scale[2]];
          }
          
          // 递归构建子节点
          const children: BoneNode[] = [];
          const childIndices = nodeHierarchy.get(nodeIndex) || [];
          
          childIndices.forEach((childIndex: number) => {
            const childNode = buildNodeTree(childIndex, depth + 1);
            children.push(childNode);
          });
          
          const boneNode: BoneNode = {
            id: `node_${nodeIndex}`,
            name: nodeName,
            translation: translation || [0, 0, 0],
            rotation: rotation || [0, 0, 0, 1],
            scale: scale || [1, 1, 1],
            children
          };
          
          return boneNode;
        };
        
        // 从根节点开始构建树状结构
        const rootNodes: BoneNode[] = [];
        
        // 获取根节点（没有父节点的节点或在场景中定义的根节点）
        let rootNodeIndices: number[] = [];
        
        // 优先使用场景中定义的根节点
        if (gltfScenes.length > 0) {
          const defaultSceneIndex = (targetModel as any)._loader?._gltfJson?.scene || 0;
          const defaultScene = gltfScenes[defaultSceneIndex];
          if (defaultScene && defaultScene.nodes) {
            rootNodeIndices = defaultScene.nodes;
          }
        }
        
        // 如果没有场景定义，查找没有父节点的节点作为根节点
        if (rootNodeIndices.length === 0) {
          // 从所有runtime nodes中查找根节点
          for (let i = 0; i < allNodesData.size; i++) {
            if (!nodeParent.has(i)) {
              rootNodeIndices.push(i);
            }
          }
        }
        
        // 构建每个根节点的树
        rootNodeIndices.forEach((rootIndex: number) => {
          const rootNode = buildNodeTree(rootIndex, 0);
          rootNodes.push(rootNode);
          // 直接使用树状结构的根节点，而不是扁平化
          modelNodes.push(rootNode);
        });
        
      } catch (error) {
        // 静默处理错误
      }

      // 更新状态
      console.log('📊 更新动画状态:', {
        modelId,
        animationsCount: animations.length,
        boneNodesCount: modelNodes.length
      });
      
      setAnimationState(prev => ({
        ...prev,
        isLoading: false,
        selectedModelId: modelId,
        animations,
        boneNodes: modelNodes,
        playerState: {
          ...prev.playerState,
          totalDuration: animations.length > 0 ? Math.max(...animations.map(a => a.duration)) : 0,
          selectedClipId: animations.length > 0 ? animations[0].id : null,
        },
      }));
      
      console.log('✅ 动画状态更新完成:', { 
        selectedModelId: modelId,
        animationsLoaded: animations.length,
        nodesLoaded: modelNodes.length
      });

    } catch (error) {
      console.error('❌ 加载模型动画失败:', error);
      console.error('❌ 错误详情:', {
        modelId,
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined
      });
      
      setAnimationState(prev => ({
        ...prev,
        isLoading: false,
        animations: [],
        boneNodes: [],
      }));
      
      console.log('🔄 错误状态更新完成');
    }
  }, [viewerRef]);

  // 播放动画
  const playAnimation = useCallback((clipId?: string, playMode?: AnimationPlayMode) => {
    if (!viewerRef.current || !animationState.selectedModelId) return;

    const targetClipId = clipId || animationState.playerState.selectedClipId;
    if (!targetClipId) return;

    const animation = animationState.animations.find(a => a.id === targetClipId);
    if (!animation) return;

    try {
      const viewer = viewerRef.current;
      const primitives = viewer.scene.primitives;
      
      // 查找对应的模型
      let targetModel: Cesium.Model | null = null;
      for (let i = 0; i < primitives.length; i++) {
        const primitive = primitives.get(i);
        if (primitive instanceof Cesium.Model && (primitive as any).instanceId === animationState.selectedModelId) {
          targetModel = primitive;
          break;
        }
      }

      if (!targetModel) return;

      // 获取动画索引
      const animationIndex = parseInt(targetClipId.replace('animation_', ''));
      
      // 停止所有现有动画
      if (targetModel.activeAnimations) {
        targetModel.activeAnimations.removeAll();
      }

      // 设置时钟参数
      const clock = viewer.clock;
      clock.startTime = Cesium.JulianDate.fromIso8601('2023-01-01T00:00:00Z');
      clock.stopTime = Cesium.JulianDate.addSeconds(clock.startTime, animation.duration, new Cesium.JulianDate());
      clock.currentTime = clock.startTime.clone();
      clock.multiplier = animationState.playerState.playbackRate;
      clock.shouldAnimate = true;

      // 设置循环模式
      if (playMode === AnimationPlayMode.LOOP) {
        clock.clockRange = Cesium.ClockRange.LOOP_STOP;
      } else {
        clock.clockRange = Cesium.ClockRange.UNBOUNDED;
      }

      // 启动GLB模型动画
      try {
        const animationOptions = {
          index: animationIndex,
          startTime: clock.startTime,
          delay: 0.0,
          stopTime: clock.stopTime,
          removeOnStop: false,
          loop: playMode === AnimationPlayMode.LOOP ? Cesium.ModelAnimationLoop.REPEAT : Cesium.ModelAnimationLoop.NONE,
          multiplier: animationState.playerState.playbackRate,
        };

        const modelAnimation = targetModel.activeAnimations.add(animationOptions);
        activeAnimationsRef.current.set(targetClipId, modelAnimation);
      } catch (addError) {
        // 如果按索引添加失败，尝试按名称添加
        try {
          const animationOptions = {
            name: animation.name,
            startTime: clock.startTime,
            delay: 0.0,
            stopTime: clock.stopTime,
            removeOnStop: false,
            loop: playMode === AnimationPlayMode.LOOP ? Cesium.ModelAnimationLoop.REPEAT : Cesium.ModelAnimationLoop.NONE,
            multiplier: animationState.playerState.playbackRate,
          };

          const modelAnimation = targetModel.activeAnimations.add(animationOptions);
          activeAnimationsRef.current.set(targetClipId, modelAnimation);
        } catch (nameError) {
          // 静默处理错误
        }
      }

      // 更新播放状态
      setAnimationState(prev => ({
        ...prev,
        playerState: {
          ...prev.playerState,
          playState: AnimationPlayState.PLAYING,
          selectedClipId: targetClipId,
          playMode: playMode || prev.playerState.playMode,
        },
      }));

      // 启动动画循环
      startAnimationLoop();

    } catch (error) {
      console.error('播放动画失败:', error);
    }
  }, [viewerRef, animationState, startAnimationLoop]);

  // 暂停动画
  const pauseAnimation = useCallback(() => {
    if (!viewerRef.current || !animationState.selectedModelId) return;

    const viewer = viewerRef.current;
    viewer.clock.shouldAnimate = false;

    // 暂停模型动画
    const primitives = viewer.scene.primitives;
    for (let i = 0; i < primitives.length; i++) {
      const primitive = primitives.get(i);
      if (primitive instanceof Cesium.Model && (primitive as any).instanceId === animationState.selectedModelId) {
        if (primitive.activeAnimations) {
          // 暂停所有活动动画
          for (let j = 0; j < primitive.activeAnimations.length; j++) {
            const animation = primitive.activeAnimations.get(j);
            if (animation) {
              // Cesium没有直接的暂停方法，我们通过移除并重新添加动画来实现暂停
              // 由于multiplier是只读的，我们需要使用其他方法
            }
          }
        }
        break;
      }
    }

    setAnimationState(prev => ({
      ...prev,
      playerState: {
        ...prev.playerState,
        playState: AnimationPlayState.PAUSED,
      },
    }));

    stopAnimationLoop();
  }, [viewerRef, animationState.selectedModelId, stopAnimationLoop]);

  // 停止动画
  const stopAnimation = useCallback(() => {
    if (!viewerRef.current || !animationState.selectedModelId) return;

    const viewer = viewerRef.current;
    viewer.clock.shouldAnimate = false;
    viewer.clock.currentTime = viewer.clock.startTime.clone();

    // 停止模型动画
    const primitives = viewer.scene.primitives;
    for (let i = 0; i < primitives.length; i++) {
      const primitive = primitives.get(i);
      if (primitive instanceof Cesium.Model && (primitive as any).instanceId === animationState.selectedModelId) {
        if (primitive.activeAnimations) {
          primitive.activeAnimations.removeAll();
        }
        break;
      }
    }

    // 清除活动动画引用
    activeAnimationsRef.current.clear();

    setAnimationState(prev => ({
      ...prev,
      playerState: {
        ...prev.playerState,
        playState: AnimationPlayState.STOPPED,
        currentTime: 0,
      },
    }));

    stopAnimationLoop();
  }, [viewerRef, animationState.selectedModelId, stopAnimationLoop]);

  // 跳转到指定时间
  const seekToTime = useCallback((time: number) => {
    if (!viewerRef.current) return;

    const viewer = viewerRef.current;
    const newTime = Cesium.JulianDate.addSeconds(viewer.clock.startTime, time, new Cesium.JulianDate());
    viewer.clock.currentTime = newTime;

    setAnimationState(prev => ({
      ...prev,
      playerState: {
        ...prev.playerState,
        currentTime: time,
      },
    }));
  }, [viewerRef]);

  // 设置播放速度
  const setPlaybackRate = useCallback((rate: number) => {
    if (!viewerRef.current) return;

    const viewer = viewerRef.current;
    viewer.clock.multiplier = rate;

    setAnimationState(prev => ({
      ...prev,
      playerState: {
        ...prev.playerState,
        playbackRate: rate,
      },
    }));
  }, [viewerRef]);

  // 处理动画事件
  const handleAnimationEvent = useCallback((event: AnimationEvent) => {
    if (event.modelId !== animationState.selectedModelId) return;

    switch (event.type) {
      case 'play':
        playAnimation(event.clipId, event.playMode);
        break;
      case 'pause':
        pauseAnimation();
        break;
      case 'stop':
        stopAnimation();
        break;
      case 'seek':
        if (event.time !== undefined) {
          seekToTime(event.time);
        }
        break;
      case 'node_transform':
        // TODO: 实现节点变换
        break;
    }
  }, [animationState.selectedModelId, playAnimation, pauseAnimation, stopAnimation, seekToTime]);

  // 更新动画设置
  const updateAnimationSettings = useCallback((settings: Partial<AnimationSettings>) => {
    setAnimationState(prev => ({
      ...prev,
      settings: {
        ...prev.settings,
        ...settings,
      },
    }));
  }, []);

  // 更新节点变换
  const updateNodeTransform = useCallback((nodeId: string, transform: {
    translation?: [number, number, number];
    rotation?: [number, number, number, number];
    scale?: [number, number, number];
  }, targetModelId?: string) => {
    // 🆕 支持传入具体的模型ID，如果没有传入则使用全局选中的模型ID
    const modelId = targetModelId || animationState.selectedModelId;
    
    console.log('🎯 updateNodeTransform 开始执行:', { 
      nodeId, 
      transform, 
      hasViewer: !!viewerRef.current, 
      targetModelId: targetModelId,
      globalSelectedModelId: animationState.selectedModelId,
      finalModelId: modelId
    });
    
    if (!viewerRef.current || !modelId) {
      console.log('❌ 缺少必要条件:', { 
        hasViewer: !!viewerRef.current, 
        targetModelId: targetModelId,
        globalSelectedModelId: animationState.selectedModelId,
        finalModelId: modelId
      });
      return;
    }

    try {
      const viewer = viewerRef.current;
      const primitives = viewer.scene.primitives;
      
      // 查找对应的模型
      let targetModel: Cesium.Model | null = null;
      console.log('🔍 开始查找模型，总图元数量:', primitives.length);
      
      for (let i = 0; i < primitives.length; i++) {
        const primitive = primitives.get(i);
        if (primitive instanceof Cesium.Model) {
          console.log(`📦 检查模型 ${i}:`, {
            instanceId: (primitive as any).instanceId,
            id: (primitive as any).id,
            targetModelId: modelId,
            instanceIdMatch: (primitive as any).instanceId === modelId,
            idMatch: (primitive as any).id === modelId
          });
          
          if ((primitive as any).instanceId === modelId || (primitive as any).id === modelId) {
            targetModel = primitive;
            console.log('✅ 找到目标模型:', targetModel);
            break;
          }
        }
      }

      if (!targetModel) {
        console.log('❌ 未找到目标模型，modelId:', modelId);
        return;
      }

      // 尝试获取节点
      const nodeIndex = parseInt(nodeId.replace('node_', ''));
      console.log('🔍 解析节点ID:', { nodeId, nodeIndex });
      
      // 尝试从runtime nodes获取节点
      let runtimeNode: any = null;
      if ((targetModel as any)._sceneGraph && (targetModel as any)._sceneGraph._runtimeNodes) {
        const runtimeNodes = (targetModel as any)._sceneGraph._runtimeNodes;
        console.log('📋 Runtime节点信息:', {
          hasSceneGraph: !!(targetModel as any)._sceneGraph,
          hasRuntimeNodes: !!runtimeNodes,
          runtimeNodesLength: runtimeNodes ? runtimeNodes.length : 0,
          nodeIndex: nodeIndex,
          isValidIndex: nodeIndex >= 0 && nodeIndex < (runtimeNodes ? runtimeNodes.length : 0)
        });
        
        if (nodeIndex >= 0 && nodeIndex < runtimeNodes.length) {
          runtimeNode = runtimeNodes[nodeIndex];
          console.log('✅ 找到runtime节点:', runtimeNode ? '存在' : '为null', {
            nodeName: runtimeNode?.name,
            hasTransform: !!runtimeNode?.transform,
            hasChildren: !!(runtimeNode?.children && runtimeNode.children.length > 0)
          });
        } else {
          console.log('❌ 节点索引无效:', { nodeIndex, runtimeNodesLength: runtimeNodes.length });
        }
      } else {
        console.log('❌ 无法访问sceneGraph或runtimeNodes:', {
          hasSceneGraph: !!(targetModel as any)._sceneGraph,
          hasRuntimeNodes: !!(targetModel as any)._sceneGraph?._runtimeNodes
        });
      }

      if (!runtimeNode) {
        console.log('❌ 未找到runtime节点，退出');
        return;
      }

      // 创建新的变换矩阵
      try {
        // 直接使用导入的Cesium对象
        if (Cesium.Matrix4 && Cesium.TranslationRotationScale) {
          // 创建TRS对象，先设置默认值
          const trs = new Cesium.TranslationRotationScale(
            new Cesium.Cartesian3(0, 0, 0),        // 默认位移
            new Cesium.Quaternion(0, 0, 0, 1),     // 默认旋转（无旋转）
            new Cesium.Cartesian3(1, 1, 1)         // 默认缩放（不缩放）
          );
          
          // 如果runtime节点有现有变换，先解析它
          if (runtimeNode.transform) {
            try {
              let existingMatrix: any = null;
              if (Array.isArray(runtimeNode.transform) && runtimeNode.transform.length >= 16) {
                // 从数组创建Matrix4
                existingMatrix = Cesium.Matrix4.fromArray(runtimeNode.transform);
              } else if (runtimeNode.transform.clone) {
                // 已经是Matrix4对象
                existingMatrix = runtimeNode.transform.clone();
              }
              
              if (existingMatrix) {
                // 使用正确的Cesium API解析现有变换
                try {
                  // 提取平移
                  const translationResult = new Cesium.Cartesian3();
                  Cesium.Matrix4.getTranslation(existingMatrix, translationResult);
                  trs.translation = translationResult;
                  
                  // 提取缩放
                  const scaleResult = new Cesium.Cartesian3();
                  Cesium.Matrix4.getScale(existingMatrix, scaleResult);
                  trs.scale = scaleResult;
                  
                  // 提取旋转
                  const rotationMatrix = new Cesium.Matrix3();
                  Cesium.Matrix4.getRotation(existingMatrix, rotationMatrix);
                  const quaternion = Cesium.Quaternion.fromRotationMatrix(rotationMatrix);
                  trs.rotation = quaternion;
                  
                } catch (extractError) {
                  // 使用默认值
                  trs.translation = new Cesium.Cartesian3(0, 0, 0);
                  trs.rotation = new Cesium.Quaternion(0, 0, 0, 1);
                  trs.scale = new Cesium.Cartesian3(1, 1, 1);
                }
              }
            } catch (decomposeError) {
              // 使用默认值
              trs.translation = new Cesium.Cartesian3(0, 0, 0);
              trs.rotation = new Cesium.Quaternion(0, 0, 0, 1);
              trs.scale = new Cesium.Cartesian3(1, 1, 1);
            }
          } else {
            // 没有现有变换，使用默认值
            trs.translation = new Cesium.Cartesian3(0, 0, 0);
            trs.rotation = new Cesium.Quaternion(0, 0, 0, 1);
            trs.scale = new Cesium.Cartesian3(1, 1, 1);
          }
          
          // 应用新的变换值（只覆盖指定的部分，保留其他部分）
          if (transform.translation) {
            const translationVector = new Cesium.Cartesian3(
              transform.translation[0],
              transform.translation[1],
              transform.translation[2]
            );
            
            console.log('📍 应用位移变换:', {
              original: [trs.translation.x, trs.translation.y, trs.translation.z],
              new: transform.translation,
              vector: translationVector
            });
            
            trs.translation = translationVector;
          }
          
          if (transform.rotation) {
            const rotationQuaternion = new Cesium.Quaternion(
              transform.rotation[0],
              transform.rotation[1],
              transform.rotation[2],
              transform.rotation[3]
            );
            
            trs.rotation = rotationQuaternion;
          }
          
          if (transform.scale) {
            const scaleVector = new Cesium.Cartesian3(
              transform.scale[0],
              transform.scale[1],
              transform.scale[2]
            );
            
            trs.scale = scaleVector;
          }
          
          // 从TRS创建变换矩阵
          const transformMatrix = Cesium.Matrix4.fromTranslationRotationScale(trs);
          
          // 更新runtime节点的变换
          if (runtimeNode.transform) {
            // 如果是数组形式，更新数组
            if (Array.isArray(runtimeNode.transform)) {
              const matrixArray = new Array(16);
              Cesium.Matrix4.pack(transformMatrix, matrixArray, 0);
              for (let i = 0; i < 16; i++) {
                runtimeNode.transform[i] = matrixArray[i];
              }
            } else {
              // 如果是Matrix4对象，直接赋值
              Cesium.Matrix4.clone(transformMatrix, runtimeNode.transform);
            }
          } else {
            // 创建新的变换矩阵
            runtimeNode.transform = Cesium.Matrix4.clone(transformMatrix);
          }
          
          // 精确更新特定节点 - 高效的渲染更新
          
          // 方法1: 标记特定runtime节点需要更新
          runtimeNode._dirty = true;
          if (runtimeNode.computedTransform) {
            runtimeNode._transformDirty = true;
            runtimeNode._computedTransformDirty = true;
            
            // 尝试直接重新计算computed transform
            try {
              if (runtimeNode.transform && Cesium.Matrix4.multiply) {
                // 如果有父节点的computed transform，需要结合
                const parentTransform = runtimeNode.parent && runtimeNode.parent.computedTransform 
                  ? runtimeNode.parent.computedTransform 
                  : Cesium.Matrix4.IDENTITY;
                
                // 计算新的computed transform = parent * local
                const newComputedTransform = new Cesium.Matrix4();
                Cesium.Matrix4.multiply(parentTransform, runtimeNode.transform, newComputedTransform);
                
                // 更新computed transform
                if (runtimeNode.computedTransform.clone) {
                  Cesium.Matrix4.clone(newComputedTransform, runtimeNode.computedTransform);
                } else {
                  runtimeNode.computedTransform = newComputedTransform;
                }
              }
            } catch (computeError) {
              // 静默处理错误
            }
          }
          
          // 方法2: 如果节点有子节点，也标记它们需要更新（因为父节点变换会影响子节点）
          const markChildrenDirty = (node: any) => {
            if (node.children && Array.isArray(node.children)) {
              node.children.forEach((childRef: any) => {
                let childNode = null;
                
                // children数组可能包含索引数字或者直接的节点对象
                if (typeof childRef === 'number') {
                  // 如果是索引，从runtimeNodes中获取对应节点
                  if ((targetModel as any)._sceneGraph && (targetModel as any)._sceneGraph._runtimeNodes) {
                    const runtimeNodes = (targetModel as any)._sceneGraph._runtimeNodes;
                    if (childRef >= 0 && childRef < runtimeNodes.length) {
                      childNode = runtimeNodes[childRef];
                    }
                  }
                } else if (childRef && typeof childRef === 'object') {
                  // 如果直接是节点对象
                  childNode = childRef;
                }
                
                if (childNode) {
                  childNode._dirty = true;
                  childNode._transformDirty = true;
                  if (childNode.computedTransform) {
                    childNode._computedTransformDirty = true;
                  }
                  markChildrenDirty(childNode); // 递归标记
                }
              });
            }
          };
          markChildrenDirty(runtimeNode);
          
          // 方法3: 只请求一次渲染更新
          viewer.scene.requestRender();
          
          console.log('🎉 节点变换应用成功，已请求渲染更新:', {
            nodeId,
            nodeIndex,
            transformApplied: transform,
            runtimeNodeUpdated: true
          });
          
          // 方法4: 尝试直接更新WebGL渲染状态（如果可能）
          try {
            if ((targetModel as any)._sceneGraph && (targetModel as any)._sceneGraph._runtime) {
              const runtime = (targetModel as any)._sceneGraph._runtime;
              if (runtime.uniformMaps) {
                // 标记uniform maps需要更新
                runtime._uniformMapsDirty = true;
              }
            }
          } catch (uniformError) {
            // 静默处理错误
          }
          
          // 更新状态中的节点数据
          const updateNodeInTree = (nodes: BoneNode[]): BoneNode[] => {
            return nodes.map(node => {
              if (node.id === nodeId) {
                return {
                  ...node,
                  translation: transform.translation || node.translation,
                  rotation: transform.rotation || node.rotation,
                  scale: transform.scale || node.scale,
                };
              }
              if (node.children) {
                return {
                  ...node,
                  children: updateNodeInTree(node.children),
                };
              }
              return node;
            });
          };
          
          setAnimationState(prev => ({
            ...prev,
            boneNodes: updateNodeInTree(prev.boneNodes),
          }));
          
        }
      } catch (matrixError) {
        // 静默处理错误
      }
      
    } catch (error) {
      console.error('更新节点变换失败:', error);
      throw error;
    }
  }, [viewerRef, animationState]);

  // 当选中模型改变时，加载动画
  useEffect(() => {
    console.log('🔄 useCesiumAnimation useEffect 触发:', { 
      selectedModelId, 
      hasSelectedModelId: !!selectedModelId 
    });
    
    if (selectedModelId) {
      console.log('🚀 开始加载模型动画:', selectedModelId);
      loadModelAnimations(selectedModelId);
    } else {
      console.log('⚠️ selectedModelId 为空，不加载动画');
    }
  }, [selectedModelId, loadModelAnimations]);

  // 设置动画事件监听器
  useEffect(() => {
    if (selectedModelId) {
      // 添加事件监听器
      animationEventService.addEventListener(selectedModelId, handleAnimationEvent);
      
      return () => {
        // 清理事件监听器
        animationEventService.removeEventListener(selectedModelId, handleAnimationEvent);
      };
    }
  }, [selectedModelId, handleAnimationEvent]);

  // 清理函数
  useEffect(() => {
    return () => {
      stopAnimationLoop();
    };
  }, [stopAnimationLoop]);

  return {
    animationState,
    playAnimation,
    pauseAnimation,
    stopAnimation,
    seekToTime,
    setPlaybackRate,
    handleAnimationEvent,
    updateAnimationSettings,
    loadModelAnimations,
    updateNodeTransform, // 新增：节点变换更新函数
    // 事件发送器
    sendAnimationEvent: (event: AnimationEvent) => animationEventService.sendEvent(event),
    // 事件创建器
    createPlayEvent: (clipId?: string, playMode?: string, playbackRate?: number) => 
      animationEventService.createPlayEvent(selectedModelId || '', clipId, playMode, playbackRate),
    createPauseEvent: () => animationEventService.createPauseEvent(selectedModelId || ''),
    createStopEvent: () => animationEventService.createStopEvent(selectedModelId || ''),
    createSeekEvent: (time: number) => animationEventService.createSeekEvent(selectedModelId || '', time),
    createNodeTransformEvent: (nodeId: string, transform: any, interpolation?: any) =>
      animationEventService.createNodeTransformEvent(selectedModelId || '', nodeId, transform, interpolation),
  };
};