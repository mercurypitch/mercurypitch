"""Render provisional donor-derived material labels without writing geometry sources."""
import argparse
import gzip
import hashlib
import importlib.util
import json
from pathlib import Path
import sys

import bpy
import numpy as np
from mathutils import Matrix, Vector
from PIL import Image, ImageDraw

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
spec = importlib.util.spec_from_file_location('texture_materials', HERE.parent / 'texture_materials.py')
transfer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(transfer)


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def appearance(name, color, roughness=.5, transmission=0, metallic=0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    shader = mat.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Base Color'].default_value = (*color, 1)
    shader.inputs['Roughness'].default_value = roughness
    shader.inputs['Transmission Weight'].default_value = transmission
    shader.inputs['Metallic'].default_value = metallic
    shader.inputs['IOR'].default_value = 1.5
    return mat


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--recipe', type=Path, required=True)
    args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:])
    recipe_path = args.recipe.resolve()
    if not recipe_path.is_relative_to(HERE):
        raise ValueError('Keep material region recipes in this authoring directory')
    recipe = json.loads(recipe_path.read_text())
    out = recipe_path.parent / recipe['output']
    if out.exists():
        raise FileExistsError('Use a new proof revision, preserving previous auditions')
    target_file, source_file = (ROOT / recipe[key] for key in ('targetBlend', 'texturedSource'))
    source_hash, target_hash = digest(source_file), digest(target_file)
    bpy.ops.wm.open_mainfile(filepath=str(target_file))
    bpy.context.preferences.filepaths.save_version = 0
    targets = [bpy.data.objects[name] for name in recipe['targetObjects']]
    originals = {obj: [(tuple(vertex.co)) for vertex in obj.data.vertices] for obj in targets}
    eligible = {obj: {face.index for face in obj.data.polygons
                     if 'exteriorMaterialIndex' not in recipe or
                     face.material_index == recipe['exteriorMaterialIndex']} for obj in targets}
    existing = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(source_file))
    sources = [obj for obj in bpy.data.objects if obj not in existing and obj.type == 'MESH']
    normalization = recipe['normalization']
    origin, scale = Vector(normalization['sourceFootCentre']), normalization['uniformScale']
    for obj in sources:
        world = obj.matrix_world.copy()
        obj.parent = None
        obj.matrix_world = Matrix.Identity(4)
        for vertex in obj.data.vertices:
            vertex.co = (world @ vertex.co - origin) * scale
    bpy.context.view_layer.update()
    mat = sources[0].data.materials[0]
    shader = next(node for node in mat.node_tree.nodes if node.type == 'BSDF_PRINCIPLED')
    image = shader.inputs['Base Color'].links[0].from_node.image
    pixels = np.empty(image.size[0] * image.size[1] * 4, np.float32)
    image.pixels.foreach_get(pixels)
    pixels = pixels.reshape(image.size[1], image.size[0], 4)[::-1]
    points = recipe['sampleCoordinatesTopLeft']
    swatches = {kind: [pixels[y, x, :3].tolist() for x, y in positions]
                for kind, positions in points.items()}
    atlas = Image.fromarray(np.uint8(np.round(np.clip(pixels, 0, 1) * 255)))
    draw = ImageDraw.Draw(atlas)
    for kind, positions in points.items():
        for index, (x, y) in enumerate(positions):
            draw.ellipse((x-15, y-15, x+15, y+15), outline='red', width=3)
            draw.text((x+18, y), kind+str(index), fill='red')
    out.mkdir(parents=True)
    atlas.save(out / 'source-atlas-swatches.png')
    limits = recipe['limits']
    reports = {}
    diagnostic_materials = [appearance('diagnostic-glass', (.1, .65, .7)),
                            appearance('diagnostic-gold', (.75, .43, .08)),
                            appearance('UNRESOLVED', (.9, .02, .4)),
                            appearance('authored-interior', (.05, .22, .38))]
    for obj in targets:
        report = transfer.classify_faces(obj, sources, gold_srgb_samples=swatches['gold'],
            glass_srgb_samples=swatches['glass'], max_distance=limits['maxDistanceMetres'],
            min_margin=limits['minMargin'], max_chroma_distance=limits['maxChromaDistance'])
        report['excludedAuthoredInteriorFaces'] = len(obj.data.polygons) - len(eligible[obj])
        report['faces'] = [row for row in report['faces'] if row['face'] in eligible[obj]]
        report['counts'] = {name: sum(row['material'] == name for row in report['faces'])
                            for name in ('glass_shell', 'gold_trim', None)}
        distances = [row['distanceMetres'] for row in report['faces']]
        report['distanceMetres'] = {'max': max(distances), 'p95': float(np.quantile(distances, .95))}
        reports[obj.name] = report
        obj.data.materials.clear()
        for material in diagnostic_materials:
            obj.data.materials.append(material)
        for face in obj.data.polygons:
            face.material_index = 3
        for row in report['faces']:
            obj.data.polygons[row['face']].material_index = {'glass_shell': 0, 'gold_trim': 1, None: 2}[row['material']]
        assert originals[obj] == [tuple(vertex.co) for vertex in obj.data.vertices]
    with gzip.open(out / 'face-labels.json.gz', 'wt', encoding='utf8') as handle:
        json.dump(reports, handle, separators=(',', ':'))
    summary = {'family': recipe['family'], 'status': 'provisional material-region audition; unresolved faces remain explicit',
        'sourceGlbSha256': source_hash, 'targetBlendSha256': target_hash,
        'geometryChanged': False, 'sourcesWritten': False, 'normalization': normalization,
        'swatchesSrgb': swatches, 'sampleCoordinatesTopLeft': points, 'limits': limits,
        'meshes': {name: {key: report[key] for key in ('counts', 'distanceMetres', 'excludedAuthoredInteriorFaces')}
                   for name, report in reports.items()},
        'legend': {'cyan': 'classified glass', 'gold': 'classified gold',
                   'magenta': 'unresolved source correspondence/color', 'darkBlue': 'authored interior excluded from paint transfer'},
        'limitsOfAcceptance': 'Source paint classification only. Geometry/fracture and physical materials are not accepted by this proof.'}
    (out / 'summary.json').write_text(json.dumps(summary, indent=2) + '\n')
    print('REGION_PROOF', json.dumps(summary['meshes']), flush=True)
    for obj in bpy.context.scene.objects:
        if obj.type == 'MESH' and obj not in targets:
            obj.hide_render = True
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.samples = 16
    scene.cycles.use_denoising = True
    scene.render.resolution_x = 760
    scene.render.resolution_y = 950
    scene.render.resolution_percentage = 100
    scene.world = bpy.data.worlds.new('region-proof-world')
    scene.world.color = (.11, .11, .11)
    height = recipe['heightMetres']
    for location, power in [((-2, -3, 3), 420), ((3, -1, 2), 180), ((0, 3, 3), 450)]:
        light = bpy.data.lights.new('region-proof-light', 'AREA')
        light.energy = power * height * height
        light.size = height * 2
        obj = bpy.data.objects.new('region-proof-light', light)
        scene.collection.objects.link(obj)
        obj.location = Vector(location) * height
        obj.rotation_euler = (Vector((0, 0, height*.5))-obj.location).to_track_quat('-Z', 'Y').to_euler()
    bpy.ops.object.camera_add()
    camera = bpy.context.object
    camera.data.type = 'ORTHO'
    camera.data.ortho_scale = height * 1.3
    scene.camera = camera
    scene.view_settings.view_transform = 'AgX'
    for name, location in [('three-quarter', (2, -3, 1.4)), ('back', (-2, 3, 1.4))]:
        camera.location = Vector(location) * height
        camera.rotation_euler = (Vector((0, 0, height*.5))-camera.location).to_track_quat('-Z', 'Y').to_euler()
        scene.render.filepath = str(out / ('regions-' + name + '.png'))
        bpy.ops.render.render(write_still=True)
    assert digest(source_file) == source_hash and digest(target_file) == target_hash
    print('REGION_SOURCE_HASHES_UNCHANGED', flush=True)


if __name__ == '__main__':
    main()
