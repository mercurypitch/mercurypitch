"""Measure robust solid clipping of an unchanged prepared Meshy surface."""
import sys,json,importlib.util,subprocess,os
from pathlib import Path
import bpy,bmesh,numpy as np
here=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('cut',here/'fracture.py');cut=importlib.util.module_from_spec(spec);spec.loader.exec_module(cut)
name=sys.argv[sys.argv.index('--')+1];directory=here/'donors'/name
bpy.ops.wm.open_mainfile(filepath=str(directory/'prepared.blend'))
obj=next(o for o in bpy.context.scene.objects if o.get('role')=='intact')
vertices=np.array([list(v.co) for v in obj.data.vertices],dtype=np.float32)
faces=np.array([list(p.vertices) for p in obj.data.polygons],dtype=np.uint32)
shards=[];rows=[];seeds=cut.surface_seeds(obj,23)
input_path=directory/'manifold-input.npz';output_path=directory/'manifold-output.npz'
np.savez_compressed(input_path,vertices=vertices,faces=faces,seeds=np.array([list(s) for s in seeds]))
environment=dict(os.environ);environment['PYTHONPATH']='/tmp/glass-museum-manifold'
subprocess.run(['/usr/bin/python3',str(here/'solid_backend.py'),str(input_path),str(output_path)],env=environment,check=True,timeout=120)
result=np.load(output_path)
whole=bmesh.new();whole.from_mesh(obj.data);whole_volume=whole.calc_volume(signed=True);whole.free()
for index in range(len(seeds)):
    key=f'shard_{index:03d}'
    if key+'_vertices' not in result:continue
    data=bpy.data.meshes.new('solid_clip');data.from_pydata(result[key+'_vertices'].tolist(),[],result[key+'_faces'].tolist());data.update()
    piece=bpy.data.objects.new(f'{obj.parent.name}_shard_{index:03d}',data);bpy.context.scene.collection.objects.link(piece);piece.parent=obj.parent
    piece.data.materials.append(bpy.data.materials['glass_shell']);piece['role']='shard';piece.hide_render=True
    bm=bmesh.new();bm.from_mesh(data);bad=sum(not e.is_manifold for e in bm.edges);volume=bm.calc_volume(signed=True);bm.free()
    rows.append({'index':index,'triangles':len(data.polygons),'badEdges':bad,'signedVolume':volume})
    cut.center_geometry(piece);cut.planar_uv(piece);shards.append(piece)
    print('CELL='+json.dumps(rows[-1]),flush=True)
report={'method':'manifold3d 3.5.3 plane clipping, actual unchanged prepared vertices','sourceTriangles':len(faces),'intactVolume':whole_volume,'volumeRelativeError':abs(whole_volume-sum(r['signedVolume'] for r in rows))/whole_volume,'badEdges':sum(r['badEdges'] for r in rows),'shards':rows}
(directory/'manifold-trial.json').write_text(json.dumps(report,indent=2)+'\n')
bpy.ops.wm.save_as_mainfile(filepath=str(directory/'manifold-trial.blend'))
print('MANIFOLD_TRIAL='+json.dumps({k:v for k,v in report.items() if k!='shards'}))
