# -*- coding: utf-8 -*-
# This file is auto-generated, don't edit it. Thanks.
from Tea.model import TeaModel


class Config(TeaModel):
    """
    Model for initing credential
    """

    def __init__(
            self,
            access_key_id: str = '',
            access_key_secret: str = '',
            security_token: str = '',
            bearer_token: str = '',
            duration_seconds: int = '',
            role_arn: str = '',
            oidc_provider_arn: str = '',
            oidc_token_file_path: str = '',
            policy: str = '',
            role_session_expiration: int = '',
            role_session_name: str = '',
            public_key_id: str = '',
            private_key_file: str = '',
            role_name: str = '',
            type: str = '',
            host: str = '',
            timeout: int = 1000,
            connect_timeout: int = 1000,
            proxy: str = '',
            credentials_uri: str = '',
            disable_imds_v1: bool = False,
            enable_imds_v2: bool = False,
            metadata_token_duration: int = 21600,
            sts_endpoint: str = None
    ):
        # accesskey id
        self.access_key_id = access_key_id
        # accesskey secret
        self.access_key_secret = access_key_secret
        # security token
        self.security_token = security_token
        # bearer token
        self.bearer_token = bearer_token
        # duration seconds
        self.duration_seconds = duration_seconds
        # role arn
        self.role_arn = role_arn
        # oidc provider arn
        self.oidc_provider_arn = oidc_provider_arn
        # oidc token file path
        self.oidc_token_file_path = oidc_token_file_path
        # policy
        self.policy = policy
        # role session expiration
        self.role_session_expiration = role_session_expiration
        # role session name
        self.role_session_name = role_session_name
        # publicKey id
        self.public_key_id = public_key_id
        # privateKey file
        self.private_key_file = private_key_file
        # role name
        self.role_name = role_name
        self.disable_imds_v1 = disable_imds_v1
        self.enable_imds_v2 = enable_imds_v2
        self.metadata_token_duration = metadata_token_duration
        # credential type
        self.type = type
        self.host = host
        self.timeout = timeout
        self.connect_timeout = connect_timeout
        self.proxy = proxy
        # credentials uri
        self.credentials_uri = credentials_uri
        # STS Endpoint
        self.sts_endpoint = sts_endpoint

    def validate(self):
        pass

    def to_map(self):
        result = dict()
        if self.access_key_id is not None:
            result['accessKeyId'] = self.access_key_id
        if self.access_key_secret is not None:
            result['accessKeySecret'] = self.access_key_secret
        if self.security_token is not None:
            result['securityToken'] = self.security_token
        if self.bearer_token is not None:
            result['bearerToken'] = self.bearer_token
        if self.duration_seconds is not None:
            result['durationSeconds'] = self.duration_seconds
        if self.role_arn is not None:
            result['roleArn'] = self.role_arn
        if self.oidc_provider_arn is not None:
            result['oidcProviderArn'] = self.oidc_provider_arn
        if self.oidc_token_file_path is not None:
            result['oidcTokenFilePath'] = self.oidc_token_file_path
        if self.policy is not None:
            result['policy'] = self.policy
        if self.role_session_expiration is not None:
            result['roleSessionExpiration'] = self.role_session_expiration
        if self.role_session_name is not None:
            result['roleSessionName'] = self.role_session_name
        if self.public_key_id is not None:
            result['publicKeyId'] = self.public_key_id
        if self.private_key_file is not None:
            result['privateKeyFile'] = self.private_key_file
        if self.role_name is not None:
            result['roleName'] = self.role_name
        if self.disable_imds_v1 is not None:
            result['disableIMDSv1'] = self.disable_imds_v1
        if self.enable_imds_v2 is not None:
            result['enableIMDSv2'] = self.enable_imds_v2
        if self.metadata_token_duration is not None:
            result['metadataTokenDuration'] = self.metadata_token_duration
        if self.type is not None:
            result['type'] = self.type
        if self.host is not None:
            result['host'] = self.host
        if self.timeout is not None:
            result['timeout'] = self.timeout
        if self.connect_timeout is not None:
            result['connectTimeout'] = self.connect_timeout
        if self.proxy is not None:
            result['proxy'] = self.proxy
        if self.credentials_uri is not None:
            result['credentialsUri'] = self.credentials_uri
        if self.sts_endpoint is not None:
            result['stsEndpoint'] = self.sts_endpoint
        return result

    def from_map(self, m: dict = None):
        m = m or dict()
        if m.get('accessKeyId') is not None:
            self.access_key_id = m.get('accessKeyId')
        if m.get('accessKeySecret') is not None:
            self.access_key_secret = m.get('accessKeySecret')
        if m.get('securityToken') is not None:
            self.security_token = m.get('securityToken')
        if m.get('bearerToken') is not None:
            self.bearer_token = m.get('bearerToken')
        if m.get('durationSeconds') is not None:
            self.duration_seconds = m.get('durationSeconds')
        if m.get('roleArn') is not None:
            self.role_arn = m.get('roleArn')
        if m.get('oidcProviderArn') is not None:
            self.oidc_provider_arn = m.get('oidcProviderArn')
        if m.get('oidcTokenFilePath') is not None:
            self.oidc_token_file_path = m.get('oidcTokenFilePath')
        if m.get('policy') is not None:
            self.policy = m.get('policy')
        if m.get('roleSessionExpiration') is not None:
            self.role_session_expiration = m.get('roleSessionExpiration')
        if m.get('roleSessionName') is not None:
            self.role_session_name = m.get('roleSessionName')
        if m.get('publicKeyId') is not None:
            self.public_key_id = m.get('publicKeyId')
        if m.get('privateKeyFile') is not None:
            self.private_key_file = m.get('privateKeyFile')
        if m.get('roleName') is not None:
            self.role_name = m.get('roleName')
        if m.get('disableIMDSv1') is not None:
            self.disable_imds_v1 = m.get('disableIMDSv1')
        if m.get('enableIMDSv2') is not None:
            self.enable_imds_v2 = m.get('enableIMDSv2')
        if m.get('metadataTokenDuration') is not None:
            self.metadata_token_duration = m.get('metadataTokenDuration')
        if m.get('type') is not None:
            self.type = m.get('type')
        if m.get('host') is not None:
            self.host = m.get('host')
        if m.get('timeout') is not None:
            self.timeout = m.get('timeout')
        if m.get('connectTimeout') is not None:
            self.connect_timeout = m.get('connectTimeout')
        if m.get('proxy') is not None:
            self.proxy = m.get('proxy')
        if m.get('credentialsUri') is not None:
            self.credentials_uri = m.get('credentials_uri')
        if m.get('stsEndpoint') is not None:
            self.sts_endpoint = m.get('stsEndpoint')
        return self


class CredentialModel(TeaModel):
    def __init__(
            self,
            access_key_id: str = None,
            access_key_secret: str = None,
            security_token: str = None,
            bearer_token: str = None,
            type: str = None,
    ):
        # accesskey id
        self.access_key_id = access_key_id
        # accesskey secret
        self.access_key_secret = access_key_secret
        # security token
        self.security_token = security_token
        # bearer token
        self.bearer_token = bearer_token
        # type
        self.type = type

    def validate(self):
        pass

    def to_map(self):
        _map = super().to_map()
        if _map is not None:
            return _map

        result = dict()
        if self.access_key_id is not None:
            result['accessKeyId'] = self.access_key_id
        if self.access_key_secret is not None:
            result['accessKeySecret'] = self.access_key_secret
        if self.security_token is not None:
            result['securityToken'] = self.security_token
        if self.bearer_token is not None:
            result['bearerToken'] = self.bearer_token
        if self.type is not None:
            result['type'] = self.type
        return result

    def from_map(self, m: dict = None):
        m = m or dict()
        if m.get('accessKeyId') is not None:
            self.access_key_id = m.get('accessKeyId')
        if m.get('accessKeySecret') is not None:
            self.access_key_secret = m.get('accessKeySecret')
        if m.get('securityToken') is not None:
            self.security_token = m.get('securityToken')
        if m.get('bearerToken') is not None:
            self.bearer_token = m.get('bearerToken')
        if m.get('type') is not None:
            self.type = m.get('type')
        return self

    def get_access_key_id(self):
        return self.access_key_id

    def get_access_key_secret(self):
        return self.access_key_secret

    def get_security_token(self):
        return self.security_token

    def get_bearer_token(self):
        return self.bearer_token

    def get_type(self):
        return self.type
