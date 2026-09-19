"""Locate intersecting donor triangles and measure their actual repair regions."""
import bpy,json,sys
from pathlib import Path
from mathutils.bvhtree import BVHTree
name=sys.argv[sys.argv.index('--')+1];directory=Path(__file__).resolve().parent/'donors'/name
bpy.ops.wm.open_mainfile(filepath=str(directory/'prepared.blend'))
obj=next(o for o in bpy.context.scene.objects if o.get('role')=='intact')
v=[x.co.copy() for x in obj.data.vertices];f=[tuple(x.vertices) for x in obj.data.polygons];tree=BVHTree.FromPolygons(v,f,all_triangles=True)
pairs=[(a,b) for a,b in tree.overlap(tree) if a<b and not set(f[a])&set(f[b])]
remaining=set(i for p in pairs for i in p);groups=[]
while remaining:
    group={remaining.pop()};changed=True
    while changed:
        before=len(group);verts={j for i in group for j in f[i]}
        neighbours={i for i in remaining if verts&set(f[i]) or any(i in p and set(p)&group for p in pairs)}
        remaining-=neighbours;group|=neighbours;changed=before!=len(group)
    pts=[v[j] for i in group for j in f[i]];lo=[min(p[k] for p in pts) for k in range(3)];hi=[max(p[k] for p in pts) for k in range(3)]
    groups.append({'faces':sorted(group),'bounds':{'min':lo,'max':hi},'diameter':max((a-b).length for a in pts for b in pts)})
(directory/'intersection-regions.json').write_text(json.dumps({'pairs':len(pairs),'groups':groups},indent=2)+'\n');print('REGIONS='+json.dumps(groups))
