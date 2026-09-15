"""Inspect a real Meshy donor and preserve its untouched imported Blender scene."""

import argparse
import hashlib
import json
import math
from pathlib import Path
import sys

import bmesh
import bpy
from mathutils import Matrix, Vector
from mathutils.bvhtree import BVHTree

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]


def arguments():
    parser = argparse.ArgumentParser()
    parser.add_argument('--name', required=True)
    parser.add_argument('--donor', type=Path, required=True)
    parser.add_argument('--height', type=float, required=True)
    parser.add_argument('--render', action='store_true')
    return parser.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])


def load(donor, name):
    if not name or any(c not in 'abcdefghijklmnopqrstuvwxyz0123456789-_' for c in name):
        raise ValueError('Use a simple donor name')
    donor = donor.resolve()
    if not donor.is_relative_to(ROOT / 'art/glass-adventure') or donor.suffix != '.glb':
        raise ValueError('Inspect an actual local art donor GLB')
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.import_scene.gltf(filepath=str(donor))
    meshes = [obj for obj in bpy.context.scene.objects if obj.type == 'MESH']
    if not meshes:
        raise ValueError('Donor contains no meshes')
    directory = HERE / 'donors' / name
    directory.mkdir(parents=True, exist_ok=True)
    imported = directory / 'raw-import.blend'
    provenance = directory / 'source.json'
    source = {'sha256': hashlib.sha256(donor.read_bytes()).hexdigest(), 'file': str(donor.relative_to(ROOT)), 'bytes': donor.stat().st_size}
    if imported.exists():
        if not provenance.exists() or json.loads(provenance.read_text())['sha256'] != source['sha256']:
            raise ValueError('Do not replace a previously inspected donor with different source bytes')
    else:
        provenance.write_text(json.dumps(source, indent=2) + '\n')
        # Saved before repair, normalization, material replacement or studio setup.
        bpy.ops.wm.save_as_mainfile(filepath=str(imported))
    return donor, directory, meshes


def bounds(meshes):
    coordinates = [obj.matrix_world @ vertex.co for obj in meshes for vertex in obj.data.vertices]
    lo = Vector(tuple(min(v[axis] for v in coordinates) for axis in range(3)))
    hi = Vector(tuple(max(v[axis] for v in coordinates) for axis in range(3)))
    return lo, hi


def topology(obj, weld=0):
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    if weld:
        bmesh.ops.remove_doubles(bm, verts=list(bm.verts), dist=weld)
    remaining = set(bm.verts)
    components = []
    while remaining:
        pending = [remaining.pop()]
        vertices = set(pending)
        while pending:
            current = pending.pop()
            for edge in current.link_edges:
                other = edge.other_vert(current)
                if other in remaining:
                    remaining.remove(other)
                    vertices.add(other)
                    pending.append(other)
        faces = {face for vertex in vertices for face in vertex.link_faces}
        components.append({'vertices': len(vertices), 'faces': len(faces)})
    row = {
        'node': obj.name,
        'vertices': len(bm.verts),
        'polygons': len(bm.faces),
        'triangles': sum(len(face.verts) - 2 for face in bm.faces),
        'boundaryEdges': sum(edge.is_boundary for edge in bm.edges),
        'nonManifoldEdges': sum(not edge.is_manifold for edge in bm.edges),
        'wireEdges': sum(edge.is_wire for edge in bm.edges),
        'zeroAreaFaces': sum(face.calc_area() < 1e-14 for face in bm.faces),
        'connectedComponentCount': len(components),
        'largestConnectedComponents': sorted(components, key=lambda item: -item['vertices'])[:20],
        'signedLocalVolume': bm.calc_volume(signed=True),
        'uvLayers': [layer.name for layer in obj.data.uv_layers],
        'materials': [mat.name if mat else None for mat in obj.data.materials],
        'materialFaceCounts': {},
    }
    for face in bm.faces:
        key = str(face.material_index)
        row['materialFaceCounts'][key] = row['materialFaceCounts'].get(key, 0) + 1
    bm.free()
    return row


def vertical_rays(meshes, lo, hi, target_height):
    """Measure all centre-region surfaces; classification remains a reviewed decision."""
    positions = []
    faces = []
    offset = 0
    for obj in meshes:
        positions.extend(obj.matrix_world @ vertex.co for vertex in obj.data.vertices)
        faces.extend(tuple(offset + vertex for vertex in polygon.vertices) for polygon in obj.data.polygons)
        offset += len(obj.data.vertices)
    tree = BVHTree.FromPolygons(positions, faces, all_triangles=False)
    source_height = hi.z - lo.z
    scale = target_height / source_height
    samples = []
    for x_fraction, y_fraction in [(0, 0), (.04, 0), (-.04, 0), (0, .04), (0, -.04)]:
        x = (lo.x + hi.x) / 2 + x_fraction * (hi.x - lo.x)
        y = (lo.y + hi.y) / 2 + y_fraction * (hi.y - lo.y)
        start = Vector((x, y, hi.z + source_height * .1))
        hits = []
        for _ in range(40):
            point, normal, index, _ = tree.ray_cast(start, Vector((0, 0, -1)), source_height * 1.3)
            if point is None:
                break
            hits.append({'heightMetres': (point.z - lo.z) * scale, 'normalZ': normal.z, 'face': index})
            start = point - Vector((0, 0, source_height * 1e-6))
        samples.append({'offsetFractionOfBounds': [x_fraction, y_fraction], 'hits': hits})
    return samples


def inspect(donor, meshes, target_height):
    lo, hi = bounds(meshes)
    if not 0.1 <= target_height <= 2 or hi.z - lo.z < 1e-8:
        raise ValueError('Invalid physical height')
    materials = []
    for material in bpy.data.materials:
        textures = []
        if material.use_nodes:
            textures = [{'node': node.name, 'image': node.image.name, 'size': list(node.image.size)}
                        for node in material.node_tree.nodes if node.type == 'TEX_IMAGE' and node.image]
        materials.append({'name': material.name, 'textures': textures})
    print('DONOR_INSPECTION_PHASE=topology', flush=True)
    raw_topology = [topology(obj) for obj in meshes]
    print('DONOR_INSPECTION_PHASE=seam-diagnostic', flush=True)
    weld_diagnostic = [topology(obj, 1e-7 / (target_height / (hi.z-lo.z))) for obj in meshes
                       if len(obj.data.vertices) < 250000]
    print('DONOR_INSPECTION_PHASE=cavity-rays', flush=True)
    rays = vertical_rays(meshes, lo, hi, target_height)
    return {
        'status': 'inspection-only; no finalization acceptance implied',
        'blenderVersion': bpy.app.version_string,
        'source': {'file': str(donor.relative_to(ROOT)), 'bytes': donor.stat().st_size,
                   'sha256': hashlib.sha256(donor.read_bytes()).hexdigest(), 'generator': 'Meshy'},
        'boundsInImportedBlenderCoordinates': {'min': list(lo), 'max': list(hi)},
        'proposedTargetHeightMetres': target_height,
        'uniformNormalizationScale': target_height / (hi.z - lo.z),
        'meshes': raw_topology,
        'afterCoincidentSeamWeldDiagnostic': weld_diagnostic,
        'seamDiagnosticScope': 'Meshes under250k vertices; continuous high-detail sources assessed through original topology',
        'materials': materials,
        'verticalCentreRegionRays': rays,
        'decisionsPending': ['silhouette and front orientation', 'mouth and cavity classification',
                             'gold versus glass surface regions', 'topology repair, if necessary',
                             'closed fracture feasibility and appropriate piece count'],
    }


def normalize(meshes, height):
    lo, hi = bounds(meshes)
    scale = height / (hi.z - lo.z)
    origin = Vector(((lo.x + hi.x) / 2, (lo.y + hi.y) / 2, lo.z))
    # Bake one common transform into actual donor vertices; preserve every surface.
    original_world = {obj: obj.matrix_world.copy() for obj in meshes}
    for obj in meshes:
        world = original_world[obj]
        obj.parent = None
        obj.matrix_world = Matrix.Identity(4)
        for vertex in obj.data.vertices:
            vertex.co = (world @ vertex.co - origin) * scale
        obj.data.update()
    return {'uniformScale': scale, 'sourceFootCentre': list(origin)}


def review_render(meshes, directory, height):
    normalize(meshes, height)
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.samples = 24
    scene.cycles.use_denoising = True
    scene.render.resolution_x = 900
    scene.render.resolution_y = 1100
    scene.render.resolution_percentage = 100
    material = bpy.data.materials.new('inspection_clay_only')
    material.diffuse_color = (.45, .49, .50, 1)
    material.use_nodes = True
    principled = material.node_tree.nodes.get('Principled BSDF')
    principled.inputs['Base Color'].default_value = (.45, .49, .50, 1)
    principled.inputs['Roughness'].default_value = .56
    for obj in meshes:
        obj.data.materials.clear()
        obj.data.materials.append(material)
        for face in obj.data.polygons:
            face.material_index = 0
    scene.world = bpy.data.worlds.new('inspection_world')
    scene.world.color = (.08, .08, .08)
    for name, position, power in [('key', (-2, -3, 4), 450), ('fill', (3, -1, 2), 180), ('rim', (0, 3, 3), 500)]:
        light = bpy.data.lights.new(name, 'AREA')
        light.energy = power * height * height
        light.size = height * 2
        obj = bpy.data.objects.new(name, light)
        scene.collection.objects.link(obj)
        obj.location = Vector(position) * height
        obj.rotation_euler = (Vector((0, 0, height * .5)) - obj.location).to_track_quat('-Z', 'Y').to_euler()
    bpy.ops.object.camera_add()
    camera = bpy.context.object
    camera.data.type = 'ORTHO'
    lo, hi = bounds(meshes)
    camera.data.ortho_scale = max(height * 1.24, (hi.x - lo.x) * 1.5, (hi.y - lo.y) * 1.5)
    scene.camera = camera
    scene.view_settings.view_transform = 'AgX'
    for name, position in [('front', (0, -3, .85)), ('three-quarter', (2, -3, 1.3)), ('mouth', (0, -1.3, 3.4))]:
        camera.location = Vector(position) * height
        camera.rotation_euler = (Vector((0, 0, height * .5)) - camera.location).to_track_quat('-Z', 'Y').to_euler()
        scene.render.filepath = str(directory / ('inspection-' + name + '.png'))
        bpy.ops.render.render(write_still=True)


def main():
    args = arguments()
    donor, directory, meshes = load(args.donor, args.name)
    report = inspect(donor, meshes, args.height)
    (directory / 'inspection.json').write_text(json.dumps(report, indent=2) + '\n')
    print('MESHY_DONOR_INSPECTED=' + json.dumps({'name': args.name, 'meshes': len(meshes),
          'triangles': sum(row['triangles'] for row in report['meshes']),
          'nonManifoldEdges': sum(row['nonManifoldEdges'] for row in report['meshes']),
          'report': str(directory / 'inspection.json')}))
    if args.render:
        review_render(meshes, directory, args.height)


if __name__ == '__main__':
    main()
