"""Measure actual finalized surface deviation from its normalized Meshy source."""
import argparse,bpy,json,sys,importlib.util,hashlib,numpy as np
from pathlib import Path
from mathutils.bvhtree import BVHTree
HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('inspect_source',HERE/'inspect_donor.py');inspection=importlib.util.module_from_spec(spec);spec.loader.exec_module(inspection)
parser=argparse.ArgumentParser();parser.add_argument('--family',required=True);args=parser.parse_args(sys.argv[sys.argv.index('--')+1:]);directory=HERE/'donors'/args.family
recipe=json.loads((directory/'recipe.json').read_text());bpy.ops.wm.open_mainfile(filepath=str(directory/'finalized.blend'));final=bpy.data.objects[recipe['nodePrefix']+'_intact']
positions=[final.matrix_world@v.co for v in final.data.vertices];faces=[tuple(p.vertices) for p in final.data.polygons];tree=BVHTree.FromPolygons(positions,faces,all_triangles=True)
before=set(bpy.data.objects);source=inspection.ROOT/recipe['donor']
if hashlib.sha256(source.read_bytes()).hexdigest()!=recipe['sourceSha256']:raise ValueError('Original donor bytes changed')
bpy.ops.import_scene.gltf(filepath=str(source));sources=[o for o in bpy.data.objects if o not in before and o.type=='MESH'];normalization=inspection.normalize(sources,recipe['heightMetres']);bpy.context.view_layer.update()
v=[];f=[]
for obj in sources:
    offset=len(v);v.extend(obj.matrix_world@p.co for p in obj.data.vertices);f.extend(tuple(offset+i for i in p.vertices) for p in obj.data.polygons)
original=BVHTree.FromPolygons(v,f,all_triangles=True)
def distances(points,target):
    rows=[{'point':list(p),'metres':target.find_nearest(p)[3]} for p in points[::max(1,len(points)//10000)]];values=[r['metres'] for r in rows]
    return {'sampleCount':len(rows),'maxMetres':max(values),'p95Metres':float(np.quantile(values,.95)),'p99Metres':float(np.quantile(values,.99)),'worstSamples':sorted(rows,key=lambda r:-r['metres'])[:10]}
report={'method':'bidirectional nearest-surface distances on deterministic vertex samples; not an exact Hausdorff bound','source':recipe['donor'],'sourceSha256':recipe['sourceSha256'],'normalization':normalization,'finalToOriginal':distances(positions,original),'originalToFinal':distances(v,tree)}
(directory/'final-fidelity.json').write_text(json.dumps(report,indent=2)+'\n');print('FINAL_FIDELITY='+json.dumps({k:{s:x for s,x in report[k].items() if s!='worstSamples'} for k in ['finalToOriginal','originalToFinal']}))
