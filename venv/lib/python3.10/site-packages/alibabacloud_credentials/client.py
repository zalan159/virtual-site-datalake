from functools import wraps

from alibabacloud_credentials import credentials, providers, models
from alibabacloud_credentials.utils import auth_constant as ac
from Tea.decorators import deprecated


def attribute_error_return_none(f):
    @wraps(f)
    def i(*args, **kwargs):
        try:
            return f(*args, **kwargs)
        except AttributeError:
            return

    return i


class Client:
    cloud_credential = None

    def __init__(self, config=None):
        if config is None:
            provider = providers.DefaultCredentialsProvider()
            self.cloud_credential = provider.get_credentials()
            return
        self.cloud_credential = Client.get_credentials(config)

    def get_credential(self) -> models.CredentialModel:
        """
        Get credential
        @return: the whole credential
        """
        return self.cloud_credential.get_credential()

    async def get_credential_async(self) -> models.CredentialModel:
        """
        Get credential
        @return: the whole credential
        """
        return await self.cloud_credential.get_credential_async()

    @staticmethod
    def get_credentials(config):
        if config.type == ac.ACCESS_KEY:
            return credentials.AccessKeyCredential(config.access_key_id, config.access_key_secret)
        elif config.type == ac.STS:
            return credentials.StsCredential(config.access_key_id, config.access_key_secret, config.security_token)
        elif config.type == ac.BEARER:
            return credentials.BearerTokenCredential(config.bearer_token)
        elif config.type == ac.ECS_RAM_ROLE:
            return credentials.EcsRamRoleCredential(
                config.access_key_id,
                config.access_key_secret,
                config.security_token,
                0,
                providers.EcsRamRoleCredentialProvider(config=config)
            )
        elif config.type == ac.CREDENTIALS_URI:
            return credentials.CredentialsURICredential(config.credentials_uri)
        elif config.type == ac.RAM_ROLE_ARN:
            return credentials.RamRoleArnCredential(
                config.access_key_id,
                config.access_key_secret,
                config.security_token,
                0,
                providers.RamRoleArnCredentialProvider(config=config)
            )
        elif config.type == ac.RSA_KEY_PAIR:
            return credentials.RsaKeyPairCredential(
                config.access_key_id,
                config.access_key_secret,
                0,
                providers.RsaKeyPairCredentialProvider(config=config)
            )
        elif config.type == ac.OIDC_ROLE_ARN:
            return credentials.OIDCRoleArnCredential(
                config.access_key_id,
                config.access_key_secret,
                config.security_token,
                0,
                providers.OIDCRoleArnCredentialProvider(config=config))
        return providers.DefaultCredentialsProvider().get_credentials()

    @deprecated("Use 'get_credential().access_key_id' instead")
    def get_access_key_id(self):
        return self.cloud_credential.get_access_key_id()

    @deprecated("Use 'get_credential().access_key_secret' instead")
    def get_access_key_secret(self):
        return self.cloud_credential.get_access_key_secret()

    @deprecated("Use 'get_credential().security_token' instead")
    def get_security_token(self):
        return self.cloud_credential.get_security_token()

    @deprecated("Use 'get_credential_async().access_key_id' instead")
    async def get_access_key_id_async(self):
        return await self.cloud_credential.get_access_key_id_async()

    @deprecated("Use 'get_credential_async().access_key_secret' instead")
    async def get_access_key_secret_async(self):
        return await self.cloud_credential.get_access_key_secret_async()

    @deprecated("Use 'get_credential_async().security_token' instead")
    async def get_security_token_async(self):
        return await self.cloud_credential.get_security_token_async()

    @deprecated("Use 'get_credential().type' instead")
    @attribute_error_return_none
    def get_type(self):
        return self.cloud_credential.credential_type

    @deprecated("Use 'get_credential().bearer_token' instead")
    @attribute_error_return_none
    def get_bearer_token(self):
        return self.cloud_credential.bearer_token
