"""Apply inspected amphora gold regions to the exact validated source-derived shell."""
import gzip
import hashlib
import importlib.util
import json
from pathlib import Path
import bpy
import numpy as np

HERE = Path(__file__).resolve().parent
V3 = HERE.parents[1]
PROOF = V3 / 'material-regions/moon-amphora/proof-v3'
spec = importlib.util.spec_from_file_location('solid', V3 / 'solid_fracture.py')
solid = importlib.util.module_from_spec(spec)
spec.loader.exec_module(solid)
source = HERE / 'reviewed-shell.blend'
summary = json.loads((PROOF / 'summary.json').read_text())
if hashlib.sha256(source.read_bytes()).hexdigest() != summary['targetBlendSha256']:
    raise ValueError('Material face labels belong to a different geometry revision')
report = json.load(gzip.open(PROOF / 'face-labels.json.gz', 'rt'))['vase_amphora_intact']
bpy.ops.wm.open_mainfile(filepath=str(source))
bpy.context.preferences.filepaths.save_version = 0
obj = bpy.data.objects['vase_amphora_intact']
if len(report['faces']) != len(obj.data.polygons):
    raise ValueError('Incomplete source-face coverage')
names = [material.name for material in obj.data.materials]
swatches = {key: np.array(values) for key, values in summary['swatchesSrgb'].items()}
swatches = {key: values / np.sum(values, axis=1)[:, None] for key, values in swatches.items()}
resolved = []
counts = {'glass_shell': 0, 'gold_trim': 0}
for row in report['faces']:
    name = row['material']
    if name is None:
        # Explicit inspected boundary decision: the source correspondence passes
        # on all 690 weak-color faces. Both diagnostic views show these around
        # original gold handles, laurel/collar and foot boundaries, rather than
        # missing source areas. Preserve their closest donor color class; do not
        # expand a world-space gold band or modify any confident glass face.
        if row['reasons'] != ['ambiguous-source-color'] or row['distanceMetres'] > .0015:
            raise ValueError('An unreviewed source ambiguity needs inspection')
        rgb = np.array(row['sourceRgbSrgb'])
        chroma = rgb / rgb.sum()
        distances = {key: float(np.min(np.linalg.norm(values - chroma, axis=1)))
                     for key, values in swatches.items()}
        name = 'gold_trim' if distances['gold'] < distances['glass'] else 'glass_shell'
        resolved.append({'face': row['face'], 'material': name,
                         'sourceRgbSrgb': row['sourceRgbSrgb'], 'classDistances': distances})
    obj.data.polygons[row['face']].material_index = names.index(name)
    obj.data.polygons[row['face']].use_smooth = True
    counts[name] += 1
foot = min(vertex.co.z for vertex in obj.data.vertices)
for vertex in obj.data.vertices:
    vertex.co.z -= foot
obj.data.update()
solid.cut.planar_uv(obj)
check = solid.mesh_check(obj)
if any(check[key] for key in ['nonManifoldEdges', 'nonManifoldVertices',
    'nonContiguousEdges', 'selfIntersectionPairs', 'blenderMeshInvalid']):
    raise ValueError(check)
result = {'status': 'prepared; physical material and fracture proof pending',
          'mesh': check, 'materialFaceCounts': counts,
          'sourceProjection': str(PROOF.relative_to(V3)),
          'boundaryDecision': 'Reviewed diagnostic front/back: preserve closest source color only for weak-color boundary faces. No low-confidence geometric correspondence is accepted, and all confident faces remain unchanged.',
          'resolvedWeakColorFaces': len(resolved), 'unresolvedFaces': 0,
          'footTranslationMetres': -foot,
          'geometryChanged': 'Only recorded standing offset; no source vertices or UV charts modified for material assignment.'}
(HERE / 'ready-intact.json').write_text(json.dumps(result, indent=2) + '\n')
with gzip.open(HERE / 'resolved-material-boundaries.json.gz', 'wt') as handle:
    json.dump(resolved, handle, separators=(',', ':'))
bpy.ops.wm.save_as_mainfile(filepath=str(HERE / 'ready-intact.blend'))
print('AMPHORA_MATERIALS=' + json.dumps(result), flush=True)
