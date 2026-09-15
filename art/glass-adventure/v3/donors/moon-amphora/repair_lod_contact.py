"""Correct only the diagnosed single amphora LOD contact within a0.2mm budget."""
import bpy,bmesh,json,sys
from pathlib import Path
from mathutils.bvhtree import BVHTree
HERE=Path(__file__).resolve().parent
bpy.ops.wm.open_mainfile(filepath=str(HERE/'clean-surface-lod.blend'))
bpy.context.preferences.filepaths.save_version=0
obj=bpy.data.objects['vase_amphora_intact']
bm=bmesh.new();bm.from_mesh(obj.data);bm.verts.ensure_lookup_table();bm.faces.ensure_lookup_table()
original=[v.co.copy() for v in bm.verts];history=[];moved=set();initial_bounds=None

def contacts():
    tree=BVHTree.FromBMesh(bm)
    return [(a,b) for a,b in tree.overlap(tree) if a<b and not set(bm.faces[a].verts)&set(bm.faces[b].verts)]

for iteration in range(16):
    pairs=contacts();history.append(len(pairs))
    if not pairs:break
    if iteration==0 and len(pairs)!=1:raise ValueError('Expected exactly the inspected single LOD contact')
    core={v for pair in pairs for index in pair for v in bm.faces[index].verts}
    if initial_bounds is None:initial_bounds={'min':[min(v.co[i] for v in core) for i in range(3)],'max':[max(v.co[i] for v in core) for i in range(3)]}
    ring={e.other_vert(v) for v in core for e in v.link_edges}-core
    for group,factor in [(core,.18),(ring,.04)]:
        updates={v:sum((e.other_vert(v).co for e in v.link_edges),v.co*0)/len(v.link_edges) for v in group}
        for v,target in updates.items():
            delta=v.co.lerp(target,factor)-original[v.index]
            if delta.length>.0002:delta=delta.normalized()*.0002
            v.co=original[v.index]+delta;moved.add(v.index)
    bm.normal_update()
pairs=contacts();report={'status':'candidate; independent source-fidelity and fracture gates pending','operation':'local fairing of one inspected LOD crossing; all other vertices unchanged','history':history,'finalSelfIntersectionPairs':len(pairs),'movedVertices':len(moved),'maxVertexDisplacementMetres':max((v.co-original[v.index]).length for v in bm.verts),'maximumAllowedMetres':.0002,'initialContactBoundsBlenderZUp':initial_bounds,'triangles':len(bm.faces),'nonManifoldEdges':sum(not e.is_manifold for e in bm.edges),'nonManifoldVertices':sum(not v.is_manifold for v in bm.verts),'signedVolume':bm.calc_volume(signed=True)}
(HERE/'clean-lod-v2.json').write_text(json.dumps(report,indent=2)+'\n')
if pairs or report['nonManifoldEdges'] or report['nonManifoldVertices']:raise ValueError(report)
bm.to_mesh(obj.data);bm.free();bpy.ops.wm.save_as_mainfile(filepath=str(HERE/'clean-lod-v2.blend'));print('AMPHORA_LOCAL_REPAIR='+json.dumps(report))
