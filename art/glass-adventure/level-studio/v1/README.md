# Cloudway Level Studio v1

A self-contained browser drafting tool for exploratory Cloudway layouts. It
places and edits platform footprints, route markers, and voice targets, then
exports a bounded JSON design spec for an authoring agent. It does not import
game code and does not claim a layout is playable.

## Start the studio

From any directory:

```bash
rtk /home/maff/foss/worktrees/mercurypitch/glass-cloudway-laboratory/node_modules/.bin/vite \
  /home/maff/foss/worktrees/mercurypitch/glass-cloudway-laboratory \
  --config /home/maff/foss/worktrees/mercurypitch/glass-cloudway-laboratory/art/glass-adventure/level-studio/v1/vite.config.mjs \
  --host 0.0.0.0 --port 5633 --strictPort
```

Open:

```text
http://127.0.0.1:5633/art/glass-adventure/level-studio/v1/index.html
```

The process runs until its terminal closes or receives `Ctrl+C`. `--strictPort`
stops with an error if another process already owns port 5633. Binding to
`0.0.0.0` also makes the studio available to a tablet on the same network at
the host computer's LAN address. Set `CLOUDWAY_ASSET_ROOT` to override the
external full-size reference-art directory allowed by the preview config. The
review config disables HMR and filesystem watching so an open test session does
not reload while source files change.

## What it supports

- stable, 2-second / 4-second crackle, frost, glide, and extend/retract scroll
  platforms;
- spawn, checkpoint, exit, and voice-target placement;
- select, pointer drag, footprint resize, quarter-turn rotate, duplicate, and
  delete;
- zoom, pan, snapped coordinates, undo, redo, local draft save, and validated
  JSON import/export;
- bounded melody notes and optional voice-target prerequisites;
- top-view warnings for counts, footprint overlaps, unsupported or overhanging
  anchors, anchors resting only on transient platforms, bounds, and separated
  platform groups.

The v1 schema deliberately has no barrier piece. A barrier needs explicit
runtime completion and opening semantics; omitting it is more accurate than
drawing a shape that appears to work. A future adapter can add a versioned
barrier kind.

See [SCHEMA.md](./SCHEMA.md) for the coordinate contract and
[example-cloudway-level.json](./example-cloudway-level.json) for a compact
adapter fixture.

## Asset references

`assetId` is optional and accepts only the curated IDs embedded in the studio.
Those IDs currently mirror the platform concepts in
`../../cloudway-laboratory/v1/catalogue.json`. A catalogue entry marked
`reference-reviewed` is a visual reference, not a promise that a runtime 3D
model exists.

## Safety and limits

Imports are capped at 300,000 characters, 256 pieces, and 32 melody notes.
Every number must be finite and inside the documented range; IDs are lowercase
slugs and references must resolve. The importer rebuilds the accepted schema,
so unknown fields, URLs, and executable content are not carried into exports.
All imported labels render as text.

## Focused browser proof

The dedicated Playwright config starts the same strict Vite server on port
5633:

```bash
cd /home/maff/foss/worktrees/mercurypitch/glass-cloudway-laboratory
rtk node_modules/.bin/playwright test \
  --config art/glass-adventure/level-studio/v1/playwright.config.mjs
```
