import React from 'react';
import {
  HomeOutlined,
  AppstoreOutlined,
  DatabaseOutlined,
  FileOutlined,
  TagsOutlined,
  FileTextOutlined,
  PaperClipOutlined,
  UserOutlined,
  PictureOutlined,
  // RobotOutlined,
  ApiOutlined,
} from '@ant-design/icons';

import LoginPage from '../pages/Login';
import HomePage from '../pages/Home';
// import MainLayout from '../layouts/MainLayout';
import ModelList from '../pages/Models/ModelList';
import TaskList from '../pages/Models/TaskList';
import ModelPreviewStandalone from '../pages/Models/ModelPreviewStandalone';
import MetadataManagement from '../pages/Data/MetadataManagement';
import AttachmentManagement from '../pages/Data/AttachmentManagement';
import IoTData from '../pages/Data/IoTData';
import UserSubscriptions from '../pages/Data/Subscriptions';
import VideoData from '../pages/Data/VideoData';
import GISData from '../pages/Data/GISData';
import ERPData from '../pages/Data/ERPData';
import ChartData from '../pages/Data/ChartData';
import UserSettings from '../pages/UserSettings';
import SceneList from '../pages/Scenes/SceneList';
// import SceneEditor from '../pages/Scenes/SceneEditor';
import MaterialList from '../pages/Models/MaterialList';
import DataTemplate from '../pages/Data/DataTemplate';
// import AgentPage from '../pages/Agent';
import ModelInstances from '../pages/Data/ModelInstances';
import SceneEditorStandalone from '../pages/Scenes/SceneEditorStandalone';
import ChartEditorStandalone from '../pages/ChartEditorStandalone';
import ChartPreviewStandalone from '../pages/ChartPreviewStandalone';
// import AdminIndex from '../pages/Admin';
import PublicModels from '../pages/Admin/PublicModels';
import UserPublicModels from '../pages/Models/PublicModels';
import TilesetViewer from '../pages/TilesetViewer';

// 定义路由配置项的类型
export interface RouteItem {
  path: string;
  name: string;
  icon?: React.ReactNode;
  component?: React.ComponentType<any>;
  hideInMenu?: boolean;
  routes?: RouteItem[];
  isAdmin?: boolean;
}

// 路由和菜单配置
export const routeConfig: RouteItem[] = [
  {
    path: '/home',
    name: '首页',
    icon: <HomeOutlined />,
    component: HomePage,
  },
  {
    path: '/models',
    name: '模型管理',
    icon: <AppstoreOutlined />,
    routes: [
      {
        path: '/models/list',
        name: '模型列表',
        icon: <FileOutlined />,
        component: ModelList,
      },
      {
        path: '/models/public',
        name: '公共模型库',
        icon: <AppstoreOutlined />,
        component: UserPublicModels,
      },
      {
        path: '/models/tasks',
        name: '任务列表',
        icon: <TagsOutlined />,
        component: TaskList,
      },
      {
        path: '/models/materials',
        name: '材质列表',
        icon: <AppstoreOutlined />,
        component: MaterialList,
      },
    ],
  },
  {
    path: '/scenes',
    name: '场景管理',
    icon: <PictureOutlined />,
    component: SceneList,
  },
  {
    path: '/data',
    name: '数据管理',
    icon: <DatabaseOutlined />,
    routes: [
      {
        path: '/data/metadata',
        name: '元数据管理',
        icon: <FileTextOutlined />,
        component: MetadataManagement,
      },
      {
        path: '/data/attachments',
        name: '附件管理',
        icon: <PaperClipOutlined />,
        component: AttachmentManagement,
      },
      {
        path: '/data/template',
        name: '数据模板',
        icon: <FileTextOutlined />,
        component: DataTemplate,
      },
      {
        path: '/data/iot',
        name: 'IoT数据源',
        icon: <AppstoreOutlined />,
        component: IoTData,
      },
      {
        path: '/data/mqtt-subscriptions',
        name: 'IoT数据订阅',
        icon: <ApiOutlined />,
        component: UserSubscriptions,
      },
      {
        path: '/data/video',
        name: '视频流数据',
        icon: <PictureOutlined />,
        component: VideoData,
      },
      {
        path: '/data/gis',
        name: 'GIS数据',
        icon: <AppstoreOutlined />,
        component: GISData,
      },
      {
        path: '/data/erp',
        name: 'ERP数据',
        icon: <AppstoreOutlined />,
        component: ERPData,
      },
      {
        path: '/data/instances',
        name: '模型实例',
        icon: <AppstoreOutlined />,
        component: ModelInstances,
      },
      {
        path: '/data/charts',
        name: '图表页管理',
        icon: <AppstoreOutlined />,
        component: ChartData,
      },
    ],
  },
  // {
  //   path: '/agent',
  //   name: '智能体',
  //   icon: <RobotOutlined />,
  //   component: AgentPage,
  // },
  {
    path: '/settings',
    name: '用户设置',
    icon: <UserOutlined />,
    component: UserSettings,
  },
  {
    path: '/scene-editor-standalone',
    name: '场景编辑器(独立)',
    icon: <AppstoreOutlined />,
    hideInMenu: true,
  },
  {
    path: '/admin',
    name: '管理员页面',
    icon: <UserOutlined />,
    isAdmin: true,
    routes: [
      {
        path: '/admin/public-models',
        name: '公共模型',
        icon: <AppstoreOutlined />,
        component: PublicModels,
      },
    ],
  },
];

// 特殊路由配置（不在主布局中的路由）
export const specialRoutes = [
  {
    path: '/login',
    component: LoginPage,
  },
  {
    path: '/preview/:modelId',
    component: ModelPreviewStandalone,
  },
  {
    path: '/scene-editor/:sceneId',
    component: SceneEditorStandalone,
  },
  {
    path: '/tileset-viewer',
    component: TilesetViewer,
  },
  {
    path: '/chart-editor/:chartId',
    component: ChartEditorStandalone,
  },
  {
    path: '/chart-preview/:chartId',
    component: ChartPreviewStandalone,
  },
];

// 辅助函数：根据路由配置生成菜单项
export const getMenuFromRoutes = (routes: RouteItem[], isAdmin: boolean = false) => {
  return routes
    .filter(route => !route.hideInMenu && (!route.isAdmin || isAdmin))
    .map(route => {
      const item: any = {
        path: route.path,
        name: route.name,
        icon: route.icon,
      };
      
      if (route.routes) {
        item.routes = getMenuFromRoutes(route.routes, isAdmin);
      }
      
      return item;
    });
}; 