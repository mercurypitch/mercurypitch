"""Evaluate a bounded local fairing of actual intersecting donor triangles."""
import bpy,bmesh,sys,json,importlib.util
from pathlib import Path
from mathutils.bvhtree import BVHTree
here=Path(__file__).resolve().parent;name='aurora-coupe';directory=here/'donors'/name
spec=importlib.util.spec_from_file_location('finish',here/'finalize_donor.py');finish=importlib.util.module_from_spec(spec);spec.loader.exec_module(finish)
bpy.ops.wm.open_mainfile(filepath=str(directory/'coupe-lod-50k.blend'));obj=next(o for o in bpy.context.scene.objects if o.get('role')=='intact')
bm=bmesh.new();bm.from_mesh(obj.data);bm.verts.ensure_lookup_table();bm.faces.ensure_lookup_table();original=[v.co.copy() for v in bm.verts];history=[]
max_displacement=.0005
def contacts():
    tree=BVHTree.FromBMesh(bm)
    return [(a,b) for a,b in tree.overlap(tree) if a<b and not set(bm.faces[a].verts)&set(bm.faces[b].verts)]
for iteration in range(48):
    pairs=contacts();history.append(len(pairs));print('LOCAL_CONTACTS='+str(len(pairs)),flush=True)
    if not pairs:break
    core={v for pair in pairs for i in pair for v in bm.faces[i].verts}
    ring={e.other_vert(v) for v in core for e in v.link_edges}-core
    # Only diagnosed patches and their immediate blending ring move. The 0.5mm
    # displacement budget is checked per original vertex, not per iteration.
    for group,factor in [(core,.28),(ring,.08)]:
        updates={v:sum((e.other_vert(v).co for e in v.link_edges),v.co*0)/len(v.link_edges) for v in group}
        for v,target in updates.items():
            point=v.co.lerp(target,factor);delta=point-original[v.index]
            if delta.length>max_displacement:delta=delta.normalized()*max_displacement
            v.co=original[v.index]+delta
    bm.normal_update()
final_pairs=len(contacts());bad=sum(not e.is_manifold for e in bm.edges);distance=max((v.co-original[v.index]).length for v in bm.verts);bm.to_mesh(obj.data);bm.free()
report={'method':'local donor-vertex fairing only at diagnosed intersecting face patches','history':history,'finalPairs':final_pairs,'maxVertexDisplacementMetres':distance,'maximumAllowedMetres':max_displacement,'badEdges':bad,'measurement':finish.measure(obj)}
(directory/'coupe-lod-50k-repaired.json').write_text(json.dumps(report,indent=2)+'\n');bpy.ops.wm.save_as_mainfile(filepath=str(directory/'coupe-lod-50k-repaired.blend'));print('CONTACT_RELAX_TRIAL='+json.dumps(report))
