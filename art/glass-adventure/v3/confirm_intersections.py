"""Confirm float BVH candidates with double-precision triangle plane intervals."""
import bpy,sys,json,numpy as np
from pathlib import Path
from mathutils.bvhtree import BVHTree
name=sys.argv[sys.argv.index('--')+1];filename=sys.argv[sys.argv.index('--')+2];directory=Path(__file__).resolve().parent/'donors'/name
bpy.ops.wm.open_mainfile(filepath=str(directory/filename));obj=next(o for o in bpy.context.scene.objects if o.get('role')=='intact')
vertices=np.array([list(v.co) for v in obj.data.vertices],dtype=np.float64);faces=np.array([list(p.vertices) for p in obj.data.polygons]);tree=BVHTree.FromPolygons(vertices.tolist(),faces.tolist(),all_triangles=True)
pairs=[(a,b) for a,b in tree.overlap(tree) if a<b and not set(faces[a])&set(faces[b])]
def interval(triangle,distance,axis):
    points=[]
    for i in range(3):
        j=(i+1)%3
        if abs(distance[i])<1e-12:points.append(triangle[i])
        if distance[i]*distance[j]<0:
            points.append(triangle[i]+(triangle[j]-triangle[i])*distance[i]/(distance[i]-distance[j]))
    if len(points)<2:return None
    values=[p@axis for p in points];return min(values),max(values)
rows=[]
for a,b in pairs:
    A=vertices[faces[a]];B=vertices[faces[b]];na=np.cross(A[1]-A[0],A[2]-A[0]);nb=np.cross(B[1]-B[0],B[2]-B[0])
    na/=np.linalg.norm(na);nb/=np.linalg.norm(nb);da=(A-B[0])@nb;db=(B-A[0])@na
    if min(da)>1e-10 or max(da)<-1e-10 or min(db)>1e-10 or max(db)<-1e-10:
        rows.append({'pair':[a,b],'kind':'separated-double-precision'});continue
    axis=np.cross(na,nb);length=np.linalg.norm(axis)
    if length<1e-8:
        rows.append({'pair':[a,b],'kind':'coplanar-needs-area-inspection'});continue
    axis/=length;ia=interval(A,da,axis);ib=interval(B,db,axis)
    overlap=min(ia[1],ib[1])-max(ia[0],ib[0]) if ia and ib else 0
    rows.append({'pair':[a,b],'kind':'crossing' if overlap>1e-9 else 'point-contact-or-separated','intersectionSegmentMetres':max(0,overlap)})
report={'source':filename,'epsilonMetres':1e-9,'bvhPairs':len(pairs),'counts':{kind:sum(r['kind']==kind for r in rows) for kind in sorted({r['kind'] for r in rows})},'pairs':rows}
(directory/Path(filename).with_suffix('.confirmed-intersections.json')).write_text(json.dumps(report,indent=2)+'\n');print('CONFIRMED_INTERSECTIONS='+json.dumps({k:v for k,v in report.items() if k!='pairs'}))
