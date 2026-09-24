"""Audition source paint regions on the actual repaired50k coupe geometry."""
import bpy, json, importlib.util, numpy as np
from pathlib import Path
from PIL import Image, ImageDraw
from mathutils import Vector,Matrix
ROOT=Path(__file__).resolve().parents[3]; OUT=ROOT/'art/glass-adventure/v3/material-regions/aurora-coupe'; OUT.mkdir(parents=True,exist_ok=True)
spec=importlib.util.spec_from_file_location('transfer',ROOT/'art/glass-adventure/v3/texture_materials.py'); m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'art/glass-adventure/v3/donors/aurora-coupe/coupe-lod-50k-repaired.blend'))
bpy.context.preferences.filepaths.save_version=0
target=bpy.data.objects['coupe_aurora_intact']; before=[tuple(v.co) for v in target.data.vertices]
existing=set(bpy.data.objects)
bpy.ops.import_scene.gltf(filepath=str(ROOT/'art/glass-adventure/v2/meshy/aurora-coupe-01/donor.glb'))
sources=[o for o in bpy.data.objects if o not in existing and o.type=='MESH']
high=json.loads((ROOT/'art/glass-adventure/v3/donors/aurora-coupe-high-source/inspection.json').read_text())
lo=Vector(high['boundsInImportedBlenderCoordinates']['min']);hi=Vector(high['boundsInImportedBlenderCoordinates']['max']);origin=Vector(((lo.x+hi.x)/2,(lo.y+hi.y)/2,lo.z));scale=.4/(hi.z-lo.z)
for obj in sources:
    world=obj.matrix_world.copy();obj.parent=None;obj.matrix_world=Matrix.Identity(4)
    for v in obj.data.vertices:v.co=(world@v.co-origin)*scale
bpy.context.view_layer.update()
image=next(n.image for n in sources[0].data.materials[0].node_tree.nodes if n.type=='TEX_IMAGE' and n.name=='Image Texture')
pixels=np.empty(image.size[0]*image.size[1]*4,np.float32);image.pixels.foreach_get(pixels);pixels=pixels.reshape(image.size[1],image.size[0],4)[::-1]
atlas=Image.fromarray(np.uint8(np.round(np.clip(pixels,0,1)*255)))
points={'gold':[(755,121),(557,282),(1078,1613)],'glass':[(1344,384),(1792,128)]}
swatches={k:[(pixels[y,x,:3]).tolist() for x,y in p] for k,p in points.items()}
print('SOURCE_SWATCHES',swatches,flush=True)
# An annotated original atlas lets reviewers verify all sampled regions.
annotated=atlas.copy();draw=ImageDraw.Draw(annotated)
for kind,positions in points.items():
    for i,(x,y) in enumerate(positions):draw.ellipse((x-15,y-15,x+15,y+15),outline='red',width=3);draw.text((x+18,y),kind+str(i),fill='red')
annotated.save(OUT/'coupe-sampled-atlas.png')
report=m.classify_faces(target,sources,gold_srgb_samples=swatches['gold'],glass_srgb_samples=swatches['glass'],max_distance=.006,min_margin=.007,max_chroma_distance=.06)
assert before==[tuple(v.co) for v in target.data.vertices]
report['sourceSwatchCoordinatesTopLeft']=points;report['targetStatus']='Repaired50k coupe; optical-material review and fracture acceptance pending'
(OUT/'coupe-region-report.json').write_text(json.dumps(report,indent=2)+'\n')
print('COUPE_REGION_REPORT',json.dumps({k:report[k] for k in ['counts','distanceMetres']}),flush=True)
# Cyan=glass, gold=gold, magenta=unresolved; this is diagnostic, not final material.
materials=[]
for name,color in [('glass',(.1,.65,.7,1)),('gold',(.75,.43,.08,1)),('unresolved',(.9,.05,.5,1))]:
    mat=bpy.data.materials.new(name);mat.use_nodes=True;shader=mat.node_tree.nodes.get('Principled BSDF');shader.inputs['Base Color'].default_value=color;shader.inputs['Roughness'].default_value=.5;materials.append(mat)
target.data.materials.clear()
for mat in materials:target.data.materials.append(mat)
for row in report['faces']:target.data.polygons[row['face']].material_index={'glass_shell':0,'gold_trim':1,None:2}[row['material']]
for obj in sources:obj.hide_render=True
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=12;scene.cycles.use_denoising=True
scene.render.resolution_x=700;scene.render.resolution_y=850;scene.render.resolution_percentage=100
scene.world=bpy.data.worlds.new('diagnostic-world');scene.world.color=(.13,.13,.13)
for position,power in [((-1,-1,1.8),90),((1,-.5,.8),35),((0,1,1.5),100)]:
    light=bpy.data.lights.new('prooflight','AREA');light.energy=power;light.size=.7;obj=bpy.data.objects.new('prooflight',light);scene.collection.objects.link(obj);obj.location=position;obj.rotation_euler=(Vector((0,0,.22))-obj.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add();camera=bpy.context.object;camera.location=(.7,-1,.7);camera.data.type='ORTHO';camera.data.ortho_scale=.53;camera.rotation_euler=(Vector((0,0,.2))-camera.location).to_track_quat('-Z','Y').to_euler();scene.camera=camera
scene.view_settings.view_transform='AgX';scene.render.filepath=str(OUT/'coupe-regions-diagnostic.png');bpy.ops.render.render(write_still=True)
