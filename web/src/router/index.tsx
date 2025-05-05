import { createBrowserRouter, Navigate } from 'react-router-dom';
import LoginPage from '../pages/Login';
import HomePage from '../pages/Home';
import MainLayout from '../layouts/MainLayout';
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
import UserSettings from '../pages/UserSettings';
import SceneList from '../pages/Scenes/SceneList';
import SceneEditor from '../pages/Scenes/SceneEditor';
import MaterialList from '../pages/Models/MaterialList';
import DataTemplate from '../pages/Data/DataTemplate';
import AgentPage from '../pages/Agent';
// import Store from '../pages/Models/Store';
import ModelInstances from '../pages/Data/ModelInstances';

// 路由守卫组件
const PrivateRoute = ({ children }: { children: React.ReactNode }) => {
  const token = localStorage.getItem('token');
  
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  
  return <>{children}</>;
};

// 创建路由
const router = createBrowserRouter([
  {
    path: '/',
    element: <Navigate to="/login" replace />,
  },
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/',
    element: (
      <PrivateRoute>
        <MainLayout />
      </PrivateRoute>
    ),
    children: [
      {
        path: 'home',
        element: <HomePage />,
      },
      {
        path: 'models',
        children: [
          {
            index: true,
            element: <Navigate to="/models/list" replace />,
          },
          {
            path: 'list',
            element: <ModelList />,
          },
          {
            path: 'materials',
            element: <MaterialList />,
          },
          // {
          //   path: 'store',
          //   element: <Store />,
          // },
          {
            path: 'tasks',
            children: [
              {
                index: true,
                element: <TaskList />,
              },
            ],
          },
        ],
      },
      {
        path: 'scenes',
        children: [
          {
            index: true,
            element: <SceneList />,
          },
          {
            path: 'edit/:sceneId',
            element: <SceneEditor />,
          },
        ],
      },
      {
        path: 'data',
        children: [
          {
            index: true,
            element: <Navigate to="/data/metadata" replace />,
          },
          {
            path: 'metadata',
            element: <MetadataManagement />,
          },
          {
            path: 'attachments',
            element: <AttachmentManagement />,
          },
          {
            path: 'template',
            element: <DataTemplate />,
          },
          {
            path: 'iot',
            element: <IoTData />,
          },
          {
            path: 'mqtt-subscriptions',
            element: <UserSubscriptions />,
          },
          {
            path: 'video',
            element: <VideoData />,
          },
          {
            path: 'gis',
            element: <GISData />,
          },
          {
            path: 'erp',
            element: <ERPData />,
          },
          {
            path: 'instances',
            element: <ModelInstances />,
          },
        ],
      },
      {
        path: 'agent',
        element: <AgentPage />,
      },
      {
        path: 'settings',
        element: <UserSettings />,
      },
    ],
  },
  // 独立预览页面路由，不需要MainLayout
  {
    path: '/preview/:modelId',
    element: <ModelPreviewStandalone />,
  },
]);

export default router; 