# Lessons

This skill's own mistakes, newest first. Read before a first build; add a line
whenever a gate or a critic catches something a rule should have prevented.

- **Format every file a round adds.** CI's changed-file check runs Prettier on
  everything the branch touches, receipts included: two of the amphora's critic
  reports, copied in as written, failed the PR gate. Run `pnpm run pr:validate`
  (with `PR_PREPARE_BASE` set to the merge base) before pushing a round.

- **Read the fracture's volume, not just its closure.** A cut piece of the urn's
  shoulder came back inside out (normals recalculated inward on a folded shape),
  so its volume read negative and the fracture dropped it as a sliver: 656 cm3
  of glass gone, every shard closed, every gate green at a volume ratio of 0.992.
  The fracture now turns such a piece the right way, reseeds on an open one and
  reports the slivers it drops; a ratio off 1.000 by more than a few parts in a
  thousand is a hole until shown otherwise.
- **`pgrep -f` and `pkill -f` match the shell that runs them.** A wait loop on
  `pgrep -f "runtime_proof.mjs.*u21"` matched its own command line and never
  ended, and held up every other wait on the same name; `pkill -f "full.sh u23"`
  killed the shell that sent it. Kill by PID, and let `runtime_proof.mjs`'s port
  lock do the queueing.

- **Frost the transmission, not the surface.** Clear glass in this game shows the
  room through it: the urn's lower lobes carried the gallery's black wainscot as a
  brown band and the cup's far edge as a line, two rounds running. Roughness 0.4
  under a clear coat of 0.5 (coat roughness 0.03) blurs what lies behind while the
  highlights stay sharp; the colour then comes from the base and volume colours
  (probed: hue 30 against the concept's 30, from 26).

- **A critic's fix is a hypothesis; probe it in the game.** Round 3 asked for the
  urn's laurel leaves at metallic 1.0 and roughness 0.25. Built, the shoulder band,
  which faces the ceiling, mirrored it dark: median luminance 93 against the
  concept's 154, darker than before. Two probes found 0.6 and 0.4 (122). When a
  fix is not taken as asked, the ledger says why, with the numbers.

- **A crease that fades out must fade along a concave curve.** The urn's creases,
  grown at the lobes' rate out of the cup, turned the valley back in; clamped not
  to, the valley stood upright for 4 cm while the body flared round it; joined to
  the full crease at 0.33 m, the curve steepened again near its end. Each read as
  a closed eye in zebra, three rounds running. One cubic from the cup's cusp to
  the full crease at the belly, its end slopes held so it stays concave
  (2 s_a + 4 s_b <= 6 x secant), solved where the pushed vertices land (a push
  along the normal lifts them too, 2 cm here), removed it.

- **Sink a part along the same direction the wall under it moved.** The urn's
  cup was offset across, at fixed height, from a wall tucked 10 mm along its
  normal; on a shelf flaring at 60 degrees that tuck is 25 mm across, so the
  cup's inner face, "2 mm inside the glass", stood 3.6 mm off it: the critic's
  slot behind the cup, two rounds running. Offset both along the outline's
  normal, and measure each vertex's signed distance to the wall before a round.

- **The fracture and the shard gate must agree on touching.** The fracture
  grouped a cell's pieces by crossing surfaces; the gate by crossing or lying
  within 1.5 mm. The urn's cup, sunk 2 mm into the glass, crosses it only at its
  rim and foot, so every cell between them came out as two shards and 24 seed
  sets failed. The fracture now groups by the gate's rule, `validate.touching`.

- **A corner's normal is diagonal.** The urn's lobes, pushed along each profile
  point's normal, moved the floor's corner up and in: the floor rose 2 cm in
  every crease and its long inner chord cut the outer wall (16 crossing pairs).
  A floor corner moves straight in (`modulate` may return `(dr, dz)`), and the
  floor itself not at all. Where a near-flat span tilts a hair outward, its
  normal flips side too: keep modulations off floors and lips.

- **Limit a modulation by ring, not by column.** Holding the urn's crease depth
  back where the valley would turn inward, column by column, left a valley
  shallower at its centre than at its sides: a ridge in the crease and 24
  crossing faces. Setting the limit on the valley column and scaling every
  column of that ring by the same share keeps the section's shape.

- **The silhouette gate measures in heights of the mask.** The urn's foot refit
  moved its bottom ring 1.5 mm in, which raised the mask's lowest point 1 mm;
  every row shifted, and the fast-flaring cup two bands up read 5 mm wider per
  side (band 2 from +2.1% to +3.6%) while no vertex there had moved. Keep the
  lowest and highest silhouette points fixed when refitting anything else, and
  project the mesh yourself before chasing a band that should not have moved.

- **In the game's light, brightness and colour play trade off.** The amphora's
  round 7 critic read its opal darker than the wall behind it (median luminance
  164 against the concept's 208). Probes lifting every patch 8 to 12 L\* with
  transmission down to 0.15 reached 180-185, and the chroma spread fell from
  11.8 to 4-5 and the hue went cyan-blue: the room's light on a near-white
  surface. Lifted to near white it reads 185 at most, its wall 173, so the
  concept's 208 belongs to its studio, not to a material; it is the owner's
  call (colour, brightness, or light for the exhibit).
- **The game ignores emission on its glass.** Urn probes with an amber emissive
  at strength 0.5 measured identical to none. Do not reach for a glow.
- **Clear glass shows the gallery, not the concept's backdrop.** At transmission
  0.9 the urn read as glass but pale and smoky (saturation 0.5 against 0.8), the
  wall's black skirting a dark band through its lobes. At 0.5 on a saturated base
  it kept its colour (0.75) and still showed the room faintly.
- **A shadow painted into the albedo reads as glaze.** The urn's valleys tinted
  down to 5% in COLOR_0 made it glazed pottery to the round 2 critic (craft rule
  11). A mild lean toward the thicker glass's colour is the allowance; the
  geometry and the translucency shade the rest.
- **Probe before a round.** `glb_patch.py`, `glb_recolour.py` and
  `runtime_batch.py` answered the urn's glass question in seven probes and twenty
  minutes, where a rebuild and a critic take an hour each.

- **Match the concept at the size the game draws it.** The amphora's round 6
  candidate read Lab chroma spread 20.8 and a\* -15 on its belly in the game,
  where the concept scaled to the same pixel size reads 11.7 and -7.0;
  three_preview had called it a match. Measure the same region in both, found
  per image between landmarks (the collar's gold and the band's gold line), not
  a fixed box: a box that caught the collar read b\* five units too yellow. The
  chroma push that matched was half the preview's (1.5, not 3).
- **Faces that look down take the floor's colour.** The amphora's jade foot faces
  the hemisphere light's teal ground and read hue 148 where its handles read 133. A yellower, lighter COLOR_0 on the foot alone (`paint_corners` passes each
  face's material) moved it to 127 against the concept's 130.
- **A band proud of a shallow slope widens the silhouette.** The urn's shoulder
  band stood 4.5 mm off a 21 degree shoulder, and its outline read 12 to 22 mm
  wide per side: proud divided by the sine of the slope. Set the glass in under
  the band so its fillets sit on the outline.
- **The game will not load a breakable without its shards.** An intact-only urn
  failed at asset load ("Glassworks renderer attempt failed"). Tune materials in
  the runtime proof on full builds.
- **Thin rings are the slivers.** A 2 mm ring on a 5.6 cm segment is a triangle
  under 2 degrees: the amphora's band corners and a hidden 1 mm ring on its foot
  were 176 of its 182. Chamfer at band scale; give a corner rings only where a
  segment is short.
- **A dissolve can leave a quad behind.** `scene.clean` dissolved degenerate
  geometry after its last triangulation and left a quad with one corner on the
  line between two others; the exporter split it along that line into a
  zero-area triangle in two shards. It now triangulates last.
- **`profile.resample` below three returns its input.** Two rings asked for
  under the urn's cup came back as the spline's fifteen points: 1,664 triangles.
- **Float32 ends, again.** `radius_at` and `tangent_at` missed a height read off
  an outline's own end point (0.607 stored as 0.60699999) and answered None and
  vertical; both now take a micron either side.

- **Bin hues the way the eye does, and measure in the game.** Round 3 put the
  opal's mint at hue 113 because a coarse 90-170 "mint" bin said it matched the
  concept. In the game 98% of the body read yellow-green (60-130) where the
  concept is mint-cyan (130-200), milky and lavender. A milky cyan-white palette
  with mint-cyan, aqua, lavender and warm glints measured 84% mint-cyan at
  saturation 0.16 in the runtime proof, against the shipped file's 0.21.
- **Rooms re-light themselves.** Galleries with a `reflectionProbe` swap the HDR
  for a capture of the room, so the preview is a guide for colour and the
  runtime proof is the measure; pale tints read 1.6 times as saturated there.
- **The sheet's material panel lied about the opal.** Cycles under a Standard
  view transform and a strong studio key clipped the pale glass to white, and
  the round 2 critic read the opal as flat white while three.js drew pastel.
  Material panels now use ACES 1.3 at the game's exposure, and the sheet carries
  a column from the game's own three.js (`three_preview.mjs`).
- **A ring that turns 0.6 degrees is a ring wasted.** The amphora's heel turned
  19 degrees per ring next to a ring that turned 0.6, and the handle's crown 19
  degrees between evenly spaced samples. Measuring the turns and resampling by
  curvature fixed both; 30 segments instead of 32 paid for the extra rings.
- **Hammered everywhere is not the concept.** The concept polishes the cuffs,
  linings, straps and stem ring; one hammered gold on every part read wrong at
  close range.
- **Several shells can still be one shard.** Fracture cells cut through parts
  that touch (a ring on a foot, a handle in its sleeve), so 11 of 18 shards had
  2-5 shells; all touched. The gate now counts pieces that float free instead.
- **Pure metal shows the sky it faces.** The museum HDR's ground is brown and a
  fifth as bright as its sky (luminance 0.20 against 1.0), and every smooth gold
  surface that faces the floor mirrors it: the amphora's wave line rendered
  copper (hue 30, value 0.43) where the concept's gold is hue 39, value 0.64.
  Under `--env room` the same line was gold, which located the fault. Gold trim at
  metallic 0.75 and the inlay line at 0.6, on a lighter base, measured within two
  degrees of the concept.
- **A soft blend of tints is one tint.** The first opal palette mixed five
  pastels with sinusoids; every corner averaged to the same pale blue and the
  body rendered porcelain. A soft-max over drifting fields keeps distinct
  patches.
- **Test the cause before writing it down.** The copper line was first blamed on
  iridescence and the film was removed; a render with the film back changed the
  line's hue by one degree. Change one thing per render and measure it.
- **The exporter drops Sheen Weight.** Blender 5.2.2 writes Sheen Tint as
  `sheenColorFactor` and ignores the weight, so a sheen of 0.2 shipped at full
  strength; `materials.principled` scales the tint by the weight.
- **Meshopt compression is lossy.** The exporter's meshopt option quantises
  positions and made a clean shard self-intersect. Export uncompressed: the
  amphora is 1.5 MB, the Meshy file it replaces 3.8 MB.
- **One colour attribute, not two.** With all vertex colours exported, two shards
  carried COLOR_0 and COLOR_1; `export.glb` exports only the active set, and
  `paint_corners` skips meshes with no tinted face.
- **Clear glass is not opal.** Round 1 had transmission 0.82: the body took its
  colour from whatever was behind it, grey below and clipped white above. Milky
  glass keeps its own colour at transmission 0.35 or less and roughness about
  0.2; its colour play is pastel vertex colours, with the thin film for the
  edge glint.
- **Vertex colours ride on every primitive.** Once one material uses COLOR_0
  the exporter writes it for the whole mesh and three.js multiplies every
  material by it: paint gold and jade corners white (`materials.paint_corners`).
- **A thin inlay is a texture, not a tube.** A 6 mm gold line swept as geometry
  cost 900 triangles and still showed its polyline in the curls. As an inlay
  material (`textures.inlay`) the line is smooth at any distance, carries its
  relief in a normal map, and costs nothing in triangles.
- **Cut debris below the collapse distance.** A 4-7 micron triangle reads as zero
  area to the validator but is too long-edged for a 1 micron collapse; clean
  shards at 10 microns.
- **Keyboard walks are not repeatable in the runtime proof.** Holding W under
  software WebGL moved the camera differently on every run; frame the asset with
  camera drags from a seeded checkpoint instead.
- **A grid read by eye is not a measurement.** The amphora's lower body was read
  off a metre grid as 0.20 m radius at 0.23 m height; the concept's mask says
  0.177. The first build was 2.5 cm too wide per side and the gate failed band 2. Read radii from `rows.json` (`qa.md` § Fitting).
- **glTF splits what Blender welded.** After export and import every seam, hard
  edge and material change is a boundary; the contract gate called every part
  open until it welded at 1e-6 first.
- **The exporter triangulates your n-gons.** Fracture shards passed every check
  in Blender and failed after export with zero-area triangles: the exporter's
  triangulation of collinear cut vertices. Triangulate and clean before export.
- **Seed the fracture on every part.** Seeds on the body alone gave one shard
  that held the whole solid foot, 42 per cent of the mass.
- **A tube that shrinks keeps its aspect.** The handle's tail, built by
  shrinking its radius, came out a round needle; the concept's tail is a flat
  gold leaf. A strap on a wall needs a lens section that keeps its width
  (`craft-rules.md` § 7).
- **A seated end can fold.** Seating a handle root into a neck that flares
  across the root put the first ring outside the second: two self-intersecting
  faces. Clear the next rings of the wall.
- **A smooth core must clear concave corners.** The inner wall followed a core
  that passed above the collar's foot and came out through the shoulder.
- **One chord across a flaring neck cuts its wall.** Sampling the whole cavity
  with eight points put a chord outside an 8 mm neck wall. Sample in runs.
- **Single precision.** `mathutils.Vector` is float32: 0.15 stored is not <= 0.15
  typed, and an outline piece came back empty. Compare with a micron tolerance.
- **A collider is not a plinth.** The audit first criticised Meshy vessels for a
  crude plinth that was the hidden 12-sided collision proxy. Hide proxies in
  every render (`render_views.py` does).
- **Read the runtime contract from the shipped file.** The plan said 16 shards;
  the catalog and the shipped GLB say 18. The contract gate is written from the
  file, not from memory.
