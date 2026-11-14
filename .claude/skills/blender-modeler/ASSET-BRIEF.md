# <Asset name>: brief

Copy this file next to the build script as `BRIEF.md`. Fill every section
before the first vertex; write INFERRED next to anything no reference shows.

## What it is and where it lives

One paragraph: what the object is, where in the game it stands, what the player
does with it (looks, breaks, walks on), and which shipped file it replaces, if
any.

## Role and cameras

- Gameplay camera distance and the asset's size on screen (desktop and phone).
- Closer inspection, if any.
- For breakables: how long the shards are on screen.

## Runtime contract

Read from the shipped GLB and the code that loads it, not from memory: node
names, extras, height, shard count, collider, orientation, budget. Mirror it in
`contract.json`.

## Reference

Concept images with their camera elevation (`references/qa.md` § Measuring the
elevation); real-world references for how the object is actually built; any
donor mesh.

## Parts and why they exist

| Part | Why | Material |
| ---- | --- | -------- |

## Measured dimensions (metres)

| Feature | Measurement | Source |
| ------- | ----------- | ------ |

## Must survive at gameplay size

The motifs and materials a player must be able to see in the 128 px panel, and
what is deliberately left out of this version.

## Budget

Triangles intact and shards, textures, file size.

## Gates

Which silhouette pass, the contract, the Khronos validator, the critic, and who
decides the swap into the game.
