"""Independently reimport staged glass assets and measure their actual export contract."""
import argparse,bpy,bmesh,importlib.util,json,hashlib,sys,struct,math
from pathlib import Path
from mathutils import Vector
HERE=Path(__file__).resolve().parent
def module(name,filename):
    spec=importlib.util.spec_from_file_location(name,HERE/filename);result=importlib.util.module_from_spec(spec);spec.loader.exec_module(result);return result
solid=module('solid_validation','solid_fracture.py');inspection=module('source_inspection','inspect_donor.py')
parser=argparse.ArgumentParser();parser.add_argument('--family',required=True);args=parser.parse_args(sys.argv[sys.argv.index('--')+1:]);directory=HERE/'donors'/args.family
manifest=json.loads((directory/'finalization.json').read_text());path=HERE/manifest['bundle']['file'];raw=path.read_bytes()
if raw[:4]!=b'glTF' or struct.unpack_from('<I',raw,8)[0]!=len(raw):raise ValueError('Incomplete GLB')
length=struct.unpack_from('<I',raw,12)[0];gltf=json.loads(raw[20:20+length]);sha=hashlib.sha256(raw).hexdigest()
if sha!=manifest['bundle']['sha256']:raise ValueError('Staged bytes no longer match manifest')
for mesh in gltf['meshes']:
    for primitive in mesh['primitives']:
        if not {'POSITION','NORMAL','TEXCOORD_0'}<=primitive['attributes'].keys():raise ValueError('GLB lost required surface attributes')
material_rows={material['name']:material for material in gltf['materials']}
for name in ['glass_shell','glass_cut']:
    if material_rows.get(name,{}).get('extensions',{}).get('KHR_materials_transmission',{}).get('transmissionFactor',0)<.5:raise ValueError('Physical glass transmission was lost')
if material_rows.get('gold_trim',{}).get('pbrMetallicRoughness',{}).get('metallicFactor',0)<.9:raise ValueError('Gold metalness was lost')
bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=str(path));bpy.context.view_layer.update()
names=[manifest['intact'],*manifest['shards']];checks=[]
for name in names:
    obj=bpy.data.objects.get(name)
    if obj is None or obj.type!='MESH':raise ValueError('GLB lost named assembly '+name)
    # glTF intentionally splits vertices at material/normal/UV seams. Weld the
    # exact imported positions on an inspection copy, preserving the exported file.
    mesh=obj.data.copy();test=obj.copy();test.data=mesh;bpy.context.scene.collection.objects.link(test)
    bm=bmesh.new();bm.from_mesh(mesh);bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=1e-9);bm.to_mesh(mesh);bm.free();mesh.update()
    check=solid.mesh_check(test);check['name']=name
    if any(check[key] for key in ['nonManifoldEdges','nonManifoldVertices','nonContiguousEdges','selfIntersectionPairs','blenderMeshInvalid']):raise ValueError('Reimport surface gate failed: '+json.dumps(check))
    if check['signedVolume']<=0:raise ValueError('Reimported mesh has no positive solid volume')
    if any(not math.isfinite(value) for vertex in mesh.vertices for value in vertex.co):raise ValueError('Nonfinite position')
    checks.append(check);bpy.data.objects.remove(test,do_unlink=True);bpy.data.meshes.remove(mesh)
whole=checks[0]['signedVolume'];error=abs(sum(c['signedVolume'] for c in checks[1:])-whole)/whole
if error>1e-5:raise ValueError('Exported fragments no longer reconstruct intact volume')
intact=bpy.data.objects[manifest['intact']];lo,hi=inspection.bounds([intact]);rays=inspection.vertical_rays([intact],lo,hi,hi.z-lo.z)
report={'status':'passed','scope':'automated source/closedness/orientation/intersection/physical-material/GLB-reimport gates; visual review recorded separately','bundleSha256':sha,'bundleBytes':len(raw),'triangleTotalIncludingShards':sum(row['triangles'] for row in checks),'meshes':checks,'volumeRelativeError':error,'boundsBlenderZUp':{'min':list(lo),'max':list(hi)},'rays':rays,'materialSlots':list(material_rows),'uv0NormalsPreserved':True,'tangentsOnEveryPrimitive':all('TANGENT' in primitive['attributes'] for mesh in gltf['meshes'] for primitive in mesh['primitives'])}
(directory/'geometry-validation.json').write_text(json.dumps(report,indent=2)+'\n');print('EXPORTED_GLASS_VALIDATED='+json.dumps({k:report[k] for k in ['bundleBytes','triangleTotalIncludingShards','volumeRelativeError','materialSlots','tangentsOnEveryPrimitive']}))
