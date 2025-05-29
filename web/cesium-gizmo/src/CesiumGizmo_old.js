/**
 *description: A gizmo for Cesium, can be used to adjust the model's position and pose.
 The model needs a modelMatrix attribute so it should be generated as a primitive instead of an entity.

 *last modified time: 2023-12-15
 *Copyright (c) 2023 ZHENG WENYI
 */

import {
  getScaleFromTransform,
  getScaleForMinimumSize,
  POLYLINE_RECTANGLE,
} from "./GizmoUtil.js";

import VS from "./axisAppearance.vert.js";
import FS from "./axisAppearance.frag.js";

const Mode = {
  TRANSLATE: "TRANSLATE",
  ROTATE: "ROTATE",
  SCALE: "SCALE",
  UNIFORM_SCALE: "UNIFORM_SCALE",
};

function addMouseEvent(handler, viewer, scope) {
  let startPosition = new Cesium.Cartesian2(); // mouse movement start position
  let originPosition = new Cesium.Cartesian3(); // item's cartesian coordinates
  let originModelMatrix = new Cesium.Matrix4();
  let originItemModelMatrix = new Cesium.Matrix4();

  handler.setInputAction(function (movement) {
    const picked = viewer.scene.pick(movement.position);
    if (Cesium.defined(picked)) {
      if (picked.primitive !== scope) {
        if (picked.primitive.modelMatrix instanceof Cesium.Matrix4) {
          scope.item = picked.primitive;
        }
      }
    }
  }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

  handler.setInputAction(function (movement) {
    const picked = viewer.scene.pick(movement.position);
    if (Cesium.defined(picked)) {
      // console.log(picked);
      if (picked.primitive === scope) {
        startPosition = movement.position;
        const m = scope.modelMatrix;
        originPosition = new Cesium.Cartesian3(m[12], m[13], m[14]);
        originModelMatrix = scope.modelMatrix.clone();
        originItemModelMatrix = scope.item.modelMatrix.clone();

        // scope.item._allowPicking = false;
        scope.pickedId = picked.id;
        viewer.scene.screenSpaceCameraController.enableRotate = false; // lock default map control
        viewer.scene.screenSpaceCameraController.enableTranslate = false;
        if (typeof scope.onDragStart === "function") {
          scope.onDragStart();
        }
      } else {
        // if (selfPicked) scope.item._allowPicking = false;
        scope.pickedId = null;
        viewer.scene.screenSpaceCameraController.enableRotate = true; // release default map control
        viewer.scene.screenSpaceCameraController.enableTranslate = true;
      }
    }
  }, Cesium.ScreenSpaceEventType.LEFT_DOWN);

  handler.setInputAction(function () {
    if (scope.pickedId) {
      // scope.item._allowPicking = true;
      scope.xColor = Cesium.Color.RED;
      scope.yColor = Cesium.Color.GREEN;
      scope.zColor = Cesium.Color.BLUE;
      scope.pickedId = null;
      if (typeof scope.onDragEnd === "function") {
        scope.onDragEnd();
      }
      startPosition = new Cesium.Cartesian2();
      originPosition = new Cesium.Cartesian3();
      originModelMatrix = new Cesium.Matrix4();
      originItemModelMatrix = new Cesium.Matrix4();
    }

    viewer.scene.screenSpaceCameraController.enableRotate = true; // release default map control
    viewer.scene.screenSpaceCameraController.enableTranslate = true;
  }, Cesium.ScreenSpaceEventType.LEFT_UP);

  handler.setInputAction(function (movement) {
    if (!scope.pickedId) {
      const hovered = viewer.scene.pick(movement.endPosition);

      // highlight the hovered axis
      if (Cesium.defined(hovered) && hovered.primitive === scope) {
        if (!scope.hoveredId || hovered.id.type !== scope.hoveredId.type)
          scope.hoveredId = hovered.id;
        document.body.style.cursor = "pointer";
      } else {
        scope.hoveredId = null;
        document.body.style.cursor = "default";
      }

      return;
    }

    const transform = Cesium.Transforms.eastNorthUpToFixedFrame(originPosition); // east, north, up is the positive direction of x, y, z axis
    // originPosition coords on the canvas
    const originPositionOnCanvas =
      Cesium.SceneTransforms.worldToWindowCoordinates(
        viewer.scene,
        originPosition,
        new Cesium.Cartesian2()
      );
    // the mouse's movement direction
    const mouseDirection = new Cesium.Cartesian2(
      movement.endPosition.x - startPosition.x,
      movement.endPosition.y - startPosition.y
    );
    if (mouseDirection.x === 0 && mouseDirection.x === 0) return;

    const minimumScale = 0.001;

    if (scope.type === Mode.TRANSLATE) {
      const translationMatrix = new Cesium.Matrix4();

      let translation = new Cesium.Cartesian3();

      const getTranslation = (axisDirection) => {
        const translationVector = new Cesium.Cartesian3();
        Cesium.Matrix4.multiplyByPointAsVector(
          transform,
          axisDirection,
          translationVector
        );
        const targetPosition = new Cesium.Cartesian3(); // target position along the translationVector

        Cesium.Cartesian3.add(
          originPosition,
          translationVector,
          targetPosition
        );
        // target position on the canvas
        const endPositionOnCanvas =
          Cesium.SceneTransforms.worldToWindowCoordinates(
            viewer.scene,
            targetPosition,
            new Cesium.Cartesian2()
          );

        const axisDirectionOnCanvas = Cesium.Cartesian2.subtract(
          endPositionOnCanvas,
          originPositionOnCanvas,
          new Cesium.Cartesian2()
        );

        // whether the mouse is moving in the positive direction of the axis
        const angle = Cesium.Cartesian2.angleBetween(
          mouseDirection,
          axisDirectionOnCanvas
        );
        const isMouseMoveInPositive = angle < Cesium.Math.PI_OVER_TWO ? 1 : -1;

        const movePixelsAlongAxis =
          Cesium.Cartesian2.magnitude(mouseDirection) *
          Math.abs(Math.cos(angle));

        const metersPerPixel = viewer.camera.getPixelSize(
          new Cesium.BoundingSphere(
            originPosition,
            Cesium.Cartesian3.magnitude(translationVector)
          ),
          viewer.canvas.width,
          viewer.canvas.height
        );

        return Cesium.Cartesian3.multiplyByScalar(
          translationVector,
          isMouseMoveInPositive * metersPerPixel * movePixelsAlongAxis,
          new Cesium.Cartesian3()
        );
      };

      let translationOnX, translationOnY, translationOnZ;

      switch (scope.pickedId.type) {
        case "xAxis":
          translation = getTranslation(Cesium.Cartesian3.UNIT_X);
          break;
        case "yAxis":
          translation = getTranslation(Cesium.Cartesian3.UNIT_Y);
          break;
        case "zAxis":
          translation = getTranslation(Cesium.Cartesian3.UNIT_Z);
          break;
        case "yzPlane":
          translationOnY = getTranslation(Cesium.Cartesian3.UNIT_Y);

          translationOnZ = getTranslation(Cesium.Cartesian3.UNIT_Z);

          Cesium.Cartesian3.add(translationOnY, translationOnZ, translation);
          break;
        case "xzPlane":
          translationOnX = getTranslation(Cesium.Cartesian3.UNIT_X);

          translationOnZ = getTranslation(Cesium.Cartesian3.UNIT_Z);

          Cesium.Cartesian3.add(translationOnX, translationOnZ, translation);
          break;
        case "xyPlane":
          translationOnX = getTranslation(Cesium.Cartesian3.UNIT_X);

          translationOnY = getTranslation(Cesium.Cartesian3.UNIT_Y);

          Cesium.Cartesian3.add(translationOnX, translationOnY, translation);
          break;

        default:
          break;
      }

      Cesium.Matrix4.fromTranslation(translation, translationMatrix);

      const tmp = Cesium.Matrix4.multiply(
        translationMatrix,
        originModelMatrix,
        new Cesium.Matrix4()
      );

      if (isNaN(tmp[12]) || isNaN(tmp[13]) || isNaN(tmp[14])) {
        // console.warn({
        //   mouseDirection,
        //   angle,
        //   direction
        // });
        return;
      }

      // apply translation to the gizmo
      scope.modelMatrix[12] = tmp[12];
      scope.modelMatrix[13] = tmp[13];
      scope.modelMatrix[14] = tmp[14];

      if (typeof scope.onDragMoving === "function") {
        scope.onDragMoving({
          type: Mode.TRANSLATE,
          result: new Cesium.Cartesian3(tmp[12], tmp[13], tmp[14]),
        });
      }

      if (scope.applyTransformation) {
        const item = scope.item;
        item.modelMatrix[12] = tmp[12];
        item.modelMatrix[13] = tmp[13];
        item.modelMatrix[14] = tmp[14];
      }
    } else if (scope.type === Mode.ROTATE) {
      const startVector = Cesium.Cartesian2.subtract(
        new Cesium.Cartesian2(
          movement.startPosition.x,
          movement.startPosition.y
        ),
        originPositionOnCanvas,
        new Cesium.Cartesian2()
      );
      const endVector = Cesium.Cartesian2.subtract(
        new Cesium.Cartesian2(movement.endPosition.x, movement.endPosition.y),
        originPositionOnCanvas,
        new Cesium.Cartesian2()
      );

      // get the mouse movement direction
      const isCounterClockWise =
        Cesium.Cartesian2.cross(startVector, endVector) < 0 ? 1 : -1; // y axis is downwards on the canvas
      let isCameraOnPositiveAxis;
      const angle = Cesium.Cartesian2.angleBetween(startVector, endVector);
      const org2Camera = Cesium.Cartesian3.subtract(
        viewer.scene.camera.position,
        originPosition,
        new Cesium.Cartesian3()
      );

      const rotation = new Cesium.Matrix3();

      const axis = new Cesium.Cartesian3();

      switch (scope.pickedId.type) {
        case "xAxis":
          Cesium.Matrix4.multiplyByPointAsVector(
            scope.modelMatrix,
            Cesium.Cartesian3.UNIT_X,
            axis
          );
          isCameraOnPositiveAxis =
            Cesium.Cartesian3.dot(axis, org2Camera) > 0 ? 1 : -1;

          Cesium.Matrix3.fromRotationX(
            angle * isCameraOnPositiveAxis * isCounterClockWise,
            rotation
          );
          break;
        case "yAxis":
          Cesium.Matrix4.multiplyByPointAsVector(
            scope.modelMatrix,
            Cesium.Cartesian3.UNIT_Y,
            axis
          );
          isCameraOnPositiveAxis =
            Cesium.Cartesian3.dot(axis, org2Camera) > 0 ? 1 : -1;

          Cesium.Matrix3.fromRotationY(
            angle * isCameraOnPositiveAxis * isCounterClockWise,
            rotation
          );
          break;
        case "zAxis":
          Cesium.Matrix4.multiplyByPointAsVector(
            scope.modelMatrix,
            Cesium.Cartesian3.UNIT_Z,
            axis
          );
          isCameraOnPositiveAxis =
            Cesium.Cartesian3.dot(axis, org2Camera) > 0 ? 1 : -1;

          Cesium.Matrix3.fromRotationZ(
            angle * isCameraOnPositiveAxis * isCounterClockWise,
            rotation
          );
          break;
        default:
          break;
      }

      // apply rotation to the gizmo, modelMatrix includes the translation
      Cesium.Matrix4.multiplyByMatrix3(
        scope.modelMatrix,
        rotation,
        scope.modelMatrix
      );
      // now scope.modelMatrix = T x R

      const scaleValue = getScaleFromTransform(scope.item.modelMatrix);

      // calculate the item's new modelMatrix
      // finalTransform = T x R x S,
      const finalTransform = Cesium.Matrix4.multiply(
        scope.modelMatrix,
        Cesium.Matrix4.fromScale(
          new Cesium.Cartesian3(scaleValue[0], scaleValue[1], scaleValue[2])
        ),
        new Cesium.Matrix4()
      );

      if (typeof scope.onDragMoving === "function") {
        scope.onDragMoving({
          type: Mode.ROTATE,
          result:
            Cesium.Transforms.fixedFrameToHeadingPitchRoll(finalTransform),
        });
      }

      if (scope.applyTransformation) {
        Cesium.Matrix4.clone(finalTransform, scope.item.modelMatrix);
      }
    } else if (scope.type === Mode.SCALE) {
      const oldScale = getScaleFromTransform(originItemModelMatrix);
      const scaleMatrix = Cesium.Matrix4.fromScale(
        new Cesium.Cartesian3(1, 1, 1),
        new Cesium.Matrix4()
      );
      let scaleValue = 1;

      const getScaleValue = (axisDirection) => {
        let result = 1;
        const targetPosition = new Cesium.Cartesian3(); // target position along the axis direction
        const endPositionOnCanvas = new Cesium.Cartesian2();
        const axisDirectionOnCanvas = new Cesium.Cartesian2();

        Cesium.Matrix4.multiplyByPoint(
          scope.modelMatrix, // scope.modelMatrix includes translation and rotation
          axisDirection,
          targetPosition
        );

        Cesium.SceneTransforms.worldToWindowCoordinates(
          viewer.scene,
          targetPosition,
          endPositionOnCanvas
        );

        Cesium.Cartesian2.subtract(
          endPositionOnCanvas,
          originPositionOnCanvas,
          axisDirectionOnCanvas
        );

        result =
          Cesium.Cartesian2.dot(axisDirectionOnCanvas, mouseDirection) > 0
            ? 1.01
            : 0.99;
        result = result ** Cesium.Cartesian2.magnitude(mouseDirection);

        return result;
      };

      switch (scope.pickedId.type) {
        case "xAxis":
          scaleValue = getScaleValue(Cesium.Cartesian3.UNIT_X);
          if (oldScale[0] <= minimumScale && scaleValue < 1) return;

          Cesium.Matrix4.fromScale(
            new Cesium.Cartesian3(scaleValue, 1, 1),
            scaleMatrix
          );

          break;
        case "yAxis":
          scaleValue = getScaleValue(Cesium.Cartesian3.UNIT_Y);
          if (oldScale[1] <= minimumScale && scaleValue < 1) return;

          Cesium.Matrix4.fromScale(
            new Cesium.Cartesian3(1, scaleValue, 1),
            scaleMatrix
          );

          break;
        case "zAxis":
          scaleValue = getScaleValue(Cesium.Cartesian3.UNIT_Z);
          if (oldScale[2] <= minimumScale && scaleValue < 1) return;

          Cesium.Matrix4.fromScale(
            new Cesium.Cartesian3(1, 1, scaleValue),
            scaleMatrix
          );
          break;
        case "xyPlane":
          scaleValue = getScaleValue(new Cesium.Cartesian3(1, 1, 0));
          if (
            (oldScale[0] <= minimumScale || oldScale[1] <= minimumScale) &&
            scaleValue < 1
          )
            return;

          Cesium.Matrix4.fromScale(
            new Cesium.Cartesian3(scaleValue, scaleValue, 1),
            scaleMatrix
          );
          break;
        case "xzPlane":
          scaleValue = getScaleValue(new Cesium.Cartesian3(1, 0, 1));
          if (
            (oldScale[0] <= minimumScale || oldScale[2] <= minimumScale) &&
            scaleValue < 1
          )
            return;

          Cesium.Matrix4.fromScale(
            new Cesium.Cartesian3(scaleValue, 1, scaleValue),
            scaleMatrix
          );
          break;
        case "yzPlane":
          scaleValue = getScaleValue(new Cesium.Cartesian3(0, 1, 1));
          if (
            (oldScale[1] <= minimumScale || oldScale[2] <= minimumScale) &&
            scaleValue < 1
          )
            return;

          Cesium.Matrix4.fromScale(
            new Cesium.Cartesian3(1, scaleValue, scaleValue),
            scaleMatrix
          );
          break;
        default:
          break;
      }

      const finalTransform = Cesium.Matrix4.multiply(
        originItemModelMatrix,
        scaleMatrix,
        new Cesium.Matrix4()
      );

      if (typeof scope.onDragMoving === "function") {
        scope.onDragMoving({
          type: Mode.SCALE,
          result: getScaleFromTransform(finalTransform),
        });
      }

      if (scope.applyTransformation) {
        Cesium.Matrix4.clone(finalTransform, scope.item.modelMatrix);
      }
    } else if (scope.type === Mode.UNIFORM_SCALE) {
      const oldScale = getScaleFromTransform(scope.item.modelMatrix);

      const mouseMovingDirectionOnCanvas = Cesium.Cartesian2.subtract(
        new Cesium.Cartesian2(startPosition.x, startPosition.y),
        originPositionOnCanvas,
        new Cesium.Cartesian2()
      );

      // whether the mouse is moving outwards
      let scale =
        Cesium.Cartesian2.dot(mouseMovingDirectionOnCanvas, mouseDirection) > 0
          ? 1.01
          : 0.99;
      scale = scale ** Cesium.Cartesian2.magnitude(mouseDirection);

      if (oldScale[0] <= minimumScale && scale < 1) return;

      const scaleMatrix = Cesium.Matrix4.fromUniformScale(
        scale,
        new Cesium.Matrix4()
      );

      const finalTransform = Cesium.Matrix4.multiply(
        originItemModelMatrix,
        scaleMatrix,
        new Cesium.Matrix4()
      );

      if (typeof scope.onDragMoving === "function") {
        scope.onDragMoving({
          type: Mode.UNIFORM_SCALE,
          result: getScaleFromTransform(finalTransform),
        });
      }

      if (scope.applyTransformation) {
        Cesium.Matrix4.clone(finalTransform, scope.item.modelMatrix);
      }
    }
  }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);
}

/**
 *
 *
 * @alias CesiumGizmo
 * @constructor
 *
 * @param {Object} [options] Object with the following properties:
 * @param {Number} [options.length=300.0] The length of the axes in pixels.
 * @param {Number} [options.width=20] The width of the axes in pixels.
 * @param {Cesium.Matrix4} [options.modelMatrix=Cesium.Matrix4.IDENTITY] The 4x4 matrix that defines the gizmo's reference frame.
 * @param {Boolean} [options.show=true] Determines if the gizmo will be shown.
 * @param {Cesium.Color} [options.xColor=Cesium.Color.RED] Color for axis x.
 * @param {Cesium.Color} [options.yColor=Cesium.Color.GREEN] Color for axis y.
 * @param {Cesium.Color} [options.zColor=Cesium.Color.BLUE] Color for axis z.
 * @param {Cesium.Color} [options.highlightColor=Cesium.Color.YELLOW] Color for axis highlighted.
 *
 * @example
 * primitives.add(new Cesium.CesiumGizmo({
 *   modelMatrix : primitive.modelMatrix,  // primitive to debug
 *   length : 300.0,
 *   width : 20.0
 * }));
 */
function CesiumGizmo(options) {
  options = Cesium.defaultValue(options, Cesium.defaultValue.EMPTY_OBJECT);

  if (!Cesium.defined(options.viewer))
    new Cesium.DeveloperError("Viewer must be assigned!");
  if (Cesium.defined(options.item) && !Cesium.defined(options.item.modelMatrix))
    new Cesium.DeveloperError("Item must have the modelMatrix attribute!");

  this.viewer = options.viewer;
  this.item = options.item;
  this._item = options.item;

  /**
   * The length of the axes in meters.
   *
   * @type {Number}
   * @default 300.0
   */
  this.length = Cesium.defaultValue(options.length, 300.0);
  this._length = undefined;

  /**
   * The width of the axes in pixels.
   *
   * @type {Number}
   * @default 20
   */
  this.width = Cesium.defaultValue(options.width, 20);
  this._width = undefined;

  /**
   * Determines if this primitive will be shown.
   *
   * @type Boolean
   * @default true
   */
  this.show = Cesium.defaultValue(options.show, true);

  this.type = Cesium.defaultValue(options.type, Mode.TRANSLATE);
  this._type = undefined;

  this.xColor = Cesium.defaultValue(options.xColor, Cesium.Color.RED);
  this._xColor = undefined;
  this._xOriginColor = this.xColor;
  this.yColor = Cesium.defaultValue(options.yColor, Cesium.Color.GREEN);
  this._yColor = undefined;
  this._yOriginColor = this.yColor;
  this.zColor = Cesium.defaultValue(options.zColor, Cesium.Color.BLUE);
  this._zColor = undefined;
  this._zOriginColor = this.zColor;

  this.highlightColor = Cesium.defaultValue(
    options.highlightColor,
    Cesium.Color.YELLOW
  );
  this._highlightColor = undefined;

  this.pickedId = null;
  this.hoveredId = undefined;
  this._hoveredId = undefined;

  this._primitives = new Cesium.PrimitiveCollection();

  this.applyTransformation = Cesium.defaultValue(options.applyTransformation, true);

  this.onDragMoving = options.onDragMoving;
  this.onDragStart = options.onDragStart;
  this.onDragEnd = options.onDragEnd;

  this.handler = new Cesium.ScreenSpaceEventHandler(this.viewer.canvas);

  this.viewer.scene.primitives.add(this);

  addMouseEvent(this.handler, this.viewer, this);
}

/**
 * @private
 */
CesiumGizmo.prototype.update = function (frameState) {
  if (!this.show) {
    return;
  }

  if (!this.item || !this.item.modelMatrix) {
    if (Cesium.defined(this._primitives)) {
      this._primitives.removeAll();
    }

    return;
  }

  if (
    this._length !== this.length ||
    this._width !== this.width ||
    this._xColor !== this.xColor ||
    this._yColor !== this.yColor ||
    this._zColor !== this.zColor ||
    this._type !== this.type ||
    this._highlightColor !== this.highlightColor ||
    this._hoveredId !== this.hoveredId ||
    this._item !== this.item
  ) {
    if (this.type === Mode.TRANSLATE) {
      // reset the axes' direction to make them point to east, north and up
      const m = this.item.modelMatrix;
      const itemPos = new Cesium.Cartesian3(m[12], m[13], m[14]);
      this.modelMatrix = Cesium.Transforms.eastNorthUpToFixedFrame(itemPos);
    } else if (
      this.type === Mode.ROTATE ||
      this.type === Mode.SCALE ||
      this.type === Mode.UNIFORM_SCALE
    ) {
      const m = this.item.modelMatrix.clone();
      const scale = getScaleFromTransform(m);

      // remove scale but keep translation and rotation
      // scale can't be zero
      if (scale[0] === 0 || scale[1] === 0 || scale[2] === 0) {
        new Cesium.DeveloperError(
          "Can't get transform infomation from item's modelMatrix since the scaling is 0."
        );
      }
      m[0] /= scale[0];
      m[1] /= scale[0];
      m[2] /= scale[0];
      m[4] /= scale[1];
      m[5] /= scale[1];
      m[6] /= scale[1];
      m[8] /= scale[2];
      m[9] /= scale[2];
      m[10] /= scale[2];

      this.modelMatrix = m;
    } else {
      if (Cesium.defined(this._primitives)) {
        this._primitives.removeAll();
      }
      return;
    }

    this._length = this.length;
    this._width = this.width;
    this._xColor = this.xColor;
    this._yColor = this.yColor;
    this._zColor = this.zColor;
    this._type = this.type;
    this._highlightColor = this.highlightColor;
    this._hoveredId = this.hoveredId;

    // remove the old
    if (Cesium.defined(this._primitives)) {
      this._primitives.removeAll();
    }

    // workaround projecting (0, 0, 0)
    if (
      this.modelMatrix[12] === 0.0 &&
      this.modelMatrix[13] === 0.0 &&
      this.modelMatrix[14] === 0.0
    ) {
      this.modelMatrix[14] = 0.01;
    }

    const axisMatrix = Cesium.Matrix4.IDENTITY.clone();
    axisMatrix[14] = 0.01;

    let material,
      xpoints = [],
      ypoints = [],
      zpoints = [];

    // generate axes geometry points
    if (
      this.type === Mode.TRANSLATE ||
      this.type === Mode.SCALE ||
      this.type === Mode.UNIFORM_SCALE
    ) {
      material = Cesium.Material.fromType("PolylineArrow");
      xpoints = [Cesium.Cartesian3.ZERO, Cesium.Cartesian3.UNIT_X];
      ypoints = [Cesium.Cartesian3.ZERO, Cesium.Cartesian3.UNIT_Y];
      zpoints = [Cesium.Cartesian3.ZERO, Cesium.Cartesian3.UNIT_Z];
      if (this.type !== Mode.TRANSLATE) {
        material = POLYLINE_RECTANGLE;
      }
    } else if (this.type === Mode.ROTATE) {
      // make three circles
      material = Cesium.Material.fromType("Color", {
        color: Cesium.Color.WHITE,
      });

      const counts = 64;
      for (let i = 0; i <= counts; i += 1) {
        xpoints.push(
          Cesium.Matrix3.multiplyByVector(
            Cesium.Matrix3.fromRotationX((i * (2 * Cesium.Math.PI)) / counts),
            Cesium.Cartesian3.UNIT_Y,
            new Cesium.Cartesian3()
          )
        );
      }
      for (let i = 0; i <= counts; i += 1) {
        ypoints.push(
          Cesium.Matrix3.multiplyByVector(
            Cesium.Matrix3.fromRotationY((i * (2 * Cesium.Math.PI)) / counts),
            Cesium.Cartesian3.UNIT_Z,
            new Cesium.Cartesian3()
          )
        );
      }
      for (let i = 0; i <= counts; i += 1) {
        zpoints.push(
          Cesium.Matrix3.multiplyByVector(
            Cesium.Matrix3.fromRotationZ((i * (2 * Cesium.Math.PI)) / counts),
            Cesium.Cartesian3.UNIT_X,
            new Cesium.Cartesian3()
          )
        );
      }
    }

    const width = this.type === Mode.ROTATE ? this.width / 2 : this.width;

    let color;

    // create axes geometry
    color =
      this.hoveredId && this.hoveredId.type === "xAxis"
        ? this.highlightColor
        : this.xColor;
    const xAxis = new Cesium.GeometryInstance({
      geometry: new Cesium.PolylineGeometry({
        positions: xpoints,
        width: width,
        vertexFormat: Cesium.PolylineMaterialAppearance.VERTEX_FORMAT,
        arcType: Cesium.ArcType.NONE,
      }),
      modelMatrix: axisMatrix,
      id: {
        type: "xAxis",
      },
      pickPrimitive: this,
      attributes: {
        color: Cesium.ColorGeometryInstanceAttribute.fromColor(color),
        depthFailColor: Cesium.ColorGeometryInstanceAttribute.fromColor(color),
      },
    });

    color =
      this.hoveredId && this.hoveredId.type === "yAxis"
        ? this.highlightColor
        : this.yColor;
    const yAxis = new Cesium.GeometryInstance({
      geometry: new Cesium.PolylineGeometry({
        positions: ypoints,
        width: width,
        vertexFormat: Cesium.PolylineMaterialAppearance.VERTEX_FORMAT,
        arcType: Cesium.ArcType.NONE,
      }),
      modelMatrix: axisMatrix,
      id: {
        type: "yAxis",
      },
      pickPrimitive: this,
      attributes: {
        color: Cesium.ColorGeometryInstanceAttribute.fromColor(color),
        depthFailColor: Cesium.ColorGeometryInstanceAttribute.fromColor(color),
      },
    });

    color =
      this.hoveredId && this.hoveredId.type === "zAxis"
        ? this.highlightColor
        : this.zColor;
    const zAxis = new Cesium.GeometryInstance({
      geometry: new Cesium.PolylineGeometry({
        positions: zpoints,
        width: width,
        vertexFormat: Cesium.PolylineMaterialAppearance.VERTEX_FORMAT,
        arcType: Cesium.ArcType.NONE,
      }),
      modelMatrix: axisMatrix,
      id: {
        type: "zAxis",
      },
      pickPrimitive: this,
      attributes: {
        color: Cesium.ColorGeometryInstanceAttribute.fromColor(color),
        depthFailColor: Cesium.ColorGeometryInstanceAttribute.fromColor(color),
      },
    });

    const appearance = new Cesium.PolylineMaterialAppearance({
      material: material,
      vertexShaderSource: VS,
      fragmentShaderSource: FS,
    });

    const axes = new Cesium.Primitive({
      geometryInstances: [xAxis, yAxis, zAxis],
      appearance,
      depthFailAppearance: appearance,
      asynchronous: false,
      // releaseGeometryInstances: false,
    });

    this._primitives.add(axes);

    // planes
    if (
      this.type === CesiumGizmo.Mode.TRANSLATE ||
      this.type === CesiumGizmo.Mode.SCALE
    ) {
      let planeVertices = new Float64Array([
        0, 0.4, 0.4, 0, 0.6, 0.4, 0, 0.6, 0.6, 0, 0.4, 0.6,
      ]);

      color =
        this.hoveredId && this.hoveredId.type === "yzPlane"
          ? this.highlightColor
          : this.xColor;

      const yzPlane = new Cesium.GeometryInstance({
        geometry: new Cesium.Geometry({
          attributes: {
            position: new Cesium.GeometryAttribute({
              componentDatatype: Cesium.ComponentDatatype.DOUBLE,
              componentsPerAttribute: 3,
              values: planeVertices,
            }),
          },
          indices: new Uint16Array([0, 1, 2, 0, 2, 3]),
          boundingSphere: Cesium.BoundingSphere.fromVertices(planeVertices),
        }),
        modelMatrix: axisMatrix,
        id: {
          type: "yzPlane",
        },
        pickPrimitive: this,
        attributes: {
          color: Cesium.ColorGeometryInstanceAttribute.fromColor(color),
          depthFailColor:
            Cesium.ColorGeometryInstanceAttribute.fromColor(color),
        },
      });

      planeVertices = new Float64Array([
        0.4, 0, 0.4, 0.6, 0, 0.4, 0.6, 0, 0.6, 0.4, 0, 0.6,
      ]);

      color =
        this.hoveredId && this.hoveredId.type === "xzPlane"
          ? this.highlightColor
          : this.yColor;
      const xzPlane = new Cesium.GeometryInstance({
        geometry: new Cesium.Geometry({
          attributes: {
            position: new Cesium.GeometryAttribute({
              componentDatatype: Cesium.ComponentDatatype.DOUBLE,
              componentsPerAttribute: 3,
              values: planeVertices,
            }),
          },
          indices: new Uint16Array([0, 1, 2, 0, 2, 3]),
          boundingSphere: Cesium.BoundingSphere.fromVertices(planeVertices),
        }),
        modelMatrix: axisMatrix,
        id: {
          type: "xzPlane",
        },
        pickPrimitive: this,
        attributes: {
          color: Cesium.ColorGeometryInstanceAttribute.fromColor(color),
          depthFailColor:
            Cesium.ColorGeometryInstanceAttribute.fromColor(color),
        },
      });

      planeVertices = new Float64Array([
        0.4, 0.4, 0, 0.6, 0.4, 0, 0.6, 0.6, 0, 0.4, 0.6, 0,
      ]);

      color =
        this.hoveredId && this.hoveredId.type === "xyPlane"
          ? this.highlightColor
          : this.zColor;
      const xyPlane = new Cesium.GeometryInstance({
        geometry: new Cesium.Geometry({
          attributes: {
            position: new Cesium.GeometryAttribute({
              componentDatatype: Cesium.ComponentDatatype.DOUBLE,
              componentsPerAttribute: 3,
              values: planeVertices,
            }),
          },
          indices: new Uint16Array([0, 1, 2, 0, 2, 3]),
          boundingSphere: Cesium.BoundingSphere.fromVertices(planeVertices),
        }),
        modelMatrix: axisMatrix,
        id: {
          type: "xyPlane",
        },
        pickPrimitive: this,
        attributes: {
          color: Cesium.ColorGeometryInstanceAttribute.fromColor(color),
          depthFailColor:
            Cesium.ColorGeometryInstanceAttribute.fromColor(color),
        },
      });

      const appearance = new Cesium.PerInstanceColorAppearance({
        flat: true,
      });

      const planes = new Cesium.Primitive({
        geometryInstances: [yzPlane, xzPlane, xyPlane],
        appearance,
        depthFailAppearance: appearance,
        releaseGeometryInstances: false,
      });

      this._primitives.add(planes);
    }
  }

  const scale = getScaleForMinimumSize(this, frameState);

  // fix gizmo's screen size
  const scaledMatrix = Cesium.Matrix4.multiplyByUniformScale(
    this.modelMatrix,
    scale,
    new Cesium.Matrix4()
  );

  for (let i = 0; i < this._primitives.length; ++i) {
    const p = this._primitives.get(i);
    p.modelMatrix = scaledMatrix;
  }

  this._primitives.update(frameState);
};

/**
 * Returns true if this object was destroyed; otherwise, false.
 * <p>
 * If this object was destroyed, it should not be used; calling any function other than
 * <code>isDestroyed</code> will result in a {@link DeveloperError} exception.
 * </p>
 *
 * @returns {Boolean} <code>true</code> if this object was destroyed; otherwise, <code>false</code>.
 *
 * @see CesiumGizmo#destroy
 */
CesiumGizmo.prototype.isDestroyed = function () {
  return false;
};

/**
 * Destroys the WebGL resources held by this object.  Destroying an object allows for deterministic
 * release of WebGL resources, instead of relying on the garbage collector to destroy this object.
 * <p>
 * Once an object is destroyed, it should not be used; calling any function other than
 * <code>isDestroyed</code> will result in a {@link DeveloperError} exception.  Therefore,
 * assign the return value (<code>undefined</code>) to the object as done in the example.
 * </p>
 *
 * @exception {DeveloperError} This object was destroyed, i.e., destroy() was called.
 *
 * @example
 * p = p && p.destroy();
 *
 * @see CesiumGizmo#isDestroyed
 */
CesiumGizmo.prototype.destroy = function () {
  this.viewer.scene.primitives.remove(this);

  this.handler.destroy();

  if (Cesium.defined(this._primitives)) {
    this._primitives.removeAll();
    this._primitives.destroy();
  }

  return Cesium.destroyObject(this);
};

CesiumGizmo.Mode = Object.freeze(Mode);

export default CesiumGizmo;
