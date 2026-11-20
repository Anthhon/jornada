"""Exercise Axios against Django using an isolated test database, never db.sqlite3.

Run from the repository root:
  back-end/.venv/Scripts/python.exe front-end/tests/django-smoke.py
"""
import os
from pathlib import Path
import subprocess
import sys

FRONTEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(FRONTEND.parent / "back-end"))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

import django
from django.conf import settings

# Exercise the current model/API contract in a disposable database. Existing local
# migration history is incomplete; this smoke test does not validate migrations.
settings.MIGRATION_MODULES = {
    **getattr(settings, "MIGRATION_MODULES", {}),
    "users": None,
    "groups": None,
}
django.setup()

from django.contrib.auth.models import User
from django.test import LiveServerTestCase
from django.test.runner import DiscoverRunner


class AxiosIntegrationTest(LiveServerTestCase):
    def test_jwt_contract(self):
        User.objects.create_user(username="integration-test", password="integration-test-only")
        env = {**os.environ, "NEXT_PUBLIC_API_BASE_URL": f"{self.live_server_url}/api", "NEXT_PUBLIC_API_MOCKING": "disabled"}
        subprocess.run(
            ["node", "node_modules/tsx/dist/cli.mjs", "tests/django-smoke.ts"],
            cwd=FRONTEND, env=env, check=True, timeout=45,
        )


if __name__ == "__main__":
    sys.exit(bool(DiscoverRunner(verbosity=2, interactive=False).run_tests(["__main__"])))
