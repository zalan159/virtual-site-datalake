import {
  GithubFilled,
  InfoCircleFilled,
  QuestionCircleFilled,
  HomeOutlined,
  AppstoreOutlined,
  DatabaseOutlined,
  FileOutlined,
  TagsOutlined,
  FileTextOutlined,
  PaperClipOutlined,
  LogoutOutlined,
  UserOutlined,
  PictureOutlined,
  RobotOutlined,
  ShoppingOutlined,
  ApiOutlined,
} from '@ant-design/icons';
import type { ProSettings } from '@ant-design/pro-components';
import { PageContainer, ProCard, ProLayout } from '@ant-design/pro-components';
import { Input, Dropdown, App } from 'antd';
import { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { authAPI } from '../services/api';
import { routeConfig, getMenuFromRoutes } from '../router/routeConfig';

const MainLayout = () => {
  const { message } = App.useApp();
  const settings: ProSettings | undefined = {
    fixSiderbar: true,
    layout: 'mix',
    splitMenus: true,
  };

  const navigate = useNavigate();
  const location = useLocation();
  const [pathname, setPathname] = useState(location.pathname);
  const [username, setUsername] = useState<string>('');
  const [hasPassword, setHasPassword] = useState<boolean | null>(null);

  useEffect(() => {
    // 获取用户信息
    const fetchUserInfo = async () => {
      try {
        const response = await authAPI.getCurrentUser();
        setUsername(response.data.username);
        if (response.data.role) {
          localStorage.setItem('role', response.data.role);
        }
        // 检查用户是否有密码
        const passwordResponse = await authAPI.checkHasPassword();
        setHasPassword(passwordResponse.data.has_password);
        // 如果用户没有密码且不在设置页面，显示提示
        if (!passwordResponse.data.has_password && pathname !== '/settings') {
          message.warning('您尚未设置密码，请前往用户设置页面设置初始密码');
        }
      } catch (error) {
        console.error('获取用户信息失败', error);
      }
    };
    fetchUserInfo();
  }, [pathname]);

  const handleLogout = async () => {
    try {
      await authAPI.logout();
      localStorage.removeItem('token');
      message.success('退出登录成功');
      navigate('/login');
    } catch (error) {
      message.error('退出登录失败，请重试');
    }
  };

  const role = localStorage.getItem('role');
  const isAdmin = role === 'admin';
  
  // 使用统一配置生成路由菜单
  const menuItems = getMenuFromRoutes(routeConfig, isAdmin);
  const route = {
    path: '/',
    routes: menuItems,
  };

  return (
    <div
      id="test-pro-layout"
      style={{
        height: '100vh',
      }}
    >
      <ProLayout
        {...settings}
        location={{
          pathname,
        }}
        route={route}
        menu={{
          type: 'group',
        }}
        avatarProps={{
          src: 'https://gw.alipayobjects.com/zos/antfincdn/efFD%24IOql2/weixintupian_20170331104822.jpg',
          size: 'small',
          title: username || '加载中...',
          render: (props, dom) => {
            return (
              <Dropdown
                menu={{
                  items: [
                    {
                      key: 'logout',
                      icon: <LogoutOutlined />,
                      label: '退出登录',
                      onClick: handleLogout,
                    },
                  ],
                }}
              >
                {dom}
              </Dropdown>
            );
          },
        }}
        actionsRender={(props) => {
          if (props.isMobile) return [];
          return [
            <QuestionCircleFilled
              key="help"
              onClick={() => window.open('https://frontfidelity.yuque.com/cb9pxv/cirz3l?# 《灵境项目》', '_blank')}
              style={{ fontSize: '16px', marginRight: '16px', cursor: 'pointer' }}
            />,
          ];
        }}
        menuFooterRender={(props) => {
          if (props?.collapsed) return undefined;
          return (
            <div
              style={{
                textAlign: 'center',
                paddingBlockStart: 12,
              }}
            >
              <div>© 2024 灵境孪生中台</div>
              <div>VirtualSite</div>
            </div>
          );
        }}
        onMenuHeaderClick={(e) => console.log(e)}
        menuItemRender={(item, dom) => (
          <div
            onClick={() => {
              setPathname(item.path || '/home');
              navigate(item.path || '/home');
            }}
          >
            {dom}
          </div>
        )}
        title="灵境孪生中台"
        logo="/logoonly.png"
      >
        <PageContainer
        >
          <ProCard
            style={{
              height: '100vh',
              minHeight: 800,
              
            }}
            
          >
            <Outlet />
          </ProCard>
        </PageContainer>
      </ProLayout>
    </div>
  );
};

export default MainLayout; 