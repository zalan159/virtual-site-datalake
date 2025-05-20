import unittest
import os
import types
import sys
from importlib import reload

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
SITE_PACKAGES = os.path.join(ROOT_DIR, '.venv', 'lib', 'python3.11', 'site-packages')
if os.path.isdir(SITE_PACKAGES):
    sys.path.insert(0, SITE_PACKAGES)

# Stub jose module since dependency is not available
jose_module = types.ModuleType("jose")
class DummyJWTError(Exception):
    pass
jwt_submodule = types.ModuleType("jwt")

def encode(payload, key, algorithm=None):
    import base64, json, datetime
    def default(o):
        if isinstance(o, (datetime.datetime, datetime.date)):
            return o.isoformat()
        raise TypeError
    return base64.b64encode(json.dumps(payload, default=default).encode()).decode()

def decode(token, key, algorithms=None):
    import base64, json
    return json.loads(base64.b64decode(token).decode())

jwt_submodule.encode = encode
jwt_submodule.decode = decode
jose_module.JWTError = DummyJWTError
jose_module.jwt = jwt_submodule
sys.modules.setdefault("jose", jose_module)

# Environment variables for utils
os.environ["JWT_SECRET_KEY"] = "testsecret"
os.environ["JWT_ALGORITHM"] = "HS256"
os.environ["JWT_ACCESS_TOKEN_EXPIRE_MINUTES"] = "30"
os.environ["MONGO_USERNAME"] = "user"
os.environ["MONGO_PASSWORD"] = "pass"
os.environ["MONGO_HOST"] = "localhost"
os.environ["MONGO_PORT"] = "27017"
os.environ["MONGO_DB_NAME"] = "db"

import app.auth.utils as utils
utils = reload(utils)

class AuthUtilsTestCase(unittest.TestCase):
    def test_create_access_token(self):
        token = utils.create_access_token({"sub": "tester"})
        payload = utils.jwt.decode(
            token, utils.SECRET_KEY, algorithms=[utils.ALGORITHM]
        )
        self.assertEqual(payload["sub"], "tester")

if __name__ == "__main__":
    unittest.main()
