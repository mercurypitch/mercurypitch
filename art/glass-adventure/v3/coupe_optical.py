"""Assign inspected coupe trim boundaries and save physical materials on the repaired donor."""
import bpy, json, hashlib, importlib.util
from pathlib import Path
HERE=Path(__file__).resolve().parent
D=HERE/'donors/aurora-coupe'; R=HERE/'material-regions/aurora-coupe'
def module(name, filename):
 spec=importlib.util.spec_from_file_location(name,HERE/filename);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);return m
transfer=module('transfer','texture_materials.py');finish=module('finish','finalize_donor.py')
source=D/'coupe-lod-50k-repaired.blend';bpy.ops.wm.open_mainfile(filepath=str(source));bpy.context.preferences.filepaths.save_version=0
obj=bpy.data.objects['coupe_aurora_intact'];before=[tuple(v.co) for v in obj.data.vertices]
report=json.loads((R/'coupe-region-report.json').read_text());decisions=[]
for row in report['faces']:
 if row['material'] is not None:continue
 if row['reasons']!=['ambiguous-source-color'] or row['distanceMetres']>.006:
  raise ValueError('This paint decision covers only inspected blended trim colors')
 # Actual diagnostic was inspected: these mixed colors lie on the gold laurel,
 # rim and collar boundaries. Favor a continuous gold trim at this LOD.
 row['material']='gold_trim';decisions.append({'face':row['face'],'choice':'gold_trim','originalReasons':row['reasons'],'sourceRgbSrgb':row['sourceRgbSrgb']})
materials={name:bpy.data.materials[name] for name in ['glass_shell','gold_trim']}
transfer.apply_face_labels(obj,report,materials)
assert before==[tuple(v.co) for v in obj.data.vertices]
for face in obj.data.polygons:face.use_smooth=True
bpy.ops.wm.save_as_mainfile(filepath=str(D/'optical-prepared.blend'))
measurement=finish.measure(obj)
manifest={'status':'optical material audition; fracture not yet prepared','intact':obj.name,'shards':[],'meshes':[measurement],'geometrySourceSha256':hashlib.sha256(source.read_bytes()).hexdigest(),'regionDiagnostic':'../../material-regions/aurora-coupe/coupe-regions-diagnostic.png','boundaryDecision':'Reviewed mixed gold/gray trim pixels become continuous gold at this LOD; no geometry change','resolvedBoundaryFaces':len(decisions),'materials':list(materials)}
(D/'optical-prepared.json').write_text(json.dumps(manifest,indent=2)+'\n')
(R/'boundary-decisions.json').write_text(json.dumps({'decision':manifest['boundaryDecision'],'faces':decisions},indent=2)+'\n')
print('COUPE_OPTICAL='+json.dumps(manifest),flush=True)
