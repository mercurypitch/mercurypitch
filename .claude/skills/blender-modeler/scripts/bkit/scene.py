"""Scene plumbing: reset, collections, objects from bmesh, joins and origins.

Operators that need a context (join, modifier apply) run inside
`bpy.context.temp_override`, which works in `blender -b` where there is no
window. Prefer data-API paths (`bpy.data.meshes.new_from_object`) when one exists.
"""

import bmesh
import bpy
from mathutils import Matrix, Vector


def reset():
    """Empty factory scene: no default cube, light or camera to leak into exports."""
    bpy.ops.wm.read_factory_settings(use_empty=True)
    return bpy.context.scene


def collection(name, parent=None):
    coll = bpy.data.collections.get(name) or bpy.data.collections.new(name)
    owner = parent.children if parent is not None else bpy.context.scene.collection.children
    if coll.name not in owner:
        owner.link(coll)
    return coll


def link(obj, coll=None):
    target = coll if coll is not None else bpy.context.scene.collection
    if obj.name not in target.objects:
        target.objects.link(obj)
    return obj


def from_bmesh(name, bm, coll=None, smooth=True, material=None):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    for poly in me.polygons:
        poly.use_smooth = smooth
    obj = bpy.data.objects.new(name, me)
    if material is not None:
        me.materials.append(material)
    return link(obj, coll)


def empty(name, coll=None):
    return link(bpy.data.objects.new(name, None), coll)


def mark_sharp(obj, degrees):
    """Smooth by angle without the removed 4.0 auto-smooth API: edges over `degrees` turn sharp."""
    import math

    obj.data.set_sharp_from_angle(angle=math.radians(degrees))


def join(objects, name):
    """Join meshes into the first object (materials and UVs merge); returns it renamed."""
    target = objects[0]
    if len(objects) > 1:
        with bpy.context.temp_override(active_object=target, object=target,
                                       selected_objects=objects, selected_editable_objects=objects):
            bpy.ops.object.join()
    target.name = name
    target.data.name = name
    return target


def bake_modifiers(obj):
    """Replace obj's mesh with its evaluated result (modifiers applied), keeping materials."""
    depsgraph = bpy.context.evaluated_depsgraph_get()
    evaluated = obj.evaluated_get(depsgraph)
    me = bpy.data.meshes.new_from_object(evaluated, preserve_all_data_layers=True, depsgraph=depsgraph)
    old = obj.data
    obj.modifiers.clear()
    obj.data = me
    me.name = old.name
    if old.users == 0:
        bpy.data.meshes.remove(old)
    return obj


def apply_transform(obj):
    obj.data.transform(obj.matrix_world)
    obj.matrix_world = Matrix.Identity(4)
    return obj


def set_origin(obj, point):
    """Move the object origin to `point` (world space) without moving the geometry."""
    point = Vector(point)
    local = obj.matrix_world.inverted() @ point
    obj.data.transform(Matrix.Translation(-local))
    obj.matrix_world = obj.matrix_world @ Matrix.Translation(local)
    return obj


def centroid(obj):
    """Volume centroid for closed meshes, vertex mean otherwise (world space)."""
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bm.transform(obj.matrix_world)
    bmesh.ops.triangulate(bm, faces=bm.faces)
    total = 0.0
    acc = Vector()
    for face in bm.faces:
        a, b, c = (v.co for v in face.verts)
        signed = a.dot(b.cross(c)) / 6.0
        total += signed
        acc += signed * (a + b + c) / 4.0
    if abs(total) < 1e-12:
        mean = sum((v.co for v in bm.verts), Vector()) / max(len(bm.verts), 1)
        bm.free()
        return mean
    bm.free()
    return acc / total


def bounds(objects):
    lo = Vector((1e18,) * 3)
    hi = Vector((-1e18,) * 3)
    for obj in objects:
        for corner in obj.bound_box:
            world = obj.matrix_world @ Vector(corner)
            lo = Vector(map(min, lo, world))
            hi = Vector(map(max, hi, world))
    return lo, hi
