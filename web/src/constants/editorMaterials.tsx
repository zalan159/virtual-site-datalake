
import * as Cesium from 'cesium';

export interface MaterialDefinition {
  id: string;
  name: string;
  icon: JSX.Element;
  customShader: Cesium.CustomShader;
}

// 材质定义
export const editorMaterials: MaterialDefinition[] = [
  {
    id: 'red',
    name: '红色',
    icon: (
      <svg width={40} height={40} viewBox="0 0 40 40" fill="none">
        <rect x="8" y="8" width="24" height="24" rx="4" fill="#ff4d4f" stroke="#a8071a" strokeWidth="2" />
        <rect x="14" y="14" width="12" height="12" rx="2" fill="#fff1f0" stroke="#ff4d4f" strokeWidth="1.5" />
      </svg>
    ),
    customShader: new Cesium.CustomShader({
      fragmentShaderText: `
        void fragmentMain(FragmentInput fsInput, inout czm_modelMaterial material) {
          material.diffuse = vec3(1.0, 0.0, 0.0);
        }
      `
    })
  },
  // 可以添加更多材质...
];

export default editorMaterials; 