"""Measure dense/low surface registration before choosing the Conservatory bake.

Area-weighted samples supplement the visual gate. The ray probe approximates a
normal-offset cage; it does not certify Blender's interpolated cage or UV texels.
"""

from __future__ import annotations

import argparse
import importlib.util
import json
from pathlib import Path
import sys

import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree
import numpy as np


HERE = Path(__file__).resolve().parent
ART = HERE.parent
spec = importlib.util.spec_from_file_location("conservatory_finisher", HERE / "finish_conservatory_candidate.py")
finish = importlib.util.module_from_spec(spec)
spec.loader.exec_module(finish)


def surface(meshes):
    vertices, faces, normals = [], [], []
    offset = 0
    for obj in meshes:
        mesh = obj.data
        mesh.calc_loop_triangles()
        vertices.extend(tuple(v.co) for v in mesh.vertices)
        for face in mesh.loop_triangles:
            faces.append(tuple(index + offset for index in face.vertices))
            normals.append(tuple(tuple(mesh.corner_normals[i].vector) for i in face.loops))
        offset += len(mesh.vertices)
    return np.asarray(vertices), np.asarray(faces), np.asarray(normals)


def stats(values):
    array = np.asarray(values)
    return {f"p{p}": float(np.percentile(array, p)) for p in (50, 90, 95, 99, 100)}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--candidate", type=Path, required=True)
    parser.add_argument("--label", choices=("remesh", "pbr"), required=True)
    args = parser.parse_args(sys.argv[sys.argv.index("--") + 1 :])
    args.candidate = args.candidate.resolve()
    finish.require_complete_glb(args.candidate)
    if finish.digest(finish.DENSE_DONOR) != finish.EXPECTED_DENSE_SHA256:
        raise ValueError("Dense source hash differs from the archived source")
    bpy.ops.wm.read_factory_settings(use_empty=True)
    _, low = finish.import_meshes(args.candidate)
    finish.normalize_objects(low, "low")
    _, high = finish.import_meshes(finish.DENSE_DONOR)
    finish.normalize_objects(high, "high")
    low_v, low_f, low_n = surface(low)
    high_v, high_f, _ = surface(high)
    dense = BVHTree.FromPolygons(high_v.tolist(), high_f.tolist(), all_triangles=True)
    low_tri = low_v[low_f]
    areas = np.linalg.norm(np.cross(low_tri[:, 1] - low_tri[:, 0], low_tri[:, 2] - low_tri[:, 0]), axis=1) / 2
    rng = np.random.default_rng(807)
    selected = rng.choice(len(low_f), 12000, p=areas / areas.sum())
    # Uniform barycentric positions, then interpolate the preserved split normals.
    u = np.sqrt(rng.random(len(selected)))
    v = rng.random(len(selected))
    weights = np.stack((1 - u, u * (1 - v), u * v), axis=1)
    positions = np.einsum("ij,ijk->ik", weights, low_tri[selected])
    directions = np.einsum("ij,ijk->ik", weights, low_n[selected])
    directions /= np.linalg.norm(directions, axis=1)[:, None]
    nearest, normal_alignment, misses, ray_distances = [], [], 0, []
    for position, normal in zip(positions, directions, strict=True):
        point, direction = Vector(position), Vector(normal)
        _, dense_normal, _, distance = dense.find_nearest(point)
        nearest.append(distance)
        normal_alignment.append(float(direction.dot(dense_normal)))
        hit, _, _, ray_distance = dense.ray_cast(
            point + direction * finish.CAGE_EXTRUSION,
            -direction,
            finish.CAGE_EXTRUSION + finish.MAX_RAY_DISTANCE,
        )
        if hit is None:
            misses += 1
        else:
            ray_distances.append(ray_distance)
    report = {
        "candidate": {"file": str(args.candidate.relative_to(ART)), "sha256": finish.digest(args.candidate)},
        "denseSourceSha256": finish.digest(finish.DENSE_DONOR),
        "method": "12000 deterministic area-weighted low-surface samples after the exact production normalization",
        "nearestSurfaceDistanceMetres": stats(nearest),
        "nearestFaceNormalDot": stats(normal_alignment),
        "probeCageExtrusionMetres": finish.CAGE_EXTRUSION,
        "probeRayLengthMetres": finish.CAGE_EXTRUSION + finish.MAX_RAY_DISTANCE,
        "probeMisses": misses,
        "probeMissFraction": misses / len(selected),
        "probeHitDistanceMetres": stats(ray_distances) if ray_distances else None,
        "limitations": "Geometry samples are not UV coverage. Nearest-face normals can differ at relief. This approximate normal-offset probe does not reproduce Blender's interpolated cage or prove texel-level bake quality; compare actual normal-map renders before choosing the runtime variant.",
    }
    output = ART / "proofs" / f"conservatory-{args.label}-bake-projection-v8.json"
    output.write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps({"output": str(output), "nearest": report["nearestSurfaceDistanceMetres"], "probeMissFraction": report["probeMissFraction"]}))


if __name__ == "__main__":
    main()
