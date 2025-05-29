/**
 *description: A gizmo for Cesium, can be used to adjust the model's position and pose.
 *The model needs a modelMatrix attribute so it should be generated as a primitive instead of an entity.
 *last modified time: 2023-12-24
 *Copyright (c) 2023 ZHENG WENYI
 */
 import * as Cesium from 'cesium';
import {
  getScaleFromTransform,
  getScaleForMinimumSize,
  POLYLINE_RECTANGLE,
} from './GizmoUtil.js';

import GizmoPrimitive from './GizmoPrimitive.js';

const Mode = {
  TRANSLATE: 'TRANSLATE',
  ROTATE: 'ROTATE',
  SCALE: 'SCALE',
  UNIFORM_SCALE: 'UNIFORM_SCALE',
};

function addMouseEvent(handler, viewer, scope) {
  let startPosition = new Cesium.Cartesian2(); // mouse movement start position
  let originPosition = new Cesium.Cartesian3(); // item's cartesian coordinates
  let originModelMatrix = new Cesium.Matrix4();
  let originItemModelMatrix = new Cesium.Matrix4();

  handler.setInputAction(function (movement) {
    const picked = viewer.scene.pick(movement.position);
    console.log(picked);
    if (Cesium.defined(picked)) {
      if (picked.primitive !== scope._primitive) {
        if (picked.primitive instanceof Cesium.Cesium3DTileset) {
          picked.primitive.root.modelMatrix = picked.primitive.root.transform;
          scope.item = picked.primitive.root;
        } else if (picked.primitive.modelMatrix instanceof Cesium.Matrix4) {
          scope.item = picked.primitive;
        }
      }
    }
  }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

  handler.setInputAction(function (movement) {
    const picked = viewer.scene.pick(movement.position);
    if (Cesium.defined(picked)) {
      // console.log(picked);
      if (picked.primitive === scope._primitive) {
        startPosition = movement.position;
        const m = scope.modelMatrix;
        originPosition = new Cesium.Cartesian3(m[12], m[13], m[14]);
        originModelMatrix = scope.modelMatrix.clone();
        originItemModelMatrix = scope.item.modelMatrix.clone();

        // scope.item._allowPicking = false;
        scope.pickedId = picked.id;
        viewer.scene.screenSpaceCameraController.enableRotate = false; // lock default map control
        viewer.scene.screenSpaceCameraController.enableTranslate = false;
        if (typeof scope.onDragStart === 'function') {
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
      if (typeof scope.onDragEnd === 'function') {
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
      if (Cesium.defined(hovered) && hovered.primitive === scope._primitive) {
        scope._primitive.highlightedType = hovered.id.type;
        document.body.style.cursor = 'pointer';
      } else {
        scope._primitive.highlightedType = null;
        document.body.style.cursor = 'default';
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

    if (scope.mode === Mode.TRANSLATE) {
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
        case 'xAxis':
          translation = getTranslation(Cesium.Cartesian3.UNIT_X);
          break;
        case 'yAxis':
          translation = getTranslation(Cesium.Cartesian3.UNIT_Y);
          break;
        case 'zAxis':
          translation = getTranslation(Cesium.Cartesian3.UNIT_Z);
          break;
        case 'yzPlane':
          translationOnY = getTranslation(Cesium.Cartesian3.UNIT_Y);

          translationOnZ = getTranslation(Cesium.Cartesian3.UNIT_Z);

          Cesium.Cartesian3.add(translationOnY, translationOnZ, translation);
          break;
        case 'xzPlane':
          translationOnX = getTranslation(Cesium.Cartesian3.UNIT_X);

          translationOnZ = getTranslation(Cesium.Cartesian3.UNIT_Z);

          Cesium.Cartesian3.add(translationOnX, translationOnZ, translation);
          break;
        case 'xyPlane':
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

      if (typeof scope.onDragMoving === 'function') {
        scope.onDragMoving({
          mode: Mode.TRANSLATE,
          result: new Cesium.Cartesian3(tmp[12], tmp[13], tmp[14]),
        });
      }

      if (scope.applyTransformation) {
        const item = scope.item;
        item.modelMatrix[12] = tmp[12];
        item.modelMatrix[13] = tmp[13];
        item.modelMatrix[14] = tmp[14];
      }
    } else if (scope.mode === Mode.ROTATE) {
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
        case 'xAxis':
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
        case 'yAxis':
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
        case 'zAxis':
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

      if (typeof scope.onDragMoving === 'function') {
        scope.onDragMoving({
          mode: Mode.ROTATE,
          result:
            Cesium.Transforms.fixedFrameToHeadingPitchRoll(finalTransform),
        });
      }

      if (scope.applyTransformation) {
        Cesium.Matrix4.clone(finalTransform, scope.item.modelMatrix);
      }
    } else if (scope.mode === Mode.SCALE) {
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
        case 'xAxis':
          scaleValue = getScaleValue(Cesium.Cartesian3.UNIT_X);
          if (oldScale[0] <= minimumScale && scaleValue < 1) return;

          Cesium.Matrix4.fromScale(
            new Cesium.Cartesian3(scaleValue, 1, 1),
            scaleMatrix
          );

          break;
        case 'yAxis':
          scaleValue = getScaleValue(Cesium.Cartesian3.UNIT_Y);
          if (oldScale[1] <= minimumScale && scaleValue < 1) return;

          Cesium.Matrix4.fromScale(
            new Cesium.Cartesian3(1, scaleValue, 1),
            scaleMatrix
          );

          break;
        case 'zAxis':
          scaleValue = getScaleValue(Cesium.Cartesian3.UNIT_Z);
          if (oldScale[2] <= minimumScale && scaleValue < 1) return;

          Cesium.Matrix4.fromScale(
            new Cesium.Cartesian3(1, 1, scaleValue),
            scaleMatrix
          );
          break;
        case 'xyPlane':
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
        case 'xzPlane':
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
        case 'yzPlane':
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

      if (typeof scope.onDragMoving === 'function') {
        scope.onDragMoving({
          mode: Mode.SCALE,
          result: getScaleFromTransform(finalTransform),
        });
      }

      if (scope.applyTransformation) {
        Cesium.Matrix4.clone(finalTransform, scope.item.modelMatrix);
      }
    } else if (scope.mode === Mode.UNIFORM_SCALE) {
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

      if (typeof scope.onDragMoving === 'function') {
        scope.onDragMoving({
          mode: Mode.UNIFORM_SCALE,
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
 * @param {Object} [options.item] The object to apply the gizmo.
 * @param {Boolean} [options.applyTransformation] Whether to apply the transform on the item.
 * @param {CesiumGizmo.Mode} [options.mode] The mode of the gizmo, translate, rotate or scale.
 * @param {Number} [options.length=300.0] The length of the axes in pixels.
 * @param {Number} [options.width=10] The width of the axes in pixels.
 * @param {Boolean} [options.show=true] The visibility of the gizmo.
 * @param {Cesium.Color} [options.xColor=Cesium.Color.RED] Color for the x axis.
 * @param {Cesium.Color} [options.yColor=Cesium.Color.GREEN] Color for the y axis.
 * @param {Cesium.Color} [options.zColor=Cesium.Color.BLUE] Color for the z axis.
 * @param {Cesium.Color} [options.highlightColor=Cesium.Color.YELLOW] Color for the axis highlighted.
 *
 */
class CesiumGizmo {
  get item() {
    return this._item;
  }
  set item(val) {
    this._item = val;

    if (Cesium.defined(val)) {
      if (!Cesium.defined(val.modelMatrix)) {
        throw new Cesium.DeveloperError(
          'Item must have the modelMatrix attribute!'
        );
      }

      this.modelMatrix = val.modelMatrix.clone();
    } else {
      // TODO hide gizmo primitive
    }
  }

  get modelMatrix() {
    return this._modelMatrix;
  }
  set modelMatrix(val) {
    if (!val instanceof Cesium.Matrix4) {
      throw new Cesium.DeveloperError('modelMatrix should be Cesium.Matrix4');
    }

    if (this.mode === Mode.TRANSLATE) {
      // reset the axes' direction to make them point to east, north and up (remove rotation and scale)
      const itemPos = new Cesium.Cartesian3(val[12], val[13], val[14]);
      this._modelMatrix = Cesium.Transforms.eastNorthUpToFixedFrame(itemPos);
      if (this._primitive) {
        this._primitive.modelMatrix = this._modelMatrix;
      }
    } else if (
      this.mode === Mode.ROTATE ||
      this.mode === Mode.SCALE ||
      this.mode === Mode.UNIFORM_SCALE
    ) {
      const scale = getScaleFromTransform(val);

      const m = val.clone();

      // remove scale but keep translation and rotation
      // scale can't be zero
      if (scale[0] === 0 || scale[1] === 0 || scale[2] === 0) {
        throw new Cesium.DeveloperError(
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

      this._modelMatrix = m;
      if (this._primitive) {
        this._primitive.modelMatrix = this._modelMatrix;
      }
    }
  }

  get length() {
    return this._length;
  }
  set length(val) {
    this._length = val;
  }

  get show() {
    return this._show;
  }
  set show(val) {
    this._show = val;
    if (this._primitive) {
      this._primitive.show = val;
    }
  }

  get mode() {
    return this._mode;
  }
  set mode(val) {
    this._mode = val;
    if (this._primitive) {
      this._primitive.mode = val;
    }

    // reset gizmo's modelMatrix when changing mode
    if (this.item && this.item.modelMatrix) {
      this.modelMatrix = this.item.modelMatrix.clone();
    }
  }

  get xColor() {
    return this._xColor;
  }
  set xColor(val) {
    this._xColor = val;
    if (this._primitive) {
      this._primitive.xColor = val;
    }
  }

  get yColor() {
    return this._yColor;
  }
  set yColor(val) {
    this._yColor = val;
    if (this._primitive) {
      this._primitive.yColor = val;
    }
  }

  get zColor() {
    return this._zColor;
  }
  set zColor(val) {
    this._zColor = val;
    if (this._primitive) {
      this._primitive.zColor = val;
    }
  }

  get highlightColor() {
    return this._highlightColor;
  }
  set highlightColor(val) {
    this._highlightColor = val;
    if (this._primitive) {
      this._primitive.highlightColor = val;
    }
  }

  constructor(viewer, options) {
    options = Cesium.defaultValue(options, Cesium.defaultValue.EMPTY_OBJECT);

    if (!Cesium.defined(viewer))
      throw new Cesium.DeveloperError('Viewer must be assigned!');
    if (
      Cesium.defined(options.item) &&
      !Cesium.defined(options.item.modelMatrix)
    )
      throw new Cesium.DeveloperError(
        'Item must have the modelMatrix attribute!'
      );

    this.viewer = viewer;

    const primitiveOpts = {};

    /**
     * The length of the axes in meters.
     *
     * @type {Number}
     * @default 300.0
     */
    this.length = Cesium.defaultValue(options.length, 300.0);
    primitiveOpts.length = this.length;

    /**
     * The width of the axes in pixels.
     *
     * @type {Number}
     * @default 10
     */
    this.width = Cesium.defaultValue(options.width, 10);
    primitiveOpts.width = this.width;

    /**
     * Determines if this primitive will be shown.
     *
     * @type Boolean
     * @default true
     */
    this.show = Cesium.defaultValue(options.show, true);
    primitiveOpts.show = this.show;

    this.mode = Cesium.defaultValue(options.mode, Mode.TRANSLATE);
    primitiveOpts.mode = this.mode;

    this.xColor = Cesium.defaultValue(options.xColor, Cesium.Color.RED);
    primitiveOpts.xColor = this.xColor;

    this.yColor = Cesium.defaultValue(options.yColor, Cesium.Color.GREEN);
    primitiveOpts.yColor = this.yColor;

    this.zColor = Cesium.defaultValue(options.zColor, Cesium.Color.BLUE);
    primitiveOpts.zColor = this.zColor;

    this.highlightColor = Cesium.defaultValue(
      options.highlightColor,
      Cesium.Color.YELLOW
    );
    primitiveOpts.highlightColor = this.highlightColor;

    this._modelMatrix = new Cesium.Matrix4();

    if (
      Cesium.defined(options.item) &&
      Cesium.defined(options.item.modelMatrix)
    ) {
      this.item = options.item; // modelMatrix will be calculated in the setter
    }
    primitiveOpts.modelMatrix = this.modelMatrix;
    this._primitive = new GizmoPrimitive(viewer, primitiveOpts);

    this.pickedId = null;

    this.applyTransformation = Cesium.defaultValue(
      options.applyTransformation,
      true
    );

    this.onDragMoving = options.onDragMoving;
    this.onDragStart = options.onDragStart;
    this.onDragEnd = options.onDragEnd;

    this.handler = new Cesium.ScreenSpaceEventHandler(this.viewer.canvas);

    addMouseEvent(this.handler, this.viewer, this);
  }
}

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
  if (this._primitive) {
    this.viewer.scene.primitives.remove(this._primitive);
    this._primitive = null;
  }
  this.handler.destroy();
  if (Cesium.defined(this._primitives)) {
    this._primitives.removeAll();
    this._primitives.destroy();
  }
  return Cesium.destroyObject(this);
};

CesiumGizmo.Mode = Object.freeze(Mode);

export default CesiumGizmo;

export { Mode };
