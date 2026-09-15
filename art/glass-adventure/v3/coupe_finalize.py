"""Prepare the inspected coupe for the shared closed-fragment export pipeline."""
import bpy,json,importlib.util,runpy,sys
from pathlib import Path
HERE=Path(__file__).resolve().parent;D=HERE/'donors/aurora-coupe'
spec=importlib.util.spec_from_file_location('solid',HERE/'solid_fracture.py');solid=importlib.util.module_from_spec(spec);spec.loader.exec_module(solid)
bpy.ops.wm.open_mainfile(filepath=str(D/'optical-prepared.blend'));bpy.context.preferences.filepaths.save_version=0
obj=bpy.data.objects['coupe_aurora_intact']
cleanup=solid.remove_collapsed_components(obj)
if 'glass_cut' not in bpy.data.materials:
 spec=importlib.util.spec_from_file_location('finish',HERE/'finalize_donor.py');finish=importlib.util.module_from_spec(spec);spec.loader.exec_module(finish)
 finish.material('glass_cut',(.83,.98,.97),.14,.88)
if 'glass_cut' not in [m.name for m in obj.data.materials]:obj.data.materials.append(bpy.data.materials['glass_cut'])
check=solid.mesh_check(obj)
if any(check[k] for k in ['nonManifoldEdges','nonManifoldVertices','nonContiguousEdges','selfIntersectionPairs','blenderMeshInvalid']):raise ValueError(json.dumps(check))
(D/'ready-intact.json').write_text(json.dumps({'cleanup':cleanup,'check':check,'materialDecision':'../../material-regions/aurora-coupe/boundary-decisions.json'},indent=2)+'\n')
bpy.ops.wm.save_as_mainfile(filepath=str(D/'ready-intact.blend'))
sys.argv=['export_final_shell.py','--','--family','aurora-coupe'];runpy.run_path(str(HERE/'export_final_shell.py'),run_name='__main__')
sys.argv=['validate_final_shell.py','--','--family','aurora-coupe'];runpy.run_path(str(HERE/'validate_final_shell.py'),run_name='__main__')
