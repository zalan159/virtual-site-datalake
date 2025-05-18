import { Table, Button, Space, Typography, Card, Modal, Form, Input, App, message, Select, Spin } from 'antd';
import { PlusOutlined, DeleteOutlined, EditOutlined, EyeOutlined } from '@ant-design/icons';
import { useState, useEffect, useRef } from 'react';
import { streamApi, Stream, StreamCreate } from '../../services/streamApi';
import Hls from 'hls.js';

const { Title } = Typography;

const protocolOptions = [
  { label: 'HLS', value: 'hls', examples: [
    'http(s)://example.com/live/stream.m3u8',
    'http(s)://cdn.example.com/playlist/master.m3u8',
  ] },
  { label: 'DASH', value: 'dash', examples: [
    'http(s)://example.com/live/stream.mpd',
    'http(s)://cdn.example.com/manifest.mpd',
  ] },
  { label: 'WebRTC', value: 'webrtc', examples: [
    '@wss://signaling.example.com/ws',
    'http(s)://api.example.com/webrtc/signal',
  ] },
];

// 视频预览组件
const VideoPreview: React.FC<{
  visible: boolean;
  stream: Stream | null;
  onClose: () => void;
}> = ({ visible, stream, onClose }) => {
  console.log('[VideoPreview] 组件渲染', { visible, stream });
  const [loading, setLoading] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);
  let hlsRef = useRef<Hls | null>(null);

  useEffect(() => {
    console.log('[VideoPreview] useEffect visible变化', visible);
  }, [visible]);

  useEffect(() => {
    console.log('[VideoPreview] useEffect依赖', { visible, stream });
    let hls: Hls | null = null;
    if (visible && stream) {
      setLoading(true);
      setTimeout(() => {
        if (videoRef.current) {
          const protocol = stream.protocol?.toLowerCase();
          console.log('[VideoPreview] videoRef.current', videoRef.current);
          console.log('[VideoPreview] visible', visible);
          console.log('[VideoPreview] stream', stream);
          console.log('[VideoPreview] protocol', protocol);
          if (protocol === 'hls') {
            console.log('[HLS] 检测到HLS协议，准备播放', stream.url);
            if (Hls.isSupported()) {
              hls = new Hls();
              hlsRef.current = hls;
              console.log('[HLS] hls.js支持，开始加载源');
              hls.loadSource(stream.url);
              hls.attachMedia(videoRef.current);
              hls.on(Hls.Events.MANIFEST_PARSED, () => {
                console.log('[HLS] MANIFEST_PARSED，准备播放');
                setLoading(false);
              });
              hls.on(Hls.Events.ERROR, (event, data) => {
                console.error('[HLS] 播放出错', event, data);
                setLoading(false);
                message.error("视频加载失败，请检查地址是否正确");
              });
            } else if (videoRef.current.canPlayType('application/vnd.apple.mpegurl')) {
              // Safari
              console.log('[HLS] Safari原生支持，直接赋值src');
              videoRef.current.src = stream.url;
              videoRef.current.oncanplay = () => {
                console.log('[HLS] Safari canplay');
                setLoading(false);
              };
              videoRef.current.onerror = (e) => {
                console.error('[HLS] Safari 播放出错', e);
                setLoading(false);
                message.error("视频加载失败，请检查地址是否正确");
              };
            } else {
              console.error('[HLS] 当前浏览器不支持HLS播放');
              setLoading(false);
              message.error("当前浏览器不支持HLS播放");
            }
          } else if (protocol === 'dash') {
            console.log('[DASH] 尝试原生播放', stream.url);
            videoRef.current.src = stream.url;
            videoRef.current.oncanplay = () => {
              console.log('[DASH] canplay');
              setLoading(false);
            };
            videoRef.current.onerror = (e) => {
              console.error('[DASH] 播放出错', e);
              setLoading(false);
              message.error("视频加载失败，请检查地址是否正确");
            };
          } else {
            // WebRTC等其他协议可能需要特殊处理
            console.log('[Other] 非HLS/DASH协议，跳过加载');
            setLoading(false); // 暂时跳过加载
          }
        } else {
          console.warn('[VideoPreview] 延迟后 videoRef.current 依然为空');
        }
      }, 100);
    }
    return () => {
      if (hlsRef.current) {
        console.log('[HLS] 销毁hls实例');
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.oncanplay = null;
        videoRef.current.onerror = null;
        videoRef.current.pause();
        videoRef.current.src = "";
      }
    };
  }, [visible, stream]);
  
  const getProtocolInfo = () => {
    const protocol = stream?.protocol?.toLowerCase();
    
    switch(protocol) {
      case 'hls': 
        return "HLS协议视频流";
      case 'dash': 
        return "DASH协议视频流";
      case 'webrtc': 
        return "WebRTC协议视频流";
      default: 
        return "未知类型视频流";
    }
  };
  
  useEffect(() => {
    if (stream && stream.protocol) {
      console.log('[VideoPreview] video标签即将渲染', stream.protocol);
    }
  }, [stream]);
  
  return (
    <Modal
      title={`预览: ${stream?.name || ''} (${getProtocolInfo()})`}
      open={visible}
      onCancel={onClose}
      width={800}
      footer={null}
      destroyOnHidden
    >
      <div style={{ position: 'relative', minHeight: '300px' }}>
        {loading && (
          <div style={{ 
            position: 'absolute', 
            top: 0, 
            left: 0, 
            right: 0, 
            bottom: 0, 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center',
            background: 'rgba(0,0,0,0.05)' 
          }}>
            <Spin />
            <span style={{marginLeft: 8}}>加载中...</span>
          </div>
        )}
        
        {stream?.protocol?.toLowerCase() === 'webrtc' ? (
          <div style={{ textAlign: 'center', padding: '20px' }}>
            <p>WebRTC流需要特殊的播放器支持</p>
            <p>地址: {stream?.url}</p>
            <p style={{ color: '#999', fontSize: '12px' }}>
              提示: 未来版本将集成WebRTC播放器。您可以使用外部工具访问此地址。
            </p>
          </div>
        ) : (
          <video
            ref={videoRef}
            controls
            autoPlay
            style={{ width: '100%', maxHeight: '500px' }}
            src={stream?.protocol?.toLowerCase() === 'hls' ? undefined : stream?.url}
            onLoadedData={() => {
              if (stream?.protocol?.toLowerCase() !== 'hls') {
                console.log('[VideoPreview] video 元素已挂载，onLoadedData');
                setLoading(false);
              }
            }}
          />
        )}
      </div>
    </Modal>
  );
};

const VideoData: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const [streams, setStreams] = useState<Stream[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingStream, setEditingStream] = useState<Stream | null>(null);
  const [form] = Form.useForm<StreamCreate>();
  const [selectedProtocol, setSelectedProtocol] = useState<string>('hls');
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewStream, setPreviewStream] = useState<Stream | null>(null);

  const fetchStreams = async () => {
    try {
      setLoading(true);
      const data = await streamApi.getList();
      setStreams(Array.isArray(data) ? data : []);
    } catch (error) {
      messageApi.error('获取视频流列表失败');
      setStreams([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStreams();
  }, []);

  const handleDelete = async (id: string) => {
    try {
      await streamApi.delete(id);
      messageApi.success('删除成功');
      fetchStreams();
    } catch (error) {
      messageApi.error('删除失败');
    }
  };

  const handleEdit = (stream: Stream) => {
    setEditingStream(stream);
    form.setFieldsValue({
      name: stream.name,
      protocol: stream.protocol,
      url: stream.url,
      username: stream.username,
      password: stream.password,
      description: stream.description,
    });
    setSelectedProtocol(stream.protocol || 'hls');
    setModalVisible(true);
  };

  const handleAdd = () => {
    setEditingStream(null);
    form.resetFields();
    setSelectedProtocol('hls');
    setModalVisible(true);
  };

  const handleModalOk = async () => {
    try {
      const values = await form.validateFields();
      values.protocol = (values.protocol || '').toLowerCase();
      
      if (values.url && !values.url.startsWith('@') && !/^https?:\/\//i.test(values.url)) {
        values.url = `http://${values.url}`;
      }
      
      if (editingStream) {
        await streamApi.update(editingStream._id, values);
        messageApi.success('更新成功');
      } else {
        await streamApi.create(values);
        messageApi.success('创建成功');
      }
      setModalVisible(false);
      fetchStreams();
    } catch (error) {
      messageApi.error(editingStream ? '更新失败' : '创建失败');
    }
  };

  const columns = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '协议',
      dataIndex: 'protocol',
      key: 'protocol',
    },
    {
      title: '地址',
      dataIndex: 'url',
      key: 'url',
      render: (url: string) => (
        <a href={url} target="_blank" rel="noopener noreferrer">{url}</a>
      ),
    },
    {
      title: '用户名',
      dataIndex: 'username',
      key: 'username',
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
    },
    {
      title: '创建时间',
      dataIndex: 'create_time',
      key: 'create_time',
      render: (time: string) => new Date(time).toLocaleString(),
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: Stream) => (
        <Space size="middle">
          <Button 
            type="link" 
            icon={<EyeOutlined />} 
            onClick={() => {
              console.log('[VideoData] 预览按钮点击', record);
              setPreviewStream(record);
              setPreviewVisible(true);
            }}
          >
            预览
          </Button>
          <Button type="link" icon={<EditOutlined />} onClick={() => handleEdit(record)}>编辑</Button>
          <Button type="link" danger icon={<DeleteOutlined />} onClick={() => handleDelete(record._id)}>删除</Button>
        </Space>
      ),
    },
  ];

  useEffect(() => {
    console.log('[VideoData] 预览Modal状态变化', previewVisible, previewStream);
  }, [previewVisible, previewStream]);

  return (
    <div>
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
          <Title level={4}>视频流管理</Title>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
            新增视频流
          </Button>
        </div>
        <Table
          columns={columns}
          dataSource={streams}
          rowKey="_id"
          loading={loading}
          pagination={{
            defaultPageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 条记录`,
          }}
        />
      </Card>
      <Modal
        title={editingStream ? '编辑视频流' : '新增视频流'}
        open={modalVisible}
        onOk={handleModalOk}
        onCancel={() => setModalVisible(false)}
        destroyOnHidden
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="名称" rules={[{ required: true, message: '请输入名称' }]}> 
            <Input />
          </Form.Item>
          <Form.Item name="protocol" label="协议" initialValue="hls" rules={[{ required: true, message: '请选择协议' }]}> 
            <Select
              options={protocolOptions.map(opt => ({ label: opt.label, value: opt.value }))}
              onChange={val => setSelectedProtocol(val)}
              placeholder="请选择协议类型"
              value={selectedProtocol}
            />
          </Form.Item>
          <Form.Item
            name="url"
            label="地址"
            rules={[
              { required: true, message: '请输入视频流地址' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value) return Promise.resolve();
                  const protocol = getFieldValue('protocol') || selectedProtocol;
                  
                  let testUrl = value;
                  if (!testUrl.startsWith('@') && !/^https?:\/\//i.test(testUrl)) {
                    testUrl = `http://${testUrl}`;
                  }
                  
                  if (protocol === 'hls' && !/\.m3u8($|\?)/.test(testUrl)) {
                    return Promise.reject('HLS地址应以.m3u8结尾');
                  }
                  if (protocol === 'dash' && !/\.mpd($|\?)/.test(testUrl)) {
                    return Promise.reject('DASH地址应以.mpd结尾');
                  }
                  if (protocol === 'webrtc') {
                    if (!testUrl.trim()) {
                      return Promise.reject('请输入有效的WebRTC地址');
                    }
                  }
                  return Promise.resolve();
                },
              }),
            ]}
            extra={(() => {
              const opt = protocolOptions.find(opt => opt.value === selectedProtocol);
              if (!opt) return null;
              return (
                <div>
                  <div>示例：</div>
                  {opt.examples.map((ex, idx) => (
                    <div key={idx} style={{ color: '#888', fontSize: 12 }}>{ex}</div>
                  ))}
                  {selectedProtocol !== 'webrtc' && (
                    <div style={{ color: '#888', fontSize: 12, marginTop: 4 }}>
                      注意：如果未添加http(s)://，系统将自动添加http://
                    </div>
                  )}
                </div>
              );
            })()}
          > 
            <Input />
          </Form.Item>
          <Form.Item name="username" label="用户名"> 
            <Input />
          </Form.Item>
          <Form.Item name="password" label="密码"> 
            <Input.Password />
          </Form.Item>
          <Form.Item name="description" label="描述"> 
            <Input />
          </Form.Item>
        </Form>
      </Modal>
      <VideoPreview
        visible={previewVisible}
        stream={previewStream}
        onClose={() => setPreviewVisible(false)}
      />
    </div>
  );
};

export default VideoData; 