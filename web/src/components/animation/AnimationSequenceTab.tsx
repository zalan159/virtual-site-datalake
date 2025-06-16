// components/animation/AnimationSequenceTab.tsx
import React, { useState, useEffect } from 'react';
import { 
  Select, 
  Button, 
  Slider, 
  Space, 
  Typography, 
  Row, 
  Col, 
  Card,
  Switch,
  InputNumber,
  Spin
} from 'antd';
import { 
  PlayCircleOutlined, 
  PauseCircleOutlined, 
  StopOutlined,
  ForwardOutlined,
  BackwardOutlined
} from '@ant-design/icons';
import { 
  AnimationManagerState, 
  AnimationPlayState, 
  AnimationPlayMode 
} from '../../types/animation';

const { Text, Title } = Typography;
const { Option } = Select;

interface AnimationSequenceTabProps {
  animationState: AnimationManagerState;
  onPlay: (clipId?: string, playMode?: AnimationPlayMode) => void;
  onPause: () => void;
  onStop: () => void;
  onSeek: (time: number) => void;
  onSetPlaybackRate: (rate: number) => void;
}

export const AnimationSequenceTab: React.FC<AnimationSequenceTabProps> = ({
  animationState,
  onPlay,
  onPause,
  onStop,
  onSeek,
  onSetPlaybackRate,
}) => {
  const { animations, playerState, isLoading } = animationState;
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [loopEnabled, setLoopEnabled] = useState(false);

  // 同步选中的动画序列
  useEffect(() => {
    if (playerState.selectedClipId) {
      setSelectedClipId(playerState.selectedClipId);
    }
  }, [playerState.selectedClipId]);

  // 获取当前选中的动画
  const currentAnimation = animations.find(a => a.id === selectedClipId);

  // 格式化时间显示
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = (seconds % 60).toFixed(1);
    return `${mins}:${secs.padStart(4, '0')}`;
  };

  // 处理播放/暂停
  const handlePlayPause = () => {
    if (playerState.playState === AnimationPlayState.PLAYING) {
      onPause();
    } else {
      const playMode = loopEnabled ? AnimationPlayMode.LOOP : AnimationPlayMode.ONCE;
      onPlay(selectedClipId || undefined, playMode);
    }
  };

  // 处理停止
  const handleStop = () => {
    onStop();
  };

  // 处理时间轴拖拽
  const handleSeek = (value: number) => {
    onSeek(value);
  };

  // 处理播放速度改变
  const handlePlaybackRateChange = (value: number | null) => {
    if (value !== null) {
      onSetPlaybackRate(value);
    }
  };

  // 快进/快退
  const handleSkip = (seconds: number) => {
    const newTime = Math.max(0, Math.min(playerState.totalDuration, playerState.currentTime + seconds));
    onSeek(newTime);
  };

  if (isLoading) {
    return (
      <div style={{ padding: 20, textAlign: 'center' }}>
        <Spin size="large" />
        <div style={{ marginTop: 16 }}>加载动画数据...</div>
      </div>
    );
  }

  return (
    <div style={{ padding: 16, height: '100%', overflow: 'auto' }}>
      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        
        {/* 动画序列选择 */}
        <Card size="small" title="动画序列">
          <Select
            style={{ width: '100%' }}
            placeholder="选择动画序列"
            value={selectedClipId}
            onChange={setSelectedClipId}
            disabled={animations.length === 0}
          >
            {animations.map(animation => (
              <Option key={animation.id} value={animation.id}>
                {animation.name} ({formatTime(animation.duration)})
              </Option>
            ))}
          </Select>
          
          {currentAnimation && (
            <div style={{ marginTop: 8, fontSize: 12, color: '#666' }}>
              时长: {formatTime(currentAnimation.duration)} | 
              起始: {formatTime(currentAnimation.startTime)} | 
              结束: {formatTime(currentAnimation.endTime)}
            </div>
          )}
        </Card>

        {/* 播放控制 */}
        <Card size="small" title="播放控制">
          <Space direction="vertical" style={{ width: '100%' }}>
            
            {/* 主控制按钮 */}
            <Row gutter={8} align="middle">
              <Col>
                <Button
                  type="primary"
                  shape="circle"
                  size="large"
                  icon={playerState.playState === AnimationPlayState.PLAYING ? 
                    <PauseCircleOutlined /> : <PlayCircleOutlined />}
                  onClick={handlePlayPause}
                  disabled={!selectedClipId}
                />
              </Col>
              <Col>
                <Button
                  shape="circle"
                  icon={<StopOutlined />}
                  onClick={handleStop}
                  disabled={playerState.playState === AnimationPlayState.STOPPED}
                />
              </Col>
              <Col>
                <Button
                  shape="circle"
                  icon={<BackwardOutlined />}
                  onClick={() => handleSkip(-5)}
                  disabled={!selectedClipId}
                  title="后退5秒"
                />
              </Col>
              <Col>
                <Button
                  shape="circle"
                  icon={<ForwardOutlined />}
                  onClick={() => handleSkip(5)}
                  disabled={!selectedClipId}
                  title="前进5秒"
                />
              </Col>
            </Row>

            {/* 时间轴 */}
            <div>
              <Row align="middle" style={{ marginBottom: 8 }}>
                <Col span={4}>
                  <Text style={{ fontSize: 12 }}>
                    {formatTime(playerState.currentTime)}
                  </Text>
                </Col>
                <Col span={16}>
                  <Slider
                    min={0}
                    max={playerState.totalDuration}
                    step={0.1}
                    value={playerState.currentTime}
                    onChange={handleSeek}
                    disabled={!selectedClipId}
                    tooltip={{ formatter: (value) => formatTime(value || 0) }}
                  />
                </Col>
                <Col span={4} style={{ textAlign: 'right' }}>
                  <Text style={{ fontSize: 12 }}>
                    {formatTime(playerState.totalDuration)}
                  </Text>
                </Col>
              </Row>
            </div>

            {/* 播放设置 */}
            <Row gutter={16} align="middle">
              <Col span={8}>
                <Space>
                  <Text>循环播放:</Text>
                  <Switch 
                    size="small" 
                    checked={loopEnabled} 
                    onChange={setLoopEnabled} 
                  />
                </Space>
              </Col>
              <Col span={16}>
                <Space>
                  <Text>播放速度:</Text>
                  <InputNumber
                    size="small"
                    min={0.1}
                    max={5.0}
                    step={0.1}
                    value={playerState.playbackRate}
                    onChange={handlePlaybackRateChange}
                    style={{ width: 80 }}
                    precision={1}
                  />
                  <Text>x</Text>
                </Space>
              </Col>
            </Row>
          </Space>
        </Card>

        {/* 播放状态信息 */}
        <Card size="small" title="状态信息">
          <Row gutter={[16, 8]}>
            <Col span={12}>
              <Text strong>播放状态: </Text>
              <Text type={
                playerState.playState === AnimationPlayState.PLAYING ? 'success' :
                playerState.playState === AnimationPlayState.PAUSED ? 'warning' : 'secondary'
              }>
                {playerState.playState === AnimationPlayState.PLAYING ? '播放中' :
                 playerState.playState === AnimationPlayState.PAUSED ? '已暂停' : '已停止'}
              </Text>
            </Col>
            <Col span={12}>
              <Text strong>播放模式: </Text>
              <Text>
                {playerState.playMode === AnimationPlayMode.LOOP ? '循环播放' :
                 playerState.playMode === AnimationPlayMode.PING_PONG ? '往返播放' : '单次播放'}
              </Text>
            </Col>
            <Col span={12}>
              <Text strong>当前序列: </Text>
              <Text>{currentAnimation?.name || '无'}</Text>
            </Col>
            <Col span={12}>
              <Text strong>总动画数: </Text>
              <Text>{animations.length}</Text>
            </Col>
          </Row>
        </Card>

      </Space>
    </div>
  );
};