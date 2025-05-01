class BaseStream:
    def __init__(self, size=1024):
        self.size = size

    def read(self, size=1024):
        raise NotImplementedError('read method must be overridden')

    def __len__(self):
        raise NotImplementedError('__len__ method must be overridden')

    def __next__(self):
        raise NotImplementedError('__next__ method must be overridden')

    def __iter__(self):
        return self


class _ReadableMc(type):
    def __instancecheck__(self, instance):
        if hasattr(instance, 'read') and hasattr(instance, '__iter__'):
            return True


class READABLE(metaclass=_ReadableMc):
    pass


class _WriteableMc(type):
    def __instancecheck__(self, instance):
        if hasattr(instance, 'write'):
            return True


class WRITABLE(metaclass=_WriteableMc):
    pass


STREAM_CLASS = (READABLE, WRITABLE)
