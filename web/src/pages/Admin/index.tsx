import React from 'react';
import { Outlet } from 'react-router-dom';

const AdminIndex: React.FC = () => {
  return (
    <div>
      <h1>管理员中心</h1>
      <Outlet />
    </div>
  );
};

export default AdminIndex; 