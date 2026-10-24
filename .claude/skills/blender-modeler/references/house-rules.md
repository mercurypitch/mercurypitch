# House rules: Glassworks

## Where things live

| What                                   | Where                                                                                                                                                 |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Procedural assets                      | `art/glass-adventure/procedural/<asset>/`: `build.py`, `BRIEF.md`, `asset.json`, `contract.json`, `optics.json`, `LEDGER.md`, `reference/`, `rounds/` |
| Runtime files the game loads           | `apps/beside-cue/public/games/<set>/<file>.glb`, listed in `packages/glass-game/src/browser/assets.ts`                                                |
| Breakable recipes (names, shard count) | `packages/glass-game/src/render/catalog.ts`                                                                                                           |
| Concepts and donors                    | `art/glass-adventure/v6-level2/concepts/`, `.../meshy/` (Git LFS)                                                                                     |

Concepts, donors and runtime GLBs are Git LFS objects. Pull only what you need
(`git lfs pull --include=<path>`); the runtime set is about 300 MB. Never commit
a pointer where a file is expected: `bkit.export.read_json` and
`runtime_proof.mjs` both detect one.

Swapping a new file into the game is the owner's decision, in its own commit.
Until then a candidate is proven by `runtime_proof.mjs`, which serves it in
place of the shipped file without changing the repository.

## The breakable contract

Read it from the shipped GLB (node names, extras, collider) and the catalog
entry, write it into `contract.json`, and let `validate_asset.py` hold it:

- Root: an empty named after the asset, no transform, extras `asset_id` and
  `units: metres`.
- `<root>_intact`: the whole vessel, base at z 0. The game recentres it on its
  bounds in X and Y and scales it to the catalog's `displayHeight`.
- `<root>_shard_000` and on, exactly the catalog's `shardCount`, each with its
  origin at its centroid, extras `role: shard`. A shard name the catalog does not
  expect is an error at load time.
- `COLLIDER_<root>`: kept identical to the shipped proxy for parity; the
  breakable loader does not read it, and proxies are never shown.
- Units are metres, Blender +Z up, glTF +Y up.

## Budgets

| Asset                      | Triangles                 |
| -------------------------- | ------------------------- |
| Hero vessel, intact        | 8,000                     |
| Shard set                  | 1.6 times the intact      |
| Small or background vessel | 4,000                     |
| Column or arch module      | 2,000 to 6,000            |
| Frame / platform           | under 2,000 / under 3,000 |

One material per surface family. Textures, when used: 1K mobile, 2K desktop.

## Commits

Follow the repository's own rules (AGENTS.md): `feat/` branches, no attribution
lines, the owner as author. Keep receipts small: the build script, the brief,
the gate summaries, the sheets as JPEG, the critic reports. A candidate GLB under
1 MB may sit in the asset folder; anything larger goes through LFS.
