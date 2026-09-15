"""Stage a reviewed Meshy-derived shell and matched solid fragments for independent validation."""
import argparse,bpy,importlib.util,json,hashlib,sys
from pathlib import Path
HERE=Path(__file__).resolve().parent
def module(name,filename):
    spec=importlib.util.spec_from_file_location(name,HERE/filename);result=importlib.util.module_from_spec(spec);spec.loader.exec_module(result);return result
solid=module('solid_fracture','solid_fracture.py');inspection=module('source_inspection','inspect_donor.py');metrics=module('finish_metrics','finalize_donor.py')
parser=argparse.ArgumentParser();parser.add_argument('--family',required=True);parser.add_argument('--input',default='ready-intact.blend');args=parser.parse_args(sys.argv[sys.argv.index('--')+1:])
directory=HERE/'donors'/args.family;source=(directory/args.input).resolve()
if not source.is_relative_to(directory.resolve()):raise ValueError('Prepared shell must stay in its family directory')
recipe=json.loads((directory/'recipe.json').read_text());bpy.ops.wm.open_mainfile(filepath=str(source));bpy.context.preferences.filepaths.save_version=0
intact=bpy.data.objects[recipe['nodePrefix']+'_intact'];root=intact.parent
if root is None:raise ValueError('Intact needs its authored asset root')
seeds=solid.cut.surface_seeds(intact,recipe.get('shardCount',23),recipe.get('seed',20260915))
materials={material.name:material for material in intact.data.materials}
shards,backend=solid.fracture(intact,root,seeds,materials,directory/'fracture-work')
bpy.context.view_layer.update();checks=[solid.mesh_check(obj) for obj in [intact,*shards]]
if any(check[key] for check in checks for key in ['nonManifoldEdges','nonManifoldVertices','nonContiguousEdges','selfIntersectionPairs','blenderMeshInvalid']):raise ValueError('An intact or shard failed the full surface gate')
volume=checks[0]['signedVolume'];difference=abs(sum(check['signedVolume'] for check in checks[1:])-volume)/volume
if volume<=0 or not 12<=len(shards)<=24 or difference>1e-5:raise ValueError('Invalid fragment count or volume reconstruction')
lo,hi=inspection.bounds([intact]);rays=inspection.vertical_rays([intact],lo,hi,hi.z-lo.z)
bpy.ops.wm.save_as_mainfile(filepath=str(directory/'finalized.blend'));exports=HERE/'exports';exports.mkdir(exist_ok=True);output=exports/(args.family+'.glb')
solid.cut.select_only([root,intact,*shards]);bpy.ops.export_scene.gltf(filepath=str(output),export_format='GLB',use_selection=True,export_yup=True,export_apply=True,export_extras=True,export_animations=False,export_tangents=True)
raw=output.read_bytes();measurements=[metrics.measure(obj) for obj in [intact,*shards]]
report={'status':'staged; independent GLB reimport and visual validation still required','source':recipe['donor'],'sourceSha256':recipe['sourceSha256'],'preparedInput':args.input,'preparedSha256':hashlib.sha256(source.read_bytes()).hexdigest(),'units':'metres','up':'+Y','footCentred':True,'intact':intact.name,'shards':[obj.name for obj in shards],'meshes':measurements,'surfaceChecks':checks,'rays':rays,'fracture':{'method':'Manifold3D convex Voronoi plane clipping of actual donor-derived shell','seedCoordinatesBlenderZUp':[list(seed) for seed in seeds],'volumeRelativeError':difference,'backend':backend},'bundle':{'file':str(output.relative_to(HERE)),'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest()}}
(directory/'finalization.json').write_text(json.dumps(report,indent=2)+'\n');print('STAGED_FINAL_SHELL='+json.dumps({'family':args.family,'triangles':checks[0]['triangles'],'shards':len(shards),'bytes':len(raw),'volumeRelativeError':difference}))
