import React from 'react';
import { Typography } from 'antd';
import PublicModelList from '../../components/PublicModelList';

const { Title } = Typography;

const PublicModels: React.FC = () => {
  return (
    <div>
      <Title level={2}>公共模型库</Title>
      <p>浏览并使用我们的公共3D模型资源</p>
      <PublicModelList isAdmin={false} />
    </div>
  );
};

export default PublicModels; 