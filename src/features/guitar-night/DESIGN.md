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
  and keyboard available before any listening permission. Its explicit
  count-in starts a local percussion pulse; progress and expert skip are
  versioned and stored locally.
- `Load a song` opens completed separation sessions already on this device or
  selects one new local audio file. A distinct durable guitar stem may be
  staged muted; a two-stem instrumental must say that guitar remains in its
  mix. Neither path starts playback.
- `I know my way around` preserves continuity by opening the current Guitar
  workspace during the incremental migration.
- Inside the room, Space always toggles the backing transport — a focused
  mute chip, slider or panel button never steals the key; typing surfaces and
  modifier chords do (shared rule: `src/lib/space-playback.ts`).
- The amber Play control is icon-only; its state names (Play, Pause, Resume)
  live in the accessible label and tooltip so the pedalboard never reflows
  between states.
- Focus is always visible, touch targets are at least 44px, and room motion is
  removed under reduced-motion preferences.

## Current integrated slice

- Selecting a supported local MP3, WAV, or FLAC file starts the existing
  durable on-device separation workflow from Guitar Night. The heavy
  preparation adapter remains outside the first-paint path and loads only
  when requested.
- The room shows named preparation phases, available percentage progress,
  storage warnings, cancellation, retry, and source-replacement actions.
  Cancellation, unmount, and newer selections invalidate late results.
- A completed or hash-matched session refreshes Prepared songs and stages that
  exact session under route-owned object-URL leases. Preparation and staging
  remain silent: neither starts playback, listening, input capture, analysis,
  or timers.
- The first raw-file pass produces the available two-stem accompaniment, so
  guitar remains inside its instrumental mix and no non-functional guitar-mute
  control is shown. From that honest fallback, `Separate guitar` can run the
  existing full-band pipeline. Failure retains the original two-stem mix;
  completion refreshes and restages the exact upgraded session.
- If stems are saved but the room cannot refresh or stage them, the player can
  recover the result from Prepared songs rather than separating the file
  again.
- A staged song exposes one explicit `Enter room` handoff. Entering remains
  silent and cuts over from the setup faceplate to a bounded `100dvh`
  workspace. The song identity becomes a compact signal bar, the photographic
  room and 3D highway own the flexible centre, and the honest mix description,
  time rail, speed stepper, one amber Play control, and channels form an
  edge-to-edge pedalboard derived from the approved showcase. The live room is
  not nested inside the entry card.
- The durable catalog reads a lightweight stem manifest first and hydrates
  only the selected session-and-kind rows. It does not materialize unrelated
  blobs merely to decide which room mix is available.
- Play creates the route-owned Web Audio graph from the initiating gesture.
  Memory-safe mixes decode and start on one shared context epoch. Oversized
  mixes use synchronized media-element streams routed through the same Web
  Audio buses instead of allocating the full decoded PCM footprint. Unknown
  compressed formats use a conservative estimate; persisted duration is
  preferred when available. Pause, resume, pointer seeking, master volume,
  drift correction, and real per-stem mute controls follow that audio clock.
- Playback speed reuses the proven legacy Guitar practice-rate bounds. A
  non-default rate deliberately uses synchronized media-element stems with
  pitch preservation, including a position-preserving live handoff from an
  already playing buffered mix. Changing speed before Play remains silent and
  does not create an audio context.
- One shared output graph exposes guide, drums, bass, stems, and monitor buses
  through a master limiter. Room consumers reuse that graph instead of opening
  competing audio clocks.
- Full-band sessions expose the distinct Guitar channel muted by default.
  Two-stem sessions expose only Vocals and Backing, never a synthetic Guitar
  control. Returning to Songs cancels a pending start or pauses active voices
  while retaining the staged lease, decoded buffers, mix, and playhead for a
  true Resume.
- Source replacement invalidates pending fetch/decode generations and stops
  voices before the song controller revokes its route-owned URLs. Route
  disposal closes only the standalone context.
- The room keeps a persistent, flexible stage above the transport. Both the
  legacy Guitar tab and Guitar Night now consume the host-neutral
  `Guitar3DStage` and performance timeline/source contract. The renderer scene
  conversion is a pure tested boundary; legacy controls remain unchanged.
  `Flow` adapts that renderer to a translucent Velvet palette and direct
  mouse/touch camera while the rehearsal room remains visible; `Tab` and
  `Neck` provide quieter alternate views. A song without an attached score
  exposes a nullable beat, says no tab is attached, and remains a useful
  free-play fretboard instead of deriving a fake beat from elapsed seconds.
- Jam Doctor is an on-demand overlay/sheet rather than normal-flow content, so
  opening it never collapses the instrument. Desktop, tablet, and phone
  regressions keep the stage and pedalboard in the first viewport, preserve
  44px controls, and wrap a six-part band without horizontal page or channel
  discovery scrolling.
- `Listening` is explicit and local. It reuses the room context, pauses pitched
  backing for a clean assessed take, and runs the existing guitar-range MPM
  detector. The on-demand Jam Doctor reports only captured attack count,
  median detector clarity, attack-spacing variation, and detected pitch range.
  It stores no audio and makes no phrase, string, fret, or quality claim that
  the evidence cannot support.

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

1. Extend the proved shared performance surface into an explicit runtime
   lifecycle/transport adapter beneath the remaining legacy Guitar controls,
   without changing their current presentation.
2. Attach local tab/score references to prepared songs so Flow, Tab, and Neck
   can follow verified song notes and beat ranges instead of free-play motion.
3. Add A/B loop ownership to the shared session clock, followed by richer room
   drums and generated bass behind the existing buses.
4. Move high-rate pitch/onset analysis behind an AudioWorklet or worker seam,
   then validate latency and rapid-articulation accuracy against named guitar
   fixtures before publishing speed or quality claims.
5. Add phrase-aware evidence and take history to Jam Doctor without retaining
   raw audio or turning the room into an analysis dashboard.
