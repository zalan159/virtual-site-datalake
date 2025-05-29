declare module '../../cesium-gizmo/src/CesiumGizmo.js' {
  class CesiumGizmo {
    constructor(viewer: any, options: {
      item: any;
      mode: number;
      onDragEnd?: (data: {type: any, result: any}) => void;
    });
    
    static Mode: {
      TRANSLATE: number;
      ROTATE: number;
      SCALE: number;
    };
    
    destroy(): void;
    item: any;
  }
  
  export default CesiumGizmo;
} 