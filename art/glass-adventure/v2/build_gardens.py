"""Author reusable perimeter gardens and irregular island roots in an isolated Blender process."""

from pathlib import Path
import hashlib
import importlib.util
import json
import math
import random
import bmesh
import bpy
from mathutils import Vector

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
OUT = ROOT / 'apps/beside-cue/public/games/adventure-v2'
spec = importlib.util.spec_from_file_location('museum_primitives', HERE.parent / 'build_assets.py')
k = importlib.util.module_from_spec(spec)
spec.loader.exec_module(k)
k.HERE = HERE
k.OUT = OUT


def uv_metres(obj):
    for existing in list(obj.data.uv_layers):
        obj.data.uv_layers.remove(existing)
    layer = obj.data.uv_layers.new(name='surface_uv')
    obj.data.uv_layers.active_index = 0
    for poly in obj.data.polygons:
        axis = max(range(3), key=lambda i: abs(poly.normal[i]))
        a, b = [(1, 2), (0, 2), (0, 1)][axis]
        for li in poly.loop_indices:
            p = obj.matrix_local @ obj.data.vertices[obj.data.loops[li].vertex_index].co
            layer.data[li].uv = (p[a], p[b])


def leaf(name, at, direction, length, width, owner, material, cup=.02):
    """A curved double-sided leaf with a raised midrib; no alpha-card overdraw."""
    forward = Vector(direction).normalized()
    across = forward.cross(Vector((0, 0, 1)))
    if across.length < .01:
        across = Vector((1, 0, 0))
    across.normalize()
    normal = across.cross(forward).normalized()
    origin = Vector(at)
    verts = []
    for i in range(7):
        t = i / 6
        for j in (-1, 0, 1):
            w = width * math.sin(math.pi * t) ** .8
            p = origin + forward * (length * t) + across * (j * w)
            p += normal * ((1 - abs(j)) * cup * math.sin(math.pi * t) + .035 * t * t)
            verts.append(tuple(p))
    faces = []
    for i in range(6):
        for j in range(2):
            a = i * 3 + j
            faces.append((a, a + 1, a + 4, a + 3))
    obj = k.mesh(name, verts, faces, owner, material, True)
    uv_metres(obj)
    return obj


def stem(name, points, owner, radius=.004):
    obj = k.tube(name, points, radius, owner, k.MATS['garden_stem'], sides=4)
    uv_metres(obj)


def flower(name, at, size, owner, material, rotation=0):
    origin = Vector(at)
    for i in range(5):
        a = math.tau * i / 5 + rotation
        leaf(name + '_petal_' + str(i), origin, (math.cos(a), math.sin(a), .18),
             size, size * .50, owner, material, cup=.007)
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=size * .21, location=at)
    obj = bpy.context.object
    obj.name = name + '_pollen'
    k.attach(obj, owner, k.MATS['garden_pollen'])
    uv_metres(obj)


def border(name, seed, flowers=True):
    rng = random.Random(seed)
    root = k.parent(name, 'garden-kit.glb')
    for label, size, pos in [
        ('base', (1.4, .55, .03), (0, 0, -.105)),
        ('front', (1.4, .04, .10), (0, -.255, -.05)),
        ('back', (1.4, .04, .10), (0, .255, -.05)),
        ('left', (.04, .49, .10), (-.68, 0, -.05)),
        ('right', (.04, .49, .10), (.68, 0, -.05)),
    ]:
        obj = k.cube(name + '_trough_' + label, size, pos, root, k.MATS['museum_ivory'], .008)
        uv_metres(obj)
    soil = k.cube(name + '_soil', (1.32, .47, .025), (0, 0, -.0175), root, k.MATS['garden_soil'])
    uv_metres(soil)
    for i in range(28):
        x, y = rng.uniform(-.58, .58), rng.uniform(-.16, .16)
        h = rng.uniform(.12, .40)
        tip = (x + rng.uniform(-.05, .05), y, h)
        stem(name + '_stem_' + str(i), [(x, y, 0), (x, y, h * .5), tip], root)
        for j in range(4):
            angle = rng.uniform(0, math.tau)
            at = (x, y, h * (.22 + .18 * j))
            mat = k.MATS['garden_leaf_jade' if (i + j) % 3 else 'garden_leaf_deep']
            leaf(name + '_leaf_' + str(i) + '_' + str(j), at,
                 (math.cos(angle), math.sin(angle), rng.uniform(.1, .7)),
                 rng.uniform(.09, .16), rng.uniform(.035, .06), root, mat)
        if flowers and i % 3 == 0:
            flower(name + '_flower_' + str(i), tip, rng.uniform(.045, .065), root,
                   k.MATS['garden_flower_ivory' if i % 2 else 'garden_flower_rose'], rng.random())
    return root


def trailing_ivy():
    root = k.parent('ivy_trail', 'garden-kit.glb')
    rng = random.Random(913)
    for vine in range(4):
        x = -.32 + vine * .21
        length = rng.uniform(.55, 1.0)
        points = [(x + .06 * math.sin(t * 8 + vine), -.06 + .08 * math.sin(t * 5), -length * t)
                  for t in [i / 10 for i in range(11)]]
        stem('ivy_stem_' + str(vine), points, root)
        for i, at in enumerate(points[1:-1]):
            sign = -1 if i % 2 else 1
            leaf('ivy_leaf_' + str(vine) + '_' + str(i), at, (sign, -.35, -.4),
                 .13, .065, root, k.MATS['garden_leaf_deep' if i % 3 else 'garden_leaf_jade'])
    return root


def island():
    root = k.parent('island_root', 'garden-kit.glb')
    rng = random.Random(173)
    # Overlapping limestone blocks make an asymmetric descending root, all below its socket.
    for i, (pos, scale) in enumerate([
        ((0, 0, -.40), (1.54, 1.53, .62)), ((-.45, .12, -.98), (.88, .95, .85)),
        ((.52, -.32, -.76), (.78, .65, .76)), ((-.55, .23, -1.65), (.42, .52, .61)),
        ((.7, .42, -.49), (.70, .72, .42)), ((-.91, -.55, -.65), (.52, .59, .62)),
    ]):
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=1, location=pos)
        obj = bpy.context.object
        obj.name = 'island_limestone_' + str(i)
        for vertex in obj.data.vertices:
            vertex.co *= rng.uniform(.88, 1.10)
        obj.scale = scale
        k.select_only([obj])
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
        k.attach(obj, root, k.MATS['museum_limestone'])
        obj.location.z -= .3
        uv_metres(obj)
    return root


def create():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.preferences.filepaths.save_version = 0
    bpy.context.scene.unit_settings.system = 'METRIC'
    for name, color, rough in [
        ('garden_leaf_deep', (.015, .065, .042), .55),
        ('garden_leaf_jade', (.045, .16, .07), .43),
        ('garden_stem', (.06, .095, .023), .67),
        ('garden_flower_ivory', (.95, .91, .73), .52),
        ('garden_flower_rose', (.65, .14, .24), .55),
        ('garden_pollen', (.72, .40, .07), .52),
        ('garden_soil', (.035, .022, .012), .9),
        ('museum_ivory', (.86, .84, .78), .28),
        ('museum_limestone', (.65, .62, .52), .8),
    ]:
        k.material(name, color, rough=rough)
    border('garden_perimeter', 601)
    border('garden_foliage', 174, flowers=False)
    trailing_ivy()
    island()
    # Opaque plants share one shader and bake their small palette into linear vertex colors.
    # This keeps the flower/leaf color variation without six draw calls per repeated cluster.
    palette = k.material('garden_palette', (1, 1, 1), rough=.58)
    colors = palette.node_tree.nodes.new('ShaderNodeVertexColor')
    colors.layer_name = 'garden_color'
    palette.node_tree.links.new(colors.outputs['Color'], palette.node_tree.nodes['Principled BSDF'].inputs['Base Color'])
    for root in k.GROUPS.values():
        batches = {}
        for obj in root.children:
            if obj.type == 'MESH':
                material = obj.data.materials[0]
                if material.name.startswith('garden_'):
                    layer = obj.data.color_attributes.new(name='garden_color', type='FLOAT_COLOR', domain='CORNER')
                    obj.data.color_attributes.active_color = layer
                    for color in layer.data:
                        color.color = material.diffuse_color
                    obj.data.materials.clear()
                    obj.data.materials.append(palette)
                    material = palette
                batches.setdefault(material.name, []).append(obj)
        for material, objects in batches.items():
            k.select_only(objects)
            if len(objects) > 1:
                bpy.ops.object.join()
            bpy.context.object.name = root.name + '_' + material
            bpy.context.object.parent = root
    for obj in bpy.data.objects:
        if obj.type != 'MESH':
            continue
        bm = bmesh.new()
        bm.from_mesh(obj.data)
        bmesh.ops.triangulate(bm, faces=list(bm.faces))
        bm.to_mesh(obj.data)
        bm.free()
    objects = [obj for root in k.GROUPS.values() for obj in [root, *root.children]]
    k.select_only(objects)
    OUT.mkdir(parents=True, exist_ok=True)
    (HERE / 'models').mkdir(exist_ok=True)
    path = OUT / 'garden-kit.glb'
    bpy.ops.export_scene.gltf(filepath=str(path), export_format='GLB', use_selection=True,
                             export_yup=True, export_apply=True, export_extras=True,
                             export_animations=False, export_tangents=True)
    report = {'version': 2, 'source': 'Blender-authored deterministic garden geometry',
              'units': 'metres', 'up': '+Y', 'collision': 'none; perimeter/underside dressing only',
              'bytes': path.stat().st_size, 'sha256': hashlib.sha256(path.read_bytes()).hexdigest(),
              'assemblies': {name: {'triangles': sum(len(o.data.polygons) for o in root.children if o.type == 'MESH'),
                                    'materials': sorted({m.name for o in root.children if o.type == 'MESH' for m in o.data.materials})}
                             for name, root in k.GROUPS.items()}}
    (HERE / 'garden-manifest.json').write_text(json.dumps(report, indent=2) + '\n')
    bpy.ops.wm.save_as_mainfile(filepath=str(HERE / 'models/garden-kit.blend'))
    return report


def preview():
    """Review a saved kit without changing the source scene on disk."""
    bpy.data.objects['island_root'].hide_render = True
    for obj in bpy.data.objects['island_root'].children:
        obj.hide_render = True
    bpy.data.objects['garden_perimeter'].location = (-.8, 0, .65)
    bpy.data.objects['garden_foliage'].location = (.75, .15, .65)
    bpy.data.objects['ivy_trail'].location = (-.55, -.23, .65)
    scene = bpy.context.scene
    stage = bpy.data.materials.new('review_ivory')
    stage.diffuse_color = (.65, .62, .55, 1)
    for pos, size in [((0, 0, .3), (3.2, .8, .6)), ((0, 0, -.5), (200, 200, .05))]:
        bpy.ops.mesh.primitive_cube_add(size=1, location=pos)
        obj = bpy.context.object
        obj.scale = size
        obj.data.materials.append(stage)
    scene.world = bpy.data.worlds.new('garden_review_world')
    scene.world.color = (.18, .22, .26)
    for name, pos, color, power in [('key', (1, -3, 4), (1, .86, .66), 700),
                                    ('fill', (-3, -1, 2), (.68, .84, 1), 400)]:
        data = bpy.data.lights.new(name, 'AREA')
        data.energy, data.size, data.color = power, 4, color
        obj = bpy.data.objects.new(name, data)
        scene.collection.objects.link(obj)
        obj.location = pos
        obj.rotation_euler = (Vector((0, 0, .5)) - obj.location).to_track_quat('-Z', 'Y').to_euler()
    bpy.ops.object.camera_add(location=(2.2, -4, 2.3))
    cam = bpy.context.object
    cam.rotation_euler = (Vector((0, 0, .4)) - cam.location).to_track_quat('-Z', 'Y').to_euler()
    cam.data.type, cam.data.ortho_scale = 'ORTHO', 3.8
    scene.camera = cam
    scene.render.engine = 'CYCLES'
    scene.cycles.samples, scene.cycles.use_denoising = 32, True
    scene.render.resolution_x, scene.render.resolution_y = 1400, 850
    scene.render.resolution_percentage = 100
    scene.view_settings.view_transform = 'AgX'
    scene.render.filepath = str(HERE / 'garden-review.png')
    bpy.ops.render.render(write_still=True)


if __name__ == '__main__':
    print(json.dumps(create()))
