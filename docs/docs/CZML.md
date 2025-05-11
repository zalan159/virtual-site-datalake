# Cesium CZML 格式说明

CZML（Cesium Language）是一种用于描述动态场景的 JSON 格式，广泛用于 CesiumJS 进行路径动画、实体动态展示等。

---

## 1. 基本结构

一个 CZML 文件是一个 JSON 数组，每个元素代表一个对象（如文档头、实体等）。

```json
[
  {
    "id": "document",
    "version": "1.0"
  },
  {
    "id": "entity1",
    // ...实体内容...
  }
]
```

---

## 2. 常用字段说明

- `id`：对象唯一标识。
- `name`：对象名称。
- `availability`：可用时间区间（ISO8601）。
- `position`：位置，支持多种坐标格式（见下文）。
- `orientation`：方向，支持四元数或速度朝向。
- `model`/`billboard`/`path`：实体的可视化方式。

---

## 3. 位置（Position）格式

### 3.1 经纬度高（cartographicDegrees）

```json
"position": {
  "epoch": "2024-06-01T00:00:00Z",
  "cartographicDegrees": [
    0, 120.0, 30.0, 1000.0,
    60, 121.0, 31.0, 1000.0
  ]
}
```
- 格式：[秒数, 经度, 纬度, 高度, ...]

### 3.2 笛卡尔坐标（cartesian/cartesian3）

```json
"position": {
  "epoch": "2024-06-01T00:00:00Z",
  "cartesian": [
    0, 1000, 2000, 3000,
    60, 1100, 2100, 3100
  ]
}
```
- 格式：[秒数, x, y, z, ...]

---

## 4. 方向（Orientation）格式

### 4.1 单位四元数（unitQuaternion）

```json
"orientation": {
  "epoch": "2024-06-01T00:00:00Z",
  "unitQuaternion": [
    0, 0, 0, 0, 1,
    60, 0.707, 0, 0, 0.707
  ]
}
```
- 格式：[秒数, x, y, z, w, ...]

### 4.2 跟随速度方向（velocityReference）

```json
"orientation": {
  "velocityReference": "#position"
}
```
- 实体自动朝向运动方向。

---

## 5. 路径动画示例

```json
[
  {
    "id": "document",
    "version": "1.0"
  },
  {
    "id": "pathEntity",
    "availability": "2024-06-01T00:00:00Z/2024-06-01T00:10:00Z",
    "position": {
      "epoch": "2024-06-01T00:00:00Z",
      "cartographicDegrees": [
        0, 120.0, 30.0, 1000.0,
        60, 121.0, 31.0, 1000.0,
        120, 122.0, 32.0, 1000.0
      ]
    },
    "orientation": {
      "velocityReference": "#position"
    },
    "model": {
      "gltf": "model.gltf",
      "scale": 1.0
    },
    "path": {
      "material": {
        "solidColor": {
          "color": { "rgba": [255, 0, 0, 255] }
        }
      },
      "width": 5,
      "leadTime": 60,
      "trailTime": 60
    }
  }
]
```

---

## 6. 其他常用字段

- `model`：三维模型。
- `billboard`：图标。
- `label`：文字标签。
- `path`：路径轨迹。
- `point`：点。
- `polyline`：线。
- `polygon`：面。

---

## 7. 参考文档
- [Cesium 官方 CZML 指南](https://cesium.com/learn/czml/)
- [CZML 规范文档](https://github.com/CesiumGS/czml-writer/wiki/CZML-Guide)

---

> 本文档适用于 CesiumJS 动态场景开发，涵盖路径动画、坐标与方向设置等常用场景。 