# Blender 5 gotchas

bpy written from memory of Blender 2.8 to 3.x breaks on 5.2 in quiet ways.
Everything here cost at least one failed run.

## API

- `mesh.use_auto_smooth` is gone (4.1). Use `mesh.set_sharp_from_angle(angle=radians)`
  (`bkit.scene.mark_sharp`); per-face smoothness is `poly.use_smooth` or
  `bmface.smooth`.
- Principled BSDF socket names: `Transmission Weight`, `Coat Weight`,
  `Coat Roughness`, `Thin Film Thickness`, `Thin Film IOR`, `Specular IOR Level`.
- `material.use_nodes` is deprecated; new materials already have a node tree.
- Operators that need a context (`object.join`, modifier apply) run inside
  `bpy.context.temp_override(active_object=..., selected_objects=..., selected_editable_objects=...)`.
  Prefer data paths: `bpy.data.meshes.new_from_object(evaluated, preserve_all_data_layers=True, depsgraph=...)`
  bakes modifiers without an operator.
- `mathutils.Vector` is single precision. Two points computed two ways (an
  interpolation and a radius lookup) differ by about 1e-8; compare with a
  micron tolerance, and treat a height within 1e-6 of an outline's end as on it.

## Export and import

- `export_scene.gltf(export_apply=...)` defaults to False: every modifier is
  dropped. `bkit.export.glb` always sets it.
- KHR_materials_volume and KHR_materials_iridescence are written only from the
  glTF Material Output group node. Add them after export (`gltf_finish.py`).
- The importer stores a vertex once per UV seam, hard edge and material, so an
  imported closed shell reads as open along every seam. Weld (1e-6 m) before any
  topology check (`validate.report(..., weld=1e-6)`).
- The exporter triangulates n-gons itself. A boolean cut face is an n-gon with
  collinear vertices, and its triangulation leaves zero-area triangles that no
  check in Blender sees. Triangulate and clean before export
  (`scene.clean(obj, triangulate=True)`).
- Blender +Z up becomes glTF +Y up (`export_yup=True`); a node's translation is
  in glTF axes, so a collider at Blender z 0.322 is glTF y 0.322.
- Custom properties become node `extras` only with `export_extras=True`.

## Headless rendering

- Workbench needs `libegl1 libegl-mesa0` in a container
  (`preflight.sh` installs them); it renders on llvmpipe.
- Cycles runs on CPU. EEVEE on CPU is slow and rendered glass black: skip it.
- Exact flat colours (part and material IDs) need the `Raw` view transform and
  anti-aliasing off; `Standard` shifts them.
- Zebra: Workbench MATCAP with `check_reflection_horizontal.exr`.
- `read_factory_settings(use_empty=True)` gives a scene with no default cube,
  light or camera to leak into an export.
