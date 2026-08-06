# Guitar Night — Velvet Rehearsal

## Thesis

Guitar Night should feel like walking into a prepared rehearsal room. The
instrument stays central; setup, analysis, and library complexity wait until
the player asks for them. The first screen is an invitation, not a dashboard.

## Approved visual world

- **Room:** the dark indoor `Velvet Rehearsal` backdrop is the default and the
  binding reference for this route.
- **Materials:** charcoal acoustic cloth, walnut, warm ivory labels, amber
  valve light, and quiet teal signal light.
- **Typography:** a restrained old-style serif carries room-scale headings;
  system sans carries controls and evidence.
- **Surfaces:** compact amp-faceplate panels with narrow radii and precise
  hairlines. Avoid floating card grids, generic glass panels, and arcade HUDs.
- **Hierarchy:** one primary musical action, one secondary import action, and
  one quiet expert escape. These must not read as three equal feature cards.

## First-viewport contract

The approved room remains visibly present. A single entry surface offers
`Start`, `Load a song`, and `I know my way around`. No microphone, MIDI, audio,
analysis, or timer starts on entry. The room status states that it is quiet.

## Interaction contract

- `Start` first demonstrates the configurable one-string tab win with touch
  and keyboard available before any listening permission.
- `Load a song` opens completed separation sessions already on this device or
  selects one new local audio file. A distinct durable guitar stem may be
  staged muted; a two-stem instrumental must say that guitar remains in its
  mix. Neither path starts playback.
- `I know my way around` preserves continuity by opening the current Guitar
  workspace during the incremental migration.
- Focus is always visible, touch targets are at least 44px, and room motion is
  removed under reduced-motion preferences.

## Copy contract

Use concrete capability names: Listening, Coach, Jam Doctor, separation,
drums, bass, and play-along. Do not make synthetic performance observations,
latency claims, or input-quality claims. Empty states should say exactly what
has and has not started.

## Backdrop handling

The source still is `public/guitar-night/velvet-rehearsal.webp`. Desktop keeps
the centre floor and drum kit visible; mobile crops toward the kit and places
the entry surface low in the frame. Scrims must preserve readable contrast.
Incidental amplifier lettering is not a MercuryPitch mark and should remain
subordinate to the crop until the source receives a final retouch.

## Next integrations

1. Extract the hardened raw-file preparation workflow for Guitar Night reuse.
2. Route-owned Guitar runtime and shared transport contracts.
3. One output graph for guide, drums, bass, stems, and monitoring.
4. Real configurable first-win count-in and listening input handoff.
5. Persistent 3D/Tab/Neck stage with evidence-backed Coach and Jam Doctor.

Before playback polish, add a lightweight durable stem manifest or a compound
session-and-kind index. The current compatibility read materializes every blob
row for one session, then drops the original and stale duplicates; the room
must not retain that over-read on its low-latency path.
