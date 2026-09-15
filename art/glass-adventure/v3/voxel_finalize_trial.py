"""Test adaptive surface repair directly from the inspected high-detail donor.

Volume projection is disabled because projecting the clean isosurface back onto
intersecting donor triangles reintroduces their defects. No primitive form is
created, and deviation/cavity/closedness still require independent acceptance.
"""
import bpy,bmesh,sys,json,importlib.util,numpy as np
from pathlib import Path
from mathutils.bvhtree import BVHTree
here=Path(__file__).resolve().parent;name=sys.argv[sys.argv.index('--')+1];directory=here/'donors'/name
spec=importlib.util.spec_from_file_location('finish',here/'finalize_donor.py');finish=importlib.util.module_from_spec(spec);spec.loader.exec_module(finish)
config=json.loads((directory/'recipe.json').read_text());bpy.ops.wm.open_mainfile(filepath=str(here/'donors'/config['inspectionName']/'raw-import.blend'))
objects=[o for o in bpy.context.scene.objects if o.type=='MESH'];normalization=finish.inspection.normalize(objects,config['heightMetres']);materials=finish.assign_materials(objects,config)
repair=dict(config['repair']);repair.pop('targetTriangles',None)
for o in objects:finish.repair_mesh(o,repair)
obj=objects[0];before_vertices=[v.co.copy() for v in obj.data.vertices];before_faces=[tuple(p.vertices) for p in obj.data.polygons];before_tree=BVHTree.FromPolygons(before_vertices,before_faces,all_triangles=True)
finish.cutter.select_only([obj]);obj.data.remesh_voxel_size=.0012;obj.data.remesh_voxel_adaptivity=0;obj.data.use_remesh_fix_poles=False;obj.data.use_remesh_preserve_volume=False;obj.data.use_remesh_preserve_attributes=False
bpy.ops.object.voxel_remesh();print('ADAPTIVE_VOXEL_POLYGONS='+str(len(obj.data.polygons)),flush=True)
bm=bmesh.new();bm.from_mesh(obj.data);bmesh.ops.triangulate(bm,faces=list(bm.faces));bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.faces.ensure_lookup_table();tree=BVHTree.FromBMesh(bm)
pairs=[(a,b) for a,b in tree.overlap(tree) if a<b and not set(bm.faces[a].verts)&set(bm.faces[b].verts)]
forward=[before_tree.find_nearest(v.co)[3] for v in list(bm.verts)[::max(1,len(bm.verts)//4000)]];reverse=[tree.find_nearest(v)[3] for v in before_vertices[::max(1,len(before_vertices)//4000)]]
report={'method':'OpenVDB isosurface of real high-detail Meshy donor; no adaptivity, pole fixing, source projection or subsequent edge-collapse','voxelMetres':.0012,'adaptivity':0,'normalization':normalization,'sourceTriangles':len(before_faces),'triangles':len(bm.faces),'nonManifoldEdges':sum(not e.is_manifold for e in bm.edges),'selfIntersectionPairs':len(pairs),'signedVolume':bm.calc_volume(signed=True),'sampledMaxDistanceToSourceMetres':max(forward),'sampledMaxDistanceFromSourceMetres':max(reverse),'vertices':len(bm.verts),'edges':len(bm.edges),'eulerCharacteristic':len(bm.verts)-len(bm.edges)+len(bm.faces)}
bm.to_mesh(obj.data);bm.free();obj.data.materials.clear()
for material in materials.values():obj.data.materials.append(material)
for face in obj.data.polygons:face.use_smooth=True
root=bpy.data.objects.new(config['nodePrefix'],None);bpy.context.scene.collection.objects.link(root);obj.parent=root;obj.name=root.name+'_intact';obj['role']='intact';finish.cutter.planar_uv(obj)
bpy.context.view_layer.update();lo,hi=finish.inspection.bounds([obj]);report['rays']=finish.inspection.vertical_rays([obj],lo,hi,config['heightMetres'])
(directory/'clean-voxel-trial.json').write_text(json.dumps(report,indent=2)+'\n');bpy.ops.wm.save_as_mainfile(filepath=str(directory/'clean-voxel-trial.blend'));print('CLEAN_VOXEL_TRIAL='+json.dumps({k:v for k,v in report.items() if k!='rays'}),flush=True)
