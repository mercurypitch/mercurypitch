"""Encode the approved portrait, marble and sky without cropping their art."""

import hashlib
import json
from pathlib import Path

from PIL import Image

HERE = Path(__file__).resolve().parent
OUT = HERE.parents[1] / "apps/beside-cue/public/games/adventure"


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    rows = []
    for name, limit in [("legend-johnny-cash", 1536), ("floor-marble", 1024), ("museum-sky", None)]:
        source = HERE / "textures" / (name + ".png")
        image = Image.open(source).convert("RGB")
        if limit is not None:
            image.thumbnail((limit, limit), Image.Resampling.LANCZOS)
        output = OUT / (name + ".webp")
        quality = 92 if name == "museum-sky" else 90
        image.save(output, quality=quality, method=6)
        jpeg = HERE / "textures" / (name + "-runtime.jpg")
        if name != "museum-sky":
            image.save(jpeg, quality=90, optimize=True)
        row = {
            "id": name, "source": "art/glass-adventure/textures/" + source.name,
            "sourceSha256": hashlib.sha256(source.read_bytes()).hexdigest(),
            "runtime": output.name, "width": image.width, "height": image.height,
            "bytes": output.stat().st_size,
            "sha256": hashlib.sha256(output.read_bytes()).hexdigest(),
            "generation": "Built-in imagegen, root task, 2026-09-14",
            "treatment": ("RGB WebP quality 92, method 6; no resize or crop"
                          if name == "museum-sky" else "RGB WebP/JPEG quality 90, no crop; bounded Lanczos resize only"),
        }
        if name != "museum-sky":
            row["embeddedJpeg"] = jpeg.name
            row["embeddedJpegSha256"] = hashlib.sha256(jpeg.read_bytes()).hexdigest()
        else:
            row["prompt"] = "art/glass-adventure/sky-prompt.md"
        rows.append(row)
    (HERE / "textures/provenance.json").write_text(json.dumps(rows, indent=2) + "\n")


if __name__ == "__main__":
    main()
