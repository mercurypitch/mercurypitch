# Lessons

This skill's own mistakes, newest first. Read before a first build; add a line
whenever a gate or a critic catches something a rule should have prevented.

- **Pure metal shows the sky it faces.** The museum HDR's ground is brown and a
  fifth as bright as its sky (luminance 0.20 against 1.0), and every smooth gold
  surface that faces the floor mirrors it: the amphora's wave line rendered
  copper (hue 30, value 0.43) where the concept's gold is hue 39, value 0.64.
  Under `--env room` the same line was gold, which located the fault. Gold trim at
  metallic 0.75 and the inlay line at 0.6, on a lighter base, measured within two
  degrees of the concept.
- **A soft blend of tints is one tint.** The first opal palette mixed five
  pastels with sinusoids; every corner averaged to the same pale blue and the
  body rendered porcelain (saturation 0.056 where the concept has 0.121). A
  soft-max over drifting fields keeps distinct patches. The museum's blue sky
  also pulls every tint toward aqua, so the dominant mint sits at hue 115.
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
