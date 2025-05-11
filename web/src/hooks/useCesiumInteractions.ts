// hooks/useCesiumInteractions.ts
import { useEffect, useRef, useCallback } from 'react';
import { Viewer, ScreenSpaceEventHandler, ScreenSpaceEventType, Color, Model } from 'cesium';
import * as Cesium from 'cesium';
import CesiumGizmo from '../../cesium-gizmo/src/CesiumGizmo.js'; // 假设路径正确

export interface SelectedModelInfo {
  id: string;
  name: string;
  primitive: Model; // 存储原始模型对象
}

export const useCesiumInteractions = (
  viewerRef: React.RefObject<Viewer | null>,
  onModelSelect: (modelInfo: SelectedModelInfo | null) => void,
  gizmoRef: React.MutableRefObject<any | null> // 使用 any 因为 CesiumGizmo 类型可能未导出
) => {
  const lastHighlightedRef = useRef<any>(null);
  const lastColorRef = useRef<Color | undefined>(undefined);

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
      // console.log('MOUSE_MOVE 事件在 Cesium 画布上触发!');
      clearHighlight(); // 先恢复上一个

      const pickedObject = viewer.scene.pick(movement.endPosition);
      if (pickedObject && pickedObject.primitive && pickedObject.primitive instanceof Model) {
        const currentModel = pickedObject.primitive;
        if (currentModel !== (gizmoRef.current?.item)) { // 如果不是当前 Gizmo 附加的模型
             lastColorRef.current = currentModel.color ? Color.clone(currentModel.color) : undefined;
             lastHighlightedRef.current = currentModel;
             currentModel.color = Color.YELLOW.withAlpha(0.7);
        }
      }
    }, ScreenSpaceEventType.MOUSE_MOVE);
    // console.log('useCesiumInteractions: useEffect - 事件动作已设置'); // 日志 E
    // 点击显示属性和Gizmo
    handler.setInputAction((movement: any) => {
      // console.log('LEFT_CLICK handler triggered! Position:', movement.position); // <--- 重要日志1
      clearGizmo(); // 先清除旧的 Gizmo
      onModelSelect(null); // 清除选中状态

      const pickedObject = viewer.scene.pick(movement.position);
      console.log('Picked Object in LEFT_CLICK:', pickedObject);
      if (pickedObject && pickedObject.primitive && pickedObject.primitive instanceof Model) {
        const selectedPrimitive = pickedObject.primitive;
        onModelSelect({
          id: selectedPrimitive.id || 'N/A', // 确保模型有 id
          name: (selectedPrimitive as any).name || 'Unnamed Model', // Cesium.Model 没有直接的 name 属性，通常通过 id 或自定义属性获取
          primitive: selectedPrimitive,
        });

        // 创建新的 gizmo
        gizmoRef.current = new CesiumGizmo(viewer, {
          item: selectedPrimitive,
          mode: CesiumGizmo.Mode.TRANSLATE, // 默认平移，可后续更改
          onDragEnd: ({type, result}) => { // 或者 onDragMoving
            console.log('Gizmo drag end:', type, result);
            // 这里可以更新模型在后端或状态中的位置/旋转/缩放信息
          }
        });

        // 如果点击的是选中的模型，确保它不高亮（Gizmo 作为指示器）
        if (lastHighlightedRef.current === selectedPrimitive) {
            clearHighlight();
        }
        // 设置选中模型的颜色（如果需要，或者依赖 Gizmo）
        // selectedPrimitive.color = Cesium.Color.ORANGE; // 示例：给选中的模型一个特定颜色
      } else {
        // 如果点击空白或非模型，销毁 Gizmo
        // console.log('No valid model picked, or picked something else.'); // <--- 重要日志3
        clearGizmo();
        onModelSelect(null);
      }
    }, ScreenSpaceEventType.LEFT_CLICK);

    return () => {
      // console.log('useCesiumInteractions: useEffect - CLEANUP 执行! 销毁 handler'); // <--- 日志 F (关键!)
      handler.destroy();
      clearHighlight();
      clearGizmo();
    };
  }, [viewerRef, onModelSelect, clearHighlight, clearGizmo, gizmoRef]);

  // 提供一个外部清除高亮的方法，例如当鼠标移出画布时
  const externalClearHighlight = clearHighlight;

  return { externalClearHighlight, clearGizmo };
};