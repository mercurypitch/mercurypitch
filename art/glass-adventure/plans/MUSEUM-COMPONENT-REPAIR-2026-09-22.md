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

The owner explicitly approved source transfers for all three preserved models on
23 September ("yes, sure send the approval or just do it"). The earlier automatic
review rejection occurred before any task or charge; reconciliation verified that.
Production has now started: the V8 Conservatory remesh task is
`01a0ceb5-4dd4-7530-a1d0-6e920c57b326` (5 credits). V9 temple/cypress remeshes
follow, with independent geometry review before texturing. Keep the existing
public models until the replacements pass visual and runtime checks.

## Work checklist

- [x] Tighten Cloudway fog from 16–31m to 9–14m. Arrival, raft approach,
      midroute and both zoom extremes have actual WebGL screenshots under
      `art/glass-adventure/proofs/polish-2026-09-22/fog-tightened/`.
- [x] Owner accepted this fog range on 23 September; leave it unchanged.
- [x] Complete the component-level source/normal/history comparison; see
      `MUSEUM-SHAPE-AUDIT-2026-09-23.md`.
- [x] Inspect dense Conservatory, temple and cypress sources in neutral clay;
      useful ribs, silhouettes and separate openings survive in the dense donors.
- [x] Receive explicit source-transfer approval for Conservatory, temple and cypress.
- [ ] Produce and review V8/V9 remesh candidates; production is running.
- [ ] Review identical-camera original/current/candidate views before replacing
      any more public models. Technical validation alone does not establish quality.
- [ ] Finish runtime derivatives with useful texture detail, stable nodes,
      ground anchors and exact transforms. Keep original provider assets and packed
      Blender projects separately.
- [ ] Verify actual desktop/tablet views and record load bytes, draw calls and
      triangles. Owner tablet frame rate and heat remain separate acceptance checks.
- [x] Publish the shorter fog and source-review stages to PR #807; stable HTTPS
      preview refreshed. No replacement museum model has been installed yet.
- [x] Save camera smoothing/sensitivity and non-linear route ideas as backlog in
      `CAMERA-AND-ROUTE-FOLLOWUPS-2026-09-23.md`; no movement or route changes now.
- [x] Expand `GAME-ASSET-QUALITY-AUDIT.md` with the high-to-low detail workflow,
      source references and silhouette/UV/bake/runtime review gates.
- [x] Prepare V9 temple/cypress remesh receipts and comparison scripts; offline
      source/hash checks and unauthorized/taskless-resume guards pass. V8 has a
      prepared bake/finish script and a passing Blender normal-transform fixture.
      Full baking, candidate review and combined runtime packing remain unverified
      and unperformed because no replacement candidate exists yet.

Published stages: `c20538d2` (Conservatory source and live museum baseline),
`d6b70614` (shorter fog, seven passing tests and five rendered views), and
`e2045a1c` (temple/cypress source comparisons and geometry lineage). Independent
review found no correctness issues in the fog or capture harness. Cloud CI at
`ff36e14f` is green: 40 passing checks, one production-only skip. New changes
will receive a separate PR check run; no merge or release is authorized.

The shorter-fog HTTPS preview was restarted on 23 September and verified HTTP
200 at `https://192.168.178.33:5300/glass-game/?layout=cloudway`. Hot reload and
file watching are disabled. The server expires after three hours; stop with
Ctrl-C. Restart from any directory using:

```sh
rtk proxy timeout 10800 /home/maff/.nvm/versions/node/v22.22.2/bin/node /home/maff/.codex/worktrees/00ad/mercurypitch-agent/apps/beside-cue/scripts/glass-playtest.ts --https --host 0.0.0.0 --port 5300
```

One prior CI failure was formatting in `backdrop-fog.test.ts`, not a gameplay or
asset-loader error. The targeted correction is committed as `213a7672`; that
prior head passed all checks (40 passed, one production-only check skipped).

## Quality decisions

Do not subdivide a melted source and call the higher polygon count a repair.
Retain clean high-resolution Meshy shapes where they exist. If a donor itself
has fused plants or bent structural ribs, use a cleaner source or replace those
specific pieces during Blender finishing. Keep repeated architectural and plant
pieces shared. The full concept also needs planted scenic islands along the
existing Cloudway route; that remains separate from restoring these map assets.
