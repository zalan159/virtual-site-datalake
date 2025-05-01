# -*- coding: utf-8 -*-
import binascii
import datetime
import hashlib
import hmac
import base64
import copy
from cryptography.hazmat.backends import default_backend
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import padding
from cryptography.hazmat.primitives.serialization import load_pem_private_key

from urllib.parse import quote_plus, quote

from .sm3 import hash_sm3, Sm3
from alibabacloud_tea_util.client import Client as Util
from Tea.stream import STREAM_CLASS
from Tea.model import TeaModel


def to_str(val):
    if val is None:
        return val

    if isinstance(val, bytes):
        return str(val, encoding='utf-8')
    else:
        return str(val)


def rsa_sign(plaintext, secret):
    if not secret.startswith(b'-----BEGIN RSA PRIVATE KEY-----'):
        secret = b'-----BEGIN RSA PRIVATE KEY-----\n%s' % secret
    if not secret.endswith(b'-----END RSA PRIVATE KEY-----'):
        secret = b'%s\n-----END RSA PRIVATE KEY-----' % secret

    key = load_pem_private_key(secret, password=None, backend=default_backend())
    return key.sign(plaintext, padding.PKCS1v15(), hashes.SHA256())


def signature_method(secret, source, sign_type):
    source = source.encode('utf-8')
    secret = secret.encode('utf-8')
    if sign_type == 'ACS3-HMAC-SHA256':
        return hmac.new(secret, source, hashlib.sha256).digest()
    elif sign_type == 'ACS3-HMAC-SM3':
        return hmac.new(secret, source, Sm3).digest()
    elif sign_type == 'ACS3-RSA-SHA256':
        return rsa_sign(source, secret)


def get_canonical_query_string(query):
    if query is None or len(query) <= 0:
        return ''
    canon_keys = []
    for k, v in query.items():
        if v is not None:
            canon_keys.append(k)

    canon_keys.sort()
    query_string = ''
    for key in canon_keys:
        value = quote(query[key], safe='~', encoding='utf-8')
        if value is None:
            s = f'{key}&'
        else:
            s = f'{key}={value}&'
        query_string += s
    return query_string[:-1]


def get_canonicalized_headers(headers):
    canon_keys = []
    tmp_headers = {}
    for k, v in headers.items():
        if v is not None:
            if k.lower() not in canon_keys:
                canon_keys.append(k.lower())
                tmp_headers[k.lower()] = [to_str(v).strip()]
            else:
                tmp_headers[k.lower()].append(to_str(v).strip())

    canon_keys.sort()
    canonical_headers = ''
    for key in canon_keys:
        header_entry = ','.join(sorted(tmp_headers[key]))
        s = f'{key}:{header_entry}\n'
        canonical_headers += s
    return canonical_headers, ';'.join(canon_keys)


class Client(object):
    """
    This is for OpenApi Util
    """

    @staticmethod
    def convert(body, content):
        """
        Convert all params of body other than type of readable into content

        @param body: source Model

        @param content: target Model

        @return: void
        """
        body_map = Client._except_stream(body.to_map())
        content.from_map(body_map)

    @staticmethod
    def _except_stream(val):
        if isinstance(val, dict):
            result = {}
            for k, v in val.items():
                result[k] = Client._except_stream(v)
            return result
        elif isinstance(val, list):
            result = []
            for i in val:
                if i is not None:
                    item = Client._except_stream(i)
                    if item is not None:
                        result.append(item)
                else:
                    result.append(Client._except_stream(i))
            return result
        elif isinstance(val, STREAM_CLASS):
            return None
        return val

    @staticmethod
    def _get_canonicalized_headers(headers):
        canon_keys = []
        for k in headers:
            if k.startswith('x-acs-'):
                canon_keys.append(k)
        canon_keys = sorted(canon_keys)
        canon_header = ''
        for k in canon_keys:
            canon_header += '%s:%s\n' % (k, headers[k])
        return canon_header

    @staticmethod
    def _get_canonicalized_resource(pathname, query):
        if len(query) <= 0:
            return pathname
        resource = '%s?' % pathname
        query_list = sorted(list(query))
        for key in query_list:
            if query[key] is not None:
                if query[key] == '':
                    s = '%s&' % key
                else:
                    s = '%s=%s&' % (key, query[key])
                resource += s
        return resource[:-1]

    @staticmethod
    def get_string_to_sign(request):
        """
        Get the string to be signed according to request

        @param request:  which contains signed messages

        @return: the signed string
        """
        method, pathname, headers, query = request.method, request.pathname, request.headers, request.query

        accept = '' if headers.get('accept') is None else headers.get('accept')
        content_md5 = '' if headers.get('content-md5') is None else headers.get('content-md5')
        content_type = '' if headers.get('content-type') is None else headers.get('content-type')
        date = '' if headers.get('date') is None else headers.get('date')

        header = '%s\n%s\n%s\n%s\n%s\n' % (method, accept, content_md5, content_type, date)
        canon_headers = Client._get_canonicalized_headers(headers)
        canon_resource = Client._get_canonicalized_resource(pathname, query)
        sign_str = header + canon_headers + canon_resource
        return sign_str

    @staticmethod
    def get_roasignature(string_to_sign, secret):
        """
        Get signature according to stringToSign, secret

        @type string_to_sign: str
        @param string_to_sign:  the signed string

        @type secret: str
        @param secret: accesskey secret

        @return: the signature
        """
        hash_val = hmac.new(secret.encode('utf-8'), string_to_sign.encode('utf-8'), hashlib.sha1).digest()
        signature = base64.b64encode(hash_val).decode('utf-8')
        return signature

    @staticmethod
    def _object_handler(key, value, out):
        if value is None:
            return

        if isinstance(value, dict):
            for k, v in value.items():
                Client._object_handler('%s.%s' % (key, k), v, out)
        elif isinstance(value, TeaModel):
            for k, v in value.to_map().items():
                Client._object_handler('%s.%s' % (key, k), v, out)
        elif isinstance(value, (list, tuple)):
            for index, val in enumerate(value):
                Client._object_handler('%s.%s' % (key, index + 1), val, out)
        else:
            if key.startswith('.'):
                key = key[1:]
            if isinstance(value, bytes):
                out[key] = str(value, encoding='utf-8')
            elif not isinstance(value, STREAM_CLASS):
                out[key] = str(value)

    @staticmethod
    def to_form(filter):
        """
        Parse filter into a form string

        @type filter: dict
        @param filter: object

        @return: the string
        """
        result = {}
        if filter:
            Client._object_handler('', filter, result)
        return Util.to_form_string(
            Util.anyify_map_value(result)
        )

    @staticmethod
    def get_timestamp():
        """
        Get timestamp

        @return: the timestamp string
        """
        return datetime.datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")

    @staticmethod
    def query(filter):
        """
        Parse filter into a object which's type is map[string]string

        @type filter: dict
        @param filter: query param

        @return: the object
        """
        out_dict = {}
        if filter:
            Client._object_handler('', filter, out_dict)
        return out_dict

    @staticmethod
    def get_rpcsignature(signed_params, method, secret):
        """
        Get signature according to signedParams, method and secret

        @type signed_params: dict
        @param signed_params: params which need to be signed

        @type method: str
        @param method: http method e.g. GET

        @type secret: str
        @param secret: AccessKeySecret

        @return: the signature
        """
        queries = signed_params.copy()
        keys = list(queries.keys())
        keys.sort()

        canonicalized_query_string = ""

        for k in keys:
            if queries[k] is not None:
                canonicalized_query_string += f'&{quote(k, safe="~", encoding="utf-8")}=' \
                                              f'{quote(queries[k], safe="~", encoding="utf-8")}'

        string_to_sign = f'{method}&%2F&{quote_plus(canonicalized_query_string[1:], safe="~", encoding="utf-8")}'

        digest_maker = hmac.new(bytes(secret + '&', encoding="utf-8"),
                                bytes(string_to_sign, encoding="utf-8"),
                                digestmod=hashlib.sha1)
        hash_bytes = digest_maker.digest()
        signed_str = str(base64.b64encode(hash_bytes), encoding="utf-8")

        return signed_str

    @staticmethod
    def array_to_string_with_specified_style(array, prefix, style):
        """
        Parse array into a string with specified style

        @type array: any
        @param array: the array

        @type prefix: str
        @param prefix: the prefix string

        @param style: specified style e.g. repeatList

        @return: the string
        """
        if array is None:
            return ''

        if style == 'repeatList':
            return Client._flat_repeat_list({prefix: array})
        elif style == 'simple':
            return ','.join(map(str, array))
        elif style == 'spaceDelimited':
            return ' '.join(map(str, array))
        elif style == 'pipeDelimited':
            return '|'.join(map(str, array))
        elif style == 'json':
            return Util.to_jsonstring(Client._parse_to_dict(array))
        else:
            return ''

    @staticmethod
    def _flat_repeat_list(dic):
        query = {}
        if dic:
            Client._object_handler('', dic, query)

        l = []
        q = sorted(query)
        for i in q:
            k = quote_plus(i, encoding='utf-8')
            v = quote_plus(query[i], encoding='utf-8')
            l.append(k + '=' + v)
        return '&&'.join(l)

    @staticmethod
    def parse_to_map(inp):
        """
        Transform input as map.
        """
        try:
            result = Client._parse_to_dict(inp)
            return copy.deepcopy(result)
        except TypeError:
            return

    @staticmethod
    def _parse_to_dict(val):
        if isinstance(val, dict):
            result = {}
            for k, v in val.items():
                if isinstance(v, (list, dict, TeaModel)):
                    result[k] = Client._parse_to_dict(v)
                else:
                    result[k] = v
            return result
        elif isinstance(val, list):
            result = []
            for i in val:
                if isinstance(i, (list, dict, TeaModel)):
                    result.append(Client._parse_to_dict(i))
                else:
                    result.append(i)
            return result
        elif isinstance(val, TeaModel):
            return val.to_map()

    @staticmethod
    def get_endpoint(endpoint, server_use, endpoint_type):
        """
        If endpointType is internal, use internal endpoint
        If serverUse is true and endpointType is accelerate, use accelerate endpoint
        Default return endpoint
        @param server_use whether use accelerate endpoint
        @param endpoint_type value must be internal or accelerate
        @return the final endpoint
        """
        if endpoint_type == "internal":
            str_split = endpoint.split('.')
            str_split[0] += "-internal"
            endpoint = ".".join(str_split)

        if server_use and endpoint_type == "accelerate":
            return "oss-accelerate.aliyuncs.com"

        return endpoint

    @staticmethod
    def hash(raw, sign_type):
        if sign_type == 'ACS3-HMAC-SHA256' or sign_type == 'ACS3-RSA-SHA256':
            return hashlib.sha256(raw).digest()
        elif sign_type == 'ACS3-HMAC-SM3':
            return hash_sm3(raw)

    @staticmethod
    def hex_encode(raw):
        if raw:
            return binascii.b2a_hex(raw).decode('utf-8')

    @staticmethod
    def get_authorization(request, sign_type, payload, ak, secret):
        canonical_uri = request.pathname if request.pathname else '/'
        canonicalized_query = get_canonical_query_string(request.query)
        canonicalized_headers, signed_headers = get_canonicalized_headers(request.headers)

        canonical_request = f'{request.method}\n' \
                            f'{canonical_uri}\n' \
                            f'{canonicalized_query}\n' \
                            f'{canonicalized_headers}\n' \
                            f'{signed_headers}\n' \
                            f'{payload}'

        str_to_sign = f'{sign_type}\n{Client.hex_encode(Client.hash(canonical_request.encode("utf-8"), sign_type))}'
        signature = Client.hex_encode(signature_method(secret, str_to_sign, sign_type))
        auth = f'{sign_type} Credential={ak},SignedHeaders={signed_headers},Signature={signature}'
        return auth

    @staticmethod
    def get_encode_path(path):
        return quote(path, safe='/~', encoding="utf-8")

    @staticmethod
    def get_encode_param(param):
        return quote(param, safe='~', encoding="utf-8")
