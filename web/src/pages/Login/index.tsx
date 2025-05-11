import {
  AlipayOutlined,
  LockOutlined,
  MobileOutlined,
  TaobaoOutlined,
  UserOutlined,
  WeiboOutlined,
} from '@ant-design/icons';
import {
  LoginFormPage,
  ProConfigProvider,
  ProFormCaptcha,
  ProFormCheckbox,
  ProFormText,
  ModalForm,
} from '@ant-design/pro-components';
import { Button, Divider, Space, Tabs, theme, Form, App } from 'antd';
import type { CSSProperties } from 'react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authAPI } from '../../services/api';

type LoginType = 'phone' | 'account';

const iconStyles: CSSProperties = {
  color: 'rgba(0, 0, 0, 0.2)',
  fontSize: '18px',
  verticalAlign: 'middle',
  cursor: 'pointer',
};

const LoginPage = () => {
  const [loginType, setLoginType] = useState<LoginType>('account');
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  const { token } = theme.useToken();
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const { message } = App.useApp();

  const handleSubmit = async (values: any) => {
    try {
      if (loginType === 'account') {
        // 账号密码登录
        const response = await authAPI.login({
          username: values.username,
          password: values.password
        });
        
        if (response.data.access_token) {
          // 保存token到localStorage
          localStorage.setItem('token', response.data.access_token);
          message.success('登录成功！');
          navigate('/home');
        }
      } else {
        // 手机号验证码登录
        try {
          const response = await authAPI.login({
            phone: values.mobile,
            code: values.captcha
          });
          
          if (response.data.access_token) {
            localStorage.setItem('token', response.data.access_token);
            message.success('登录成功！');
            navigate('/home');
          }
        } catch (error: any) {
          // 如果用户不存在，显示注册模态框
          if (error.response && error.response.status === 404) {
            setPhoneNumber(values.mobile);
            setShowRegisterModal(true);
          } else {
            message.error('登录失败，请检查输入信息！');
          }
        }
      }
    } catch (error) {
      message.error('登录失败，请检查输入信息！');
    }
  };

  const handleRegister = async (values: any) => {
    try {
      // 检查用户名是否已存在
      const checkResponse = await authAPI.checkUsername(values.username);
      if (checkResponse.data.exists) {
        message.error('用户名已存在，请更换用户名！');
        return false;
      }
      
      // 完成注册
      const response = await authAPI.completeRegistration(
        values.username,
        phoneNumber,
        values.email
      );
      
      if (response.data) {
        message.success('注册成功！');
        setShowRegisterModal(false);
        
        // 自动登录
        const loginResponse = await authAPI.loginWithPhone(phoneNumber, '');
        if (loginResponse.data.access_token) {
          localStorage.setItem('token', loginResponse.data.access_token);
          navigate('/home');
        }
        return true;
      }
    } catch (error) {
      message.error('注册失败，请稍后重试！');
    }
    return false;
  };

  return (
    <div
      style={{
        backgroundColor: 'white',
        height: '100vh',
      }}
    >
      <LoginFormPage
        form={form}
        backgroundImageUrl="/images/login-bg.webp"
        logo="/logoonly.png"
        backgroundVideoUrl="/images/login-bg.mp4"
        title="灵境孪生中台"
        containerStyle={{
          backgroundColor: 'rgba(0, 0, 0,0.65)',
          backdropFilter: 'blur(4px)',
        }}
        subTitle="数字孪生数据聚合平台"
        activityConfig={{
          style: {
            boxShadow: '0px 0px 8px rgba(0, 0, 0, 0.2)',
            color: token.colorTextHeading,
            borderRadius: 8,
            backgroundColor: 'rgba(255,255,255,0.25)',
            backdropFilter: 'blur(4px)',
          },
          title: '数字孪生数据聚合平台',
          subTitle: <div>
            <div>AI知识库融合</div>
            <div>RVT、NWD、Catia、JT等55种3D模型转换</div>
            <div>WEBGPU预览引擎</div>
            <div>IoT、视频流、GIS、ERP数据聚合</div>
          </div>,
          action: (
            <Button
              size="large"
              style={{
                borderRadius: 20,
                background: token.colorBgElevated,
                color: token.colorPrimary,
                width: 120,
              }}
              onClick={() => window.open('https://frontfidelity.yuque.com/cb9pxv/cirz3l', '_blank')}
            >
              了解详情
            </Button>
          ),
        }}
        onFinish={handleSubmit}
      >
        <Tabs
          centered
          activeKey={loginType}
          onChange={(activeKey) => setLoginType(activeKey as LoginType)}
          items={[
            {
              key: 'account',
              label: '账号密码登录'
            },
            {
              key: 'phone',
              label: '手机号登录'
            }
          ]}
        />
        {loginType === 'account' && (
          <>
            <ProFormText
              name="username"
              fieldProps={{
                size: 'large',
                prefix: (
                  <UserOutlined
                    style={{
                      color: token.colorText,
                    }}
                    className={'prefixIcon'}
                  />
                ),
              }}
              placeholder={'用户名'}
              rules={[
                {
                  required: true,
                  message: '请输入用户名!',
                },
              ]}
            />
            <ProFormText.Password
              name="password"
              fieldProps={{
                size: 'large',
                prefix: (
                  <LockOutlined
                    style={{
                      color: token.colorText,
                    }}
                    className={'prefixIcon'}
                  />
                ),
              }}
              placeholder={'密码'}
              rules={[
                {
                  required: true,
                  message: '请输入密码！',
                },
              ]}
            />
          </>
        )}
        {loginType === 'phone' && (
          <>
            <ProFormText
              fieldProps={{
                size: 'large',
                prefix: (
                  <MobileOutlined
                    style={{
                      color: token.colorText,
                    }}
                    className={'prefixIcon'}
                  />
                ),
              }}
              name="mobile"
              placeholder={'手机号'}
              rules={[
                {
                  required: true,
                  message: '请输入手机号！',
                },
                {
                  pattern: /^1\d{10}$/,
                  message: '手机号格式错误！',
                },
              ]}
            />
            <ProFormCaptcha
              fieldProps={{
                size: 'large',
                prefix: (
                  <LockOutlined
                    style={{
                      color: token.colorText,
                    }}
                    className={'prefixIcon'}
                  />
                ),
              }}
              captchaProps={{
                size: 'large',
              }}
              placeholder={'请输入验证码'}
              captchaTextRender={(timing, count) => {
                if (timing) {
                  return `${count} ${'获取验证码'}`;
                }
                return '获取验证码';
              }}
              name="captcha"
              rules={[
                {
                  required: true,
                  message: '请输入验证码！',
                },
              ]}
              onGetCaptcha={async () => {
                try {
                  const values = await form.validateFields(['mobile']);
                  const phoneNumber = values.mobile;
                  console.log('获取验证码，手机号:', phoneNumber);
                  
                  if (!phoneNumber) {
                    message.error('请输入手机号！');
                    return;
                  }
                  if (!/^1\d{10}$/.test(phoneNumber)) {
                    message.error('手机号格式错误！');
                    return;
                  }
                  
                  await authAPI.sendVerificationCode(phoneNumber);
                  message.success('验证码发送成功！');
                } catch (error) {
                  console.error('发送验证码失败:', error);
                  message.error('验证码发送失败！');
                }
              }}
            />
          </>
        )}
        <div
          style={{
            marginBlockEnd: 24,
          }}
        >
          <ProFormCheckbox noStyle name="autoLogin">
            自动登录
          </ProFormCheckbox>
        </div>
      </LoginFormPage>

      {/* 注册模态框 */}
      <ModalForm
        title="完成注册"
        open={showRegisterModal}
        onOpenChange={setShowRegisterModal}
        onFinish={handleRegister}
        modalProps={{
          destroyOnClose: true,
        }}
      >
        <ProFormText
          name="username"
          label="用户名"
          placeholder="请输入用户名"
          rules={[
            {
              required: true,
              message: '请输入用户名!',
            },
            {
              min: 3,
              message: '用户名至少3个字符!',
            },
          ]}
        />
        <ProFormText
          name="email"
          label="邮箱"
          placeholder="请输入邮箱（选填）"
          rules={[
            {
              type: 'email',
              message: '请输入有效的邮箱地址!',
            },
          ]}
        />
      </ModalForm>
    </div>
  );
};

export default () => {
  return (
    <ProConfigProvider dark>
      <LoginPage />
    </ProConfigProvider>
  );
}; 