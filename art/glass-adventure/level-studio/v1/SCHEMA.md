# Cloudway level design spec v1

The exported root is always:

```json
{
  "schema": "mercurypitch.cloudway-level",
  "schemaVersion": 1,
  "id": "lowercase-level-id",
  "title": "Readable title",
  "grid": { "width": 32, "depth": 22, "cellSize": 1 },
  "melody": {
    "id": "melody-id",
    "title": "Melody title",
    "notes": [{ "id": "home", "label": "Home", "semitones": 0 }]
  },
  "pieces": []
}
```

Coordinates use logical world units. `x` and `z` locate the center of a piece's
footprint; `y` is its walkable top elevation. `width` and `depth` describe the
unrotated local footprint. `rotation` is one of `0`, `90`, `180`, or `270`
degrees around `y`; a quarter-turn therefore swaps the footprint's X/Z extent.
The grid is centered at X 0, Z 0.

Every piece has these common fields:

```json
{
  "id": "unique-piece-id",
  "kind": "platform",
  "name": "Readable piece name",
  "x": 0,
  "y": 0,
  "z": 0,
  "width": 4,
  "depth": 3,
  "rotation": 0,
  "assetId": "emerald-square-turn"
}
```

`assetId` is optional and must be one of the curated, piece-compatible IDs in
the editor. It is a design reference; the runtime adapter must resolve it.

## Piece variants

A platform adds `surface`:

- `stable` and `frost` add no behavior fields.
- `crackle` adds `crackleSeconds`, exactly `2` or `4`.
- `glide` adds `motion: { axis, travel, durationSeconds }`. It translates the
  whole platform along X or Z.
- `scroll` adds `motion: { axis, minLengthRatio, extendedSeconds,
retractedSeconds, transitionSeconds, initialState }`. Its footprint is the
  fully extended deck. The axis is local, before piece rotation. It changes
  deck length around the same center; it does not translate a raft. An adapter
  to world-aligned bounds swaps X/Z for rotations 90 and 270, and preserves the
  axis for rotations 0 and 180.

A marker uses `kind: "marker"` and adds `marker`, one of `spawn`,
`checkpoint`, or `exit`.

A voice target uses `kind: "voiceTarget"` and adds:

```json
{
  "melodyNoteId": "home",
  "holdSeconds": 1.2,
  "requiresCompletedIds": ["checkpoint-middle"]
}
```

`requiresCompletedIds` is optional. Every entry must name another piece in the
same file. It records intended authoring order; the studio does not simulate
completion.

## Bounded ranges

| Field                          | Range                           |
| ------------------------------ | ------------------------------- |
| pieces                         | 0–256                           |
| melody notes                   | 1–32                            |
| grid width / depth             | 8–96 / 8–72                     |
| grid cell size                 | 0.25–4                          |
| x, z                           | -96–96                          |
| y                              | -12–48                          |
| width, depth                   | 0.5–24                          |
| glide travel                   | 0.5–32                          |
| hold / rest / duration seconds | 0.1 or 0.25–60, field-dependent |
| scroll transition seconds      | 0.25–30                         |
| scroll minimum length ratio    | 0.1–0.95                        |
| note semitones                 | -24–24                          |

Passing schema and top-view checks does not establish jump reachability,
collision, camera clearance, input timing, or playability.

The top-view checks warn when a spawn, checkpoint, exit, or voice target has no
platform at its elevation, extends beyond its supporting footprint, or rests
only on a crackle, glide, or scroll platform. Stable anchor zones remain an
authoring decision until runtime playtesting confirms them.
