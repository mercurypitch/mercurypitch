"""Evaluate tolerance-based reduction of the genuine high-detail Meshy source."""
import sys,json,importlib.util,subprocess,os
from pathlib import Path
import bpy,bmesh,numpy as np
from mathutils.bvhtree import BVHTree
here=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('finish',here/'finalize_donor.py');finish=importlib.util.module_from_spec(spec);spec.loader.exec_module(finish)
name=sys.argv[sys.argv.index('--')+1];directory=here/'donors'/name;config=json.loads((directory/'recipe.json').read_text())
bpy.ops.wm.open_mainfile(filepath=str(here/'donors'/config['inspectionName']/'raw-import.blend'))
objects=[o for o in bpy.context.scene.objects if o.type=='MESH'];transform=finish.inspection.normalize(objects,config['heightMetres']);materials=finish.assign_materials(objects,config)
repair=dict(config['repair']);repair.pop('targetTriangles',None)
for obj in objects:finish.repair_mesh(obj,repair)
obj=objects[0]
vertices=np.array([list(v.co) for v in obj.data.vertices],dtype=np.float32);faces=np.array([list(p.vertices) for p in obj.data.polygons],dtype=np.uint32)
def overlaps(vertices,faces):
    tree=BVHTree.FromPolygons(vertices.tolist(),faces.tolist(),all_triangles=True)
    pairs=[(a,b) for a,b in tree.overlap(tree) if a<b and not set(faces[a])&set(faces[b])]
    return tree,pairs
source_tree,source_pairs=overlaps(vertices,faces)
print('HIGH_SOURCE_OVERLAPS='+str(len(source_pairs)),flush=True)
input_path=directory/'solid-source-input.npz';output_path=directory/'solid-source-output.npz'
np.savez_compressed(input_path,vertices=vertices,faces=faces)
environment=dict(os.environ);environment['PYTHONPATH']='/tmp/glass-museum-manifold'
subprocess.run(['/usr/bin/python3',str(here/'solid_backend.py'),str(input_path),str(output_path),'--simplify','.00005'],env=environment,check=True,timeout=120)
result=np.load(output_path);v=result['intact_vertices'];f=result['intact_faces'];tree,pairs=overlaps(v,f)
data=bpy.data.meshes.new('source_solid');data.from_pydata(v.tolist(),[],f.tolist());data.update();obj.data=data
for material in materials.values():data.materials.append(material)
root=bpy.data.objects.new(config['nodePrefix'],None);bpy.context.scene.collection.objects.link(root);obj.parent=root;obj.name=root.name+'_intact';obj['role']='intact'
for p in data.polygons:p.use_smooth=True
finish.cutter.planar_uv(obj)
samples=range(0,len(v),max(1,len(v)//4000));forward=[source_tree.find_nearest(v[i])[3] for i in samples]
samples=range(0,len(vertices),max(1,len(vertices)//4000));reverse=[tree.find_nearest(vertices[i])[3] for i in samples]
report={'sourcePairs':len(source_pairs),'reducedPairs':len(pairs),'triangles':len(f),'simplifyToleranceMetres':.00005,'transform':transform,'maxDistanceToSourceMetres':max(forward),'maxDistanceFromSourceMetres':max(reverse),'measurement':finish.measure(obj)}
(directory/'solid-source-trial.json').write_text(json.dumps(report,indent=2)+'\n');bpy.ops.wm.save_as_mainfile(filepath=str(directory/'solid-source-trial.blend'))
print('SOLID_SOURCE_TRIAL='+json.dumps(report),flush=True)
