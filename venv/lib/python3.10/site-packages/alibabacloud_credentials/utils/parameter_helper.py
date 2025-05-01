from urllib.parse import quote_plus, urlencode

import hmac
import hashlib
import base64
import socket
import uuid
import datetime
import platform

import alibabacloud_credentials
from Tea.request import TeaRequest

TIME_ZONE = "UTC"
FORMAT_ISO_8601 = "yyyy-MM-dd'T'HH:mm:ss'Z'"
FORMAT_RFC_2616 = "%a, %d %b %Y %H:%M:%S GMT"
SEPARATOR = "&"
ENCODING = "UTF-8"
ALGORITHM_NAME = "HmacSHA1"


def get_new_request():
    request = TeaRequest()
    request.headers['user-agent'] = f'AlibabaCloud ({platform.system()}; {platform.machine()}) ' \
                                    f'Python/{platform.python_version()} ' \
                                    f'Credentials/{alibabacloud_credentials.__version__} ' \
                                    f'TeaDSL/1'
    return request


def get_uuid():
    name = socket.gethostname() + str(uuid.uuid1())
    namespace = uuid.NAMESPACE_URL
    return str(uuid.uuid5(namespace, name))


def get_iso_8061_date():
    return datetime.datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")


def compose_string_to_sign(method, queries):
    sorted_key = sorted(list(queries.keys()))
    canonicalized_query_string = ''
    for key in sorted_key:
        canonicalized_query_string += '&%s=%s' % (
            quote_plus(key), quote_plus(queries.get(key))
        )

    string_to_sign = method + SEPARATOR + quote_plus('/') + SEPARATOR + quote_plus(canonicalized_query_string[1:])
    return string_to_sign


def sign_string(sign, secret):
    hash_val = hmac.new(secret.encode(ENCODING), sign.encode(ENCODING), hashlib.sha1).digest()
    signature = base64.encodebytes(hash_val).decode(ENCODING)
    return signature.rstrip('\n')


def compose_url(endpoint, queries, protocol):
    url = protocol + "://" + endpoint + "/?"
    url += urlencode(queries)
    return url
