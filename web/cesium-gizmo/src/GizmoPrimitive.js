/**
 *description: Custom primitive to draw the gizmo.
 *last modified time: 2023-12-24
 *Copyright (c) 2023 ZHENG WENYI
 */

import polylineFrag from './polyline.frag.js';
import polylineVert from './polyline.vert.js';
import { getScaleForMinimumSize } from './GizmoUtil.js';
import { Mode } from './CesiumGizmo.js';
import * as Cesium from 'cesium';
class GizmoPrimitive {
  constructor(viewer, options = {}) {
    this.viewer = viewer;

    this.xColor = Cesium.defaultValue(options.xColor, Cesium.Color.RED);
    this.yColor = Cesium.defaultValue(options.yColor, Cesium.Color.GREEN);
    this.zColor = Cesium.defaultValue(options.zColor, Cesium.Color.BLUE);
    this.highlightColor = Cesium.defaultValue(
      options.highlightColor,
      Cesium.Color.YELLOW
    );
    this.highlightedType = null;

    this.mode = Cesium.defaultValue(options.mode, Mode.TRANSLATE);
    this.width = Cesium.defaultValue(options.width, 10);
    this.length = Cesium.defaultValue(options.length, 300); // axis length
    this.show = Cesium.defaultValue(options.show, true);

    this.modelMatrix = Cesium.defaultValue(
      options.modelMatrix,
      new Cesium.Matrix4()
    );

    this._rawRenderState = Cesium.Appearance.getDefaultRenderState(
      false,
      false,
      {
        depthTest: {
          enabled: false,
        },
      }
    );

    this._scaledMatrix = new Cesium.Matrix4();
    this._scale = 1;

    this._planesBatchTable = undefined;
    this._axesBatchTable = undefined;

    this.viewer.scene.primitives.add(this);
  }

  update(frameState) {
    if (!this.show) {
      return;
    }

    this._scale = getScaleForMinimumSize(this, frameState);

    // fix gizmo's screen size
    this._scaledMatrix = Cesium.Matrix4.multiplyByUniformScale(
      this.modelMatrix,
      this._scale,
      new Cesium.Matrix4()
    );

    if (!this._planesBatchTable || !this._axesBatchTable) {
      this._createBatchTables(frameState.context);
    }

    if (this.mode === Mode.TRANSLATE || this.mode === Mode.SCALE) {
      this._planesBatchTable.update(frameState);
      this._axesBatchTable.update(frameState);

      const drawPlanes = this._createDrawPlanesCommand(frameState.context);
      frameState.commandList.push(drawPlanes);

      const drawAxes = this._createDrawAxesCommand(frameState.context);
      frameState.commandList.push(drawAxes);
    } else if (this.mode === Mode.UNIFORM_SCALE) {
      this._axesBatchTable.update(frameState);

      const drawAxes = this._createDrawAxesCommand(frameState.context);
      frameState.commandList.push(drawAxes);
    } else if (this.mode === Mode.ROTATE) {
      this._axesBatchTable.update(frameState);

      const drawCircles = this._createDrawCirclesCommand(frameState.context);
      frameState.commandList.push(drawCircles);
    }
  }

  isDestroyed() {
    return false;
  }

  destroy() {
    this.viewer.scene.primitives.remove(this);
    return Cesium.destroyObject(this);
  }

  _createBatchTables(context) {
    this._axesBatchTable = new Cesium.BatchTable(
      context,
      [
        {
          functionName: 'getPickColor',
          componentDatatype: Cesium.ComponentDatatype.UNSIGNED_BYTE,
          componentsPerAttribute: 4,
          normalize: true,
        },
      ],
      3
    );

    this._planesBatchTable = new Cesium.BatchTable(
      context,
      [
        {
          functionName: 'getPickColor',
          componentDatatype: Cesium.ComponentDatatype.UNSIGNED_BYTE,
          componentsPerAttribute: 4,
          normalize: true,
        },
      ],
      3
    );

    const primitive = this;

    const setPickColor = (batchTable, instanceIndex, type) => {
      const pickId = context.createPickId({
        primitive,
        id: {
          type,
        },
      });

      let pickColor = pickId.color;
      let color = new Cesium.Cartesian4();

      color.x = Cesium.Color.floatToByte(pickColor.red);
      color.y = Cesium.Color.floatToByte(pickColor.green);
      color.z = Cesium.Color.floatToByte(pickColor.blue);
      color.w = Cesium.Color.floatToByte(pickColor.alpha);

      batchTable.setBatchedAttribute(instanceIndex, 0, color);
    };

    //  set planes pick color
    setPickColor(this._planesBatchTable, 0, 'yzPlane');
    setPickColor(this._planesBatchTable, 1, 'xzPlane');
    setPickColor(this._planesBatchTable, 2, 'xyPlane');

    // set axes pick color
    setPickColor(this._axesBatchTable, 0, 'xAxis');
    setPickColor(this._axesBatchTable, 1, 'yAxis');
    setPickColor(this._axesBatchTable, 2, 'zAxis');
  }

  _createDrawPlanesCommand(context) {
    const geometry = new Cesium.Geometry({
      attributes: {
        position: new Cesium.GeometryAttribute({
          componentDatatype: Cesium.ComponentDatatype.DOUBLE,
          componentsPerAttribute: 3,
          values: new Float64Array([
            // yz
            0, 0.4, 0.4, 0, 0.6, 0.4, 0, 0.6, 0.6, 0, 0.4, 0.6,
            // xz
            0.4, 0, 0.4, 0.6, 0, 0.4, 0.6, 0, 0.6, 0.4, 0, 0.6,
            // xy
            0.4, 0.4, 0, 0.6, 0.4, 0, 0.6, 0.6, 0, 0.4, 0.6, 0,
          ]),
        }),
        batchId: new Cesium.GeometryAttribute({
          componentDatatype: Cesium.ComponentDatatype.FLOAT,
          componentsPerAttribute: 1,
          values: new Float32Array([
            // yz
            0, 0, 0, 0,
            // xz
            1, 1, 1, 1,
            // xy
            2, 2, 2, 2,
          ]),
        }),
      },
      indices: new Uint16Array([
        //
        0, 1, 2, 0, 2, 3,
        //
        4, 5, 6, 4, 6, 7,
        //
        8, 9, 10, 8, 10, 11,
      ]),
    });

    const attributeLocations = {
      position: 0,
      batchId: 1,
    };

    const { xColor, yColor, zColor, highlightColor, highlightedType } = this;

    const uniformMap = {
      u_xColor() {
        return highlightedType === 'yzPlane' ? highlightColor : xColor;
      },
      u_yColor() {
        return highlightedType === 'xzPlane' ? highlightColor : yColor;
      },
      u_zColor() {
        return highlightedType === 'xyPlane' ? highlightColor : zColor;
      },
    };

    let vertexShaderSource = `
        uniform vec4 u_xColor;
        uniform vec4 u_yColor;
        uniform vec4 u_zColor;

        in vec3 position;
        in float batchId;

        out vec4 v_pickColor;
        out vec4 v_color;

        void main() {

          gl_Position = czm_modelViewProjection * vec4(position, 1.);

          v_pickColor = getPickColor(batchId);

          v_color = batchId == 0.? u_xColor : batchId == 1.? u_yColor :u_zColor;
        }
      `;

    vertexShaderSource =
      this._planesBatchTable.getVertexShaderCallback()(vertexShaderSource);

    let fragmentShaderSource = `
        in vec4 v_pickColor;
        in vec4 v_color;
        // out vec4 outColor;

        void main() {
          out_FragColor  = v_color;
        }
      `;

    const shaderProgram = Cesium.ShaderProgram.fromCache({
      context,
      vertexShaderSource,
      fragmentShaderSource,
      attributeLocations,
    });

    const renderState = Cesium.RenderState.fromCache(this._rawRenderState);
    const vertexArray = Cesium.VertexArray.fromGeometry({
      context,
      geometry,
      attributeLocations,
      bufferUsage: Cesium.BufferUsage.STATIC_DRAW,
    });

    const drawCommand = new Cesium.DrawCommand({
      owner: this,
      vertexArray,
      shaderProgram,
      renderState,
      primitiveType: Cesium.PrimitiveType.TRIANGLES,
      uniformMap: this._planesBatchTable.getUniformMapCallback()(uniformMap),
      modelMatrix: this._scaledMatrix,
      // framebuffer: this.framebuffer,
      pass: Cesium.Pass.OPAQUE,
      pickId: 'v_pickColor',
    });

    return drawCommand;
  }

  _createDrawAxesCommand(context) {
    const { width } = this;

    const widthToUse = width / 0.3;

    const geometry = new Cesium.Geometry({
      attributes: {
        position: new Cesium.GeometryAttribute({
          componentDatatype: Cesium.ComponentDatatype.DOUBLE,
          componentsPerAttribute: 3,
          values: new Float64Array([
            // x
            0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0,
            // y
            0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0,
            // z
            0, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0,
          ]),
        }),
        prevPosition: new Cesium.GeometryAttribute({
          componentDatatype: Cesium.ComponentDatatype.DOUBLE,
          componentsPerAttribute: 3,
          values: new Float64Array([
            // x
            -1, 0, 0, 0, 0, 0, 0, 0, 0, -1, 0, 0,
            // y
            0, -1, 0, 0, 0, 0, 0, 0, 0, 0, -1, 0,
            // z
            0, 0, -1, 0, 0, 0, 0, 0, 0, 0, 0, -1,
          ]),
        }),
        nextPosition: new Cesium.GeometryAttribute({
          componentDatatype: Cesium.ComponentDatatype.DOUBLE,
          componentsPerAttribute: 3,
          values: new Float64Array([
            // x
            1, 0, 0, 2, 0, 0, 2, 0, 0, 1, 0, 0,
            // y
            0, 1, 0, 0, 2, 0, 0, 2, 0, 0, 1, 0,
            // z
            0, 0, 1, 0, 0, 2, 0, 0, 2, 0, 0, 1,
          ]),
        }),
        expandAndWidth: new Cesium.GeometryAttribute({
          componentDatatype: Cesium.ComponentDatatype.FLOAT,
          componentsPerAttribute: 2,
          values: new Float32Array([
            // x
            -1,
            widthToUse,
            -1,
            -widthToUse,
            1,
            -widthToUse,
            1,
            widthToUse,
            // y
            -1,
            widthToUse,
            -1,
            -widthToUse,
            1,
            -widthToUse,
            1,
            widthToUse,
            // z
            -1,
            widthToUse,
            -1,
            -widthToUse,
            1,
            -widthToUse,
            1,
            widthToUse,
          ]),
        }),
        st: new Cesium.GeometryAttribute({
          componentDatatype: Cesium.ComponentDatatype.FLOAT,
          componentsPerAttribute: 2,
          values: new Float32Array([
            // x
            0, 0, 1, 0, 1, 1, 0, 1,
            // y
            0, 0, 1, 0, 1, 1, 0, 1,
            // z
            0, 0, 1, 0, 1, 1, 0, 1,
          ]),
        }),
        batchId: new Cesium.GeometryAttribute({
          componentDatatype: Cesium.ComponentDatatype.FLOAT,
          componentsPerAttribute: 1,
          values: new Float32Array([
            // x
            0, 0, 0, 0,
            // y
            1, 1, 1, 1,
            // z
            2, 2, 2, 2,
          ]),
        }),
      },
      indices: new Uint16Array([
        // x
        0, 1, 2, 0, 2, 3,
        // y
        4, 5, 6, 4, 6, 7,
        // z
        8, 9, 10, 8, 10, 11,
      ]),
    });

    Cesium.GeometryPipeline.encodeAttribute(
      geometry,
      'position',
      'position3DHigh',
      'position3DLow'
    );

    Cesium.GeometryPipeline.encodeAttribute(
      geometry,
      'prevPosition',
      'prevPosition3DHigh',
      'prevPosition3DLow'
    );

    Cesium.GeometryPipeline.encodeAttribute(
      geometry,
      'nextPosition',
      'nextPosition3DHigh',
      'nextPosition3DLow'
    );

    const attributeLocations =
      Cesium.GeometryPipeline.createAttributeLocations(geometry);

    const { xColor, yColor, zColor, highlightColor, highlightedType, mode } =
      this;

    let uniformMap;

    if (mode === Mode.UNIFORM_SCALE) {
      uniformMap = {
        u_xColor() {
          return highlightedType ? highlightColor : xColor;
        },
        u_yColor() {
          return highlightedType ? highlightColor : yColor;
        },
        u_zColor() {
          return highlightedType ? highlightColor : zColor;
        },
        u_type() {
          return mode === Mode.TRANSLATE ? 0 : 1;
        },
      };
    } else {
      uniformMap = {
        u_xColor() {
          return highlightedType === 'xAxis' ? highlightColor : xColor;
        },
        u_yColor() {
          return highlightedType === 'yAxis' ? highlightColor : yColor;
        },
        u_zColor() {
          return highlightedType === 'zAxis' ? highlightColor : zColor;
        },
        u_type() {
          return mode === Mode.TRANSLATE ? 0 : 1;
        },
      };
    }

    let vertexShaderSource = polylineVert;

    vertexShaderSource =
      this._axesBatchTable.getVertexShaderCallback()(vertexShaderSource);

    let fragmentShaderSource = polylineFrag;

    const shaderProgram = Cesium.ShaderProgram.fromCache({
      context,
      vertexShaderSource,
      fragmentShaderSource,
      attributeLocations,
    });

    const renderState = Cesium.RenderState.fromCache(this._rawRenderState);
    const vertexArray = Cesium.VertexArray.fromGeometry({
      context,
      geometry,
      attributeLocations,
      bufferUsage: Cesium.BufferUsage.STATIC_DRAW,
    });

    const drawCommand = new Cesium.DrawCommand({
      owner: this,
      vertexArray,
      shaderProgram,
      renderState,
      primitiveType: Cesium.PrimitiveType.TRIANGLES,
      uniformMap: this._axesBatchTable.getUniformMapCallback()(uniformMap),
      modelMatrix: this._scaledMatrix,
      // framebuffer: this.framebuffer,
      pass: Cesium.Pass.TRANSLUCENT,
      pickId: 'v_pickColor',
      boundingVolume: new Cesium.BoundingSphere(
        Cesium.Matrix4.getTranslation(
          this.modelMatrix,
          new Cesium.Cartesian3()
        ),
        this._scale
      ),
    });

    return drawCommand;
  }

  _createDrawCirclesCommand(context) {
    const counts = 64;

    const xpoints = [],
      ypoints = [],
      zpoints = [];
    for (let i = 0; i <= counts; i += 1) {
      xpoints.push(
        Cesium.Matrix3.multiplyByVector(
          Cesium.Matrix3.fromRotationX((i * (2 * Cesium.Math.PI)) / counts),
          Cesium.Cartesian3.UNIT_Y,
          new Cesium.Cartesian3()
        )
      );

      ypoints.push(
        Cesium.Matrix3.multiplyByVector(
          Cesium.Matrix3.fromRotationY((i * (2 * Cesium.Math.PI)) / counts),
          Cesium.Cartesian3.UNIT_Z,
          new Cesium.Cartesian3()
        )
      );

      zpoints.push(
        Cesium.Matrix3.multiplyByVector(
          Cesium.Matrix3.fromRotationZ((i * (2 * Cesium.Math.PI)) / counts),
          Cesium.Cartesian3.UNIT_X,
          new Cesium.Cartesian3()
        )
      );
    }

    const xAxisPolyline = new Cesium.PolylineGeometry({
      positions: xpoints,
      width: this.width / 2,
      arcType: Cesium.ArcType.NONE,
    });
    const yAxisPolyline = new Cesium.PolylineGeometry({
      positions: ypoints,
      width: this.width / 2,
      arcType: Cesium.ArcType.NONE,
    });
    const zAxisPolyline = new Cesium.PolylineGeometry({
      positions: zpoints,
      width: this.width / 2,
      arcType: Cesium.ArcType.NONE,
    });

    const xAxisGeometry = Cesium.PolylineGeometry.createGeometry(xAxisPolyline);
    const yAxisGeometry = Cesium.PolylineGeometry.createGeometry(yAxisPolyline);
    const zAxisGeometry = Cesium.PolylineGeometry.createGeometry(zAxisPolyline);

    const mergeAttrirbutes = (attributeName) => {
      const xAttr = xAxisGeometry.attributes[attributeName];
      const yAttr = yAxisGeometry.attributes[attributeName];
      const zAttr = zAxisGeometry.attributes[attributeName];

      const { componentDatatype, componentsPerAttribute } = xAttr;
      const xValues = xAttr.values;
      const yValues = yAttr.values;
      const zValues = zAttr.values;

      const length = xValues.length;

      const newValues =
        componentDatatype === Cesium.ComponentDatatype.DOUBLE
          ? new Float64Array(length * 3)
          : new Float32Array(length * 3);

      newValues.set(xValues, 0);
      newValues.set(yValues, length);
      newValues.set(zValues, length * 2);

      return new Cesium.GeometryAttribute({
        componentDatatype,
        componentsPerAttribute,
        values: newValues,
      });
    };

    const vertexLength = xAxisGeometry.attributes.position.values.length / 3;
    const batchIds = new Array(vertexLength)
      .fill(0)
      .concat(new Array(vertexLength).fill(1))
      .concat(new Array(vertexLength).fill(2));

    const indicesLength = xAxisGeometry.indices.length;
    const newIndices = new Uint16Array(indicesLength * 3);
    newIndices.set(xAxisGeometry.indices, 0);

    for (let i = 0; i < indicesLength; i += 1) {
      newIndices[i + indicesLength] = newIndices[i] + vertexLength;
      newIndices[i + indicesLength * 2] = newIndices[i] + vertexLength * 2;
    }

    const geometry = new Cesium.Geometry({
      attributes: {
        position: mergeAttrirbutes('position'),
        prevPosition: mergeAttrirbutes('prevPosition'),
        nextPosition: mergeAttrirbutes('nextPosition'),
        expandAndWidth: mergeAttrirbutes('expandAndWidth'),
        st: mergeAttrirbutes('st'),
        batchId: new Cesium.GeometryAttribute({
          componentDatatype: Cesium.ComponentDatatype.FLOAT,
          componentsPerAttribute: 1,
          values: new Float32Array(batchIds),
        }),
      },
      indices: newIndices,
    });

    Cesium.GeometryPipeline.encodeAttribute(
      geometry,
      'position',
      'position3DHigh',
      'position3DLow'
    );

    Cesium.GeometryPipeline.encodeAttribute(
      geometry,
      'prevPosition',
      'prevPosition3DHigh',
      'prevPosition3DLow'
    );

    Cesium.GeometryPipeline.encodeAttribute(
      geometry,
      'nextPosition',
      'nextPosition3DHigh',
      'nextPosition3DLow'
    );

    const attributeLocations =
      Cesium.GeometryPipeline.createAttributeLocations(geometry);

    const { xColor, yColor, zColor, highlightColor, highlightedType } = this;

    const uniformMap = {
      u_xColor() {
        return highlightedType === 'xAxis' ? highlightColor : xColor;
      },
      u_yColor() {
        return highlightedType === 'yAxis' ? highlightColor : yColor;
      },
      u_zColor() {
        return highlightedType === 'zAxis' ? highlightColor : zColor;
      },
    };

    let vertexShaderSource = polylineVert;

    vertexShaderSource =
      this._axesBatchTable.getVertexShaderCallback()(vertexShaderSource);

    let fragmentShaderSource = `
        in vec4 v_pickColor;
        in vec4 v_color;

        // out vec4 outColor;

        void main() {
          out_FragColor = v_color;
        }
    `;

    const shaderProgram = Cesium.ShaderProgram.fromCache({
      context,
      vertexShaderSource,
      fragmentShaderSource,
      attributeLocations,
    });

    const renderState = Cesium.RenderState.fromCache(this._rawRenderState);
    const vertexArray = Cesium.VertexArray.fromGeometry({
      context,
      geometry,
      attributeLocations,
      bufferUsage: Cesium.BufferUsage.STATIC_DRAW,
    });

    const drawCommand = new Cesium.DrawCommand({
      owner: this,
      vertexArray,
      shaderProgram,
      renderState,
      primitiveType: Cesium.PrimitiveType.TRIANGLES,
      uniformMap: this._axesBatchTable.getUniformMapCallback()(uniformMap),
      modelMatrix: this._scaledMatrix,
      // framebuffer: this.framebuffer,
      pass: Cesium.Pass.TRANSLUCENT,
      pickId: 'v_pickColor',
      boundingVolume: new Cesium.BoundingSphere(
        Cesium.Matrix4.getTranslation(
          this.modelMatrix,
          new Cesium.Cartesian3()
        ),
        this._scale
      ),
    });

    return drawCommand;
  }
}

export default GizmoPrimitive;
