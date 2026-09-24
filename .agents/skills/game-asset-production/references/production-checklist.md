# Production checks that affect the game

Use relevant rows for the asset; document intentional exceptions with evidence.
Avoid a blanket polygon budget or a checklist that declares everything passed
because a parser accepted the file.

| Area          | Review and acceptance                                                                                                                                                                                                                                             |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hidden detail | Include reflections, shadows, refraction, inspection cameras and surfaces revealed by movement or shattering before removing bevels. A hidden window edge may be redundant; glass thickness usually is not.                                                       |
| Intersections | Inspect coplanar flicker, frame/wall joins, leaves crossing trim and motion endpoints. Bounds overlap is a search aid, not proof of a mesh intersection. Intentional join overlap belongs inside opaque structure.                                                |
| Contact       | Use a shared measured contact datum, flat support and consistent pivot. Inspect the feet/base and contact shadow. Do not distort the visible mesh by flattening everything near an inferred contact plane.                                                        |
| Topology      | Check zero-area triangles, loose pieces, duplicated faces, disconnected sheets and orientation. Closed solids require manifold, consistently oriented volume; decorative leaf sheets and arches have different requirements.                                      |
| Normals       | Preserve meaningful corner normals during material splits. Negative/mirrored transforms affect winding. Interior cavity faces intentionally face into the cavity. Do not use double-sided rendering to conceal an inverted closed shell.                          |
| Baking        | Freeze UV, triangulation and corner-normal basis; project isolated high-to-low pairs with a controlled cage. Check misses, adjacent-leaf contamination, reversed relief, UV seams and mip padding. Base color should not contain baked specular highlights.       |
| PBR           | Check sRGB base/emissive vs linear normal/ORM maps, tangent convention, metallic/roughness channel assignment and glass thickness. View normal-only and geometry-only variants before stacking relief maps.                                                       |
| Instancing    | Confirm `InstancedMesh`/equivalent in runtime, not only shared geometry or object clones. Batch by visibility region, retain stable picking IDs, update instance buffers/bounds after motion. Record unique material, skin, fracture and transparency exceptions. |
| Fracture      | Closed individual shard volumes, plausible interior thickness, intact alignment, atomic swap, bounded debris, pivots and cleanup. Inspect the first broken frame and several later frames; a finished intact preview does not prove fracture.                     |
| Animation     | Preserve bind pose and root-motion contract; test transition poses, hands/feet contact, bounds and camera. Do not apply transforms to an accepted rig blindly.                                                                                                    |
| Runtime       | Fresh GLTFLoader import, resources actually loaded, exact hashes, no decoder surprises, reasonable texture memory, hidden-room culling, disposal and retry behavior. Actual tablet frame time and heat cannot be inferred from SwiftShader screenshots.           |

## Practical production sequence

**Geometry:** inspect the dense source before any reduction. Mark a few focal
features. Make one representative retopology/bake proof first. For columns,
arches and fascia, authored clean surfaces often outperform a global collapse.
For flowers and ornate edges, preserve the outline and choose density where the
nearest allowed view needs it. If a source is already melted, repair or replace
that component rather than increasing its triangle count.

**Transfer:** unwrap with useful texel density and padding. Bake color, roughness,
metal and tangent normals independently, with neighboring shells excluded where
needed. A provider-generated normal texture is not proof of a source-detail bake.
Retain the original maps and packed project. Compare 1K/2K/4K only where screen
coverage justifies it; decoded RGBA memory is roughly width × height × 4 per map,
plus about one third for a full mip chain, regardless of tiny WebP download size.

**Delivery:** export stable root names, contact and movement anchors, transform
conventions and semantic extras. Validate the glTF; reopen it without authoring
state. Compare the same game camera before and after. Mesh compression requires
the corresponding runtime decoder and supported device path; attribute quantizing
does not remove triangles. Retain a working fallback only when it is an intentional
product behavior, not a way to call a rejected candidate complete.

**Evidence:** identify assets by hash, not only friendly filename. Record source
and delivery triangles, exported vertices (UV seams/hard edges split vertices),
map dimensions, bytes, draw/pass costs, visual acceptance and device limitations.

## Primary references

Reviewed 24 September 2026; confirm version-sensitive settings when producing.

- [Blender Cycles baking](https://docs.blender.org/manual/id/5.0/render/cycles/baking.html): selected-to-active projection, cage/ray distance and bake margins.
- [Blender glTF exporter](https://docs.blender.org/manual/id/5.0/addons/import_export/scene_gltf2.html): supported PBR layout, normals, tangents and export behavior.
- [Blender Collapse implementation](https://github.com/blender/blender/blob/v5.2.2/source/blender/bmesh/tools/bmesh_decimate_collapse.cc): verify vertex-group weight behavior in the installed version.
- [Meshy remesh](https://docs.meshy.ai/en/api/remesh): triangle decimation versus quad-dominant topology; requested and actual counts differ.
- [Three.js InstancedMesh](https://threejs.org/docs/pages/InstancedMesh.html): compatible shared geometry/material, instance matrices and bounds.
- [Khronos glTF validator](https://github.com/KhronosGroup/glTF-Validator): structural validation complements visual and behavioral testing.
