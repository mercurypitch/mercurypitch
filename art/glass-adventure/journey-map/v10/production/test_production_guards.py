"""Changed botanical inputs must fail before any accepted delivery can be replaced."""
import json
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]


class ProductionGuards(unittest.TestCase):
    def test_packaging_rejects_drift_without_writing_accepted_output(self):
        with tempfile.TemporaryDirectory(dir=ROOT.parent, prefix="botanical-guard-") as temporary:
            candidate = Path(temporary)
            for name in ("production", "baked", "delivery"):
                (candidate / name).mkdir()
            script = candidate / "production/package_botanical.mjs"
            shutil.copyfile(ROOT / "production/package_botanical.mjs", script)
            accepted = json.loads((ROOT / "production/accepted-inputs.json").read_text())
            (candidate / "production/accepted-inputs.json").write_text(json.dumps(accepted))
            (candidate / "baked/camellia-crescent-rebaked.glb").write_bytes(b"unreviewed donor")
            protected = candidate / "delivery/floating-museum-botanical-kit-v10-1k.glb"
            protected.write_bytes(b"accepted delivery sentinel")
            result = subprocess.run(["node", str(script), "1024"], capture_output=True,
                                    text=True, timeout=30)
            self.assertNotEqual(result.returncode, 0)
            self.assertIn("Reviewed botanical input changed", result.stderr)
            self.assertEqual(protected.read_bytes(), b"accepted delivery sentinel")
            self.assertEqual(list((candidate / "delivery").iterdir()), [protected])

    def test_tangent_repair_rejects_drift_before_replacing_export(self):
        with tempfile.TemporaryDirectory(dir=ROOT.parent, prefix="botanical-guard-") as temporary:
            candidate = Path(temporary)
            (candidate / "production").mkdir()
            (candidate / "baked").mkdir()
            script = candidate / "production/repair_bake_tangents.py"
            shutil.copyfile(ROOT / "production/repair_bake_tangents.py", script)
            shutil.copyfile(ROOT / "production/accepted-inputs.json", candidate / "production/accepted-inputs.json")
            (candidate / "baked/camellia-crescent-rebaked.glb").write_bytes(b"unreviewed donor")
            protected = candidate / "baked/camellia-crescent-rebaked-valid.glb"
            protected.write_bytes(b"accepted export sentinel")
            result = subprocess.run(["python3", str(script)], capture_output=True,
                                    text=True, timeout=30)
            self.assertNotEqual(result.returncode, 0)
            self.assertIn("Reviewed baked source changed", result.stderr)
            self.assertEqual(protected.read_bytes(), b"accepted export sentinel")


if __name__ == "__main__":
    unittest.main()
