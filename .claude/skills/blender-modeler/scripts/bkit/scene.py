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
    """Mesh object from a bmesh. smooth=None keeps each face's own flag (mixed flat and
    smooth spans); `material` is one material or a list of slots matching face indices."""
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    if smooth is not None:
        for poly in me.polygons:
            poly.use_smooth = smooth
    obj = bpy.data.objects.new(name, me)
    for mat in (material if isinstance(material, (list, tuple)) else [material]):
        if mat is not None:
            me.materials.append(mat)
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


def clean(obj, dist=1e-5, triangulate=False):
    """Weld coincident vertices and dissolve zero-length edges and zero-area faces.

    Exact booleans leave micron-sized edges and needle triangles along a cut; the
    glTF round trip (float32 positions, a weld on import) turns those into
    non-manifold edges and zero-area faces. Clean every boolean result before it
    is validated or exported. The default 10 micron distance is far below any real
    feature and above the 4-7 micron triangles a cut can leave (zero area to the
    validator, too long-edged for a 1 micron collapse). triangulate=True also
    triangulates first: a cut face is an n-gon with collinear vertices, and the
    exporter's own triangulation of it leaves zero-area triangles that no check in
    Blender sees, so a shard must leave Blender as the triangles it was checked as.
    """
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=dist)
    if triangulate:
        bmesh.ops.triangulate(bm, faces=bm.faces[:], quad_method='BEAUTY', ngon_method='BEAUTY')
    bmesh.ops.dissolve_degenerate(bm, edges=bm.edges, dist=dist)
    if triangulate:  # dissolving can leave an n-gon behind; split it again
        bmesh.ops.triangulate(bm, faces=[f for f in bm.faces if len(f.verts) > 3], quad_method='BEAUTY',
                              ngon_method='BEAUTY')
        # A needle whose three corners are nearly in line has long edges and no area, so
        # dissolving short edges misses it. Rotating its longest edge turns the needle and
        # its neighbour into two triangles with area.
        for _ in range(4):
            needles = [f for f in bm.faces if f.is_valid and f.calc_area() < 1e-10]
            if not needles:
                break
            longest = {max(f.edges, key=lambda e: e.calc_length()) for f in needles}
            bmesh.ops.rotate_edges(bm, edges=[e for e in longest if e.is_valid and e.is_manifold], use_ccw=False)
        bmesh.ops.dissolve_degenerate(bm, edges=bm.edges, dist=dist)
    loose = [v for v in bm.verts if not v.link_faces]
    if loose:
        bmesh.ops.delete(bm, geom=loose, context='VERTS')
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(obj.data)
    bm.free()
    obj.data.update()
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
