import os

client_type = os.environ.get('ALIBABA_CLOUD_PROFILE', 'default')
environment_access_key_id = os.environ.get('ALIBABA_CLOUD_ACCESS_KEY_ID')
environment_access_key_secret = os.environ.get('ALIBABA_CLOUD_ACCESS_KEY_SECRET')
environment_security_token = os.environ.get('ALIBABA_CLOUD_SECURITY_TOKEN')
environment_ECSMeta_data = os.environ.get('ALIBABA_CLOUD_ECS_METADATA')
environment_imds_v1_disabled = os.environ.get('ALIBABA_CLOUD_IMDSV1_DISABLED')
environment_credentials_file = os.environ.get('ALIBABA_CLOUD_CREDENTIALS_FILE')
environment_oidc_token_file = os.environ.get('ALIBABA_CLOUD_OIDC_TOKEN_FILE')
environment_role_arn = os.environ.get('ALIBABA_CLOUD_ROLE_ARN')
environment_oidc_provider_arn = os.environ.get('ALIBABA_CLOUD_OIDC_PROVIDER_ARN')
environment_role_session_name = os.environ.get('ALIBABA_CLOUD_ROLE_SESSION_NAME')

environment_sts_region = os.environ.get('ALIBABA_CLOUD_STS_REGION')

enable_oidc_credential = environment_oidc_token_file is not None \
                         and environment_role_arn is not None \
                         and environment_oidc_provider_arn is not None
private_key = None


def get_private_key(file_path):
    with open(file_path, encoding='utf-8') as f:
        key = f.read()
    return key
