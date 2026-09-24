"""Compose fixed-angle art, runtime, and landing-contact review proofs."""

import hashlib
import json
import math
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFont


HERE = Path(__file__).resolve().parent
V3 = HERE.parent
V2 = V3.parent / "v2"
BEFORE = V2 / "proofs" / "cloudway-platform-kit-final-glb.png"
AFTER = V3 / "proofs" / "cloudway-platform-kit-v3.png"
OUTPUT = V3 / "proofs" / "cloudway-platform-kit-v2-v3-comparison.png"
SOURCE_DETAIL = V3 / "proofs" / "cloudway-platform-kit-v3-surface-detail.png"
RUNTIME_DETAIL = V3 / "proofs" / "cloudway-platform-kit-v3-runtime-surface-detail.png"
RUNTIME_OUTPUT = V3 / "proofs" / "cloudway-platform-kit-v3-source-runtime-comparison.png"
CONTACT = V3 / "proofs" / "cloudway-platform-kit-v3-contact-datum.png"
CONTACT_OUTPUT = V3 / "proofs" / "cloudway-platform-kit-v3-contact-measurements.png"
VALIDATION = V3 / "proofs" / "cloudway-platform-kit-v3-validation.json"


def fit(image: Image.Image, size: tuple[int, int]) -> Image.Image:
    copy = image.convert("RGB")
    copy.thumbnail(size, Image.Resampling.LANCZOS)
    panel = Image.new("RGB", size, (28, 33, 40))
    panel.paste(copy, ((size[0] - copy.width) // 2, (size[1] - copy.height) // 2))
    return panel


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def pixel_delta(left: Path, right: Path) -> dict[str, float]:
    difference = ImageChops.difference(Image.open(left).convert("RGB"), Image.open(right).convert("RGB"))
    histogram = difference.histogram()
    samples = difference.width * difference.height * 3
    absolute_sum = sum((index % 256) * count for index, count in enumerate(histogram))
    square_sum = sum((index % 256) ** 2 * count for index, count in enumerate(histogram))
    return {
        "meanAbsoluteRgb0To255": round(absolute_sum / samples, 4),
        "rmseRgb0To255": round(math.sqrt(square_sum / samples), 4),
    }


def pair(left: Path, right: Path, output: Path, left_label: str, right_label: str) -> None:
    panel_size = (960, 560)
    header = 68
    canvas = Image.new("RGB", (panel_size[0] * 2, panel_size[1] + header), (19, 23, 29))
    canvas.paste(fit(Image.open(left), panel_size), (0, header))
    canvas.paste(fit(Image.open(right), panel_size), (panel_size[0], header))
    draw = ImageDraw.Draw(canvas)
    font = ImageFont.load_default(size=28)
    draw.text((28, 18), left_label, fill=(226, 231, 237), font=font)
    draw.text((panel_size[0] + 28, 18), right_label, fill=(226, 231, 237), font=font)
    draw.line((panel_size[0], 0, panel_size[0], canvas.height), fill=(235, 186, 92), width=3)
    canvas.save(output, optimize=True)


def contact_proof(validation: dict[str, object]) -> None:
    source = Image.open(CONTACT).convert("RGB")
    footer_height = 140
    canvas = Image.new("RGB", (source.width, source.height + footer_height), (19, 23, 29))
    canvas.paste(source, (0, 0))
    draw = ImageDraw.Draw(canvas)
    font = ImageFont.load_default(size=21)
    draw.text(
        (26, source.height + 12),
        "Cyan cross = exact collider top datum (y=0). Measured upward donor surface:",
        fill=(226, 231, 237),
        font=font,
    )
    nodes = validation["sourceFreshReimport"]["nodes"]
    for index, row in enumerate(nodes[:3]):
        contact = row["exposedDonorLanding"]["contactMeasurements"]
        center = contact["center"]["heightRangeMetres"]
        edge = contact["edge"]["heightRangeMetres"]
        label = (
            f"{row['name'].replace('Cloudway_', '')}: center {center[0] * 1000:+.2f}..{center[1] * 1000:+.2f} mm; "
            f"edge {edge[0] * 1000:+.2f}..{edge[1] * 1000:+.2f} mm"
        )
        draw.text((26, source.height + 43 + 28 * index), label, fill=(182, 229, 235), font=font)
    canvas.save(CONTACT_OUTPUT, optimize=True)


def main() -> None:
    pair(
        BEFORE,
        AFTER,
        OUTPUT,
        "V2 runtime: 7k remesh + opaque top covers",
        "V3 source: 35-40k donor shells + exposed 2K PBR",
    )
    pair(
        SOURCE_DETAIL,
        RUNTIME_DETAIL,
        RUNTIME_OUTPUT,
        "V3 source: 2K color / normal / ORM",
        "V3 runtime: 2K color + 1K normal / ORM",
    )
    if VALIDATION.exists():
        validation = json.loads(VALIDATION.read_text())
        contact_proof(validation)
        validation["comparisonProof"] = {
            "file": str(OUTPUT.relative_to(V3)),
            "bytes": OUTPUT.stat().st_size,
            "sha256": sha(OUTPUT),
            "before": str(BEFORE),
            "after": str(AFTER.relative_to(V3)),
        }
        validation["runtimeComparisonProof"] = {
            "file": str(RUNTIME_OUTPUT.relative_to(V3)),
            "bytes": RUNTIME_OUTPUT.stat().st_size,
            "sha256": sha(RUNTIME_OUTPUT),
            "source": str(SOURCE_DETAIL.relative_to(V3)),
            "runtime": str(RUNTIME_DETAIL.relative_to(V3)),
            "pixelDelta": pixel_delta(SOURCE_DETAIL, RUNTIME_DETAIL),
        }
        validation["contactMeasurementProof"] = {
            "file": str(CONTACT_OUTPUT.relative_to(V3)),
            "bytes": CONTACT_OUTPUT.stat().st_size,
            "sha256": sha(CONTACT_OUTPUT),
        }
        VALIDATION.write_text(json.dumps(validation, indent=2) + "\n")


if __name__ == "__main__":
    main()
