"""Cut an inspected Blender shell while retaining its surface normals, UVs and materials."""
import os,subprocess,sys,json,importlib.util
from pathlib import Path
import bpy,bmesh,numpy as np
from mathutils.bvhtree import BVHTree
HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('cut_geometry',HERE/'fracture.py');cut=importlib.util.module_from_spec(spec);spec.loader.exec_module(cut)

def remove_collapsed_components(obj):
    """Remove only isolated two-sided zero-volume triangles left by edge collapse.

    These have two opposite faces on the exact same three vertices. They pass
    edge manifold tests but are not solids; Blender's exporter otherwise removes
    only one duplicate face and leaves an open triangle. No vessel wall is filled.
    """
    bm=bmesh.new();bm.from_mesh(obj.data);remaining=set(bm.verts);removed=[]
    while remaining:
        first=remaining.pop();pending=[first];vertices={first}
        while pending:
            current=pending.pop()
            for edge in current.link_edges:
                other=edge.other_vert(current)
                if other in remaining:remaining.remove(other);vertices.add(other);pending.append(other)
        faces={face for vertex in vertices for face in vertex.link_faces}
        if len(vertices)==3 and len(faces)==2 and all(len(face.verts)==3 for face in faces):
            pair=list(faces)
            if set(pair[0].verts)!=set(pair[1].verts):raise ValueError('Unexpected collapsed component')
            removed.append({'vertices':3,'faces':2,'diameterMetres':max((a.co-b.co).length for a in vertices for b in vertices),'signedVolume':0})
            bmesh.ops.delete(bm,geom=list(vertices),context='VERTS')
    bm.to_mesh(obj.data);bm.free();obj.data.update()
    return {'removedComponents':len(removed),'removedFaces':sum(row['faces'] for row in removed),'components':removed}

def mesh_check(obj):
    bm=bmesh.new();bm.from_mesh(obj.data);bmesh.ops.triangulate(bm,faces=list(bm.faces));bm.faces.ensure_lookup_table()
    tree=BVHTree.FromBMesh(bm);pairs=[(a,b) for a,b in tree.overlap(tree) if a<b and not set(bm.faces[a].verts)&set(bm.faces[b].verts)]
    duplicate_check=obj.data.copy();blender_invalid=duplicate_check.validate(verbose=False,clean_customdata=False);bpy.data.meshes.remove(duplicate_check)
    report={'triangles':len(bm.faces),'vertices':len(bm.verts),'nonManifoldEdges':sum(not e.is_manifold for e in bm.edges),'nonManifoldVertices':sum(not v.is_manifold for v in bm.verts),'nonContiguousEdges':sum(not e.is_contiguous for e in bm.edges),'selfIntersectionPairs':len(pairs),'blenderMeshInvalid':blender_invalid,'signedVolume':bm.calc_volume(signed=True)}
    bm.free();return report

def fracture(intact,root,seeds,materials,work_directory,*,python='/usr/bin/python3',library_path='/tmp/glass-museum-manifold'):
    """Return new shard objects and a checked backend report; do not export or activate."""
    check=mesh_check(intact)
    if any(check[key] for key in ['nonManifoldEdges','nonManifoldVertices','nonContiguousEdges','selfIntersectionPairs','blenderMeshInvalid']):
        raise ValueError('Input shell failed closed/oriented/intersection gate: '+json.dumps(check))
    mesh=intact.data
    if any(len(p.vertices)!=3 for p in mesh.polygons):raise ValueError('Triangulate the reviewed input before cutting')
    if not mesh.uv_layers.active:raise ValueError('Reviewed input needs UV0 before cutting')
    names=[material.name for material in mesh.materials]
    if 'glass_cut' not in names:raise ValueError('Input must include the explicit glass_cut slot')
    positions=np.array([tuple(v.co) for v in mesh.vertices],dtype=np.float32)
    order=sorted(range(len(mesh.polygons)),key=lambda i:mesh.polygons[i].material_index)
    corner_indices=np.array([index for face in order for index in mesh.polygons[face].loop_indices])
    vertex_indices=np.array([mesh.loops[index].vertex_index for index in corner_indices])
    normals=np.array([tuple(mesh.corner_normals[int(index)].vector) for index in corner_indices],dtype=np.float32)
    uv=np.array([tuple(mesh.uv_layers.active.data[int(index)].uv) for index in corner_indices],dtype=np.float32)
    properties=np.column_stack((positions[vertex_indices],normals,uv))
    first={};merge_from=[];merge_to=[]
    for index,vertex in enumerate(vertex_indices):
        if int(vertex) in first:merge_from.append(index);merge_to.append(first[int(vertex)])
        else:first[int(vertex)]=index
    directory=Path(work_directory);directory.mkdir(parents=True,exist_ok=True);source=directory/'cut-input.npz';output=directory/'cut-output.npz'
    np.savez_compressed(source,properties=properties,triangles=np.arange(len(vertex_indices),dtype=np.uint32).reshape(-1,3),merge_from=np.asarray(merge_from),merge_to=np.asarray(merge_to),material_labels=np.array([mesh.polygons[i].material_index for i in order]),material_count=len(names),cut_material=names.index('glass_cut'),seeds=np.array([list(seed) for seed in seeds]))
    environment=dict(os.environ);environment['PYTHONPATH']=library_path
    subprocess.run([python,str(HERE/'solid_fracture_backend.py'),str(source),str(output)],check=True,timeout=240,env=environment)
    result=np.load(output);report=json.loads(output.with_suffix('.json').read_text());shards=[]
    for row in report['meshes']:
        key=row['key'];props=result[key+'_properties'];triangles=result[key+'_triangles'];mapping=np.arange(len(props))
        for origin,target in zip(result[key+'_merge_from'],result[key+'_merge_to']):mapping[origin]=target
        for index in range(len(mapping)):
            target=index
            while mapping[target]!=target:target=int(mapping[target])
            mapping[index]=target
        used=np.unique(mapping[triangles]);compact={int(vertex):index for index,vertex in enumerate(used)}
        faces=[[compact[int(mapping[v])] for v in triangle] for triangle in triangles]
        data=bpy.data.meshes.new(root.name+'_'+key);data.from_pydata(props[used,:3].tolist(),[],faces);data.update()
        obj=bpy.data.objects.new(root.name+'_'+key,data);bpy.context.scene.collection.objects.link(obj);obj.parent=root;obj['role']='shard'
        for name in names:data.materials.append(materials[name])
        layer=data.uv_layers.new(name='UVMap');custom=[]
        for face,source_triangle,label in zip(data.polygons,triangles,result[key+'_materials']):
            face.material_index=int(label);is_cut=names[int(label)]=='glass_cut';face.use_smooth=not is_cut
            axis=max(range(3),key=lambda i:abs(face.normal[i]));axes=[(1,2),(0,2),(0,1)][axis]
            for loop_index,source_vertex in zip(face.loop_indices,source_triangle):
                point=props[source_vertex,:3];layer.data[loop_index].uv=tuple(point[list(axes)]) if is_cut else tuple(props[source_vertex,6:8])
                custom.append(tuple(face.normal) if is_cut else tuple(props[source_vertex,3:6]))
        data.normals_split_custom_set(custom);cut.center_geometry(obj);obj.hide_render=True;shards.append(obj)
    return shards,report
