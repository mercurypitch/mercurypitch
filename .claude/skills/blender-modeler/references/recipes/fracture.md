# Recipe: fracture

```python
shards = fracture.fracture(parts, 18, cut_materials=cut, seed=7, seed_on=parts,
                           prefix=f'{ROOT}_shard_')
```

- `parts`: the final closed shells, unjoined (body, rings, handles, inlays).
  Fracture before joining the intact copy; the parts stay untouched.
- `cut_materials`: `{part name: material}` for the new cut faces. Glass breaks
  into a rougher cut glass, gold into gold, jade into jade.
- `seed_on=parts`: seeds by surface area over every part. On the body alone a
  solid foot gets no seed and leaves as one heavy shard.
- `seed` is fixed, so the build is deterministic. An attempt is redrawn when any
  cell's pieces do not touch (the shard would fly apart as one object).
- Pieces under 0.2 per cent of their own part's volume are dropped as chips;
  per part, so a thin inlay keeps its pieces.
- Each shard is joined, then triangulated and cleaned with
  `scene.clean(shard, triangulate=True)`, and its origin moved to its centroid.

Then, in the build, gate every shard before export:

```python
problems = validate.failures(validate.report(shard, within_shell=True, weld=1e-6))
```

and give it `shard['role'] = 'shard'` and the root as parent. The contract gate
checks count, names, closure, origins, the shard budget and that the shards hold
the intact volume within 3 per cent.

Look at the shard sheet (`asset_pipeline.py --shards-sheet`): the cut faces
should show the wall, the pieces should vary in size without slivers, and no
shard should be most of the vessel.
