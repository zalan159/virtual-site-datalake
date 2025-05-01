import re
from .exceptions import RequiredArgumentException, ValidateException


class TeaModel:
    _map = None

    def validate(self):
        pass

    def to_map(self):
        return self._map

    def from_map(self, map=None):
        pass

    @staticmethod
    def validate_required(prop, prop_name):
        if prop is None:
            raise RequiredArgumentException(prop_name)

    @staticmethod
    def validate_max_length(prop, prop_name, max_length):
        if len(prop) > max_length:
            raise ValidateException(f'{prop_name} is exceed max-length: {max_length}')

    @staticmethod
    def validate_min_length(prop, prop_name, min_length):
        if len(prop) < min_length:
            raise ValidateException(f'{prop_name} is less than min-length: {min_length}')

    @staticmethod
    def validate_pattern(prop, prop_name, pattern):
        match_obj = re.search(pattern, str(prop), re.M | re.I)
        if not match_obj:
            raise ValidateException(f'{prop_name} is not match: {pattern}')

    @staticmethod
    def validate_maximum(num, prop_name, maximum):
        if num > maximum:
            raise ValidateException(f'{prop_name} is greater than the maximum: {maximum}')

    @staticmethod
    def validate_minimum(num, prop_name, minimum):
        if num < minimum:
            raise ValidateException(f'{prop_name} is less than the minimum: {minimum}')

    def __str__(self):
        s = self.to_map()
        if s:
            return str(s)
        else:
            return object.__str__(self)
