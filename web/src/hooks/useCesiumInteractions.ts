// hooks/useCesiumInteractions.ts
import { useEffect, useRef, useCallback } from 'react';
import { Viewer, ScreenSpaceEventHandler, ScreenSpaceEventType, Color, Model } from 'cesium';
// import * as Cesium from 'cesium'; // Cesium import might not be needed if all Cesium types are from 'cesium' directly
// @ts-ignore
// import CesiumGizmo from '../../cesium-gizmo/src/CesiumGizmo.js'; // Moved to useCesiumGizmo
// import { updateInstanceProperties, getInstanceProperties, getSceneInstanceTree, updateInstancesProperties } from '../services/sceneApi'; // Moved to useCesiumGizmo
import { useCesiumGizmo } from './useCesiumGizmo'; // Import the new hook

export interface SelectedModelInfo {
  id: string;
  name: string;
  primitive: Model; // 存储原始模型对象
}

export const useCesiumInteractions = (
  viewerRef: React.RefObject<Viewer | null>,
  onModelSelect: (modelInfo: SelectedModelInfo | null) => void,
  gizmoRef: React.MutableRefObject<any | null>,
  onInstanceTreeSelect?: (instanceId: string | null) => void,
  sceneOrigin?: { longitude: number, latitude: number, height: number },
  sceneId?: string
) => {
  const lastHighlightedRef = useRef<any>(null);
  const lastColorRef = useRef<Color | undefined>(undefined);

  // Use the new Gizmo hook
  const {
    clearGizmo,
    toggleGizmoMode,
    setupGizmo,
  } = useCesiumGizmo({
    viewerRef,
    gizmoRef,
    sceneOrigin,
    sceneId,
  });

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

  // useEffect for handling interactions (click, keydown)
  useEffect(() => {
    if (!viewerRef.current) return;
    const viewer = viewerRef.current;
    const handler = new ScreenSpaceEventHandler(viewer.scene.canvas);

    // MOUSE_MOVE: Currently commented out highlight logic (can be re-added if needed)
    handler.setInputAction(() => {},
    ScreenSpaceEventType.MOUSE_MOVE);
    
    // LEFT_CLICK: Select model and setup Gizmo
    handler.setInputAction((movement: any) => {
      const pickedObject = viewer.scene.pick(movement.position);

      if (pickedObject && pickedObject.primitive && pickedObject.primitive instanceof Model) {
        const selectedPrimitive = pickedObject.primitive as Model; // Cast for type safety
        onModelSelect({
          id: selectedPrimitive.id || 'N/A',
          name: (selectedPrimitive as any).name || 'Unnamed Model',
          primitive: selectedPrimitive,
        });

        if (selectedPrimitive.id) {
          onInstanceTreeSelect?.(selectedPrimitive.id);
        }
        
        setupGizmo(selectedPrimitive); // Call setupGizmo from the new hook

        // Highlighting logic remains here
        clearHighlight(); 
        lastHighlightedRef.current = selectedPrimitive;
        lastColorRef.current = selectedPrimitive.color ? Color.clone(selectedPrimitive.color) : undefined;
        selectedPrimitive.color = Color.ORANGE.withAlpha(0.8);
        // Consider moving silhouette logic to a separate highlighting function if it grows
        if (selectedPrimitive.silhouetteColor && selectedPrimitive.silhouetteSize) {
          selectedPrimitive.silhouetteColor = Color.ORANGE;
          selectedPrimitive.silhouetteSize = 2.0;
        }

      } else {
        clearGizmo(); 
        clearHighlight();
        onModelSelect(null);
        onInstanceTreeSelect?.(null);
      }
    }, ScreenSpaceEventType.LEFT_CLICK);

    // KEYDOWN: Toggle Gizmo mode
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ensure gizmoRef.current.item exists before toggling, same as in the original toggleGizmoMode
      if (event.code === 'Space' && gizmoRef.current && gizmoRef.current.item) {
        event.preventDefault();
        toggleGizmoMode(); // Call toggleGizmoMode from the new hook
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      handler.destroy();
      clearHighlight();
      clearGizmo(); // Ensure Gizmo is cleared on unmount
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [
    viewerRef, 
    onModelSelect, 
    clearHighlight, 
    gizmoRef, 
    onInstanceTreeSelect, 
    sceneOrigin, // Added sceneOrigin as it's passed to useCesiumGizmo
    sceneId,     // Added sceneId as it's passed to useCesiumGizmo
    setupGizmo,  // Dependency from useCesiumGizmo
    clearGizmo,  // Dependency from useCesiumGizmo
    toggleGizmoMode // Dependency from useCesiumGizmo
  ]);

  // Expose functions that might be needed externally
  const externalClearHighlight = clearHighlight;

  return { externalClearHighlight, clearGizmo, toggleGizmoMode, setupGizmo };
};