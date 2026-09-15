"""Locate actual amphora cleanup deviation and render source/candidate side by side."""
import bpy,json,numpy as np,sys
from pathlib import Path
from mathutils import Vector,Matrix
from mathutils.bvhtree import BVHTree
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[4]
stem=sys.argv[sys.argv.index('--')+1] if '--' in sys.argv else 'clean-lod-v2'
if not stem.replace('-','').isalnum():raise ValueError('Use a family candidate stem')
bpy.ops.wm.open_mainfile(filepath=str(HERE/(stem+'.blend')))
candidate=bpy.data.objects['vase_amphora_intact']
target_points=[v.co.copy() for v in candidate.data.vertices];target_faces=[tuple(p.vertices) for p in candidate.data.polygons];tree=BVHTree.FromPolygons(target_points,target_faces,all_triangles=True)
existing=set(bpy.data.objects);bpy.ops.import_scene.gltf(filepath=str(ROOT/'art/glass-adventure/v2/meshy/moon-amphora-01/pre-remeshed.glb'))
source=next(o for o in bpy.data.objects if o not in existing and o.type=='MESH')
normalization=json.loads((HERE/'clean-voxel-trial.json').read_text())['normalization'];origin=Vector(normalization['sourceFootCentre']);scale=normalization['uniformScale'];world=source.matrix_world.copy();source.parent=None;source.matrix_world=Matrix.Identity(4)
for vertex in source.data.vertices:vertex.co=(world@vertex.co-origin)*scale
bpy.context.view_layer.update();rows=[]
for vertex in list(source.data.vertices)[::max(1,len(source.data.vertices)//16000)]:
 point,normal,index,distance=tree.find_nearest(vertex.co);rows.append({'sourceVertex':vertex.index,'sourcePosition':list(vertex.co),'candidatePosition':list(point),'candidateNormal':list(normal),'distanceMetres':distance})
rows.sort(key=lambda row:-row['distanceMetres']);values=[row['distanceMetres'] for row in rows]
report={'source':'actual high-detail Meshy donor normalized with common source transform','candidate':stem+'.blend','sampleCount':len(rows),'sourceToCandidateMetres':{k:float(np.quantile(values,q)) for k,q in [('p50',.5),('p95',.95),('p99',.99),('max',1)]},'samplesOver2mm':sum(d>.002 for d in values),'samplesOver5mm':sum(d>.005 for d in values),'largestDeviations':rows[:30]}
# Centre ray sees the floor of the open vessel then the underside, never a sealed mouth.
from mathutils import Vector
start=Vector((0,0,.65));hits=[]
for _ in range(15):
 point,normal,index,distance=tree.ray_cast(start,Vector((0,0,-1)),1)
 if point is None:break
 hits.append({'position':list(point),'normal':list(normal)});start=point-Vector((0,0,1e-6))
report['candidateCentreDownwardRays']=hits
(HERE/('source-fidelity-'+stem+'.json')).write_text(json.dumps(report,indent=2)+'\n');print('AMPHORA_FIDELITY='+json.dumps({k:v for k,v in report.items() if k!='largestDeviations'}),flush=True)
clay=bpy.data.materials.new('source-comparison-clay');clay.use_nodes=True;shader=clay.node_tree.nodes.get('Principled BSDF');shader.inputs['Base Color'].default_value=(.48,.57,.59,1);shader.inputs['Roughness'].default_value=.46
for obj in [source,candidate]:
 obj.data.materials.clear();obj.data.materials.append(clay)
 for face in obj.data.polygons:face.material_index=0;face.use_smooth=True
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=16;scene.cycles.use_denoising=True;scene.render.resolution_x=800;scene.render.resolution_y=1000;scene.render.resolution_percentage=100;scene.world=bpy.data.worlds.new('source-proof-world');scene.world.color=(.12,.12,.12)
for location,power in [((-1,-2,2),130),((1,-.5,1),60),((0,1,2),170)]:
 light=bpy.data.lights.new('source-proof-light','AREA');light.energy=power;light.size=.8;obj=bpy.data.objects.new('source-proof-light',light);scene.collection.objects.link(obj);obj.location=location;obj.rotation_euler=(Vector((0,0,.275))-obj.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add();camera=bpy.context.object;camera.data.type='ORTHO';scene.camera=camera;scene.view_settings.view_transform='AgX'
for view,position,target,size in [('three-quarter',(1,-1.6,.8),(0,0,.275),.715),('mouth',(0,-.7,1.25),(0,0,.43),.38)]:
 camera.location=position;camera.rotation_euler=(Vector(target)-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.ortho_scale=size
 for label,obj in [('high-source',source),(stem,candidate)]:
  if label=='high-source' and (HERE/(label+'-'+view+'.png')).exists():continue
  source.hide_render=obj!=source;candidate.hide_render=obj!=candidate;scene.render.filepath=str(HERE/(label+'-'+view+'.png'));bpy.ops.render.render(write_still=True)
