import calendar
import json
import time
from urllib.parse import urlparse, parse_qs

from Tea.core import TeaCore

from alibabacloud_credentials.utils import auth_constant as ac
from alibabacloud_credentials.utils import parameter_helper as ph
from alibabacloud_credentials.exceptions import CredentialException
from alibabacloud_credentials.models import CredentialModel


class Credential:
    def get_access_key_id(self):
        return

    def get_access_key_secret(self):
        return

    def get_security_token(self):
        return

    async def get_access_key_id_async(self):
        return

    async def get_access_key_secret_async(self):
        return

    async def get_security_token_async(self):
        return

    def get_credential(self):
        return

    async def get_credential_async(self):
        return


class _AutomaticallyRefreshCredentials:
    def __init__(self, expiration, provider):
        self.expiration = expiration
        self.provider = provider

    def _with_should_refresh(self):
        if self.expiration is None:
            return True
        return int(time.mktime(time.localtime())) >= (self.expiration - 180)

    def _get_new_credential(self):
        return self.provider.get_credentials()

    def _refresh_credential(self):
        if self._with_should_refresh():
            return self._get_new_credential()

    async def _get_new_credential_async(self):
        return await self.provider.get_credentials_async()

    async def _refresh_credential_async(self):
        if self._with_should_refresh():
            return await self._get_new_credential_async()


class AccessKeyCredential(Credential):
    """AccessKeyCredential"""

    def __init__(self, access_key_id, access_key_secret):
        self.access_key_id = access_key_id
        self.access_key_secret = access_key_secret
        self.credential_type = ac.ACCESS_KEY

    def get_access_key_id(self):
        return self.access_key_id

    def get_access_key_secret(self):
        return self.access_key_secret

    async def get_access_key_id_async(self):
        return self.access_key_id

    async def get_access_key_secret_async(self):
        return self.access_key_secret

    def get_credential(self):
        return CredentialModel(
            access_key_id=self.access_key_id,
            access_key_secret=self.access_key_secret,
            type=ac.ACCESS_KEY
        )

    async def get_credential_async(self):
        return CredentialModel(
            access_key_id=self.access_key_id,
            access_key_secret=self.access_key_secret,
            type=ac.ACCESS_KEY
        )


class BearerTokenCredential(Credential):
    """BearerTokenCredential"""

    def __init__(self, bearer_token):
        self.bearer_token = bearer_token
        self.credential_type = ac.BEARER

    def get_credential(self):
        return CredentialModel(
            bearer_token=self.bearer_token,
            type=ac.BEARER
        )

    async def get_credential_async(self):
        return CredentialModel(
            bearer_token=self.bearer_token,
            type=ac.BEARER
        )


class EcsRamRoleCredential(Credential, _AutomaticallyRefreshCredentials):
    """EcsRamRoleCredential"""

    def __init__(self, access_key_id, access_key_secret, security_token, expiration, provider):
        super().__init__(expiration, provider)
        self.access_key_id = access_key_id
        self.access_key_secret = access_key_secret
        self.security_token = security_token
        self.credential_type = ac.ECS_RAM_ROLE

    def _refresh_credential(self):
        credential = super()._refresh_credential()
        if credential:
            self.access_key_id = credential.access_key_id
            self.access_key_secret = credential.access_key_secret
            self.expiration = credential.expiration
            self.security_token = credential.security_token

    async def _refresh_credential_async(self):
        credential = await super()._refresh_credential_async()
        if credential:
            self.access_key_id = credential.access_key_id
            self.access_key_secret = credential.access_key_secret
            self.expiration = credential.expiration
            self.security_token = credential.security_token

    def get_access_key_id(self):
        self._refresh_credential()
        return self.access_key_id

    def get_access_key_secret(self):
        self._refresh_credential()
        return self.access_key_secret

    def get_security_token(self):
        self._refresh_credential()
        return self.security_token

    async def get_access_key_id_async(self):
        await self._refresh_credential_async()
        return self.access_key_id

    async def get_access_key_secret_async(self):
        await self._refresh_credential_async()
        return self.access_key_secret

    async def get_security_token_async(self):
        await self._refresh_credential_async()
        return self.security_token

    def get_credential(self):
        self._refresh_credential()
        return CredentialModel(
            access_key_id=self.access_key_id,
            access_key_secret=self.access_key_secret,
            security_token=self.security_token,
            type=ac.ECS_RAM_ROLE
        )

    async def get_credential_async(self):
        await self._refresh_credential_async()
        return CredentialModel(
            access_key_id=self.access_key_id,
            access_key_secret=self.access_key_secret,
            security_token=self.security_token,
            type=ac.ECS_RAM_ROLE
        )


class RamRoleArnCredential(Credential, _AutomaticallyRefreshCredentials):
    """RamRoleArnCredential"""

    def __init__(self, access_key_id, access_key_secret, security_token, expiration, provider):
        super().__init__(expiration, provider)
        self.access_key_id = access_key_id
        self.access_key_secret = access_key_secret
        self.security_token = security_token
        self.credential_type = ac.RAM_ROLE_ARN

    def _refresh_credential(self):
        credential = super()._refresh_credential()
        if credential:
            self.access_key_id = credential.access_key_id
            self.access_key_secret = credential.access_key_secret
            self.expiration = credential.expiration
            self.security_token = credential.security_token

    async def _refresh_credential_async(self):
        credential = await super()._refresh_credential_async()
        if credential:
            self.access_key_id = credential.access_key_id
            self.access_key_secret = credential.access_key_secret
            self.expiration = credential.expiration
            self.security_token = credential.security_token

    def get_access_key_id(self):
        self._refresh_credential()
        return self.access_key_id

    def get_access_key_secret(self):
        self._refresh_credential()
        return self.access_key_secret

    def get_security_token(self):
        self._refresh_credential()
        return self.security_token

    async def get_access_key_id_async(self):
        await self._refresh_credential_async()
        return self.access_key_id

    async def get_access_key_secret_async(self):
        await self._refresh_credential_async()
        return self.access_key_secret

    async def get_security_token_async(self):
        await self._refresh_credential_async()
        return self.security_token

    def get_credential(self):
        self._refresh_credential()
        return CredentialModel(
            access_key_id=self.access_key_id,
            access_key_secret=self.access_key_secret,
            security_token=self.security_token,
            type=ac.RAM_ROLE_ARN
        )

    async def get_credential_async(self):
        await self._refresh_credential_async()
        return CredentialModel(
            access_key_id=self.access_key_id,
            access_key_secret=self.access_key_secret,
            security_token=self.security_token,
            type=ac.RAM_ROLE_ARN
        )


class OIDCRoleArnCredential(Credential, _AutomaticallyRefreshCredentials):
    """OIDCRoleArnCredential"""

    def __init__(self, access_key_id, access_key_secret, security_token, expiration, provider):
        super().__init__(expiration, provider)
        self.access_key_id = access_key_id
        self.access_key_secret = access_key_secret
        self.security_token = security_token
        self.credential_type = ac.OIDC_ROLE_ARN

    def _refresh_credential(self):
        credential = super()._refresh_credential()
        if credential:
            self.access_key_id = credential.access_key_id
            self.access_key_secret = credential.access_key_secret
            self.expiration = credential.expiration
            self.security_token = credential.security_token

    async def _refresh_credential_async(self):
        credential = await super()._refresh_credential_async()
        if credential:
            self.access_key_id = credential.access_key_id
            self.access_key_secret = credential.access_key_secret
            self.expiration = credential.expiration
            self.security_token = credential.security_token

    def get_access_key_id(self):
        self._refresh_credential()
        return self.access_key_id

    def get_access_key_secret(self):
        self._refresh_credential()
        return self.access_key_secret

    def get_security_token(self):
        self._refresh_credential()
        return self.security_token

    async def get_access_key_id_async(self):
        await self._refresh_credential_async()
        return self.access_key_id

    async def get_access_key_secret_async(self):
        await self._refresh_credential_async()
        return self.access_key_secret

    async def get_security_token_async(self):
        await self._refresh_credential_async()
        return self.security_token

    def get_credential(self):
        self._refresh_credential()
        return CredentialModel(
            access_key_id=self.access_key_id,
            access_key_secret=self.access_key_secret,
            security_token=self.security_token,
            type=ac.OIDC_ROLE_ARN
        )

    async def get_credential_async(self):
        await self._refresh_credential_async()
        return CredentialModel(
            access_key_id=self.access_key_id,
            access_key_secret=self.access_key_secret,
            security_token=self.security_token,
            type=ac.OIDC_ROLE_ARN
        )


class CredentialsURICredential(Credential):
    """CredentialsURICredential"""

    def __init__(self, credentials_uri):
        self.access_key_id = None
        self.access_key_secret = None
        self.security_token = None
        self.expiration = None
        self.credentials_uri = credentials_uri
        self.credential_type = ac.CREDENTIALS_URI

    def _need_refresh(self):
        if self.expiration is None:
            return True

        return int(time.mktime(time.localtime())) >= (self.expiration - 180)

    def _ensure_credential(self):
        if self._need_refresh():
            self._get_new_credential()

    async def _ensure_credential_async(self):
        if self._need_refresh():
            await self._get_new_credential_async()

    def _get_new_credential(self):
        r = urlparse(self.credentials_uri)
        tea_request = ph.get_new_request()
        tea_request.headers['host'] = r.hostname
        tea_request.port = r.port
        tea_request.method = 'GET'
        tea_request.pathname = r.path
        for key, values in parse_qs(r.query).items():
            for value in values:
                tea_request.query[key] = value
        response = TeaCore.do_action(tea_request)
        if response.status_code != 200:
            raise CredentialException(
                "Get credentials from " + self.credentials_uri + " failed,  HttpCode=" + str(response.status_code))
        body = response.body.decode('utf-8')

        dic = json.loads(body)
        content_code = dic.get('Code')
        content_access_key_id = dic.get('AccessKeyId')
        content_access_key_secret = dic.get('AccessKeySecret')
        content_security_token = dic.get('SecurityToken')
        content_expiration = dic.get('Expiration')

        if content_code != "Success":
            raise CredentialException(
                "Get credentials from " + self.credentials_uri + " failed,  Code is " + content_code)

        # 先转换为时间数组
        time_array = time.strptime(content_expiration, "%Y-%m-%dT%H:%M:%SZ")
        # 转换为时间戳
        time_stamp = calendar.timegm(time_array)
        self.access_key_id = content_access_key_id
        self.access_key_secret = content_access_key_secret
        self.security_token = content_security_token
        self.expiration = time_stamp

    async def _get_new_credential_async(self):
        r = urlparse(self.credentials_uri)
        tea_request = ph.get_new_request()
        tea_request.headers['host'] = r.netloc
        tea_request.method = 'GET'
        tea_request.pathname = r.path
        tea_request.query = parse_qs(r.query)
        response = await TeaCore.async_do_action(tea_request)
        if response.status_code != 200:
            raise CredentialException(
                "Get credentials from " + self.credentials_uri + " failed,  HttpCode=" + str(response.status_code))
        body = response.body.decode('utf-8')

        dic = json.loads(body)
        content_code = dic.get('Code')
        content_access_key_id = dic.get('AccessKeyId')
        content_access_key_secret = dic.get('AccessKeySecret')
        content_security_token = dic.get('SecurityToken')
        content_expiration = dic.get('Expiration')

        if content_code != "Success":
            raise CredentialException(
                "Get credentials from " + self.credentials_uri + " failed,  Code is " + content_code)

        # 先转换为时间数组
        time_array = time.strptime(content_expiration, "%Y-%m-%dT%H:%M:%SZ")
        # 转换为时间戳
        time_stamp = calendar.timegm(time_array)
        self.access_key_id = content_access_key_id
        self.access_key_secret = content_access_key_secret
        self.security_token = content_security_token
        self.expiration = time_stamp

    def get_access_key_id(self):
        self._ensure_credential()
        return self.access_key_id

    def get_access_key_secret(self):
        self._ensure_credential()
        return self.access_key_secret

    def get_security_token(self):
        self._ensure_credential()
        return self.security_token

    async def get_access_key_id_async(self):
        await self._ensure_credential_async()
        return self.access_key_id

    async def get_access_key_secret_async(self):
        await self._ensure_credential_async()
        return self.access_key_secret

    async def get_security_token_async(self):
        await self._ensure_credential_async()
        return self.security_token

    def get_credential(self):
        self._ensure_credential()
        return CredentialModel(
            access_key_id=self.access_key_id,
            access_key_secret=self.access_key_secret,
            security_token=self.security_token,
            type=ac.CREDENTIALS_URI
        )

    async def get_credential_async(self):
        await self._ensure_credential_async()
        return CredentialModel(
            access_key_id=self.access_key_id,
            access_key_secret=self.access_key_secret,
            security_token=self.security_token,
            type=ac.CREDENTIALS_URI
        )


class RsaKeyPairCredential(Credential, _AutomaticallyRefreshCredentials):
    def __init__(self, access_key_id, access_key_secret, expiration, provider):
        super().__init__(expiration, provider)
        self.access_key_id = access_key_id
        self.access_key_secret = access_key_secret
        self.credential_type = ac.RSA_KEY_PAIR

    def _refresh_credential(self):
        credential = super()._refresh_credential()
        if credential:
            self.access_key_id = credential.access_key_id
            self.access_key_secret = credential.access_key_secret
            self.expiration = credential.expiration

    async def _refresh_credential_async(self):
        credential = await super()._refresh_credential_async()
        if credential:
            self.access_key_id = credential.access_key_id
            self.access_key_secret = credential.access_key_secret
            self.expiration = credential.expiration
            self.security_token = credential.security_token

    def get_access_key_id(self):
        self._refresh_credential()
        return self.access_key_id

    def get_access_key_secret(self):
        self._refresh_credential()
        return self.access_key_secret

    async def get_access_key_id_async(self):
        await self._refresh_credential_async()
        return self.access_key_id

    async def get_access_key_secret_async(self):
        await self._refresh_credential_async()
        return self.access_key_secret

    def get_credential(self):
        self._refresh_credential()
        return CredentialModel(
            access_key_id=self.access_key_id,
            access_key_secret=self.access_key_secret,
            type=ac.RSA_KEY_PAIR
        )

    async def get_credential_async(self):
        await self._refresh_credential_async()
        return CredentialModel(
            access_key_id=self.access_key_id,
            access_key_secret=self.access_key_secret,
            type=ac.RSA_KEY_PAIR
        )


class StsCredential(Credential):
    def __init__(self, access_key_id, access_key_secret, security_token):
        self.access_key_id = access_key_id
        self.access_key_secret = access_key_secret
        self.security_token = security_token
        self.credential_type = ac.STS

    def get_access_key_id(self):
        return self.access_key_id

    def get_access_key_secret(self):
        return self.access_key_secret

    def get_security_token(self):
        return self.security_token

    async def get_access_key_id_async(self):
        return self.access_key_id

    async def get_access_key_secret_async(self):
        return self.access_key_secret

    async def get_security_token_async(self):
        return self.security_token

    def get_credential(self):
        return CredentialModel(
            access_key_id=self.access_key_id,
            access_key_secret=self.access_key_secret,
            security_token=self.security_token,
            type=ac.STS
        )

    async def get_credential_async(self):
        return CredentialModel(
            access_key_id=self.access_key_id,
            access_key_secret=self.access_key_secret,
            security_token=self.security_token,
            type=ac.STS
        )
