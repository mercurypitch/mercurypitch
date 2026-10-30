"""False-colour part-ID render (Workbench, flat object colours) + projected landmark/measurement JSON.
blender -b --factory-startup --python id_measure_probe.py -- <outdir>
"""
import bpy, sys, os, json, math, colorsys
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view

out = sys.argv[sys.argv.index("--") + 1]
os.makedirs(out, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene

# toy decanter: body (cylinder), neck (cylinder), stopper (sphere), handle (torus)
bpy.ops.mesh.primitive_cylinder_add(vertices=48, radius=0.08, depth=0.2, location=(0, 0, 0.1)); body = bpy.context.active_object; body.name = "PR_Decanter_Body"
bpy.ops.mesh.primitive_cylinder_add(vertices=32, radius=0.025, depth=0.08, location=(0, 0, 0.24)); neck = bpy.context.active_object; neck.name = "PR_Decanter_Neck"
bpy.ops.mesh.primitive_uv_sphere_add(radius=0.03, location=(0, 0, 0.3)); stop = bpy.context.active_object; stop.name = "PR_Decanter_Stopper"
bpy.ops.mesh.primitive_torus_add(major_radius=0.06, minor_radius=0.01, location=(0.1, 0, 0.14), rotation=(math.radians(90), 0, 0)); handle = bpy.context.active_object; handle.name = "PR_Decanter_Handle"
parts = [body, neck, stop, handle]
for i, o in enumerate(parts):   # evenly spaced hues = stable, distinguishable IDs
    r, g, b = colorsys.hsv_to_rgb(i / len(parts), 0.85, 0.95)
    o.color = (r, g, b, 1)

sc.render.engine = "BLENDER_WORKBENCH"
s = sc.display.shading
s.light = "FLAT"; s.color_type = "OBJECT"; s.show_shadows = False; s.show_cavity = False
sc.display.render_aa = "OFF"           # crisp ID edges so pixel colours map 1:1 to parts
sc.view_settings.view_transform = "Raw"
sc.render.resolution_x = sc.render.resolution_y = 512
sc.render.film_transparent = True
cam = bpy.data.objects.new("CAM", bpy.data.cameras.new("CAM")); sc.collection.objects.link(cam); sc.camera = cam
cam.data.type = "ORTHO"; cam.data.ortho_scale = 0.45
cam.location = (0, -2, 0.16); cam.rotation_euler = (math.radians(90), 0, 0)
sc.render.filepath = os.path.join(out, "id_front_raw.png")
bpy.ops.render.render(write_still=True)

# landmarks: world-space bbox extremes per part -> pixel coords, plus real sizes in mm
W, H = sc.render.resolution_x, sc.render.resolution_y
bpy.context.view_layer.update()
rep = {"camera": "front ortho", "parts": {}}
for o in parts:
    pts = [o.matrix_world @ Vector(c) for c in o.bound_box]
    lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    def px(v):
        c = world_to_camera_view(sc, cam, v)
        return [round(c.x * W, 1), round((1 - c.y) * H, 1)]
    rep["parts"][o.name] = {
        "id_rgb": [round(x * 255) for x in o.color[:3]],
        "size_mm": [round((hi - lo)[k] * 1000, 1) for k in range(3)],
        "top_px": px(Vector(((lo.x + hi.x) / 2, 0, hi.z))), "bottom_px": px(Vector(((lo.x + hi.x) / 2, 0, lo.z))),
        "left_px": px(Vector((lo.x, 0, (lo.z + hi.z) / 2))), "right_px": px(Vector((hi.x, 0, (lo.z + hi.z) / 2))),
    }
with open(os.path.join(out, "id_front_raw.json"), "w") as f:
    json.dump(rep, f, indent=1)
print("IDPROBE ok")
