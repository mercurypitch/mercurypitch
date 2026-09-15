"""Gate the inspected amphora LOD without changing its retained ornament or cavity."""
import importlib.util
import json
from pathlib import Path
import bpy

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('solid', HERE.parents[1] / 'solid_fracture.py')
solid = importlib.util.module_from_spec(spec)
spec.loader.exec_module(solid)
bpy.ops.wm.open_mainfile(filepath=str(HERE / 'fine-060-lod100k.blend'))
bpy.context.preferences.filepaths.save_version = 0
obj = bpy.data.objects['vase_amphora_intact']
removed = solid.remove_collapsed_components(obj)
check = solid.mesh_check(obj)
if any(check[key] for key in ['nonManifoldEdges', 'nonManifoldVertices',
    'nonContiguousEdges', 'selfIntersectionPairs', 'blenderMeshInvalid']):
    raise ValueError(check)
report = {
    'status': 'inspected geometry; material and fracture gates pending',
    'source': 'fine-060-lod100k.blend',
    'mesh': check,
    'removedCollapsedComponents': removed,
    'visualReview': 'Matched raw/clay three-quarter and mouth renders preserve the silhouette, open handles, cavity, fluting and laurel relief. The 0.6mm cleanup is visibly closer than rejected 1.2mm. Small foot beading and recesses remain softer than the high source.',
    'fidelityReport': 'source-fidelity-fine-060-lod100k.json',
    'sourceDeviation': 'p95 0.509mm, p99 1.992mm; worst 10.176mm includes narrow handle/relief recesses. This is a source-derived cleanup, not an exact source copy.',
}
(HERE / 'reviewed-shell.json').write_text(json.dumps(report, indent=2) + '\n')
bpy.ops.wm.save_as_mainfile(filepath=str(HERE / 'reviewed-shell.blend'))
print('AMPHORA_REVIEWED_SHELL=' + json.dumps(report), flush=True)
