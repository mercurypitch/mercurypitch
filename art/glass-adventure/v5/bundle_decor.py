"""Bundle normalized Blender sources and derive game-sized texture atlases."""

import hashlib
import json
import tempfile
from pathlib import Path

import bpy

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def run():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    for name in ['crystal-planter-final-v1.blend', 'gallery-frame-final-v1.blend']:
        path = HERE / 'sources' / name
        with bpy.data.libraries.load(str(path), link=False) as (source, target):
            target.objects = source.objects
        for obj in target.objects:
            if obj is not None and obj.type in {'MESH', 'EMPTY'}:
                bpy.context.scene.collection.objects.link(obj)
    nodes = ['decor_crystal_planter', 'decor_gallery_frame']
    assert all(bpy.data.objects.get(name) is not None for name in nodes)
    bpy.ops.file.pack_all()
    blend = HERE / 'sources/museum-decor-v5.blend'
    bpy.ops.wm.save_as_mainfile(filepath=str(blend))
    original_hash = digest(blend)
    output = ROOT / 'apps/beside-cue/public/games/adventure-v5/museum-decor.glb'
    images = []
    with tempfile.TemporaryDirectory(prefix='glass-decor-bundle-') as temp:
        for index, original in enumerate(list(bpy.data.images)):
            colour_space = original.colorspace_settings.name
            colour = colour_space == 'sRGB'
            original.scale(1024, 1024)
            original.file_format = 'JPEG' if colour else 'PNG'
            path = Path(temp) / f'atlas-{index}.{"jpg" if colour else "png"}'
            original.filepath_raw = str(path)
            original.save(quality=95)
            replacement = bpy.data.images.load(str(path), check_existing=False)
            replacement.colorspace_settings.name = colour_space
            for material in bpy.data.materials:
                if material.use_nodes:
                    for node in material.node_tree.nodes:
                        if node.type == 'TEX_IMAGE' and node.image == original:
                            node.image = replacement
            images.append({'name': original.name, 'size': list(replacement.size),
                           'colorSpace': colour_space, 'sha256': digest(path)})
        bpy.ops.object.select_all(action='SELECT')
        bpy.ops.export_scene.gltf(filepath=str(output), export_format='GLB',
                                 use_selection=True, export_yup=True,
                                 export_texcoords=True, export_normals=True,
                                 export_tangents=True, export_materials='EXPORT',
                                 export_image_format='AUTO', export_jpeg_quality=95)
    assert digest(blend) == original_hash
    receipt = {'schema': 1, 'assetId': 'museum-decor-v5', 'nodes': nodes,
               'source': str(blend.relative_to(ROOT)), 'sourceSha256': original_hash,
               'output': str(output.relative_to(ROOT)), 'sha256': digest(output),
               'bytes': output.stat().st_size,
               'triangles': sum(len(o.data.polygons) for o in bpy.context.scene.objects
                                if o.type == 'MESH'), 'textures': images}
    (HERE / 'exports/bundle-receipt.json').write_text(json.dumps(receipt, indent=2)+'\n')
    return receipt


if __name__ == '__main__':
    print(json.dumps(run(), indent=2))
