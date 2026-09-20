"""Export the preserved Meshy wall bays for play, without resaving source Blends."""

import hashlib
import json
import tempfile
from pathlib import Path

import bpy


HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
DESTINATION = ROOT / "apps/beside-cue/public/games/adventure-v4"


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def run():
    DESTINATION.mkdir(parents=True, exist_ok=True)
    receipts = []
    for kind in ("window", "screen"):
        source = HERE / "sources" / f"museum-{kind}-bay-01-final-v1.blend"
        original_hash = digest(source)
        bpy.ops.wm.open_mainfile(filepath=str(source))
        images = []
        with tempfile.TemporaryDirectory(prefix="glass-wall-export-") as temp:
            for index, original in enumerate(list(bpy.data.images)):
                color_space = original.colorspace_settings.name
                # Opaque sRGB base color can use high-quality JPEG; the data
                # channels remain lossless. Fresh datablocks avoid reusing the
                # packed 2K source bytes after Image.scale().
                use_jpeg = color_space == "sRGB"
                original.scale(1024, 1024)
                original.file_format = "JPEG" if use_jpeg else "PNG"
                suffix = "jpg" if use_jpeg else "png"
                path = Path(temp) / f"atlas-{index}.{suffix}"
                original.filepath_raw = str(path)
                original.save(quality=95)
                replacement = bpy.data.images.load(str(path), check_existing=False)
                replacement.colorspace_settings.name = color_space
                for material in bpy.data.materials:
                    if material.use_nodes:
                        for node in material.node_tree.nodes:
                            if node.type == "TEX_IMAGE" and node.image == original:
                                node.image = replacement
                images.append({"name": original.name, "colorSpace": color_space,
                               "format": original.file_format, "size": list(replacement.size),
                               "sha256": digest(path)})
            output = DESTINATION / f"museum-{kind}-bay.glb"
            bpy.ops.object.select_all(action="SELECT")
            bpy.ops.export_scene.gltf(
                filepath=str(output), export_format="GLB", use_selection=True,
                export_yup=True, export_texcoords=True, export_normals=True,
                export_tangents=True, export_materials="EXPORT",
                export_image_format="AUTO", export_jpeg_quality=95,
            )
        assert digest(source) == original_hash, "Packed authoring source was modified"
        receipts.append({
            "assetId": f"museum-{kind}-v4", "node": f"meshy_museum_{kind}_bay",
            "source": str(source.relative_to(ROOT)), "sourceSha256": original_hash,
            "output": str(output.relative_to(ROOT)), "sha256": digest(output),
            "bytes": output.stat().st_size, "textures": images,
            "geometry": "Original donor geometry and UVs preserved; no decimation",
            "coordinates": "GLB +Y up, +Z front, foot-center origin, metres",
        })
    receipt = {"version": 1, "exporter": bpy.app.version_string, "assets": receipts}
    (HERE / "reports/playable-export-v1.json").write_text(json.dumps(receipt, indent=2) + "\n")
    return receipt
