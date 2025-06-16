// components/AnimationTab.tsx
import React, { useState } from 'react';
import { Card, Tabs, Empty } from 'antd';
import { AnimationSequenceTab } from './animation/AnimationSequenceTab';
import { AnimationNodesTab } from './animation/AnimationNodesTab';
import { AnimationSettingsTab } from './animation/AnimationSettingsTab';
import { useCesiumAnimation } from '../hooks/useCesiumAnimation';
import { AnimationManagerState } from '../types/animation';

interface AnimationTabProps {
  viewerRef: React.RefObject<any>;
  selectedModelId: string | null;
}

export const AnimationTab: React.FC<AnimationTabProps> = ({
  viewerRef,
  selectedModelId,
}) => {
  const {
    animationState,
    playAnimation,
    pauseAnimation,
    stopAnimation,
    seekToTime,
    setPlaybackRate,
    updateAnimationSettings,
    updateNodeTransform,
  } = useCesiumAnimation(viewerRef, selectedModelId);

  const [activeKey, setActiveKey] = useState('sequence');

  // 如果没有选中模型，显示提示
  if (!selectedModelId) {
    return (
      <Card 
        style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        styles={{ body: { height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' } }}
      >
        <Empty 
          description="请先选择一个GLB模型以查看其动画信息"
          style={{ color: '#888' }}
        />
      </Card>
    );
  }

  const tabItems = [
    {
      key: 'sequence',
      label: '动作序列',
      children: (
        <AnimationSequenceTab
          animationState={animationState}
          onPlay={playAnimation}
          onPause={pauseAnimation}
          onStop={stopAnimation}
          onSeek={seekToTime}
          onSetPlaybackRate={setPlaybackRate}
        />
      ),
    },
    {
      key: 'nodes',
      label: '节点',
      children: (
        <AnimationNodesTab
          animationState={animationState}
          viewerRef={viewerRef}
          onNodeTransformUpdate={updateNodeTransform}
        />
      ),
    },
    {
      key: 'settings',
      label: '设置',
      children: (
        <AnimationSettingsTab
          animationState={animationState}
          onUpdateSettings={updateAnimationSettings}
        />
      ),
    },
  ];

  return (
    <Card
      style={{
        height: '100%',
        width: '100%',
        overflowY: 'auto',
        padding: 0,
        display: 'flex',
        flexDirection: 'column',
      }}
      styles={{
        body: { padding: 0, height: '100%', display: 'flex', flexDirection: 'column' }
      }}
    >
      <Tabs
        activeKey={activeKey}
        onChange={setActiveKey}
        style={{ flex: 1, padding: '0 16px' }}
        items={tabItems}
        tabPosition="left"
        size="small"
      />
    </Card>
  );
};