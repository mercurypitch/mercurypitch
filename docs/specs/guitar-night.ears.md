# Guitar Night — EARS Requirements

Approved target requirements for the standalone Guitar Night experience at
`/guitar-night`. These requirements define the target contract while the
current `/#/guitar` host is refactored into the first consumer of the shared
Guitar runtime.

**Status:** approved target contract; not yet implemented. Delivery begins
with legacy lifecycle stabilization and runtime extraction.

**Product direction:** Velvet Rehearsal room, small musical wins, and
incremental reuse of proven Guitar, 3D, separation, microphone, MIDI, and
Karaoke Night infrastructure.

EARS keywords: **WHEN** (event), **WHILE** (state), **IF/THEN** (unwanted
behaviour), **WHERE** (optional feature), otherwise ubiquitous ("shall").

## Product vocabulary — `GN-COPY-*`

- **REQ-GN-COPY-001 — Concrete capability names:** Product-facing Guitar
  Night copy shall describe concrete capabilities such as Listening, Coach,
  Jam Doctor, analysis, transcription, separation, drums, bass, and
  play-along.
- **REQ-GN-COPY-002 — Capability-led positioning:** Product-facing Guitar
  Night copy shall use concrete capability names and avoid generic
  technology-led positioning in labels, onboarding, coaching, marketing
  claims, errors, and empty states.
- **REQ-GN-COPY-003 — Evidenced coaching:** Every performance observation
  shown by the Coach or Jam Doctor shall derive from structured,
  confidence-bearing performance evidence and shall identify the relevant
  phrase or beat range.

## Default entry and room promise — `GN-ENTRY-*`

- **REQ-GN-ENTRY-001 — Velvet Rehearsal entry:** WHEN a player enters Guitar
  Night without a saved room choice, the ready stage shall open in the dark
  indoor Velvet Rehearsal room.
- **REQ-GN-ENTRY-002 — Quick Jam:** The default room shall stage a Quick Jam
  with drums, generated bass, and one primary Play control; detailed pattern,
  tone, and arrangement controls shall remain secondary until requested.
- **REQ-GN-ENTRY-003 — Three clear paths:** Before the first musical action,
  the room shall offer `Start`, `Load a song`, and `I know my way around` as
  distinct beginner, Songs, and expert paths without opening a configuration
  dashboard.

## Route and host boundaries — `GN-ROUTE-*`

- **REQ-GN-ROUTE-001 — Standalone entry:** Guitar Night shall use the
  canonical `/guitar-night` URL and a standalone Solid/Vite entry rather than
  a new main-app hash tab.
- **REQ-GN-ROUTE-002 — Legacy continuity:** WHILE Guitar Night is developed,
  the existing `/#/guitar` route shall remain available and shall not be
  replaced without a separate owner-approved cutover.
- **REQ-GN-ROUTE-003 — Shared implementation, separate lifetime:** The legacy
  Guitar document and Guitar Night shall use the same app-store-free runtime
  contracts and persistence schemas, while each document owns an independent
  runtime instance and audio lifetime.
- **REQ-GN-ROUTE-004 — URL reference and backing:** WHERE `?song=<id>` is
  present, it shall select a local saved score/reference and override only a
  persisted reference; WHERE `?session=<id>` is present, it shall select local
  separated accompaniment and override only persisted accompaniment. WHERE
  both are present, the two explicit selections shall coexist. An explicit
  value on one axis shall not suppress a valid persisted value on the other.
- **REQ-GN-ROUTE-005 — Local-only recovery:** IF a song or separation
  identifier is unavailable on the current device, THEN Guitar Night shall
  explain that limitation and offer Quick Jam, local selection, or upload
  without silently substituting another song.
- **REQ-GN-ROUTE-006 — History navigation:** WHEN browser back or forward
  changes explicit Guitar Night URL state, the staged reference/backing shall
  follow the updated parameters and cancel stale asynchronous loads.
- **REQ-GN-ROUTE-007 — Safe continuation:** WHERE a valid local continuation
  exists and no explicit URL overrides it, Guitar Night may restore room,
  activity, reference/backing identifiers, loop, view, and non-sensitive mix
  preferences; it shall never auto-start audio, microphone, MIDI, count-in,
  analysis, or timers.

## Runtime, transport, and cleanup — `GN-RUNTIME-*`

- **REQ-GN-RUNTIME-001 — One session clock:** Play, pause, seek, count-in,
  loop, playback rate, guide, drums, generated bass, stems, playhead, and
  scoring shall derive from one sample-based Guitar session clock.
- **REQ-GN-RUNTIME-002 — One output graph:** Each Guitar Night runtime shall
  inject one owned `AudioContext` and explicit guide, drums, bass, stems, and
  monitor buses into its audio consumers; consumers shall not create
  independent contexts.
- **REQ-GN-RUNTIME-003 — User-gesture activation:** WHEN a user starts audible
  playback, the runtime shall initialize or resume Web Audio from that user
  gesture and shall handle activation failure without a false Playing state.
- **REQ-GN-RUNTIME-004 — Source replacement:** WHEN the reference or backing
  changes, the runtime shall cancel the prior source load, stop its
  source-specific voices, revoke its object URLs, and prevent a late load from
  replacing the newer selection.
- **REQ-GN-RUNTIME-005 — Deactivation:** WHEN the host deactivates, the runtime
  shall synchronously prevent new schedules; stop sounding voices and
  analysis work; release Guitar consumers, nodes, callbacks, MIDI handlers,
  timers, render loops, and owned object URLs; invalidate late asynchronous
  results; clear visible active indicators; and then expose an awaitable
  settled-cleanup result.
- **REQ-GN-RUNTIME-006 — Microphone linger:** IF the shared `MicManager`
  retains a physical stream under its documented handoff linger, THEN Guitar
  Night shall hold no consumer or analysis node and shall show no
  Guitar-active microphone state.
- **REQ-GN-RUNTIME-007 — Disposal ownership:** WHEN the standalone route is
  disposed, it shall close only its route-owned context and workers; the
  legacy host shall not close the main app's shared engine.
- **REQ-GN-RUNTIME-008 — Responsive persistence:** WHEN the viewport,
  orientation, room, sheet, or Flow/Tab/Neck view changes, the active runtime
  and transport shall survive without restarting audio or capture.

## Configurable first win — `GN-FIRST-*`

- **REQ-GN-FIRST-001 — Versioned configuration:** The beginner intro shall be
  driven by a versioned `GuitarFirstWinConfig` rather than hard-coded
  component timings or notes.
- **REQ-GN-FIRST-002 — Configurable parameters:** `GuitarFirstWinConfig` shall
  define whether the intro is offered, tempo, count-in, timing tolerance,
  requested hit count, pass threshold, target string label, expected pitch,
  tuning assumption, percussion preset, tab-note sequence, phrase chunks,
  guide behaviour, enabled input fallbacks, completion actions, and schema
  version.
- **REQ-GN-FIRST-002A — Version-one shape and defaults:** The bundled
  version-one configuration shall have the following normative shape and
  defaults. The target MIDI may be explicit or derived from
  `tuningMidiHighToLow[stringIndex]`.

  ```ts
  type GuitarFirstWinConfigV1 = {
    schemaVersion: 1
    flowVersion: 'first-win-v1'
    configVersion: string
    enabled: boolean // true
    tempoBpm: number // 78
    countInBeats: number // 4
    freshHitsRequested: number // 4
    passHits: number // 3
    timingToleranceMs: number // 180
    tuningMidiHighToLow: [number, number, number, number, number, number]
    percussionPreset: string // 'first-win-rock'
    exerciseSteps: Array<{
      id: string
      kind: 'open-string-groove' | 'one-string-tab'
      stringIndex: number // high-to-low: 0 = high e, 5 = low E
      stringLabel: string
      frets: number[]
      phraseChunks: Array<{ id: string; frets: number[] }>
      expectedMidi: number[] | 'from-tuning-and-frets'
      guide: 'count-in-only' | 'percussion-only'
    }>
    inputFallbacks: Array<'microphone' | 'midi' | 'keyboard' | 'touch'>
    completionActions: Array<'keep-jamming' | 'another-riff' | 'load-song'>
    skipDestination: 'quick-jam'
    returnEntry: 'learn:first-win'
  }
  ```

  The default tuning shall be `[64, 59, 55, 50, 45, 40]`; a selected
  alternate tuning shall provide another six-value high-to-low MIDI array.
  The open-string step shall target string index `5` (`low E`) with frets
  `[0, 0, 0, 0]`. The tab step shall target string index `0` (`high e`) and
  shall first offer `[4, 4, 5, 7, 7, 5, 4, 2]`, then the full phrase
  `4 4 5 7 | 7 5 4 2 | 0 0 2 4 | 4 2 2`. Both defaults shall derive expected
  MIDI from the selected tuning plus each fret; an explicit MIDI array shall
  be permitted for a custom step.

- **REQ-GN-FIRST-003 — Safe validation:** IF persisted or remotely supplied
  intro configuration is missing, invalid, unsupported, or unsafe, THEN the
  system shall fall back field-by-field to the bundled, version-compatible
  safe default and shall never execute arbitrary code or load an unapproved
  asset URL from configuration. Tempo shall validate within `40..160`,
  count-in within `0..8`, requested hits within `1..16`, pass hits within
  `1..freshHitsRequested`, timing tolerance within `50..500` ms, string index
  within `0..5`, tuning as six MIDI values within `0..127`, and frets within
  `0..24`. Each explicit expected-MIDI array shall match its step's fret count
  and contain only values within `0..127`.
- **REQ-GN-FIRST-004 — Contextual user adjustment:** WHERE the player opens
  intro options, the system shall allow relevant adjustments such as tempo,
  count-in, handedness/tuning, input source, and exercise choice without
  presenting configuration before the first musical action.
- **REQ-GN-FIRST-005 — Expert skip and return:** The intro shall offer a
  one-action expert skip, persist that choice separately from completion, and
  remain available later from Learn.
- **REQ-GN-FIRST-006 — Permission timing:** Guitar Night shall show the
  playable room before requesting microphone, DI, or MIDI permission and shall
  request access only after the player selects a listening input action.
- **REQ-GN-FIRST-007 — Input fallback:** IF microphone/DI/MIDI is denied,
  unavailable, held elsewhere, or intentionally skipped, THEN touch and
  keyboard input shall keep the intro usable.
- **REQ-GN-FIRST-008 — Groove default:** The bundled default groove shall
  request four fresh open-low-E articulations over percussion-only drums near
  78 BPM and shall pass at three valid hits; one sustained note shall not
  consume multiple targets.
- **REQ-GN-FIRST-009 — No pitched self-score:** WHILE assessed microphone
  input is active, all pitched guide, bass, and stem playback shall be silent.
  Open-speaker full-band scoring shall remain an untrusted profile until
  reference-aware bleed rejection passes named acoustic fixtures.
- **REQ-GN-FIRST-010 — Tab default:** The bundled default tab step shall teach
  that lines represent strings and numbers represent frets, then present a
  chunked one-string phrase using MercuryPitch-owned performance/arrangement
  assets for a public-domain melody.
- **REQ-GN-FIRST-011 — Tuning truth:** The bundled exercise may assume standard
  tuning only while stating that assumption and offering a different-tuning
  escape. Microphone/DI results may claim that expected pitch and articulation
  were heard, but shall not claim a physical string or fret was verified.
- **REQ-GN-FIRST-012 — Small-win handoff:** WHEN a player completes a
  configured step, Guitar Night shall acknowledge the concrete accomplishment
  and offer a small next action such as Keep jamming, Try another riff, or Load
  a song without changing transport ownership.
- **REQ-GN-FIRST-013 — Versioned progress:** First-win progress shall persist
  `schemaVersion`, `flowVersion`, `configVersion`, status (`not-started`,
  `in-progress`, `completed`, or `skipped`), current step ID, attempts per
  step, best absolute timing per step, last input kind, tuning, handedness,
  and self-reported tab familiarity.
- **REQ-GN-FIRST-013A — Version-one progress shape:** The version-one progress
  record shall use this normative shape; unknown optional profile values shall
  remain `null` rather than being inferred from detected audio.

  ```ts
  type GuitarFirstWinProgressV1 = {
    schemaVersion: 1
    flowVersion: 'first-win-v1'
    configVersion: string
    status: 'not-started' | 'in-progress' | 'completed' | 'skipped'
    currentStepId: string | null
    attemptsByStep: Record<string, number>
    bestAbsoluteTimingMsByStep: Record<string, number>
    lastInputKind: 'microphone' | 'midi' | 'keyboard' | 'touch' | null
    tuningMidiHighToLow: [number, number, number, number, number, number]
    handedness: 'right' | 'left' | null
    tabFamiliarity: 'new' | 'some' | 'comfortable' | null
    completedAt: string | null
    skippedAt: string | null
  }
  ```

- **REQ-GN-FIRST-014 — Resume and migration:** WHEN saved progress matches the
  active flow and configuration versions, the intro shall resume at its saved
  step without starting audio or capture. WHEN only `configVersion` changes,
  stable step IDs shall preserve compatible completion, attempts, profile,
  and skip state while an unavailable step falls back to the first incomplete
  step. WHEN the schema or flow version is incompatible, a named migration
  shall run or step progress shall restart safely while retaining player
  tuning, handedness, tab familiarity, and prior completion history.

## Initial Songs play-along — `GN-SONG-*`

- **REQ-GN-SONG-001 — One-song first contract:** The initial Songs experience
  shall optimize for loading one local song and entering play-along;
  playlist/setlist management is outside this first contract.
- **REQ-GN-SONG-002 — Existing separation reuse:** WHEN the player imports
  audio for play-along, Guitar Night shall reuse the existing durable
  separation pipeline and session records rather than implement a second
  separation system.
- **REQ-GN-SONG-003 — Guitar removal:** WHERE a separated guitar stem exists,
  Guitar Night shall default that stem to muted or attenuated for play-along
  and shall let the player restore its gain.
- **REQ-GN-SONG-004 — Honest fallback:** IF a distinct guitar stem is
  unavailable, THEN Guitar Night shall state the available mix honestly and
  offer the best existing accompaniment or retry path without presenting a
  non-functional Guitar mute control.
- **REQ-GN-SONG-005 — Local hydration:** WHEN a stored separation is reopened,
  Guitar Night shall validate or re-mint its durable local stem URLs and shall
  revoke every URL it owns on source change or disposal.
- **REQ-GN-SONG-006 — Memory budget:** BEFORE decoding stems, Guitar Night
  shall estimate decoded PCM and shall stream, reduce selected parts, or
  visibly fall back rather than exceed the supported device budget.
- **REQ-GN-SONG-007 — Shared transport:** WHILE a separated song is staged,
  its accompaniment, optional score, loop, drums, bass, visual playhead, and
  scoring shall follow the Guitar session transport.

## Stage and mobile experience — `GN-STAGE-*`

- **REQ-GN-STAGE-001 — Default room:** Guitar Night shall open in the dark
  indoor Velvet Rehearsal room unless the player has a valid saved room
  preference.
- **REQ-GN-STAGE-002 — Ready stage:** The first viewport shall present a ready
  musical stage and primary Play/Start action rather than a configuration
  dashboard.
- **REQ-GN-STAGE-003 — Reused 3D renderer:** Guitar Night shall reuse the
  existing 3D tab renderer through a surface adapter; transport, scoring,
  input, and session identity shall remain above the renderer.
- **REQ-GN-STAGE-004 — Stage-owned chrome:** Guitar Night shall render its own
  Listening, Coach, transport, room, and mix chrome without requiring the
  legacy 3D HUD to remain visible.
- **REQ-GN-STAGE-005 — Mobile stage:** On narrow viewports, the standalone
  stage shall use `100dvh`, account for top and bottom safe-area insets, and
  keep Flow/Tab/Neck as the visual priority. Primary controls shall be at least
  44 by 44 CSS pixels, and secondary controls shall use safe-area-aware sheets
  without horizontal discovery scrolling.
- **REQ-GN-STAGE-006 — Accessible feedback:** Target, detected input,
  confidence, and judgment shall be distinguishable without colour alone, and
  canvas/3D output shall expose an accessible name and meaningful fallback
  summary.
- **REQ-GN-STAGE-007 — Motion and power:** WHERE reduced motion or a low-power
  fallback is active, room ambience and 3D motion shall reduce without hiding
  the current beat, next note, or performance result.

## Incremental delivery — `GN-DELIVERY-*`

- **REQ-GN-DELIVERY-001 — Small green increments:** Each implementation
  increment shall keep the current Guitar host functional, add focused
  regression coverage, and leave typecheck, lint, formatting, and required
  tests green.
- **REQ-GN-DELIVERY-002 — Refactor before route duplication:** Guitar Night
  shall not import the current store-coupled `GuitarProvider` wholesale; the
  current Guitar host shall first prove the shared app-store-free runtime
  boundary.
- **REQ-GN-DELIVERY-003 — Progressive completeness:** Subsequent increments
  may add richer library, band, learning, and Jam Doctor behaviour until
  Guitar Night reaches standalone-app completeness comparable to Karaoke
  Night, while preserving the one-song and small-win path.
