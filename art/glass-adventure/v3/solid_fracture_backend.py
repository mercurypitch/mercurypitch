"""Preserve donor corner attributes and material regions through solid clipping.

Run in ordinary Python with manifold3d==3.5.3 and numpy, never loaded into
Blender's process because its allocator can conflict with the binary wheel.
"""
import argparse,json
from pathlib import Path
import numpy as np
import manifold3d as m

parser=argparse.ArgumentParser();parser.add_argument('input',type=Path);parser.add_argument('output',type=Path);args=parser.parse_args()
data=np.load(args.input);labels=data['material_labels'];material_count=int(data['material_count']);first_id=m.Manifold.reserve_ids(material_count)
starts=np.flatnonzero(np.r_[True,labels[1:]!=labels[:-1]])
mesh=m.Mesh(data['properties'].astype(np.float32),data['triangles'].astype(np.uint32),
    merge_from_vert=data['merge_from'].astype(np.uint32),merge_to_vert=data['merge_to'].astype(np.uint32),
    run_index=np.r_[starts*3,len(labels)*3].astype(np.uint32),
    run_original_id=(labels[starts]+first_id).astype(np.uint32))
whole=m.Manifold(mesh)
if whole.status()!=m.Error.NoError:raise ValueError(f'Invalid source solid: {whole.status()}')
result={};reports=[]
for index,seed in enumerate(data['seeds']):
    solid=whole
    for other in data['seeds']:
        if np.array_equal(seed,other):continue
        normal=seed-other;normal=normal/np.linalg.norm(normal);middle=(seed+other)/2
        solid=solid.trim_by_plane(normal,float(normal@middle))
    if solid.is_empty():continue
    if solid.status()!=m.Error.NoError:raise ValueError(f'Invalid cut {index}: {solid.status()}')
    clipped=solid.to_mesh(normal_idx=0);key=f'shard_{index:03d}'
    face_materials=np.full(len(clipped.tri_verts),int(data['cut_material']),dtype=np.int32)
    for run,original in enumerate(clipped.run_original_id):
        if first_id<=original<first_id+material_count:
            face_materials[clipped.run_index[run]//3:clipped.run_index[run+1]//3]=original-first_id
    result[key+'_properties']=clipped.vert_properties;result[key+'_triangles']=clipped.tri_verts
    result[key+'_merge_from']=np.asarray(clipped.merge_from_vert,dtype=np.int32);result[key+'_merge_to']=np.asarray(clipped.merge_to_vert,dtype=np.int32)
    result[key+'_materials']=face_materials
    reports.append({'key':key,'triangles':solid.num_tri(),'volume':solid.volume()});print('AUTHORED_CELL='+str(index),flush=True)
np.savez_compressed(args.output,**result)
report={'backend':'manifold3d 3.5.3','inputVolume':whole.volume(),'inputTriangles':whole.num_tri(),'meshes':reports,'relativeVolumeError':abs(sum(row['volume'] for row in reports)-whole.volume())/whole.volume()}
args.output.with_suffix('.json').write_text(json.dumps(report,indent=2)+'\n');print('AUTHORED_CUT_COMPLETE='+str(args.output),flush=True)
