import { useCallback, useRef } from 'react';
import { Viewer, Model, Color, Matrix4, Cartesian3 } from 'cesium';
import * as Cesium from 'cesium';
// @ts-ignore
import CesiumGizmo from '../../cesium-gizmo/src/CesiumGizmo.js';
import { updateInstanceProperties, getInstanceProperties, getSceneInstanceTree, updateInstancesProperties } from '../services/sceneApi';

// 稍后会从 useCesiumInteractions.ts 移动相关接口和类型到这里
// 例如 SelectedModelInfo (如果 Gizmo 直接使用)

export interface UseCesiumGizmoProps {
  viewerRef: React.RefObject<Viewer | null>;
  gizmoRef: React.MutableRefObject<any | null>;
  sceneOrigin?: { longitude: number; latitude: number; height: number };
  sceneId?: string;
  // 可能还需要其他从 useCesiumInteractions 传递过来的参数或回调
}

export const useCesiumGizmo = ({
  viewerRef,
  gizmoRef,
  sceneOrigin,
  sceneId,
}: UseCesiumGizmoProps) => {
  // Gizmo 相关的 state 和 refs 将会移动到这里
  const currentGizmoModeRef = useRef<string>(CesiumGizmo.Mode.TRANSLATE);
  const childInstancesRef = useRef<string[]>([]);
  const lastPositionRef = useRef<Cesium.Cartesian3 | null>(null);
  const instanceTreeCacheRef = useRef<{ sceneId: string | undefined, tree: any | null }>({ sceneId: undefined, tree: null });
  const childInitialMatricesRef = useRef<Map<string, Cesium.Matrix4>>(new Map());

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

  const findAllChildInstances = useCallback(async (instanceId: string): Promise<string[]> => {
    if (!sceneId) {
      console.warn('无法获取子节点: 未提供场景ID');
      return [];
    }

    try {
      // 尝试使用缓存
      let currentInstanceTree;
      // 检查是否有有效的缓存树
      if (instanceTreeCacheRef.current.sceneId === sceneId && instanceTreeCacheRef.current.tree) {
        currentInstanceTree = instanceTreeCacheRef.current.tree;
        // console.log('使用实例树缓存，sceneId:', sceneId); // DEBUG
      } else {
        // 从API获取实例树
        // console.log('从API获取实例树数据，sceneId:', sceneId); // DEBUG
        const response = await getSceneInstanceTree(sceneId);
        currentInstanceTree = response.data;
        // 更新缓存
        instanceTreeCacheRef.current = { sceneId, tree: currentInstanceTree };
      }

      // 改进的递归方法，接受所有可能的资产类型
      const getAllChildIdsRecursive = (node: any): string[] => {
        let ids: string[] = [];
        if (node.children && Array.isArray(node.children) && node.children.length > 0) {
          for (const child of node.children) {
            // 包含任意可视资产类型，如model, public_model, 3dtiles等
            if (child.uid && (child.asset_type || child.type)) {
              ids.push(child.uid);
            }
            // 递归处理子节点
            ids = ids.concat(getAllChildIdsRecursive(child));
          }
        }
        return ids;
      };

      // 在树中查找目标节点并获取所有子节点
      let foundChildren: string[] = [];
      const searchForNodeAndGetChildren = (currentNode: any, targetId: string): boolean => {
        if (!currentNode) return false;
        
        if (currentNode.uid === targetId) {
          foundChildren = getAllChildIdsRecursive(currentNode);
          return true;
        }
        
        if (currentNode.children && Array.isArray(currentNode.children) && currentNode.children.length > 0) {
          for (const child of currentNode.children) {
            if (searchForNodeAndGetChildren(child, targetId)) {
              return true;
            }
          }
        }
        
        return false;
      };

      // 开始搜索
      searchForNodeAndGetChildren(currentInstanceTree, instanceId);
      // console.log(`找到的子节点ID(${foundChildren.length}个):`, foundChildren); // DEBUG
      return foundChildren;
    } catch (error) {
      console.error('获取子节点失败:', error);
      // 清除缓存以便下次重新获取
      instanceTreeCacheRef.current = { sceneId: undefined, tree: null };
      return [];
    }
  }, [sceneId]);

  const updateChildModelsPosition = useCallback((delta: Cesium.Cartesian3) => {
    if (!viewerRef.current || childInstancesRef.current.length === 0) return;
    
    const primitives = viewerRef.current.scene.primitives;
    
    // 创建平移矩阵
    const translationMatrix = Cesium.Matrix4.fromTranslation(delta, new Cesium.Matrix4());
    
    // 遍历所有子模型，应用相同的位移
    for (const childId of childInstancesRef.current) {
      for (let i = 0; i < primitives.length; i++) {
        const primitive = primitives.get(i);
        if (primitive instanceof Cesium.Model && primitive.id === childId) {
          try {
            // 获取当前模型矩阵
            const modelMatrix = primitive.modelMatrix;
            
            // 确保正确克隆矩阵，避免引用问题
            const clonedMatrix = Cesium.Matrix4.clone(modelMatrix);
            
            // 应用平移变换
            const newMatrix = Cesium.Matrix4.multiply(
              translationMatrix, 
              clonedMatrix, 
              new Cesium.Matrix4()
            );
            
            // 更新模型矩阵
            primitive.modelMatrix = newMatrix;
            
            // 强制请求渲染
            if (viewerRef.current) {
              viewerRef.current.scene.requestRender();
            }
          } catch (error) {
            console.error(`更新子节点 ${childId} 位置时发生错误:`, error);
          }
        }
      }
    }
  }, [viewerRef]);

  const updateModelTransform = useCallback(async (instanceId: string, lastTransformResult: any) => {
    if (!lastTransformResult) return;
    
    try {
      let instanceProperties;
      try {
        const response = await getInstanceProperties(instanceId);
        instanceProperties = response || null;
      } catch (err) {
        console.error('获取实例属性失败:', err);
        instanceProperties = null;
      }
      
      let currentTransform = null;
      
      if (instanceProperties?.data?.data?.instance?.transform) {
        currentTransform = instanceProperties.data.data.instance.transform;
      } else if (instanceProperties?.data?.instance?.transform) {
        currentTransform = instanceProperties.data.instance.transform;
      } else if (instanceProperties?.data?.data?.transform) {
        currentTransform = instanceProperties.data.data.transform;
      } else if (instanceProperties?.data?.transform) {
        currentTransform = instanceProperties.data.transform;
      }
      
      let updatedTransform = {
        location: currentTransform?.location || [0, 0, 0],
        rotation: currentTransform?.rotation || [0, 0, 0],
        scale: currentTransform?.scale || [1, 1, 1]
      };
      
      const result = lastTransformResult.result;
      let locationOffset: number[] | null = null;
      
      if (lastTransformResult.mode === CesiumGizmo.Mode.TRANSLATE) {
        const position = new Cesium.Cartesian3(result.x || 0, result.y || 0, result.z || 0);
        const localPosition = calculateLocalPosition(position);
        locationOffset = [
          localPosition[0] - updatedTransform.location[0],
          localPosition[1] - updatedTransform.location[1],
          localPosition[2] - updatedTransform.location[2]
        ];
        updatedTransform.location = localPosition;
      } 
      else if (lastTransformResult.mode === CesiumGizmo.Mode.ROTATE) {
        const originalLocation = [...updatedTransform.location];
        let rotationDegrees = [0, 0, 0];
        if (result.heading !== undefined && result.pitch !== undefined && result.roll !== undefined) {
          try {
            const headingRad = result.heading || 0;
            const pitchRad = result.pitch || 0;
            const rollRad = result.roll || 0;
            const headingDeg = Cesium.Math.toDegrees(headingRad);
            const pitchDeg = Cesium.Math.toDegrees(pitchRad);
            const rollDeg = Cesium.Math.toDegrees(rollRad);
            rotationDegrees = [headingDeg, pitchDeg, rollDeg];
          } catch (e) {
            console.error('HPR角度转换错误:', e);
            rotationDegrees = [...updatedTransform.rotation];
          }
        } else {
          try {
            const xRad = result.x || 0;
            const yRad = result.y || 0;
            const zRad = result.z || 0;
            const xDeg = Cesium.Math.toDegrees(xRad);
            const yDeg = Cesium.Math.toDegrees(yRad);
            const zDeg = Cesium.Math.toDegrees(zRad);
            rotationDegrees = [xDeg, yDeg, zDeg];
          } catch (e) {
            console.error('XYZ角度转换错误:', e);
            rotationDegrees = [...updatedTransform.rotation];
          }
        }
        updatedTransform = {
          location: originalLocation,
          rotation: rotationDegrees,
          scale: updatedTransform.scale
        };
      }
      else if (lastTransformResult.mode === CesiumGizmo.Mode.SCALE) {
        const originalLocation = [...updatedTransform.location];
        const originalRotation = [...updatedTransform.rotation];
        let scaleX, scaleY, scaleZ;
        if (Array.isArray(result) && result.length >= 3) {
          [scaleX, scaleY, scaleZ] = result;
        } else if (result.hasOwnProperty('scaleX') && result.hasOwnProperty('scaleY') && result.hasOwnProperty('scaleZ')) {
          scaleX = result.scaleX;
          scaleY = result.scaleY;
          scaleZ = result.scaleZ;
        } else if (result.hasOwnProperty('x') && result.hasOwnProperty('y') && result.hasOwnProperty('z')) {
          scaleX = result.x;
          scaleY = result.y;
          scaleZ = result.z;
        } else if (result.scale instanceof Array && result.scale.length >= 3) {
          [scaleX, scaleY, scaleZ] = result.scale;
        } else if (typeof result.scale === 'number') {
          scaleX = scaleY = scaleZ = result.scale;
        } else {
          scaleX = result.scaleX ?? result.x ?? updatedTransform.scale[0];
          scaleY = result.scaleY ?? result.y ?? updatedTransform.scale[1];
          scaleZ = result.scaleZ ?? result.z ?? updatedTransform.scale[2];
        }
        if (scaleX !== undefined && scaleY !== undefined && scaleZ !== undefined) {
          scaleX = Math.max(0.01, scaleX);
          scaleY = Math.max(0.01, scaleY);
          scaleZ = Math.max(0.01, scaleZ);
          updatedTransform = {
            location: originalLocation,
            rotation: originalRotation,
            scale: [scaleX, scaleY, scaleZ]
          };
        }
      }
      
      let allUpdates: {id: string, transform: any}[] = [
        {id: instanceId, transform: updatedTransform}
      ];
      
      if (lastTransformResult.mode === CesiumGizmo.Mode.TRANSLATE && locationOffset && sceneId) {
        const childIdsToUpdate = childInstancesRef.current.length > 0 
          ? childInstancesRef.current 
          : await findAllChildInstances(instanceId);
        
        if (childInstancesRef.current.length === 0 && childIdsToUpdate.length > 0) {
          childInstancesRef.current = childIdsToUpdate;
        }
        
        if (childIdsToUpdate.length > 0) {
          for (const childId of childIdsToUpdate) {
            try {
              const childPropsResponse = await getInstanceProperties(childId);
              let childTransform = null;
              if (childPropsResponse?.data?.data?.instance?.transform) {
                childTransform = childPropsResponse.data.data.instance.transform;
              } else if (childPropsResponse?.data?.instance?.transform) {
                childTransform = childPropsResponse.data.instance.transform;
              } else if (childPropsResponse?.data?.data?.transform) {
                childTransform = childPropsResponse.data.data.transform;
              } else if (childPropsResponse?.data?.transform) {
                childTransform = childPropsResponse.data.transform;
              }
              
              if (!childTransform) {
                continue;
              }
              
              const updatedChildTransform = {
                ...childTransform,
                location: [
                  childTransform.location[0] + locationOffset[0],
                  childTransform.location[1] + locationOffset[1],
                  childTransform.location[2] + locationOffset[2]
                ]
              };
              
              allUpdates.push({
                id: childId,
                transform: updatedChildTransform
              });
            } catch (error) {
              console.error(`获取子节点 ${childId} 属性失败:`, error);
            }
          }
        }
      }
      
      if (allUpdates.length === 1) {
        await updateInstanceProperties(instanceId, { transform: updatedTransform });
      } else {
        await updateInstancesProperties(allUpdates);
      }
    } catch (error) {
      console.error('实例transform更新失败:', error);
      console.error('错误详情:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
    }
  }, [calculateLocalPosition, sceneId, findAllChildInstances]);

  const clearGizmo = useCallback(() => {
    if (gizmoRef.current) {
      gizmoRef.current.destroy();
      gizmoRef.current = null;
    }
    // 清除子节点列表
    childInstancesRef.current = [];
    lastPositionRef.current = null;
    childInitialMatricesRef.current.clear(); 
  }, [gizmoRef]);

  const toggleGizmoMode = useCallback(async () => {
    if (!gizmoRef.current || !gizmoRef.current.item || !viewerRef.current) return;
    
    const modes = [
      CesiumGizmo.Mode.TRANSLATE,
      CesiumGizmo.Mode.ROTATE,
      CesiumGizmo.Mode.SCALE
    ];
    
    const currentIndex = modes.indexOf(currentGizmoModeRef.current);
    const nextIndex = (currentIndex + 1) % modes.length;
    currentGizmoModeRef.current = modes[nextIndex];
    
    const selectedItem = gizmoRef.current.item;
    clearGizmo(); // This will also clear childInitialMatricesRef
    
    if (selectedItem) { // Check if selectedItem is still valid after clearGizmo
      let lastTransformResult: any = null;
      let initialMatrix: Cesium.Matrix4 | null = null; // Parent's initial matrix

      if (currentGizmoModeRef.current === CesiumGizmo.Mode.TRANSLATE && selectedItem.id) {
        initialMatrix = Cesium.Matrix4.clone(selectedItem.modelMatrix); 
        findAllChildInstances(selectedItem.id).then(childIds => {
          childInstancesRef.current = childIds;
          // console.log('toggleGizmoMode: Preloaded child IDs:', childIds); // DEBUG
          childInitialMatricesRef.current.clear(); // Clear before caching new ones
          if (viewerRef.current) {
            const primitives = viewerRef.current.scene.primitives;
            childIds.forEach(childId => {
              for (let i = 0; i < primitives.length; i++) {
                const primitive = primitives.get(i);
                if (primitive instanceof Cesium.Model && primitive.id === childId) {
                  childInitialMatricesRef.current.set(childId, Cesium.Matrix4.clone(primitive.modelMatrix));
                  break;
                }
              }
            });
            // console.log('toggleGizmoMode: Cached child initial matrices count:', childInitialMatricesRef.current.size); // DEBUG
          }
        });
      } else {
        childInstancesRef.current = []; // Clear for non-translate modes
        childInitialMatricesRef.current.clear();
      }
      
      gizmoRef.current = new CesiumGizmo(viewerRef.current, {
        item: selectedItem,
        mode: currentGizmoModeRef.current,
        onDragStart: () => {
          if (currentGizmoModeRef.current === CesiumGizmo.Mode.TRANSLATE) {
            const currentParentPosition = new Cesium.Cartesian3();
            Cesium.Matrix4.getTranslation(selectedItem.modelMatrix, currentParentPosition);
            lastPositionRef.current = Cesium.Cartesian3.clone(currentParentPosition);
            
            if (viewerRef.current && childInstancesRef.current.length > 0 && childInitialMatricesRef.current.size !== childInstancesRef.current.length) {
                 // console.warn('toggleGizmoMode - onDragStart: Child initial matrices cache incomplete, re-caching.'); // DEBUG
                 const primitives = viewerRef.current.scene.primitives;
                 childInitialMatricesRef.current.clear();
                 childInstancesRef.current.forEach(childId => {
                     for (let i = 0; i < primitives.length; i++) {
                         const primitive = primitives.get(i);
                         if (primitive instanceof Cesium.Model && primitive.id === childId) {
                             childInitialMatricesRef.current.set(childId, Cesium.Matrix4.clone(primitive.modelMatrix));
                             break;
                         }
                     }
                 });
                 // console.log('toggleGizmoMode - onDragStart: Re-cached child initial matrices count:', childInitialMatricesRef.current.size); // DEBUG
            }
          }
        },
        onDragMoving: (data: any) => {
          if (data.mode === CesiumGizmo.Mode.TRANSLATE && childInstancesRef.current.length > 0 && lastPositionRef.current) {
            const position = new Cesium.Cartesian3(data.result.x || 0, data.result.y || 0, data.result.z || 0);
            const delta = Cesium.Cartesian3.subtract(position, lastPositionRef.current, new Cesium.Cartesian3());
            updateChildModelsPosition(delta); 
            lastPositionRef.current = Cesium.Cartesian3.clone(position);
            if (viewerRef.current) viewerRef.current.scene.requestRender();
          }
          lastTransformResult = data; 
        },
        onDragEnd: async () => {
          const instanceId = selectedItem.id;
          if (!instanceId) {
            // console.error('toggleGizmoMode - onDragEnd: Model has no valid ID.'); // DEBUG
            return;
          }
          
          if (lastTransformResult?.mode === CesiumGizmo.Mode.TRANSLATE &&
              childInstancesRef.current.length > 0 &&
              initialMatrix && 
              viewerRef.current) {

            const finalParentMatrix = Cesium.Matrix4.clone(selectedItem.modelMatrix);
            const inverseInitialParentMatrix = Cesium.Matrix4.inverse(initialMatrix, new Cesium.Matrix4());
            const deltaMatrix = Cesium.Matrix4.multiply(finalParentMatrix, inverseInitialParentMatrix, new Cesium.Matrix4());
            
            // console.log('toggleGizmoMode - onDragEnd: Calibrating child nodes. Parent deltaMatrix calculated.'); // DEBUG

            const primitives = viewerRef.current.scene.primitives;
            for (const childId of childInstancesRef.current) {
              const originalChildMatrix = childInitialMatricesRef.current.get(childId);
              if (!originalChildMatrix) {
                // console.warn(`toggleGizmoMode - onDragEnd: Initial matrix for child ${childId} not found, skipping calibration.`); // DEBUG
                continue;
              }

              for (let i = 0; i < primitives.length; i++) {
                const primitive = primitives.get(i);
                if (primitive instanceof Cesium.Model && primitive.id === childId) {
                  try {
                    const newMatrix = Cesium.Matrix4.multiply(deltaMatrix, originalChildMatrix, new Cesium.Matrix4());
                    primitive.modelMatrix = newMatrix;
                    
                    // const oldPos = new Cesium.Cartesian3(); // DEBUG
                    // const newPos = new Cesium.Cartesian3(); // DEBUG
                    // Cesium.Matrix4.getTranslation(originalChildMatrix, oldPos); // DEBUG
                    // Cesium.Matrix4.getTranslation(newMatrix, newPos); // DEBUG
                    // console.log(`Child ${childId} position calibrated (based on initial matrix): Original: [${oldPos.x.toFixed(2)}, ${oldPos.y.toFixed(2)}, ${oldPos.z.toFixed(2)}], New: [${newPos.x.toFixed(2)}, ${newPos.y.toFixed(2)}, ${newPos.z.toFixed(2)}]`); // DEBUG
                  } catch (err) {
                    console.error(`toggleGizmoMode - onDragEnd: Error calibrating child ${childId} position:`, err);
                  }
                  break; 
                }
              }
            }
            const viewer = viewerRef.current; 
            const triggerMultipleRenders = () => {
              if (!viewer || viewer.isDestroyed()) return;
              viewer.scene.requestRender();
              window.requestAnimationFrame(() => {
                if (!viewer.isDestroyed()) viewer.scene.requestRender();
                setTimeout(() => {
                  if (!viewer.isDestroyed()) viewer.scene.requestRender();
                  setTimeout(() => {
                    if (!viewer.isDestroyed()) viewer.scene.requestRender();
                  }, 50);
                }, 16);
              });
            };
            triggerMultipleRenders();
          }
          
          await updateModelTransform(instanceId, lastTransformResult);
          lastPositionRef.current = null;
        }
      });
    }
  }, [viewerRef, gizmoRef, clearGizmo, updateModelTransform, findAllChildInstances, updateChildModelsPosition, sceneId]);

  const setupGizmo = useCallback(async (selectedItem: Model) => {
    if (!viewerRef.current || !selectedItem || !selectedItem.id) return;
    const viewer = viewerRef.current;
    const instanceId = selectedItem.id;

    clearGizmo(); 

    try {
      let initialParentMatrix: Cesium.Matrix4 | null = null; 

      if (currentGizmoModeRef.current === CesiumGizmo.Mode.TRANSLATE) {
        initialParentMatrix = Cesium.Matrix4.clone(selectedItem.modelMatrix); 
        const childIds = await findAllChildInstances(instanceId);
        childInstancesRef.current = childIds;
        // console.log('setupGizmo: Preloaded child IDs for drag:', childIds); // DEBUG
        childInitialMatricesRef.current.clear(); 
        const primitives = viewer.scene.primitives;
        childIds.forEach(childId => {
          for (let i = 0; i < primitives.length; i++) {
            const primitive = primitives.get(i);
            if (primitive instanceof Cesium.Model && primitive.id === childId) {
              childInitialMatricesRef.current.set(childId, Cesium.Matrix4.clone(primitive.modelMatrix));
              break;
            }
          }
        });
        // console.log('setupGizmo: Cached child initial matrices count:', childInitialMatricesRef.current.size); // DEBUG
      } else {
        childInstancesRef.current = []; 
        childInitialMatricesRef.current.clear();
      }

      let lastTransformResult: any = null; 
      
      gizmoRef.current = new CesiumGizmo(viewer, {
        item: selectedItem,
        mode: currentGizmoModeRef.current,
        onDragStart: () => {
          if (currentGizmoModeRef.current === CesiumGizmo.Mode.TRANSLATE) {
            if (!initialParentMatrix) {
                // console.warn('setupGizmo - onDragStart: initialParentMatrix was null, capturing now (should have been set earlier).'); // DEBUG
                initialParentMatrix = Cesium.Matrix4.clone(selectedItem.modelMatrix);
            }
            const currentParentPosition = new Cesium.Cartesian3();
            Cesium.Matrix4.getTranslation(selectedItem.modelMatrix, currentParentPosition);
            lastPositionRef.current = Cesium.Cartesian3.clone(currentParentPosition);

            if (childInstancesRef.current.length > 0 && childInitialMatricesRef.current.size !== childInstancesRef.current.length) {
              // console.warn('setupGizmo - onDragStart: Child initial matrices cache incomplete, re-caching.'); // DEBUG
              childInitialMatricesRef.current.clear();
              const primitives = viewer.scene.primitives;
              childInstancesRef.current.forEach(childId => {
                for (let i = 0; i < primitives.length; i++) {
                  const primitive = primitives.get(i);
                  if (primitive instanceof Cesium.Model && primitive.id === childId) {
                    childInitialMatricesRef.current.set(childId, Cesium.Matrix4.clone(primitive.modelMatrix));
                    break;
                  }
                }
              });
              // console.log('setupGizmo - onDragStart: Re-cached child initial matrices count:', childInitialMatricesRef.current.size); // DEBUG
            }
          }
        },
        onDragMoving: (data: any) => {
          if (data.mode === CesiumGizmo.Mode.TRANSLATE && 
              childInstancesRef.current.length > 0 && 
              lastPositionRef.current) { 
            const currentGizmoPosition = new Cesium.Cartesian3(data.result.x || 0, data.result.y || 0, data.result.z || 0);
            const deltaSinceLastMove = Cesium.Cartesian3.subtract(currentGizmoPosition, lastPositionRef.current, new Cesium.Cartesian3());
            updateChildModelsPosition(deltaSinceLastMove); 
            lastPositionRef.current = Cesium.Cartesian3.clone(currentGizmoPosition);
            viewer.scene.requestRender();
          }
          lastTransformResult = data; 
        },
        onDragEnd: async () => {
          if (!instanceId) {
            // console.error('setupGizmo - onDragEnd: Model has no valid ID.'); // DEBUG
            return;
          }
          
          if (lastTransformResult?.mode === CesiumGizmo.Mode.TRANSLATE && 
              childInstancesRef.current.length > 0 && 
              initialParentMatrix) { 
            
            const finalParentMatrix = Cesium.Matrix4.clone(selectedItem.modelMatrix);
            const inverseInitialParentMatrix = Cesium.Matrix4.inverse(initialParentMatrix, new Cesium.Matrix4());
            const deltaMatrix = Cesium.Matrix4.multiply(finalParentMatrix, inverseInitialParentMatrix, new Cesium.Matrix4());
            
            // console.log('setupGizmo - onDragEnd: Calibrating child node positions. Parent total deltaMatrix calculated.'); // DEBUG
            
            const primitives = viewer.scene.primitives;
            for (const childId of childInstancesRef.current) {
              const originalChildMatrix = childInitialMatricesRef.current.get(childId);
              if (!originalChildMatrix) {
                // console.warn(`setupGizmo - onDragEnd: Initial matrix for child ${childId} not found, skipping calibration.`); // DEBUG
                continue;
              }

              for (let i = 0; i < primitives.length; i++) {
                const primitive = primitives.get(i); 
                if (primitive instanceof Cesium.Model && primitive.id === childId) {
                  try {
                    const newMatrix = Cesium.Matrix4.multiply(deltaMatrix, originalChildMatrix, new Cesium.Matrix4());
                    primitive.modelMatrix = newMatrix;
                    
                    // const oldPos = new Cesium.Cartesian3(); // DEBUG
                    // const newPos = new Cesium.Cartesian3(); // DEBUG
                    // Cesium.Matrix4.getTranslation(originalChildMatrix, oldPos); // DEBUG
                    // Cesium.Matrix4.getTranslation(newMatrix, newPos); // DEBUG
                    
                    // console.log(`Child ${childId} position calibrated (based on initial matrix): Original: [${oldPos.x.toFixed(2)}, ${oldPos.y.toFixed(2)}, ${oldPos.z.toFixed(2)}], New: [${newPos.x.toFixed(2)}, ${newPos.y.toFixed(2)}, ${newPos.z.toFixed(2)}]`); // DEBUG

                  } catch (err) {
                    console.error(`setupGizmo - onDragEnd: Error calibrating child ${childId} position:`, err);
                  }
                  break; 
                }
              }
            }
            
            const triggerMultipleRenders = () => {
              if (viewer.isDestroyed()) return;
              viewer.scene.requestRender();
              window.requestAnimationFrame(() => {
                if (!viewer.isDestroyed()) viewer.scene.requestRender();
                setTimeout(() => {
                  if (!viewer.isDestroyed()) viewer.scene.requestRender();
                  setTimeout(() => {
                    if (!viewer.isDestroyed()) viewer.scene.requestRender();
                  }, 50);
                }, 16);
              });
            };
            triggerMultipleRenders();
          }
          
          setTimeout(async () => {
            await updateModelTransform(instanceId, lastTransformResult);
            lastPositionRef.current = null;
          }, 100); 
        }
      });
    } catch (error) {
      console.error("Error setting up Gizmo:", error);
      clearGizmo(); 
    }
  }, [viewerRef, gizmoRef, clearGizmo, findAllChildInstances, updateChildModelsPosition, updateModelTransform, sceneId, currentGizmoModeRef /* Added currentGizmoModeRef */]);

  return { 
    clearGizmo, 
    toggleGizmoMode, 
    setupGizmo, 
  };
}; 