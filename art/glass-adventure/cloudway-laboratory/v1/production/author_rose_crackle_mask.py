#!/usr/bin/env python3
"""Author a reviewable rose-gold UV mask from color and metallic evidence."""

from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path
import tempfile
from typing import Any

import numpy as np
from PIL import Image, ImageFilter


Image.MAX_IMAGE_PIXELS = None
HERE = Path(__file__).resolve().parent
KIT = HERE.parent
SOURCE = Path(
    os.environ.get("GLASS_SOURCE_ROOT", str(KIT / "source-assets"))
).expanduser().resolve()
ASSET = "rose-quartz-crackle-fast"


def digest(path: Path) -> str:
    result = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            result.update(block)
    return result.hexdigest()


def logical_path(path: Path) -> str:
    return "source-assets/" + path.resolve().relative_to(SOURCE).as_posix()


def durable_json(path: Path, value: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    descriptor, temporary_name = tempfile.mkstemp(
        prefix=f".{path.name}.", suffix=".tmp", dir=path.parent
    )
    temporary = Path(temporary_name)
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8") as handle:
            json.dump(value, handle, indent=2)
            handle.write("\n")
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temporary, path)
    finally:
        temporary.unlink(missing_ok=True)


def source_paths() -> tuple[Path, Path]:
    texture_dir = SOURCE / "meshy" / ASSET / "textures"
    return texture_dir / "set-0-base_color.png", texture_dir / "set-0-metallic.png"


def author_mask(base_path: Path, metallic_path: Path, output: Path) -> dict[str, Any]:
    base = Image.open(base_path).convert("RGB")
    metallic = Image.open(metallic_path).convert("L")
    if metallic.size != base.size:
        metallic = metallic.resize(base.size, Image.Resampling.BILINEAR)
    mask = Image.new("L", base.size)
    selected = 0
    color_candidates = 0
    metallic_candidates = 0
    chunk_height = 512
    for top in range(0, base.height, chunk_height):
        bottom = min(base.height, top + chunk_height)
        colors = np.asarray(base.crop((0, top, base.width, bottom)), dtype=np.int16)
        metal = np.asarray(
            metallic.crop((0, top, metallic.width, bottom)), dtype=np.int16
        )
        red = colors[:, :, 0]
        green = colors[:, :, 1]
        blue = colors[:, :, 2]
        warm_gold = (
            (red >= 70)
            & (green >= 42)
            & (red - green >= 8)
            & (green - blue >= 6)
            & (red - blue >= 28)
        )
        metallic_support = metal >= 88
        combined = warm_gold & metallic_support
        selected += int(combined.sum())
        color_candidates += int(warm_gold.sum())
        metallic_candidates += int(metallic_support.sum())
        mask.paste(
            Image.fromarray((combined.astype(np.uint8) * 255), mode="L"),
            (0, top),
        )
    mask = mask.filter(ImageFilter.MaxFilter(7)).filter(
        ImageFilter.GaussianBlur(radius=1.15)
    )
    output.parent.mkdir(parents=True, exist_ok=True)
    mask.save(output, optimize=True)
    pixels = base.width * base.height
    return {
        "dimensions": [base.width, base.height],
        "selectedPixelsBeforeEdgeExpansion": selected,
        "selectedFractionBeforeEdgeExpansion": round(selected / pixels, 9),
        "colorCandidateFraction": round(color_candidates / pixels, 9),
        "metallicCandidateFraction": round(metallic_candidates / pixels, 9),
    }


def write_previews(base_path: Path, mask_path: Path, proof_dir: Path) -> None:
    base = Image.open(base_path).convert("RGB")
    mask = Image.open(mask_path).convert("L")
    size = (1024, 1024)
    base.thumbnail(size, Image.Resampling.LANCZOS)
    mask.thumbnail(size, Image.Resampling.LANCZOS)
    mask.save(proof_dir / "gold-mask-atlas.png", optimize=True)
    overlay = base.copy()
    red = Image.new("RGB", base.size, (255, 32, 16))
    overlay = Image.composite(red, overlay, mask.point(lambda value: value // 2))
    overlay.save(proof_dir / "gold-mask-overlay.png", optimize=True)


def main() -> None:
    base_path, metallic_path = source_paths()
    production_dir = SOURCE / "production" / ASSET
    proof_dir = SOURCE / "proofs" / "blender" / ASSET / "semantic-candidate"
    proof_dir.mkdir(parents=True, exist_ok=True)
    mask_path = production_dir / "rose-gold-mask-v1.png"
    statistics = author_mask(base_path, metallic_path, mask_path)
    write_previews(base_path, mask_path, proof_dir)
    report = {
        "schema": "cloudway-rose-gold-mask/v1",
        "assetId": ASSET,
        "status": "visual-mask candidate; Blender multi-view acceptance pending",
        "method": {
            "signals": [
                "warm gold base-color relation",
                "independent metallic support",
            ],
            "thresholds8Bit": {
                "redMinimum": 70,
                "greenMinimum": 42,
                "redMinusGreenMinimum": 8,
                "greenMinusBlueMinimum": 6,
                "redMinusBlueMinimum": 28,
                "metallicMinimum": 88,
            },
            "edgeExpansionPixels": 3,
            "edgeBlurRadiusPixels": 1.15,
            "guardrail": (
                "This mask does not use metallic pixels alone. Geometry-space corner "
                "regions are added separately in Blender and the combined result must "
                "pass PBR, clay, mask, and transmission review."
            ),
        },
        "inputs": [
            {
                "role": "base_color",
                "file": logical_path(base_path),
                "sha256": digest(base_path),
            },
            {
                "role": "metallic",
                "file": logical_path(metallic_path),
                "sha256": digest(metallic_path),
            },
        ],
        "output": {
            "file": logical_path(mask_path),
            "bytes": mask_path.stat().st_size,
            "sha256": digest(mask_path),
            **statistics,
        },
        "proofs": [
            logical_path(proof_dir / "gold-mask-atlas.png"),
            logical_path(proof_dir / "gold-mask-overlay.png"),
        ],
    }
    durable_json(production_dir / "rose-gold-mask-v1.json", report)
    durable_json(HERE / "reports" / "rose-quartz-crackle-fast-gold-mask.json", report)
    print("ROSE_MASK=" + json.dumps(report["output"], separators=(",", ":")))


if __name__ == "__main__":
    main()
