# -*- coding: utf-8 -*-
# This file is auto-generated, don't edit it. Thanks.
from Tea.model import TeaModel
from typing import Dict, Any, BinaryIO

from alibabacloud_credentials.client import Client as CredentialClient


class InterceptorContextRequest(TeaModel):
    def __init__(
        self,
        headers: Dict[str, str] = None,
        query: Dict[str, str] = None,
        body: Any = None,
        stream: BinaryIO = None,
        host_map: Dict[str, str] = None,
        pathname: str = None,
        product_id: str = None,
        action: str = None,
        version: str = None,
        protocol: str = None,
        method: str = None,
        auth_type: str = None,
        body_type: str = None,
        req_body_type: str = None,
        style: str = None,
        credential: CredentialClient = None,
        signature_version: str = None,
        signature_algorithm: str = None,
        user_agent: str = None,
    ):
        self.headers = headers
        self.query = query
        self.body = body
        self.stream = stream
        self.host_map = host_map
        self.pathname = pathname
        self.product_id = product_id
        self.action = action
        self.version = version
        self.protocol = protocol
        self.method = method
        self.auth_type = auth_type
        self.body_type = body_type
        self.req_body_type = req_body_type
        self.style = style
        self.credential = credential
        self.signature_version = signature_version
        self.signature_algorithm = signature_algorithm
        self.user_agent = user_agent

    def validate(self):
        self.validate_required(self.pathname, 'pathname')
        self.validate_required(self.product_id, 'product_id')
        self.validate_required(self.action, 'action')
        self.validate_required(self.version, 'version')
        self.validate_required(self.protocol, 'protocol')
        self.validate_required(self.method, 'method')
        self.validate_required(self.auth_type, 'auth_type')
        self.validate_required(self.body_type, 'body_type')
        self.validate_required(self.req_body_type, 'req_body_type')
        self.validate_required(self.credential, 'credential')
        self.validate_required(self.user_agent, 'user_agent')

    def to_map(self):
        _map = super().to_map()
        if _map is not None:
            return _map

        result = dict()
        if self.headers is not None:
            result['headers'] = self.headers
        if self.query is not None:
            result['query'] = self.query
        if self.body is not None:
            result['body'] = self.body
        if self.stream is not None:
            result['stream'] = self.stream
        if self.host_map is not None:
            result['hostMap'] = self.host_map
        if self.pathname is not None:
            result['pathname'] = self.pathname
        if self.product_id is not None:
            result['productId'] = self.product_id
        if self.action is not None:
            result['action'] = self.action
        if self.version is not None:
            result['version'] = self.version
        if self.protocol is not None:
            result['protocol'] = self.protocol
        if self.method is not None:
            result['method'] = self.method
        if self.auth_type is not None:
            result['authType'] = self.auth_type
        if self.body_type is not None:
            result['bodyType'] = self.body_type
        if self.req_body_type is not None:
            result['reqBodyType'] = self.req_body_type
        if self.style is not None:
            result['style'] = self.style
        if self.credential is not None:
            result['credential'] = self.credential
        if self.signature_version is not None:
            result['signatureVersion'] = self.signature_version
        if self.signature_algorithm is not None:
            result['signatureAlgorithm'] = self.signature_algorithm
        if self.user_agent is not None:
            result['userAgent'] = self.user_agent
        return result

    def from_map(self, m: dict = None):
        m = m or dict()
        if m.get('headers') is not None:
            self.headers = m.get('headers')
        if m.get('query') is not None:
            self.query = m.get('query')
        if m.get('body') is not None:
            self.body = m.get('body')
        if m.get('stream') is not None:
            self.stream = m.get('stream')
        if m.get('hostMap') is not None:
            self.host_map = m.get('hostMap')
        if m.get('pathname') is not None:
            self.pathname = m.get('pathname')
        if m.get('productId') is not None:
            self.product_id = m.get('productId')
        if m.get('action') is not None:
            self.action = m.get('action')
        if m.get('version') is not None:
            self.version = m.get('version')
        if m.get('protocol') is not None:
            self.protocol = m.get('protocol')
        if m.get('method') is not None:
            self.method = m.get('method')
        if m.get('authType') is not None:
            self.auth_type = m.get('authType')
        if m.get('bodyType') is not None:
            self.body_type = m.get('bodyType')
        if m.get('reqBodyType') is not None:
            self.req_body_type = m.get('reqBodyType')
        if m.get('style') is not None:
            self.style = m.get('style')
        if m.get('credential') is not None:
            self.credential = m.get('credential')
        if m.get('signatureVersion') is not None:
            self.signature_version = m.get('signatureVersion')
        if m.get('signatureAlgorithm') is not None:
            self.signature_algorithm = m.get('signatureAlgorithm')
        if m.get('userAgent') is not None:
            self.user_agent = m.get('userAgent')
        return self


class InterceptorContextConfiguration(TeaModel):
    def __init__(
        self,
        region_id: str = None,
        endpoint: str = None,
        endpoint_rule: str = None,
        endpoint_map: Dict[str, str] = None,
        endpoint_type: str = None,
        network: str = None,
        suffix: str = None,
    ):
        self.region_id = region_id
        self.endpoint = endpoint
        self.endpoint_rule = endpoint_rule
        self.endpoint_map = endpoint_map
        self.endpoint_type = endpoint_type
        self.network = network
        self.suffix = suffix

    def validate(self):
        self.validate_required(self.region_id, 'region_id')

    def to_map(self):
        _map = super().to_map()
        if _map is not None:
            return _map

        result = dict()
        if self.region_id is not None:
            result['regionId'] = self.region_id
        if self.endpoint is not None:
            result['endpoint'] = self.endpoint
        if self.endpoint_rule is not None:
            result['endpointRule'] = self.endpoint_rule
        if self.endpoint_map is not None:
            result['endpointMap'] = self.endpoint_map
        if self.endpoint_type is not None:
            result['endpointType'] = self.endpoint_type
        if self.network is not None:
            result['network'] = self.network
        if self.suffix is not None:
            result['suffix'] = self.suffix
        return result

    def from_map(self, m: dict = None):
        m = m or dict()
        if m.get('regionId') is not None:
            self.region_id = m.get('regionId')
        if m.get('endpoint') is not None:
            self.endpoint = m.get('endpoint')
        if m.get('endpointRule') is not None:
            self.endpoint_rule = m.get('endpointRule')
        if m.get('endpointMap') is not None:
            self.endpoint_map = m.get('endpointMap')
        if m.get('endpointType') is not None:
            self.endpoint_type = m.get('endpointType')
        if m.get('network') is not None:
            self.network = m.get('network')
        if m.get('suffix') is not None:
            self.suffix = m.get('suffix')
        return self


class InterceptorContextResponse(TeaModel):
    def __init__(
        self,
        status_code: int = None,
        headers: Dict[str, str] = None,
        body: BinaryIO = None,
        deserialized_body: Any = None,
    ):
        self.status_code = status_code
        self.headers = headers
        self.body = body
        self.deserialized_body = deserialized_body

    def validate(self):
        pass

    def to_map(self):
        _map = super().to_map()
        if _map is not None:
            return _map

        result = dict()
        if self.status_code is not None:
            result['statusCode'] = self.status_code
        if self.headers is not None:
            result['headers'] = self.headers
        if self.body is not None:
            result['body'] = self.body
        if self.deserialized_body is not None:
            result['deserializedBody'] = self.deserialized_body
        return result

    def from_map(self, m: dict = None):
        m = m or dict()
        if m.get('statusCode') is not None:
            self.status_code = m.get('statusCode')
        if m.get('headers') is not None:
            self.headers = m.get('headers')
        if m.get('body') is not None:
            self.body = m.get('body')
        if m.get('deserializedBody') is not None:
            self.deserialized_body = m.get('deserializedBody')
        return self


class InterceptorContext(TeaModel):
    def __init__(
        self,
        request: InterceptorContextRequest = None,
        configuration: InterceptorContextConfiguration = None,
        response: InterceptorContextResponse = None,
    ):
        self.request = request
        self.configuration = configuration
        self.response = response

    def validate(self):
        self.validate_required(self.request, 'request')
        if self.request:
            self.request.validate()
        self.validate_required(self.configuration, 'configuration')
        if self.configuration:
            self.configuration.validate()
        self.validate_required(self.response, 'response')
        if self.response:
            self.response.validate()

    def to_map(self):
        _map = super().to_map()
        if _map is not None:
            return _map

        result = dict()
        if self.request is not None:
            result['request'] = self.request.to_map()
        if self.configuration is not None:
            result['configuration'] = self.configuration.to_map()
        if self.response is not None:
            result['response'] = self.response.to_map()
        return result

    def from_map(self, m: dict = None):
        m = m or dict()
        if m.get('request') is not None:
            temp_model = InterceptorContextRequest()
            self.request = temp_model.from_map(m['request'])
        if m.get('configuration') is not None:
            temp_model = InterceptorContextConfiguration()
            self.configuration = temp_model.from_map(m['configuration'])
        if m.get('response') is not None:
            temp_model = InterceptorContextResponse()
            self.response = temp_model.from_map(m['response'])
        return self


class AttributeMap(TeaModel):
    def __init__(
        self,
        attributes: Dict[str, Any] = None,
        key: Dict[str, str] = None,
    ):
        self.attributes = attributes
        self.key = key

    def validate(self):
        self.validate_required(self.attributes, 'attributes')
        self.validate_required(self.key, 'key')

    def to_map(self):
        _map = super().to_map()
        if _map is not None:
            return _map

        result = dict()
        if self.attributes is not None:
            result['attributes'] = self.attributes
        if self.key is not None:
            result['key'] = self.key
        return result

    def from_map(self, m: dict = None):
        m = m or dict()
        if m.get('attributes') is not None:
            self.attributes = m.get('attributes')
        if m.get('key') is not None:
            self.key = m.get('key')
        return self


