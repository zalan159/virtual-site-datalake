import * as Cesium from 'cesium';

function getScaleInPixels(positionWC, radius, frameState) {
  const scratchBoundingSphere = new Cesium.BoundingSphere();
  scratchBoundingSphere.center = positionWC;
  scratchBoundingSphere.radius = radius;
  return frameState.camera.getPixelSize(
    scratchBoundingSphere,
    frameState.context.drawingBufferWidth,
    frameState.context.drawingBufferHeight
  );
}

function getScaleForMinimumSize(model, frameState) {
  const scratchPosition = new Cesium.Cartesian3();
  const scratchCartographic = new Cesium.Cartographic();

  // Compute size of bounding sphere in pixels
  const context = frameState.context;
  const maxPixelSize = Math.max(
    context.drawingBufferWidth,
    context.drawingBufferHeight
  );
  const m = model.modelMatrix;
  scratchPosition.x = m[12];
  scratchPosition.y = m[13];
  scratchPosition.z = m[14];

  if (frameState.camera._scene.mode !== Cesium.SceneMode.SCENE3D) {
    const projection = frameState.mapProjection;
    const cartographic = projection.ellipsoid.cartesianToCartographic(
      scratchPosition,
      scratchCartographic
    );
    projection.project(cartographic, scratchPosition);
    Cesium.Cartesian3.fromElements(
      scratchPosition.z,
      scratchPosition.x,
      scratchPosition.y,
      scratchPosition
    );
  }

  const radius = 1;

  const metersPerPixel = getScaleInPixels(scratchPosition, radius, frameState);

  // metersPerPixel is always > 0.0
  const pixelsPerMeter = 1.0 / metersPerPixel;
  const diameterInPixels = Math.min(
    pixelsPerMeter * 2.0 * radius,
    maxPixelSize
  );

  let scale = 1;
  // Maintain model's minimum pixel size
  if (diameterInPixels < model.length) {
    scale = (model.length * metersPerPixel) / (2.0 * radius);
  }

  // console.log(scale)

  return scale;
}

function getScaleFromTransform(m) {
  const scalex = Math.sqrt(m[0] * m[0] + m[1] * m[1] + m[2] * m[2]);
  const scaley = Math.sqrt(m[4] * m[4] + m[5] * m[5] + m[6] * m[6]);
  const scalez = Math.sqrt(m[8] * m[8] + m[9] * m[9] + m[10] * m[10]);
  return [scalex, scaley, scalez];
}

// modified from Cesium PolylineArrowMaterial.glsl, change the arrow to a rectangle
const POLYLINE_RECTANGLE = new Cesium.Material({
  fabric: {
    uniforms: {
      color: Cesium.Color.WHITE,
    },
    source: `
      uniform vec4 color;

      czm_material czm_getMaterial(czm_materialInput materialInput)
      {
          czm_material material = czm_getDefaultMaterial(materialInput);

          vec2 st = materialInput.st;

          float base = 1.0 - abs(fwidth(st.s)) * 10.0 * czm_pixelRatio;


          vec2 center = vec2(1.0, 0.5);
          float ptOnUpperLine = 1.0;
          float ptOnLowerLine = 0.0;

          float halfWidth = 0.15;
          float s = step(0.5 - halfWidth, st.t);
          s *= 1.0 - step(0.5 + halfWidth, st.t);
          s *= 1.0 - step(base, st.s);

          float t = step(base, materialInput.st.s);
          t *= 1.0 - step(ptOnUpperLine, st.t);
          t *= step(ptOnLowerLine, st.t);

          // Find the distance from the closest separator (region between two colors)
          float dist;
          if (st.s < base)
          {
              float d1 = abs(st.t - (0.5 - halfWidth));
              float d2 = abs(st.t - (0.5 + halfWidth));
              dist = min(d1, d2);
          }
          else
          {
              float d1 = czm_infinity;
              if (st.t < 0.5 - halfWidth && st.t > 0.5 + halfWidth)
              {
                  d1 = abs(st.s - base);
              }
              float d2 = abs(st.t - ptOnUpperLine);
              float d3 = abs(st.t - ptOnLowerLine);
              dist = min(min(d1, d2), d3);
          }

          vec4 outsideColor = vec4(0.0);
          vec4 currentColor = mix(outsideColor, color, clamp(s + t, 0.0, 1.0));
          vec4 outColor = czm_antialias(outsideColor, color, currentColor, dist);

          outColor = czm_gammaCorrect(outColor);
          material.diffuse = outColor.rgb;
          material.alpha = outColor.a;
          return material;
      }`,
  },
});

export { getScaleForMinimumSize, getScaleFromTransform, POLYLINE_RECTANGLE };
