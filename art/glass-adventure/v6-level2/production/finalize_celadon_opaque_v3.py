"""Audit and finalize the approved opaque-guide Celadon donor as a V3 breakable."""

from __future__ import annotations

import argparse
import importlib.util
import json
from pathlib import Path
import sys

import bmesh
import bpy
from mathutils import Vector


HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
PIPELINE_PATH = ROOT / "finalize_vessels.py"
RECEIPT = ROOT / "meshy" / "celadon-lark-decanter-opaque-v3-receipt.json"
EXPECTED_DONOR = "meshy/celadon-lark-decanter-opaque-v3.glb"
EXPECTED_PRE_REMESH = "meshy/celadon-lark-decanter-opaque-v3-pre-remesh.glb"
AUDIT = HERE / "celadon-opaque-v3-audit.json"
PRE_REMESH_AUDIT = HERE / "celadon-opaque-v3-pre-remesh-audit.json"
SLUG = "celadon-lark-decanter"
VERSION = "v3"
MAX_DONOR_TRIANGLES = 18_000
MAX_RUNTIME_TRIANGLES = 20_000
MAX_ALL_RENDERED_TRIANGLES = 85_000


def load_pipeline():
    spec = importlib.util.spec_from_file_location("celadon_v3_vessel_pipeline", PIPELINE_PATH)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Cannot load {PIPELINE_PATH}")
    result = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(result)
    result.VERSION = VERSION
    return result


pipeline = load_pipeline()
base_classify_materials = pipeline.classify_materials


def donor_record(
    expected_donor: str = EXPECTED_DONOR, role: str = "glb"
) -> dict[str, object]:
    if not RECEIPT.is_file():
        raise FileNotFoundError(f"Meshy archive receipt is not available: {RECEIPT}")
    receipt = json.loads(RECEIPT.read_text())
    if receipt.get("state") != "archived":
        raise RuntimeError(
            "Celadon opaque V3 Meshy archive is not complete; expected receipt state archived"
        )
    records = [
        row
        for row in receipt.get("files", [])
        if row.get("role") == role and row.get("file") == expected_donor
    ]
    if len(records) != 1:
        raise RuntimeError(f"Receipt must identify exactly one {expected_donor} record")
    record = records[0]
    donor = ROOT / expected_donor
    if not donor.is_file():
        raise FileNotFoundError(donor)
    if donor.stat().st_size != record.get("bytes") or pipeline.digest(donor) != record.get(
        "sha256"
    ):
        raise RuntimeError("Celadon opaque V3 donor bytes do not match the archive receipt")
    return record


def config(
    expected_donor: str = EXPECTED_DONOR, role: str = "glb"
) -> dict[str, object]:
    record = donor_record(expected_donor, role)
    return {
        "donor": expected_donor,
        "donorSha256": record["sha256"],
        "root": "breakable_l2_high_celadon_decanter",
        "height": 1.15,
        "floorFraction": 0.18,
        "wallMetres": 0.020,
        "exteriorTriangleTarget": MAX_DONOR_TRIANGLES,
        "cavitySegments": 24,
        "shards": 18,
        "seed": 20260923,
        "bodyTransmission": 0.0,
        "bodyColor": (0.68, 0.86, 0.78),
        "cavityColor": (0.50, 0.70, 0.63),
        "cutColor": (0.62, 0.83, 0.74),
        "repair": "none-strict-donor",
        "surfaceMaterial": "celadon_shell",
        "materialStrategy": "opaque-donor-atlas",
        "normalMapStrength": 0.40,
    }


def production_receipt(_slug: str) -> dict[str, object]:
    work = f"sources/{SLUG}-fracture-work-{VERSION}"
    command = (
        "rtk proxy blender -b --factory-startup --python "
        "art/glass-adventure/v6-level2/production/finalize_celadon_opaque_v3.py -- "
    )
    return {
        "workingDirectory": "repository root",
        "toolchain": {
            "blender": pipeline.BLENDER_VERSION,
            "backendPython": pipeline.BACKEND_PYTHON_VERSION,
            "manifold3d": pipeline.MANIFOLD_VERSION,
            "backendNumpy": pipeline.BACKEND_NUMPY_VERSION,
            "scratchPythonPath": pipeline.MANIFOLD_PATH,
            "scratchPathCommitted": False,
            "solidFractureBackend": {
                "file": "art/glass-adventure/v3/solid_fracture.py",
                "sha256": pipeline.digest(pipeline.V3 / "solid_fracture.py"),
            },
        },
        "commands": {
            "installScratchBackend": (
                "rtk proxy /usr/bin/python3 -m pip install --target "
                f"{pipeline.MANIFOLD_PATH} manifold3d=={pipeline.MANIFOLD_VERSION} "
                f"numpy=={pipeline.BACKEND_NUMPY_VERSION}"
            ),
            "audit": command + "--phase audit",
            "preRemeshGeometryAudit": command + "--phase audit-pre-remesh",
            "prepare": command + "--phase prepare",
            "fractureExport": command + "--phase fracture",
            "freshGlbValidation": command + "--phase validate",
            "proofs": command + "--phase render",
        },
        "archivedIntermediateInputs": [
            f"{work}/cavity-input.npz",
            f"{work}/cavity-output.npz",
            f"{work}/cavity-output.json",
            f"{work}/cut-input.npz",
            f"{work}/cut-output.npz",
            f"{work}/cut-output.json",
        ],
    }


pipeline.production_receipt = production_receipt


def classify_celadon_materials(
    obj: bpy.types.Object, slug: str, value: dict[str, object]
):
    materials, report = base_classify_materials(obj, slug, value)
    report["reason"] = (
        "Preserves one coherent opaque celadon PBR atlas across the exterior, including "
        "the guide-derived gold, cabochon, ivory-foot, and low-relief color cues without "
        "triangle-level material boundaries. Runtime integration may add a shared glass "
        "response only after this authored atlas is visually approved."
    )
    return materials, report


pipeline.classify_materials = classify_celadon_materials


def connected_face_components(obj: bpy.types.Object) -> int:
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    remaining = set(bm.faces)
    count = 0
    while remaining:
        count += 1
        pending = [remaining.pop()]
        while pending:
            face = pending.pop()
            for edge in face.edges:
                for neighbour in edge.link_faces:
                    if neighbour in remaining:
                        remaining.remove(neighbour)
                        pending.append(neighbour)
    bm.free()
    return count


def material_contract(obj: bpy.types.Object) -> dict[str, object]:
    materials = [material for material in obj.data.materials if material is not None]
    if len(materials) != 1:
        raise ValueError(f"Expected one coherent Meshy atlas material, got {len(materials)}")
    material = materials[0]
    if not material.use_nodes:
        raise ValueError("Celadon donor atlas material does not use nodes")
    shader = material.node_tree.nodes.get("Principled BSDF")
    if shader is None:
        raise ValueError("Celadon donor material lost its Principled BSDF")
    base_image, _ = pipeline.linked_image(shader, "Base Color")
    metallic_image, metallic_channel = pipeline.linked_image(shader, "Metallic")
    if metallic_channel is None:
        raise ValueError("Celadon donor needs a packed metallic channel")
    normal_socket = shader.inputs["Normal"]
    if not normal_socket.is_linked or normal_socket.links[0].from_node.type != "NORMAL_MAP":
        raise ValueError("Celadon donor needs an authored normal-map node")
    normal_node = normal_socket.links[0].from_node
    normal_color = normal_node.inputs["Color"]
    if not normal_color.is_linked or normal_color.links[0].from_node.type != "TEX_IMAGE":
        raise ValueError("Celadon donor normal-map node needs an image")
    normal_image = normal_color.links[0].from_node.image
    if normal_image is None:
        raise ValueError("Celadon donor normal image is missing")
    if obj.data.uv_layers.active is None:
        raise ValueError("Celadon donor needs UV0")
    images = {base_image, metallic_image, normal_image}
    return {
        "material": material.name,
        "uvLayer": obj.data.uv_layers.active.name,
        "images": [
            {
                "name": image.name,
                "dimensions": [int(image.size[0]), int(image.size[1])],
                "colorSpace": image.colorspace_settings.name,
            }
            for image in sorted(images, key=lambda item: item.name)
        ],
        "normalMapStrengthSource": float(normal_node.inputs["Strength"].default_value),
    }


def gate_report(
    obj: bpy.types.Object,
    normalization: dict[str, object],
    raw_topology: dict[str, object],
    cleanup: dict[str, object],
    *,
    audit_path: Path = AUDIT,
    require_runtime_materials: bool = True,
    require_runtime_budget: bool = True,
) -> dict[str, object]:
    checked = pipeline.topology(obj)
    components = connected_face_components(obj)
    materials = (
        material_contract(obj)
        if require_runtime_materials
        else {
            "materials": [
                material.name
                for material in obj.data.materials
                if material is not None
            ],
            "uvLayers": [layer.name for layer in obj.data.uv_layers],
            "runtimeMaterialGateApplied": False,
        }
    )
    failures = []
    if not pipeline.topology_passes(checked):
        failures.append("post-weld surface is not closed, oriented, and self-intersection-free")
    if components != 1:
        failures.append(f"expected one connected fused surface, found {components}")
    if require_runtime_budget and checked["triangles"] > MAX_DONOR_TRIANGLES:
        failures.append(
            f"donor has {checked['triangles']} triangles; maximum is {MAX_DONOR_TRIANGLES}"
        )
    report = {
        "schema": 1,
        "assetId": SLUG,
        "variant": (
            "opaque-guide-v3"
            if require_runtime_materials
            else "opaque-guide-v3-pre-remesh-source"
        ),
        "status": (
            "passed strict donor gate"
            if not failures
            else "rejected by strict donor gate"
        ),
        "donor": {
            "file": str(obj.get("source_file", "unknown")),
            "bytes": (ROOT / str(obj.get("source_file"))).stat().st_size,
            "sha256": pipeline.digest(ROOT / str(obj.get("source_file"))),
        },
        "normalization": normalization,
        "rawImportedTopology": raw_topology,
        "cleanup": cleanup,
        "strictTopology": checked,
        "connectedFaceComponents": components,
        "materialContract": materials,
        "triangleBudget": {
            "maximumDonorTriangles": MAX_DONOR_TRIANGLES,
            "actual": checked["triangles"],
            "enforced": require_runtime_budget,
        },
        "gateConditions": [
            (
                "exactly one imported mesh and one coherent textured PBR atlas"
                if require_runtime_materials
                else "exactly one imported mesh; material eligibility recorded separately"
            ),
            "one connected fused face component after a 0.1 micrometre weld",
            "zero non-manifold edges and vertices",
            "zero non-contiguous edges and geometric self-intersection pairs",
            "positive signed volume and no Blender mesh validation defect",
            (
                f"no more than {MAX_DONOR_TRIANGLES} exterior triangles"
                if require_runtime_budget
                else "triangle count recorded for source provenance; runtime budget not applied"
            ),
            (
                "UV0 plus embedded base-color, packed metallic-roughness, and normal images"
                if require_runtime_materials
                else "geometry-only source audit; runtime material gate not applied"
            ),
        ],
        "failures": failures,
        "reproduction": {
            "workingDirectory": "repository root",
            "blender": pipeline.BLENDER_VERSION,
            "command": (
                "rtk proxy blender -b --factory-startup --python "
                "art/glass-adventure/v6-level2/production/"
                "finalize_celadon_opaque_v3.py -- --phase "
                + ("audit" if require_runtime_materials else "audit-pre-remesh")
            ),
        },
        "readiness": (
            "Donor gate only; open cavity, measured wall, matched shards, fresh GLB "
            "reimport, visual proofs, and runtime integration remain separate gates."
            if require_runtime_materials
            else "Preserved source geometry audit only; no repair or runtime reduction was attempted."
        ),
    }
    audit_path.write_text(json.dumps(report, indent=2) + "\n")
    if failures:
        raise ValueError("Celadon opaque V3 donor gate failed: " + json.dumps(failures))
    return report


def load_and_gate(
    value: dict[str, object],
    *,
    audit_path: Path = AUDIT,
    require_runtime_materials: bool = True,
    require_runtime_budget: bool = True,
):
    obj, normalization = pipeline.normalized_import(value)
    obj["source_file"] = str(value["donor"])
    source = pipeline.geometry_snapshot(obj)
    raw_topology = pipeline.topology(obj)
    cleanup = {"weld": pipeline.weld_and_triangulate(obj), "repair": "none"}
    report = gate_report(
        obj,
        normalization,
        raw_topology,
        cleanup,
        audit_path=audit_path,
        require_runtime_materials=require_runtime_materials,
        require_runtime_budget=require_runtime_budget,
    )
    return obj, normalization, source, cleanup, report


def audit(value: dict[str, object]) -> dict[str, object]:
    _obj, _normalization, _source, _cleanup, report = load_and_gate(value)
    print(
        "CELADON_OPAQUE_V3_AUDITED="
        + json.dumps(
            {
                "triangles": report["strictTopology"]["triangles"],
                "components": report["connectedFaceComponents"],
                "sha256": report["donor"]["sha256"],
            }
        ),
        flush=True,
    )
    return report


def audit_pre_remesh(value: dict[str, object]) -> dict[str, object]:
    _obj, _normalization, _source, _cleanup, report = load_and_gate(
        value,
        audit_path=PRE_REMESH_AUDIT,
        require_runtime_materials=False,
        require_runtime_budget=False,
    )
    print(
        "CELADON_OPAQUE_V3_PRE_REMESH_AUDITED="
        + json.dumps(
            {
                "triangles": report["strictTopology"]["triangles"],
                "components": report["connectedFaceComponents"],
                "sha256": report["donor"]["sha256"],
            }
        ),
        flush=True,
    )
    return report


def prepare(value: dict[str, object]) -> dict[str, object]:
    obj, normalization, source, cleanup, preflight = load_and_gate(value)
    lod = pipeline.decimate(obj, int(value["exteriorTriangleTarget"]))
    exterior_check = pipeline.topology(obj)
    exterior_components = connected_face_components(obj)
    if not pipeline.topology_passes(exterior_check) or exterior_components != 1:
        raise ValueError(
            "Exterior failed post-LOD solid gate: "
            + json.dumps(
                {"topology": exterior_check, "connectedFaceComponents": exterior_components}
            )
        )
    exterior_fidelity = pipeline.fidelity(obj, source)
    materials, regions = pipeline.classify_materials(obj, SLUG, value)
    profile, profile_report = pipeline.radial_profile(obj, value)
    cutter = pipeline.make_cutter(
        profile, materials["cavity_surface"], int(value["cavitySegments"])
    )
    shell, cavity_backend = pipeline.subtract_cavity(
        obj,
        cutter,
        materials,
        ROOT / "sources" / f"{SLUG}-fracture-work-{VERSION}",
    )
    bpy.data.objects.remove(obj, do_unlink=True)
    bpy.data.objects.remove(cutter, do_unlink=True)
    shell.name = str(value["root"]) + "_intact"
    shell.data.name = shell.name + "_geometry"
    shell["role"] = "intact"
    shell["asset_id"] = SLUG
    root = bpy.data.objects.new(str(value["root"]), None)
    bpy.context.scene.collection.objects.link(root)
    root["asset_id"] = SLUG
    root["units"] = "metres"
    shell.parent = root
    collider = pipeline.make_collider(value, shell, root)
    shell_check = pipeline.topology(shell)
    shell_components = connected_face_components(shell)
    if not pipeline.topology_passes(shell_check) or shell_components != 1:
        raise ValueError(
            "Cavity shell failed solid gate: "
            + json.dumps(
                {"topology": shell_check, "connectedFaceComponents": shell_components}
            )
        )
    hits = pipeline.central_ray_hits(shell)
    floor = float(value["height"]) * float(value["floorFraction"])
    if len(hits) != 2 or max(hits) > floor + float(value["height"]) * 0.08:
        raise ValueError(f"Central mouth ray does not prove an open cavity: {hits}")
    thickness = pipeline.cavity_thickness(shell, source["tree"], float(value["height"]))
    if (
        thickness["nearestExteriorDistanceMetres"]["p05"] < 0.004
        or thickness["nearestExteriorDistanceMetres"]["p50"] < 0.010
    ):
        raise ValueError(
            "Cavity wall does not retain a measured interior thickness: "
            + json.dumps(thickness)
        )
    source_low, source_high = source["bounds"]
    final_low, final_high = pipeline.mesh_bounds([shell])
    bound_delta = max(
        max(abs(source_low[axis] - final_low[axis]) for axis in range(3)),
        max(abs(source_high[axis] - final_high[axis]) for axis in range(3)),
    )
    if bound_delta > 1e-5:
        raise ValueError(f"Cavity changed exterior bounds by {bound_delta} metres")
    bpy.ops.file.pack_all()
    blend = ROOT / "sources" / f"{SLUG}-cavity-{VERSION}.blend"
    blend.parent.mkdir(parents=True, exist_ok=True)
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=str(blend), check_existing=False)
    report = {
        "schema": 1,
        "status": "prepared cavity shell; fracture/export validation pending",
        "assetId": SLUG,
        "variant": "opaque-guide-v3",
        "donor": preflight["donor"],
        "normalization": normalization,
        "preflight": {
            "report": str(AUDIT.relative_to(ROOT)),
            "sha256": pipeline.digest(AUDIT),
            "connectedFaceComponents": preflight["connectedFaceComponents"],
        },
        "cleanup": cleanup,
        "lod": lod,
        "exteriorCheck": exterior_check,
        "exteriorConnectedFaceComponents": exterior_components,
        "exteriorFidelityBeforeCavity": exterior_fidelity,
        "materialRegions": regions,
        "cavityProfile": profile_report,
        "cavityBackend": cavity_backend,
        "cavityThickness": thickness,
        "centralMouthRayZMetres": hits,
        "shellCheck": shell_check,
        "shellConnectedFaceComponents": shell_components,
        "exteriorBoundsMaxDeltaMetres": bound_delta,
        "nodes": {
            "root": root.name,
            "intact": shell.name,
            "collider": collider.name,
        },
        "packedBlenderSource": {
            "file": str(blend.relative_to(ROOT)),
            "bytes": blend.stat().st_size,
            "sha256": pipeline.digest(blend),
        },
        "reproduction": production_receipt(SLUG),
        "gameplayReadiness": (
            "Prepared production shell only; matched shards, fresh GLB validation, "
            "visual proof review, and runtime behavior remain required."
        ),
    }
    path = ROOT / "exports" / f"{SLUG}-cavity-{VERSION}.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(report, indent=2) + "\n")
    print(
        "CELADON_OPAQUE_V3_CAVITY_PREPARED="
        + json.dumps(
            {
                "triangles": shell_check["triangles"],
                "dimensionsMetres": list(final_high - final_low),
                "blend": str(blend),
            }
        ),
        flush=True,
    )
    return report


def fracture(value: dict[str, object]) -> dict[str, object]:
    report = pipeline.fracture(SLUG, value)
    intact_triangles = int(report["meshChecks"][0]["triangles"])
    total_triangles = sum(int(row["triangles"]) for row in report["meshChecks"])
    budget = {
        "intactMaximum": MAX_RUNTIME_TRIANGLES,
        "intactActual": intact_triangles,
        "allRenderedNodesMaximum": MAX_ALL_RENDERED_TRIANGLES,
        "allRenderedNodesActual": total_triangles,
        "shardMaximum": 20,
        "shardActual": len(report["shards"]),
        "passed": (
            intact_triangles <= MAX_RUNTIME_TRIANGLES
            and total_triangles <= MAX_ALL_RENDERED_TRIANGLES
            and len(report["shards"]) <= 20
        ),
    }
    report["runtimeGeometryBudget"] = budget
    path = ROOT / "exports" / f"{SLUG}-fracture-{VERSION}.json"
    path.write_text(json.dumps(report, indent=2) + "\n")
    if not budget["passed"]:
        raise ValueError("Celadon V3 runtime geometry budget failed: " + json.dumps(budget))
    return report


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--phase",
        choices=(
            "audit",
            "audit-pre-remesh",
            "prepare",
            "fracture",
            "validate",
            "render",
        ),
        required=True,
    )
    args = parser.parse_args(sys.argv[sys.argv.index("--") + 1 :])
    value = (
        config(EXPECTED_PRE_REMESH, "pre_remeshed_glb")
        if args.phase == "audit-pre-remesh"
        else config()
    )
    {
        "audit": audit,
        "audit-pre-remesh": audit_pre_remesh,
        "prepare": prepare,
        "fracture": fracture,
        "validate": lambda item: pipeline.validate(SLUG, item),
        "render": lambda item: pipeline.render(SLUG, item),
    }[args.phase](value)
    bpy.ops.wm.quit_blender()


if __name__ == "__main__":
    main()
