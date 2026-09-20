"""Create bounded Manifold3D Celadon reductions from the preserved clean donor."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import manifold3d as manifold
import numpy as np


TARGETS = (36000,)


def smallest_tolerance_at_or_below(
    source: manifold.Manifold, target: int
) -> tuple[float, manifold.Manifold, list[dict[str, float | int]]]:
    low = 0.0
    high = 0.001
    attempts: list[dict[str, float | int]] = []
    candidate = source.simplify(high)
    attempts.append({"toleranceMetres": high, "triangles": candidate.num_tri()})
    while candidate.num_tri() > target and high < 0.04:
        low = high
        high *= 2
        candidate = source.simplify(high)
        attempts.append({"toleranceMetres": high, "triangles": candidate.num_tri()})
    if candidate.num_tri() > target:
        raise ValueError(f"No reduction reached {target} triangles below 4 cm tolerance")
    best_tolerance = high
    best = candidate
    for _index in range(18):
        middle = (low + high) / 2
        simplified = source.simplify(middle)
        attempts.append({"toleranceMetres": middle, "triangles": simplified.num_tri()})
        if simplified.num_tri() <= target:
            best_tolerance = middle
            best = simplified
            high = middle
        else:
            low = middle
    return best_tolerance, best, attempts


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("input", type=Path)
    parser.add_argument("output_directory", type=Path)
    args = parser.parse_args()
    data = np.load(args.input)
    mesh = manifold.Mesh(
        data["positions"].astype(np.float32),
        data["triangles"].astype(np.uint32),
    )
    source = manifold.Manifold(mesh)
    if source.status() != manifold.Error.NoError or source.is_empty():
        raise ValueError(f"Clean Celadon input was rejected: {source.status()}")
    args.output_directory.mkdir(parents=True, exist_ok=True)
    rows = []
    for target in TARGETS:
        tolerance, result, attempts = smallest_tolerance_at_or_below(source, target)
        if result.status() != manifold.Error.NoError or result.is_empty():
            raise ValueError(f"Celadon {target} reduction failed: {result.status()}")
        output = result.to_mesh()
        path = args.output_directory / f"reduced-{target}.npz"
        np.savez_compressed(
            path,
            positions=output.vert_properties[:, :3],
            triangles=output.tri_verts,
            merge_from=np.asarray(output.merge_from_vert, dtype=np.int32),
            merge_to=np.asarray(output.merge_to_vert, dtype=np.int32),
        )
        rows.append(
            {
                "targetTriangles": target,
                "toleranceMetres": tolerance,
                "triangles": result.num_tri(),
                "vertices": result.num_vert(),
                "volumeCubicMetres": result.volume(),
                "output": path.name,
                "attempts": attempts,
            }
        )
    report = {
        "backend": "manifold3d 3.5.3",
        "method": "Simplify the preserved clean closed source to the smallest measured tolerance producing no more than each triangle target.",
        "sourceTriangles": source.num_tri(),
        "sourceVertices": source.num_vert(),
        "sourceVolumeCubicMetres": source.volume(),
        "reductions": rows,
    }
    report_path = args.output_directory / "reduction-backend.json"
    report_path.write_text(json.dumps(report, indent=2) + "\n")
    print("CELADON_SIMPLIFY_COMPLETE=" + json.dumps(report), flush=True)


if __name__ == "__main__":
    main()
