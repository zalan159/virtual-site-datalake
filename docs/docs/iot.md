
---

### **IoT API 文档**

#### **1. Broker 配置管理**
- **Base URL**: `/api/iot/brokers`

##### **1.1 获取所有 Broker 配置**
- **Endpoint**: `GET /brokers`
- **描述**: 获取所有 Broker 配置列表。
- **响应模型**: `List[BrokerConfig]`
- **示例响应**:
  ```json
  [
    {
      "_id": "broker1",
      "version": 1,
      "last_modified": 1630000000
    }
  ]
  ```

##### **1.2 获取单个 Broker 配置**
- **Endpoint**: `GET /brokers/{broker_id}`
- **描述**: 根据 ID 获取单个 Broker 配置。
- **参数**:
  - `broker_id`: Broker 的唯一标识符。
- **响应模型**: `BrokerConfig`
- **示例响应**:
  ```json
  {
    "_id": "broker1",
    "version": 1,
    "last_modified": 1630000000
  }
  ```

##### **1.3 创建 Broker 配置**
- **Endpoint**: `POST /brokers`
- **描述**: 创建新的 Broker 配置。
- **请求体**: `BrokerConfig` 模型。
- **响应模型**: `BrokerConfig`
- **示例请求**:
  ```json
  {
    "_id": "broker1",
    "version": 1
  }
  ```

##### **1.4 更新 Broker 配置**
- **Endpoint**: `PUT /brokers/{broker_id}`
- **描述**: 更新指定 Broker 的配置。
- **参数**:
  - `broker_id`: Broker 的唯一标识符。
- **请求体**: `BrokerConfig` 模型（排除 `version` 和 `last_modified`）。
- **响应模型**: `BrokerConfig`
- **示例请求**:
  ```json
  {
    "version": 2
  }
  ```

##### **1.5 删除 Broker 配置**
- **Endpoint**: `DELETE /brokers/{broker_id}`
- **描述**: 删除指定 Broker 的配置。
- **参数**:
  - `broker_id`: Broker 的唯一标识符。
- **响应**:
  ```json
  {
    "message": "已删除"
  }
  ```

##### **1.6 获取 Broker 配置版本历史**
- **Endpoint**: `GET /brokers/{broker_id}/versions`
- **描述**: 获取 Broker 配置的版本历史记录。
- **参数**:
  - `broker_id`: Broker 的唯一标识符。
  - `page`: 分页页码（默认 1）。
  - `page_size`: 每页数量（默认 10）。
- **响应**:
  ```json
  {
    "total": 5,
    "page": 1,
    "page_size": 10,
    "data": [
      {
        "_id": "version1",
        "version": 1,
        "timestamp": "2023-01-01T00:00:00"
      }
    ]
  }
  ```

---

#### **2. Broker 状态查询**
- **Base URL**: `/api/iot/brokers/status`

##### **2.1 获取所有 Broker 状态**
- **Endpoint**: `GET /status`
- **描述**: 获取所有 Broker 的运行时状态。
- **响应**:
  ```json
  {
    "broker1": {
      "status": "running"
    }
  }
  ```

##### **2.2 获取单个 Broker 状态**
- **Endpoint**: `GET /status/{broker_id}`
- **描述**: 获取指定 Broker 的运行时状态。
- **参数**:
  - `broker_id`: Broker 的唯一标识符。
- **响应**:
  ```json
  {
    "config_version": 1,
    "last_modified": "2023-01-01T00:00:00",
    "runtime_status": {
      "status": "running"
    }
  }
  ```

---

#### **3. 用户订阅管理**
- **Base URL**: `/api/iot/subscriptions`

##### **3.1 获取用户订阅列表**
- **Endpoint**: `GET /subscriptions`
- **描述**: 获取当前用户的所有订阅。
- **响应模型**: `List[UserTopicSubscription]`
- **示例响应**:
  ```json
  [
    {
      "_id": "sub1",
      "user_id": "user1",
      "topic": "devices/#"
    }
  ]
  ```

##### **3.2 创建订阅**
- **Endpoint**: `POST /subscriptions`
- **描述**: 创建新的订阅（支持批量）。
- **请求体**:
  - `config_id`: Broker 配置 ID。
  - `topic`: 订阅主题（字符串或列表）。
  - `qos`: QoS 等级（默认 0）。
- **响应模型**: `List[UserTopicSubscription]`
- **示例请求**:
  ```json
  {
    "config_id": "broker1",
    "topic": ["devices/#", "sensors/#"]
  }
  ```

##### **3.3 删除订阅**
- **Endpoint**: `DELETE /subscriptions/{sub_id}`
- **描述**: 删除指定订阅。
- **参数**:
  - `sub_id`: 订阅的唯一标识符。
- **响应**:
  ```json
  {
    "message": "已删除"
  }
  ```

##### **3.4 获取主题建议**
- **Endpoint**: `GET /subscriptions/topics`
- **描述**: 获取常用主题建议列表。
- **响应**:
  ```json
  {
    "common_topics": [
      "devices/#",
      "sensors/#"
    ]
  }
  ```

---

#### **4. 消息查询**
- **Base URL**: `/api/iot/messages`

##### **4.1 获取历史消息**
- **Endpoint**: `GET /history`
- **描述**: 获取指定主题的历史消息。
- **参数**:
  - `topic`: 主题名称（支持通配符）。
  - `page`: 分页页码（默认 1）。
  - `page_size`: 每页数量（默认 20）。
- **响应**:
  ```json
  {
    "total": 100,
    "page": 1,
    "page_size": 20,
    "messages": [
      {
        "id": "msg1",
        "topic": "devices/temp",
        "payload": "25.5"
      }
    ]
  }
  ```

##### **4.2 获取实时消息**
- **Endpoint**: `GET /realtime`
- **描述**: 获取指定主题的最新实时消息。
- **参数**:
  - `topic`: 主题名称。
  - `limit`: 返回的消息数量（默认 10）。
- **响应**:
  ```json
  {
    "messages": [
      {
        "id": "msg1",
        "topic": "devices/temp",
        "payload": "25.5"
      }
    ]
  }
  ```

---
