"""Evaluate a smaller coupe LOD from the validated clean100k donor-derived mesh."""
import bpy,bmesh,sys,json,importlib.util
from pathlib import Path
from mathutils.bvhtree import BVHTree
here=Path(__file__).resolve().parent;name='aurora-coupe';directory=here/'donors'/name
spec=importlib.util.spec_from_file_location('finish',here/'finalize_donor.py');finish=importlib.util.module_from_spec(spec);spec.loader.exec_module(finish)
bpy.ops.wm.open_mainfile(filepath=str(directory/'clean-surface-lod.blend'));obj=next(o for o in bpy.context.scene.objects if o.get('role')=='intact')
vertices=[v.co.copy() for v in obj.data.vertices];faces=[tuple(p.vertices) for p in obj.data.polygons];tree=BVHTree.FromPolygons(vertices,faces,all_triangles=True)
finish.cutter.select_only([obj]);modifier=obj.modifiers.new('review_lod','DECIMATE');modifier.ratio=min(1,100000/len(obj.data.polygons));modifier.use_collapse_triangulate=True;bpy.ops.object.modifier_apply(modifier=modifier.name)
bm=bmesh.new();bm.from_mesh(obj.data);bmesh.ops.triangulate(bm,faces=list(bm.faces));bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.faces.ensure_lookup_table();target=BVHTree.FromBMesh(bm)
pairs=[(a,b) for a,b in target.overlap(target) if a<b and not set(bm.faces[a].verts)&set(bm.faces[b].verts)]
forward=[tree.find_nearest(v.co)[3] for v in list(bm.verts)[::max(1,len(bm.verts)//4000)]];reverse=[target.find_nearest(v)[3] for v in vertices[::max(1,len(vertices)//4000)]]
report={'operation':'one conservative 100k triangle LOD from the cleaned actual donor','targetTriangles':100000,'triangles':len(bm.faces),'selfIntersectionPairs':len(pairs),'badEdges':sum(not e.is_manifold for e in bm.edges),'badVertices':sum(not v.is_manifold for v in bm.verts),'nonContiguousEdges':sum(not e.is_contiguous for e in bm.edges),'signedVolume':bm.calc_volume(signed=True),'sampledMaxDistanceToCleanMetres':max(forward),'sampledMaxDistanceFromCleanMetres':max(reverse)}
bm.to_mesh(obj.data);bm.free();finish.cutter.planar_uv(obj);(directory/'coupe-lod-100k.json').write_text(json.dumps(report,indent=2)+'\n');bpy.ops.wm.save_as_mainfile(filepath=str(directory/'coupe-lod-100k.blend'));print('CLEAN_SURFACE_LOD='+json.dumps(report))
