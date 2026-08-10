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
- The first win is a room, not a lesson card: its short tab explanation floats
  over the shared stage, accepted free taps move the visible fret target, and
  progress plus the two musical actions stay in one bounded bottom deck.
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

The reference, score-room, shared-loop, transcription, and input-event work in
this section is implemented on open PR
[#458](https://github.com/mercurypitch/mercurypitch/pull/458) and remains in
review until that PR is merged.

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
- Prepared songs opens on the five most recent sessions and reveals the rest
  ten at a time, so a long library never turns the entry panel into a wall of
  rows. The routed song stays listed even when it falls below that first page.
  While the local library is opening, a slow open explains itself instead of
  leaving the panel looking stuck.
- Score and backing are independent axes. `?song=` selects the score reference
  and `?session=` selects the separated backing; either may be used alone, and
  writing one never disturbs the other. A score identifier that is not on this
  device fails visibly rather than quietly attaching a different one.
- A reference comes from the shared imported-song library, so a tab opened in
  the legacy Guitar tab is attachable here and the chosen part is remembered in
  both. Multi-track files expose their playable parts; a part with no notes is
  never offered.
- The stage shows only traceable reference notes: authored score events or
  confidence-bearing measured events bound to the active recording. Authored
  tempo maps, tracks and Guitar Pro fingering are attached because the saved
  representation really carries them; meter, sections, source tuning and capo
  are not claimed. MIDI notes without authored fingering are placed by the
  shared helper.
- Authored score beat time is derived from the tab room's canonical audio
  clock, never from render frames. Beat-to-seconds and seconds-to-beat mapping
  both use the complete persisted tempo map; changing the opening tempo scales
  the whole map instead of flattening it. The take snapshots its tempo, map,
  count-in, guide sound, melody and loop until Stop, so an already scheduled
  click cannot drift away from the visible score. Without a usable reference,
  the stage reports free play.
- A reference is either authored or measured. Authored notes come from a file
  and carry a real musical tempo. Measured notes are heard in one separated
  stem: they are evidence about this recording, already on its timeline, so they
  need no alignment step and are never presented as a tab or given a BPM
  readout. A measured reference states which stem it came from and how much of
  that stem produced confident notes.
- A measured reference also retains the exact backing-session identity that
  produced it. Staging a different recording detaches that evidence rather than
  carrying a truthful result onto the wrong song.
- Only the bass stem is offered for measurement. It is effectively monophonic,
  which is the case pitch detection handles. The guitar stem holds however many
  guitars the mix contained and is often chordal, so it is not claimed.
- Measured notes below the guitar's low E are raised by whole octaves into the
  six-string range, preserving pitch class, and the surface says that it did so
  rather than dropping them silently. Measurement runs only on an explicit
  gesture and can be stopped.
- A staged song exposes one explicit `Enter room` handoff. Entering remains
  silent and cuts over from the setup faceplate to a bounded `100dvh`
  workspace. The song identity becomes a compact signal bar, the photographic
  room and 3D highway own the flexible centre. The time rail, speed stepper,
  volume and one amber Play control form the edge-to-edge pedalboard; honest
  mix details, loops and channels live in the stage-owned Band sheet. The live
  room is not nested inside the entry card.
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
  mouse/touch camera while the rehearsal room remains visible. Guitar Night
  supplies its own responsive entry/Reset framing, larger next target and
  truthful `NOW` rail without changing the legacy renderer defaults; `Tab` and
  `Neck` provide quieter alternate views. A song without an attached score
  exposes a nullable beat, says no tab is attached, and remains a useful
  free-play fretboard instead of deriving a fake beat from elapsed seconds.
- The score-only room keeps Play and tempo visible while count-in, guide sound,
  Listening and loop setup live in one restrained Session overlay. Before Play,
  the stage rests just ahead of the first authored note so a long intro reads as
  intentional rather than broken. The score rail supports exact pointer, touch,
  and keyboard seeking through the authored tempo map. An idle seek remains
  silent and leaves setup editable; pausing an actual take pins its sound and
  resumes on the same audio context without another count-in. Instrument and
  loop controls keep 44px targets, and a completed take offers Replay or
  Rehearse loop without opening an analysis dashboard. On a phone, room, Studio
  and account utilities collapse behind one Room control so the instrument
  keeps the viewport.
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
- Timestamped attacks are captured in an AudioWorklet and anchored to the
  shared audio clock; every non-empty input channel is inspected and the
  strongest intact channel is analyzed rather than assuming the guitar is on
  channel one or averaging channels that may cancel. The coarse fallback
  identifies itself and preserves same-pitch restrikes without turning detector
  settling into a second note. Latency calibration is exclusive with playback
  and assessed Listening, is cancellable, and removes its scheduled clicks and
  temporary evidence when stopped or disposed.

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

1. Finish the fast-input evidence gate with named guitar fixtures, real-device
   browser checks, latency distributions, and explicit microphone, direct
   interface and MIDI adapters before publishing speed or quality claims.
2. Add an opt-in Guitar Night six-string highway presentation, with frets
   encoded in targets, readable techniques, reduced-effects behavior and
   measured mobile performance; keep the legacy fret-axis composition intact.
3. Extend the configurable first win into a beginner progression, then add the
   professional band presets, drummer controls and take history.
4. Complete authored-score-to-recording alignment plus release and
   continuous-pitch evidence before adding sustain or intonation observations.
5. Move the proved runtime lifecycle beneath the remaining legacy Guitar
   controls before an owner-approved cutover, then finish real-device art and
   performance tuning.
