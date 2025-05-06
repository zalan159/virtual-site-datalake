
---

### API 接口文档

#### 1. 基础信息
- **接口名称**: 产品出现元数据管理
- **路径**: `/api/metadata/product-occurrence`
- **请求方法**: `POST` / `GET` / `PUT` / `DELETE`
- **数据格式**: JSON

---

#### 2. 请求与响应示例

##### 2.1 创建产品出现元数据 (POST)
**请求示例**:
```json
{
  "file_id": "file_123",
  "pointer": "pointer_1",
  "product_id": "product_456",
  "name": "示例产品",
  "layer": "default",
  "style": "solid",
  "behaviour": "static",
  "modeller_type": "CAD",
  "product_load_status": "loaded",
  "product_flag": "active",
  "unit": "mm",
  "density_volume_unit": "kg/m³",
  "density_mass_unit": "kg",
  "unit_from_cad": "mm",
  "rgb": "255,255,255",
  "user_data": {
    "custom_field": [
      {"key": "value"}
    ]
  }
}
```

**响应示例** (成功):
```json
{
  "status": "success",
  "data": {
    "file_id": "file_123",
    "pointer": "pointer_1",
    "product_id": "product_456",
    "name": "示例产品",
    "layer": "default",
    "style": "solid",
    "behaviour": "static",
    "modeller_type": "CAD",
    "product_load_status": "loaded",
    "product_flag": "active",
    "unit": "mm",
    "density_volume_unit": "kg/m³",
    "density_mass_unit": "kg",
    "unit_from_cad": "mm",
    "rgb": "255,255,255",
    "user_data": {
      "custom_field": [
        {"key": "value"}
      ]
    }
  }
}
```

---

##### 2.2 获取产品出现元数据 (GET)
**请求示例**:
- 路径参数: `/api/metadata/product-occurrence/{file_id}`

**响应示例** (成功):
```json
{
  "status": "success",
  "data": {
    "file_id": "file_123",
    "pointer": "pointer_1",
    "product_id": "product_456",
    "name": "示例产品",
    "layer": "default",
    "style": "solid",
    "behaviour": "static",
    "modeller_type": "CAD",
    "product_load_status": "loaded",
    "product_flag": "active",
    "unit": "mm",
    "density_volume_unit": "kg/m³",
    "density_mass_unit": "kg",
    "unit_from_cad": "mm",
    "rgb": "255,255,255",
    "user_data": {
      "custom_field": [
        {"key": "value"}
      ]
    }
  }
}
```

---

##### 2.3 更新产品出现元数据 (PUT)
**请求示例**:
```json
{
  "pointer": "updated_pointer",
  "name": "更新后的产品名称"
}
```

**响应示例** (成功):
```json
{
  "status": "success",
  "data": {
    "file_id": "file_123",
    "pointer": "updated_pointer",
    "product_id": "product_456",
    "name": "更新后的产品名称",
    "layer": "default",
    "style": "solid",
    "behaviour": "static",
    "modeller_type": "CAD",
    "product_load_status": "loaded",
    "product_flag": "active",
    "unit": "mm",
    "density_volume_unit": "kg/m³",
    "density_mass_unit": "kg",
    "unit_from_cad": "mm",
    "rgb": "255,255,255",
    "user_data": {
      "custom_field": [
        {"key": "value"}
      ]
    }
  }
}
```

---

##### 2.4 删除产品出现元数据 (DELETE)
**请求示例**:
- 路径参数: `/api/metadata/product-occurrence/{file_id}`

**响应示例** (成功):
```json
{
  "status": "success",
  "message": "元数据已删除"
}
```

---

#### 3. 错误响应
**示例** (字段缺失):
```json
{
  "status": "error",
  "message": "缺少必填字段: file_id"
}
```

**示例** (数据不存在):
```json
{
  "status": "error",
  "message": "未找到指定 file_id 的元数据"
}
```

---

#### 4. 字段说明
| 字段名                | 类型       | 必填 | 说明                          |
|-----------------------|------------|------|-------------------------------|
| `file_id`             | `string`   | 是   | 文件唯一标识符                |
| `pointer`             | `string`   | 否   | 指针标识                      |
| `product_id`          | `string`   | 否   | 产品唯一标识符                |
| `name`                | `string`   | 否   | 产品名称                      |
| `layer`               | `string`   | 否   | 所属图层                      |
| `style`               | `string`   | 否   | 样式                          |
| `behaviour`           | `string`   | 否   | 行为                          |
| `modeller_type`       | `string`   | 否   | 建模工具类型                  |
| `product_load_status` | `string`   | 否   | 产品加载状态                  |
| `product_flag`        | `string`   | 否   | 产品标志                      |
| `unit`                | `string`   | 否   | 单位                          |
| `density_volume_unit` | `string`   | 否   | 体积密度单位                  |
| `density_mass_unit`   | `string`   | 否   | 质量密度单位                  |
| `unit_from_cad`       | `string`   | 否   | CAD 中的单位                  |
| `rgb`                 | `string`   | 否   | RGB 颜色值                    |
| `user_data`           | `Dict`     | 否   | 用户自定义数据                |

---
