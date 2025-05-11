import React from 'react';
import { Typography } from 'antd';
import PublicModelList from '../../components/PublicModelList';

const { Title } = Typography;

const PublicModels: React.FC = () => {
  return (
    <div>
      <Title level={2}>公共模型管理</Title>
      <PublicModelList isAdmin={true} />
    </div>
  );
};

export default PublicModels; 