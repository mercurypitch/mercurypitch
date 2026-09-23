"""Repair only invalid exported V8 tangent rows and refresh the candidate manifest."""

from __future__ import annotations

import importlib.util
import json
from pathlib import Path
import sys

import bpy


HERE = Path(__file__).resolve().parent
FINISHER = HERE / "finish_conservatory_candidate.py"


def load_finisher():
    spec = importlib.util.spec_from_file_location("conservatory_v8_finisher", FINISHER)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Cannot load {FINISHER}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


F = load_finisher()


def validate_record(record: dict[str, object], label: str) -> Path:
    if not isinstance(record, dict):
        raise ValueError(f"{label} is not a file record")
    relative = record.get("file")
    expected = record.get("sha256")
    if not isinstance(relative, str) or not isinstance(expected, str):
        raise ValueError(f"{label} lacks file/sha256")
    path = F.ART / relative
    if not path.is_file() or F.digest(path) != expected:
        raise ValueError(f"{label} changed before tangent repair")
    if "bytes" in record and path.stat().st_size != int(record["bytes"]):
        raise ValueError(f"{label} byte count changed before tangent repair")
    return path


def main() -> None:
    F.validate_receipts()
    if not F.MANIFEST.is_file():
        raise FileNotFoundError("The finished-candidate manifest is required")
    manifest = json.loads(F.MANIFEST.read_text())
    if manifest.get("schema") != 1 or manifest.get("assetId") != "floating-museum-conservatory-candidate-v8":
        raise ValueError("Candidate manifest has the wrong schema or asset")

    selected = manifest.get("selectedToActiveBake", {})
    derived = selected.get("derivedRuntimeMaps", {})
    source = manifest.get("source", {})
    immutable_records = {
        "packed blend": manifest.get("packedBlend"),
        "dense normal": selected.get("normal"),
        "dense AO": selected.get("ambientOcclusion"),
        "derived ORM": derived.get("orm"),
        "transmission": derived.get("transmission"),
        "provider base": source.get("providerTextureFiles", {}).get("baseColor"),
        "provider normal": source.get("providerTextureFiles", {}).get("normal"),
        "provider metallic-roughness": source.get("providerTextureFiles", {}).get("metallicRoughness"),
    }
    immutable_hashes = {
        label: F.digest(validate_record(record, label))
        for label, record in immutable_records.items()
    }

    variants = manifest.get("variants")
    if not isinstance(variants, dict):
        raise ValueError("Candidate manifest has no variants")
    expected_triangles = int(variants.get("meshy", {}).get("triangles", -1))
    if expected_triangles <= 0:
        raise ValueError("Candidate manifest has no triangle contract")

    refreshed = {}
    for name, path in F.VARIANTS.items():
        current = variants.get(name)
        if not isinstance(current, dict):
            raise ValueError(f"Candidate manifest has no {name} variant")
        if current.get("file") != str(path.relative_to(F.ART)) or current.get("sha256") != F.digest(path):
            raise ValueError(f"{name} candidate changed before tangent repair")
        repair = F.repair_degenerate_tangents(path)
        previous_repair = current.get("tangentRepair")
        if (
            repair["repairedCount"] == 0
            and isinstance(previous_repair, dict)
            and int(previous_repair.get("repairedCount", 0)) > 0
        ):
            # The current file hash was already bound to this manifest record,
            # so retain its repair evidence on an idempotent verification run.
            repair = previous_repair
        row = F.validate_export(path, expected_triangles)
        row["tangentRepair"] = repair
        refreshed[name] = row

    for label, expected in immutable_hashes.items():
        path = validate_record(immutable_records[label], label)
        if F.digest(path) != expected:
            raise ValueError(f"Tangent repair unexpectedly changed {label}")

    manifest["variants"] = refreshed
    validation = manifest.setdefault("validation", {})
    validation["uv0NormalAndTangentPassed"] = True
    validation["allTangentsFiniteAndUnit"] = True
    validation["tangentFallback"] = {
        name: row["tangentRepair"] for name, row in refreshed.items()
    }
    validation["tangentRepairPreservedGeometryUvPositionNormalAndMaps"] = True
    rebuild = manifest.setdefault("rebuild", {})
    rebuild["tangentRepairCommand"] = (
        "rtk proxy timeout 300 env ALSOFT_DRIVERS=null blender -b --factory-startup "
        "--python-exit-code 1 --python "
        "art/glass-adventure/journey-map/v8/production/repair_conservatory_candidate_tangents.py"
    )
    F.MANIFEST.write_text(json.dumps(manifest, indent=2) + "\n")
    print(
        "CONSERVATORY_TANGENTS_REPAIRED="
        + json.dumps(
            {
                "manifestSha256": F.digest(F.MANIFEST),
                "variants": {
                    name: {
                        "sha256": row["sha256"],
                        "repaired": row["tangentRepair"]["repairedCount"],
                    }
                    for name, row in refreshed.items()
                },
                "immutableSourceHashes": immutable_hashes,
            }
        ),
        flush=True,
    )
    bpy.ops.wm.quit_blender()


if __name__ == "__main__":
    main()
