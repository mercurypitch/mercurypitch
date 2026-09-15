"""Export verified 1K atlas derivatives without touching the packed 2K working file."""
import hashlib
import json
from pathlib import Path
import bpy

HERE = Path(__file__).resolve().parent


def run(stem):
    report_path = HERE / 'reports' / f'{stem}.json'
    report = json.loads(report_path.read_text())
    bpy.ops.wm.open_mainfile(filepath=str(HERE / report['blend']['path']))
    textures = HERE / 'exports' / f'{stem}-textures'
    records = []
    # GLTF can reuse packed original bytes even after Image.scale(). New image
    # datablocks loaded from the saved derivative make byte provenance explicit.
    for i, original in enumerate(list(bpy.data.images)):
        color_space = original.colorspace_settings.name
        original.scale(1024, 1024)
        path = textures / f'atlas-{i}.png'
        original.file_format = 'PNG'
        original.filepath_raw = str(path)
        original.save()
        replacement = bpy.data.images.load(str(path), check_existing=False)
        replacement.colorspace_settings.name = color_space
        for material in bpy.data.materials:
            if material.use_nodes:
                for node in material.node_tree.nodes:
                    if node.type == 'TEX_IMAGE' and node.image == original:
                        node.image = replacement
        records.append({'name': original.name, 'path': str(path.relative_to(HERE)),
                        'colorSpace': color_space, 'size': list(replacement.size),
                        'sha256': hashlib.sha256(path.read_bytes()).hexdigest()})
    export = HERE / report['glb']['path']
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.export_scene.gltf(filepath=str(export), export_format='GLB',
        use_selection=True, export_yup=True, export_texcoords=True,
        export_normals=True, export_tangents=True, export_materials='EXPORT',
        export_image_format='AUTO')
    report['textures'] = records
    report['glb'].update(sha256=hashlib.sha256(export.read_bytes()).hexdigest(),
                         bytes=export.stat().st_size)
    report['edits'].append('Reload saved 1K derivatives into export-only image datablocks; preserve packed 2K working Blender file')
    report_path.write_text(json.dumps(report, indent=2) + '\n')
    return report['glb']
