import React, { useState } from 'react';
import { Form, Input, Button, Tabs, Radio, Space, App } from 'antd';
import { UserOutlined, LockOutlined, MobileOutlined, SafetyCertificateOutlined } from '@ant-design/icons';
import { authAPI } from '../services/api';
import { useNavigate } from 'react-router-dom';

const { TabPane } = Tabs;

const Login: React.FC = () => {
  const { message } = App.useApp();
  const [loading, setLoading] = useState(false);
  const [loginType, setLoginType] = useState<'username' | 'phone'>('username');
  const [loginMethod, setLoginMethod] = useState<'password' | 'code'>('password');
  const navigate = useNavigate();

  const handleLogin = async (values: any) => {
    setLoading(true);
    try {
      let loginData: any = {};
      
      if (loginType === 'username') {
        // 用户名登录
        loginData = {
          username: values.username,
          password: values.password
        };
      } else {
        // 手机号登录
        if (loginMethod === 'password') {
          loginData = {
            phone: values.phone,
            password: values.password
          };
        } else {
          loginData = {
            phone: values.phone,
            code: values.code
          };
        }
      }
      
      const response = await authAPI.login(loginData);
      
      if (response.data.access_token) {
        localStorage.setItem('token', response.data.access_token);
        message.success('登录成功');
        navigate('/dashboard');
      }
    } catch (error: any) {
      if (error.response) {
        message.error(error.response.data.detail || '登录失败');
      } else {
        message.error('网络错误，请稍后重试');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSendCode = async (phone: string) => {
    try {
      await authAPI.sendVerificationCode(phone);
      message.success('验证码已发送');
    } catch (error: any) {
      if (error.response) {
        message.error(error.response.data.detail || '发送验证码失败');
      } else {
        message.error('网络错误，请稍后重试');
      }
    }
  };

  return (
    <div style={{ maxWidth: 400, margin: '0 auto', padding: '20px' }}>
      <h2 style={{ textAlign: 'center', marginBottom: 24 }}>登录</h2>
      
      <Tabs activeKey={loginType} onChange={(key) => setLoginType(key as 'username' | 'phone')}>
        <TabPane tab="用户名登录" key="username">
          <Form onFinish={handleLogin}>
            <Form.Item
              name="username"
              rules={[{ required: true, message: '请输入用户名' }]}
            >
              <Input prefix={<UserOutlined />} placeholder="用户名" />
            </Form.Item>
            
            <Form.Item
              name="password"
              rules={[{ required: true, message: '请输入密码' }]}
            >
              <Input.Password prefix={<LockOutlined />} placeholder="密码" />
            </Form.Item>
            
            <Form.Item>
              <Button type="primary" htmlType="submit" loading={loading} block>
                登录
              </Button>
            </Form.Item>
          </Form>
        </TabPane>
        
        <TabPane tab="手机号登录" key="phone">
          <Form onFinish={handleLogin}>
            <Form.Item
              name="phone"
              rules={[
                { required: true, message: '请输入手机号' },
                { pattern: /^1[3-9]\d{9}$/, message: '请输入正确的手机号' }
              ]}
            >
              <Input prefix={<MobileOutlined />} placeholder="手机号" />
            </Form.Item>
            
            <Radio.Group 
              value={loginMethod} 
              onChange={(e) => setLoginMethod(e.target.value)}
              style={{ marginBottom: 16 }}
            >
              <Radio.Button value="password">密码登录</Radio.Button>
              <Radio.Button value="code">验证码登录</Radio.Button>
            </Radio.Group>
            
            {loginMethod === 'password' ? (
              <Form.Item
                name="password"
                rules={[{ required: true, message: '请输入密码' }]}
              >
                <Input.Password prefix={<LockOutlined />} placeholder="密码" />
              </Form.Item>
            ) : (
              <Form.Item>
                <Space>
                  <Form.Item
                    name="code"
                    rules={[{ required: true, message: '请输入验证码' }]}
                    style={{ marginBottom: 0 }}
                  >
                    <Input prefix={<SafetyCertificateOutlined />} placeholder="验证码" />
                  </Form.Item>
                  <Button 
                    onClick={() => {
                      const phone = document.querySelector('input[name="phone"]') as HTMLInputElement;
                      if (phone && phone.value) {
                        handleSendCode(phone.value);
                      } else {
                        message.warning('请先输入手机号');
                      }
                    }}
                  >
                    获取验证码
                  </Button>
                </Space>
              </Form.Item>
            )}
            
            <Form.Item>
              <Button type="primary" htmlType="submit" loading={loading} block>
                登录
              </Button>
            </Form.Item>
          </Form>
        </TabPane>
      </Tabs>
    </div>
  );
};

export default Login; 