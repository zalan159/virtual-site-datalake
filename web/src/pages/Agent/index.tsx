import React from 'react';
import { Card } from 'antd';

const AgentPage: React.FC = () => {
  return (
    <Card title="智能体" style={{ height: '100%' }}>
      <iframe
        src="https://oa.frontfidelity.cn:8099/agent"
        style={{
          width: '100%',
          height: 'calc(100vh - 200px)',
          border: 'none',
        }}
        title="智能体"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    </Card>
  );
};

export default AgentPage; 