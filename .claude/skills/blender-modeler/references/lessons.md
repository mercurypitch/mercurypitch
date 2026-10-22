# Lessons

This skill's own mistakes, newest first. Read before a first build; add a line
whenever a gate or a critic catches something a rule should have prevented.

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
