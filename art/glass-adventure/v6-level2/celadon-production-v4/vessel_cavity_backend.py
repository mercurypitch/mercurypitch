"""Run the shared measured-cavity backend for the isolated Celadon V4 build."""

from __future__ import annotations

import runpy
from pathlib import Path


runpy.run_path(
    str(Path(__file__).resolve().parent.parent / "vessel_cavity_backend.py"),
    run_name="__main__",
)
