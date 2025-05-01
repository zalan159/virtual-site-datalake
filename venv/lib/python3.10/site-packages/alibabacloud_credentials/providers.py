import calendar
import configparser
import json
import os
import time

import requests
from Tea.core import TeaCore

from alibabacloud_credentials import credentials
from alibabacloud_credentials.exceptions import CredentialException
from alibabacloud_credentials.models import Config
from alibabacloud_credentials.utils import auth_constant as ac
from alibabacloud_credentials.utils import auth_util as au
from alibabacloud_credentials.utils import parameter_helper as ph


class AlibabaCloudCredentialsProvider:
    """BaseProvider class"""
    duration_seconds = 3600
    timeout = 2000

    def __init__(self, config=None):
        if isinstance(config, Config):
            self.type = config.type
            self.access_key_id = config.access_key_id
            self.access_key_secret = config.access_key_secret
            self.role_arn = config.role_arn
            self.role_session_name = config.role_session_name
            self.public_key_id = config.public_key_id
            self.role_name = config.role_name
            self.disable_imds_v1 = config.disable_imds_v1
            self.oidc_provider_arn = config.oidc_provider_arn
            self.oidc_token_file_path = config.oidc_token_file_path
            self.private_key_file = config.private_key_file
            self.bearer_token = config.bearer_token
            self.security_token = config.security_token
            self.host = config.host
            self.timeout = config.timeout + config.connect_timeout
            self.connect_timeout = config.connect_timeout
            self.proxy = config.proxy
            self.sts_endpoint = config.sts_endpoint

    def _set_arg(self, key, value):
        if value is not None:
            setattr(self, key, value)

        val = getattr(self, key, None)
        if val is None:
            setattr(self, key, None)

    def _verify_empty_args(self, *args, config):
        if None in args and config is None:
            raise CredentialException(
                '"%s" needs to receive a "model.Config" object or other necessary args' % self.__class__
            )

    def get_credentials(self):
        raise NotImplementedError('get_credentials() must be overridden')


class DefaultCredentialsProvider(AlibabaCloudCredentialsProvider):
    def __init__(self):
        super().__init__()
        self.user_configuration_providers = [
            EnvironmentVariableCredentialsProvider()
        ]
        if au.enable_oidc_credential:
            self.user_configuration_providers.append(OIDCRoleArnCredentialProvider(
                role_session_name=au.environment_role_session_name,
                role_arn=au.environment_role_arn,
                oidc_provider_arn=au.environment_oidc_provider_arn,
                oidc_token_file_path=au.environment_oidc_token_file
            ))

        self.user_configuration_providers.append(ProfileCredentialsProvider())
        role_name = au.environment_ECSMeta_data

        if role_name is not None:
            self.user_configuration_providers.append(EcsRamRoleCredentialProvider(role_name))
        self.user_configuration_providers.append(CredentialsUriProvider())

    def get_credentials(self):
        for provider in self.user_configuration_providers:
            credential = provider.get_credentials()
            if credential is not None:
                return credential
        raise CredentialException("not found credentials")

    def add_credentials_provider(self, p):
        self.user_configuration_providers.append(p)

    def remove_credentials_provider(self, p):
        self.user_configuration_providers.remove(p)

    def contains_credentials_provider(self, p):
        return self.user_configuration_providers.__contains__(p)

    def clear_credentials_provider(self):
        self.user_configuration_providers.clear()


class EcsRamRoleCredentialProvider(AlibabaCloudCredentialsProvider):
    """EcsRamRoleCredentialProvider"""
    default_metadata_token_duration = 21600

    def __init__(self, role_name=None, config=None):
        self._verify_empty_args(role_name, config=config)
        super().__init__(config)
        self.__url_in_ecs_metadata = "/latest/meta-data/ram/security-credentials/"
        self.__url_in_ecs_metadata_token = "/latest/api/token"
        self.__ecs_metadata_fetch_error_msg = "Failed to get RAM session credentials from ECS metadata service."
        self.__ecs_metadata_token_fetch_error_msg = "Failed to get token from ECS Metadata Service."
        self.__metadata_service_host = "100.100.100.200"
        self._set_arg('role_name', role_name)
        self.disable_imds_v1 = au.environment_imds_v1_disabled and au.environment_imds_v1_disabled.lower() == 'true'

        if isinstance(config, Config):
            self.disable_imds_v1 = config.disable_imds_v1 is not None and config.disable_imds_v1 == True

    def _get_role_name(self, url=None):
        tea_request = ph.get_new_request()
        tea_request.headers['host'] = url if url else self.__metadata_service_host
        metadata_token = self._get_metadata_token(url)
        if metadata_token is not None:
            tea_request.headers['X-aliyun-ecs-metadata-token'] = metadata_token
        if not url:
            tea_request.pathname = self.__url_in_ecs_metadata
        response = TeaCore.do_action(tea_request)
        if response.status_code != 200:
            raise CredentialException(self.__ecs_metadata_fetch_error_msg + " HttpCode=" + str(response.status_code))
        self.role_name = response.body.decode('utf-8')

    async def _get_role_name_async(self, url=None):
        tea_request = ph.get_new_request()
        tea_request.headers['host'] = url if url else self.__metadata_service_host
        metadata_token = await self._get_metadata_token_async(url)
        if metadata_token is not None:
            tea_request.headers['X-aliyun-ecs-metadata-token'] = metadata_token
        if not url:
            tea_request.pathname = self.__url_in_ecs_metadata
        response = await TeaCore.async_do_action(tea_request)
        if response.status_code != 200:
            raise CredentialException(self.__ecs_metadata_fetch_error_msg + " HttpCode=" + str(response.status_code))
        self.role_name = response.body.decode('utf-8')

    def _get_metadata_token(self, url=None):
        tea_request = ph.get_new_request()
        tea_request.method = 'PUT'
        tea_request.headers['host'] = url if url else self.__metadata_service_host
        tea_request.headers['X-aliyun-ecs-metadata-token-ttl-seconds'] = str(self.default_metadata_token_duration)
        if not url:
            tea_request.pathname = self.__url_in_ecs_metadata_token
        try:
            response = TeaCore.do_action(tea_request)
            if response.status_code != 200:
                raise CredentialException(
                    self.__ecs_metadata_token_fetch_error_msg + " HttpCode=" + str(response.status_code))
            return response.body.decode('utf-8')
        except Exception as e:
            if self.disable_imds_v1:
                raise e
            return None

    async def _get_metadata_token_async(self, url=None):
        tea_request = ph.get_new_request()
        tea_request.method = 'PUT'
        tea_request.headers['host'] = url if url else self.__metadata_service_host
        tea_request.headers['X-aliyun-ecs-metadata-token-ttl-seconds'] = str(self.default_metadata_token_duration)
        if not url:
            tea_request.pathname = self.__url_in_ecs_metadata_token
        try:
            response = await TeaCore.async_do_action(tea_request)
            if response.status_code != 200:
                raise CredentialException(
                    self.__ecs_metadata_token_fetch_error_msg + " HttpCode=" + str(response.status_code))
            return response.body.decode('utf-8')
        except Exception as e:
            if self.disable_imds_v1:
                raise e
            return None

    def _create_credential(self, url=None):
        tea_request = ph.get_new_request()
        tea_request.headers['host'] = url if url else self.__metadata_service_host
        metadata_token = self._get_metadata_token(url)
        if metadata_token is not None:
            tea_request.headers['X-aliyun-ecs-metadata-token'] = metadata_token
        if not url:
            tea_request.pathname = self.__url_in_ecs_metadata + self.role_name
        # request
        response = TeaCore.do_action(tea_request)

        if response.status_code != 200:
            raise CredentialException(self.__ecs_metadata_fetch_error_msg + " HttpCode=" + str(response.status_code))

        dic = json.loads(response.body.decode('utf-8'))
        content_code = dic.get('Code')
        content_access_key_id = dic.get('AccessKeyId')
        content_access_key_secret = dic.get('AccessKeySecret')
        content_security_token = dic.get('SecurityToken')
        content_expiration = dic.get('Expiration')

        if content_code != "Success":
            raise CredentialException(self.__ecs_metadata_fetch_error_msg)

        # 先转换为时间数组
        time_array = time.strptime(content_expiration, "%Y-%m-%dT%H:%M:%SZ")
        # 转换为时间戳
        time_stamp = calendar.timegm(time_array)
        return credentials.EcsRamRoleCredential(content_access_key_id, content_access_key_secret,
                                                content_security_token, time_stamp, self)

    def get_credentials(self):
        if self.role_name == "":
            self._get_role_name()
        return self._create_credential()

    async def _create_credential_async(self, url=None):
        tea_request = ph.get_new_request()
        tea_request.headers['host'] = url if url else self.__metadata_service_host
        metadata_token = await self._get_metadata_token_async(url)
        if metadata_token is not None:
            tea_request.headers['X-aliyun-ecs-metadata-token'] = metadata_token
        if not url:
            tea_request.pathname = self.__url_in_ecs_metadata + self.role_name

        # request
        response = await TeaCore.async_do_action(tea_request)

        if response.status_code != 200:
            raise CredentialException(self.__ecs_metadata_fetch_error_msg + " HttpCode=" + str(response.status_code))

        dic = json.loads(response.body.decode('utf-8'))
        content_code = dic.get('Code')
        content_access_key_id = dic.get('AccessKeyId')
        content_access_key_secret = dic.get('AccessKeySecret')
        content_security_token = dic.get('SecurityToken')
        content_expiration = dic.get('Expiration')

        if content_code != "Success":
            raise CredentialException(self.__ecs_metadata_fetch_error_msg)

        # 先转换为时间数组
        time_array = time.strptime(content_expiration, "%Y-%m-%dT%H:%M:%SZ")
        # 转换为时间戳
        time_stamp = calendar.timegm(time_array)
        return credentials.EcsRamRoleCredential(content_access_key_id, content_access_key_secret,
                                                content_security_token, time_stamp, self)

    async def get_credentials_async(self):
        if self.role_name == "":
            await self._get_role_name_async()
        return await self._create_credential_async()


class RamRoleArnCredentialProvider(AlibabaCloudCredentialsProvider):
    """RamRoleArnCredentialProvider"""

    def __init__(self, access_key_id=None, access_key_secret=None, role_session_name=None, role_arn=None,
                 region_id=None,
                 policy=None, config=None):
        self._verify_empty_args(access_key_id, access_key_secret, config=config)
        super().__init__(config)
        self._set_arg('role_arn', role_arn)
        self._set_arg('access_key_id', access_key_id)
        self._set_arg('access_key_secret', access_key_secret)
        self._set_arg('region_id', region_id)
        self._set_arg('role_session_name', role_session_name)
        self._set_arg('policy', policy)
        if region_id is None and au.environment_sts_region is not None:
            self._set_arg('region_id', au.environment_sts_region)
        if self.region_id is not None:
            self._set_arg('sts_endpoint', f'sts.{self.region_id}.aliyuncs.com')
        else:
            self._set_arg('sts_endpoint',
                          'sts.aliyuncs.com' if config is None or config.sts_endpoint is None else config.sts_endpoint)

    def get_credentials(self):
        return self._create_credentials()

    def _create_credentials(self):
        # 获取credential 先实现签名用工具类
        tea_request = ph.get_new_request()
        tea_request.query = {
            'Action': 'AssumeRole',
            'Format': 'JSON',
            'Version': '2015-04-01',
            'DurationSeconds': str(self.duration_seconds),
            'RoleArn': self.role_arn,
            'AccessKeyId': self.access_key_id,
            'RoleSessionName': self.role_session_name,
            'SignatureMethod': 'HMAC-SHA1',
            'SignatureVersion': '1.0'
        }
        tea_request.query["Timestamp"] = ph.get_iso_8061_date()
        tea_request.query["SignatureNonce"] = ph.get_uuid()
        if self.policy is not None:
            tea_request.query["Policy"] = self.policy
        string_to_sign = ph.compose_string_to_sign("GET", tea_request.query)
        signature = ph.sign_string(string_to_sign, self.access_key_secret + "&")
        tea_request.query["Signature"] = signature
        tea_request.protocol = 'https'
        tea_request.headers['host'] = self.sts_endpoint
        # request
        response = TeaCore.do_action(tea_request)
        if response.status_code == 200:
            dic = json.loads(response.body.decode('utf-8'))
            if "Credentials" in dic:
                cre = dic.get("Credentials")
                # 先转换为时间数组
                time_array = time.strptime(cre.get("Expiration"), "%Y-%m-%dT%H:%M:%SZ")
                # 转换为时间戳
                expiration = calendar.timegm(time_array)
                return credentials.RamRoleArnCredential(cre.get("AccessKeyId"), cre.get("AccessKeySecret"),
                                                        cre.get("SecurityToken"), expiration, self)
        raise CredentialException(response.body.decode('utf-8'))

    async def get_credentials_async(self):
        return await self._create_credentials_async()

    async def _create_credentials_async(self):
        # 获取credential 先实现签名用工具类
        tea_request = ph.get_new_request()
        tea_request.query = {
            'Action': 'AssumeRole',
            'Format': 'JSON',
            'Version': '2015-04-01',
            'DurationSeconds': str(self.duration_seconds),
            'RoleArn': self.role_arn,
            'AccessKeyId': self.access_key_id,
            'RoleSessionName': self.role_session_name,
            'SignatureMethod': 'HMAC-SHA1',
            'SignatureVersion': '1.0'
        }
        tea_request.query["Timestamp"] = ph.get_iso_8061_date()
        tea_request.query["SignatureNonce"] = ph.get_uuid()
        if self.policy is not None:
            tea_request.query["Policy"] = self.policy
        string_to_sign = ph.compose_string_to_sign("GET", tea_request.query)
        signature = ph.sign_string(string_to_sign, self.access_key_secret + "&")
        tea_request.query["Signature"] = signature
        tea_request.protocol = 'https'
        tea_request.headers['host'] = self.sts_endpoint
        # request
        response = await TeaCore.async_do_action(tea_request)
        if response.status_code == 200:
            dic = json.loads(response.body.decode('utf-8'))
            if "Credentials" in dic:
                cre = dic.get("Credentials")
                # 先转换为时间数组
                time_array = time.strptime(cre.get("Expiration"), "%Y-%m-%dT%H:%M:%SZ")
                # 转换为时间戳
                expiration = calendar.timegm(time_array)
                return credentials.RamRoleArnCredential(cre.get("AccessKeyId"), cre.get("AccessKeySecret"),
                                                        cre.get("SecurityToken"), expiration, self)
        raise CredentialException(response.body.decode('utf-8'))


class OIDCRoleArnCredentialProvider(AlibabaCloudCredentialsProvider):
    """OIDCRoleArnCredentialProvider"""

    def __init__(self, role_session_name=None, role_arn=None,
                 oidc_provider_arn=None,
                 oidc_token_file_path=None,
                 region_id=None,
                 policy=None, config=None):
        self._verify_empty_args(role_arn, oidc_provider_arn, oidc_token_file_path, config=config)
        super().__init__(config)
        self._set_arg('role_arn', role_arn)
        self._set_arg('oidc_provider_arn', oidc_provider_arn)
        if oidc_token_file_path is not None:
            self._set_arg('oidc_token_file_path', oidc_token_file_path)
        elif config.oidc_token_file_path is not None:
            self._set_arg('oidc_token_file_path', oidc_token_file_path)
        elif au.environment_oidc_token_file is not None:
            self._set_arg('oidc_token_file_path', au.environment_oidc_token_file)
        else:
            raise CredentialException(
                'The oidc_token_file_path does not exist and env ALIBABA_CLOUD_OIDC_TOKEN_FILE is none.')
        self._set_arg('region_id', region_id)
        self._set_arg('role_session_name', role_session_name)
        self._set_arg('policy', policy)
        if region_id is None and au.environment_sts_region is not None:
            self._set_arg('region_id', au.environment_sts_region)
        if self.region_id is not None:
            self._set_arg('sts_endpoint', f'sts.{self.region_id}.aliyuncs.com')
        else:
            self._set_arg('sts_endpoint',
                          'sts.aliyuncs.com' if config is None or config.sts_endpoint is None else config.sts_endpoint)

    def get_credentials(self):
        return self._create_credentials()

    def _create_credentials(self):
        # 获取credential 先实现签名用工具类
        oidc_token = au.get_private_key(self.oidc_token_file_path)
        tea_request = ph.get_new_request()
        tea_request.query = {
            'Action': 'AssumeRoleWithOIDC',
            'Format': 'JSON',
            'Version': '2015-04-01',
            'DurationSeconds': str(self.duration_seconds),
            'RoleArn': self.role_arn,
            'OIDCProviderArn': self.oidc_provider_arn,
            'OIDCToken': oidc_token,
            'RoleSessionName': self.role_session_name or 'defaultSessionName'
        }
        tea_request.query["Timestamp"] = ph.get_iso_8061_date()
        tea_request.query["SignatureNonce"] = ph.get_uuid()
        if self.policy is not None:
            tea_request.query["Policy"] = self.policy
        tea_request.protocol = 'https'
        tea_request.headers['host'] = self.sts_endpoint
        # request
        response = TeaCore.do_action(tea_request)
        if response.status_code == 200:
            dic = json.loads(response.body.decode('utf-8'))
            if "Credentials" in dic:
                cre = dic.get("Credentials")
                # 先转换为时间数组
                time_array = time.strptime(cre.get("Expiration"), "%Y-%m-%dT%H:%M:%SZ")
                # 转换为时间戳
                expiration = calendar.timegm(time_array)
                return credentials.OIDCRoleArnCredential(cre.get("AccessKeyId"), cre.get("AccessKeySecret"),
                                                         cre.get("SecurityToken"), expiration, self)
        raise CredentialException(response.body.decode('utf-8'))

    async def get_credentials_async(self):
        return await self._create_credentials_async()

    async def _create_credentials_async(self):
        # 获取credential 先实现签名用工具类
        oidc_token = au.get_private_key(self.oidc_token_file_path)
        tea_request = ph.get_new_request()
        tea_request.query = {
            'Action': 'AssumeRoleWithOIDC',
            'Format': 'JSON',
            'Version': '2015-04-01',
            'DurationSeconds': str(self.duration_seconds),
            'RoleArn': self.role_arn,
            'OIDCProviderArn': self.oidc_provider_arn,
            'OIDCToken': oidc_token,
            'RoleSessionName': self.role_session_name or 'defaultSessionName'
        }
        tea_request.query["Timestamp"] = ph.get_iso_8061_date()
        tea_request.query["SignatureNonce"] = ph.get_uuid()
        if self.policy is not None:
            tea_request.query["Policy"] = self.policy
        tea_request.protocol = 'https'
        tea_request.headers['host'] = self.sts_endpoint
        # request
        response = await TeaCore.async_do_action(tea_request)
        if response.status_code == 200:
            dic = json.loads(response.body.decode('utf-8'))
            if "Credentials" in dic:
                cre = dic.get("Credentials")
                # 先转换为时间数组
                time_array = time.strptime(cre.get("Expiration"), "%Y-%m-%dT%H:%M:%SZ")
                # 转换为时间戳
                expiration = calendar.timegm(time_array)
                return credentials.OIDCRoleArnCredential(cre.get("AccessKeyId"), cre.get("AccessKeySecret"),
                                                         cre.get("SecurityToken"), expiration, self)
        raise CredentialException(response.body.decode('utf-8'))


class RsaKeyPairCredentialProvider(AlibabaCloudCredentialsProvider):

    def __init__(self, access_key_id=None, access_key_secret=None, region_id=None, config=None):
        self._verify_empty_args(access_key_id, access_key_secret, config=config)
        super().__init__(config)
        self._set_arg('access_key_id', access_key_id)
        self._set_arg('access_key_secret', access_key_secret)
        self._set_arg('region_id', region_id)

    async def get_credentials_async(self):
        return await self._create_credential_async()

    async def _create_credential_async(self, turl=None):
        tea_request = ph.get_new_request()
        tea_request.query = {
            'Action': 'GenerateSessionAccessKey',
            'Format': 'JSON',
            'Version': '2015-04-01',
            'DurationSeconds': str(self.duration_seconds),
            'AccessKeyId': self.access_key_id,
            'SignatureMethod': 'HMAC-SHA1',
            'SignatureVersion': '1.0'
        }
        tea_request.query["Timestamp"] = ph.get_iso_8061_date()
        tea_request.query["SignatureNonce"] = ph.get_uuid()

        str_to_sign = ph.compose_string_to_sign('GET', tea_request.query)
        signature = ph.sign_string(str_to_sign, self.access_key_id + '&')
        tea_request.query['Signature'] = signature
        tea_request.protocol = 'https'
        tea_request.headers['host'] = turl if turl else 'sts.aliyuncs.com'
        # request
        response = await TeaCore.async_do_action(tea_request)
        if response.status_code == 200:
            dic = json.loads(response.body.decode('utf-8'))
            if "SessionAccessKey" in dic:
                cre = dic.get("SessionAccessKey")
                time_array = time.strptime(cre.get("Expiration"), "%Y-%m-%dT%H:%M:%SZ")
                expiration = calendar.timegm(time_array)
                return credentials.RsaKeyPairCredential(cre.get("SessionAccessKeyId"),
                                                        cre.get("SessionAccessKeySecret"),
                                                        expiration, self)
        raise CredentialException(response.body.decode('utf-8'))

    def get_credentials(self):
        return self._create_credential()

    def _create_credential(self, turl=None):
        tea_request = ph.get_new_request()
        tea_request.query = {
            'Action': 'GenerateSessionAccessKey',
            'Format': 'JSON',
            'Version': '2015-04-01',
            'DurationSeconds': str(self.duration_seconds),
            'AccessKeyId': self.access_key_id,
            'SignatureMethod': 'HMAC-SHA1',
            'SignatureVersion': '1.0'
        }
        tea_request.query["Timestamp"] = ph.get_iso_8061_date()
        tea_request.query["SignatureNonce"] = ph.get_uuid()

        str_to_sign = ph.compose_string_to_sign('GET', tea_request.query)
        signature = ph.sign_string(str_to_sign, self.access_key_id + '&')
        tea_request.query['Signature'] = signature
        tea_request.protocol = 'https'
        tea_request.headers['host'] = turl if turl else 'sts.aliyuncs.com'
        # request
        response = TeaCore.do_action(tea_request)
        if response.status_code == 200:
            dic = json.loads(response.body.decode('utf-8'))
            if "SessionAccessKey" in dic:
                cre = dic.get("SessionAccessKey")
                time_array = time.strptime(cre.get("Expiration"), "%Y-%m-%dT%H:%M:%SZ")
                expiration = calendar.timegm(time_array)
                return credentials.RsaKeyPairCredential(cre.get("SessionAccessKeyId"),
                                                        cre.get("SessionAccessKeySecret"),
                                                        expiration, self)
        raise CredentialException(response.body.decode('utf-8'))


class ProfileCredentialsProvider(AlibabaCloudCredentialsProvider):
    def __init__(self, path=None):
        super().__init__()
        self._set_arg('file_path', path)

    def parse_ini(self):
        file_path = self.file_path if self.file_path else au.environment_credentials_file
        if file_path is None:
            if not ac.HOME:
                return
            if os.path.exists(os.path.join(ac.HOME, "/.alibabacloud/credentials.ini")):
                # Support '/.alibabacloud/credentials.ini' is due to historical mistakes.
                # Please try to use '~/.alibabacloud/credentials.ini'.
                file_path = os.path.join(ac.HOME, "/.alibabacloud/credentials.ini")
            elif os.path.exists(os.path.join(ac.HOME, ".alibabacloud/credentials.ini")):
                file_path = os.path.join(ac.HOME, ".alibabacloud/credentials.ini")
        if file_path is None:
            return
        elif len(file_path) == 0:
            raise CredentialException("The specified credentials file is empty")

        # loads ini
        conf = configparser.ConfigParser()
        conf.read(file_path, encoding='utf-8')
        ini_map = dict(conf._sections)
        for k in dict(conf._sections):
            option = dict(ini_map[k])
            for key, value in dict(ini_map[k]).items():
                if '#' in value:
                    option[key] = value.split('#')[0].strip()
                else:
                    option[key] = value.strip()
            ini_map[k] = option
        client_config = ini_map.get(au.client_type)
        return client_config

    def get_credentials(self):
        client_config = self.parse_ini()
        if client_config is None:
            return
        return self._create_credential(client_config)

    def _create_credential(self, config):
        config_type = config.get(ac.INI_TYPE)
        if not config_type:
            raise CredentialException("The configured client type is empty")
        elif ac.INI_TYPE_ARN == config_type:
            return self._get_sts_assume_role_session_provider(config).get_credentials()
        elif ac.INI_TYPE_OIDC == config_type:
            return self._get_sts_oidc_role_session_provider(config).get_credentials()
        elif ac.INI_TYPE_KEY_PAIR == config_type:
            return self._get_sts_get_session_access_key_provider(config).get_credentials()
        elif ac.INI_TYPE_RAM == config_type:
            return self._get_instance_profile_provider(config).get_credentials()

        access_key_id = config.get(ac.INI_ACCESS_KEY_ID)
        access_key_secret = config.get(ac.INI_ACCESS_KEY_IDSECRET)
        if not access_key_id or not access_key_secret:
            return
        return credentials.AccessKeyCredential(access_key_id, access_key_secret)

    @staticmethod
    def _get_sts_assume_role_session_provider(config):
        access_key_id = config.get(ac.INI_ACCESS_KEY_ID)
        access_key_secret = config.get(ac.INI_ACCESS_KEY_IDSECRET)
        role_session_name = config.get(ac.INI_ROLE_SESSION_NAME)
        role_arn = config.get(ac.INI_ROLE_ARN)
        region_id = config.get(ac.DEFAULT_REGION)
        policy = config.get(ac.INI_POLICY)

        if not access_key_id or not access_key_secret:
            raise CredentialException("The configured access_key_id or access_key_secret is empty")
        if not role_session_name or not role_arn:
            raise CredentialException("The configured role_session_name or role_arn is empty")
        return RamRoleArnCredentialProvider(
            access_key_id, access_key_secret, role_session_name, role_arn, region_id, policy
        )

    @staticmethod
    def _get_sts_oidc_role_session_provider(config):
        role_session_name = config.get(ac.INI_ROLE_SESSION_NAME)
        role_arn = config.get(ac.INI_ROLE_ARN)
        oidc_provider_arn = config.get(ac.INI_OIDC_PROVIDER_ARN)
        oidc_token_file_path = config.get(ac.INI_OIDC_TOKEN_FILE_PATH)
        region_id = config.get(ac.DEFAULT_REGION)
        policy = config.get(ac.INI_POLICY)

        if not role_arn:
            raise CredentialException("The configured role_arn is empty")
        if not oidc_provider_arn:
            raise CredentialException("The configured oidc_provider_arn is empty")
        return OIDCRoleArnCredentialProvider(
            role_session_name, role_arn, oidc_provider_arn, oidc_token_file_path,
            region_id, policy
        )

    @staticmethod
    def _get_sts_get_session_access_key_provider(config):
        public_key_id = config.get(ac.INI_PUBLIC_KEY_ID)
        private_key_file = config.get(ac.INI_PRIVATE_KEY_FILE)
        if not private_key_file:
            raise CredentialException("The configured private_key_file is empty")
        private_key = au.get_private_key(private_key_file)
        if not public_key_id or not private_key:
            raise CredentialException("The configured public_key_id or private_key_file content is empty")

        return RsaKeyPairCredentialProvider(public_key_id, private_key)

    @staticmethod
    def _get_instance_profile_provider(config):
        role_name = config.get(ac.INI_ROLE_NAME)
        if not role_name:
            raise CredentialException("The configured role_name is empty")
        return EcsRamRoleCredentialProvider(role_name)


class EnvironmentVariableCredentialsProvider(AlibabaCloudCredentialsProvider):
    def get_credentials(self):
        if 'default' != au.client_type:
            return
        access_key_id = au.environment_access_key_id
        access_key_secret = au.environment_access_key_secret
        security_token = au.environment_security_token

        if access_key_id is None or access_key_secret is None:
            return

        if len(access_key_id) == 0:
            raise CredentialException("Environment variable accessKeyId cannot be empty")

        if len(access_key_secret) == 0:
            raise CredentialException("Environment variable accessKeySecret cannot be empty")

        if security_token is not None and len(security_token) > 0:
            return credentials.StsCredential(access_key_id, access_key_secret, security_token)

        return credentials.AccessKeyCredential(access_key_id, access_key_secret)


class CredentialsUriProvider(AlibabaCloudCredentialsProvider):
    def get_credentials(self):
        credentials_uri = os.environ.get('ALIBABA_CLOUD_CREDENTIALS_URI')
        if credentials_uri is None:
            return None
        return credentials.CredentialsURICredential(credentials_uri)
