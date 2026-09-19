"""Build the floating museum kit, closed glass fractures, and UV portrait slab.

Run in an isolated Blender process:
  blender --background --factory-startup --python art/glass-adventure/build_assets.py
Optional arguments after --: --portrait /absolute/portrait.png --render
The current user's interactive Blender scene is never read or changed.
"""

import argparse
import hashlib
import json
import math
from pathlib import Path
import random
import sys

import bmesh
import bpy
from mathutils import Vector

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
OUT = ROOT / "apps/beside-cue/public/games/adventure"
TAU = math.tau
GROUPS = {}
ASSETS = {}
MATS = {}


def select_only(objects):
    bpy.ops.object.select_all(action="DESELECT")
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]


def material(name, color, metal=0.0, rough=0.3, transmission=0.0, emission=0.0):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*color, 1)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*color, 1)
    bsdf.inputs["Metallic"].default_value = metal
    bsdf.inputs["Roughness"].default_value = rough
    bsdf.inputs["Transmission Weight"].default_value = transmission
    bsdf.inputs["IOR"].default_value = 1.46
    if emission:
        bsdf.inputs["Emission Color"].default_value = (*color, 1)
        bsdf.inputs["Emission Strength"].default_value = emission
    MATS[name] = mat
    return mat


def parent(name, bundle, collider=None):
    obj = bpy.data.objects.new(name, None)
    bpy.context.scene.collection.objects.link(obj)
    GROUPS[name] = obj
    ASSETS[name] = {"bundle": bundle, "node": name, "pivot": "surface-center" if collider else "foot-center"}
    if collider:
        ASSETS[name]["collider"] = collider
        obj["collider_json"] = json.dumps(collider)
    return obj


def attach(obj, owner, mat=None):
    obj.parent = owner
    if mat:
        obj.data.materials.append(mat)
    return obj


def mesh(name, verts, faces, owner, mat, smooth=False):
    data = bpy.data.meshes.new(name)
    data.from_pydata(verts, [], faces)
    data.update()
    bm = bmesh.new()
    bm.from_mesh(data)
    bmesh.ops.remove_doubles(bm, verts=list(bm.verts), dist=1e-7)
    # Revolving an axis-to-axis profile segment collapses its faces to a wire.
    # Remove that unused wire; the surrounding cap faces already close the solid.
    wires = [edge for edge in bm.edges if not edge.link_faces]
    if wires:
        bmesh.ops.delete(bm, geom=wires, context="EDGES")
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    bm.to_mesh(data)
    bm.free()
    obj = bpy.data.objects.new(name, data)
    bpy.context.scene.collection.objects.link(obj)
    attach(obj, owner, mat)
    for face in data.polygons:
        face.use_smooth = smooth
    return obj


def cube(name, size, location, owner, mat, bevel=0.0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.scale = size
    select_only([obj])
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    attach(obj, owner, mat)
    if bevel:
        mod = obj.modifiers.new("authored_edge", "BEVEL")
        mod.width = bevel
        mod.segments = 2
        bpy.ops.object.modifier_apply(modifier=mod.name)
    return obj


def tube(name, points, radius, owner, mat, sides=6, closed=False):
    verts = []
    count = len(points)
    for i, p in enumerate(points):
        pos = Vector(p)
        before = Vector(points[(i - 1) % count] if closed or i else points[i])
        after = Vector(points[(i + 1) % count] if closed or i < count - 1 else points[i])
        tangent = (after - before).normalized()
        axis = Vector((0, 0, 1))
        if abs(tangent.dot(axis)) > 0.95:
            axis = Vector((0, 1, 0))
        u = tangent.cross(axis).normalized()
        v = tangent.cross(u).normalized()
        for j in range(sides):
            angle = TAU * j / sides
            verts.append(tuple(pos + radius * (math.cos(angle) * u + math.sin(angle) * v)))
    faces = []
    for i in range(count if closed else count - 1):
        for j in range(sides):
            faces.append((i * sides + j, i * sides + (j + 1) % sides,
                          ((i + 1) % count) * sides + (j + 1) % sides,
                          ((i + 1) % count) * sides + j))
    if not closed:
        faces.extend([tuple(reversed(range(sides))), tuple((count - 1) * sides + j for j in range(sides))])
    return mesh(name, verts, faces, owner, mat, True)


def rectangle_ring(name, w, d, z, inset, owner, mat, radius=0.012):
    # Chamfered corners, visually repeated throughout the museum kit.
    x, y, c = w / 2 - inset, d / 2 - inset, min(w, d) * 0.085
    points = [(-x + c, -y, z), (x - c, -y, z), (x, -y + c, z),
              (x, y - c, z), (x - c, y, z), (-x + c, y, z),
              (-x, y - c, z), (-x, -y + c, z)]
    return tube(name, points, radius, owner, mat, closed=True)


def ring(name, radius, z, owner, mat, tube_radius=0.008, scale_y=1):
    points = [(radius * math.cos(TAU * i / 48), radius * math.sin(TAU * i / 48) * scale_y, z) for i in range(48)]
    return tube(name, points, tube_radius, owner, mat, closed=True)


def platform(name, w, d, kind="flat"):
    collider = {"shape": "box", "width": w, "depth": d, "height": 0.22, "topY": 0}
    root = parent(name, "platform-kit.glb", collider)
    cube(name + "_stone", (w, d, 0.20), (0, 0, -0.10), root, MATS["museum_obsidian"], 0.055)
    cube(name + "_ceramic_top", (w - 0.10, d - 0.10, 0.045), (0, 0, -0.021), root, MATS["museum_ivory"], 0.04)
    rectangle_ring(name + "_gold_rim", w, d, -0.025, 0.025, root, MATS["museum_brass"], 0.017)
    rectangle_ring(name + "_inlay", w, d, 0.006, 0.16, root, MATS["museum_brass"], 0.006)
    rectangle_ring(name + "_light_seam", w, d, -0.165, 0.03, root, MATS["museum_cyan"], 0.012)
    # The decorative suspended hull never intrudes on the authored walking top.
    upper, lower = [], []
    for i in range(8):
        a = TAU * i / 8 + math.pi / 8
        upper.append((0.47 * w * math.cos(a), 0.47 * d * math.sin(a), -0.18))
        lower.append((0.28 * w * math.cos(a), 0.28 * d * math.sin(a), -min(w, d) * 0.34))
    hull = mesh(name + "_suspended_hull", upper + lower,
                [(i, (i + 1) % 8, (i + 1) % 8 + 8, i + 8) for i in range(8)] + [tuple(range(8, 16))],
                root, MATS["museum_petrol"])
    for i in range(8):
        tube(name + "_rib_%02d" % i, [upper[i], lower[i]], 0.012, root, MATS["museum_brass"])
    r = min(w, d) * 0.23
    ring(name + "_floor_medallion", r, 0.007, root, MATS["museum_brass"], 0.005, min(1, d / w))
    ring(name + "_floor_inner", r * 0.84, 0.007, root, MATS["museum_brass"], 0.0035, min(1, d / w))
    for i in range(8):
        a = TAU * i / 8
        tube(name + "_star_%02d" % i,
             [(r * 0.35 * math.cos(a), r * 0.35 * math.sin(a), 0.008),
              (r * 0.72 * math.cos(a), r * 0.72 * math.sin(a), 0.008)],
             0.0035, root, MATS["museum_brass"], sides=4)
    if kind == "bridge":
        for sign in (-1, 1):
            points = [(sign * w * 0.4, -d / 2 + d * i / 24,
                       -0.17 - 0.44 * math.sin(math.pi * i / 24)) for i in range(25)]
            tube(name + "_underside_arch_" + str(sign), points, 0.035, root, MATS["museum_brass"])
    if kind == "moving":
        ring(name + "_levitation_ring", min(w, d) * 0.40, -0.46, root, MATS["museum_cyan"], 0.014)
    ASSETS[name]["role"] = "moving-platform" if kind == "moving" else "platform"
    return root


def ramp():
    name, w, d, rise = "platform_ramp", 1.375, 2.2, 0.55
    root = parent(name, "platform-kit.glb", {"shape": "ramp", "width": w, "depth": d, "rise": rise, "lowEdgeZ": -d / 2})
    # Blender -Y becomes glTF +Z; the high edge is +Z, the low entrance -Z.
    verts = [(-w/2, -d/2, rise), (w/2, -d/2, rise), (w/2, d/2, 0), (-w/2, d/2, 0),
             (-w/2, -d/2, rise-0.20), (w/2, -d/2, rise-0.20), (w/2, d/2, -0.20), (-w/2, d/2, -0.20)]
    mesh(name + "_stone", verts, [(0, 1, 2, 3), (7, 6, 5, 4), (0, 4, 5, 1), (1, 5, 6, 2), (2, 6, 7, 3), (3, 7, 4, 0)], root, MATS["museum_ivory"])
    for side in (-1, 1):
        tube(name + "_gold_rail_" + str(side), [(side*(w/2-0.04), -d/2, rise+0.005), (side*(w/2-0.04), d/2, 0.005)], 0.018, root, MATS["museum_brass"])
    for i in range(1, 9):
        t = i / 9
        tube(name + "_inlay_%02d" % i, [(-w/2+0.09, -d/2+d*t, rise*(1-t)+0.008), (w/2-0.09, -d/2+d*t, rise*(1-t)+0.008)], 0.005, root, MATS["museum_brass"], sides=4)
    ASSETS[name]["role"] = "platform"


def clip_profile(poly, height, keep_above):
    out = []
    for a, b in zip(poly, poly[1:] + poly[:1]):
        ina = a[1] >= height - 1e-9 if keep_above else a[1] <= height + 1e-9
        inb = b[1] >= height - 1e-9 if keep_above else b[1] <= height + 1e-9
        if ina:
            out.append(a)
        if ina != inb:
            t = (height - a[1]) / (b[1] - a[1])
            out.append((a[0] + (b[0] - a[0]) * t, height))
    cleaned = []
    for p in out:
        if not cleaned or abs(p[0]-cleaned[-1][0]) + abs(p[1]-cleaned[-1][1]) > 1e-8:
            cleaned.append(p)
    return cleaned


def lathe(name, profile, start, end, steps, owner, mat, flute=0, uv_height=None):
    full = end - start > TAU - 1e-8
    rings = steps if full else steps + 1
    verts = []
    for j in range(rings):
        angle = start + (end-start) * j / steps
        for radius, z in profile:
            r = radius * (1 + flute * math.cos(12 * angle))
            verts.append((r * math.cos(angle), r * math.sin(angle), z))
    n = len(profile)
    faces = []
    for j in range(steps):
        for k in range(n):
            faces.append((j*n+k, j*n+(k+1)%n, ((j+1)%rings)*n+(k+1)%n, ((j+1)%rings)*n+k))
    if not full:
        faces.extend([tuple(reversed(range(n))), tuple((rings-1)*n+k for k in range(n))])
    obj = mesh(name, verts, faces, owner, mat, True)
    # Genuine shared cylindrical UVs, continuous across independently exported cells.
    uv = obj.data.uv_layers.new(name="surface_uv")
    max_z = uv_height or max(p[1] for p in profile)
    for face in obj.data.polygons:
        if not full and len(face.vertices) > 4:
            face.use_smooth = False
        for li in face.loop_indices:
            co = obj.data.vertices[obj.data.loops[li].vertex_index].co
            uv.data[li].uv = ((math.atan2(co.y, co.x) / TAU) % 1, co.z / max_z if max_z else 0)
    return obj


def center_geometry(obj):
    center = sum((v.co for v in obj.data.vertices), Vector()) / len(obj.data.vertices)
    for v in obj.data.vertices:
        v.co -= center
    obj.location += center


def join_into(target, addition):
    name = target.name
    select_only([target, addition])
    bpy.ops.object.join()
    target.name = name


def vessel(name, outer, mat, sectors=8, flute=0):
    h = outer[-1][1]
    wall = 0.007
    # Closed radial cross-section includes the underside and thick bottom.
    inner = [(max(0, r-wall), max(0.018, z)) for r, z in reversed(outer[1:])]
    profile = [(0, 0)] + outer + inner + [(0, 0.018)]
    root = parent(name, "vessels.glb")
    intact = lathe(name + "_intact", profile, 0, TAU, 64, root, mat, flute)
    intact["role"] = "intact"
    shard_names = []
    for sector in range(sectors):
        # Alternating fracture heights give larger irregular silhouette pieces.
        split = h * (0.41 + 0.08 * math.sin(sector * 2.7))
        for band in range(2):
            cropped = clip_profile(profile, split, keep_above=band == 1)
            shard = lathe(name + "_shard_%03d" % (sector*2+band), cropped,
                          sector*TAU/sectors, (sector+1)*TAU/sectors, 64//sectors, root, mat, flute, uv_height=h)
            center_geometry(shard)
            shard["role"] = "shard"
            shard.hide_render = True
            shard_names.append(shard.name)
    if name == "vase_amphora":
        for side, sector in [(1, 0), (-1, 4)]:
            points = [(side*(0.151+0.108*math.sin(math.pi*i/18)), 0,
                       0.43-0.23*i/18) for i in range(19)]
            handle = tube(name + "_handle", points, 0.018, root, mat, sides=8)
            piece = handle.copy()
            piece.data = handle.data.copy()
            bpy.context.scene.collection.objects.link(piece)
            piece.parent = root
            join_into(intact, handle)
            shard = bpy.data.objects[name + "_shard_%03d" % (sector*2+1)]
            join_into(shard, piece)
            center_geometry(shard)
    base = lathe(name + "_base", [(0, 0), (outer[0][0]*1.05, 0), (outer[0][0]*1.05, 0.013), (0, 0.013)], 0, TAU, 48, root, MATS["museum_brass"])
    base["role"] = "persistent-base"
    ASSETS[name].update({"role": "breakable", "intact": intact.name, "shards": shard_names, "persistent": [base.name], "wallThickness": wall})


def clip_cell(poly, normal, limit):
    out = []
    for a, b in zip(poly, poly[1:] + poly[:1]):
        da, db = a[0]*normal[0]+a[1]*normal[1]-limit, b[0]*normal[0]+b[1]*normal[1]-limit
        if da <= 1e-9:
            out.append(a)
        if (da <= 0) != (db <= 0):
            t = da / (da-db)
            out.append((a[0]+t*(b[0]-a[0]), a[1]+t*(b[1]-a[1])))
    return out


def slab_piece(name, poly, owner, thickness, width, height):
    n = len(poly)
    verts = [(x, -thickness/2, z) for x, z in poly] + [(x, thickness/2, z) for x, z in poly]
    faces = [tuple(range(n)), tuple(reversed(range(n, 2*n)))]
    faces += [(i, (i+1)%n, (i+1)%n+n, i+n) for i in range(n)]
    obj = mesh(name, verts, faces, owner, MATS["legend_edge"])
    obj.data.materials.append(MATS["legend_portrait"])
    uv = obj.data.uv_layers.new(name="portrait_uv")
    for face in obj.data.polygons:
        points = [obj.data.vertices[i].co for i in face.vertices]
        if all(abs(p.y + thickness/2) < 1e-7 for p in points):
            face.material_index = 1
        for li in face.loop_indices:
            co = obj.data.vertices[obj.data.loops[li].vertex_index].co
            uv.data[li].uv = (co.x/width+0.5, co.z/height)
    return obj


def legend(portrait):
    name, width, height, thickness = "legend_cash", 0.72, 1.08, 0.045
    root = parent(name, "legend-slab.glb")
    if portrait:
        image = bpy.data.images.load(str(portrait), check_existing=True)
        image.pack()
        nodes = MATS["legend_portrait"].node_tree.nodes
        tex = nodes.new("ShaderNodeTexImage")
        tex.image = image
        MATS["legend_portrait"].node_tree.links.new(tex.outputs["Color"], nodes.get("Principled BSDF").inputs["Base Color"])
    boundary = [(-width/2, 0), (width/2, 0), (width/2, height), (-width/2, height)]
    intact = slab_piece(name + "_intact", boundary, root, thickness, width, height)
    intact["role"] = "intact"
    rng = random.Random(421)
    seeds = [(-width/2+width*(x+0.5+rng.uniform(-0.23, 0.23))/4,
              height*(y+0.5+rng.uniform(-0.23, 0.23))/4) for y in range(4) for x in range(4)]
    shards = []
    for i, seed in enumerate(seeds):
        cell = list(boundary)
        for j, other in enumerate(seeds):
            if i == j:
                continue
            normal = (other[0]-seed[0], other[1]-seed[1])
            limit = (other[0]**2+other[1]**2-seed[0]**2-seed[1]**2)/2
            cell = clip_cell(cell, normal, limit)
        shard = slab_piece(name + "_shard_%03d" % i, cell, root, thickness, width, height)
        center_geometry(shard)
        shard["role"] = "shard"
        shard.hide_render = True
        shards.append(shard.name)
    persistent = []
    for x in (-width/2-0.014, width/2+0.014):
        obj = cube(name + "_frame_vertical_" + str(x), (0.025, 0.065, height+0.06), (x, 0, height/2), root, MATS["museum_brass"], 0.01)
        persistent.append(obj.name)
    for z in (-0.025, height+0.025):
        obj = cube(name + "_frame_horizontal_" + str(z), (width+0.065, 0.065, 0.027), (0, 0, z), root, MATS["museum_brass"], 0.009)
        persistent.append(obj.name)
    base = cube(name + "_base", (width+0.16, 0.25, 0.09), (0, 0.012, -0.045), root, MATS["museum_obsidian"], 0.03)
    persistent.append(base.name)
    ASSETS[name].update({"role": "breakable", "intact": intact.name, "shards": shards, "persistent": persistent,
                        "portraitUV": {"u": "x / 0.72 + 0.5", "v": "y / 1.08", "front": "+Z", "imageEmbedded": bool(portrait)},
                        "portraitSourceSha256": hashlib.sha256(portrait.read_bytes()).hexdigest() if portrait else None})


def architecture():
    root = parent("museum_column", "platform-kit.glb")
    cube("museum_column_plinth", (0.42, 0.42, 0.13), (0, 0, 0.065), root, MATS["museum_ivory"], 0.025)
    profile = [(0, 0.12), (0.18, 0.12), (0.18, 0.17), (0.125, 0.23),
               (0.112, 0.32), (0.098, 1.95), (0.14, 2.03), (0.18, 2.10), (0, 2.10)]
    lathe("museum_column_fluted_shaft", profile, 0, TAU, 48, root, MATS["museum_ivory"], flute=0.035)
    for i, (r, z) in enumerate([(0.18, 0.16), (0.126, 0.25), (0.11, 0.34), (0.106, 1.95), (0.17, 2.08)]):
        ring("museum_column_gilt_%02d" % i, r, z, root, MATS["museum_brass"], 0.009)
    cube("museum_column_capital", (0.40, 0.40, 0.08), (0, 0, 2.14), root, MATS["museum_ivory"], 0.025)
    ASSETS["museum_column"]["role"] = "non-colliding-ornament"
    arch = parent("museum_arch", "platform-kit.glb")
    for side in (-1, 1):
        cube("museum_arch_pier_" + str(side), (0.22, 0.30, 1.38), (side*1.05, 0, 0.69), arch, MATS["museum_ivory"], 0.02)
        cube("museum_arch_foot_" + str(side), (0.36, 0.44, 0.11), (side*1.05, 0, 0.055), arch, MATS["museum_brass"], 0.018)
    points = [(1.05*math.cos(math.pi*i/40), 0, 1.35+1.05*math.sin(math.pi*i/40)) for i in range(41)]
    tube("museum_arch_ivory_vault", points, 0.15, arch, MATS["museum_ivory"], sides=8)
    for depth in (-0.143, 0.143):
        points = [(1.05*math.cos(math.pi*i/40), depth, 1.35+1.05*math.sin(math.pi*i/40)) for i in range(41)]
        tube("museum_arch_gold_line_" + str(depth), points, 0.013, arch, MATS["museum_brass"])
    cube("museum_arch_keystone", (0.18, 0.37, 0.23), (0, 0, 2.39), arch, MATS["museum_petrol"], 0.03)
    ASSETS["museum_arch"]["role"] = "non-colliding-ornament"


def astrolabe():
    donor = HERE/"meshy/astrolabe-01.glb"
    if not donor.exists():
        return
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(donor))
    imported = [obj for obj in bpy.data.objects if obj not in before]
    objects = [obj for obj in imported if obj.type == "MESH"]
    bpy.context.view_layer.update()
    points = [obj.matrix_world @ Vector(c) for obj in objects for c in obj.bound_box]
    lo = Vector(tuple(min(p[i] for p in points) for i in range(3)))
    hi = Vector(tuple(max(p[i] for p in points) for i in range(3)))
    factor = 2.4 / (hi.z-lo.z)
    offset = Vector(((lo.x+hi.x)/2, (lo.y+hi.y)/2, lo.z))
    root = parent("museum_astrolabe", "platform-kit.glb")
    for i, obj in enumerate(objects):
        matrix = obj.matrix_world.copy()
        obj.parent = None
        for v in obj.data.vertices:
            v.co = (matrix @ v.co-offset)*factor
        obj.matrix_world.identity()
        obj.name = "museum_astrolabe_sculpt_%02d" % i
        obj.data.materials.clear()
        attach(obj, root, MATS["museum_brass"])
    for obj in imported:
        if obj.type != "MESH":
            bpy.data.objects.remove(obj, do_unlink=True)
    ASSETS["museum_astrolabe"].update({"role": "non-colliding-panorama", "meshyTask": "01a0a1c0-6929-7636-be07-ac4e3dab7514", "sourceSha256": hashlib.sha256(donor.read_bytes()).hexdigest()})


def descendants(root):
    return [root] + list(root.children_recursive)


def batch_ornaments():
    # One mesh per material per module, avoiding dozens of tiny draw calls.
    for name, record in ASSETS.items():
        if record["bundle"] != "platform-kit.glb":
            continue
        root = GROUPS[name]
        by_material = {}
        for obj in root.children_recursive:
            if obj.type == "MESH":
                key = obj.data.materials[0].name
                by_material.setdefault(key, []).append(obj)
        for key, objects in by_material.items():
            select_only(objects)
            if len(objects) > 1:
                bpy.ops.object.join()
            obj = bpy.context.object
            obj.name = name + "_" + key
            obj.parent = root


def export_bundle(name):
    roots = [GROUPS[k] for k, v in ASSETS.items() if v["bundle"] == name]
    objects = [o for root in roots for o in descendants(root)]
    # Shards remain in GLB, with role extras; runtime chooses intact OR shards.
    for obj in objects:
        obj.hide_set(False)
    select_only(objects)
    bpy.ops.export_scene.gltf(filepath=str(OUT/name), export_format="GLB", use_selection=True,
                              export_yup=True, export_apply=True, export_extras=True,
                              export_animations=False, export_tangents=False)


def inspect_assets():
    bpy.context.view_layer.update()
    for name, record in ASSETS.items():
        records = []
        for obj in GROUPS[name].children_recursive:
            if obj.type != "MESH":
                continue
            obj.data.calc_loop_triangles()
            corners = [obj.matrix_world @ Vector(c) for c in obj.bound_box]
            convert = lambda p: [round(p.x, 6), round(p.z, 6), round(-p.y, 6)]
            points = [convert(p) for p in corners]
            bm = bmesh.new()
            bm.from_mesh(obj.data)
            bad = sum(1 for e in bm.edges if not e.is_manifold)
            bm.free()
            records.append({"node": obj.name, "role": obj.get("role", "decoration"),
                            "triangles": len(obj.data.loop_triangles), "vertices": len(obj.data.vertices),
                            "bounds": {"min": [min(p[i] for p in points) for i in range(3)], "max": [max(p[i] for p in points) for i in range(3)]},
                            "translation": convert(obj.location), "materials": [m.name for m in obj.data.materials],
                            "nonManifoldEdges": bad, "hasUV": bool(obj.data.uv_layers)})
        record["meshes"] = records
        record["trianglesIncludingHiddenShards"] = sum(r["triangles"] for r in records)
        for row in records:
            if row["role"] in ("intact", "shard") and row["nonManifoldEdges"]:
                raise RuntimeError("Breakable must be closed: " + row["node"])
        if record["role"] == "breakable":
            def volume(node):
                bm = bmesh.new()
                bm.from_mesh(bpy.data.objects[node].data)
                value = bm.calc_volume(signed=True)
                bm.free()
                return value
            whole = volume(record["intact"])
            pieces = sum(volume(node) for node in record["shards"])
            error = abs(pieces-whole)/abs(whole)
            if error > 1e-5:
                raise RuntimeError("Fracture volume mismatch: " + name)
            record["fractureValidation"] = {"intactVolume": whole, "shardsVolume": pieces, "relativeError": error, "closedShards": len(record["shards"])}


def render_preview():
    for i, name in enumerate(["platform_terrace", "platform_island", "platform_bridge", "platform_ledge", "platform_plinth", "platform_ramp"]):
        GROUPS[name].location = ((i%3-1)*4.1, (i//3)*4.3, 0)
    for i, name in enumerate(["vase_rounded", "vase_fluted", "vase_amphora", "legend_cash"]):
        GROUPS[name].location = ((i-1.5)*1.0, -3.1, 0.1)
        if name != "legend_cash":
            GROUPS[name].scale = (1.65,)*3
    for i, name in enumerate(["museum_column", "museum_arch", "museum_astrolabe"]):
        if name in GROUPS:
            GROUPS[name].location = ((i-1)*3.5, 8.0, 0)
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = 24
    scene.cycles.use_denoising = True
    scene.render.resolution_x = 1400
    scene.render.resolution_y = 1000
    scene.render.resolution_percentage = 100
    if not scene.world:
        scene.world = bpy.data.worlds.new("review_world")
    scene.world.color = (0.12, 0.12, 0.12)
    scene.world.use_nodes = True
    scene.world.node_tree.nodes["Background"].inputs[0].default_value = (0.12, 0.20, 0.24, 1)
    scene.world.node_tree.nodes["Background"].inputs[1].default_value = 0.45
    for name, loc, energy, color, size in [("key", (0, -3, 9), 1900, (0.8, 0.94, 1), 8),
                                           ("warm", (-6, 3, 5), 2200, (1, 0.67, 0.33), 7),
                                           ("rim", (5, 7, 7), 2600, (0.35, 0.85, 1), 6)]:
        data = bpy.data.lights.new(name, "AREA")
        data.energy, data.color, data.shape, data.size = energy, color, "DISK", size
        obj = bpy.data.objects.new(name, data)
        scene.collection.objects.link(obj)
        obj.location = loc
        obj.rotation_euler = (Vector((0, 1, 0))-obj.location).to_track_quat("-Z", "Y").to_euler()
    data = bpy.data.cameras.new("asset_review")
    cam = bpy.data.objects.new("asset_review", data)
    scene.collection.objects.link(cam)
    cam.location = (10, -15, 13)
    cam.rotation_euler = (Vector((0, 2.2, 0.35))-cam.location).to_track_quat("-Z", "Y").to_euler()
    data.type, data.ortho_scale = "ORTHO", 19
    scene.camera = cam
    scene.render.filepath = str(HERE/"asset-review.png")
    bpy.ops.render.render(write_still=True)
    # A second view tests actual glass silhouettes and portrait readability.
    for name, root in GROUPS.items():
        if name not in ("vase_rounded", "vase_fluted", "vase_amphora", "legend_cash"):
            for obj in descendants(root):
                obj.hide_render = True
    cam.location = (3.1, -9.7, 2.6)
    cam.rotation_euler = (Vector((0, -3.1, 0.65))-cam.location).to_track_quat("-Z", "Y").to_euler()
    data.ortho_scale = 5.2
    scene.render.resolution_y = 900
    scene.render.filepath = str(HERE/"breakables-review.png")
    bpy.ops.render.render(write_still=True)
    # All fragments retain real geometry and UVs; this is an exploded review pose.
    for name in ("vase_rounded", "vase_fluted", "vase_amphora", "legend_cash"):
        root = GROUPS[name]
        bpy.data.objects[name+"_intact"].hide_render = True
        for obj in root.children:
            if obj.get("role") == "shard":
                obj.hide_render = False
                if name == "legend_cash":
                    obj.location.x *= 1.22
                    obj.location.z = (obj.location.z-0.54)*1.13+0.54
                else:
                    obj.location.x *= 1.65
                    obj.location.y *= 1.65
                    obj.location.z = (obj.location.z-0.3)*1.22+0.3
    scene.render.filepath = str(HERE/"fracture-review.png")
    bpy.ops.render.render(write_still=True)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--portrait", type=Path, default=HERE/"textures/legend-johnny-cash-runtime.jpg")
    parser.add_argument("--render", action="store_true")
    args = parser.parse_args(sys.argv[sys.argv.index("--")+1:] if "--" in sys.argv else [])
    OUT.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.preferences.filepaths.save_version = 0
    bpy.context.scene.unit_settings.system = "METRIC"
    material("museum_obsidian", (0.025, 0.044, 0.065), metal=0.3, rough=0.24)
    material("museum_petrol", (0.018, 0.13, 0.16), metal=0.48, rough=0.22)
    material("museum_ivory", (0.71, 0.76, 0.72), metal=0.15, rough=0.29)
    material("museum_brass", (0.62, 0.32, 0.08), metal=0.87, rough=0.23)
    material("museum_cyan", (0.09, 0.77, 0.85), metal=0.1, rough=0.2, emission=2)
    material("glass_rose", (0.93, 0.53, 0.66), rough=0.095, transmission=0.94)
    material("glass_aqua", (0.28, 0.79, 0.87), rough=0.07, transmission=0.96)
    material("glass_honey", (0.98, 0.70, 0.29), rough=0.09, transmission=0.94)
    material("legend_edge", (0.18, 0.56, 0.66), rough=0.075, transmission=0.95)
    material("legend_portrait", (0.035, 0.08, 0.12), metal=0.05, rough=0.23, transmission=0.06)
    marble = HERE/"textures/floor-marble-runtime.jpg"
    if marble.exists():
        image = bpy.data.images.load(str(marble), check_existing=True)
        image.pack()
        nodes = MATS["museum_ivory"].node_tree.nodes
        tex = nodes.new("ShaderNodeTexImage")
        tex.image = image
        MATS["museum_ivory"].node_tree.links.new(tex.outputs["Color"], nodes.get("Principled BSDF").inputs["Base Color"])
    platform("platform_terrace", 3.3, 3.3)
    platform("platform_island", 1.375, 1.375)
    platform("platform_ledge", 0.77, 2.2)
    platform("platform_bridge", 1.1, 3.3, "bridge")
    platform("platform_plinth", 1.375, 1.375, "moving")
    ramp()
    architecture()
    astrolabe()
    vessel("vase_rounded", [(0.09, 0), (0.115, 0.035), (0.15, 0.11), (0.155, 0.19), (0.128, 0.265), (0.08, 0.31), (0.064, 0.335), (0.067, 0.36)], MATS["glass_rose"])
    vessel("vase_fluted", [(0.07, 0), (0.105, 0.045), (0.125, 0.14), (0.112, 0.24), (0.072, 0.34), (0.042, 0.40), (0.038, 0.58), (0.052, 0.665), (0.057, 0.69)], MATS["glass_aqua"], flute=0.045)
    vessel("vase_amphora", [(0.10, 0), (0.145, 0.06), (0.197, 0.18), (0.19, 0.30), (0.145, 0.40), (0.085, 0.455), (0.078, 0.50), (0.095, 0.55)], MATS["glass_honey"], flute=0.018)
    legend(args.portrait)
    batch_ornaments()
    inspect_assets()
    for bundle in ("platform-kit.glb", "vessels.glb", "legend-slab.glb"):
        export_bundle(bundle)
    manifest = {"version": 1, "units": "metres", "up": "+Y", "front": "+Z", "builder": "art/glass-adventure/build_assets.py",
                "blenderVersion": bpy.app.version_string, "assets": ASSETS,
                "assetUrls": {"museum-kit": "platform-kit.glb", "vessels": "vessels.glb", "vessel-vase": "vessels.glb", "vessel-fluted": "vessels.glb",
                              "legend-slab": "legend-slab.glb", "legend-johnny-cash": "legend-johnny-cash.webp", "floor-marble": "floor-marble.webp", "museum-sky": "museum-sky.webp"},
                "textures": json.loads((HERE/"textures/provenance.json").read_text()),
                "bundles": {f: {"bytes": (OUT/f).stat().st_size, "sha256": hashlib.sha256((OUT/f).read_bytes()).hexdigest()} for f in ("platform-kit.glb", "vessels.glb", "legend-slab.glb")}}
    (OUT/"manifest.json").write_text(json.dumps(manifest, indent=2)+"\n")
    bpy.ops.wm.save_as_mainfile(filepath=str(HERE/"museum-kit.blend"))
    if args.render:
        render_preview()
    print("ADVENTURE_ASSETS=" + json.dumps({"output": str(OUT), "bundles": manifest["bundles"]}))


if __name__ == "__main__":
    main()
