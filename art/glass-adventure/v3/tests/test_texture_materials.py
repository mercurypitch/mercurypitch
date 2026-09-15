"""Blender fixture: barycentric paint labels preserve geometry and reject uncertainty."""
import importlib.util, json, math
from pathlib import Path
import bpy, numpy as np
from mathutils import Matrix
ROOT=Path(__file__).resolve().parents[4]
spec=importlib.util.spec_from_file_location('transfer',ROOT/'art/glass-adventure/v3/texture_materials.py'); m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
bpy.ops.wm.read_factory_settings(use_empty=True)
# Disconnected source UV charts and varying corner UVs exercise barycentric interpolation.
mesh=bpy.data.meshes.new('source');mesh.from_pydata([(0,0,0),(1,0,0),(0,1,0),(2,0,0),(3,0,0),(2,1,0)],[],[(0,1,2),(3,4,5)])
source=bpy.data.objects.new('source',mesh);bpy.context.scene.collection.objects.link(source)
source.matrix_world=Matrix.Translation((4,-3,2))@Matrix.Diagonal((2,3,1,1))
uv=mesh.uv_layers.new();uv.active_render=True
for index,coordinate in enumerate([(0,.25),(.75,.25),(0,.75),(.5,.25),(1.25,.25),(.5,.75)]):
    uv.data[index].uv=coordinate
image=bpy.data.images.new('reviewed-color-fixture',width=8,height=4)
image.colorspace_settings.name='sRGB'
glass=np.array([.6,.6,.6]);gold=np.array([.75,.55,.25])
values=np.ones((4,8,4),np.float32);values[:,:4,:3]=glass;values[:,4:,:3]=gold
image.pixels.foreach_set(values.ravel())
mat=bpy.data.materials.new('donor');mat.use_nodes=True;node=mat.node_tree.nodes.new('ShaderNodeTexImage');node.image=image
mat.node_tree.links.new(node.outputs['Color'],mat.node_tree.nodes.get('Principled BSDF').inputs['Base Color']);mesh.materials.append(mat)
target=bpy.data.objects.new('target',mesh.copy());bpy.context.scene.collection.objects.link(target);target.matrix_world=source.matrix_world.copy()
target.data.uv_layers.remove(target.data.uv_layers[0])
before=[tuple(v.co) for v in target.data.vertices];source_mats=list(source.data.materials)
options=dict(gold_srgb_samples=[gold.tolist()],glass_srgb_samples=[glass.tolist()],max_distance=.001,min_margin=.01,max_chroma_distance=.1)
report=m.classify_faces(target,[source],**options)
assert [r['material'] for r in report['faces']]==['glass_shell','gold_trim'],report
assert np.allclose(report['faces'][0]['sourceRgbSrgb'],glass,atol=1/255)
assert np.allclose(report['faces'][1]['sourceRgbSrgb'],gold,atol=1/255)
assert before==[tuple(v.co) for v in target.data.vertices] and len(target.data.uv_layers)==0
assert list(source.data.materials)==source_mats
# Reject a target outside the inspected distance, and make applying unresolved labels atomic.
target.location.z+=.1
bpy.context.view_layer.update()
rejected=m.classify_faces(target,[source],**options)
assert all(r['material'] is None and 'outside-source-distance' in r['reasons'] for r in rejected['faces'])
try:m.apply_face_labels(target,rejected,{'glass_shell':mat,'gold_trim':mat})
except ValueError:pass
else:raise AssertionError('unresolved labels applied')
assert len(target.data.materials)==1
try:m.classify_faces(target,[source],**dict(options,gold_srgb_samples=[glass.tolist()]))
except ValueError:pass
else:raise AssertionError('overlapping swatches accepted')
target.location.z-=.1
bpy.context.view_layer.update()
m.apply_face_labels(target,report,{'glass_shell':mat,'gold_trim':bpy.data.materials.new('physical-gold')})
assert [p.material_index for p in target.data.polygons]==[0,1]
assert before==[tuple(v.co) for v in target.data.vertices] and list(source.data.materials)==source_mats
print('MATERIAL_TRANSFER_FIXTURE_PASS '+json.dumps(report['counts']))
