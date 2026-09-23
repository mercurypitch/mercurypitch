#!/usr/bin/env python3
"""Measure the rejected V9 temple dome partition and tint mask without editing assets."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path
import struct

import numpy as np
from PIL import Image, ImageDraw


HERE = Path(__file__).resolve().parent
V9 = HERE.parent
REPO = HERE.parents[4]
CANDIDATE = V9 / "exports" / "floating-museum-temple-candidate-v9-meshy-normal.glb"
BASE = V9 / "sources" / "temple-bake-v9" / "provider-base-color.png"
REJECTED_PROOF = (
    V9.parents[1]
    / "proofs"
    / "museum-components-2026-09-23"
    / "v9-speckled-domes-desktop"
)
REJECTED_KIT = REJECTED_PROOF / "rejected-kit.glb"
SCREENSHOT = REJECTED_PROOF / "twin-galleries-isle.png"
REVIEW = REJECTED_PROOF / "review.json"
OUTPUT = HERE / "dome-tint-mask-audit-v9.json"

EXPECTED = {
    CANDIDATE: "b31cdf876f601b510ee8910a144ec9258b592d355f088b0097e5a04fd5770360",
    BASE: "34162564fdc4d6f6b6b9c2a756f7e916a01c763eda2813afd377af11593ab736",
    REJECTED_KIT: "444c0669ebc8760e25cc70c5a25541203fa18b156ff3d2ab581ae03b4b1b3793",
    SCREENSHOT: "1c6a8f72817bd7b092b1b106a4a93f4a694c7150dd7945fcc1b6a0cd1f19b31d",
    REVIEW: "32c10b27c0166be27db937a1ecf05aef83e179a6187cd527cdfa1f8492db6f00",
}
THRESHOLD_Y = 1.65
LOWER_DOME_BAND = (1.65, 1.85)


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def relative(path: Path) -> str:
    return str(path.relative_to(REPO))


def read_glb(path: Path) -> tuple[dict[str, object], bytes]:
    data = path.read_bytes()
    if len(data) < 20:
        raise ValueError("Candidate GLB is truncated")
    magic, version, declared = struct.unpack_from("<4sII", data, 0)
    if magic != b"glTF" or version != 2 or declared != len(data):
        raise ValueError("Candidate GLB header is invalid")
    document = None
    binary = None
    offset = 12
    while offset < len(data):
        length, kind = struct.unpack_from("<II", data, offset)
        offset += 8
        payload = data[offset : offset + length]
        offset += length
        if kind == 0x4E4F534A:
            document = json.loads(payload.decode("utf-8").rstrip(" \x00"))
        elif kind == 0x004E4942:
            binary = payload
    if not isinstance(document, dict) or binary is None:
        raise ValueError("Candidate GLB lacks JSON or BIN data")
    return document, binary


COMPONENTS = {
    5121: ("u1", 1),
    5123: ("<u2", 2),
    5125: ("<u4", 4),
    5126: ("<f4", 4),
}
WIDTHS = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4}


def accessor(document: dict[str, object], binary: bytes, index: int) -> np.ndarray:
    item = document["accessors"][index]
    view = document["bufferViews"][item["bufferView"]]
    dtype, scalar_bytes = COMPONENTS[int(item["componentType"])]
    width = WIDTHS[str(item["type"])]
    count = int(item["count"])
    start = int(view.get("byteOffset", 0)) + int(item.get("byteOffset", 0))
    stride = int(view.get("byteStride", scalar_bytes * width))
    if stride == scalar_bytes * width:
        return np.frombuffer(
            binary, dtype=dtype, count=count * width, offset=start
        ).reshape(count, width)
    rows = [
        np.frombuffer(binary, dtype=dtype, count=width, offset=start + row * stride)
        for row in range(count)
    ]
    return np.stack(rows)


def percentage(condition: np.ndarray, weights: np.ndarray | None = None) -> float:
    if weights is None:
        return round(float(condition.mean() * 100.0), 4)
    return round(float(weights[condition].sum() / weights.sum() * 100.0), 4)


def color_fields(rgb: np.ndarray) -> dict[str, np.ndarray]:
    red, green, blue = rgb[:, 0], rgb[:, 1], rgb[:, 2]
    maximum = rgb.max(axis=1)
    chroma = maximum - rgb.min(axis=1)
    bright = np.clip((maximum - 0.38) / 0.42, 0.0, 1.0)
    pale = np.clip((0.28 - chroma) / 0.22, 0.0, 1.0)
    gold = (red > green * 1.04) & (green > blue * 1.10) & (chroma > 0.07)
    emerald = (green > red * 1.12) & (green > blue * 0.88) & (chroma > 0.08)
    current_mask = bright * pale * (~gold) * (~emerald)
    warm_low_chroma = (
        (red > green) & (green > blue) & (chroma >= 0.07) & (chroma < 0.28)
    )
    return {
        "maximum": maximum,
        "chroma": chroma,
        "gold": gold,
        "emerald": emerald,
        "currentMask": current_mask,
        "warmLowChroma": warm_low_chroma,
    }


def color_stats(rgb: np.ndarray, weights: np.ndarray | None = None) -> dict[str, object]:
    fields = color_fields(rgb)
    chroma = fields["chroma"]
    gold = fields["gold"]
    current_mask = fields["currentMask"]
    warm = fields["warmLowChroma"]
    return {
        "samples": int(len(rgb)),
        "chromaQuantiles10_25_50_75_90": [
            round(float(value), 6)
            for value in np.quantile(chroma, [0.10, 0.25, 0.50, 0.75, 0.90])
        ],
        "shareChromaBelow18Percent": percentage(chroma < 0.18, weights),
        "shareChromaBelow24Percent": percentage(chroma < 0.24, weights),
        "shareChromaBelow28Percent": percentage(chroma < 0.28, weights),
        "shareChromaAbove40Percent": percentage(chroma > 0.40, weights),
        "shareCurrentGoldBooleanPercent": percentage(gold, weights),
        "shareCurrentEmeraldBooleanPercent": percentage(fields["emerald"], weights),
        "shareCurrentMaskZeroPercent": percentage(current_mask <= 1e-8, weights),
        "shareCurrentMaskBelowPoint1Percent": percentage(current_mask < 0.1, weights),
        "shareWarmLowChromaPercent": percentage(warm, weights),
        "shareWarmLowChromaClassedGoldPercent": percentage(warm & gold, weights),
    }


def raster_footprint(triangle_uv: np.ndarray, width: int, height: int) -> np.ndarray:
    if ((triangle_uv.max(axis=1) - triangle_uv.min(axis=1)) > 0.5).any():
        raise ValueError("UV seam-spanning triangle requires explicit wrap handling")
    image = Image.new("1", (width, height), 0)
    draw = ImageDraw.Draw(image)
    for triangle in triangle_uv:
        draw.polygon(
            [
                (float(u * (width - 1)), float((1.0 - v) * (height - 1)))
                for u, v in triangle
            ],
            fill=1,
        )
    return np.asarray(image, dtype=bool)


def main() -> None:
    for path, expected in EXPECTED.items():
        if not path.is_file() or digest(path) != expected:
            raise ValueError(f"Audit input changed: {relative(path)}")

    document, binary = read_glb(CANDIDATE)
    primitive = document["meshes"][0]["primitives"][0]
    positions = accessor(
        document, binary, int(primitive["attributes"]["POSITION"])
    ).astype(np.float64)
    uvs = accessor(
        document, binary, int(primitive["attributes"]["TEXCOORD_0"])
    ).astype(np.float64)
    indices = accessor(document, binary, int(primitive["indices"])).reshape(-1)
    triangles = indices.astype(np.int64).reshape(-1, 3)
    triangle_positions = positions[triangles]
    triangle_uvs = uvs[triangles]
    centres_y = triangle_positions[:, :, 1].mean(axis=1)
    minimum_y = triangle_positions[:, :, 1].min(axis=1)
    maximum_y = triangle_positions[:, :, 1].max(axis=1)
    areas = (
        np.linalg.norm(
            np.cross(
                triangle_positions[:, 1] - triangle_positions[:, 0],
                triangle_positions[:, 2] - triangle_positions[:, 0],
            ),
            axis=1,
        )
        * 0.5
    )
    dome = centres_y >= THRESHOLD_Y
    structure = ~dome
    crossing = (minimum_y < THRESHOLD_Y) & (maximum_y >= THRESHOLD_Y)
    lower_band = (centres_y >= LOWER_DOME_BAND[0]) & (
        centres_y < LOWER_DOME_BAND[1]
    )

    atlas = np.asarray(Image.open(BASE).convert("RGB"), dtype=np.float32) / 255.0
    height, width = atlas.shape[:2]
    uv_centres = triangle_uvs.mean(axis=1)
    pixel_x = np.mod(np.floor(uv_centres[:, 0] * width).astype(np.int64), width)
    pixel_y = np.mod(
        np.floor((1.0 - uv_centres[:, 1]) * height).astype(np.int64), height
    )
    centre_samples = atlas[pixel_y, pixel_x]
    footprint = raster_footprint(triangle_uvs[dome], width, height)
    raster_samples = atlas[footprint]

    report = {
        "schema": 1,
        "purpose": (
            "Read-only diagnosis of the rejected V9 dome colour: distinguish the glTF "
            "face partition from the warm-ivory-as-gold texture mask."
        ),
        "conclusion": {
            "primaryCause": "texture mask",
            "finding": (
                "Broad ivory panels are already assigned to the dome primitive. The hard "
                "gold boolean classifies low-chroma warm ivory as protected gold and sets "
                "most of the tint mask to zero. The Y split can account for a thin edge "
                "ring, but not the broad untinted lower dome."
            ),
        },
        "inputs": [
            {
                "file": relative(path),
                "bytes": path.stat().st_size,
                "sha256": expected,
            }
            for path, expected in EXPECTED.items()
        ],
        "historicalRejectedTint": {
            "finishScriptObservedSha256": (
                "fed2242b63e67047fb98fb2fe15533a4e01adb2cee9001b80e062dd2cdcab98f"
            ),
            "amberBaseSha256": (
                "fd59af03cc38336446f23d84ee6351d1c02aeef59da538ebccb019a52af241a4"
            ),
            "tealBaseSha256": (
                "0e0e99ede27fbebfa089581763cd6c331f7c37e5ece8bbdb1f0f420840eae531"
            ),
            "rule": {
                "bright": "clip((maxRGB - 0.38) / 0.42, 0, 1)",
                "pale": "clip((0.28 - chroma) / 0.22, 0, 1)",
                "gold": "R > 1.04*G and G > 1.10*B and chroma > 0.07",
                "emerald": "G > 1.12*R and G > 0.88*B and chroma > 0.08",
                "mask": "bright * pale * not-gold * not-emerald",
            },
        },
        "geometryPartition": {
            "criterion": "glTF triangle centroid Y >= 1.65 metres",
            "positionYMinMaxMetres": [
                round(float(positions[:, 1].min()), 6),
                round(float(positions[:, 1].max()), 6),
            ],
            "triangles": {
                "total": int(len(triangles)),
                "structure": int(structure.sum()),
                "dome": int(dome.sum()),
            },
            "surfaceAreaSquareMetres": {
                "total": round(float(areas.sum()), 6),
                "structure": round(float(areas[structure].sum()), 6),
                "dome": round(float(areas[dome].sum()), 6),
            },
            "domeCentroidYMinMaxMetres": [
                round(float(centres_y[dome].min()), 6),
                round(float(centres_y[dome].max()), 6),
            ],
            "domeVertexYMinMaxMetres": [
                round(float(minimum_y[dome].min()), 6),
                round(float(maximum_y[dome].max()), 6),
            ],
            "structureVertexYMaxMetres": round(float(maximum_y[structure].max()), 6),
            "crossingThreshold": {
                "triangles": int(crossing.sum()),
                "assignedDome": int((crossing & dome).sum()),
                "assignedStructure": int((crossing & structure).sum()),
                "areaAssignedDomeSquareMetres": round(
                    float(areas[crossing & dome].sum()), 6
                ),
                "areaAssignedStructureSquareMetres": round(
                    float(areas[crossing & structure].sum()), 6
                ),
                "structureAreaAsPercentOfDomeArea": round(
                    float(areas[crossing & structure].sum() / areas[dome].sum() * 100),
                    4,
                ),
            },
        },
        "lowerDomeBandAreaWeightedUvCentres": {
            "centroidYRangeMetres": list(LOWER_DOME_BAND),
            "triangles": int(lower_band.sum()),
            "surfaceAreaSquareMetres": round(float(areas[lower_band].sum()), 6),
            **color_stats(centre_samples[lower_band], areas[lower_band]),
        },
        "wholeDomeAreaWeightedUvCentres": {
            "triangles": int(dome.sum()),
            "surfaceAreaSquareMetres": round(float(areas[dome].sum()), 6),
            **color_stats(centre_samples[dome], areas[dome]),
        },
        "wholeDomeUvRaster": {
            "atlasDimensions": [width, height],
            "coveredPixels": int(footprint.sum()),
            "uvMinMax": {
                "min": [round(float(value), 8) for value in uvs.min(axis=0)],
                "max": [round(float(value), 8) for value in uvs.max(axis=0)],
            },
            "seamSpanningTriangles": 0,
            **color_stats(raster_samples),
        },
        "recommendation": {
            "mask": (
                "Use neutralWeight = 1 - smoothstep(0.24, 0.42, chroma). Give all "
                "texels through chroma 0.24 full tint weight, then fade continuously to "
                "zero by 0.42. Remove the absolute bright gate and the hard gold/emerald "
                "booleans. Preserve luminance in the target-colour shading step."
            ),
            "thresholdBasis": (
                "The accepted dome UV raster has median chroma 0.164706, 75th percentile "
                "0.20 and 90th percentile 0.423529. The proposed interval includes the "
                "neutral panel population and protects the saturated accent tail."
            ),
            "partition": (
                "Keep the 1.65 metre split for the next texture-only candidate. Review the "
                "thin spring-ring edge separately; do not move geometry or recompute normals, "
                "tangents or UVs to fix this colour defect."
            ),
            "runtime": (
                "Recheck the final 2K WebP because the rejected amber/teal encodes had PSNR "
                "28.6302/27.0243 dB and MAE 4.6633/5.9618; lossy encoding can accentuate "
                "hard mask edges, though it is not the primary cause."
            ),
        },
        "method": {
            "geometry": (
                "Decode the accepted GLB POSITION/TEXCOORD_0/index accessors, reproduce the "
                "packer face-centroid split and weight UV-centroid samples by 3D face area."
            ),
            "raster": (
                "Rasterize the union of all accepted dome UV triangles into the 2048x2048 "
                "provider atlas with Pillow polygon coverage; sample each covered pixel once."
            ),
            "limits": [
                (
                    "UV-centroid sampling represents each triangle by one texel; 3D area "
                    "weighting reduces triangle-density bias but does not integrate the full UV face."
                ),
                (
                    "The UV raster measures atlas coverage, not screen-space visibility or "
                    "minification in the browser. Polygon edge inclusion depends on Pillow's raster rule."
                ),
                (
                    "The split audit rules out partitioning as the primary broad-panel cause; "
                    "it does not claim the 1.65 metre boundary is semantically perfect."
                ),
            ],
        },
        "reproduction": {
            "script": relative(Path(__file__)),
            "scriptSha256": digest(Path(__file__)),
            "command": (
                "rtk python3 art/glass-adventure/journey-map/v9/proofs/"
                "audit_dome_tint_mask_v9.py"
            ),
        },
    }
    OUTPUT.write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
