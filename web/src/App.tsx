import { RouterProvider } from 'react-router-dom';
import router from './router';
import { ConfigProvider, App as AntdApp } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import "cesium/Build/Cesium/Widgets/widgets.css";
function App() {
  return (
    <ConfigProvider locale={zhCN}>
      <AntdApp>
        <RouterProvider router={router} />
      </AntdApp>
    </ConfigProvider>
  );
}

export default App;
