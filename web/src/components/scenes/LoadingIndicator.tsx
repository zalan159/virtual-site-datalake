import React from 'react';

interface LoadingProgressProps {
  loaded: number;
  total: number;
}

interface LoadingIndicatorProps {
  loadingInstances: boolean;
  loadingProgress: LoadingProgressProps;
}

const LoadingIndicator: React.FC<LoadingIndicatorProps> = ({ 
  loadingInstances, 
  loadingProgress 
}) => {
  if (!loadingInstances) {
    return null;
  }

  return (
    <div style={{ 
      position: 'absolute', 
      zIndex: 1000, 
      left: '50%', 
      top: '24px', 
      transform: 'translate(-50%, 0)',
      background: 'rgba(0,0,0,0.8)',
      padding: '16px 24px',
      borderRadius: '8px',
      color: 'white',
      textAlign: 'center',
      boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
      minWidth: '300px'
    }}>
      <div style={{ fontSize: '16px', fontWeight: 500, marginBottom: '12px' }}>
        场景实例加载中...
      </div>
      <div style={{ marginBottom: '8px' }}>
        已加载: {loadingProgress.loaded} / {loadingProgress.total} 个模型实例
      </div>
      {loadingProgress.total > 0 && (
        <div style={{ 
          width: '100%', 
          height: '6px', 
          background: 'rgba(255,255,255,0.2)', 
          borderRadius: '3px',
          overflow: 'hidden'
        }}>
          <div style={{ 
            width: `${(loadingProgress.loaded / loadingProgress.total) * 100}%`,
            height: '100%',
            background: '#1890ff',
            borderRadius: '3px',
            transition: 'width 0.3s ease'
          }} />
        </div>
      )}
      <div style={{ 
        fontSize: '12px', 
        color: 'rgba(255,255,255,0.65)', 
        marginTop: '8px' 
      }}>
        请稍候，正在加载场景资源...
      </div>
    </div>
  );
};

export default LoadingIndicator; 