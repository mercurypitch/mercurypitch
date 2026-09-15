"""Finish the genuine Meshy carafe with bounded local repair and inspected gilt regions."""
import bpy,bmesh,json,importlib.util,math
from pathlib import Path
from mathutils.bvhtree import BVHTree
here=Path(__file__).resolve().parent;directory=here/'donors'/'fluted-carafe'
spec=importlib.util.spec_from_file_location('solid',here/'solid_fracture.py');solid=importlib.util.module_from_spec(spec);spec.loader.exec_module(solid)
def candidate(target):
    bpy.ops.wm.open_mainfile(filepath=str(directory/'clean-surface-lod.blend'));obj=bpy.data.objects['vase_fluted_intact']
    if target<200000:
        solid.cut.select_only([obj]);modifier=obj.modifiers.new('conservative_final_lod','DECIMATE');modifier.ratio=target/len(obj.data.polygons);modifier.use_collapse_triangulate=True;bpy.ops.object.modifier_apply(modifier=modifier.name)
    bm=bmesh.new();bm.from_mesh(obj.data);bm.verts.ensure_lookup_table();bm.faces.ensure_lookup_table();original=[v.co.copy() for v in bm.verts];history=[]
    def contacts():
        tree=BVHTree.FromBMesh(bm)
        return [(a,b) for a,b in tree.overlap(tree) if a<b and not set(bm.faces[a].verts)&set(bm.faces[b].verts)]
    for iteration in range(12):
        pairs=contacts();history.append(len(pairs))
        if not pairs:break
        core={v for pair in pairs for i in pair for v in bm.faces[i].verts};ring={e.other_vert(v) for v in core for e in v.link_edges}-core
        for group,factor in [(core,.28),(ring,.08)]:
            updates={v:sum((e.other_vert(v).co for e in v.link_edges),v.co*0)/len(v.link_edges) for v in group}
            for v,point in updates.items():
                delta=v.co.lerp(point,factor)-original[v.index]
                if delta.length>.0005:delta=delta.normalized()*.0005
                v.co=original[v.index]+delta
        bm.normal_update()
    final=len(contacts());movement=max((v.co-original[v.index]).length for v in bm.verts);bm.to_mesh(obj.data);bm.free()
    report={'targetTriangles':target,'contactHistory':history,'finalPairs':final,'maxLocalMovementMetres':movement,'localMovementBudgetMetres':.0005}
    print('FLUTED_CANDIDATE='+json.dumps(report),flush=True)
    return obj,report
attempts=[]
for triangles in [50000,200000]:
    obj,report=candidate(triangles);attempts.append(report)
    if not report['finalPairs']:break
else:raise ValueError('Neither bounded candidate passed; retain clean high-detail source')
collapsed=solid.remove_collapsed_components(obj);check=solid.mesh_check(obj)
if any(check[key] for key in ['nonManifoldEdges','nonManifoldVertices','nonContiguousEdges','selfIntersectionPairs','blenderMeshInvalid']):raise ValueError('Final shell failed topology gate')
# The untextured donor has no painted finish. These zones are authored directly
# on its existing support, two raised throat collars and scalloped mouth lip,
# matching the reviewed image; no gold geometry or replacement vessel is added.
names=[m.name for m in obj.data.materials];gold=names.index('gold_trim');glass=names.index('glass_shell')
top=[-1.0]*512
for vertex in obj.data.vertices:
    x,y,z=vertex.co
    if z>.63:
        index=int(((math.atan2(y,x)+math.pi)/(2*math.pi))*512)%512;top[index]=max(top[index],z)
counts={'glass_shell':0,'gold_trim':0}
for face in obj.data.polygons:
    point=sum((obj.data.vertices[i].co for i in face.vertices),obj.location*0)/len(face.vertices);r=math.hypot(point.x,point.y)
    index=int(((math.atan2(point.y,point.x)+math.pi)/(2*math.pi))*512)%512
    local_top=max(top[(index+i)%512] for i in [-1,0,1])
    foot=point.z<.024 and r>.049
    throat=((.487<point.z<.496) or (.500<point.z<.509)) and r>.029
    lip=point.z>.63 and local_top>0 and point.z>=local_top-.0017
    face.material_index=gold if foot or throat or lip else glass;face.use_smooth=True
    counts[names[face.material_index]]+=1
# Keep the final asset's support exactly on Z=0. Material transfer occurred in
# the recorded source-normalized coordinates before this tiny standing offset.
foot=min(v.co.z for v in obj.data.vertices)
for vertex in obj.data.vertices:vertex.co.z-=foot
obj.data.update();solid.cut.planar_uv(obj)
report={'status':'prepared for physical-material proof and fracture validation','source':'clean Meshy-derived surface; see clean-voxel-trial.json','attempts':attempts,'removedCollapsedComponents':collapsed,'mesh':check,'footTranslationMetres':-foot,'materialFaceCounts':counts,'giltRegions':{'foot':'z<.024m,r>.049m','throat':'z.487-.496m or .500-.509m,r>.029m','mouth':'within1.7mm of angle-local scalloped rim; original mesh only'}}
(directory/'ready-intact.json').write_text(json.dumps(report,indent=2)+'\n');bpy.ops.wm.save_as_mainfile(filepath=str(directory/'ready-intact.blend'));print('FLUTED_READY='+json.dumps(report))
