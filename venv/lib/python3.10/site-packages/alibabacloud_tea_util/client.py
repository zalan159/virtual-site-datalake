import json
import platform
import time
import Tea
import asyncio
import threading
import random
import hashlib

from datetime import datetime
from urllib.parse import urlencode
from io import BytesIO

from Tea.model import TeaModel
from Tea.stream import READABLE
from typing import Any, BinaryIO, Dict, List

_process_start_time = int(time.time() * 1000)
_seqId = 0

class Client:
    """
    This is a utility module
    """

    class __ModelEncoder(json.JSONEncoder):
        def default(self, o: Any) -> Any:
            if isinstance(o, TeaModel):
                return o.to_map()
            elif isinstance(o, bytes):
                return o.decode('utf-8')
            super().default(o)

    @staticmethod
    def __read_part(f, size=1024):
        while True:
            part = f.read(size)
            if part:
                yield part
            else:
                return

    @staticmethod
    def __get_default_agent():
        return f'AlibabaCloud ({platform.system()}; {platform.machine()}) ' \
               f'Python/{platform.python_version()} Core/{Tea.__version__} TeaDSL/1'

    @staticmethod
    def to_bytes(
        val: str,
    ) -> bytes:
        """
        Convert a string(utf8) to bytes
        @return: the return bytes
        """
        if isinstance(val, bytes):
            return val
        elif isinstance(val, str):
            return val.encode(encoding="utf-8")
        else:
            return str(val).encode(encoding="utf-8")


    @staticmethod
    def to_string(
        val: bytes,
    ) -> str:
        """
        Convert a bytes to string(utf8)
        @return: the return string
        """
        if isinstance(val, str):
            return val
        elif isinstance(val, bytes):
            return val.decode('utf-8')
        else:
            return str(val)

    @staticmethod
    def parse_json(
        val: str,
    ) -> Any:
        """
        Parse it by JSON format
        @return: the parsed result
        """
        try:
            return json.loads(val)
        except ValueError:
            raise RuntimeError(f'Failed to parse the value as json format, Value: "{val}".')

    @staticmethod
    async def read_as_bytes_async(stream) -> bytes:
        """
        Read data from a readable stream, and compose it to a bytes
        @param stream: the readable stream
        @return: the bytes result
        """
        if isinstance(stream, bytes):
            return stream
        elif isinstance(stream, str):
            return bytes(stream, encoding='utf-8')
        else:
            return await stream.read()

    @staticmethod
    async def read_as_string_async(stream) -> str:
        """
        Read data from a readable stream, and compose it to a string
        @param stream: the readable stream
        @return: the string result
        """
        buff = await Client.read_as_bytes_async(stream)
        return Client.to_string(buff)

    @staticmethod
    async def read_as_json_async(stream) -> Any:
        """
        Read data from a readable stream, and parse it by JSON format
        @param stream: the readable stream
        @return: the parsed result
        """
        return Client.parse_json(
            await Client.read_as_string_async(stream)
        )

    @staticmethod
    def read_as_bytes(stream) -> bytes:
        """
        Read data from a readable stream, and compose it to a bytes
        @param stream: the readable stream
        @return: the bytes result
        """
        if isinstance(stream, READABLE):
            b = b''
            for part in Client.__read_part(stream, 1024):
                b += part
            return b
        elif isinstance(stream, bytes):
            return stream
        else:
            return bytes(stream, encoding='utf-8')

    @staticmethod
    def read_as_string(stream) -> str:
        """
        Read data from a readable stream, and compose it to a string
        @param stream: the readable stream
        @return: the string result
        """
        buff = Client.read_as_bytes(stream)
        return Client.to_string(buff)

    @staticmethod
    def read_as_json(stream) -> Any:
        """
        Read data from a readable stream, and parse it by JSON format
        @param stream: the readable stream
        @return: the parsed result
        """
        return Client.parse_json(Client.read_as_string(stream))

    @staticmethod
    def get_nonce() -> str:
        """
        Generate a nonce string
        @return: the nonce string
        """
        global _seqId
        thread_id = threading.get_ident()
        current_time = int(time.time() * 1000)
        seq = _seqId
        _seqId += 1
        randNum = random.getrandbits(64)
        msg = f'{_process_start_time}-{thread_id}-{current_time}-{seq}-{randNum}'
        md5 = hashlib.md5()
        md5.update(msg.encode('utf-8'))
        return md5.hexdigest()

    @staticmethod
    def get_date_utcstring() -> str:
        """
        Get an UTC format string by current date, e.g. 'Thu, 06 Feb 2020 07:32:54 GMT'
        @return: the UTC format string
        """
        return datetime.utcnow().strftime('%a, %d %b %Y %H:%M:%S GMT')

    @staticmethod
    def default_string(
        real: str,
        default: str,
    ) -> str:
        """
        If not set the real, use default value
        @return: the return string
        """
        return real if real is not None else default

    @staticmethod
    def default_number(
        real: int,
        default: int,
    ) -> int:
        """
        If not set the real, use default value
        @return: the return number
        """
        return real if real is not None else default

    @staticmethod
    def to_form_string(
        val: dict,
    ) -> str:
        """
        Format a map to form string, like a=a%20b%20c
        @return: the form string
        """
        if not val:
            return ""
        keys = sorted(list(val))
        dic = {k: val[k] for k in keys if not isinstance(val[k], READABLE)}
        return urlencode(dic)

    @staticmethod
    def to_jsonstring(
        val: Any,
    ) -> str:
        """
        Stringify a value by JSON format
        @return: the JSON format string
        """
        if isinstance(val, str):
            return str(val)
        return json.dumps(
            val, cls=Client.__ModelEncoder, ensure_ascii=False, separators=(",", ":")
        )

    @staticmethod
    def empty(
        val: str,
    ) -> bool:
        """
        Check the string is empty?
        @return: if string is null or zero length, return true
        """
        return not val

    @staticmethod
    def equal_string(
        val1: str,
        val2: str,
    ) -> bool:
        """
        Check one string equals another one?
        @return: if equals, return true
        """
        return val1 == val2

    @staticmethod
    def equal_number(
        val1: int,
        val2: int,
    ) -> bool:
        """
        Check one number equals another one?
        @return: if equals, return true
        """
        return val1 == val2

    @staticmethod
    def is_unset(
        value: Any,
    ) -> bool:
        """
        Check one value is unset
        @return: if unset, return true
        """
        return value is None

    @staticmethod
    def stringify_map_value(
        m: Dict[str, Any],
    ) -> Dict[str, str]:
        """
        Stringify the value of map
        @return: the new stringified map
        """
        if m is None:
            return {}

        dic_result = {}
        for k, v in m.items():
            if v is not None:
                if isinstance(v, bytes):
                    v = v.decode('utf-8')
                else:
                    v = str(v)
            dic_result[k] = v
        return dic_result

    @staticmethod
    def anyify_map_value(
        m: Dict[str, str],
    ) -> Dict[str, Any]:
        """
        Anyify the value of map
        @return: the new anyfied map
        """
        return m

    @staticmethod
    def assert_as_boolean(
        value: Any,
    ) -> bool:
        """
        Assert a value, if it is a boolean, return it, otherwise throws
        @return: the boolean value
        """
        if not isinstance(value, bool):
            raise ValueError(f'{value} is not a bool')
        return value

    @staticmethod
    def assert_as_string(
        value: Any,
    ) -> str:
        """
        Assert a value, if it is a string, return it, otherwise throws
        @return: the string value
        """
        if not isinstance(value, str):
            raise ValueError(f'{value} is not a str')
        return value

    @staticmethod
    def assert_as_bytes(
        value: Any,
    ) -> bytes:
        """
        Assert a value, if it is a bytes, return it, otherwise throws
        @return: the bytes value
        """
        if not isinstance(value, bytes):
            raise ValueError(f'{value} is not a bytes')
        return value

    @staticmethod
    def assert_as_number(
        value: Any,
    ) -> int:
        """
        Assert a value, if it is a number, return it, otherwise throws
        @return: the number value
        """
        if not isinstance(value, (int, float)):
            raise ValueError(f'{value} is not a number')
        return value

    @staticmethod
    def assert_as_integer(
        value: Any,
    ) -> int:
        """
        Assert a value, if it is a integer, return it, otherwise throws
        @return: the integer value
        """
        if not isinstance(value, int):
            raise ValueError(f'{value} is not a int number')
        return value

    @staticmethod
    def assert_as_map(
        value: Any,
    ) -> Dict[str, Any]:
        """
        Assert a value, if it is a map, return it, otherwise throws
        @return: the map value
        """
        if not isinstance(value, dict):
            raise ValueError(f'{value} is not a dict')
        return value

    @staticmethod
    def get_user_agent(
        user_agent: str,
    ) -> str:
        """
        Get user agent, if it userAgent is not null, splice it with defaultUserAgent and return, otherwise return defaultUserAgent
        @return: the string value
        """
        if user_agent:
            return f'{Client.__get_default_agent()} {user_agent}'
        return Client.__get_default_agent()

    @staticmethod
    def is_2xx(
        code: int,
    ) -> bool:
        """
        If the code between 200 and 300, return true, or return false
        @return: boolean
        """
        return 200 <= code < 300

    @staticmethod
    def is_3xx(
        code: int,
    ) -> bool:
        """
        If the code between 300 and 400, return true, or return false
        @return: boolean
        """
        return 300 <= code < 400

    @staticmethod
    def is_4xx(
        code: int,
    ) -> bool:
        """
        If the code between 400 and 500, return true, or return false
        @return: boolean
        """
        return 400 <= code < 500

    @staticmethod
    def is_5xx(
        code: int,
    ) -> bool:
        """
        If the code between 500 and 600, return true, or return false
        @return: boolean
        """
        return 500 <= code < 600

    @staticmethod
    def validate_model(
        m: TeaModel,
    ) -> None:
        """
        Validate model
        @return: void
        """
        if isinstance(m, TeaModel):
            m.validate()

    @staticmethod
    def to_map(
        in_: TeaModel,
    ) -> Dict[str, Any]:
        """
        Model transforms to map[string]any
        @return: map[string]any
        """
        if isinstance(in_, TeaModel):
            return in_.to_map()
        else:
            return in_

    @staticmethod
    def sleep(
        millisecond: int,
    ) -> None:
        """
        Suspends the current thread for the specified number of milliseconds.
        """
        time.sleep(millisecond / 1000)

    @staticmethod
    async def sleep_async(
            millisecond: int,
    ) -> None:
        """
        Suspends the current thread for the specified number of milliseconds.
        """
        await asyncio.sleep(millisecond / 1000)

    @staticmethod
    def to_array(
        input: Any,
    ) -> List[Dict[str, Any]]:
        """
        Transform input as array.
        """
        if input is None:
            return []

        out = []
        for i in input:
            if isinstance(i, TeaModel):
                out.append(i.to_map())
            else:
                out.append(i)
        return out

    @staticmethod
    def assert_as_readable(
        value: Any,
    ) -> BinaryIO:
        """
        Assert a value, if it is a readable, return it, otherwise throws
        @return: the readable value
        """
        if isinstance(value, str):
            value = value.encode('utf-8')

        if isinstance(value, bytes):
            value = BytesIO(value)
        elif not isinstance(value, READABLE):
            raise ValueError(f'The value is not a readable')
        return value

    @staticmethod
    def assert_as_array(
        value: Any,
    ) -> list:
        if not isinstance(value, list):
            raise ValueError('The value is not a list')
        return value
