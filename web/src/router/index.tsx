import { createBrowserRouter, Navigate } from 'react-router-dom';

import MainLayout from '../layouts/MainLayout';

import SceneEditor from '../pages/Scenes/SceneEditor';

import { routeConfig, specialRoutes, RouteItem } from './routeConfig';

// 路由守卫组件
const PrivateRoute = ({ children }: { children: React.ReactNode }) => {
  const token = localStorage.getItem('token');
  
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  
  return <>{children}</>;
};

// 管理员路由守卫组件
const AdminRoute = ({ children }: { children: React.ReactNode }) => {
  const role = localStorage.getItem('role');
  if (role !== 'admin') {
    return <Navigate to="/home" replace />;
  }
  return <>{children}</>;
};

// 递归生成路由配置
const generateRoutes = (routes: RouteItem[], isParentPath: boolean = false) => {
  return routes.map(route => {
    // 移除开头的斜杠，以适应React Router的嵌套路由格式
    const pathPart = route.path.replace(/^\//, '');
    // 如果是顶级路由，使用完整路径；如果是子路由，只使用路径的最后部分
    const routePath = isParentPath ? pathPart : pathPart.split('/').pop() || '';
    
    const routeConfig: any = {
      path: routePath,
    };

    if (route.component) {
      const Component = route.component;
      routeConfig.element = <Component />;
    }

    if (route.routes) {
      // 对于有子路由的情况
      routeConfig.children = [
        // 默认重定向到第一个子路由
        {
          index: true,
          element: <Navigate to={route.routes[0].path.split('/').pop() || ''} replace />,
        },
        ...generateRoutes(route.routes, false), // 这里传false，表示子路由
      ];
    }

    return routeConfig;
  });
};

// 创建普通路由
const generateNormalRoutes = () => {
  return routeConfig
    .filter(route => !route.isAdmin)
    .map(route => {
      // 处理场景编辑路由特殊情况
      if (route.path === '/scenes') {
        const SceneComponent = route.component;
        return {
          path: 'scenes',
          children: [
            {
              index: true,
              element: SceneComponent ? <SceneComponent /> : null,
            },
            {
              path: 'edit/:sceneId',
              element: <SceneEditor />,
            },
          ],
        };
      }
      
      // 处理其他路由
      const pathPart = route.path.replace(/^\//, '');
      
      // 创建顶级路由对象
      const routeObj: any = {
        path: pathPart,
      };
      
      // 如果没有子路由，直接设置组件
      if (!route.routes && route.component) {
        const Component = route.component;
        routeObj.element = <Component />;
      } 
      // 如果有子路由，设置子路由
      else if (route.routes) {
        routeObj.children = [
          // 默认重定向到第一个子路由
          {
            index: true,
            element: <Navigate to={route.routes[0].path.split('/').pop() || ''} replace />,
          },
          ...route.routes.map(subRoute => {
            // 从路径中提取最后一部分作为子路由路径
            const subPathPart = subRoute.path.split('/').pop() || '';
            const SubComponent = subRoute.component;
            
            console.log(`子路由: ${subRoute.path} -> ${subPathPart}`);
            
            return {
              path: subPathPart,
              element: SubComponent ? <SubComponent /> : null,
            };
          }),
        ];
      }
      
      console.log(`生成路由: ${pathPart}`, routeObj);
      
      return routeObj;
    });
};

// 创建管理员路由
const generateAdminRoutes = () => {
  const adminRoutes = routeConfig.filter(route => route.isAdmin);
  const result = [];
  
  for (const route of adminRoutes) {
    if (route.routes) {
      // 获取子路由
      const children = route.routes.map(subRoute => {
        // 从路径中提取最后一部分作为子路由路径
        const subPathPart = subRoute.path.split('/').pop() || '';
        const SubComponent = subRoute.component;
        return {
          path: subPathPart,
          element: SubComponent ? <SubComponent /> : null,
        };
      });
      
      // 添加默认索引路由（如果有子路由）
      if (children.length > 0) {
        result.push({
          index: true,
          element: <Navigate to={children[0].path} replace />,
        });
      }
      
      // 添加所有子路由
      result.push(...children);
    } else if (route.component) {
      // 如果没有子路由但有组件，添加为索引路由
      const Component = route.component;
      result.push({
        index: true,
        element: <Component />,
      });
    }
  }
  
  console.log('生成管理员路由:', result);
  
  return result;
};

// 最终路由生成（调试用，完整路由结构）
const logFullRoutes = () => {
  console.log('特殊路由:', specialRoutes.map(route => route.path));
  console.log('主路由:', routeConfig.filter(route => !route.isAdmin).map(route => route.path));
  console.log('管理员路由:', routeConfig.filter(route => route.isAdmin).map(route => route.path));
};

// 创建路由
const router = createBrowserRouter([
  {
    path: '/',
    element: <Navigate to="/login" replace />,
  },
  // 特殊路由（登录、独立预览等）
  ...specialRoutes.map(route => {
    const Component = route.component;
    return {
      path: route.path,
      element: Component ? <Component /> : null,
    };
  }),
  // 主布局下的普通路由
  {
    path: '/',
    element: (
      <PrivateRoute>
        <MainLayout />
      </PrivateRoute>
    ),
    children: generateNormalRoutes(),
  },
  // 管理员路由
  {
    path: '/admin',
    element: (
      <AdminRoute>
        <MainLayout />
      </AdminRoute>
    ),
    children: generateAdminRoutes(),
  },
]);

// 输出路由结构用于调试
logFullRoutes();
console.log('生成的路由对象:', router);

export default router; 