"""Finalize the inspected Meshy decanter as a hollow body and separate solid stopper."""
import argparse
import gzip
import hashlib
import importlib.util
import json
import math
from pathlib import Path
import struct
import sys

import bmesh
import bpy
from mathutils import Vector

HERE = Path(__file__).resolve().parent
DIRECTORY = HERE / 'donors/cut-crystal-decanter'
REGIONS = HERE / 'material-regions/cut-crystal-decanter/proof-v10'
PREFIX = 'decanter_cut'


def module(name, filename):
    spec = importlib.util.spec_from_file_location(name, HERE / filename)
    result = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(result)
    return result


solid = module('decanter_solid', 'solid_fracture.py')
inspection = module('decanter_inspection', 'inspect_donor.py')
metrics = module('decanter_metrics', 'finalize_donor.py')


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def physical(name, color, roughness, transmission=0, metalness=0):
    result = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    result.use_nodes = True
    shader = result.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Base Color'].default_value = (*color, 1)
    shader.inputs['Roughness'].default_value = roughness
    shader.inputs['Metallic'].default_value = metalness
    shader.inputs['Transmission Weight'].default_value = transmission
    shader.inputs['IOR'].default_value = 1.5
    return result


def checked(obj):
    report = solid.mesh_check(obj)
    if any(report[key] for key in ('nonManifoldEdges', 'nonManifoldVertices', 'nonContiguousEdges', 'selfIntersectionPairs', 'blenderMeshInvalid')) or report['signedVolume'] <= 0:
        raise ValueError('Decanter surface failed: '+json.dumps(report))
    return report | {'name':obj.name}


def prepare():
    source = DIRECTORY / 'prepared-cavity-v10.blend'
    destination = DIRECTORY / 'ready-intact.blend'
    if destination.exists():
        raise ValueError('Preserve existing prepared materials')
    if digest(source) != 'a124421396438bec812eefcb0250dd666b1e61393fc4c751b86c31590da1c9d0':
        raise ValueError('Inspected material masks require the exact v10 geometry')
    bpy.ops.wm.open_mainfile(filepath=str(source))
    bpy.context.preferences.filepaths.save_version = 0
    reports = json.load(gzip.open(REGIONS / 'face-labels.json.gz', 'rt'))
    # Inspected source-paint boundaries: 23 antialiased boundary faces stay glass;
    # one brown face inside the neck band and one inside the base band remain gold.
    gold = {17105, 24022}
    glass = {123,190,265,407,416,950,1588,1802,2470,10039,10088,13282,
             16907,16973,17076,17166,17200,17203,17314,17929,18618,20009,30360}
    materials = {'glass_shell':physical('glass_shell',(.95,.99,.985),.04,.98),
                 'glass_cut':physical('glass_cut',(.83,.98,.97),.14,.88),
                 'gold_trim':physical('gold_trim',(.76,.50,.17),.20,metalness=.95)}
    body, stopper = [bpy.data.objects[PREFIX+'_'+name] for name in ('body','stopper')]
    decisions = []
    for obj in (body, stopper):
        original = [tuple(v.co) for v in obj.data.vertices]
        generated = {f.index for f in obj.data.polygons if f.material_index == 1}
        labels = {row['face']:row['material'] for row in reports[obj.name]['faces']}
        unresolved = {index for index, label in labels.items() if label is None}
        expected = gold | glass if obj == body else set()
        if unresolved != expected:
            raise ValueError('Material boundary decisions do not match current topology')
        for index in unresolved:
            labels[index] = 'gold_trim' if index in gold else 'glass_shell'
            face = obj.data.polygons[index]
            centre = sum((obj.data.vertices[v].co for v in face.vertices),Vector())/len(face.vertices)
            decisions.append({'object':obj.name,'face':index,'material':labels[index], 'centreMetres':list(centre),
                'reason':('Within reviewed original neck/base paint band' if index in gold else 'Inspected antialiased edge of existing paint band; retain crisp glass-side boundary')})
        if generated & labels.keys() or len(generated)+len(labels) != len(obj.data.polygons):
            raise ValueError('Exterior labels must not paint generated cavity surfaces')
        obj.data.materials.clear()
        for material in materials.values():
            obj.data.materials.append(material)
        names = list(materials)
        for face in obj.data.polygons:
            face.material_index = names.index('glass_cut' if face.index in generated else labels[face.index])
        # The high donor has no UVs. This metre-based UV0 is shared by intact and
        # clipped exterior surfaces; the donor image supplies only reviewed paint masks.
        solid.cut.planar_uv(obj)
        solid.cut.select_only([obj])
        bpy.ops.object.shade_smooth_by_angle(angle=math.radians(20), keep_sharp_edges=True)
        if original != [tuple(v.co) for v in obj.data.vertices]:
            raise ValueError('Materials and shading must not move the Meshy-derived shape')
        checked(obj)
    root = bpy.data.objects[PREFIX]
    intact = bpy.data.objects.new(PREFIX+'_intact',None)
    bpy.context.scene.collection.objects.link(intact)
    intact.parent = root
    intact['role'] = 'intact'
    for obj in (body,stopper):
        obj.parent = intact
        obj['role'] = 'intact-part'
    bpy.ops.wm.save_as_mainfile(filepath=str(destination))
    report = {'status':'reviewed material boundaries applied; optical proof and fracture pending',
        'input':str(source.relative_to(HERE)),'inputSha256':digest(source),'preparedSha256':digest(destination),
        'materialDecisions':decisions,'interiorPaintedGold':False,'geometryChanged':False,
        'shading':'Smooth normals within 20 degrees; original geometric cut edges retained',
        'uv0':'Metre-based planar UV0 on donor without UVs; exterior UV0 preserved through clipping',
        'originalAtlasUsage':'Reviewed source paint labels only; no baked donor lighting used as glass color',
        'checks':[checked(body),checked(stopper)]}
    (DIRECTORY/'material-finalization.json').write_text(json.dumps(report,indent=2)+'\n')
    print('DECANTER_MATERIALS_READY='+json.dumps({'source':str(destination),'boundaryDecisions':len(decisions)}))


def finish():
    source = DIRECTORY/'ready-intact.blend'
    if (DIRECTORY/'finalized.blend').exists():
        raise ValueError('Preserve existing final export')
    bpy.ops.wm.open_mainfile(filepath=str(source))
    bpy.context.preferences.filepaths.save_version = 0
    root = bpy.data.objects[PREFIX]
    intact = bpy.data.objects[PREFIX+'_intact']
    body, stopper = [bpy.data.objects[PREFIX+'_'+name] for name in ('body','stopper')]
    checks = [checked(body),checked(stopper)]
    materials = {material.name:material for material in body.data.materials}
    seeds = solid.cut.surface_seeds(body,22,20260915)
    shards,backend = solid.fracture(body,root,seeds,materials,DIRECTORY/'fracture-work')
    if len(shards) != 22:
        raise ValueError('Body must yield the authored 22-piece assembly')
    fragment = stopper.copy()
    fragment.data = stopper.data.copy()
    bpy.context.scene.collection.objects.link(fragment)
    fragment.parent = root
    fragment.name = PREFIX+'_shard_022'
    fragment['role'] = 'shard'
    solid.cut.center_geometry(fragment)
    fragment.hide_render = True
    shards.append(fragment)
    shard_checks = [checked(obj) for obj in shards]
    volume = sum(row['signedVolume'] for row in checks)
    error = abs(sum(row['signedVolume'] for row in shard_checks)-volume)/volume
    if error > 1e-5:
        raise ValueError('Decanter fragment volumes do not reconstruct the body and stopper')
    bpy.ops.wm.save_as_mainfile(filepath=str(DIRECTORY/'finalized.blend'))
    output = HERE/'exports/cut-crystal-decanter.glb'
    output.parent.mkdir(exist_ok=True)
    solid.cut.select_only([root,intact,body,stopper,*shards])
    bpy.ops.export_scene.gltf(filepath=str(output),export_format='GLB',use_selection=True,export_yup=True,
        export_apply=True,export_extras=True,export_animations=False,export_tangents=True)
    preparation = json.loads((DIRECTORY/'prepared-cavity-v10.json').read_text())
    lo,hi = inspection.bounds([body,stopper])
    aggregate = {'name':intact.name,'triangles':sum(row['triangles'] for row in checks),
        'signedVolume':volume,'bounds':{'min':[lo.x,lo.z,-hi.y],'max':[hi.x,hi.z,-lo.y]}}
    report = {'status':'staged; independent GLB and optical validation pending','source':preparation['source'],
        'preparedInput':'ready-intact.blend','preparedSha256':digest(source),'units':'metres','up':'+Y','footCentred':True,
        'intact':intact.name,'intactParts':[body.name,stopper.name],'shards':[obj.name for obj in shards],
        'meshes':[aggregate,*[metrics.measure(obj) for obj in shards]],'surfaceChecks':checks+shard_checks,
        'fracture':{'method':'22 Manifold3D clipped body cells plus existing solid stopper',
            'restContact':'Body rim and stopper underside meet at natural neck plane; independent closed components, no union or internal overlap claim',
            'seedCoordinatesBlenderZUp':[list(seed) for seed in seeds],'volumeRelativeError':error,'backend':backend},
        'bundle':{'file':str(output.relative_to(HERE)),'bytes':output.stat().st_size,'sha256':digest(output)}}
    (DIRECTORY/'finalization.json').write_text(json.dumps(report,indent=2)+'\n')
    print('DECANTER_FINALIZED='+json.dumps({'triangles':aggregate['triangles'],'shards':len(shards),'bytes':output.stat().st_size,'volumeRelativeError':error}))


def load_export():
    manifest = json.loads((DIRECTORY/'finalization.json').read_text())
    path = HERE/manifest['bundle']['file']
    if digest(path) != manifest['bundle']['sha256']:
        raise ValueError('Final bundle changed after manifest')
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(path))
    bpy.context.view_layer.update()
    return manifest,path


def validate():
    manifest,path = load_export()
    raw = path.read_bytes()
    if raw[:4] != b'glTF' or struct.unpack_from('<I',raw,8)[0] != len(raw):
        raise ValueError('Incomplete GLB')
    length = struct.unpack_from('<I',raw,12)[0]
    gltf = json.loads(raw[20:20+length])
    primitives = [p for mesh in gltf['meshes'] for p in mesh['primitives']]
    if any(not {'POSITION','NORMAL','TEXCOORD_0','TANGENT'} <= p['attributes'].keys() for p in primitives):
        raise ValueError('GLB lost a surface attribute')
    materials = {m['name']:m for m in gltf['materials']}
    for name in ('glass_shell','glass_cut'):
        if materials[name].get('extensions',{}).get('KHR_materials_transmission',{}).get('transmissionFactor',0) < .5:
            raise ValueError('GLB lost physical glass')
    if materials['gold_trim']['pbrMetallicRoughness'].get('metallicFactor',0) < .9:
        raise ValueError('GLB lost physical gold')
    intact = bpy.data.objects[manifest['intact']]
    if intact.type != 'EMPTY' or {o.name for o in intact.children} != set(manifest['intactParts']):
        raise ValueError('GLB lost grouped intact assembly')
    checks = []
    for name in manifest['intactParts']+manifest['shards']:
        obj = bpy.data.objects.get(name)
        if obj is None or obj.type != 'MESH':
            raise ValueError('GLB lost named component '+name)
        mesh = obj.data.copy()
        test = obj.copy()
        test.data = mesh
        bpy.context.scene.collection.objects.link(test)
        bm = bmesh.new()
        bm.from_mesh(mesh)
        bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=1e-9)
        bm.to_mesh(mesh)
        bm.free()
        mesh.update()
        report = checked(test) | {'name':name}
        checks.append(report)
        if any(not math.isfinite(value) for vertex in mesh.vertices for value in vertex.co):
            raise ValueError('Nonfinite geometry')
        bpy.data.objects.remove(test,do_unlink=True)
        bpy.data.meshes.remove(mesh)
    whole = sum(row['signedVolume'] for row in checks[:2])
    error = abs(sum(row['signedVolume'] for row in checks[2:])-whole)/whole
    if error > 1e-5:
        raise ValueError('Exported fragments do not reconstruct assembled volume')
    parts = [bpy.data.objects[name] for name in manifest['intactParts']]
    lo,hi = inspection.bounds(parts)
    body = bpy.data.objects[PREFIX+'_body']
    blo,bhi = inspection.bounds([body])
    rays = inspection.vertical_rays([body],blo,bhi,.52)
    report = {'status':'passed','scope':'Fresh GLB reimport; each body, stopper and shard independently closed, oriented and nonintersecting',
        'restContact':'Body rim and stopper underside contact at the authored neck plane; separate component checks avoid treating intended contact as a self-intersection',
        'bundleSha256':digest(path),'bundleBytes':len(raw),'triangleTotalIncludingShards':sum(row['triangles'] for row in checks),
        'meshes':checks,'volumeRelativeError':error,'boundsBlenderZUp':{'min':list(lo),'max':list(hi)},
        'bodyMouthRays':rays,'materialSlots':list(materials),'uv0NormalsPreserved':True,'tangentsOnEveryPrimitive':True,
        'externalImages':gltf.get('images',[])}
    (DIRECTORY/'geometry-validation.json').write_text(json.dumps(report,indent=2)+'\n')
    print('DECANTER_EXPORT_VALIDATED='+json.dumps({key:report[key] for key in ('bundleBytes','triangleTotalIncludingShards','volumeRelativeError','materialSlots')}))


def render():
    manifest,path = load_export()
    parts = [bpy.data.objects[name] for name in manifest['intactParts']]
    shards = [bpy.data.objects[name] for name in manifest['shards']]
    for obj in shards:
        obj.hide_render = True
    for obj in parts:
        obj.hide_render = False
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.samples = 48
    scene.cycles.use_denoising = True
    scene.cycles.transmission_bounces = 16
    scene.render.threads_mode = 'FIXED'
    scene.render.threads = 4
    scene.render.resolution_x = 1000
    scene.render.resolution_y = 1200
    scene.render.resolution_percentage = 100
    scene.world = bpy.data.worlds.new('decanter-optical-world')
    scene.world.use_nodes = True
    background = scene.world.node_tree.nodes.get('Background')
    background.inputs[0].default_value = (.032,.043,.049,1)
    background.inputs[1].default_value = .5
    height = .52
    for position,power,color in [((-2,-3,4),400,(1,.89,.72)),((3,-1,2),260,(.70,.90,1)),((0,3,3),600,(1,.95,.84))]:
        light = bpy.data.lights.new('decanter-proof-light','AREA')
        light.energy = power*height*height
        light.shape = 'RECTANGLE'
        light.size = height*2
        light.size_y = height*.3
        light.color = color
        obj = bpy.data.objects.new('decanter-proof-light',light)
        scene.collection.objects.link(obj)
        obj.location = Vector(position)*height
        obj.rotation_euler = (Vector((0,0,height*.5))-obj.location).to_track_quat('-Z','Y').to_euler()
    bpy.ops.mesh.primitive_plane_add(size=height*200,location=(0,0,-.01*height))
    bpy.context.object.data.materials.append(physical('optical-proof-floor',(.035,.046,.054),.34))
    bpy.ops.object.camera_add(location=(height*1.5,-height*3,height*1.2))
    camera = bpy.context.object
    camera.rotation_euler = (Vector((0,0,height*.5))-camera.location).to_track_quat('-Z','Y').to_euler()
    camera.data.type = 'ORTHO'
    camera.data.ortho_scale = height*1.3
    scene.camera = camera
    scene.view_settings.view_transform = 'AgX'
    scene.render.filepath = str(DIRECTORY/'finalized-intact.png')
    bpy.ops.render.render(write_still=True)
    for obj in parts:
        obj.hide_render = True
    for shard in shards:
        shard.hide_render = False
        centre = sum((shard.matrix_world@v.co for v in shard.data.vertices),Vector())/len(shard.data.vertices)
        shard.location += Vector((centre.x*.4,centre.y*.4,(centre.z-height*.45)*.18))
    camera.data.ortho_scale *= 1.14
    scene.render.filepath = str(DIRECTORY/'finalized-fracture.png')
    bpy.ops.render.render(write_still=True)
    if digest(path) != manifest['bundle']['sha256']:
        raise ValueError('Proof modified exported file')
    print('DECANTER_OPTICAL_PROOF_READY')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--prepare',action='store_true')
    parser.add_argument('--validate',action='store_true')
    parser.add_argument('--render',action='store_true')
    args = parser.parse_args(sys.argv[sys.argv.index('--')+1:])
    if args.prepare:
        prepare()
    elif args.validate:
        validate()
    elif args.render:
        render()
    else:
        finish()


if __name__ == '__main__':
    main()
