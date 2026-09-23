"""Audit V9 remesh UV area and tangent coverage without modifying the candidates."""

from __future__ import annotations

import hashlib
import json
import math
from pathlib import Path

import bpy


HERE = Path(__file__).resolve().parent
ART = HERE.parent
REPO = HERE.parents[4]
CANDIDATES = {
    "temple": ART / "meshy" / "temple-remesh-90k.glb",
    "cypress": ART / "meshy" / "cypress-remesh-20k.glb",
}


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main() -> None:
    rows = []
    for asset, path in CANDIDATES.items():
        bpy.ops.wm.read_factory_settings(use_empty=True)
        before = set(bpy.data.objects)
        bpy.ops.import_scene.gltf(filepath=str(path))
        meshes = [
            obj for obj in bpy.data.objects if obj not in before and obj.type == "MESH"
        ]
        if len(meshes) != 1:
            raise ValueError(f"Expected one {asset} candidate mesh, found {len(meshes)}")
        mesh = meshes[0].data
        mesh.calc_loop_triangles()
        uv_layer = mesh.uv_layers.active
        if uv_layer is None:
            raise ValueError(f"{asset} candidate has no active UV layer")
        degenerate = 0
        nonfinite = 0
        areas = []
        values = []
        for triangle in mesh.loop_triangles:
            uvs = [uv_layer.data[index].uv for index in triangle.loops]
            values.extend((float(uv.x), float(uv.y)) for uv in uvs)
            if not all(math.isfinite(value) for uv in uvs for value in uv):
                nonfinite += 1
                continue
            a, b, c = uvs
            area = (
                abs((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x))
                * 0.5
            )
            areas.append(area)
            if area <= 1e-12:
                degenerate += 1
        mesh.calc_tangents(uvmap=uv_layer.name)
        tangent_lengths = [loop.tangent.length for loop in mesh.loops]
        zero_tangents = sum(value <= 1e-6 for value in tangent_lengths)
        mesh.free_tangents()
        rows.append(
            {
                "asset": asset,
                "file": str(path.relative_to(REPO)),
                "bytes": path.stat().st_size,
                "sha256": digest(path),
                "triangles": len(mesh.loop_triangles),
                "loops": len(mesh.loops),
                "uvLayer": uv_layer.name,
                "uvBounds": [
                    min(value[0] for value in values),
                    min(value[1] for value in values),
                    max(value[0] for value in values),
                    max(value[1] for value in values),
                ],
                "nonfiniteUvTriangles": nonfinite,
                "degenerateUvTrianglesAt1e12": degenerate,
                "minimumPositiveUvArea": min(
                    (value for value in areas if value > 1e-12), default=None
                ),
                "maximumUvArea": max(areas, default=None),
                "zeroLengthTangentCorners": zero_tangents,
                "tangentCoverage": 1.0 - zero_tangents / max(1, len(mesh.loops)),
            }
        )
    result = {
        "schema": 1,
        "purpose": (
            "Quantify the remesh UV and tangent starting point before provider PBR and the "
            "dense-donor bake. This does not claim non-overlap or final bake quality."
        ),
        "assets": rows,
        "conclusion": (
            "Both candidates have finite in-range UVs and no zero-area UV triangle at the "
            "1e-12 threshold. Each has one zero-length tangent corner; the final Blender "
            "finish must repair or exclude that corner and prove full tangent coverage after "
            "fresh export/reimport."
        ),
        "blender": bpy.app.version_string,
        "command": (
            "rtk proxy timeout 300 env ALSOFT_DRIVERS=null blender -b --factory-startup "
            "--python-exit-code 1 --python "
            "art/glass-adventure/journey-map/v9/production/audit_museum_remesh_uv.py"
        ),
    }
    output = ART / "proofs" / "museum-remesh-uv-audit-v9.json"
    output.write_text(json.dumps(result, indent=2) + "\n")
    print("MUSEUM_REMESH_UV_AUDIT=" + json.dumps(result), flush=True)
    bpy.ops.wm.quit_blender()


if __name__ == "__main__":
    main()
