import unittest
import os
import types
import sys
from importlib import reload

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
SITE_PACKAGES = os.path.join(ROOT_DIR, '.venv', 'lib', 'python3.11', 'site-packages')
if os.path.isdir(SITE_PACKAGES):
    sys.path.insert(0, SITE_PACKAGES)

os.environ["MONGO_USERNAME"] = "user"
os.environ["MONGO_PASSWORD"] = "pass"
os.environ["MONGO_HOST"] = "localhost"
os.environ["MONGO_PORT"] = "27017"
os.environ["MONGO_DB_NAME"] = "testdb"

# Mock motor.motor_asyncio so the module can be imported without the dependency
motor_module = types.ModuleType("motor")
motor_asyncio = types.ModuleType("motor.motor_asyncio")
class DummyClient:
    def __init__(self, *args, **kwargs):
        pass
motor_asyncio.AsyncIOMotorClient = DummyClient
setattr(motor_module, "motor_asyncio", motor_asyncio)
sys.modules.setdefault("motor", motor_module)
sys.modules.setdefault("motor.motor_asyncio", motor_asyncio)

from app.utils import mongo_init
mongo_init = reload(mongo_init)

class MongoInitTestCase(unittest.TestCase):
    def test_get_mongo_url(self):
        expected = "mongodb://user:pass@localhost:27017/testdb?authSource=admin"
        self.assertEqual(mongo_init.get_mongo_url(), expected)

if __name__ == "__main__":
    unittest.main()
