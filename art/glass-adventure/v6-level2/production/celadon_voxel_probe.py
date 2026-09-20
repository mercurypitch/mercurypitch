"""Probe two bounded voxel finalizations of the clean Celadon Meshy source."""

from __future__ import annotations

import importlib.util
import json
from pathlib import Path

import bpy
from mathutils import Vector


HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
REPORT = HERE / "celadon-voxel-probe.json"
VOXEL_SIZES = (0.004, 0.005)
TRIANGLE_TARGET = 34000


def load_module(name: str, path: Path):
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Cannot load {path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def select_only(obj) -> None:
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj


def one_candidate(pipeline, compare, voxel_size: float) -> dict[str, object]:
    donor = "meshy/celadon-lark-decanter-regenerated-v2-pre-remesh.glb"
    path = ROOT / donor
    config = {"donor": donor, "donorSha256": pipeline.digest(path), "height": 1.15}
    obj, normalization = pipeline.normalized_import(config)
    pipeline.weld_and_triangulate(obj)
    source = pipeline.geometry_snapshot(obj)
    source_check = pipeline.topology(obj)
    select_only(obj)
    obj.data.remesh_voxel_size = voxel_size
    obj.data.remesh_voxel_adaptivity = 0.0
    obj.data.use_remesh_preserve_volume = True
    try:
        obj.data.use_remesh_preserve_attributes = False
    except AttributeError:
        pass
    bpy.ops.object.voxel_remesh()
    for face in obj.data.polygons:
        face.use_smooth = True
    pipeline.weld_and_triangulate(obj)
    voxel_check = pipeline.topology(obj)
    decimation = pipeline.decimate(obj, TRIANGLE_TARGET)
    decimated_check = pipeline.topology(obj)
    exact_union = pipeline.exact_self_union(obj)
    collapsed = pipeline.solid.remove_collapsed_components(obj)
    check = pipeline.topology(obj)
    fidelity = pipeline.fidelity(obj, source)
    low, high = pipeline.mesh_bounds([obj])
    source_low, source_high = source["bounds"]
    bounds_delta = max(
        max(abs(low[axis] - source_low[axis]) for axis in range(3)),
        max(abs(high[axis] - source_high[axis]) for axis in range(3)),
    )
    silhouette = compare.compare_silhouettes(
        {"_bounds": source["bounds"], "_tree": source["tree"]},
        {"_bounds": (low, high), "_tree": pipeline.mesh_tree(obj)},
    )
    temp = Path(f"/tmp/celadon-voxel-{round(voxel_size * 1000)}mm-probe.glb")
    select_only(obj)
    bpy.ops.export_scene.gltf(
        filepath=str(temp),
        export_format="GLB",
        use_selection=True,
        export_yup=True,
        export_apply=True,
        export_extras=True,
        export_animations=False,
        export_tangents=False,
    )
    exported_bytes = temp.stat().st_size
    exported_sha = pipeline.digest(temp)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(temp))
    imported = [item for item in bpy.context.scene.objects if item.type == "MESH"]
    if len(imported) != 1:
        raise ValueError(f"Voxel probe reimport expected one mesh, got {len(imported)}")
    reimport_check = pipeline.topology(imported[0])
    result = {
        "voxelSizeMetres": voxel_size,
        "triangleTarget": TRIANGLE_TARGET,
        "normalization": normalization,
        "sourceTopology": source_check,
        "voxelTopology": voxel_check,
        "decimation": decimation,
        "decimatedTopology": decimated_check,
        "exactSelfUnion": exact_union,
        "collapsedComponents": collapsed,
        "topology": check,
        "topologyPassed": pipeline.topology_passes(check),
        "fidelity": fidelity,
        "boundsMetres": {"min": list(low), "max": list(high)},
        "sourceBoundsMaxDeltaMetres": bounds_delta,
        "volumeRelativeDelta": abs(check["signedVolume"] - source_check["signedVolume"])
        / source_check["signedVolume"],
        "silhouette": silhouette,
        "temporaryGlb": {
            "bytes": exported_bytes,
            "sha256": exported_sha,
            "committed": False,
        },
        "freshGlbReimportTopology": reimport_check,
        "freshGlbReimportPassed": pipeline.topology_passes(reimport_check),
    }
    temp.unlink(missing_ok=True)
    return result


def main() -> None:
    pipeline = load_module("celadon_voxel_pipeline", ROOT / "finalize_vessels.py")
    compare = load_module("celadon_voxel_compare", HERE / "celadon_remesh_compare.py")
    path = ROOT / "meshy" / "celadon-lark-decanter-regenerated-v2-pre-remesh.glb"
    candidates = [one_candidate(pipeline, compare, size) for size in VOXEL_SIZES]
    report = {
        "schema": 1,
        "assetId": "celadon-lark-decanter",
        "source": {
            "file": str(path.relative_to(ROOT)),
            "bytes": path.stat().st_size,
            "sha256": pipeline.digest(path),
        },
        "method": "Blender voxel remesh at two fixed physical resolutions from the preserved clean Meshy pre-remesh surface; smooth shading; bounded collapse to 34K; one exact self-union with no local repair loop; fresh strict topology checks before and after temporary GLB export; bidirectional surface distance, volume, bounds, and 192-pixel ray-cast silhouettes.",
        "candidates": candidates,
    }
    REPORT.write_text(json.dumps(report, indent=2) + "\n")
    print(
        "CELADON_VOXEL_PROBE="
        + json.dumps(
            {
                str(round(row["voxelSizeMetres"] * 1000)) + "mm": {
                    "triangles": row["topology"]["triangles"],
                    "passed": row["topologyPassed"],
                    "reimportPassed": row["freshGlbReimportPassed"],
                    "p99Metres": row["fidelity"]["sourceToFinalMetres"]["p99"],
                    "maxMetres": row["fidelity"]["sourceToFinalMetres"]["max"],
                    "volumeRelativeDelta": row["volumeRelativeDelta"],
                    "boundsDeltaMetres": row["sourceBoundsMaxDeltaMetres"],
                    "frontIou": row["silhouette"]["front"]["intersectionOverUnion"],
                    "sideIou": row["silhouette"]["side"]["intersectionOverUnion"],
                    "topIou": row["silhouette"]["top"]["intersectionOverUnion"],
                }
                for row in candidates
            }
        ),
        flush=True,
    )


if __name__ == "__main__":
    main()
