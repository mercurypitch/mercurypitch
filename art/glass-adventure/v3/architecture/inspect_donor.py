"""Preserve and inspect a supplied Meshy GLB; never synthesize source geometry."""
import argparse
import hashlib
import json
import math
from pathlib import Path
import re
import shutil
import sys

import bpy
from mathutils import Vector

HERE = Path(__file__).resolve().parent


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, required=True)
    parser.add_argument("--asset-id", required=True)
    args = parser.parse_args(sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else [])
    if not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", args.asset_id):
        raise ValueError("Use a versioned lowercase alphanumeric asset ID")
    source = args.source.resolve()
    if source.suffix.lower() != ".glb" or not source.is_file():
        raise ValueError("Source must be an existing local GLB")
    source_hash = digest(source)
    raw_dir = HERE / "raw" / args.asset_id
    raw = raw_dir / "donor.glb"
    report_file = HERE / "reports" / f"{args.asset_id}-intake.json"
    blend_file = HERE / "sources" / f"{args.asset_id}-imported.blend"
    if raw.exists() and digest(raw) != source_hash:
        raise ValueError("This asset ID already identifies another donor; preserve it and use a new ID")
    if blend_file.exists() or report_file.exists():
        raise ValueError("Intake already exists; inspect it instead of overwriting source evidence")
    raw_dir.mkdir(parents=True, exist_ok=True)
    if source != raw:
        shutil.copy2(source, raw)
    if digest(raw) != source_hash:
        raise ValueError("Raw copy hash verification failed")
    # This script must run in its own background process. Clearing startup objects
    # ensures the saved source contains only the supplied donor, never a default cube.
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(raw))
    bpy.context.view_layer.update()
    meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    if not meshes:
        raise ValueError("The supplied donor contains no mesh")
    bounds = [obj.matrix_world @ Vector(corner) for obj in meshes for corner in obj.bound_box]
    minimum = [min(point[i] for point in bounds) for i in range(3)]
    maximum = [max(point[i] for point in bounds) for i in range(3)]
    if not all(math.isfinite(value) for value in minimum + maximum):
        raise ValueError("Donor bounds contain a non-finite value")
    objects = []
    for obj in meshes:
        mesh = obj.data
        mesh.calc_loop_triangles()
        objects.append({
            "name": obj.name,
            "vertices": len(mesh.vertices),
            "polygons": len(mesh.polygons),
            "triangles": len(mesh.loop_triangles),
            "uvLayers": [{"name": layer.name, "corners": len(layer.data)} for layer in mesh.uv_layers],
            "materialSlots": [slot.material.name if slot.material else None for slot in obj.material_slots],
            "negativeWorldDeterminant": obj.matrix_world.determinant() < 0,
            "nonfiniteCoordinates": sum(not all(math.isfinite(c) for c in vertex.co) for vertex in mesh.vertices),
        })
    materials = []
    for material in bpy.data.materials:
        nodes = list(material.node_tree.nodes) if material.use_nodes and material.node_tree else []
        principled = next((node for node in nodes if node.type == "BSDF_PRINCIPLED"), None)
        response = {}
        if principled:
            for name in ("Base Color", "Metallic", "Roughness", "IOR", "Alpha", "Transmission Weight"):
                socket = principled.inputs.get(name)
                if socket is None:
                    continue
                value = socket.default_value
                response[name] = {"linked": socket.is_linked, "default": list(value) if hasattr(value, "__len__") else value}
        materials.append({
            "name": material.name,
            "principled": response,
            "imageNodes": [{"name": node.name, "image": node.image.name if node.image else None} for node in nodes if node.type == "TEX_IMAGE"],
        })
    images = []
    for image in bpy.data.images:
        path = Path(bpy.path.abspath(image.filepath)) if image.filepath else None
        packed = bool(image.packed_file) or bool(image.packed_files)
        images.append({
            "name": image.name, "source": image.source,
            "size": list(image.size), "colorSpace": image.colorspace_settings.name,
            "filepath": image.filepath, "packedBeforeSave": packed,
            "missingExternal": image.source == "FILE" and not packed and (path is None or not path.is_file()),
        })
    missing = [image["name"] for image in images if image["missingExternal"]]
    if missing:
        raise ValueError("Missing donor image dependencies: " + ", ".join(missing))
    bpy.ops.file.pack_all()
    blend_file.parent.mkdir(parents=True, exist_ok=True)
    report_file.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(blend_file))
    report = {
        "version": 3, "assetId": args.asset_id, "status": "imported-awaiting-visual-inspection",
        "sourceGeometry": "Meshy donor; imported unchanged",
        "source": {"incomingPath": str(source), "rawPath": str(raw.relative_to(HERE)), "bytes": raw.stat().st_size, "sha256": source_hash},
        "blend": {"path": str(blend_file.relative_to(HERE)), "bytes": blend_file.stat().st_size, "sha256": digest(blend_file)},
        "blenderVersion": bpy.app.version_string,
        "coordinateSpace": "Blender imported coordinates, Z up; no normalization applied",
        "bounds": {"min": minimum, "max": maximum, "dimensions": [maximum[i] - minimum[i] for i in range(3)]},
        "totalTriangles": sum(obj["triangles"] for obj in objects),
        "objects": objects, "materials": materials, "images": images,
        "linkedLibraries": [library.filepath for library in bpy.data.libraries],
        "edits": [], "visualInspection": "pending", "runtimeExport": None,
    }
    report_file.write_text(json.dumps(report, indent=2) + "\n")
    print("V3_ARCHITECTURE_INTAKE " + json.dumps({"assetId": args.asset_id, "triangles": report["totalTriangles"], "blend": str(blend_file), "report": str(report_file)}))


if __name__ == "__main__":
    main()
