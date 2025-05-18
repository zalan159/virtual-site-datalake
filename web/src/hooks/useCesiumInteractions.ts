// hooks/useCesiumInteractions.ts
import { useEffect, useRef, useCallback, useState } from 'react';
import { Viewer, ScreenSpaceEventHandler, ScreenSpaceEventType, Color, Model } from 'cesium';
import * as Cesium from 'cesium';
// @ts-ignore
import CesiumGizmo from '../../cesium-gizmo/src/CesiumGizmo.js'; // 假设路径正确
import { updateInstanceProperties, getInstanceProperties } from '../services/sceneApi';

export interface SelectedModelInfo {
  id: string;
  name: string;
  primitive: Model; // 存储原始模型对象
}

export const useCesiumInteractions = (
  viewerRef: React.RefObject<Viewer | null>,
  onModelSelect: (modelInfo: SelectedModelInfo | null) => void,
  gizmoRef: React.MutableRefObject<any | null>, // 使用 any 因为 CesiumGizmo 类型可能未导出
  onInstanceTreeSelect?: (instanceId: string | null) => void, // 新增参数
  sceneOrigin?: { longitude: number, latitude: number, height: number } // 添加场景原点参数
) => {
  const lastHighlightedRef = useRef<any>(null);
  const lastColorRef = useRef<Color | undefined>(undefined);
  const highlightMaterialRef = useRef<any>(null);
  // 添加当前Gizmo模式的状态引用
  const currentGizmoModeRef = useRef<string>(CesiumGizmo.Mode.TRANSLATE);

  // 添加计算局部坐标的方法
  const calculateLocalPosition = useCallback((position: Cesium.Cartesian3) => {
    if (!sceneOrigin) {
      console.warn('计算局部坐标失败: 未提供场景原点');
      // 如果没有原点，返回全局坐标作为数组
      return [position.x, position.y, position.z];
    }

    // 创建原点的笛卡尔坐标
    const originCartesian = Cesium.Cartesian3.fromDegrees(
      sceneOrigin.longitude,
      sceneOrigin.latitude,
      sceneOrigin.height
    );

    // 创建从原点到当前点的东北上(ENU)坐标系
    const enuTransform = Cesium.Transforms.eastNorthUpToFixedFrame(originCartesian);
    
    // 创建逆变换矩阵，用于将全局坐标转换为局部坐标
    const inverseEnuTransform = new Cesium.Matrix4();
    Cesium.Matrix4.inverse(enuTransform, inverseEnuTransform);
    
    // 将全局向量转换为局部坐标系中的向量
    const localCoordinates = new Cesium.Cartesian3();
    Cesium.Matrix4.multiplyByPoint(inverseEnuTransform, position, localCoordinates);
    
    // 返回局部XYZ坐标作为数组（与useCesiumDragAndDrop保持一致）
    return [localCoordinates.x, localCoordinates.y, localCoordinates.z];
  }, [sceneOrigin]);

  // 创建一个通用的更新transform的函数
  const updateModelTransform = useCallback(async (instanceId: string, lastTransformResult: any) => {
    if (!lastTransformResult) return;
    
    try {
      console.log('================调试信息开始================');
      console.log('Gizmo操作模式:', lastTransformResult.mode);
      console.log('lastTransformResult完整数据:', lastTransformResult);
      
      // 获取当前实例的属性，以便只更新变化的部分
      let instanceProperties;
      try {
        const response = await getInstanceProperties(instanceId);
        instanceProperties = response || null;
        console.log('获取到当前实例API响应:', instanceProperties);
      } catch (err) {
        console.error('获取实例属性失败:', err);
        instanceProperties = null;
      }
      
      // 探测实例属性中的transform路径
      let currentTransform = null;
      
      // 打印关键路径以检查数据结构
      console.log('检查数据路径:');
      console.log('- data.data.instance.transform:', instanceProperties?.data?.data?.instance?.transform);
      console.log('- data.instance.transform:', instanceProperties?.data?.instance?.transform);
      console.log('- data.data.transform:', instanceProperties?.data?.data?.transform);
      console.log('- data.transform:', instanceProperties?.data?.transform);
      
      // 尝试多个可能的路径
      if (instanceProperties?.data?.data?.instance?.transform) {
        currentTransform = instanceProperties.data.data.instance.transform;
        console.log('找到transform路径: data.data.instance.transform');
      } else if (instanceProperties?.data?.instance?.transform) {
        currentTransform = instanceProperties.data.instance.transform;
        console.log('找到transform路径: data.instance.transform');
      } else if (instanceProperties?.data?.data?.transform) {
        currentTransform = instanceProperties.data.data.transform;
        console.log('找到transform路径: data.data.transform');
      } else if (instanceProperties?.data?.transform) {
        currentTransform = instanceProperties.data.transform;
        console.log('找到transform路径: data.transform');
      }
      
      console.log('最终找到的transform:', currentTransform);
      
      // 初始化要更新的transform对象，确保保留原始位置信息
      let updatedTransform = {
        location: currentTransform?.location || [0, 0, 0],
        rotation: currentTransform?.rotation || [0, 0, 0],
        scale: currentTransform?.scale || [1, 1, 1]
      };
      
      console.log('初始化的transform:', updatedTransform);
      
      const result = lastTransformResult.result;
      console.log('原始结果数据(result):', result);
      
      // 根据操作模式处理不同的结果数据
      if (lastTransformResult.mode === CesiumGizmo.Mode.TRANSLATE) {
        console.log('处理平移模式');
        // 平移模式 - 仅更新位置
        const position = new Cesium.Cartesian3(result.x || 0, result.y || 0, result.z || 0);
        console.log('平移-原始位置:', position);
        
        const localPosition = calculateLocalPosition(position);
        console.log('平移-局部位置:', localPosition);
        
        // 仅更新位置
        updatedTransform.location = localPosition;
      } 
      else if (lastTransformResult.mode === CesiumGizmo.Mode.ROTATE) {
        console.log('处理旋转模式');
        
        // 保存当前位置信息，确保不会被覆盖
        const originalLocation = [...updatedTransform.location];
        console.log('旋转前的原始位置:', originalLocation);
        
        let rotationDegrees = [0, 0, 0];
        
        // 检查result是否为HeadingPitchRoll对象
        if (result.heading !== undefined && result.pitch !== undefined && result.roll !== undefined) {
          console.log('检测到HeadingPitchRoll对象，使用heading/pitch/roll值');
          
          try {
            // 从HeadingPitchRoll获取旋转角度(弧度)
            const headingRad = result.heading || 0;
            const pitchRad = result.pitch || 0;
            const rollRad = result.roll || 0;
            
            // 转换为角度并应用顺序
            // 注意：在Cesium中，rotation通常是[heading, pitch, roll]或[yaw, pitch, roll]的顺序
            // HeadingPitchRoll通常对应于偏航(yaw)、俯仰(pitch)和滚转(roll)
            // 转换为度数以便存储和理解
            const headingDeg = Cesium.Math.toDegrees(headingRad);
            const pitchDeg = Cesium.Math.toDegrees(pitchRad);
            const rollDeg = Cesium.Math.toDegrees(rollRad);
            
            console.log('旋转-角度值(HPR弧度):', { headingRad, pitchRad, rollRad });
            console.log('旋转-角度值(HPR角度):', { headingDeg, pitchDeg, rollDeg });
            
            // 存储为[heading, pitch, roll]顺序的角度值
            rotationDegrees = [headingDeg, pitchDeg, rollDeg];
          } catch (e) {
            console.error('HPR角度转换错误:', e);
            // 保留原有旋转值
            rotationDegrees = [...updatedTransform.rotation];
          }
        } else {
          console.log('未检测到HeadingPitchRoll对象，尝试使用x/y/z值');
          
          try {
            // 尝试从x, y, z中获取旋转值
            const xRad = result.x || 0;
            const yRad = result.y || 0;
            const zRad = result.z || 0;
            
            // 转换为角度
            const xDeg = Cesium.Math.toDegrees(xRad);
            const yDeg = Cesium.Math.toDegrees(yRad);
            const zDeg = Cesium.Math.toDegrees(zRad);
            
            console.log('旋转-角度值(XYZ弧度):', { xRad, yRad, zRad });
            console.log('旋转-角度值(XYZ角度):', { xDeg, yDeg, zDeg });
            
            // 存储为[x, y, z]角度值
            rotationDegrees = [xDeg, yDeg, zDeg];
          } catch (e) {
            console.error('XYZ角度转换错误:', e);
            // 保留原有旋转值
            rotationDegrees = [...updatedTransform.rotation];
          }
        }
        
        // 创建更新后的transform对象，只更新旋转值，保留位置和缩放
        updatedTransform = {
          location: originalLocation,
          rotation: rotationDegrees,
          scale: updatedTransform.scale
        };
        
        console.log('旋转后的最终值:', updatedTransform);
      }
      else if (lastTransformResult.mode === CesiumGizmo.Mode.SCALE) {
        console.log('处理缩放模式');
        
        // 保存当前位置和旋转信息
        const originalLocation = [...updatedTransform.location];
        const originalRotation = [...updatedTransform.rotation];
        console.log('缩放前的原始位置:', originalLocation);
        console.log('缩放前的原始旋转:', originalRotation);
        console.log('缩放前的原始缩放:', updatedTransform.scale);
        
        // 检查缩放数据结构
        console.log('缩放结果数据结构:', result);
        
        // 尝试从结果中提取缩放值
        let scaleX, scaleY, scaleZ;
        
        // 特殊处理：如果result本身就是数组，很可能是直接的缩放值
        if (Array.isArray(result) && result.length >= 3) {
          console.log('检测到result是数组，直接作为缩放值使用');
          [scaleX, scaleY, scaleZ] = result;
        }
        // CesiumGizmo缩放模式可能有不同的数据格式，需要检查并适配
        else if (result.hasOwnProperty('scaleX') && result.hasOwnProperty('scaleY') && result.hasOwnProperty('scaleZ')) {
          // 优先使用专用的缩放属性
          scaleX = result.scaleX;
          scaleY = result.scaleY;
          scaleZ = result.scaleZ;
          console.log('使用scaleX/Y/Z属性:', { scaleX, scaleY, scaleZ });
        } else if (result.hasOwnProperty('x') && result.hasOwnProperty('y') && result.hasOwnProperty('z')) {
          // 回退到x/y/z属性
          scaleX = result.x;
          scaleY = result.y;
          scaleZ = result.z;
          console.log('使用x/y/z属性作为缩放值:', { scaleX, scaleY, scaleZ });
        } else if (result.scale instanceof Array && result.scale.length >= 3) {
          // 检查是否直接有scale数组
          [scaleX, scaleY, scaleZ] = result.scale;
          console.log('使用scale数组:', { scaleX, scaleY, scaleZ });
        } else if (typeof result.scale === 'number') {
          // 可能是统一缩放值
          scaleX = scaleY = scaleZ = result.scale;
          console.log('使用统一缩放值:', result.scale);
        } else {
          // 未找到有效的缩放数据
          console.warn('未找到有效的缩放数据，尝试使用其他属性');
          scaleX = result.scaleX ?? result.x ?? updatedTransform.scale[0];
          scaleY = result.scaleY ?? result.y ?? updatedTransform.scale[1];
          scaleZ = result.scaleZ ?? result.z ?? updatedTransform.scale[2];
        }
        
        // 确保缩放值有效且合理
        if (scaleX !== undefined && scaleY !== undefined && scaleZ !== undefined) {
          // 避免缩放为0或负值，可能导致模型消失或反转
          scaleX = Math.max(0.01, scaleX);
          scaleY = Math.max(0.01, scaleY);
          scaleZ = Math.max(0.01, scaleZ);
          
          console.log('缩放-最终缩放值:', { scaleX, scaleY, scaleZ });
          
          // 只更新缩放值，保留原始位置和旋转
          updatedTransform = {
            location: originalLocation,
            rotation: originalRotation,
            scale: [scaleX, scaleY, scaleZ]
          };
          
          console.log('缩放后的transform:', updatedTransform);
        } else {
          console.log('缩放-未找到有效缩放值，保留原缩放');
        }
      }
      
      console.log('最终计算的transform:', updatedTransform);
      console.log('================调试信息结束================');
      
      // 向服务器发送transform更新
      await updateInstanceProperties(instanceId, { transform: updatedTransform });
      console.log('实例transform更新成功:', instanceId, { transform: updatedTransform });
    } catch (error) {
      console.error('实例transform更新失败:', error);
      console.error('错误详情:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
    }
  }, [calculateLocalPosition]);

  const clearHighlight = useCallback(() => {
    if (lastHighlightedRef.current) {
      if (lastColorRef.current === undefined) {
        lastHighlightedRef.current.color = undefined;
      } else {
        lastHighlightedRef.current.color = Color.clone(lastColorRef.current);
      }
      lastHighlightedRef.current = null;
      lastColorRef.current = undefined;
    }
  }, []);

  const clearGizmo = useCallback(() => {
    if (gizmoRef.current) {
      gizmoRef.current.destroy();
      gizmoRef.current = null;
    }
  }, [gizmoRef]);

  // 添加切换Gizmo模式的函数
  const toggleGizmoMode = useCallback(() => {
    if (!gizmoRef.current || !gizmoRef.current.item) return;
    
    // 定义可用的模式顺序
    const modes = [
      CesiumGizmo.Mode.TRANSLATE,
      CesiumGizmo.Mode.ROTATE,
      CesiumGizmo.Mode.SCALE
    ];
    
    // 获取当前模式的索引
    const currentIndex = modes.indexOf(currentGizmoModeRef.current);
    // 计算下一个模式的索引（循环）
    const nextIndex = (currentIndex + 1) % modes.length;
    // 更新当前模式引用
    currentGizmoModeRef.current = modes[nextIndex];
    
    // 获取当前选中的物体
    const selectedItem = gizmoRef.current.item;
    
    // 清除当前Gizmo
    clearGizmo();
    
    // 创建新的Gizmo，使用新模式
    if (viewerRef.current && selectedItem) {
      // 存储最近的变换结果
      let lastTransformResult: any = null;
      
      gizmoRef.current = new CesiumGizmo(viewerRef.current, {
        item: selectedItem,
        mode: currentGizmoModeRef.current,
        // 在拖动过程中更新lastTransformResult
        onDragMoving: (data: any) => {
          console.log('Gizmo drag moving:', data);
          lastTransformResult = data;
        },
        // 拖动结束时使用lastTransformResult
        onDragEnd: async () => {
          console.log('Gizmo drag end, last result:', lastTransformResult);
          
          // 获取模型实例ID
          const instanceId = selectedItem.id;
          if (!instanceId) {
            console.error('无法更新transform：模型没有有效的ID');
            return;
          }
          
          // 调用通用的更新函数
          await updateModelTransform(instanceId, lastTransformResult);
          
          // 重置lastTransformResult
          lastTransformResult = null;
        }
      });
      
      // 打印当前模式
      console.log('当前Gizmo模式：', 
        currentGizmoModeRef.current === CesiumGizmo.Mode.TRANSLATE ? '平移' :
        currentGizmoModeRef.current === CesiumGizmo.Mode.ROTATE ? '旋转' : '缩放');
    }
  }, [viewerRef, gizmoRef, clearGizmo, updateModelTransform]);

  useEffect(() => {
    // console.log('useCesiumInteractions: useEffect - 依赖项触发，开始执行/重新执行'); // 日志 A
    if (!viewerRef.current) {
      // console.log('useCesiumInteractions: useEffect - viewerRef 为空，中止'); // 日志 B
      return;
    }
    // console.log('useCesiumInteractions: useEffect - viewerRef 有效，准备设置 handler'); // 日志 C
    const viewer = viewerRef.current;
    // console.log('useCesiumInteractions: useEffect - 当前 Viewer 的 canvas:', viewer.scene.canvas); // <--- 打印 canvas 对象
    const handler = new ScreenSpaceEventHandler(viewer.scene.canvas);
    // console.log('useCesiumInteractions: useEffect - ScreenSpaceEventHandler 已创建'); // 日志 D

    // 鼠标悬浮高亮
    handler.setInputAction((movement: any) => {
      // // console.log('MOUSE_MOVE 事件在 Cesium 画布上触发!');
      // clearHighlight(); // 先恢复上一个

      // const pickedObject = viewer.scene.pick(movement.endPosition);
      // if (pickedObject && pickedObject.primitive && pickedObject.primitive instanceof Model) {
      //   const currentModel = pickedObject.primitive;
      //   if (currentModel !== (gizmoRef.current?.item)) { // 如果不是当前 Gizmo 附加的模型
      //        lastColorRef.current = currentModel.color ? Color.clone(currentModel.color) : undefined;
      //        lastHighlightedRef.current = currentModel;
      //        currentModel.color = Color.YELLOW.withAlpha(0.7);
      //   }
      // }
    }, ScreenSpaceEventType.MOUSE_MOVE);
    // console.log('useCesiumInteractions: useEffect - 事件动作已设置'); // 日志 E
    // 点击显示属性和Gizmo
    handler.setInputAction((movement: any) => {
      // console.log('LEFT_CLICK handler triggered! Position:', movement.position); // <--- 重要日志1
      clearGizmo(); // 先清除旧的 Gizmo
      clearHighlight(); // 清除之前的高亮
      onModelSelect(null); // 清除选中状态
      onInstanceTreeSelect?.(null); // 清除实例树选中状态

      const pickedObject = viewer.scene.pick(movement.position);
      console.log('Picked Object in LEFT_CLICK:', pickedObject);
      if (pickedObject && pickedObject.primitive && pickedObject.primitive instanceof Model) {
        const selectedPrimitive = pickedObject.primitive;
        onModelSelect({
          id: selectedPrimitive.id || 'N/A',
          name: (selectedPrimitive as any).name || 'Unnamed Model',
          primitive: selectedPrimitive,
        });

        // 更新实例树选中状态
        if (selectedPrimitive.id) {
          onInstanceTreeSelect?.(selectedPrimitive.id);
        }

        // 创建新的 gizmo，使用当前模式
        // 存储最近的变换结果
        let lastTransformResult: any = null;
        
        gizmoRef.current = new CesiumGizmo(viewer, {
          item: selectedPrimitive,
          mode: currentGizmoModeRef.current, // 使用当前选择的模式
          // 在拖动过程中更新lastTransformResult
          onDragMoving: (data: any) => {
            console.log('Gizmo drag moving:', data);
            lastTransformResult = data;
          },
          // 拖动结束时使用lastTransformResult
          onDragEnd: async () => {
            console.log('Gizmo drag end, last result:', lastTransformResult);
            
            // 获取模型实例ID
            const instanceId = selectedPrimitive.id;
            if (!instanceId) {
              console.error('无法更新transform：模型没有有效的ID');
              return;
            }
            
            // 调用通用的更新函数
            await updateModelTransform(instanceId, lastTransformResult);
            
            // 重置lastTransformResult
            lastTransformResult = null;
          }
        });

        // 设置选中模型的边缘高亮效果
        lastHighlightedRef.current = selectedPrimitive;
        // 保存原始颜色
        lastColorRef.current = selectedPrimitive.color ? Color.clone(selectedPrimitive.color) : undefined;
        
        // 设置高亮颜色 - 使用亮橙色作为边缘高亮
        selectedPrimitive.color = Color.ORANGE.withAlpha(0.8);
        
        // 如果模型支持轮廓效果，可以尝试设置轮廓
        if (selectedPrimitive.silhouetteColor && selectedPrimitive.silhouetteSize) {
          selectedPrimitive.silhouetteColor = Color.ORANGE;
          selectedPrimitive.silhouetteSize = 2.0;
        }
      } else {
        // 如果点击空白或非模型，销毁 Gizmo
        // console.log('No valid model picked, or picked something else.'); // <--- 重要日志3
        clearGizmo();
        onModelSelect(null);
      }
    }, ScreenSpaceEventType.LEFT_CLICK);

    // 添加键盘事件监听器，用于切换Gizmo模式
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code === 'Space' && gizmoRef.current) {
        event.preventDefault(); // 阻止默认的空格行为（通常是滚动页面）
        toggleGizmoMode();
      }
    };

    // 添加键盘事件监听
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      // console.log('useCesiumInteractions: useEffect - CLEANUP 执行! 销毁 handler'); // <--- 日志 F (关键!)
      handler.destroy();
      clearHighlight();
      clearGizmo();
      // 移除键盘事件监听
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [viewerRef, onModelSelect, clearHighlight, clearGizmo, gizmoRef, onInstanceTreeSelect, toggleGizmoMode, updateModelTransform]);

  // 提供一个外部清除高亮的方法，例如当鼠标移出画布时
  const externalClearHighlight = clearHighlight;

  return { externalClearHighlight, clearGizmo, toggleGizmoMode };
};