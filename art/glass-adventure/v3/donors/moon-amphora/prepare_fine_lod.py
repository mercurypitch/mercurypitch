"""Preserve amphora relief with a finer source-derived shell and bounded final LOD."""
import bpy,bmesh,json,importlib.util,sys
from pathlib import Path
from mathutils.bvhtree import BVHTree
HERE=Path(__file__).resolve().parent;V3=HERE.parents[1]
spec=importlib.util.spec_from_file_location('finish',V3/'finalize_donor.py');finish=importlib.util.module_from_spec(spec);spec.loader.exec_module(finish)
config=json.loads((HERE/'recipe.json').read_text())
bpy.ops.wm.open_mainfile(filepath=str(V3/'donors'/config['inspectionName']/'raw-import.blend'));bpy.context.preferences.filepaths.save_version=0
objects=[o for o in bpy.context.scene.objects if o.type=='MESH'];normalization=finish.inspection.normalize(objects,config['heightMetres']);materials=finish.assign_materials(objects,config);obj=objects[0];finish.cutter.select_only([obj])
obj.data.remesh_voxel_size=.0006;obj.data.remesh_voxel_adaptivity=0;obj.data.use_remesh_fix_poles=False;obj.data.use_remesh_preserve_volume=False;obj.data.use_remesh_preserve_attributes=False
bpy.ops.object.voxel_remesh();print('FINE_VOXEL_QUADS='+str(len(obj.data.polygons)),flush=True)
# Blender keeps a closed isosurface. Evaluate the practical final triangulated LOD
# independently; the untouched high source and this recipe regenerate the dense step.
for count in [200000,100000]:
 obj.data.calc_loop_triangles();total=len(obj.data.loop_triangles);modifier=obj.modifiers.new('bounded_lod','DECIMATE');modifier.ratio=min(1,count/total);modifier.use_collapse_triangulate=True;bpy.ops.object.modifier_apply(modifier=modifier.name);print('LOD_POLYGONS='+str(len(obj.data.polygons)),flush=True)
bm=bmesh.new();bm.from_mesh(obj.data);bmesh.ops.triangulate(bm,faces=list(bm.faces));bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.verts.ensure_lookup_table();bm.faces.ensure_lookup_table();original=[v.co.copy() for v in bm.verts];history=[];moved=set()
def contacts():
 tree=BVHTree.FromBMesh(bm)
 return [(a,b) for a,b in tree.overlap(tree) if a<b and not set(bm.faces[a].verts)&set(bm.faces[b].verts)]
for _ in range(12):
 pairs=contacts();history.append(len(pairs));print('FINE_LOD_CONTACTS='+str(len(pairs)),flush=True)
 if not pairs:break
 core={v for pair in pairs for i in pair for v in bm.faces[i].verts};ring={e.other_vert(v) for v in core for e in v.link_edges}-core
 for group,factor in [(core,.28),(ring,.08)]:
  updates={v:sum((e.other_vert(v).co for e in v.link_edges),v.co*0)/len(v.link_edges) for v in group}
  for vertex,point in updates.items():
   delta=vertex.co.lerp(point,factor)-original[vertex.index]
   if delta.length>.0005:delta=delta.normalized()*.0005
   vertex.co=original[vertex.index]+delta;moved.add(vertex.index)
 bm.normal_update()
report={'method':'OpenVDB actual high Meshy source at0.6mm, no volume projection/adaptivity, then200k→100k bounded LOD and diagnosed local fairing','normalization':normalization,'voxelMetres':.0006,'triangles':len(bm.faces),'selfIntersectionPairs':len(contacts()),'badEdges':sum(not e.is_manifold for e in bm.edges),'badVertices':sum(not v.is_manifold for v in bm.verts),'nonContiguousEdges':sum(not e.is_contiguous for e in bm.edges),'signedVolume':bm.calc_volume(signed=True),'localContactHistory':history,'movedVertices':len(moved),'maxLocalMovementMetres':max((v.co-original[v.index]).length for v in bm.verts),'movementBudgetMetres':.0005,'status':'candidate awaiting fidelity and material/fracture proof'}
(HERE/'fine-060-lod100k.json').write_text(json.dumps(report,indent=2)+'\n')
if any(report[k] for k in ['selfIntersectionPairs','badEdges','badVertices','nonContiguousEdges']):raise ValueError(report)
bm.to_mesh(obj.data);bm.free();obj.data.materials.clear()
for material in materials.values():obj.data.materials.append(material)
for face in obj.data.polygons:face.use_smooth=True
root=bpy.data.objects.new('vase_amphora',None);bpy.context.scene.collection.objects.link(root);obj.parent=root;obj.name='vase_amphora_intact';obj['role']='intact';finish.cutter.planar_uv(obj);bpy.context.view_layer.update();bpy.ops.wm.save_as_mainfile(filepath=str(HERE/'fine-060-lod100k.blend'));print('AMPHORA_FINE_LOD='+json.dumps(report),flush=True)
