class CredentialException(Exception):

    def __init__(self, message, code=None, request_id=None):
        self.code = code
        self.message = message
        self.request_id = request_id
