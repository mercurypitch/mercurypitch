"""Render diagnostic panels of a GLB: clay, zebra, wire, material x three_quarter/front/top.

blender -b --factory-startup --python render_views.py -- IN.glb OUT_DIR [--res 400] [--samples 32]
Writes OUT_DIR/<mode>_<view>.png and OUT_DIR/meta.json.
"""
import bpy, bmesh, sys, os, json, math, time, re
from mathutils import Vector

argv = sys.argv[sys.argv.index('--') + 1:]
src, out_dir = argv[0], argv[1]
res = int(argv[argv.index('--res') + 1]) if '--res' in argv else 400
samples = int(argv[argv.index('--samples') + 1]) if '--samples' in argv else 32
modes = argv[argv.index('--modes') + 1].split(',') if '--modes' in argv else ['clay', 'zebra', 'wire', 'material']
views = argv[argv.index('--views') + 1].split(',') if '--views' in argv else ['three_quarter', 'front', 'top']
os.makedirs(out_dir, exist_ok=True)

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
scn = bpy.context.scene

hide_re = re.compile(argv[argv.index('--hide') + 1], re.I) if '--hide' in argv else None
meshes = [o for o in scn.objects if o.type == 'MESH']
# Collision proxies are physics data, not art: never judge them as visible geometry.
proxies = [o for o in meshes if o.name.upper().startswith('COLLIDER') or o.get('collision_proxy')]
extra = [o for o in meshes if hide_re and hide_re.search(o.name)]
shards = [o for o in meshes if '_shard_' in o.name.lower()]
non_shards = [o for o in meshes if o not in shards and o not in proxies]
hidden = (shards if non_shards else []) + proxies + extra
for o in hidden:
    o.hide_render = True
visible = [o for o in meshes if o not in hidden]

lo = Vector((1e9,) * 3); hi = Vector((-1e9,) * 3); tris = 0
for o in visible:
    for c in o.bound_box:
        w = o.matrix_world @ Vector(c)
        lo = Vector(map(min, lo, w)); hi = Vector(map(max, hi, w))
    tris += sum(len(p.vertices) - 2 for p in o.data.polygons)
center = (lo + hi) / 2; dims = hi - lo; diag = dims.length

scn.render.resolution_x = scn.render.resolution_y = res
scn.render.resolution_percentage = 100
scn.render.film_transparent = False
world = bpy.data.worlds.new('diag_world'); scn.world = world
world.color = (0.30, 0.33, 0.36)

cam_data = bpy.data.cameras.new('diag_cam'); cam = bpy.data.objects.new('diag_cam', cam_data)
scn.collection.objects.link(cam); scn.camera = cam


def place_camera(view):
    far = diag * 4 + 1
    cam_data.clip_start = max(diag * 0.001, 1e-4); cam_data.clip_end = far * 4
    if view == 'three_quarter':
        cam_data.type = 'PERSP'; cam_data.lens = 40; cam_data.sensor_width = 36
        fov = 2 * math.atan(18 / 40)
        d = (0.5 * diag) / math.sin(fov / 2) * 1.02
        v = Vector((1.0, -1.3, 0.8)).normalized()
        cam.location = center + v * d
        cam.rotation_euler = (center - cam.location).to_track_quat('-Z', 'Y').to_euler()
        return d
    cam_data.type = 'ORTHO'
    if view == 'front':
        cam.location = center + Vector((0, -far, 0)); cam.rotation_euler = (math.pi / 2, 0, 0)
        cam_data.ortho_scale = max(dims.x, dims.z) * 1.12
    elif view == 'side':
        cam.location = center + Vector((far, 0, 0)); cam.rotation_euler = (math.pi / 2, 0, math.pi / 2)
        cam_data.ortho_scale = max(dims.y, dims.z) * 1.12
    elif view == 'top':
        cam.location = center + Vector((0, 0, far)); cam.rotation_euler = (0, 0, 0)
        cam_data.ortho_scale = max(dims.x, dims.y) * 1.12
    return far


def setup_workbench(mode):
    scn.render.engine = 'BLENDER_WORKBENCH'
    sh = scn.display.shading
    sh.color_type = 'SINGLE'; sh.single_color = (0.78, 0.78, 0.78)
    sh.show_object_outline = False
    sh.show_specular_highlight = True
    if mode == 'clay':
        sh.light = 'STUDIO'
        sh.show_cavity = True; sh.cavity_type = 'BOTH'
        sh.cavity_ridge_factor = 1.0; sh.cavity_valley_factor = 1.0
        sh.curvature_ridge_factor = 1.0; sh.curvature_valley_factor = 1.0
    else:  # zebra: vertical reflection stripes expose wobble and broken continuity
        sh.light = 'MATCAP'; sh.show_cavity = False
        for name in ('check_reflection_horizontal.exr', 'check_reflection_vertical.exr', 'basic_grey.exr'):
            try:
                sh.studio_light = name; break
            except Exception:
                continue
    scn.display.render_aa = '8'
    scn.view_layers[0].material_override = None


wire_mat = None


def make_wire_material():
    m = bpy.data.materials.new('diag_wire'); m.use_nodes = True
    nt = m.node_tree; nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    wf = nt.nodes.new('ShaderNodeWireframe'); wf.use_pixel_size = True; wf.inputs['Size'].default_value = 1.0
    diff = nt.nodes.new('ShaderNodeBsdfDiffuse'); diff.inputs['Color'].default_value = (0.75, 0.75, 0.75, 1)
    emit = nt.nodes.new('ShaderNodeEmission'); emit.inputs['Color'].default_value = (0.02, 0.05, 0.09, 1)
    emit.inputs['Strength'].default_value = 1.0
    mix = nt.nodes.new('ShaderNodeMixShader')
    nt.links.new(wf.outputs['Fac'], mix.inputs['Fac'])
    nt.links.new(diff.outputs['BSDF'], mix.inputs[1]); nt.links.new(emit.outputs['Emission'], mix.inputs[2])
    nt.links.new(mix.outputs['Shader'], out.inputs['Surface'])
    return m


def setup_world_gradient():
    world.use_nodes = True
    nt = world.node_tree; nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputWorld'); bg = nt.nodes.new('ShaderNodeBackground')
    tc = nt.nodes.new('ShaderNodeTexCoord'); sep = nt.nodes.new('ShaderNodeSeparateXYZ')
    ramp = nt.nodes.new('ShaderNodeValToRGB')
    nt.links.new(tc.outputs['Generated'], sep.inputs['Vector'])
    nt.links.new(sep.outputs['Z'], ramp.inputs['Fac'])
    # Generated world coordinates run 0..1 bottom to top
    ramp.color_ramp.elements[0].position = 0.35; ramp.color_ramp.elements[0].color = (0.05, 0.05, 0.06, 1)
    e = ramp.color_ramp.elements.new(0.5); e.color = (0.95, 0.93, 0.9, 1)
    ramp.color_ramp.elements[-1].position = 0.9; ramp.color_ramp.elements[-1].color = (0.32, 0.42, 0.55, 1)
    nt.links.new(ramp.outputs['Color'], bg.inputs['Color']); bg.inputs['Strength'].default_value = 1.0
    nt.links.new(bg.outputs['Background'], out.inputs['Surface'])


key = None


def setup_cycles(mode, dist):
    global wire_mat, key
    scn.render.engine = 'CYCLES'
    c = scn.cycles
    c.device = 'CPU'; c.samples = samples if mode == 'material' else max(12, samples // 2)
    c.use_denoising = True
    c.max_bounces = 12; c.transmission_bounces = 10; c.transparent_max_bounces = 16; c.glossy_bounces = 6
    c.use_adaptive_sampling = True
    setup_world_gradient()
    if key is None:
        ld = bpy.data.lights.new('diag_key', 'AREA'); key = bpy.data.objects.new('diag_key', ld)
        scn.collection.objects.link(key)
    key.data.size = max(diag, 0.2)
    kv = Vector((-0.7, -1.0, 1.3)).normalized()
    key.location = center + kv * dist * 1.1
    key.rotation_euler = (center - key.location).to_track_quat('-Z', 'Y').to_euler()
    key.data.energy = 60.0 * (dist * 1.1) ** 2
    if mode == 'wire':
        if wire_mat is None:
            wire_mat = make_wire_material()
        scn.view_layers[0].material_override = wire_mat
    else:
        scn.view_layers[0].material_override = None


panels = []
t0 = time.time()
for view in views:
    dist = place_camera(view)
    for mode in modes:
        if mode in ('clay', 'zebra'):
            setup_workbench(mode)
        else:
            setup_cycles(mode, dist if view == 'three_quarter' else diag * 1.6)
        path = os.path.join(out_dir, f'{mode}_{view}.png')
        scn.render.filepath = path
        t = time.time()
        bpy.ops.render.render(write_still=True)
        panels.append({'mode': mode, 'view': view, 'path': path, 'seconds': round(time.time() - t, 2)})

meta = {'source': src, 'visibleObjects': len(visible), 'hiddenShards': len([o for o in hidden if o in shards]), 'hiddenProxies': len(proxies), 'tris': tris,
        'dims_m': [round(x, 3) for x in dims], 'panels': panels, 'seconds': round(time.time() - t0, 1)}
json.dump(meta, open(os.path.join(out_dir, 'meta.json'), 'w'), indent=1)
print('RENDER_VIEWS_DONE', out_dir, meta['seconds'])
