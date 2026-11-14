"""Tested vessel recipe for Blender 5.2 headless: lathe profile -> solidify -> bevel lip -> smooth by angle -> UV seam unwrap
-> validate (bmesh) -> GLB export. Usage: blender -b --factory-startup --python vessel_recipe_test.py -- <outdir>
"""
import bpy, bmesh, math, sys, os, json, time
from mathutils import Vector
from mathutils.bvhtree import BVHTree

out = sys.argv[sys.argv.index("--") + 1]
os.makedirs(out, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
R = {}

def catmull_rom(points, samples_per_seg=8, alpha=0.5, corners=()):
    """Centripetal Catmull-Rom through control points (r, z); indices in `corners` stay sharp
    (the curve is split there). Returns a dense, smooth profile."""
    import math
    def seg(p0, p1, p2, p3, n):
        def tj(ti, a, b):
            return ti + max(1e-9, math.dist(a, b)) ** alpha
        t0 = 0.0; t1 = tj(t0, p0, p1); t2 = tj(t1, p1, p2); t3 = tj(t2, p2, p3)
        res = []
        for k in range(n):
            t = t1 + (t2 - t1) * k / n
            def lerp(a, b, ta, tb):
                return tuple(((tb - t) * x + (t - ta) * y) / (tb - ta) for x, y in zip(a, b))
            a1 = lerp(p0, p1, t0, t1); a2 = lerp(p1, p2, t1, t2); a3 = lerp(p2, p3, t2, t3)
            b1 = lerp(a1, a2, t0, t2); b2 = lerp(a2, a3, t1, t3)
            res.append(lerp(b1, b2, t1, t2))
        return res
    # split into runs at sharp corners
    cuts = sorted(set([0, len(points) - 1] + list(corners)))
    outp = []
    for a, b in zip(cuts, cuts[1:]):
        run = points[a:b + 1]
        ext = [tuple(2 * x - y for x, y in zip(run[0], run[1]))] + run + [tuple(2 * x - y for x, y in zip(run[-1], run[-2]))]
        for i in range(1, len(ext) - 2):
            outp += seg(ext[i - 1], ext[i], ext[i + 1], ext[i + 2], samples_per_seg)
    outp.append(points[-1])
    return outp

# 1. outer-wall profile (radius, z) in metres, bottom centre first, lip last (open top)
profile = [(0.0, 0.0), (0.045, 0.0), (0.05, 0.004), (0.047, 0.012),  # foot ring
           (0.085, 0.06), (0.11, 0.14), (0.105, 0.22), (0.07, 0.29),   # belly -> shoulder
           (0.035, 0.33), (0.03, 0.37), (0.038, 0.395), (0.042, 0.40)] # neck -> flared lip
outer = catmull_rom(profile, samples_per_seg=6, corners=(1, 3))
outer[0] = (0.0, outer[0][1])
T = 0.0035          # glass wall thickness (m)
BASE_Z = 0.012      # inner floor height: thick glass base like a real vessel
import math as _m
def normal2d(pts, i):
    a = pts[max(0, i - 1)]; b = pts[min(len(pts) - 1, i + 1)]
    dx, dz = b[0] - a[0], b[1] - a[1]; L = _m.hypot(dx, dz) or 1.0
    return (dz / L, -dx / L)            # outward (right-hand) normal for a profile going up
inner = []
for i, (r, z) in enumerate(outer):
    if z < BASE_Z + 0.012:              # below the floor the inner wall is the flat thick base
        continue
    nx, nz = normal2d(outer, i)
    inner.append((r - nx * T, z - nz * T))
def outer_r_at(zq):
    for (r0, z0), (r1, z1) in zip(outer, outer[1:]):
        if z0 <= zq <= z1 and z1 > z0:
            return r0 + (r1 - r0) * (zq - z0) / (z1 - z0)
    return outer[-1][0]
floor_r = min(inner[0][0], outer_r_at(BASE_Z) - T)   # keep the floor corner inside the outer wall
inner = [(0.0, BASE_Z), (floor_r, BASE_Z)] + inner
# rounded lip: half circle from outer top to inner top (no perfectly cut edge)
(ro, zo), (ri, zi) = outer[-1], inner[-1]
cx, cz, rad = (ro + ri) / 2, (zo + zi) / 2, _m.dist((ro, zo), (ri, zi)) / 2
a0 = _m.atan2(zo - cz, ro - cx)
lip = [(cx + rad * _m.cos(a0 + _m.pi * k / 6), cz + rad * _m.sin(a0 + _m.pi * k / 6)) for k in range(1, 6)]
profile = outer + lip + list(reversed(inner))   # closed cross-section: axis -> outer -> lip -> inner -> axis
bm = bmesh.new()
vs = [bm.verts.new((r, 0.0, z)) for r, z in profile]
es = [bm.edges.new((vs[i], vs[i + 1])) for i in range(len(vs) - 1)]
bmesh.ops.spin(bm, geom=vs + es, cent=(0, 0, 0), axis=(0, 0, 1), angle=math.tau, steps=64, use_merge=True)
bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-6)   # collapses the axis vertex ring into one pole
bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
# seam along the meridian at +X (y == 0, x > 0) so unwrap gives one clean island
for e in bm.edges:
    a, b = e.verts
    if abs(a.co.y) < 1e-6 and abs(b.co.y) < 1e-6 and a.co.x > 1e-6 and b.co.x > 1e-6:
        e.seam = True
me = bpy.data.meshes.new("PR_Amphora")
bm.to_mesh(me); bm.free()
ob = bpy.data.objects.new("PR_Amphora", me)
sc.collection.objects.link(ob)
bpy.context.view_layer.objects.active = ob; ob.select_set(True)

# 2. UVs from seams (before modifiers, so Solidify/Bevel propagate them)
bpy.ops.object.mode_set(mode="EDIT")
bpy.ops.mesh.select_all(action="SELECT")
bpy.ops.uv.unwrap(method="ANGLE_BASED", margin=0.02)
bpy.ops.object.mode_set(mode="OBJECT")

# 3. wall thickness, then round the cut lip (no perfectly sharp edges), then smoothing by angle
bpy.ops.object.shade_auto_smooth(angle=math.radians(35))   # adds the 'Smooth by Angle' GN modifier (4.1+)

# 4. evaluate + validate with bmesh on the evaluated mesh
dg = bpy.context.evaluated_depsgraph_get()
eo = ob.evaluated_get(dg)
em = eo.to_mesh()
b2 = bmesh.new(); b2.from_mesh(em)
b2.edges.ensure_lookup_table(); b2.faces.ensure_lookup_table()
R["verts"] = len(b2.verts); R["faces"] = len(b2.faces)
R["tris"] = sum(len(f.verts) - 2 for f in b2.faces)
R["non_manifold_edges"] = sum(1 for e in b2.edges if not e.is_manifold)
R["boundary_edges"] = sum(1 for e in b2.edges if e.is_boundary)
R["wire_edges"] = sum(1 for e in b2.edges if e.is_wire)
R["loose_verts"] = sum(1 for v in b2.verts if not v.link_edges)
R["zero_area_faces"] = sum(1 for f in b2.faces if f.calc_area() < 1e-10)
R["ngons"] = sum(1 for f in b2.faces if len(f.verts) > 4)
# self-intersection: BVH overlap of the mesh with itself, ignoring faces that share a vertex
bvh = BVHTree.FromBMesh(b2, epsilon=0.0)
pairs = bvh.overlap(bvh)
R["self_intersections"] = sum(1 for i, j in pairs if i < j and not (set(v.index for v in b2.faces[i].verts) & set(v.index for v in b2.faces[j].verts)))
R["uv_layers"] = [l.name for l in em.uv_layers]
R["dimensions_m"] = [round(x, 4) for x in ob.dimensions]
b2.free(); eo.to_mesh_clear()
R["mesh_validate_changed"] = ob.data.validate(verbose=False)

# 5. glass material, single-sided so glTF doubleSided=false
m = bpy.data.materials.new("MAT_Glass")
p = next(n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
p.inputs["Transmission Weight"].default_value = 1.0
p.inputs["Roughness"].default_value = 0.04
p.inputs["IOR"].default_value = 1.5
m.use_backface_culling = True
ob.data.materials.append(m)

# 6. export
t = time.time()
glb = os.path.join(out, "PR_Amphora_v3.glb")
bpy.ops.export_scene.gltf(filepath=glb, export_format="GLB", use_selection=True, export_apply=True,
                          export_texcoords=True, export_normals=True, export_tangents=False,
                          export_yup=True, export_meshopt_compression_enable=False)
R["glb_bytes"] = os.path.getsize(glb); R["export_s"] = round(time.time() - t, 2)

# 7. clay contact-sheet renders with Workbench (CPU llvmpipe OK)
sc.render.engine = "BLENDER_WORKBENCH"
s = sc.display.shading; s.light = "MATCAP"; s.studio_light = "basic_1.exr" if False else "clay_studio.exr"; s.color_type = "SINGLE"
sc.render.resolution_x = sc.render.resolution_y = 384
sc.render.film_transparent = True
cam = bpy.data.objects.new("CAM", bpy.data.cameras.new("CAM")); sc.collection.objects.link(cam); sc.camera = cam
cam.data.type = "ORTHO"; cam.data.ortho_scale = 0.5
centre = Vector((0, 0, 0.2))
views = {"front": (0, -1, 0), "side": (1, 0, 0), "top": (0, 0, 1), "threequarter": (0.7, -0.7, 0.35)}
t = time.time()
for name, d in views.items():
    dv = Vector(d).normalized()
    cam.location = centre + dv * 2.0
    cam.rotation_mode = "QUATERNION"; cam.rotation_quaternion = (-dv).to_track_quat("-Z", "Y")
    sc.render.filepath = os.path.join(out, "v3_clay_%s.png" % name)
    bpy.ops.render.render(write_still=True)
R["render_4_views_s"] = round(time.time() - t, 2)
with open(os.path.join(out, "vessel_report_v3.json"), "w") as f:
    json.dump(R, f, indent=1)
print("VESSEL3", json.dumps(R))
