# 路由与菜单统一配置说明

## 概述

本项目采用了统一的路由与菜单配置管理方式，通过 `routeConfig.tsx` 文件集中管理所有页面的路由信息和菜单展示信息，避免了在不同文件中重复定义的问题。

## 文件结构

- `routeConfig.tsx`: 定义统一的路由与菜单配置
- `index.tsx`: 使用配置生成实际的路由
- `MainLayout.tsx`: 使用配置生成菜单展示

## 主要功能

### 1. 路由配置（routeConfig.tsx）

这个文件定义了应用的所有路由项，每个路由项包含以下属性：

```typescript
interface RouteItem {
  path: string;         // 路由路径
  name: string;         // 显示名称
  icon?: React.ReactNode; // 菜单图标
  component?: React.ComponentType<any>; // 对应的组件
  hideInMenu?: boolean; // 是否在菜单中隐藏
  routes?: RouteItem[]; // 子路由
  isAdmin?: boolean;    // 是否为管理员路由
}
```

### 2. 路由生成（index.tsx）

路由生成文件使用 `routeConfig` 中的配置，自动生成 React Router 所需的路由配置。它支持：

- 基本路由
- 嵌套路由
- 重定向
- 权限控制（普通用户/管理员）

### 3. 菜单生成（在 MainLayout 中）

MainLayout 使用 `getMenuFromRoutes` 函数，根据路由配置自动生成菜单项。这确保了菜单结构与路由结构的一致性。

## 使用方法

### 添加新路由

1. 在 `routeConfig.tsx` 中添加新的路由配置：

```typescript
{
  path: '/new-path',
  name: '新功能',
  icon: <NewIcon />,
  component: NewComponent,
}
```

2. 如果需要添加子路由，可以在 `routes` 属性中定义：

```typescript
{
  path: '/parent',
  name: '父级菜单',
  icon: <ParentIcon />,
  routes: [
    {
      path: '/parent/child1',
      name: '子项1',
      component: Child1Component,
    },
    // 更多子路由...
  ]
}
```

### 管理员路由

如果需要添加仅管理员可见的路由，设置 `isAdmin: true` 属性：

```typescript
{
  path: '/admin/feature',
  name: '管理功能',
  icon: <AdminIcon />,
  component: AdminComponent,
  isAdmin: true,
}
```

### 隐藏菜单项

如果不希望某个路由在菜单中显示，可以设置 `hideInMenu: true` 属性：

```typescript
{
  path: '/hidden-feature',
  name: '隐藏功能',
  component: HiddenComponent,
  hideInMenu: true,
}
```

## 优势

- **统一管理**：路由和菜单配置集中在一处，降低维护成本
- **避免重复**：不需要在多个地方定义相同的路由信息
- **易于扩展**：添加新功能只需在一个地方定义路由配置
- **类型安全**：使用 TypeScript 接口确保配置的正确性 