"""Measure finalization source self-intersections without changing the surface."""
import bpy,bmesh,json,sys
from pathlib import Path
from mathutils.bvhtree import BVHTree
name=sys.argv[sys.argv.index('--')+1]
directory=Path(__file__).resolve().parent/'donors'/name
bpy.ops.wm.open_mainfile(filepath=str(directory/'prepared.blend'))
o=next(o for o in bpy.context.scene.objects if o.get('role')=='intact')
bm=bmesh.new();bm.from_mesh(o.data);bmesh.ops.triangulate(bm,faces=list(bm.faces));bm.faces.ensure_lookup_table()
tree=BVHTree.FromBMesh(bm); pairs=[]
for a,b in tree.overlap(tree):
 if a>=b:continue
 fa,fb=bm.faces[a],bm.faces[b]
 if set(fa.verts)&set(fb.verts):continue
 pairs.append([a,b])
report={'triangles':len(bm.faces),'volume':bm.calc_volume(signed=True),'nonAdjacentOverlappingTrianglePairs':len(pairs),'pairs':pairs[:100]}
(directory/'surface-diagnostic.json').write_text(json.dumps(report,indent=2)+'\n')
print('SOURCE_SURFACE='+json.dumps({k:v for k,v in report.items() if k!='pairs'}));bm.free()
