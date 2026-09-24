"""Finalize a reviewed Meshy donor while keeping its generated source surfaces."""

import argparse
import hashlib
import importlib.util
import json
from pathlib import Path
import sys

import bmesh
import bpy
from mathutils import Vector

HERE = Path(__file__).resolve().parent


def module(name, filename):
    spec = importlib.util.spec_from_file_location(name, HERE / filename)
    loaded = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(loaded)
    return loaded


inspection = module('donor_inspection', 'inspect_donor.py')
cutter = module('donor_fracture', 'fracture.py')


def material(name, color, roughness, transmission=0, metalness=0):
    result = bpy.data.materials.new(name)
    result.use_nodes = True
    shader = result.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Base Color'].default_value = (*color, 1)
    shader.inputs['Roughness'].default_value = roughness
    shader.inputs['Metallic'].default_value = metalness
    shader.inputs['Transmission Weight'].default_value = transmission
    shader.inputs['IOR'].default_value = 1.5
    return result


def assign_materials(meshes, config):
    materials = {
        'glass_shell': material('glass_shell', (.95, .99, .985), .04, .98),
        'glass_cut': material('glass_cut', (.83, .98, .97), .14, .88),
        'gold_trim': material('gold_trim', (.76, .50, .17), .20, metalness=.95),
    }
    names = list(materials)
    # Face masks refer to the exact imported polygon indices, before cleanup.
    assignments = config.get('materialByOriginalSlot', {})
    masks = config.get('materialFaceMasks', {})
    for obj in meshes:
        old_names = [mat.name if mat else '' for mat in obj.data.materials]
        selected = [assignments.get(old_names[face.material_index], 'glass_shell')
                    if face.material_index < len(old_names) else 'glass_shell'
                    for face in obj.data.polygons]
        for region in masks.get(obj.name, []):
            if region['material'] not in materials:
                raise ValueError('Unsupported material mask')
            for index in region['faces']:
                if not 0 <= index < len(selected):
                    raise ValueError('Material mask no longer matches imported donor')
                selected[index] = region['material']
        obj.data.materials.clear()
        for name in names:
            obj.data.materials.append(materials[name])
        for face, choice in zip(obj.data.polygons, selected):
            face.material_index = names.index(choice)
    return materials


def repair_mesh(obj, options):
    """Only weld coincident import seams and remove zero-length loose edges."""
    mesh = bmesh.new()
    mesh.from_mesh(obj.data)
    before = {'vertices': len(mesh.verts), 'faces': len(mesh.faces)}
    if not options.get('skipCoincidentWeld', False):
        bmesh.ops.remove_doubles(mesh, verts=list(mesh.verts), dist=1e-7)
    wires = [edge for edge in mesh.edges if edge.is_wire and edge.calc_length() < 1e-7]
    if wires:
        bmesh.ops.delete(mesh, geom=wires, context='EDGES')
    if 'tinyBoundaryRepair' in options:
        approved = options['tinyBoundaryRepair']
        boundary = [edge for edge in mesh.edges if edge.is_boundary]
        vertices = {vertex for edge in boundary for vertex in edge.verts}
        diameter = max(((a.co-b.co).length for a in vertices for b in vertices), default=0)
        if len(boundary) != approved['edgeCount'] or diameter > approved['maxDiameterMetres']:
            raise ValueError('Actual local boundary no longer matches inspected tiny-hole repair')
        if approved.get('isolatedTriangle', False):
            linked_faces = {face for edge in boundary for face in edge.link_faces}
            if len(linked_faces) != 1 or any(len(vertex.link_faces) != 1 for vertex in vertices):
                raise ValueError('Inspected isolated triangle is no longer isolated')
            bmesh.ops.delete(mesh, geom=list(vertices), context='VERTS')
        else:
            bmesh.ops.holes_fill(mesh, edges=boundary, sides=approved['edgeCount'])
    bmesh.ops.recalc_face_normals(mesh, faces=list(mesh.faces))
    bmesh.ops.triangulate(mesh, faces=list(mesh.faces))
    bad = sum(not edge.is_manifold for edge in mesh.edges)
    after = {'vertices': len(mesh.verts), 'faces': len(mesh.faces), 'nonManifoldEdges': bad}
    mesh.to_mesh(obj.data)
    mesh.free()
    if bad:
        raise ValueError(f'{obj.name} still has {bad} nonmanifold edges; inspect and author a donor-specific repair, never fill its mouth automatically')
    target = options.get('targetTriangles')
    if target and len(obj.data.polygons) > target:
        cutter.select_only([obj])
        modifier = obj.modifiers.new('source_surface_simplification', 'DECIMATE')
        modifier.ratio = target / len(obj.data.polygons)
        modifier.use_collapse_triangulate = True
        bpy.ops.object.modifier_apply(modifier=modifier.name)
        simplified = measure(obj)
        after['simplifiedTriangles'] = simplified['triangles']
    if options.get('smoothSurface', False):
        for face in obj.data.polygons:
            face.use_smooth = True
        obj.data.set_sharp_from_angle(angle=0.9)
    if not obj.data.uv_layers:
        cutter.planar_uv(obj)
    return {'node': obj.name, 'before': before, 'after': after, 'options': options}


def measure(obj):
    mesh = bmesh.new()
    mesh.from_mesh(obj.data)
    bmesh.ops.triangulate(mesh, faces=list(mesh.faces))
    bad = sum(not edge.is_manifold for edge in mesh.edges)
    volume = mesh.calc_volume(signed=True)
    triangles = len(mesh.faces)
    mesh.to_mesh(obj.data)
    mesh.free()
    if bad:
        raise ValueError(f'{obj.name} is not closed after final triangulation')
    coords = [obj.matrix_world @ vertex.co for vertex in obj.data.vertices]
    convert = lambda point: [point.x, point.z, -point.y]
    transformed = [convert(point) for point in coords]
    return {
        'node': obj.name, 'role': obj.get('role'), 'triangles': triangles,
        'vertices': len(obj.data.vertices), 'nonManifoldEdges': bad, 'signedVolume': volume,
        'materials': [mat.name for mat in obj.data.materials],
        'bounds': {'min': [min(point[i] for point in transformed) for i in range(3)],
                   'max': [max(point[i] for point in transformed) for i in range(3)]},
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--recipe', type=Path, required=True)
    parser.add_argument('--prepare-only', action='store_true')
    args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])
    recipe = args.recipe.resolve()
    if not recipe.is_relative_to(HERE):
        raise ValueError('Keep reviewed finalization recipes in v3')
    config = json.loads(recipe.read_text())
    if not config.get('inspectionDecision'):
        raise ValueError('Record actual donor inspection findings before finalization')
    name = config['name']
    donor = inspection.ROOT / config['donor']
    directory = HERE / 'donors' / name
    source_directory = HERE / 'donors' / config.get('inspectionName', name)
    report = json.loads((source_directory / 'inspection.json').read_text())
    source_hash = hashlib.sha256(donor.read_bytes()).hexdigest()
    if config['sourceSha256'] != source_hash or report['source']['sha256'] != source_hash:
        raise ValueError('Recipe, inspected donor and source bytes must match')
    bpy.ops.wm.open_mainfile(filepath=str(source_directory / 'raw-import.blend'))
    bpy.context.preferences.filepaths.save_version = 0
    meshes = [obj for obj in bpy.context.scene.objects if obj.type == 'MESH']
    normalization = inspection.normalize(meshes, config['heightMetres'])
    materials = assign_materials(meshes, config)
    repairs = [repair_mesh(obj, config.get('repair', {})) for obj in meshes]
    prefix = config['nodePrefix']
    root = bpy.data.objects.new(prefix, None)
    bpy.context.scene.collection.objects.link(root)
    intact = meshes[0]
    for other in meshes[1:]:
        cutter.join_into(intact, other)
    intact.name = prefix + '_intact'
    intact.parent = root
    intact['role'] = 'intact'
    intact['source'] = 'Meshy donor; reviewed Blender finalization'
    bpy.ops.wm.save_as_mainfile(filepath=str(directory / 'prepared.blend'))
    if args.prepare_only:
        print('MESHY_DONOR_PREPARED=' + name)
        return
    if 'seeds' in config:
        seeds = [Vector(point) for point in config['seeds']]
    else:
        seeds = cutter.surface_seeds(intact, config.get('shardCount', 23), config.get('seed', 20260915))
    shards = cutter.fracture(intact, root, seeds, materials, config.get('resolveSelfIntersections', False))
    bpy.context.view_layer.update()
    measurements = [measure(obj) for obj in [intact, *shards]]
    whole_volume = measurements[0]['signedVolume']
    shard_volume = sum(row['signedVolume'] for row in measurements[1:])
    if whole_volume <= 0 or len(shards) > 24:
        raise ValueError('Invalid volume or fracture assembly count')
    error = abs(whole_volume - shard_volume) / whole_volume
    if error > 1e-5:
        bpy.ops.wm.save_as_mainfile(filepath=str(directory / 'fracture-diagnostic.blend'))
        (directory / 'fracture-diagnostic.json').write_text(json.dumps({'intactVolume': whole_volume,
            'shardsVolume': shard_volume, 'relativeError': error, 'meshes': measurements}, indent=2) + '\n')
        raise ValueError(f'Fragments do not reconstruct the donor volume: {error}')
    bpy.ops.wm.save_as_mainfile(filepath=str(directory / 'finalized.blend'))
    exports = HERE / 'exports'
    exports.mkdir(exist_ok=True)
    output = exports / (name + '.glb')
    cutter.select_only([root, intact, *shards])
    bpy.ops.export_scene.gltf(filepath=str(output), export_format='GLB', use_selection=True,
        export_yup=True, export_apply=True, export_extras=True, export_animations=False, export_tangents=True)
    raw = output.read_bytes()
    manifest = {
        'status': 'staged for independent export and visual validation; not runtime activated',
        'source': report['source'], 'recipe': str(recipe.relative_to(HERE)),
        'inspectionDecision': config['inspectionDecision'], 'normalization': normalization,
        'repairs': repairs, 'units': 'metres', 'up': '+Y', 'footCentred': True,
        'intact': intact.name, 'shards': [obj.name for obj in shards], 'meshes': measurements,
        'fracture': {'method': 'convex Voronoi cells intersect actual imported surfaces',
                     'seedCoordinatesBlenderZUp': [list(seed) for seed in seeds],
                     'volumeRelativeError': error},
        'bundle': {'file': str(output.relative_to(HERE)), 'bytes': len(raw),
                   'sha256': hashlib.sha256(raw).hexdigest()},
    }
    (directory / 'finalization.json').write_text(json.dumps(manifest, indent=2) + '\n')
    print('MESHY_DONOR_FINALIZED=' + json.dumps({'name': name, 'bytes': len(raw),
          'shards': len(shards), 'volumeRelativeError': error}))


if __name__ == '__main__':
    main()
