# Remaining museum components and shorter Cloudway reveals

## Owner feedback and current scope

The 22 September screenshot shows the repaired central Twin Galleries balcony
surrounded by older domes, statues, cypresses and the Conservatory. The previous
batch replaced only `map_twin_connector`; it deliberately retained the V6
Conservatory and the V4 sculpture kit. That batch was not a complete museum
restoration. No new levels are being added.

Cloudway fog should reveal roughly the next landing and the landing after it,
not five platforms or the distant ending. Tune against actual route spacing and
camera zoom. Preserve the next jump edge, moving raft and crackle warning.

## Component inventory

| Visible component                        | Current source                       | Known loss or remaining issue                                                                                         | Action                                                                                                                  |
| ---------------------------------------- | ------------------------------------ | --------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Central balcony and vine arch            | V7 architecture kit                  | Already repaired from 18,259 to 102,607 triangles; some source foliage remains fused                                  | Preserve this repair; later replace only poor plant clusters                                                            |
| Amber/celadon domes and attached statues | V4 sculpture kit, built from V3      | Textured Meshy temple 21,839 triangles reduced again to 10,000; dome colour partition reuses that geometry            | Compare raw donor, packed source and runtime, including normals, before choosing restoration or a higher-quality source |
| Tall narrow cypresses                    | V4 sculpture kit, built from V3      | Textured Meshy tree 7,136 triangles reduced to 1,200                                                                  | Compare original silhouette; restore useful detail and preserve instancing                                              |
| Conservatory gazebo                      | V6 geometry copied unchanged into V7 | Preserved dense source about 1.2M triangles reduced to 22,870; ribs and foliage remain distorted                      | Produce one higher-detail Meshy remesh/retexture candidate, finish in Blender and review before installation            |
| Island cliffs                            | V4 sculpture kit, built from V3      | Textured Meshy cliff 15,747 triangles reduced to 8,000; stretched vertical composition may amplify texture distortion | Inspect after the architectural focal points; retain island anchors and waterfall alignment                             |

The later normals/shading pass is a separate causal question. Do not call it the
cause merely because it preceded the report. Compare vertex/index data, normals,
UVs, original lighting and the saved proof frames. Record whether the damage
already exists in the provider model, appears in reduction, or is shading only.

### Audit resumed on 23 September

The current V4 public model is byte-identical to its archived export and has
not changed since `cefaa3db` on 21 September. Its temple triangle positions
match V3 exactly after the amber/teal material split. Its normal attributes are
finite unit vectors; the journey loader parses glTF directly and does not call
the gameplay normal-repair helper. The recent normals pass did not introduce
the distorted silhouettes. Low-detail source remeshing and subsequent local
decimation already appear in the archived assets. The earlier V4 material split
did alter normals at 2.34% of the temple's indexed corners, which can add a
local dome seam; the replacement must preserve source normals through that split.

The preserved dense temple and tree have useful geometry to inspect, but lack
UVs and materials, so they cannot simply replace the game GLBs. The production
sequence is clay comparison, higher-detail Meshy remesh and retexture, Blender
finishing, matching-camera comparison, then runtime integration. V8 owns the
Conservatory replacement and preserves the accepted V7 balcony; V9 owns the
temples and cypress. Keep the current assets until each candidate clears review.

The first V8 submission was rejected by automatic approval review before its
process started. Read-only provider reconciliation confirmed no interrupted V8
job exists. No new task, upload or charge occurred. A specific upload approval
question now covers the preserved Conservatory, temple and cypress source files;
do not retry the submissions before that answer. Local proofs and packing work
can continue.

## Work checklist

- [ ] Tighten Cloudway fog using arrival, midroute and orbit/zoom screenshots.
- [x] Complete the component-level source/normal/history comparison; see
      `MUSEUM-SHAPE-AUDIT-2026-09-23.md`.
- [ ] Inspect the dense Conservatory source, then produce one V8 candidate if
      it retains useful ribs, canopy structure and separate openings.
- [ ] Review identical-camera original/current/candidate views before replacing
      any more public models. Technical validation alone does not establish quality.
- [ ] Finish runtime derivatives with useful texture detail, stable nodes,
      ground anchors and exact transforms. Keep original provider assets and packed
      Blender projects separately.
- [ ] Verify actual desktop/tablet views and record load bytes, draw calls and
      triangles. Owner tablet frame rate and heat remain separate acceptance checks.
- [ ] Publish the accepted stage to PR #807 and refresh the stable HTTPS preview.

One prior CI failure was formatting in `backdrop-fog.test.ts`, not a gameplay or
asset-loader error. The targeted correction is committed as `213a7672`; its
current PR checks are all green (40 passed, one production-only check skipped).

## Quality decisions

Do not subdivide a melted source and call the higher polygon count a repair.
Retain clean high-resolution Meshy shapes where they exist. If a donor itself
has fused plants or bent structural ribs, use a cleaner source or replace those
specific pieces during Blender finishing. Keep repeated architectural and plant
pieces shared. The full concept also needs planted scenic islands along the
existing Cloudway route; that remains separate from restoring these map assets.
