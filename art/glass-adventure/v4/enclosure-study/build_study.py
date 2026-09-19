"""Assemble a separate museum room from the actual V4 bays and existing donor art."""
import argparse
import hashlib
import json
import math
from pathlib import Path
import sys
import bpy
from mathutils import Matrix, Vector

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[3]
ARCH = HERE.parent / 'architecture'
PUBLIC = REPO / 'apps/beside-cue/public/games'
RECEIPTS = []


def load_group(path, root_name):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(path))
    imported = set(bpy.data.objects) - before
    root = next(o for o in imported if o.name == root_name)
    keep = {root, *root.children_recursive}
    for obj in imported - keep:
        bpy.data.objects.remove(obj, do_unlink=True)
    meshes = [o for o in keep if o.type == 'MESH']
    # Store transformed donor vertices in shared mesh datablocks once. Linked
    # duplicates below retain UVs, normals, atlas materials and all donor faces.
    for obj in meshes:
        world = obj.matrix_world.copy()
        obj.parent = None
        obj.data.transform(world)
        obj.matrix_world = Matrix.Identity(4)
    for obj in keep:
        if obj.type != 'MESH':
            bpy.data.objects.remove(obj, do_unlink=True)
    RECEIPTS.append({'path': str(path.relative_to(REPO)),
                     'sha256': hashlib.sha256(path.read_bytes()).hexdigest(),
                     'root': root_name})
    return meshes


def bounds(meshes):
    vertices = [o.matrix_world @ v.co for o in meshes for v in o.data.vertices]
    return (Vector([min(v[i] for v in vertices) for i in range(3)]),
            Vector([max(v[i] for v in vertices) for i in range(3)]))


def place(meshes, name, position, angle=0, scale=1):
    group = bpy.data.objects.new(name, None)
    bpy.context.scene.collection.objects.link(group)
    group.location = position
    group.rotation_euler.z = angle
    group.scale = (scale,) * 3
    for donor in meshes:
        obj = donor.copy()
        obj.data = donor.data
        bpy.context.scene.collection.objects.link(obj)
        obj.parent = group
        obj.matrix_basis = Matrix.Identity(4)
    return group


def physical_floor_materials(meshes):
    roles = {'museum_ivory': 'warm-carrara', 'museum_petrol': 'verde-marble',
             'museum_limestone': 'cream-limestone', 'museum_brass': 'brushed-brass'}
    for obj in meshes:
        uv = obj.data.uv_layers.active or obj.data.uv_layers.new()
        for polygon in obj.data.polygons:
            for i in polygon.loop_indices:
                co = obj.data.vertices[obj.data.loops[i].vertex_index].co
                uv.data[i].uv = (co.x, co.y)
        for slot in obj.material_slots:
            material = slot.material
            role = next((role for role in roles if material.name.startswith(role)), None)
            if role is None or material.get('study_pbr'):
                continue
            material['study_pbr'] = True
            material.use_nodes = True
            nodes, links = material.node_tree.nodes, material.node_tree.links
            shader = next(n for n in nodes if n.type == 'BSDF_PRINCIPLED')
            texcoord = nodes.new('ShaderNodeTexCoord')
            mapping = nodes.new('ShaderNodeVectorMath'); mapping.operation = 'SCALE'
            mapping.inputs[3].default_value = 4 if role == 'museum_brass' else 1/1.2
            links.new(texcoord.outputs['UV'], mapping.inputs[0])
            for channel, socket in [('basecolor','Base Color'),('roughness','Roughness'),('normal','Normal')]:
                image = bpy.data.images.load(str(PUBLIC/'adventure-v2/textures'/f'{roles[role]}-{channel}.png'), check_existing=True)
                image.colorspace_settings.name = 'sRGB' if channel == 'basecolor' else 'Non-Color'
                texture = nodes.new('ShaderNodeTexImage'); texture.image = image
                links.new(mapping.outputs['Vector'], texture.inputs['Vector'])
                if channel == 'normal':
                    normal = nodes.new('ShaderNodeNormalMap')
                    links.new(texture.outputs['Color'], normal.inputs['Color'])
                    links.new(normal.outputs['Normal'], shader.inputs[socket])
                else:
                    links.new(texture.outputs['Color'], shader.inputs[socket])
            shader.inputs['Metallic'].default_value = 1 if role == 'museum_brass' else 0


def camera(name, location, target, lens):
    data = bpy.data.cameras.new(name); data.lens = lens
    obj = bpy.data.objects.new(name, data); bpy.context.scene.collection.objects.link(obj)
    obj.location = location
    obj.rotation_euler = (Vector(target)-obj.location).to_track_quat('-Z','Y').to_euler()
    return obj


def main():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.unit_settings.system = 'METRIC'
    window = load_group(ARCH/'exports/museum-window-bay-01-final-v1.glb', 'meshy_museum_window_bay')
    screen = load_group(ARCH/'exports/museum-screen-bay-01-final-v1.glb', 'meshy_museum_screen_bay')
    w = bounds(window)[1].x-bounds(window)[0].x
    s = bounds(screen)[1].x-bounds(screen)[0].x
    seam_overlap = .06
    width = w*2+s-seam_overlap*2
    depth = w+s-seam_overlap
    placements = []
    def bay(source, name, position, angle=0):
        place(source, name, position, angle)
        placements.append({'name': name, 'kind': 'window' if source is window else 'screen',
                           'position': list(position), 'rotationZ': angle})
    bay(window, 'North window west', (-(s+w)/2+seam_overlap, depth/2, 0))
    bay(screen, 'North blind screen', (0, depth/2, 0))
    bay(window, 'North window east', ((s+w)/2-seam_overlap, depth/2, 0))
    for side, x, angle in [('West',-width/2,math.pi/2),('East',width/2,-math.pi/2)]:
        bay(screen, side+' blind screen', (x,-depth/2+s/2,0), angle)
        bay(window, side+' window', (x,depth/2-w/2,0), angle)
    bay(screen,'South entry west',(-width/2+s/2,-depth/2,0),math.pi)
    bay(screen,'South entry east',(width/2-s/2,-depth/2,0),math.pi)
    # The central south opening intentionally has no bay, wall or invisible
    # mesh. It is a proposed doorway; this study has no runtime collision.
    floor = load_group(PUBLIC/'adventure-v2/platform-kit.glb','platform_terrace')
    lo, hi = bounds(floor)
    for obj in floor:
        for vertex in obj.data.vertices:
            vertex.co.x *= (width+.75)/(hi.x-lo.x)
            vertex.co.y *= (depth+.75)/(hi.y-lo.y)
            vertex.co.z -= hi.z
    physical_floor_materials(floor)
    # A small number of existing donor objects supply scale and an outside
    # destination. Their source forms are never remodeled for this room study.
    column = load_group(PUBLIC/'adventure-v3/gilded-column.glb','meshy_gilded_column')
    place(column,'Distant colonnade left',(-6.2,8,0),scale=1.25)
    place(column,'Distant colonnade right',(6.2,8,0),scale=1.25)
    canopy = load_group(PUBLIC/'adventure-v3/observatory-canopy.glb','meshy_observatory_canopy')
    place(canopy,'Distant observatory',(-7.6,12,-.4),scale=1.7)
    pedestal = load_group(PUBLIC/'adventure-v2/platform-kit.glb','platform_plinth')
    # Existing authored plinth height is normalized uniformly, retaining form.
    lo, hi = bounds(pedestal)
    plinth_scale = .6/(hi.z-lo.z)
    place(pedestal,'Exhibit plinth left',(-2.6,1.2,-lo.z*plinth_scale),scale=plinth_scale)
    place(pedestal,'Exhibit plinth right',(2.6,1.2,-lo.z*plinth_scale),scale=plinth_scale)
    physical_floor_materials(pedestal)
    amphora = load_group(PUBLIC/'adventure-v3/moon-amphora.glb','vase_amphora_intact')
    place(amphora,'Amphora exhibit',(-2.6,1.2,.6),scale=1.35)
    coupe = load_group(PUBLIC/'adventure-v3/aurora-coupe.glb','coupe_aurora_intact')
    place(coupe,'Coupe exhibit',(2.6,1.2,.6),scale=1.6)
    # Delete the import templates only; every instance keeps their shared data.
    for source in [window,screen,column,canopy,pedestal,amphora,coupe]:
        for obj in source:
            bpy.data.objects.remove(obj,do_unlink=True)
    scene.world = bpy.data.worlds.new('Golden coast outside'); scene.world.use_nodes=True
    nodes,links=scene.world.node_tree.nodes,scene.world.node_tree.links
    env=nodes.new('ShaderNodeTexEnvironment')
    env.image=bpy.data.images.load(str(PUBLIC/'adventure-v2/environment/golden-coast.hdr'))
    lighting=nodes.get('Background')
    links.new(env.outputs['Color'],lighting.inputs['Color'])
    lighting.inputs['Strength'].default_value=.7
    # The unchanged HDRI supplies physical light; the already approved cloud
    # panorama supplies visible sky without its unrelated beach buildings.
    visible_env=nodes.new('ShaderNodeTexEnvironment')
    visible_env.image=bpy.data.images.load(str(PUBLIC/'adventure/museum-sky.webp'))
    visible=nodes.new('ShaderNodeBackground');visible.inputs['Strength'].default_value=.65
    links.new(visible_env.outputs['Color'],visible.inputs['Color'])
    light_path=nodes.new('ShaderNodeLightPath');mix=nodes.new('ShaderNodeMixShader')
    links.new(light_path.outputs['Is Camera Ray'],mix.inputs[0])
    links.new(lighting.outputs[0],mix.inputs[1]);links.new(visible.outputs[0],mix.inputs[2])
    links.new(mix.outputs[0],nodes.get('World Output').inputs['Surface'])
    sun_data=bpy.data.lights.new('Late morning opening light','SUN');sun_data.energy=1.4;sun_data.angle=.09
    sun_data.color=(1,.89,.74)
    sun=bpy.data.objects.new('Late morning opening light',sun_data);scene.collection.objects.link(sun)
    sun.rotation_euler=(math.radians(31),math.radians(-21),math.radians(-145))
    fill_data=bpy.data.lights.new('Open sky fill','AREA');fill_data.energy=550;fill_data.size=7
    fill=bpy.data.objects.new('Open sky fill',fill_data);scene.collection.objects.link(fill);fill.location=(0,0,6)
    camera('Interior', (0,-2.7,1.45), (0,2.8,1.55), 18)
    camera('Window sightline', (-2.55,-.2,1.18), (-2.6,5.5,1.35), 24)
    camera('Room overview', (11,-12,10), (0,.35,1.05), 46)
    scene.render.engine='CYCLES';scene.cycles.samples=24;scene.cycles.use_denoising=True
    scene.cycles.max_bounces=8;scene.cycles.transmission_bounces=6
    scene.render.threads_mode='FIXED';scene.render.threads=4
    scene.render.resolution_x=1280;scene.render.resolution_y=800;scene.render.resolution_percentage=100
    scene.render.image_settings.file_format='PNG';scene.view_settings.view_transform='AgX'
    scene.camera=bpy.data.objects['Interior']
    bpy.ops.file.pack_all()
    (HERE/'proofs').mkdir(parents=True,exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(HERE/'enclosure-study-v1.blend'))
    meshes=[o for o in scene.objects if o.type=='MESH']
    for obj in meshes: obj.data.calc_loop_triangles()
    report={'status':'assembled-awaiting-visual-inspection','liveRuntimeModified':False,
        'coordinateSpace':'Blender Z up, metres','moduleHeightMetres':3.6,
        'roomCenterlineSizeMetres':[width,depth], 'entryGapMetres':width-2*s,
        'seamOverlapMetres':seam_overlap,'placements':placements,
        'bayInstances':len(placements),'bayUniqueTriangles':22204+19479,
        'instanceTriangles':sum(len(o.data.loop_triangles) for o in meshes),
        'uniqueMeshTriangles':sum(len(m.loop_triangles) for m in set(o.data for o in meshes)),
        'sources':RECEIPTS,'cameras':[{'name':o.name,'position':list(o.location),'lens':o.data.lens} for o in scene.objects if o.type=='CAMERA'],
        'limitations':['Visual enclosure study only; no live level replacement or movement/camera acceptance.',
                      'Walls retain source silhouette irregularities; 60 mm nominal cornice overlap is not a watertight corner contract.',
                      'Window sill is about 0.95 m; Merc eye-level around 0.55 m will not see through from a low camera.',
                      'Exterior donors are visual backdrop references, not connected walkable platforms.']}
    (HERE/'manifest.json').write_text(json.dumps(report,indent=2)+'\n')
    return report


def render(view):
    scene=bpy.context.scene
    scene.camera=bpy.data.objects[view]
    scene.render.filepath=str(HERE/'proofs'/f'{view.lower().replace(" ","-")}.png')
    bpy.ops.render.render(write_still=True)
    return {'image':scene.render.filepath}


if __name__=='__main__':
    main()
