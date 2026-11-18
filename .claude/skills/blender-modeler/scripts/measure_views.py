"""Part-ID false-colour front render plus measured callouts projected to pixels.

blender -b --factory-startup --python measure_views.py -- IN.glb OUT_DIR [--res 900]
Writes OUT_DIR/parts_front.png and OUT_DIR/measure.json (lines and dots in pixel space).
Radii are measured by slicing the evaluated mesh with horizontal planes, so the numbers
are the real silhouette, not bounding boxes.
"""
import bpy, bmesh, sys, os, json, math
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view

argv = sys.argv[sys.argv.index('--') + 1:]
src, out_dir = argv[0], argv[1]
res = int(argv[argv.index('--res') + 1]) if '--res' in argv else 900
hide = argv[argv.index('--hide') + 1].lower() if '--hide' in argv else None
os.makedirs(out_dir, exist_ok=True)

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
scn = bpy.context.scene
meshes = [o for o in scn.objects if o.type == 'MESH' and '_shard_' not in o.name.lower()
          and not o.name.upper().startswith('COLLIDER') and not o.get('collision_proxy')
          and not (hide and hide in o.name.lower())]
for o in scn.objects:
    if o.type == 'MESH' and o not in meshes:
        o.hide_render = True

palette = [(0.90, 0.30, 0.25), (0.25, 0.60, 0.95), (0.30, 0.80, 0.40), (0.95, 0.75, 0.20),
           (0.70, 0.40, 0.90), (0.20, 0.85, 0.85), (0.95, 0.50, 0.70), (0.60, 0.60, 0.60)]
parts = []
for i, o in enumerate(sorted(meshes, key=lambda o: o.name)):
    c = palette[i % len(palette)]
    o.color = (*c, 1.0)
    parts.append({'name': o.name, 'rgb': [round(x * 255) for x in c]})

lo = Vector((1e9,) * 3); hi = Vector((-1e9,) * 3)
world_tris = []
for o in meshes:
    bm = bmesh.new(); bm.from_mesh(o.data); bm.transform(o.matrix_world)
    bmesh.ops.triangulate(bm, faces=bm.faces)
    for f in bm.faces:
        tri = [v.co.copy() for v in f.verts]
        world_tris.append((o.name, tri))
        for p in tri:
            lo = Vector(map(min, lo, p)); hi = Vector(map(max, hi, p))
    bm.free()
center = (lo + hi) / 2; dims = hi - lo


def radius_at(z, names=None):
    """Body radius at height z: the slice's extent along depth (Y), which handles at +-X do not reach."""
    best = 0.0
    for name, (a, b, c) in world_tris:
        if names and name not in names:
            continue
        for p, q in ((a, b), (b, c), (c, a)):
            if (p.z - z) * (q.z - z) <= 0 and p.z != q.z:
                t = (z - p.z) / (q.z - p.z)
                y = p.y + (q.y - p.y) * t
                best = max(best, abs(y - center.y))
    return best


body = [p['name'] for p in parts if 'body' in p['name'] or 'intact' in p['name']] or None
zs = [lo.z + dims.z * k / 200 for k in range(1, 200)]
radii = [(z, radius_at(z, body)) for z in zs]
radii = [(z, r) for z, r in radii if r > 0]
belly_z, belly_r = max(radii, key=lambda zr: zr[1])
upper = [(z, r) for z, r in radii if z > belly_z]
neck_z, neck_r = min(upper, key=lambda zr: zr[1]) if upper else (belly_z, belly_r)
body_lo = min(z for z, r in radii); body_hi = max(z for z, r in radii)
lip_z = body_hi - 0.002; lip_r = radius_at(lip_z, body)
foot_z = body_lo + 0.004; foot_r = radius_at(foot_z, body)

cam_data = bpy.data.cameras.new('m_cam'); cam = bpy.data.objects.new('m_cam', cam_data)
scn.collection.objects.link(cam); scn.camera = cam
cam_data.type = 'ORTHO'; cam_data.ortho_scale = max(dims.x, dims.z) * 1.35
cam.location = center + Vector((0, -10, 0)); cam.rotation_euler = (math.pi / 2, 0, 0)
cam_data.clip_end = 100
scn.render.resolution_x = scn.render.resolution_y = res
scn.render.engine = 'BLENDER_WORKBENCH'
sh = scn.display.shading
sh.light = 'STUDIO'; sh.color_type = 'OBJECT'; sh.show_cavity = True; sh.cavity_type = 'BOTH'
sh.show_object_outline = True
scn.world = bpy.data.worlds.new('m_world'); scn.world.color = (0.12, 0.13, 0.15)
scn.render.filepath = os.path.join(out_dir, 'parts_front.png')
bpy.ops.render.render(write_still=True)


def px(p):
    v = world_to_camera_view(scn, cam, Vector(p))
    return [round(v.x * res, 1), round((1 - v.y) * res, 1)]


cx = center.x; y0 = center.y
lines = [
    {'label': f'height {dims.z * 1000:.0f} mm', 'a': px((hi.x + 0.04, y0, lo.z)), 'b': px((hi.x + 0.04, y0, hi.z)), 'side': 'right'},
    {'label': f'width {dims.x * 1000:.0f} mm', 'a': px((lo.x, y0, lo.z - 0.03)), 'b': px((hi.x, y0, lo.z - 0.03)), 'side': 'below'},
    {'label': f'belly D {belly_r * 2000:.0f} mm @ {(belly_z - lo.z) * 1000:.0f}', 'a': px((cx - belly_r, y0, belly_z)), 'b': px((cx + belly_r, y0, belly_z)), 'side': 'above'},
    {'label': f'neck D {neck_r * 2000:.0f} mm @ {(neck_z - lo.z) * 1000:.0f}', 'a': px((cx - neck_r, y0, neck_z)), 'b': px((cx + neck_r, y0, neck_z)), 'side': 'above'},
    {'label': f'lip D {lip_r * 2000:.0f} mm', 'a': px((cx - lip_r, y0, lip_z)), 'b': px((cx + lip_r, y0, lip_z)), 'side': 'above'},
    {'label': f'foot D {foot_r * 2000:.0f} mm', 'a': px((cx - foot_r, y0, foot_z)), 'b': px((cx + foot_r, y0, foot_z)), 'side': 'below'},
]
dots = [px((cx, y0, z)) for z in (belly_z, neck_z)]
ratios = {'belly_over_height': round(belly_r * 2 / dims.z, 3), 'neck_over_belly': round(neck_r / belly_r, 3),
          'lip_over_belly': round(lip_r / belly_r, 3), 'belly_height_fraction': round((belly_z - lo.z) / dims.z, 3)}
json.dump({'image': scn.render.filepath, 'res': res, 'parts': parts, 'lines': lines, 'dots': dots,
           'dims_mm': [round(d * 1000) for d in dims], 'ratios': ratios}, open(os.path.join(out_dir, 'measure.json'), 'w'), indent=1)
print('MEASURE_DONE', ratios)
