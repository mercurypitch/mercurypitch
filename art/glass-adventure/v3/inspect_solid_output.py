"""Inspect source-surface solid reduction, retaining failed candidates as diagnostics."""
import bpy,bmesh,sys,json,importlib.util,numpy as np
from pathlib import Path
from mathutils.bvhtree import BVHTree
here=Path(__file__).resolve().parent;name=sys.argv[sys.argv.index('--')+1];filename=sys.argv[sys.argv.index('--')+2];directory=here/'donors'/name
spec=importlib.util.spec_from_file_location('finish',here/'finalize_donor.py');finish=importlib.util.module_from_spec(spec);spec.loader.exec_module(finish)
bpy.ops.wm.open_mainfile(filepath=str(directory/'prepared.blend'));obj=next(o for o in bpy.context.scene.objects if o.get('role')=='intact');result=np.load(directory/filename)
data=bpy.data.meshes.new('solid_reduction');data.from_pydata(result['intact_vertices'].tolist(),[],result['intact_faces'].tolist());data.update()
for material in obj.data.materials:data.materials.append(material)
obj.data=data
for face in data.polygons:face.use_smooth=True
finish.cutter.planar_uv(obj)
vertices=[v.co.copy() for v in data.vertices];faces=[tuple(p.vertices) for p in data.polygons];tree=BVHTree.FromPolygons(vertices,faces,all_triangles=True)
pairs=[(a,b) for a,b in tree.overlap(tree) if a<b and not set(faces[a])&set(faces[b])]
report={'sourceNpz':filename,'overlaps':len(pairs),'pairs':pairs[:100],'measure':finish.measure(obj)}
(directory/Path(filename).with_suffix('.inspection.json')).write_text(json.dumps(report,indent=2)+'\n');bpy.ops.wm.save_as_mainfile(filepath=str(directory/Path(filename).with_suffix('.blend')));print('SOLID_INSPECTION='+json.dumps({k:v for k,v in report.items() if k!='pairs'}))
