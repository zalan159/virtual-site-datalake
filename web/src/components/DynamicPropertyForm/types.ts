// 定义字段元数据类型
export interface FieldMetadata {
  display_name: string;
  editable: boolean;
  type: string;
  properties?: {
    [key: string]: any;
  };
  min?: number;
  max?: number;
  options?: { label: string; value: any }[];
  description?: string;
}

// 新增分组接口定义
export interface MetadataGroup {
  id: string;
  name: string;
  fields: string[];
}

// 定义组件属性
export interface DynamicPropertyFormProps {
  entityId: string; // 实体ID (可能是sceneId, instanceId等)
  data: any;        // 实体数据
  metadata: {       // 字段元数据
    groups?: MetadataGroup[];  // 新增分组信息
    fields: {
      [key: string]: FieldMetadata;
    }
  };
  loading?: boolean;
  onSave?: (values: any) => Promise<void>; // 新增，保存时回调
  onRefresh?: () => void;
  sectionTitle?: string;
  onFlyToOrigin?: (origin: {longitude: number, latitude: number, height: number}) => void; // 新增
  onUpdatePreviewImage?: () => Promise<void>; // 修改为无参数
  startPickOrigin?: () => void; // 新增
  isPickingOrigin?: boolean; // 新增
  pickedOrigin?: {longitude: number, latitude: number, height: number} | null; // 新增
}
