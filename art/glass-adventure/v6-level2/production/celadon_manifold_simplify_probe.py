"""Validate bounded Manifold3D reductions of the clean Celadon regeneration."""

from __future__ import annotations

import importlib.util
import json
import os
from pathlib import Path
import subprocess

import bpy
import numpy as np


HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
WORK = ROOT / "sources" / "celadon-lark-decanter-reduction-work-v2"
REPORT = HERE / "celadon-manifold-simplify-probe.json"
PYTHON = "/usr/bin/python3"
MANIFOLD_PATH = "/tmp/glass-museum-manifold"


def load_pipeline():
    path = ROOT / "finalize_vessels.py"
    spec = importlib.util.spec_from_file_location("celadon_simplify_pipeline", path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Cannot load {path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def main() -> None:
    pipeline = load_pipeline()
    donor = "meshy/celadon-lark-decanter-regenerated-v2-pre-remesh.glb"
    path = ROOT / donor
    config = {"donor": donor, "donorSha256": pipeline.digest(path), "height": 1.15}
    obj, normalization = pipeline.normalized_import(config)
    pipeline.weld_and_triangulate(obj)
    source_check = pipeline.topology(obj)
    if not pipeline.topology_passes(source_check):
        raise ValueError("Preserved regenerated Celadon source is no longer clean")
    source = pipeline.geometry_snapshot(obj)
    WORK.mkdir(parents=True, exist_ok=True)
    input_path = WORK / "reduction-input.npz"
    np.savez_compressed(
        input_path,
        positions=np.asarray([tuple(point) for point in source["positions"]], dtype=np.float32),
        triangles=np.asarray(source["triangles"], dtype=np.uint32),
    )
    environment = dict(os.environ)
    environment["PYTHONPATH"] = MANIFOLD_PATH
    subprocess.run(
        [PYTHON, str(HERE / "celadon_simplify_backend.py"), str(input_path), str(WORK)],
        check=True,
        timeout=240,
        env=environment,
    )
    backend = json.loads((WORK / "reduction-backend.json").read_text())
    reductions = []
    for row in backend["reductions"]:
        data = np.load(WORK / row["output"])
        mesh = bpy.data.meshes.new(f"celadon_reduced_{row['targetTriangles']}_geometry")
        mesh.from_pydata(data["positions"].tolist(), [], data["triangles"].tolist())
        mesh.update()
        reduced = bpy.data.objects.new(f"celadon_reduced_{row['targetTriangles']}", mesh)
        bpy.context.scene.collection.objects.link(reduced)
        weld = pipeline.weld_and_triangulate(reduced)
        check = pipeline.topology(reduced)
        fidelity = pipeline.fidelity(reduced, source)
        low, high = pipeline.mesh_bounds([reduced])
        source_low, source_high = source["bounds"]
        bound_delta = max(
            max(abs(low[axis] - source_low[axis]) for axis in range(3)),
            max(abs(high[axis] - source_high[axis]) for axis in range(3)),
        )
        reductions.append(
            {
                "targetTriangles": row["targetTriangles"],
                "actualTriangles": check["triangles"],
                "toleranceMetres": row["toleranceMetres"],
                "weld": weld,
                "topology": check,
                "topologyPassed": pipeline.topology_passes(check),
                "fidelity": fidelity,
                "boundsMetres": {"min": list(low), "max": list(high)},
                "sourceBoundsMaxDeltaMetres": bound_delta,
                "backendVolumeCubicMetres": row["volumeCubicMetres"],
                "volumeRelativeDelta": abs(check["signedVolume"] - source_check["signedVolume"])
                / source_check["signedVolume"],
                "workFile": str((WORK / row["output"]).relative_to(ROOT)),
            }
        )
    report = {
        "schema": 1,
        "assetId": "celadon-lark-decanter",
        "source": {
            "file": donor,
            "bytes": path.stat().st_size,
            "sha256": pipeline.digest(path),
        },
        "normalization": normalization,
        "sourceTopology": source_check,
        "backend": backend,
        "reductions": reductions,
        "acceptance": {
            "strictTopology": "zero non-manifold edges/vertices, zero non-contiguous edges, zero self-intersection pairs, positive signed volume",
            "triangleTargets": [36000],
            "selected": None,
            "visualAndMaterialProjectionPending": True,
        },
    }
    REPORT.write_text(json.dumps(report, indent=2) + "\n")
    print(
        "CELADON_SIMPLIFY_PROBE="
        + json.dumps(
            {
                str(row["targetTriangles"]): {
                    "triangles": row["actualTriangles"],
                    "topologyPassed": row["topologyPassed"],
                    "p99Metres": row["fidelity"]["sourceToFinalMetres"]["p99"],
                    "maxMetres": row["fidelity"]["sourceToFinalMetres"]["max"],
                    "boundsDeltaMetres": row["sourceBoundsMaxDeltaMetres"],
                    "volumeRelativeDelta": row["volumeRelativeDelta"],
                }
                for row in reductions
            }
        ),
        flush=True,
    )


if __name__ == "__main__":
    main()
