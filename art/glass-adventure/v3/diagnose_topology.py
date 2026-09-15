"""Locate remaining donor topology defects after a diagnostic coincident-seam weld."""
import argparse
import importlib.util
import json
from pathlib import Path
import sys

import bmesh
import bpy

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('intake', HERE / 'inspect_donor.py')
intake = importlib.util.module_from_spec(spec)
spec.loader.exec_module(intake)

parser = argparse.ArgumentParser()
parser.add_argument('--name', required=True)
args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:])
directory = HERE / 'donors' / args.name
report = json.loads((directory / 'inspection.json').read_text())
bpy.ops.wm.open_mainfile(filepath=str(directory / 'raw-import.blend'))
meshes = [obj for obj in bpy.context.scene.objects if obj.type == 'MESH']
intake.normalize(meshes, report['proposedTargetHeightMetres'])
results = []
for obj in meshes:
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bmesh.ops.remove_doubles(bm, verts=list(bm.verts), dist=1e-7)
    bm.verts.index_update()
    bm.faces.index_update()
    edges = []
    for edge in bm.edges:
        if edge.is_manifold:
            continue
        edges.append({'vertices': [vertex.index for vertex in edge.verts],
                      'coordinatesMetres': [list(vertex.co) for vertex in edge.verts],
                      'lengthMetres': edge.calc_length(), 'faceCount': len(edge.link_faces),
                      'faces': [{'index': face.index, 'area': face.calc_area(), 'normal': list(face.normal)} for face in edge.link_faces]})
    # Diagnostic geometry is a separate file, with bad edges selected for inspection.
    for edge in bm.edges:
        edge.select = not edge.is_manifold
    bm.to_mesh(obj.data)
    results.append({'node': obj.name, 'edges': edges})
    bm.free()
(directory / 'topology-diagnostic.json').write_text(json.dumps(results, indent=2) + '\n')
bpy.ops.wm.save_as_mainfile(filepath=str(directory / 'topology-diagnostic.blend'))
for item in results:
    counts = {}
    for edge in item['edges']:
        key = str(edge['faceCount'])
        counts[key] = counts.get(key, 0) + 1
    print('TOPOLOGY_DIAGNOSTIC=' + json.dumps({'node': item['node'], 'edgesByFaceCount': counts,
          'shortestEdge': min(edge['lengthMetres'] for edge in item['edges']) if item['edges'] else 0,
          'longestEdge': max(edge['lengthMetres'] for edge in item['edges']) if item['edges'] else 0}))
