"""Subtract a measured cavity while preserving donor corner attributes and material labels."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import manifold3d as manifold
import numpy as np


def source_mesh(
    data: np.lib.npyio.NpzFile,
    prefix: str,
    first_id: int,
) -> manifold.Manifold:
    labels = data[f"{prefix}_material_labels"]
    starts = np.flatnonzero(np.r_[True, labels[1:] != labels[:-1]])
    mesh = manifold.Mesh(
        data[f"{prefix}_properties"].astype(np.float32),
        data[f"{prefix}_triangles"].astype(np.uint32),
        merge_from_vert=data[f"{prefix}_merge_from"].astype(np.uint32),
        merge_to_vert=data[f"{prefix}_merge_to"].astype(np.uint32),
        run_index=np.r_[starts * 3, len(labels) * 3].astype(np.uint32),
        run_original_id=(labels[starts] + first_id).astype(np.uint32),
    )
    solid = manifold.Manifold(mesh)
    if solid.status() != manifold.Error.NoError:
        raise ValueError(f"{prefix} is not a valid manifold: {solid.status()}")
    return solid


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("input", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    data = np.load(args.input)
    material_count = int(data["material_count"])
    cavity_material = int(data["cavity_material"])
    first_id = manifold.Manifold.reserve_ids(material_count)
    exterior = source_mesh(data, "exterior", first_id)
    cutter = source_mesh(data, "cutter", first_id)
    result = exterior - cutter
    if result.status() != manifold.Error.NoError or result.is_empty():
        raise ValueError(f"Cavity subtraction failed: {result.status()}")
    output = result.to_mesh(normal_idx=0)
    face_materials = np.full(
        len(output.tri_verts), cavity_material, dtype=np.int32
    )
    for run, original in enumerate(output.run_original_id):
        if first_id <= original < first_id + material_count:
            face_materials[
                output.run_index[run] // 3 : output.run_index[run + 1] // 3
            ] = original - first_id
    np.savez_compressed(
        args.output,
        properties=output.vert_properties,
        triangles=output.tri_verts,
        merge_from=np.asarray(output.merge_from_vert, dtype=np.int32),
        merge_to=np.asarray(output.merge_to_vert, dtype=np.int32),
        materials=face_materials,
    )
    report = {
        "backend": "manifold3d 3.5.3",
        "exteriorInputVolumeCubicMetres": exterior.volume(),
        "cutterVolumeCubicMetres": cutter.volume(),
        "shellVolumeCubicMetres": result.volume(),
        "removedCavityVolumeCubicMetres": exterior.volume() - result.volume(),
        "exteriorInputTriangles": exterior.num_tri(),
        "cutterTriangles": cutter.num_tri(),
        "shellTriangles": result.num_tri(),
        "materialFaceCounts": {
            str(index): int(np.sum(face_materials == index))
            for index in range(material_count)
        },
    }
    args.output.with_suffix(".json").write_text(json.dumps(report, indent=2) + "\n")
    print("VESSEL_CAVITY_COMPLETE=" + json.dumps(report), flush=True)


if __name__ == "__main__":
    main()
