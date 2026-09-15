"""Run an isolated fracture diagnostic against the current prepared donor."""
import bpy,bmesh,json,sys,importlib.util
from pathlib import Path
here=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('cut',here/'fracture.py');cut=importlib.util.module_from_spec(spec);spec.loader.exec_module(cut)
name=sys.argv[sys.argv.index('--')+1];directory=here/'donors'/name
bpy.ops.wm.open_mainfile(filepath=str(directory/'prepared.blend'));o=next(o for o in bpy.context.scene.objects if o.get('role')=='intact')
shards=cut.fracture(o,o.parent,cut.surface_seeds(o,23),{m:bpy.data.materials[m] for m in ['glass_shell','glass_cut','gold_trim']},self_intersections=True)
def measure(o):
 b=bmesh.new();b.from_mesh(o.data);bmesh.ops.triangulate(b,faces=list(b.faces));v=b.calc_volume(signed=True);bad=sum(not e.is_manifold for e in b.edges);b.to_mesh(o.data);b.free();return {'name':o.name,'volume':v,'bad':bad,'triangles':len(o.data.polygons)}
r=[measure(o) for o in [o,*shards]];error=abs(r[0]['volume']-sum(s['volume'] for s in r[1:]))/r[0]['volume'];report={'relativeError':error,'meshes':r}
(directory/'fracture-diagnostic.json').write_text(json.dumps(report,indent=2)+'\n');bpy.ops.wm.save_as_mainfile(filepath=str(directory/'fracture-diagnostic.blend'));print('FRACTURE_DIAGNOSTIC='+json.dumps({'relativeError':error,'badEdges':sum(s['bad'] for s in r)}))
