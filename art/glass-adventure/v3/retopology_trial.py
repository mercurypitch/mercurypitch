"""Retopologize the clean donor-derived shell without replacing its silhouette."""
import bpy,bmesh,sys,json,importlib.util
from pathlib import Path
from mathutils.bvhtree import BVHTree
here=Path(__file__).resolve().parent;name=sys.argv[sys.argv.index('--')+1];directory=here/'donors'/name
spec=importlib.util.spec_from_file_location('finish',here/'finalize_donor.py');finish=importlib.util.module_from_spec(spec);spec.loader.exec_module(finish)
bpy.ops.wm.open_mainfile(filepath=str(directory/'clean-voxel-trial.blend'));obj=next(o for o in bpy.context.scene.objects if o.get('role')=='intact')
vertices=[v.co.copy() for v in obj.data.vertices];faces=[tuple(p.vertices) for p in obj.data.polygons];tree=BVHTree.FromPolygons(vertices,faces,all_triangles=True)
finish.cutter.select_only([obj]);bpy.ops.object.quadriflow_remesh(use_mesh_symmetry=False,use_preserve_sharp=False,use_preserve_boundary=True,preserve_attributes=False,smooth_normals=True,mode='FACES',target_faces=50000,seed=11)
print('QUADRIFLOW_POLYGONS='+str(len(obj.data.polygons)),flush=True)
bm=bmesh.new();bm.from_mesh(obj.data);bmesh.ops.triangulate(bm,faces=list(bm.faces));bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.faces.ensure_lookup_table();target=BVHTree.FromBMesh(bm)
pairs=[(a,b) for a,b in target.overlap(target) if a<b and not set(bm.faces[a].verts)&set(bm.faces[b].verts)]
forward=[tree.find_nearest(v.co)[3] for v in list(bm.verts)[::max(1,len(bm.verts)//4000)]];reverse=[target.find_nearest(v)[3] for v in vertices[::max(1,len(vertices)//4000)]]
report={'operation':'Blender QuadriFlow on clean Meshy-derived shell','targetQuads':50000,'triangles':len(bm.faces),'selfIntersectionPairs':len(pairs),'badEdges':sum(not e.is_manifold for e in bm.edges),'signedVolume':bm.calc_volume(signed=True),'sampledMaxDistanceToCleanMetres':max(forward),'sampledMaxDistanceFromCleanMetres':max(reverse)}
bm.to_mesh(obj.data);bm.free();finish.cutter.planar_uv(obj);(directory/'retopology-trial.json').write_text(json.dumps(report,indent=2)+'\n');bpy.ops.wm.save_as_mainfile(filepath=str(directory/'retopology-trial.blend'));print('RETOPOLOGY_TRIAL='+json.dumps(report))
