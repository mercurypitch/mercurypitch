"""Resolve inspected surface self-overlaps without remaking donor geometry."""
import bpy,bmesh,json,sys
from pathlib import Path
name=sys.argv[sys.argv.index('--')+1];directory=Path(__file__).resolve().parent/'donors'/name
bpy.ops.wm.open_mainfile(filepath=str(directory/'prepared.blend'))
o=next(o for o in bpy.context.scene.objects if o.get('role')=='intact')
bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o
bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.mesh.intersect_boolean(operation='UNION',use_self=True,solver='EXACT');bpy.ops.object.mode_set(mode='OBJECT')
b=bmesh.new();b.from_mesh(o.data);bmesh.ops.triangulate(b,faces=list(b.faces));bmesh.ops.recalc_face_normals(b,faces=list(b.faces));report={'faces':len(b.faces),'badEdges':sum(not e.is_manifold for e in b.edges),'volume':b.calc_volume(signed=True)};b.to_mesh(o.data);b.free()
(directory/'surface-resolution.json').write_text(json.dumps(report,indent=2)+'\n')
bpy.ops.wm.save_as_mainfile(filepath=str(directory/'prepared-resolved.blend'));print('RESOLVED_SURFACE='+json.dumps(report))
