import React, { useState, useEffect } from 'react';
import { Form, Input, Button, Tabs, Modal, Space, App } from 'antd';
import { authAPI } from '../services/api';
import { useNavigate } from 'react-router-dom';

const { TabPane } = Tabs;

const UserSettings: React.FC = () => {
  const { message } = App.useApp();
  const [passwordForm] = Form.useForm();
  const [usernameForm] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [hasPassword, setHasPassword] = useState<boolean | null>(null);
  const [showSetPasswordModal, setShowSetPasswordModal] = useState(false);
  const [setPasswordForm] = Form.useForm();
  const navigate = useNavigate();

  useEffect(() => {
    // 检查用户是否有密码
    const checkPassword = async () => {
      try {
        const response = await authAPI.checkHasPassword();
        setHasPassword(response.data.has_password);
        
        // 如果用户没有密码，显示设置密码的模态框
        if (!response.data.has_password) {
          setShowSetPasswordModal(true);
        }
      } catch (error) {
        console.error('检查密码状态失败', error);
      }
    };
    
    checkPassword();
  }, []);

  const onPasswordFinish = async (values: any) => {
    try {
      setLoading(true);
      await authAPI.updatePassword(values.oldPassword, values.newPassword);
      message.success('密码修改成功');
      passwordForm.resetFields();
    } catch (error: any) {
      message.error(error.response?.data?.detail || '密码修改失败');
    } finally {
      setLoading(false);
    }
  };

  const checkUsername = async () => {
    try {
      const values = await usernameForm.validateFields(['newUsername']);
      if (!values.newUsername) {
        message.warning('请先输入用户名');
        return;
      }
      
      setCheckingUsername(true);
      const response = await authAPI.checkUsername(values.newUsername);
      
      if (response.data.exists) {
        message.error('用户名已存在，请更换用户名');
      } else {
        message.success('用户名可用');
      }
    } catch (error: any) {
      if (error.errorFields) {
        message.error('请先输入有效的用户名');
      } else {
        message.error(error.response?.data?.detail || '检查用户名失败');
      }
    } finally {
      setCheckingUsername(false);
    }
  };

  const onUsernameFinish = async (values: any) => {
    try {
      // 再次检查用户名是否可用
      const checkResponse = await authAPI.checkUsername(values.newUsername);
      if (checkResponse.data.exists) {
        message.error('用户名已存在，请更换用户名');
        return;
      }
      
      setLoading(true);
      await authAPI.updateUsername(values.newUsername);
      message.success('用户名修改成功');
      usernameForm.resetFields();
      
      // 更新本地存储的用户名
      const userResponse = await authAPI.getCurrentUser();
      localStorage.setItem('username', userResponse.data.username);
      
      // 刷新页面以更新导航栏显示的用户名
      window.location.reload();
    } catch (error: any) {
      message.error(error.response?.data?.detail || '用户名修改失败');
    } finally {
      setLoading(false);
    }
  };

  const onSetPasswordFinish = async (values: any) => {
    try {
      setLoading(true);
      await authAPI.setInitialPassword(values.newPassword);
      message.success('初始密码设置成功');
      setPasswordForm.resetFields();
      setShowSetPasswordModal(false);
      setHasPassword(true);
    } catch (error: any) {
      message.error(error.response?.data?.detail || '初始密码设置失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', padding: '24px' }}>
      <h2>用户设置</h2>
      
      <Tabs 
        defaultActiveKey="password"
        items={[
          {
            key: 'password',
            label: '修改密码',
            children: (
              <Form
                form={passwordForm}
                layout="vertical"
                onFinish={onPasswordFinish}
                style={{ maxWidth: 400 }}
              >
                <Form.Item
                  label="当前密码"
                  name="oldPassword"
                  rules={[{ required: true, message: '请输入当前密码' }]}
                >
                  <Input.Password />
                </Form.Item>

                <Form.Item
                  label="新密码"
                  name="newPassword"
                  rules={[
                    { required: true, message: '请输入新密码' },
                    { min: 6, message: '密码长度不能小于6位' }
                  ]}
                >
                  <Input.Password />
                </Form.Item>

                <Form.Item
                  label="确认新密码"
                  name="confirmPassword"
                  dependencies={['newPassword']}
                  rules={[
                    { required: true, message: '请确认新密码' },
                    ({ getFieldValue }) => ({
                      validator(_, value) {
                        if (!value || getFieldValue('newPassword') === value) {
                          return Promise.resolve();
                        }
                        return Promise.reject(new Error('两次输入的密码不一致'));
                      },
                    }),
                  ]}
                >
                  <Input.Password />
                </Form.Item>

                <Form.Item>
                  <Button type="primary" htmlType="submit" loading={loading} block>
                    修改密码
                  </Button>
                </Form.Item>
              </Form>
            )
          },
          {
            key: 'username',
            label: '修改用户名',
            children: (
              <Form
                form={usernameForm}
                layout="vertical"
                onFinish={onUsernameFinish}
                style={{ maxWidth: 400 }}
              >
                <Form.Item
                  label="新用户名"
                  name="newUsername"
                  rules={[
                    { required: true, message: '请输入新用户名' },
                    { min: 3, message: '用户名至少3个字符' }
                  ]}
                >
                  <Input />
                </Form.Item>

                <Form.Item>
                  <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                    <Button 
                      onClick={checkUsername} 
                      loading={checkingUsername}
                      style={{ width: '48%' }}
                    >
                      检查用户名
                    </Button>
                    <Button 
                      type="primary" 
                      htmlType="submit" 
                      loading={loading}
                      style={{ width: '48%' }}
                    >
                      修改用户名
                    </Button>
                  </Space>
                </Form.Item>
              </Form>
            )
          }
        ]}
      />
      
      {/* 设置初始密码的模态框 */}
      <Modal
        title="设置初始密码"
        open={showSetPasswordModal}
        onCancel={() => {
          // 如果用户没有设置密码，不允许关闭模态框
          if (!hasPassword) {
            message.warning('请先设置初始密码');
            return;
          }
          setShowSetPasswordModal(false);
        }}
        footer={null}
        closable={hasPassword === true}
        maskClosable={false}
        keyboard={hasPassword === true}
      >
        <p>您是通过手机验证码登录的用户，需要设置初始密码才能使用所有功能。</p>
        <Form
          form={setPasswordForm}
          layout="vertical"
          onFinish={onSetPasswordFinish}
        >
          <Form.Item
            label="新密码"
            name="newPassword"
            rules={[
              { required: true, message: '请输入新密码' },
              { min: 6, message: '密码长度不能小于6位' }
            ]}
          >
            <Input.Password />
          </Form.Item>

          <Form.Item
            label="确认新密码"
            name="confirmPassword"
            dependencies={['newPassword']}
            rules={[
              { required: true, message: '请确认新密码' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('newPassword') === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error('两次输入的密码不一致'));
                },
              }),
            ]}
          >
            <Input.Password />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} block>
              设置初始密码
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default UserSettings; 