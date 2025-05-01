# -*- coding: utf-8 -*-
# This file is auto-generated, don't edit it. Thanks.
import time

from Tea.exceptions import TeaException, UnretryableException
from Tea.request import TeaRequest
from Tea.core import TeaCore
from typing import Dict, Any

from alibabacloud_credentials.client import Client as CredentialClient
from alibabacloud_gateway_spi.client import Client as SPIClient
from alibabacloud_tea_openapi import models as open_api_models
from alibabacloud_tea_util.client import Client as UtilClient
from alibabacloud_credentials import models as credential_models
from alibabacloud_tea_util import models as util_models
from alibabacloud_openapi_util.client import Client as OpenApiUtilClient
from alibabacloud_tea_xml.client import Client as XMLClient
from alibabacloud_gateway_spi import models as spi_models


class Client:
    """
    This is for OpenApi SDK
    """
    _endpoint: str = None
    _region_id: str = None
    _protocol: str = None
    _method: str = None
    _user_agent: str = None
    _endpoint_rule: str = None
    _endpoint_map: Dict[str, str] = None
    _suffix: str = None
    _read_timeout: int = None
    _connect_timeout: int = None
    _http_proxy: str = None
    _https_proxy: str = None
    _socks_5proxy: str = None
    _socks_5net_work: str = None
    _no_proxy: str = None
    _network: str = None
    _product_id: str = None
    _max_idle_conns: int = None
    _endpoint_type: str = None
    _open_platform_endpoint: str = None
    _credential: CredentialClient = None
    _signature_version: str = None
    _signature_algorithm: str = None
    _headers: Dict[str, str] = None
    _spi: SPIClient = None
    _global_parameters: open_api_models.GlobalParameters = None
    _key: str = None
    _cert: str = None
    _ca: str = None

    def __init__(
        self, 
        config: open_api_models.Config,
    ):
        """
        Init client with Config
        @param config: config contains the necessary information to create a client
        """
        if UtilClient.is_unset(config):
            raise TeaException({
                'code': 'ParameterMissing',
                'message': "'config' can not be unset"
            })
        if not UtilClient.empty(config.access_key_id) and not UtilClient.empty(config.access_key_secret):
            if not UtilClient.empty(config.security_token):
                config.type = 'sts'
            else:
                config.type = 'access_key'
            credential_config = credential_models.Config(
                access_key_id=config.access_key_id,
                type=config.type,
                access_key_secret=config.access_key_secret
            )
            credential_config.security_token = config.security_token
            self._credential = CredentialClient(credential_config)
        elif not UtilClient.is_unset(config.credential):
            self._credential = config.credential
        self._endpoint = config.endpoint
        self._endpoint_type = config.endpoint_type
        self._network = config.network
        self._suffix = config.suffix
        self._protocol = config.protocol
        self._method = config.method
        self._region_id = config.region_id
        self._user_agent = config.user_agent
        self._read_timeout = config.read_timeout
        self._connect_timeout = config.connect_timeout
        self._http_proxy = config.http_proxy
        self._https_proxy = config.https_proxy
        self._no_proxy = config.no_proxy
        self._socks_5proxy = config.socks_5proxy
        self._socks_5net_work = config.socks_5net_work
        self._max_idle_conns = config.max_idle_conns
        self._signature_version = config.signature_version
        self._signature_algorithm = config.signature_algorithm
        self._global_parameters = config.global_parameters
        self._key = config.key
        self._cert = config.cert
        self._ca = config.ca

    def do_rpcrequest(
        self,
        action: str,
        version: str,
        protocol: str,
        method: str,
        auth_type: str,
        body_type: str,
        request: open_api_models.OpenApiRequest,
        runtime: util_models.RuntimeOptions,
    ) -> dict:
        """
        Encapsulate the request and invoke the network
        @param action: api name
        @param version: product version
        @param protocol: http or https
        @param method: e.g. GET
        @param auth_type: authorization type e.g. AK
        @param body_type: response body type e.g. String
        @param request: object of OpenApiRequest
        @param runtime: which controls some details of call api, such as retry times
        @return: the response
        """
        request.validate()
        runtime.validate()
        _runtime = {
            'timeouted': 'retry',
            'key': UtilClient.default_string(runtime.key, self._key),
            'cert': UtilClient.default_string(runtime.cert, self._cert),
            'ca': UtilClient.default_string(runtime.ca, self._ca),
            'readTimeout': UtilClient.default_number(runtime.read_timeout, self._read_timeout),
            'connectTimeout': UtilClient.default_number(runtime.connect_timeout, self._connect_timeout),
            'httpProxy': UtilClient.default_string(runtime.http_proxy, self._http_proxy),
            'httpsProxy': UtilClient.default_string(runtime.https_proxy, self._https_proxy),
            'noProxy': UtilClient.default_string(runtime.no_proxy, self._no_proxy),
            'socks5Proxy': UtilClient.default_string(runtime.socks_5proxy, self._socks_5proxy),
            'socks5NetWork': UtilClient.default_string(runtime.socks_5net_work, self._socks_5net_work),
            'maxIdleConns': UtilClient.default_number(runtime.max_idle_conns, self._max_idle_conns),
            'retry': {
                'retryable': runtime.autoretry,
                'maxAttempts': UtilClient.default_number(runtime.max_attempts, 3)
            },
            'backoff': {
                'policy': UtilClient.default_string(runtime.backoff_policy, 'no'),
                'period': UtilClient.default_number(runtime.backoff_period, 1)
            },
            'ignoreSSL': runtime.ignore_ssl
        }
        _last_request = None
        _last_exception = None
        _now = time.time()
        _retry_times = 0
        while TeaCore.allow_retry(_runtime.get('retry'), _retry_times, _now):
            if _retry_times > 0:
                _backoff_time = TeaCore.get_backoff_time(_runtime.get('backoff'), _retry_times)
                if _backoff_time > 0:
                    TeaCore.sleep(_backoff_time)
            _retry_times = _retry_times + 1
            try:
                _request = TeaRequest()
                _request.protocol = UtilClient.default_string(self._protocol, protocol)
                _request.method = method
                _request.pathname = '/'
                global_queries = {}
                global_headers = {}
                if not UtilClient.is_unset(self._global_parameters):
                    global_params = self._global_parameters
                    if not UtilClient.is_unset(global_params.queries):
                        global_queries = global_params.queries
                    if not UtilClient.is_unset(global_params.headers):
                        global_headers = global_params.headers
                _request.query = TeaCore.merge({
                    'Action': action,
                    'Format': 'json',
                    'Version': version,
                    'Timestamp': OpenApiUtilClient.get_timestamp(),
                    'SignatureNonce': UtilClient.get_nonce()
                }, global_queries,
                    request.query)
                headers = self.get_rpc_headers()
                if UtilClient.is_unset(headers):
                    # endpoint is setted in product client
                    _request.headers = TeaCore.merge({
                        'host': self._endpoint,
                        'x-acs-version': version,
                        'x-acs-action': action,
                        'user-agent': self.get_user_agent()
                    }, global_headers)
                else:
                    _request.headers = TeaCore.merge({
                        'host': self._endpoint,
                        'x-acs-version': version,
                        'x-acs-action': action,
                        'user-agent': self.get_user_agent()
                    }, global_headers,
                        headers)
                if not UtilClient.is_unset(request.body):
                    m = UtilClient.assert_as_map(request.body)
                    tmp = UtilClient.anyify_map_value(OpenApiUtilClient.query(m))
                    _request.body = UtilClient.to_form_string(tmp)
                    _request.headers['content-type'] = 'application/x-www-form-urlencoded'
                if not UtilClient.equal_string(auth_type, 'Anonymous'):
                    access_key_id = self.get_access_key_id()
                    access_key_secret = self.get_access_key_secret()
                    security_token = self.get_security_token()
                    if not UtilClient.empty(security_token):
                        _request.query['SecurityToken'] = security_token
                    _request.query['SignatureMethod'] = 'HMAC-SHA1'
                    _request.query['SignatureVersion'] = '1.0'
                    _request.query['AccessKeyId'] = access_key_id
                    t = None
                    if not UtilClient.is_unset(request.body):
                        t = UtilClient.assert_as_map(request.body)
                    signed_param = TeaCore.merge(_request.query,
                        OpenApiUtilClient.query(t))
                    _request.query['Signature'] = OpenApiUtilClient.get_rpcsignature(signed_param, _request.method, access_key_secret)
                _last_request = _request
                _response = TeaCore.do_action(_request, _runtime)
                if UtilClient.is_4xx(_response.status_code) or UtilClient.is_5xx(_response.status_code):
                    _res = UtilClient.read_as_json(_response.body)
                    err = UtilClient.assert_as_map(_res)
                    request_id = self.default_any(err.get('RequestId'), err.get('requestId'))
                    err['statusCode'] = _response.status_code
                    raise TeaException({
                        'code': f"{self.default_any(err.get('Code'), err.get('code'))}",
                        'message': f"code: {_response.status_code}, {self.default_any(err.get('Message'), err.get('message'))} request id: {request_id}",
                        'data': err,
                        'description': f"{self.default_any(err.get('Description'), err.get('description'))}",
                        'accessDeniedDetail': self.default_any(err.get('AccessDeniedDetail'), err.get('accessDeniedDetail'))
                    })
                if UtilClient.equal_string(body_type, 'binary'):
                    resp = {
                        'body': _response.body,
                        'headers': _response.headers,
                        'statusCode': _response.status_code
                    }
                    return resp
                elif UtilClient.equal_string(body_type, 'byte'):
                    byt = UtilClient.read_as_bytes(_response.body)
                    return {
                        'body': byt,
                        'headers': _response.headers,
                        'statusCode': _response.status_code
                    }
                elif UtilClient.equal_string(body_type, 'string'):
                    str = UtilClient.read_as_string(_response.body)
                    return {
                        'body': str,
                        'headers': _response.headers,
                        'statusCode': _response.status_code
                    }
                elif UtilClient.equal_string(body_type, 'json'):
                    obj = UtilClient.read_as_json(_response.body)
                    res = UtilClient.assert_as_map(obj)
                    return {
                        'body': res,
                        'headers': _response.headers,
                        'statusCode': _response.status_code
                    }
                elif UtilClient.equal_string(body_type, 'array'):
                    arr = UtilClient.read_as_json(_response.body)
                    return {
                        'body': arr,
                        'headers': _response.headers,
                        'statusCode': _response.status_code
                    }
                else:
                    return {
                        'headers': _response.headers,
                        'statusCode': _response.status_code
                    }
            except Exception as e:
                if TeaCore.is_retryable(e):
                    _last_exception = e
                    continue
                raise e
        raise UnretryableException(_last_request, _last_exception)

    async def do_rpcrequest_async(
        self,
        action: str,
        version: str,
        protocol: str,
        method: str,
        auth_type: str,
        body_type: str,
        request: open_api_models.OpenApiRequest,
        runtime: util_models.RuntimeOptions,
    ) -> dict:
        """
        Encapsulate the request and invoke the network
        @param action: api name
        @param version: product version
        @param protocol: http or https
        @param method: e.g. GET
        @param auth_type: authorization type e.g. AK
        @param body_type: response body type e.g. String
        @param request: object of OpenApiRequest
        @param runtime: which controls some details of call api, such as retry times
        @return: the response
        """
        request.validate()
        runtime.validate()
        _runtime = {
            'timeouted': 'retry',
            'key': UtilClient.default_string(runtime.key, self._key),
            'cert': UtilClient.default_string(runtime.cert, self._cert),
            'ca': UtilClient.default_string(runtime.ca, self._ca),
            'readTimeout': UtilClient.default_number(runtime.read_timeout, self._read_timeout),
            'connectTimeout': UtilClient.default_number(runtime.connect_timeout, self._connect_timeout),
            'httpProxy': UtilClient.default_string(runtime.http_proxy, self._http_proxy),
            'httpsProxy': UtilClient.default_string(runtime.https_proxy, self._https_proxy),
            'noProxy': UtilClient.default_string(runtime.no_proxy, self._no_proxy),
            'socks5Proxy': UtilClient.default_string(runtime.socks_5proxy, self._socks_5proxy),
            'socks5NetWork': UtilClient.default_string(runtime.socks_5net_work, self._socks_5net_work),
            'maxIdleConns': UtilClient.default_number(runtime.max_idle_conns, self._max_idle_conns),
            'retry': {
                'retryable': runtime.autoretry,
                'maxAttempts': UtilClient.default_number(runtime.max_attempts, 3)
            },
            'backoff': {
                'policy': UtilClient.default_string(runtime.backoff_policy, 'no'),
                'period': UtilClient.default_number(runtime.backoff_period, 1)
            },
            'ignoreSSL': runtime.ignore_ssl
        }
        _last_request = None
        _last_exception = None
        _now = time.time()
        _retry_times = 0
        while TeaCore.allow_retry(_runtime.get('retry'), _retry_times, _now):
            if _retry_times > 0:
                _backoff_time = TeaCore.get_backoff_time(_runtime.get('backoff'), _retry_times)
                if _backoff_time > 0:
                    TeaCore.sleep(_backoff_time)
            _retry_times = _retry_times + 1
            try:
                _request = TeaRequest()
                _request.protocol = UtilClient.default_string(self._protocol, protocol)
                _request.method = method
                _request.pathname = '/'
                global_queries = {}
                global_headers = {}
                if not UtilClient.is_unset(self._global_parameters):
                    global_params = self._global_parameters
                    if not UtilClient.is_unset(global_params.queries):
                        global_queries = global_params.queries
                    if not UtilClient.is_unset(global_params.headers):
                        global_headers = global_params.headers
                _request.query = TeaCore.merge({
                    'Action': action,
                    'Format': 'json',
                    'Version': version,
                    'Timestamp': OpenApiUtilClient.get_timestamp(),
                    'SignatureNonce': UtilClient.get_nonce()
                }, global_queries,
                    request.query)
                headers = self.get_rpc_headers()
                if UtilClient.is_unset(headers):
                    # endpoint is setted in product client
                    _request.headers = TeaCore.merge({
                        'host': self._endpoint,
                        'x-acs-version': version,
                        'x-acs-action': action,
                        'user-agent': self.get_user_agent()
                    }, global_headers)
                else:
                    _request.headers = TeaCore.merge({
                        'host': self._endpoint,
                        'x-acs-version': version,
                        'x-acs-action': action,
                        'user-agent': self.get_user_agent()
                    }, global_headers,
                        headers)
                if not UtilClient.is_unset(request.body):
                    m = UtilClient.assert_as_map(request.body)
                    tmp = UtilClient.anyify_map_value(OpenApiUtilClient.query(m))
                    _request.body = UtilClient.to_form_string(tmp)
                    _request.headers['content-type'] = 'application/x-www-form-urlencoded'
                if not UtilClient.equal_string(auth_type, 'Anonymous'):
                    access_key_id = await self.get_access_key_id_async()
                    access_key_secret = await self.get_access_key_secret_async()
                    security_token = await self.get_security_token_async()
                    if not UtilClient.empty(security_token):
                        _request.query['SecurityToken'] = security_token
                    _request.query['SignatureMethod'] = 'HMAC-SHA1'
                    _request.query['SignatureVersion'] = '1.0'
                    _request.query['AccessKeyId'] = access_key_id
                    t = None
                    if not UtilClient.is_unset(request.body):
                        t = UtilClient.assert_as_map(request.body)
                    signed_param = TeaCore.merge(_request.query,
                        OpenApiUtilClient.query(t))
                    _request.query['Signature'] = OpenApiUtilClient.get_rpcsignature(signed_param, _request.method, access_key_secret)
                _last_request = _request
                _response = await TeaCore.async_do_action(_request, _runtime)
                if UtilClient.is_4xx(_response.status_code) or UtilClient.is_5xx(_response.status_code):
                    _res = await UtilClient.read_as_json_async(_response.body)
                    err = UtilClient.assert_as_map(_res)
                    request_id = self.default_any(err.get('RequestId'), err.get('requestId'))
                    err['statusCode'] = _response.status_code
                    raise TeaException({
                        'code': f"{self.default_any(err.get('Code'), err.get('code'))}",
                        'message': f"code: {_response.status_code}, {self.default_any(err.get('Message'), err.get('message'))} request id: {request_id}",
                        'data': err,
                        'description': f"{self.default_any(err.get('Description'), err.get('description'))}",
                        'accessDeniedDetail': self.default_any(err.get('AccessDeniedDetail'), err.get('accessDeniedDetail'))
                    })
                if UtilClient.equal_string(body_type, 'binary'):
                    resp = {
                        'body': _response.body,
                        'headers': _response.headers,
                        'statusCode': _response.status_code
                    }
                    return resp
                elif UtilClient.equal_string(body_type, 'byte'):
                    byt = await UtilClient.read_as_bytes_async(_response.body)
                    return {
                        'body': byt,
                        'headers': _response.headers,
                        'statusCode': _response.status_code
                    }
                elif UtilClient.equal_string(body_type, 'string'):
                    str = await UtilClient.read_as_string_async(_response.body)
                    return {
                        'body': str,
                        'headers': _response.headers,
                        'statusCode': _response.status_code
                    }
                elif UtilClient.equal_string(body_type, 'json'):
                    obj = await UtilClient.read_as_json_async(_response.body)
                    res = UtilClient.assert_as_map(obj)
                    return {
                        'body': res,
                        'headers': _response.headers,
                        'statusCode': _response.status_code
                    }
                elif UtilClient.equal_string(body_type, 'array'):
                    arr = await UtilClient.read_as_json_async(_response.body)
                    return {
                        'body': arr,
                        'headers': _response.headers,
                        'statusCode': _response.status_code
                    }
                else:
                    return {
                        'headers': _response.headers,
                        'statusCode': _response.status_code
                    }
            except Exception as e:
                if TeaCore.is_retryable(e):
                    _last_exception = e
                    continue
                raise e
        raise UnretryableException(_last_request, _last_exception)

    def do_roarequest(
        self,
        action: str,
        version: str,
        protocol: str,
        method: str,
        auth_type: str,
        pathname: str,
        body_type: str,
        request: open_api_models.OpenApiRequest,
        runtime: util_models.RuntimeOptions,
    ) -> dict:
        """
        Encapsulate the request and invoke the network
        @param action: api name
        @param version: product version
        @param protocol: http or https
        @param method: e.g. GET
        @param auth_type: authorization type e.g. AK
        @param pathname: pathname of every api
        @param body_type: response body type e.g. String
        @param request: object of OpenApiRequest
        @param runtime: which controls some details of call api, such as retry times
        @return: the response
        """
        request.validate()
        runtime.validate()
        _runtime = {
            'timeouted': 'retry',
            'key': UtilClient.default_string(runtime.key, self._key),
            'cert': UtilClient.default_string(runtime.cert, self._cert),
            'ca': UtilClient.default_string(runtime.ca, self._ca),
            'readTimeout': UtilClient.default_number(runtime.read_timeout, self._read_timeout),
            'connectTimeout': UtilClient.default_number(runtime.connect_timeout, self._connect_timeout),
            'httpProxy': UtilClient.default_string(runtime.http_proxy, self._http_proxy),
            'httpsProxy': UtilClient.default_string(runtime.https_proxy, self._https_proxy),
            'noProxy': UtilClient.default_string(runtime.no_proxy, self._no_proxy),
            'socks5Proxy': UtilClient.default_string(runtime.socks_5proxy, self._socks_5proxy),
            'socks5NetWork': UtilClient.default_string(runtime.socks_5net_work, self._socks_5net_work),
            'maxIdleConns': UtilClient.default_number(runtime.max_idle_conns, self._max_idle_conns),
            'retry': {
                'retryable': runtime.autoretry,
                'maxAttempts': UtilClient.default_number(runtime.max_attempts, 3)
            },
            'backoff': {
                'policy': UtilClient.default_string(runtime.backoff_policy, 'no'),
                'period': UtilClient.default_number(runtime.backoff_period, 1)
            },
            'ignoreSSL': runtime.ignore_ssl
        }
        _last_request = None
        _last_exception = None
        _now = time.time()
        _retry_times = 0
        while TeaCore.allow_retry(_runtime.get('retry'), _retry_times, _now):
            if _retry_times > 0:
                _backoff_time = TeaCore.get_backoff_time(_runtime.get('backoff'), _retry_times)
                if _backoff_time > 0:
                    TeaCore.sleep(_backoff_time)
            _retry_times = _retry_times + 1
            try:
                _request = TeaRequest()
                _request.protocol = UtilClient.default_string(self._protocol, protocol)
                _request.method = method
                _request.pathname = pathname
                global_queries = {}
                global_headers = {}
                if not UtilClient.is_unset(self._global_parameters):
                    global_params = self._global_parameters
                    if not UtilClient.is_unset(global_params.queries):
                        global_queries = global_params.queries
                    if not UtilClient.is_unset(global_params.headers):
                        global_headers = global_params.headers
                _request.headers = TeaCore.merge({
                    'date': UtilClient.get_date_utcstring(),
                    'host': self._endpoint,
                    'accept': 'application/json',
                    'x-acs-signature-nonce': UtilClient.get_nonce(),
                    'x-acs-signature-method': 'HMAC-SHA1',
                    'x-acs-signature-version': '1.0',
                    'x-acs-version': version,
                    'x-acs-action': action,
                    'user-agent': UtilClient.get_user_agent(self._user_agent)
                }, global_headers,
                    request.headers)
                if not UtilClient.is_unset(request.body):
                    _request.body = UtilClient.to_jsonstring(request.body)
                    _request.headers['content-type'] = 'application/json; charset=utf-8'
                _request.query = global_queries
                if not UtilClient.is_unset(request.query):
                    _request.query = TeaCore.merge(_request.query,
                        request.query)
                if not UtilClient.equal_string(auth_type, 'Anonymous'):
                    access_key_id = self.get_access_key_id()
                    access_key_secret = self.get_access_key_secret()
                    security_token = self.get_security_token()
                    if not UtilClient.empty(security_token):
                        _request.headers['x-acs-accesskey-id'] = access_key_id
                        _request.headers['x-acs-security-token'] = security_token
                    string_to_sign = OpenApiUtilClient.get_string_to_sign(_request)
                    _request.headers['authorization'] = f'acs {access_key_id}:{OpenApiUtilClient.get_roasignature(string_to_sign, access_key_secret)}'
                _last_request = _request
                _response = TeaCore.do_action(_request, _runtime)
                if UtilClient.equal_number(_response.status_code, 204):
                    return {
                        'headers': _response.headers
                    }
                if UtilClient.is_4xx(_response.status_code) or UtilClient.is_5xx(_response.status_code):
                    _res = UtilClient.read_as_json(_response.body)
                    err = UtilClient.assert_as_map(_res)
                    request_id = self.default_any(err.get('RequestId'), err.get('requestId'))
                    request_id = self.default_any(request_id, err.get('requestid'))
                    err['statusCode'] = _response.status_code
                    raise TeaException({
                        'code': f"{self.default_any(err.get('Code'), err.get('code'))}",
                        'message': f"code: {_response.status_code}, {self.default_any(err.get('Message'), err.get('message'))} request id: {request_id}",
                        'data': err,
                        'description': f"{self.default_any(err.get('Description'), err.get('description'))}",
                        'accessDeniedDetail': self.default_any(err.get('AccessDeniedDetail'), err.get('accessDeniedDetail'))
                    })
                if UtilClient.equal_string(body_type, 'binary'):
                    resp = {
                        'body': _response.body,
                        'headers': _response.headers,
                        'statusCode': _response.status_code
                    }
                    return resp
                elif UtilClient.equal_string(body_type, 'byte'):
                    byt = UtilClient.read_as_bytes(_response.body)
                    return {
                        'body': byt,
                        'headers': _response.headers,
                        'statusCode': _response.status_code
                    }
                elif UtilClient.equal_string(body_type, 'string'):
                    str = UtilClient.read_as_string(_response.body)
                    return {
                        'body': str,
                        'headers': _response.headers,
                        'statusCode': _response.status_code
                    }
                elif UtilClient.equal_string(body_type, 'json'):
                    obj = UtilClient.read_as_json(_response.body)
                    res = UtilClient.assert_as_map(obj)
                    return {
                        'body': res,
                        'headers': _response.headers,
                        'statusCode': _response.status_code
                    }
                elif UtilClient.equal_string(body_type, 'array'):
                    arr = UtilClient.read_as_json(_response.body)
                    return {
                        'body': arr,
                        'headers': _response.headers,
                        'statusCode': _response.status_code
                    }
                else:
                    return {
                        'headers': _response.headers,
                        'statusCode': _response.status_code
                    }
            except Exception as e:
                if TeaCore.is_retryable(e):
                    _last_exception = e
                    continue
                raise e
        raise UnretryableException(_last_request, _last_exception)

    async def do_roarequest_async(
        self,
        action: str,
        version: str,
        protocol: str,
        method: str,
        auth_type: str,
        pathname: str,
        body_type: str,
        request: open_api_models.OpenApiRequest,
        runtime: util_models.RuntimeOptions,
    ) -> dict:
        """
        Encapsulate the request and invoke the network
        @param action: api name
        @param version: product version
        @param protocol: http or https
        @param method: e.g. GET
        @param auth_type: authorization type e.g. AK
        @param pathname: pathname of every api
        @param body_type: response body type e.g. String
        @param request: object of OpenApiRequest
        @param runtime: which controls some details of call api, such as retry times
        @return: the response
        """
        request.validate()
        runtime.validate()
        _runtime = {
            'timeouted': 'retry',
            'key': UtilClient.default_string(runtime.key, self._key),
            'cert': UtilClient.default_string(runtime.cert, self._cert),
            'ca': UtilClient.default_string(runtime.ca, self._ca),
            'readTimeout': UtilClient.default_number(runtime.read_timeout, self._read_timeout),
            'connectTimeout': UtilClient.default_number(runtime.connect_timeout, self._connect_timeout),
            'httpProxy': UtilClient.default_string(runtime.http_proxy, self._http_proxy),
            'httpsProxy': UtilClient.default_string(runtime.https_proxy, self._https_proxy),
            'noProxy': UtilClient.default_string(runtime.no_proxy, self._no_proxy),
            'socks5Proxy': UtilClient.default_string(runtime.socks_5proxy, self._socks_5proxy),
            'socks5NetWork': UtilClient.default_string(runtime.socks_5net_work, self._socks_5net_work),
            'maxIdleConns': UtilClient.default_number(runtime.max_idle_conns, self._max_idle_conns),
            'retry': {
                'retryable': runtime.autoretry,
                'maxAttempts': UtilClient.default_number(runtime.max_attempts, 3)
            },
            'backoff': {
                'policy': UtilClient.default_string(runtime.backoff_policy, 'no'),
                'period': UtilClient.default_number(runtime.backoff_period, 1)
            },
            'ignoreSSL': runtime.ignore_ssl
        }
        _last_request = None
        _last_exception = None
        _now = time.time()
        _retry_times = 0
        while TeaCore.allow_retry(_runtime.get('retry'), _retry_times, _now):
            if _retry_times > 0:
                _backoff_time = TeaCore.get_backoff_time(_runtime.get('backoff'), _retry_times)
                if _backoff_time > 0:
                    TeaCore.sleep(_backoff_time)
            _retry_times = _retry_times + 1
            try:
                _request = TeaRequest()
                _request.protocol = UtilClient.default_string(self._protocol, protocol)
                _request.method = method
                _request.pathname = pathname
                global_queries = {}
                global_headers = {}
                if not UtilClient.is_unset(self._global_parameters):
                    global_params = self._global_parameters
                    if not UtilClient.is_unset(global_params.queries):
                        global_queries = global_params.queries
                    if not UtilClient.is_unset(global_params.headers):
                        global_headers = global_params.headers
                _request.headers = TeaCore.merge({
                    'date': UtilClient.get_date_utcstring(),
                    'host': self._endpoint,
                    'accept': 'application/json',
                    'x-acs-signature-nonce': UtilClient.get_nonce(),
                    'x-acs-signature-method': 'HMAC-SHA1',
                    'x-acs-signature-version': '1.0',
                    'x-acs-version': version,
                    'x-acs-action': action,
                    'user-agent': UtilClient.get_user_agent(self._user_agent)
                }, global_headers,
                    request.headers)
                if not UtilClient.is_unset(request.body):
                    _request.body = UtilClient.to_jsonstring(request.body)
                    _request.headers['content-type'] = 'application/json; charset=utf-8'
                _request.query = global_queries
                if not UtilClient.is_unset(request.query):
                    _request.query = TeaCore.merge(_request.query,
                        request.query)
                if not UtilClient.equal_string(auth_type, 'Anonymous'):
                    access_key_id = await self.get_access_key_id_async()
                    access_key_secret = await self.get_access_key_secret_async()
                    security_token = await self.get_security_token_async()
                    if not UtilClient.empty(security_token):
                        _request.headers['x-acs-accesskey-id'] = access_key_id
                        _request.headers['x-acs-security-token'] = security_token
                    string_to_sign = OpenApiUtilClient.get_string_to_sign(_request)
                    _request.headers['authorization'] = f'acs {access_key_id}:{OpenApiUtilClient.get_roasignature(string_to_sign, access_key_secret)}'
                _last_request = _request
                _response = await TeaCore.async_do_action(_request, _runtime)
                if UtilClient.equal_number(_response.status_code, 204):
                    return {
                        'headers': _response.headers
                    }
                if UtilClient.is_4xx(_response.status_code) or UtilClient.is_5xx(_response.status_code):
                    _res = await UtilClient.read_as_json_async(_response.body)
                    err = UtilClient.assert_as_map(_res)
                    request_id = self.default_any(err.get('RequestId'), err.get('requestId'))
                    request_id = self.default_any(request_id, err.get('requestid'))
                    err['statusCode'] = _response.status_code
                    raise TeaException({
                        'code': f"{self.default_any(err.get('Code'), err.get('code'))}",
                        'message': f"code: {_response.status_code}, {self.default_any(err.get('Message'), err.get('message'))} request id: {request_id}",
                        'data': err,
                        'description': f"{self.default_any(err.get('Description'), err.get('description'))}",
                        'accessDeniedDetail': self.default_any(err.get('AccessDeniedDetail'), err.get('accessDeniedDetail'))
                    })
                if UtilClient.equal_string(body_type, 'binary'):
                    resp = {
                        'body': _response.body,
                        'headers': _response.headers,
                        'statusCode': _response.status_code
                    }
                    return resp
                elif UtilClient.equal_string(body_type, 'byte'):
                    byt = await UtilClient.read_as_bytes_async(_response.body)
                    return {
                        'body': byt,
                        'headers': _response.headers,
                        'statusCode': _response.status_code
                    }
                elif UtilClient.equal_string(body_type, 'string'):
                    str = await UtilClient.read_as_string_async(_response.body)
                    return {
                        'body': str,
                        'headers': _response.headers,
                        'statusCode': _response.status_code
                    }
                elif UtilClient.equal_string(body_type, 'json'):
                    obj = await UtilClient.read_as_json_async(_response.body)
                    res = UtilClient.assert_as_map(obj)
                    return {
                        'body': res,
                        'headers': _response.headers,
                        'statusCode': _response.status_code
                    }
                elif UtilClient.equal_string(body_type, 'array'):
                    arr = await UtilClient.read_as_json_async(_response.body)
                    return {
                        'body': arr,
                        'headers': _response.headers,
                        'statusCode': _response.status_code
                    }
                else:
                    return {
                        'headers': _response.headers,
                        'statusCode': _response.status_code
                    }
            except Exception as e:
                if TeaCore.is_retryable(e):
                    _last_exception = e
                    continue
                raise e
        raise UnretryableException(_last_request, _last_exception)

    def do_roarequest_with_form(
        self,
        action: str,
        version: str,
        protocol: str,
        method: str,
        auth_type: str,
        pathname: str,
        body_type: str,
        request: open_api_models.OpenApiRequest,
        runtime: util_models.RuntimeOptions,
    ) -> dict:
        """
        Encapsulate the request and invoke the network with form body
        @param action: api name
        @param version: product version
        @param protocol: http or https
        @param method: e.g. GET
        @param auth_type: authorization type e.g. AK
        @param pathname: pathname of every api
        @param body_type: response body type e.g. String
        @param request: object of OpenApiRequest
        @param runtime: which controls some details of call api, such as retry times
        @return: the response
        """
        request.validate()
        runtime.validate()
        _runtime = {
            'timeouted': 'retry',
            'key': UtilClient.default_string(runtime.key, self._key),
            'cert': UtilClient.default_string(runtime.cert, self._cert),
            'ca': UtilClient.default_string(runtime.ca, self._ca),
            'readTimeout': UtilClient.default_number(runtime.read_timeout, self._read_timeout),
            'connectTimeout': UtilClient.default_number(runtime.connect_timeout, self._connect_timeout),
            'httpProxy': UtilClient.default_string(runtime.http_proxy, self._http_proxy),
            'httpsProxy': UtilClient.default_string(runtime.https_proxy, self._https_proxy),
            'noProxy': UtilClient.default_string(runtime.no_proxy, self._no_proxy),
            'socks5Proxy': UtilClient.default_string(runtime.socks_5proxy, self._socks_5proxy),
            'socks5NetWork': UtilClient.default_string(runtime.socks_5net_work, self._socks_5net_work),
            'maxIdleConns': UtilClient.default_number(runtime.max_idle_conns, self._max_idle_conns),
            'retry': {
                'retryable': runtime.autoretry,
                'maxAttempts': UtilClient.default_number(runtime.max_attempts, 3)
            },
            'backoff': {
                'policy': UtilClient.default_string(runtime.backoff_policy, 'no'),
                'period': UtilClient.default_number(runtime.backoff_period, 1)
            },
            'ignoreSSL': runtime.ignore_ssl
        }
        _last_request = None
        _last_exception = None
        _now = time.time()
        _retry_times = 0
        while TeaCore.allow_retry(_runtime.get('retry'), _retry_times, _now):
            if _retry_times > 0:
                _backoff_time = TeaCore.get_backoff_time(_runtime.get('backoff'), _retry_times)
                if _backoff_time > 0:
                    TeaCore.sleep(_backoff_time)
            _retry_times = _retry_times + 1
            try:
                _request = TeaRequest()
                _request.protocol = UtilClient.default_string(self._protocol, protocol)
                _request.method = method
                _request.pathname = pathname
                global_queries = {}
                global_headers = {}
                if not UtilClient.is_unset(self._global_parameters):
                    global_params = self._global_parameters
                    if not UtilClient.is_unset(global_params.queries):
                        global_queries = global_params.queries
                    if not UtilClient.is_unset(global_params.headers):
                        global_headers = global_params.headers
                _request.headers = TeaCore.merge({
                    'date': UtilClient.get_date_utcstring(),
                    'host': self._endpoint,
                    'accept': 'application/json',
                    'x-acs-signature-nonce': UtilClient.get_nonce(),
                    'x-acs-signature-method': 'HMAC-SHA1',
                    'x-acs-signature-version': '1.0',
                    'x-acs-version': version,
                    'x-acs-action': action,
                    'user-agent': UtilClient.get_user_agent(self._user_agent)
                }, global_headers,
                    request.headers)
                if not UtilClient.is_unset(request.body):
                    m = UtilClient.assert_as_map(request.body)
                    _request.body = OpenApiUtilClient.to_form(m)
                    _request.headers['content-type'] = 'application/x-www-form-urlencoded'
                _request.query = global_queries
                if not UtilClient.is_unset(request.query):
                    _request.query = TeaCore.merge(_request.query,
                        request.query)
                if not UtilClient.equal_string(auth_type, 'Anonymous'):
                    access_key_id = self.get_access_key_id()
                    access_key_secret = self.get_access_key_secret()
                    security_token = self.get_security_token()
                    if not UtilClient.empty(security_token):
                        _request.headers['x-acs-accesskey-id'] = access_key_id
                        _request.headers['x-acs-security-token'] = security_token
                    string_to_sign = OpenApiUtilClient.get_string_to_sign(_request)
                    _request.headers['authorization'] = f'acs {access_key_id}:{OpenApiUtilClient.get_roasignature(string_to_sign, access_key_secret)}'
                _last_request = _request
                _response = TeaCore.do_action(_request, _runtime)
                if UtilClient.equal_number(_response.status_code, 204):
                    return {
                        'headers': _response.headers
                    }
                if UtilClient.is_4xx(_response.status_code) or UtilClient.is_5xx(_response.status_code):
                    _res = UtilClient.read_as_json(_response.body)
                    err = UtilClient.assert_as_map(_res)
                    err['statusCode'] = _response.status_code
                    raise TeaException({
                        'code': f"{self.default_any(err.get('Code'), err.get('code'))}",
                        'message': f"code: {_response.status_code}, {self.default_any(err.get('Message'), err.get('message'))} request id: {self.default_any(err.get('RequestId'), err.get('requestId'))}",
                        'data': err,
                        'description': f"{self.default_any(err.get('Description'), err.get('description'))}",
                        'accessDeniedDetail': self.default_any(err.get('AccessDeniedDetail'), err.get('accessDeniedDetail'))
                    })
                if UtilClient.equal_string(body_type, 'binary'):
                    resp = {
                        'body': _response.body,
                        'headers': _response.headers,
                        'statusCode': _response.status_code
                    }
                    return resp
                elif UtilClient.equal_string(body_type, 'byte'):
                    byt = UtilClient.read_as_bytes(_response.body)
                    return {
                        'body': byt,
                        'headers': _response.headers,
                        'statusCode': _response.status_code
                    }
                elif UtilClient.equal_string(body_type, 'string'):
                    str = UtilClient.read_as_string(_response.body)
                    return {
                        'body': str,
                        'headers': _response.headers,
                        'statusCode': _response.status_code
                    }
                elif UtilClient.equal_string(body_type, 'json'):
                    obj = UtilClient.read_as_json(_response.body)
                    res = UtilClient.assert_as_map(obj)
                    return {
                        'body': res,
                        'headers': _response.headers,
                        'statusCode': _response.status_code
                    }
                elif UtilClient.equal_string(body_type, 'array'):
                    arr = UtilClient.read_as_json(_response.body)
                    return {
                        'body': arr,
                        'headers': _response.headers,
                        'statusCode': _response.status_code
                    }
                else:
                    return {
                        'headers': _response.headers,
                        'statusCode': _response.status_code
                    }
            except Exception as e:
                if TeaCore.is_retryable(e):
                    _last_exception = e
                    continue
                raise e
        raise UnretryableException(_last_request, _last_exception)

    async def do_roarequest_with_form_async(
        self,
        action: str,
        version: str,
        protocol: str,
        method: str,
        auth_type: str,
        pathname: str,
        body_type: str,
        request: open_api_models.OpenApiRequest,
        runtime: util_models.RuntimeOptions,
    ) -> dict:
        """
        Encapsulate the request and invoke the network with form body
        @param action: api name
        @param version: product version
        @param protocol: http or https
        @param method: e.g. GET
        @param auth_type: authorization type e.g. AK
        @param pathname: pathname of every api
        @param body_type: response body type e.g. String
        @param request: object of OpenApiRequest
        @param runtime: which controls some details of call api, such as retry times
        @return: the response
        """
        request.validate()
        runtime.validate()
        _runtime = {
            'timeouted': 'retry',
            'key': UtilClient.default_string(runtime.key, self._key),
            'cert': UtilClient.default_string(runtime.cert, self._cert),
            'ca': UtilClient.default_string(runtime.ca, self._ca),
            'readTimeout': UtilClient.default_number(runtime.read_timeout, self._read_timeout),
            'connectTimeout': UtilClient.default_number(runtime.connect_timeout, self._connect_timeout),
            'httpProxy': UtilClient.default_string(runtime.http_proxy, self._http_proxy),
            'httpsProxy': UtilClient.default_string(runtime.https_proxy, self._https_proxy),
            'noProxy': UtilClient.default_string(runtime.no_proxy, self._no_proxy),
            'socks5Proxy': UtilClient.default_string(runtime.socks_5proxy, self._socks_5proxy),
            'socks5NetWork': UtilClient.default_string(runtime.socks_5net_work, self._socks_5net_work),
            'maxIdleConns': UtilClient.default_number(runtime.max_idle_conns, self._max_idle_conns),
            'retry': {
                'retryable': runtime.autoretry,
                'maxAttempts': UtilClient.default_number(runtime.max_attempts, 3)
            },
            'backoff': {
                'policy': UtilClient.default_string(runtime.backoff_policy, 'no'),
                'period': UtilClient.default_number(runtime.backoff_period, 1)
            },
            'ignoreSSL': runtime.ignore_ssl
        }
        _last_request = None
        _last_exception = None
        _now = time.time()
        _retry_times = 0
        while TeaCore.allow_retry(_runtime.get('retry'), _retry_times, _now):
            if _retry_times > 0:
                _backoff_time = TeaCore.get_backoff_time(_runtime.get('backoff'), _retry_times)
                if _backoff_time > 0:
                    TeaCore.sleep(_backoff_time)
            _retry_times = _retry_times + 1
            try:
                _request = TeaRequest()
                _request.protocol = UtilClient.default_string(self._protocol, protocol)
                _request.method = method
                _request.pathname = pathname
                global_queries = {}
                global_headers = {}
                if not UtilClient.is_unset(self._global_parameters):
                    global_params = self._global_parameters
                    if not UtilClient.is_unset(global_params.queries):
                        global_queries = global_params.queries
                    if not UtilClient.is_unset(global_params.headers):
                        global_headers = global_params.headers
                _request.headers = TeaCore.merge({
                    'date': UtilClient.get_date_utcstring(),
                    'host': self._endpoint,
                    'accept': 'application/json',
                    'x-acs-signature-nonce': UtilClient.get_nonce(),
                    'x-acs-signature-method': 'HMAC-SHA1',
                    'x-acs-signature-version': '1.0',
                    'x-acs-version': version,
                    'x-acs-action': action,
                    'user-agent': UtilClient.get_user_agent(self._user_agent)
                }, global_headers,
                    request.headers)
                if not UtilClient.is_unset(request.body):
                    m = UtilClient.assert_as_map(request.body)
                    _request.body = OpenApiUtilClient.to_form(m)
                    _request.headers['content-type'] = 'application/x-www-form-urlencoded'
                _request.query = global_queries
                if not UtilClient.is_unset(request.query):
                    _request.query = TeaCore.merge(_request.query,
                        request.query)
                if not UtilClient.equal_string(auth_type, 'Anonymous'):
                    access_key_id = await self.get_access_key_id_async()
                    access_key_secret = await self.get_access_key_secret_async()
                    security_token = await self.get_security_token_async()
                    if not UtilClient.empty(security_token):
                        _request.headers['x-acs-accesskey-id'] = access_key_id
                        _request.headers['x-acs-security-token'] = security_token
                    string_to_sign = OpenApiUtilClient.get_string_to_sign(_request)
                    _request.headers['authorization'] = f'acs {access_key_id}:{OpenApiUtilClient.get_roasignature(string_to_sign, access_key_secret)}'
                _last_request = _request
                _response = await TeaCore.async_do_action(_request, _runtime)
                if UtilClient.equal_number(_response.status_code, 204):
                    return {
                        'headers': _response.headers
                    }
                if UtilClient.is_4xx(_response.status_code) or UtilClient.is_5xx(_response.status_code):
                    _res = await UtilClient.read_as_json_async(_response.body)
                    err = UtilClient.assert_as_map(_res)
                    err['statusCode'] = _response.status_code
                    raise TeaException({
                        'code': f"{self.default_any(err.get('Code'), err.get('code'))}",
                        'message': f"code: {_response.status_code}, {self.default_any(err.get('Message'), err.get('message'))} request id: {self.default_any(err.get('RequestId'), err.get('requestId'))}",
                        'data': err,
                        'description': f"{self.default_any(err.get('Description'), err.get('description'))}",
                        'accessDeniedDetail': self.default_any(err.get('AccessDeniedDetail'), err.get('accessDeniedDetail'))
                    })
                if UtilClient.equal_string(body_type, 'binary'):
                    resp = {
                        'body': _response.body,
                        'headers': _response.headers,
                        'statusCode': _response.status_code
                    }
                    return resp
                elif UtilClient.equal_string(body_type, 'byte'):
                    byt = await UtilClient.read_as_bytes_async(_response.body)
                    return {
                        'body': byt,
                        'headers': _response.headers,
                        'statusCode': _response.status_code
                    }
                elif UtilClient.equal_string(body_type, 'string'):
                    str = await UtilClient.read_as_string_async(_response.body)
                    return {
                        'body': str,
                        'headers': _response.headers,
                        'statusCode': _response.status_code
                    }
                elif UtilClient.equal_string(body_type, 'json'):
                    obj = await UtilClient.read_as_json_async(_response.body)
                    res = UtilClient.assert_as_map(obj)
                    return {
                        'body': res,
                        'headers': _response.headers,
                        'statusCode': _response.status_code
                    }
                elif UtilClient.equal_string(body_type, 'array'):
                    arr = await UtilClient.read_as_json_async(_response.body)
                    return {
                        'body': arr,
                        'headers': _response.headers,
                        'statusCode': _response.status_code
                    }
                else:
                    return {
                        'headers': _response.headers,
                        'statusCode': _response.status_code
                    }
            except Exception as e:
                if TeaCore.is_retryable(e):
                    _last_exception = e
                    continue
                raise e
        raise UnretryableException(_last_request, _last_exception)

    def do_request(
        self,
        params: open_api_models.Params,
        request: open_api_models.OpenApiRequest,
        runtime: util_models.RuntimeOptions,
    ) -> dict:
        """
        Encapsulate the request and invoke the network
        @param action: api name
        @param version: product version
        @param protocol: http or https
        @param method: e.g. GET
        @param auth_type: authorization type e.g. AK
        @param body_type: response body type e.g. String
        @param request: object of OpenApiRequest
        @param runtime: which controls some details of call api, such as retry times
        @return: the response
        """
        params.validate()
        request.validate()
        runtime.validate()
        _runtime = {
            'timeouted': 'retry',
            'key': UtilClient.default_string(runtime.key, self._key),
            'cert': UtilClient.default_string(runtime.cert, self._cert),
            'ca': UtilClient.default_string(runtime.ca, self._ca),
            'readTimeout': UtilClient.default_number(runtime.read_timeout, self._read_timeout),
            'connectTimeout': UtilClient.default_number(runtime.connect_timeout, self._connect_timeout),
            'httpProxy': UtilClient.default_string(runtime.http_proxy, self._http_proxy),
            'httpsProxy': UtilClient.default_string(runtime.https_proxy, self._https_proxy),
            'noProxy': UtilClient.default_string(runtime.no_proxy, self._no_proxy),
            'socks5Proxy': UtilClient.default_string(runtime.socks_5proxy, self._socks_5proxy),
            'socks5NetWork': UtilClient.default_string(runtime.socks_5net_work, self._socks_5net_work),
            'maxIdleConns': UtilClient.default_number(runtime.max_idle_conns, self._max_idle_conns),
            'retry': {
                'retryable': runtime.autoretry,
                'maxAttempts': UtilClient.default_number(runtime.max_attempts, 3)
            },
            'backoff': {
                'policy': UtilClient.default_string(runtime.backoff_policy, 'no'),
                'period': UtilClient.default_number(runtime.backoff_period, 1)
            },
            'ignoreSSL': runtime.ignore_ssl
        }
        _last_request = None
        _last_exception = None
        _now = time.time()
        _retry_times = 0
        while TeaCore.allow_retry(_runtime.get('retry'), _retry_times, _now):
            if _retry_times > 0:
                _backoff_time = TeaCore.get_backoff_time(_runtime.get('backoff'), _retry_times)
                if _backoff_time > 0:
                    TeaCore.sleep(_backoff_time)
            _retry_times = _retry_times + 1
            try:
                _request = TeaRequest()
                _request.protocol = UtilClient.default_string(self._protocol, params.protocol)
                _request.method = params.method
                _request.pathname = params.pathname
                global_queries = {}
                global_headers = {}
                if not UtilClient.is_unset(self._global_parameters):
                    global_params = self._global_parameters
                    if not UtilClient.is_unset(global_params.queries):
                        global_queries = global_params.queries
                    if not UtilClient.is_unset(global_params.headers):
                        global_headers = global_params.headers
                _request.query = TeaCore.merge(global_queries,
                    request.query)
                # endpoint is setted in product client
                _request.headers = TeaCore.merge({
                    'host': self._endpoint,
                    'x-acs-version': params.version,
                    'x-acs-action': params.action,
                    'user-agent': self.get_user_agent(),
                    'x-acs-date': OpenApiUtilClient.get_timestamp(),
                    'x-acs-signature-nonce': UtilClient.get_nonce(),
                    'accept': 'application/json'
                }, global_headers,
                    request.headers)
                if UtilClient.equal_string(params.style, 'RPC'):
                    headers = self.get_rpc_headers()
                    if not UtilClient.is_unset(headers):
                        _request.headers = TeaCore.merge(_request.headers,
                            headers)
                signature_algorithm = UtilClient.default_string(self._signature_algorithm, 'ACS3-HMAC-SHA256')
                hashed_request_payload = OpenApiUtilClient.hex_encode(OpenApiUtilClient.hash(UtilClient.to_bytes(''), signature_algorithm))
                if not UtilClient.is_unset(request.stream):
                    tmp = UtilClient.read_as_bytes(request.stream)
                    hashed_request_payload = OpenApiUtilClient.hex_encode(OpenApiUtilClient.hash(tmp, signature_algorithm))
                    _request.body = tmp
                    _request.headers['content-type'] = 'application/octet-stream'
                else:
                    if not UtilClient.is_unset(request.body):
                        if UtilClient.equal_string(params.req_body_type, 'byte'):
                            byte_obj = UtilClient.assert_as_bytes(request.body)
                            hashed_request_payload = OpenApiUtilClient.hex_encode(OpenApiUtilClient.hash(byte_obj, signature_algorithm))
                            _request.body = byte_obj
                        elif UtilClient.equal_string(params.req_body_type, 'json'):
                            json_obj = UtilClient.to_jsonstring(request.body)
                            hashed_request_payload = OpenApiUtilClient.hex_encode(OpenApiUtilClient.hash(UtilClient.to_bytes(json_obj), signature_algorithm))
                            _request.body = json_obj
                            _request.headers['content-type'] = 'application/json; charset=utf-8'
                        else:
                            m = UtilClient.assert_as_map(request.body)
                            form_obj = OpenApiUtilClient.to_form(m)
                            hashed_request_payload = OpenApiUtilClient.hex_encode(OpenApiUtilClient.hash(UtilClient.to_bytes(form_obj), signature_algorithm))
                            _request.body = form_obj
                            _request.headers['content-type'] = 'application/x-www-form-urlencoded'
                _request.headers['x-acs-content-sha256'] = hashed_request_payload
                if not UtilClient.equal_string(params.auth_type, 'Anonymous'):
                    auth_type = self.get_type()
                    if UtilClient.equal_string(auth_type, 'bearer'):
                        bearer_token = self.get_bearer_token()
                        _request.headers['x-acs-bearer-token'] = bearer_token
                    else:
                        access_key_id = self.get_access_key_id()
                        access_key_secret = self.get_access_key_secret()
                        security_token = self.get_security_token()
                        if not UtilClient.empty(security_token):
                            _request.headers['x-acs-accesskey-id'] = access_key_id
                            _request.headers['x-acs-security-token'] = security_token
                        _request.headers['Authorization'] = OpenApiUtilClient.get_authorization(_request, signature_algorithm, hashed_request_payload, access_key_id, access_key_secret)
                _last_request = _request
                _response = TeaCore.do_action(_request, _runtime)
                if UtilClient.is_4xx(_response.status_code) or UtilClient.is_5xx(_response.status_code):
                    err = {}
                    if not UtilClient.is_unset(_response.headers.get('content-type')) and UtilClient.equal_string(_response.headers.get('content-type'), 'text/xml;charset=utf-8'):
                        _str = UtilClient.read_as_string(_response.body)
                        resp_map = XMLClient.parse_xml(_str, None)
                        err = UtilClient.assert_as_map(resp_map.get('Error'))
                    else:
                        _res = UtilClient.read_as_json(_response.body)
                        err = UtilClient.assert_as_map(_res)
                    err['statusCode'] = _response.status_code
                    raise TeaException({
                        'code': f"{self.default_any(err.get('Code'), err.get('code'))}",
                        'message': f"code: {_response.status_code}, {self.default_any(err.get('Message'), err.get('message'))} request id: {self.default_any(err.get('RequestId'), err.get('requestId'))}",
                        'data': err,
                        'description': f"{self.default_any(err.get('Description'), err.get('description'))}",
                        'accessDeniedDetail': self.default_any(err.get('AccessDeniedDetail'), err.get('accessDeniedDetail'))
                    })
                if UtilClient.equal_string(params.body_type, 'binary'):
                    resp = {
                        'body': _response.body,
                        'headers': _response.headers,
                        'statusCode': _response.status_code
                    }
                    return resp
                elif UtilClient.equal_string(params.body_type, 'byte'):
                    byt = UtilClient.read_as_bytes(_response.body)
                    return {
                        'body': byt,
                        'headers': _response.headers,
                        'statusCode': _response.status_code
                    }
                elif UtilClient.equal_string(params.body_type, 'string'):
                    str = UtilClient.read_as_string(_response.body)
                    return {
                        'body': str,
                        'headers': _response.headers,
                        'statusCode': _response.status_code
                    }
                elif UtilClient.equal_string(params.body_type, 'json'):
                    obj = UtilClient.read_as_json(_response.body)
                    res = UtilClient.assert_as_map(obj)
                    return {
                        'body': res,
                        'headers': _response.headers,
                        'statusCode': _response.status_code
                    }
                elif UtilClient.equal_string(params.body_type, 'array'):
                    arr = UtilClient.read_as_json(_response.body)
                    return {
                        'body': arr,
                        'headers': _response.headers,
                        'statusCode': _response.status_code
                    }
                else:
                    anything = UtilClient.read_as_string(_response.body)
                    return {
                        'body': anything,
                        'headers': _response.headers,
                        'statusCode': _response.status_code
                    }
            except Exception as e:
                if TeaCore.is_retryable(e):
                    _last_exception = e
                    continue
                raise e
        raise UnretryableException(_last_request, _last_exception)

    async def do_request_async(
        self,
        params: open_api_models.Params,
        request: open_api_models.OpenApiRequest,
        runtime: util_models.RuntimeOptions,
    ) -> dict:
        """
        Encapsulate the request and invoke the network
        @param action: api name
        @param version: product version
        @param protocol: http or https
        @param method: e.g. GET
        @param auth_type: authorization type e.g. AK
        @param body_type: response body type e.g. String
        @param request: object of OpenApiRequest
        @param runtime: which controls some details of call api, such as retry times
        @return: the response
        """
        params.validate()
        request.validate()
        runtime.validate()
        _runtime = {
            'timeouted': 'retry',
            'key': UtilClient.default_string(runtime.key, self._key),
            'cert': UtilClient.default_string(runtime.cert, self._cert),
            'ca': UtilClient.default_string(runtime.ca, self._ca),
            'readTimeout': UtilClient.default_number(runtime.read_timeout, self._read_timeout),
            'connectTimeout': UtilClient.default_number(runtime.connect_timeout, self._connect_timeout),
            'httpProxy': UtilClient.default_string(runtime.http_proxy, self._http_proxy),
            'httpsProxy': UtilClient.default_string(runtime.https_proxy, self._https_proxy),
            'noProxy': UtilClient.default_string(runtime.no_proxy, self._no_proxy),
            'socks5Proxy': UtilClient.default_string(runtime.socks_5proxy, self._socks_5proxy),
            'socks5NetWork': UtilClient.default_string(runtime.socks_5net_work, self._socks_5net_work),
            'maxIdleConns': UtilClient.default_number(runtime.max_idle_conns, self._max_idle_conns),
            'retry': {
                'retryable': runtime.autoretry,
                'maxAttempts': UtilClient.default_number(runtime.max_attempts, 3)
            },
            'backoff': {
                'policy': UtilClient.default_string(runtime.backoff_policy, 'no'),
                'period': UtilClient.default_number(runtime.backoff_period, 1)
            },
            'ignoreSSL': runtime.ignore_ssl
        }
        _last_request = None
        _last_exception = None
        _now = time.time()
        _retry_times = 0
        while TeaCore.allow_retry(_runtime.get('retry'), _retry_times, _now):
            if _retry_times > 0:
                _backoff_time = TeaCore.get_backoff_time(_runtime.get('backoff'), _retry_times)
                if _backoff_time > 0:
                    TeaCore.sleep(_backoff_time)
            _retry_times = _retry_times + 1
            try:
                _request = TeaRequest()
                _request.protocol = UtilClient.default_string(self._protocol, params.protocol)
                _request.method = params.method
                _request.pathname = params.pathname
                global_queries = {}
                global_headers = {}
                if not UtilClient.is_unset(self._global_parameters):
                    global_params = self._global_parameters
                    if not UtilClient.is_unset(global_params.queries):
                        global_queries = global_params.queries
                    if not UtilClient.is_unset(global_params.headers):
                        global_headers = global_params.headers
                _request.query = TeaCore.merge(global_queries,
                    request.query)
                # endpoint is setted in product client
                _request.headers = TeaCore.merge({
                    'host': self._endpoint,
                    'x-acs-version': params.version,
                    'x-acs-action': params.action,
                    'user-agent': self.get_user_agent(),
                    'x-acs-date': OpenApiUtilClient.get_timestamp(),
                    'x-acs-signature-nonce': UtilClient.get_nonce(),
                    'accept': 'application/json'
                }, global_headers,
                    request.headers)
                if UtilClient.equal_string(params.style, 'RPC'):
                    headers = self.get_rpc_headers()
                    if not UtilClient.is_unset(headers):
                        _request.headers = TeaCore.merge(_request.headers,
                            headers)
                signature_algorithm = UtilClient.default_string(self._signature_algorithm, 'ACS3-HMAC-SHA256')
                hashed_request_payload = OpenApiUtilClient.hex_encode(OpenApiUtilClient.hash(UtilClient.to_bytes(''), signature_algorithm))
                if not UtilClient.is_unset(request.stream):
                    tmp = await UtilClient.read_as_bytes_async(request.stream)
                    hashed_request_payload = OpenApiUtilClient.hex_encode(OpenApiUtilClient.hash(tmp, signature_algorithm))
                    _request.body = tmp
                    _request.headers['content-type'] = 'application/octet-stream'
                else:
                    if not UtilClient.is_unset(request.body):
                        if UtilClient.equal_string(params.req_body_type, 'byte'):
                            byte_obj = UtilClient.assert_as_bytes(request.body)
                            hashed_request_payload = OpenApiUtilClient.hex_encode(OpenApiUtilClient.hash(byte_obj, signature_algorithm))
                            _request.body = byte_obj
                        elif UtilClient.equal_string(params.req_body_type, 'json'):
                            json_obj = UtilClient.to_jsonstring(request.body)
                            hashed_request_payload = OpenApiUtilClient.hex_encode(OpenApiUtilClient.hash(UtilClient.to_bytes(json_obj), signature_algorithm))
                            _request.body = json_obj
                            _request.headers['content-type'] = 'application/json; charset=utf-8'
                        else:
                            m = UtilClient.assert_as_map(request.body)
                            form_obj = OpenApiUtilClient.to_form(m)
                            hashed_request_payload = OpenApiUtilClient.hex_encode(OpenApiUtilClient.hash(UtilClient.to_bytes(form_obj), signature_algorithm))
                            _request.body = form_obj
                            _request.headers['content-type'] = 'application/x-www-form-urlencoded'
                _request.headers['x-acs-content-sha256'] = hashed_request_payload
                if not UtilClient.equal_string(params.auth_type, 'Anonymous'):
                    auth_type = await self.get_type_async()
                    if UtilClient.equal_string(auth_type, 'bearer'):
                        bearer_token = await self.get_bearer_token_async()
                        _request.headers['x-acs-bearer-token'] = bearer_token
                    else:
                        access_key_id = await self.get_access_key_id_async()
                        access_key_secret = await self.get_access_key_secret_async()
                        security_token = await self.get_security_token_async()
                        if not UtilClient.empty(security_token):
                            _request.headers['x-acs-accesskey-id'] = access_key_id
                            _request.headers['x-acs-security-token'] = security_token
                        _request.headers['Authorization'] = OpenApiUtilClient.get_authorization(_request, signature_algorithm, hashed_request_payload, access_key_id, access_key_secret)
                _last_request = _request
                _response = await TeaCore.async_do_action(_request, _runtime)
                if UtilClient.is_4xx(_response.status_code) or UtilClient.is_5xx(_response.status_code):
                    err = {}
                    if not UtilClient.is_unset(_response.headers.get('content-type')) and UtilClient.equal_string(_response.headers.get('content-type'), 'text/xml;charset=utf-8'):
                        _str = await UtilClient.read_as_string_async(_response.body)
                        resp_map = XMLClient.parse_xml(_str, None)
                        err = UtilClient.assert_as_map(resp_map.get('Error'))
                    else:
                        _res = await UtilClient.read_as_json_async(_response.body)
                        err = UtilClient.assert_as_map(_res)
                    err['statusCode'] = _response.status_code
                    raise TeaException({
                        'code': f"{self.default_any(err.get('Code'), err.get('code'))}",
                        'message': f"code: {_response.status_code}, {self.default_any(err.get('Message'), err.get('message'))} request id: {self.default_any(err.get('RequestId'), err.get('requestId'))}",
                        'data': err,
                        'description': f"{self.default_any(err.get('Description'), err.get('description'))}",
                        'accessDeniedDetail': self.default_any(err.get('AccessDeniedDetail'), err.get('accessDeniedDetail'))
                    })
                if UtilClient.equal_string(params.body_type, 'binary'):
                    resp = {
                        'body': _response.body,
                        'headers': _response.headers,
                        'statusCode': _response.status_code
                    }
                    return resp
                elif UtilClient.equal_string(params.body_type, 'byte'):
                    byt = await UtilClient.read_as_bytes_async(_response.body)
                    return {
                        'body': byt,
                        'headers': _response.headers,
                        'statusCode': _response.status_code
                    }
                elif UtilClient.equal_string(params.body_type, 'string'):
                    str = await UtilClient.read_as_string_async(_response.body)
                    return {
                        'body': str,
                        'headers': _response.headers,
                        'statusCode': _response.status_code
                    }
                elif UtilClient.equal_string(params.body_type, 'json'):
                    obj = await UtilClient.read_as_json_async(_response.body)
                    res = UtilClient.assert_as_map(obj)
                    return {
                        'body': res,
                        'headers': _response.headers,
                        'statusCode': _response.status_code
                    }
                elif UtilClient.equal_string(params.body_type, 'array'):
                    arr = await UtilClient.read_as_json_async(_response.body)
                    return {
                        'body': arr,
                        'headers': _response.headers,
                        'statusCode': _response.status_code
                    }
                else:
                    anything = await UtilClient.read_as_string_async(_response.body)
                    return {
                        'body': anything,
                        'headers': _response.headers,
                        'statusCode': _response.status_code
                    }
            except Exception as e:
                if TeaCore.is_retryable(e):
                    _last_exception = e
                    continue
                raise e
        raise UnretryableException(_last_request, _last_exception)

    def execute(
        self,
        params: open_api_models.Params,
        request: open_api_models.OpenApiRequest,
        runtime: util_models.RuntimeOptions,
    ) -> dict:
        """
        Encapsulate the request and invoke the network
        @param action: api name
        @param version: product version
        @param protocol: http or https
        @param method: e.g. GET
        @param auth_type: authorization type e.g. AK
        @param body_type: response body type e.g. String
        @param request: object of OpenApiRequest
        @param runtime: which controls some details of call api, such as retry times
        @return: the response
        """
        params.validate()
        request.validate()
        runtime.validate()
        _runtime = {
            'timeouted': 'retry',
            'key': UtilClient.default_string(runtime.key, self._key),
            'cert': UtilClient.default_string(runtime.cert, self._cert),
            'ca': UtilClient.default_string(runtime.ca, self._ca),
            'readTimeout': UtilClient.default_number(runtime.read_timeout, self._read_timeout),
            'connectTimeout': UtilClient.default_number(runtime.connect_timeout, self._connect_timeout),
            'httpProxy': UtilClient.default_string(runtime.http_proxy, self._http_proxy),
            'httpsProxy': UtilClient.default_string(runtime.https_proxy, self._https_proxy),
            'noProxy': UtilClient.default_string(runtime.no_proxy, self._no_proxy),
            'socks5Proxy': UtilClient.default_string(runtime.socks_5proxy, self._socks_5proxy),
            'socks5NetWork': UtilClient.default_string(runtime.socks_5net_work, self._socks_5net_work),
            'maxIdleConns': UtilClient.default_number(runtime.max_idle_conns, self._max_idle_conns),
            'retry': {
                'retryable': runtime.autoretry,
                'maxAttempts': UtilClient.default_number(runtime.max_attempts, 3)
            },
            'backoff': {
                'policy': UtilClient.default_string(runtime.backoff_policy, 'no'),
                'period': UtilClient.default_number(runtime.backoff_period, 1)
            },
            'ignoreSSL': runtime.ignore_ssl
        }
        _last_request = None
        _last_exception = None
        _now = time.time()
        _retry_times = 0
        while TeaCore.allow_retry(_runtime.get('retry'), _retry_times, _now):
            if _retry_times > 0:
                _backoff_time = TeaCore.get_backoff_time(_runtime.get('backoff'), _retry_times)
                if _backoff_time > 0:
                    TeaCore.sleep(_backoff_time)
            _retry_times = _retry_times + 1
            try:
                _request = TeaRequest()
                # spi = new Gateway();//Gateway implements SPI，这一步在产品 SDK 中实例化
                headers = self.get_rpc_headers()
                global_queries = {}
                global_headers = {}
                if not UtilClient.is_unset(self._global_parameters):
                    global_params = self._global_parameters
                    if not UtilClient.is_unset(global_params.queries):
                        global_queries = global_params.queries
                    if not UtilClient.is_unset(global_params.headers):
                        global_headers = global_params.headers
                request_context = spi_models.InterceptorContextRequest(
                    headers=TeaCore.merge(global_headers,
                        request.headers,
                        headers),
                    query=TeaCore.merge(global_queries,
                        request.query),
                    body=request.body,
                    stream=request.stream,
                    host_map=request.host_map,
                    pathname=params.pathname,
                    product_id=self._product_id,
                    action=params.action,
                    version=params.version,
                    protocol=UtilClient.default_string(self._protocol, params.protocol),
                    method=UtilClient.default_string(self._method, params.method),
                    auth_type=params.auth_type,
                    body_type=params.body_type,
                    req_body_type=params.req_body_type,
                    style=params.style,
                    credential=self._credential,
                    signature_version=self._signature_version,
                    signature_algorithm=self._signature_algorithm,
                    user_agent=self.get_user_agent()
                )
                configuration_context = spi_models.InterceptorContextConfiguration(
                    region_id=self._region_id,
                    endpoint=UtilClient.default_string(request.endpoint_override, self._endpoint),
                    endpoint_rule=self._endpoint_rule,
                    endpoint_map=self._endpoint_map,
                    endpoint_type=self._endpoint_type,
                    network=self._network,
                    suffix=self._suffix
                )
                interceptor_context = spi_models.InterceptorContext(
                    request=request_context,
                    configuration=configuration_context
                )
                attribute_map = spi_models.AttributeMap()
                # 1. spi.modifyConfiguration(context: SPI.InterceptorContext, attributeMap: SPI.AttributeMap);
                self._spi.modify_configuration(interceptor_context, attribute_map)
                # 2. spi.modifyRequest(context: SPI.InterceptorContext, attributeMap: SPI.AttributeMap);
                self._spi.modify_request(interceptor_context, attribute_map)
                _request.protocol = interceptor_context.request.protocol
                _request.method = interceptor_context.request.method
                _request.pathname = interceptor_context.request.pathname
                _request.query = interceptor_context.request.query
                _request.body = interceptor_context.request.stream
                _request.headers = interceptor_context.request.headers
                _last_request = _request
                _response = TeaCore.do_action(_request, _runtime)
                response_context = spi_models.InterceptorContextResponse(
                    status_code=_response.status_code,
                    headers=_response.headers,
                    body=_response.body
                )
                interceptor_context.response = response_context
                # 3. spi.modifyResponse(context: SPI.InterceptorContext, attributeMap: SPI.AttributeMap);
                self._spi.modify_response(interceptor_context, attribute_map)
                return {
                    'headers': interceptor_context.response.headers,
                    'statusCode': interceptor_context.response.status_code,
                    'body': interceptor_context.response.deserialized_body
                }
            except Exception as e:
                if TeaCore.is_retryable(e):
                    _last_exception = e
                    continue
                raise e
        raise UnretryableException(_last_request, _last_exception)

    async def execute_async(
        self,
        params: open_api_models.Params,
        request: open_api_models.OpenApiRequest,
        runtime: util_models.RuntimeOptions,
    ) -> dict:
        """
        Encapsulate the request and invoke the network
        @param action: api name
        @param version: product version
        @param protocol: http or https
        @param method: e.g. GET
        @param auth_type: authorization type e.g. AK
        @param body_type: response body type e.g. String
        @param request: object of OpenApiRequest
        @param runtime: which controls some details of call api, such as retry times
        @return: the response
        """
        params.validate()
        request.validate()
        runtime.validate()
        _runtime = {
            'timeouted': 'retry',
            'key': UtilClient.default_string(runtime.key, self._key),
            'cert': UtilClient.default_string(runtime.cert, self._cert),
            'ca': UtilClient.default_string(runtime.ca, self._ca),
            'readTimeout': UtilClient.default_number(runtime.read_timeout, self._read_timeout),
            'connectTimeout': UtilClient.default_number(runtime.connect_timeout, self._connect_timeout),
            'httpProxy': UtilClient.default_string(runtime.http_proxy, self._http_proxy),
            'httpsProxy': UtilClient.default_string(runtime.https_proxy, self._https_proxy),
            'noProxy': UtilClient.default_string(runtime.no_proxy, self._no_proxy),
            'socks5Proxy': UtilClient.default_string(runtime.socks_5proxy, self._socks_5proxy),
            'socks5NetWork': UtilClient.default_string(runtime.socks_5net_work, self._socks_5net_work),
            'maxIdleConns': UtilClient.default_number(runtime.max_idle_conns, self._max_idle_conns),
            'retry': {
                'retryable': runtime.autoretry,
                'maxAttempts': UtilClient.default_number(runtime.max_attempts, 3)
            },
            'backoff': {
                'policy': UtilClient.default_string(runtime.backoff_policy, 'no'),
                'period': UtilClient.default_number(runtime.backoff_period, 1)
            },
            'ignoreSSL': runtime.ignore_ssl
        }
        _last_request = None
        _last_exception = None
        _now = time.time()
        _retry_times = 0
        while TeaCore.allow_retry(_runtime.get('retry'), _retry_times, _now):
            if _retry_times > 0:
                _backoff_time = TeaCore.get_backoff_time(_runtime.get('backoff'), _retry_times)
                if _backoff_time > 0:
                    TeaCore.sleep(_backoff_time)
            _retry_times = _retry_times + 1
            try:
                _request = TeaRequest()
                # spi = new Gateway();//Gateway implements SPI，这一步在产品 SDK 中实例化
                headers = self.get_rpc_headers()
                global_queries = {}
                global_headers = {}
                if not UtilClient.is_unset(self._global_parameters):
                    global_params = self._global_parameters
                    if not UtilClient.is_unset(global_params.queries):
                        global_queries = global_params.queries
                    if not UtilClient.is_unset(global_params.headers):
                        global_headers = global_params.headers
                request_context = spi_models.InterceptorContextRequest(
                    headers=TeaCore.merge(global_headers,
                        request.headers,
                        headers),
                    query=TeaCore.merge(global_queries,
                        request.query),
                    body=request.body,
                    stream=request.stream,
                    host_map=request.host_map,
                    pathname=params.pathname,
                    product_id=self._product_id,
                    action=params.action,
                    version=params.version,
                    protocol=UtilClient.default_string(self._protocol, params.protocol),
                    method=UtilClient.default_string(self._method, params.method),
                    auth_type=params.auth_type,
                    body_type=params.body_type,
                    req_body_type=params.req_body_type,
                    style=params.style,
                    credential=self._credential,
                    signature_version=self._signature_version,
                    signature_algorithm=self._signature_algorithm,
                    user_agent=self.get_user_agent()
                )
                configuration_context = spi_models.InterceptorContextConfiguration(
                    region_id=self._region_id,
                    endpoint=UtilClient.default_string(request.endpoint_override, self._endpoint),
                    endpoint_rule=self._endpoint_rule,
                    endpoint_map=self._endpoint_map,
                    endpoint_type=self._endpoint_type,
                    network=self._network,
                    suffix=self._suffix
                )
                interceptor_context = spi_models.InterceptorContext(
                    request=request_context,
                    configuration=configuration_context
                )
                attribute_map = spi_models.AttributeMap()
                # 1. spi.modifyConfiguration(context: SPI.InterceptorContext, attributeMap: SPI.AttributeMap);
                await self._spi.modify_configuration_async(interceptor_context, attribute_map)
                # 2. spi.modifyRequest(context: SPI.InterceptorContext, attributeMap: SPI.AttributeMap);
                await self._spi.modify_request_async(interceptor_context, attribute_map)
                _request.protocol = interceptor_context.request.protocol
                _request.method = interceptor_context.request.method
                _request.pathname = interceptor_context.request.pathname
                _request.query = interceptor_context.request.query
                _request.body = interceptor_context.request.stream
                _request.headers = interceptor_context.request.headers
                _last_request = _request
                _response = await TeaCore.async_do_action(_request, _runtime)
                response_context = spi_models.InterceptorContextResponse(
                    status_code=_response.status_code,
                    headers=_response.headers,
                    body=_response.body
                )
                interceptor_context.response = response_context
                # 3. spi.modifyResponse(context: SPI.InterceptorContext, attributeMap: SPI.AttributeMap);
                await self._spi.modify_response_async(interceptor_context, attribute_map)
                return {
                    'headers': interceptor_context.response.headers,
                    'statusCode': interceptor_context.response.status_code,
                    'body': interceptor_context.response.deserialized_body
                }
            except Exception as e:
                if TeaCore.is_retryable(e):
                    _last_exception = e
                    continue
                raise e
        raise UnretryableException(_last_request, _last_exception)

    def call_api(
        self,
        params: open_api_models.Params,
        request: open_api_models.OpenApiRequest,
        runtime: util_models.RuntimeOptions,
    ) -> dict:
        if UtilClient.is_unset(params):
            raise TeaException({
                'code': 'ParameterMissing',
                'message': "'params' can not be unset"
            })
        if UtilClient.is_unset(self._signature_algorithm) or not UtilClient.equal_string(self._signature_algorithm, 'v2'):
            return self.do_request(params, request, runtime)
        elif UtilClient.equal_string(params.style, 'ROA') and UtilClient.equal_string(params.req_body_type, 'json'):
            return self.do_roarequest(params.action, params.version, params.protocol, params.method, params.auth_type, params.pathname, params.body_type, request, runtime)
        elif UtilClient.equal_string(params.style, 'ROA'):
            return self.do_roarequest_with_form(params.action, params.version, params.protocol, params.method, params.auth_type, params.pathname, params.body_type, request, runtime)
        else:
            return self.do_rpcrequest(params.action, params.version, params.protocol, params.method, params.auth_type, params.body_type, request, runtime)

    async def call_api_async(
        self,
        params: open_api_models.Params,
        request: open_api_models.OpenApiRequest,
        runtime: util_models.RuntimeOptions,
    ) -> dict:
        if UtilClient.is_unset(params):
            raise TeaException({
                'code': 'ParameterMissing',
                'message': "'params' can not be unset"
            })
        if UtilClient.is_unset(self._signature_algorithm) or not UtilClient.equal_string(self._signature_algorithm, 'v2'):
            return await self.do_request_async(params, request, runtime)
        elif UtilClient.equal_string(params.style, 'ROA') and UtilClient.equal_string(params.req_body_type, 'json'):
            return await self.do_roarequest_async(params.action, params.version, params.protocol, params.method, params.auth_type, params.pathname, params.body_type, request, runtime)
        elif UtilClient.equal_string(params.style, 'ROA'):
            return await self.do_roarequest_with_form_async(params.action, params.version, params.protocol, params.method, params.auth_type, params.pathname, params.body_type, request, runtime)
        else:
            return await self.do_rpcrequest_async(params.action, params.version, params.protocol, params.method, params.auth_type, params.body_type, request, runtime)

    def get_user_agent(self) -> str:
        """
        Get user agent
        @return: user agent
        """
        user_agent = UtilClient.get_user_agent(self._user_agent)
        return user_agent

    def get_access_key_id(self) -> str:
        """
        Get accesskey id by using credential
        @return: accesskey id
        """
        if UtilClient.is_unset(self._credential):
            return ''
        access_key_id = self._credential.get_access_key_id()
        return access_key_id

    async def get_access_key_id_async(self) -> str:
        """
        Get accesskey id by using credential
        @return: accesskey id
        """
        if UtilClient.is_unset(self._credential):
            return ''
        access_key_id = await self._credential.get_access_key_id_async()
        return access_key_id

    def get_access_key_secret(self) -> str:
        """
        Get accesskey secret by using credential
        @return: accesskey secret
        """
        if UtilClient.is_unset(self._credential):
            return ''
        secret = self._credential.get_access_key_secret()
        return secret

    async def get_access_key_secret_async(self) -> str:
        """
        Get accesskey secret by using credential
        @return: accesskey secret
        """
        if UtilClient.is_unset(self._credential):
            return ''
        secret = await self._credential.get_access_key_secret_async()
        return secret

    def get_security_token(self) -> str:
        """
        Get security token by using credential
        @return: security token
        """
        if UtilClient.is_unset(self._credential):
            return ''
        token = self._credential.get_security_token()
        return token

    async def get_security_token_async(self) -> str:
        """
        Get security token by using credential
        @return: security token
        """
        if UtilClient.is_unset(self._credential):
            return ''
        token = await self._credential.get_security_token_async()
        return token

    def get_bearer_token(self) -> str:
        """
        Get bearer token by credential
        @return: bearer token
        """
        if UtilClient.is_unset(self._credential):
            return ''
        token = self._credential.get_bearer_token()
        return token

    async def get_bearer_token_async(self) -> str:
        """
        Get bearer token by credential
        @return: bearer token
        """
        if UtilClient.is_unset(self._credential):
            return ''
        token = self._credential.get_bearer_token()
        return token

    def get_type(self) -> str:
        """
        Get credential type by credential
        @return: credential type e.g. access_key
        """
        if UtilClient.is_unset(self._credential):
            return ''
        auth_type = self._credential.get_type()
        return auth_type

    async def get_type_async(self) -> str:
        """
        Get credential type by credential
        @return: credential type e.g. access_key
        """
        if UtilClient.is_unset(self._credential):
            return ''
        auth_type = self._credential.get_type()
        return auth_type

    @staticmethod
    def default_any(
        input_value: Any,
        default_value: Any,
    ) -> Any:
        """
        If inputValue is not null, return it or return defaultValue
        @param input_value:  users input value
        @param default_value: default value
        @return: the final result
        """
        if UtilClient.is_unset(input_value):
            return default_value
        return input_value

    def check_config(
        self,
        config: open_api_models.Config,
    ) -> None:
        """
        If the endpointRule and config.endpoint are empty, throw error
        @param config: config contains the necessary information to create a client
        """
        if UtilClient.empty(self._endpoint_rule) and UtilClient.empty(config.endpoint):
            raise TeaException({
                'code': 'ParameterMissing',
                'message': "'config.endpoint' can not be empty"
            })

    def set_gateway_client(
        self,
        spi: SPIClient,
    ) -> None:
        """
        set gateway client
        @param spi.:
        """
        self._spi = spi

    def set_rpc_headers(
        self,
        headers: Dict[str, str],
    ) -> None:
        """
        set RPC header for debug
        @param headers: headers for debug, this header can be used only once.
        """
        self._headers = headers

    def get_rpc_headers(self) -> Dict[str, str]:
        """
        get RPC header for debug
        """
        headers = self._headers
        self._headers = None
        return headers
