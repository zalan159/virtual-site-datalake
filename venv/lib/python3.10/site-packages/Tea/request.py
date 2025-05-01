class TeaRequest:
    _PROPERTY_DEFAULT_MAP = {
        'query': {},
        'protocol': 'http',
        'port': 80,
        'method': 'GET',
        'headers': {},
        'pathname': "",
        'body': None,
    }

    def __init__(self):
        self.query = {}
        self.protocol = "http"
        self.port = 80
        self.method = "GET"
        self.headers = {}
        self.pathname = ""
        self.body = None

    def __setattr__(self, key, value):
        if key in self._PROPERTY_DEFAULT_MAP:
            if not value:
                if isinstance(self._PROPERTY_DEFAULT_MAP[key], (list, dict)):
                    self.__dict__[key] = self._PROPERTY_DEFAULT_MAP[key].copy()
                else:
                    self.__dict__[key] = self._PROPERTY_DEFAULT_MAP[key]
                return
        self.__dict__[key] = value
