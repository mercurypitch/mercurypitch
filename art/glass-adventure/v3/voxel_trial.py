"""Evaluate sub-millimetre cleanup of an actual donor surface, without activation."""
import bpy,bmesh,json,sys
from pathlib import Path
from mathutils.bvhtree import BVHTree
from mathutils import Vector
name=sys.argv[sys.argv.index('--')+1];directory=Path(__file__).resolve().parent/'donors'/name
bpy.ops.wm.open_mainfile(filepath=str(directory/'prepared.blend'));o=next(o for o in bpy.context.scene.objects if o.get('role')=='intact')
bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o
original=[v.co.copy() for v in o.data.vertices]; originalfaces=[tuple(p.vertices) for p in o.data.polygons];tree=BVHTree.FromPolygons(original,originalfaces,all_triangles=True)
o.data.remesh_voxel_size=.0006;o.data.use_remesh_preserve_volume=True;bpy.ops.object.voxel_remesh()
remeshed=len(o.data.polygons)
b=bmesh.new();b.from_mesh(o.data);bmesh.ops.triangulate(b,faces=list(b.faces));b.to_mesh(o.data);b.free()
modifier=o.modifiers.new('surface_lod','DECIMATE');modifier.ratio=min(1,50000/len(o.data.polygons));modifier.use_collapse_triangulate=True;bpy.ops.object.modifier_apply(modifier=modifier.name)
b=bmesh.new();b.from_mesh(o.data);bmesh.ops.triangulate(b,faces=list(b.faces));bmesh.ops.recalc_face_normals(b,faces=list(b.faces));b.faces.ensure_lookup_table();target=BVHTree.FromBMesh(b)
pairs=[(a,c) for a,c in target.overlap(target) if a<c and not (set(b.faces[a].verts)&set(b.faces[c].verts))]
forward=[tree.find_nearest(v.co)[3] for v in list(b.verts)[::max(1,len(b.verts)//4000)]]
reverse=[target.find_nearest(v)[3] for v in original[::max(1,len(original)//4000)]]
report={'voxelMetres':.0006,'remeshedPolygons':remeshed,'triangles':len(b.faces),'badEdges':sum(not e.is_manifold for e in b.edges),'overlaps':len(pairs),'sampledMaxDistanceToOriginal':max(forward),'sampledMaxDistanceFromOriginal':max(reverse),'volume':b.calc_volume(signed=True)}
b.to_mesh(o.data);b.free();(directory/'voxel-trial.json').write_text(json.dumps(report,indent=2)+'\n');bpy.ops.wm.save_as_mainfile(filepath=str(directory/'voxel-trial.blend'));print('VOXEL_TRIAL='+json.dumps(report))
