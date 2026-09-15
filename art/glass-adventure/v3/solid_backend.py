"""Clip imported solid surfaces in a process isolated from Blender's allocator.

Requires manifold3d==3.5.3 and numpy. This only reduces/cuts supplied surfaces;
it does not reconstruct or substitute a vessel silhouette.
"""
import argparse,json
from pathlib import Path
import numpy as np
import manifold3d as manifold

parser=argparse.ArgumentParser();parser.add_argument('input',type=Path);parser.add_argument('output',type=Path)
parser.add_argument('--simplify',type=float,default=0);args=parser.parse_args()
source=np.load(args.input);whole=manifold.Manifold(manifold.Mesh(source['vertices'].astype(np.float32),source['faces'].astype(np.uint32)))
if whole.status()!=manifold.Error.NoError:raise ValueError(f'Invalid input solid: {whole.status()}')
before={'triangles':whole.num_tri(),'volume':whole.volume()}
if args.simplify:whole=whole.simplify(args.simplify)
print('SOLID_READY='+json.dumps({'before':before,'triangles':whole.num_tri(),'volume':whole.volume()}),flush=True)
output={};rows=[]
def record(solid,key):
    if solid.status()!=manifold.Error.NoError:raise ValueError(f'Invalid output {key}: {solid.status()}')
    mesh=solid.to_mesh();output[key+'_vertices']=mesh.vert_properties[:,:3];output[key+'_faces']=mesh.tri_verts
    rows.append({'key':key,'volume':solid.volume(),'triangles':solid.num_tri()})
record(whole,'intact')
if 'seeds' in source:
    for index,seed in enumerate(source['seeds']):
        solid=whole
        for other in source['seeds']:
            if np.array_equal(seed,other):continue
            normal=seed-other;normal=normal/np.linalg.norm(normal);middle=(seed+other)/2
            solid=solid.trim_by_plane(normal,float(normal@middle))
        if solid.is_empty():continue
        record(solid,f'shard_{index:03d}');print('SOLID_CELL='+str(index),flush=True)
np.savez_compressed(args.output,**output)
report={'backend':'manifold3d 3.5.3','input':str(args.input),'simplifyTolerance':args.simplify,'before':before,'meshes':rows}
args.output.with_suffix('.json').write_text(json.dumps(report,indent=2)+'\n')
print('SOLID_COMPLETE='+str(args.output),flush=True)
