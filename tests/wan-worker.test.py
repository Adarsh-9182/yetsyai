"""Exercise real worker request functions with inference and webhook threads stubbed."""
import ast
from collections import OrderedDict
import hashlib
import hmac
import json
import os
from pathlib import Path
import tempfile
from types import SimpleNamespace
import unittest
import uuid


class WorkerTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.calls = 0
        self.fail = False

        def render(*args):
            self.calls += 1
            if self.fail:
                raise RuntimeError("GPU unavailable")
            path = Path(self.temp.name) / f"{uuid.uuid4()}.mp4"
            path.write_bytes(b"fake-video-for-state-test")
            return str(path)

        class WorkerError(Exception):
            pass

        self.error = WorkerError
        self.secret = "test-only-secret-with-more-than-32-characters"
        source = ast.parse((Path(__file__).parents[1] / "spaces/wan-studio/app.py").read_text())
        functions = [node for node in source.body if isinstance(node, ast.FunctionDef) and node.name in ("generate", "remember")]
        self.worker = dict(hashlib=hashlib, hmac=hmac, json=json, uuid=uuid, Path=Path, os=os, SECRET=self.secret,
                           completed=OrderedDict(), gr=SimpleNamespace(Error=WorkerError), render=render, notify=lambda _: None,
                           threading=SimpleNamespace(Thread=lambda **_: SimpleNamespace(start=lambda: None)))
        exec(compile(ast.Module(body=functions, type_ignores=[]), "worker-contract", "exec"), self.worker)
        self.id = str(uuid.uuid4())

    def tearDown(self):
        self.temp.cleanup()

    def generate(self, **overrides):
        values = dict(secret=self.secret, request_id=self.id, prompt="A sunlit forest", negative_prompt="blur", ratio="16:9", seed=42, reference="")
        values.update(overrides)
        return self.worker["generate"](**values)

    def test_invalid_secret_does_not_reserve_gpu(self):
        with self.assertRaises(self.error):
            self.generate(secret="bad")
        self.assertEqual(self.calls, 0)

    def test_same_uuid_reuses_output_and_rejects_changed_scene(self):
        first = self.generate()
        self.assertEqual(self.generate(), first)
        with self.assertRaises(self.error):
            self.generate(prompt="A different scene")
        self.assertEqual(self.calls, 1)

    def test_failed_attempt_is_not_automatically_rendered_again(self):
        self.fail = True
        with self.assertRaises(self.error):
            self.generate()
        self.fail = False
        with self.assertRaises(self.error):
            self.generate()
        self.assertEqual(self.calls, 1)

    def test_expired_file_does_not_start_another_inference(self):
        Path(self.generate()).unlink()
        with self.assertRaises(self.error):
            self.generate()
        self.assertEqual(self.calls, 1)

    def test_output_retention_stays_bounded(self):
        for _ in range(26):
            self.generate(request_id=str(uuid.uuid4()))
        self.assertEqual(len(list(Path(self.temp.name).glob("*.mp4"))), 24)


if __name__ == "__main__":
    unittest.main()
