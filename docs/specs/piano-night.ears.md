# Piano Night foundations — EARS Requirements

Approved requirements for the first production slice of the standalone Piano
Night experience at `/piano-night`. Phase 1A selects the Performance Horizon
composition, adds a discoverable launcher to the existing Piano tab, and
establishes reusable presentation boundaries without replacing the current
Piano runtime.

**Status:** Phase 1A and Slice 2 implemented.

**Visual authority:** the Performance Horizon variant is binding for
composition. The established Piano Night materials and product-truth rules
remain binding where they do not conflict with that composition.

EARS keywords: **WHEN** (event), **WHILE** (state), **IF/THEN** (unwanted
behaviour), **WHERE** (optional feature), otherwise ubiquitous ("shall").

## Route and pilot boundary — `PN-ROUTE-*`

- **REQ-PN-ROUTE-001 — Standalone entry:** Piano Night shall use the canonical
  `/piano-night` URL and a standalone Solid/Vite document rather than a new
  main-app hash tab.
- **REQ-PN-ROUTE-002 — Direct document:** The built application shall serve
  the Piano Night document for both `/piano-night` and
  `/piano-night.html`; the clean path shall remain canonical.
- **REQ-PN-ROUTE-003 — Pilot indexing:** WHILE Piano Night remains a pilot,
  its standalone document shall declare `noindex, nofollow` and shall not be
  added to public launch or sitemap indexing.
- **REQ-PN-ROUTE-004 — Independent first paint:** The standalone first-paint
  graph shall not statically import the main App shell, App-owned state,
  notation, soundbank-installation, arranger, or protected-background
  implementation.
- **REQ-PN-ROUTE-005 — Standalone service-worker identity:** The service
  worker shall treat `/piano-night` and `/piano-night.html` as standalone
  documents and shall never substitute the main App shell for either path.
- **REQ-PN-ROUTE-006 — No implicit cutover:** Entering `/#/piano` shall
  continue to render the existing Piano tab; Phase 1A shall not redirect it,
  change `TAB_PIANO`, or replace its runtime.

## Existing Piano tab and launcher — `PN-LEGACY-*`

- **REQ-PN-LEGACY-001 — Desktop launcher:** The desktop Piano tab shall expose
  an anchor labelled `Piano Night` in the existing song-status action group,
  and activating it shall navigate to `/piano-night`.
- **REQ-PN-LEGACY-002 — Mobile launcher:** The mobile Piano tab shall expose
  an anchor labelled `Piano Night` through its existing single options sheet,
  and activating it shall navigate to `/piano-night`.
- **REQ-PN-LEGACY-003 — Tour discoverability:** The desktop launcher shall
  expose `data-tour="piano-night-launch"`, and the Piano page tour shall
  explain that it opens the dedicated Piano Night room.
- **REQ-PN-LEGACY-004 — Existing selectors:** Phase 1A shall preserve every
  existing Piano tour selector, including `piano.song-picker`, `piano.canvas`,
  `#btn-mic`, `[data-testid="piano-control-bar"]`, `#btn-once`,
  `[data-testid="tempo-group"]`, `piano-songs`, `piano-canvas`,
  `piano-transport`, and `piano-options`.
- **REQ-PN-LEGACY-005 — Behaviour continuity:** Adding the launcher and
  reusable boundaries shall not change current Piano song loading, MIDI
  import, Fall/Score switching, playback, loop, input, scoring, or responsive
  behaviour.
- **REQ-PN-LEGACY-006 — Honest handoff:** WHILE Phase 1A has no project-handoff
  contract, the launcher shall not claim to transfer the current song, loop,
  score, input, or transport state into Piano Night.
- **REQ-PN-LEGACY-007 — Browser recovery:** Navigation to Piano Night shall
  preserve normal browser history so the player can use Back to return to the
  existing Piano tab.

## Reusable presentation boundary — `PN-REUSE-*`

- **REQ-PN-REUSE-001 — Host-neutral contract:** Shared Piano performance
  presentation shall depend on a route-neutral stage and transport contract,
  not directly on `App.tsx` or App-only stores.
- **REQ-PN-REUSE-002 — Legacy adapter:** WHERE current Piano behaviour is
  exposed through the shared contract, a legacy adapter shall translate the
  existing controller without changing its timing, scoring, loop, or input
  semantics.
- **REQ-PN-REUSE-003 — Pure note mapping:** Melody, MIDI-song, falling-note,
  and score-view conversions extracted from the Piano page shall be pure,
  deterministic, and covered by focused fixtures.
- **REQ-PN-REUSE-004 — Host-neutral canvas inputs:** A shared falling-note
  renderer shall receive note-label state and visible-window updates through
  explicit inputs rather than reading or writing App-global Piano stores.
- **REQ-PN-REUSE-005 — One canvas owner:** WHEN desktop and mobile
  presentations switch, each branch shall own its own canvas instance; a
  canvas shall not be re-parented across responsive branches.
- **REQ-PN-REUSE-006 — No premature runtime replacement:** Phase 1A shall not
  introduce a second audio clock, second input owner, or second playback
  engine behind the existing Piano tab.

## Performance Horizon composition — `PN-STAGE-*`

- **REQ-PN-STAGE-001 — Selected composition:** The standalone room shall use
  the Performance Horizon topology: narrow room navigation, floating session
  capsule, photographic performance field, phrase coach, fixed key horizon,
  and one fallboard transport.
- **REQ-PN-STAGE-002 — Instrument first:** The grand piano, falling
  performance, and physical keyboard shall remain the visual focus; session
  controls and deeper settings shall stay at the edges until requested.
- **REQ-PN-STAGE-003 — Persistent key horizon:** The desktop stage shall keep
  an 88-key horizon visible below Fall, Score, and Keys views and above the
  fallboard transport.
- **REQ-PN-STAGE-004 — One musical lens:** Fall, Score, and Keys shall be
  alternate views of one staged session; changing the selected lens shall not
  imply a different song, transport, loop, or input owner.
- **REQ-PN-STAGE-005 — Bounded coach:** The first viewport shall show at most
  one compact phrase-coach surface; detailed controls shall open in one
  drawer or sheet rather than stacking floating panels over the keys.
- **REQ-PN-STAGE-006 — One Play owner:** Each responsive composition shall
  expose one primary Play/Pause owner. A mobile drawer or coach sheet shall
  not duplicate it.
- **REQ-PN-STAGE-007 — Prototype implementation:** The production shell shall
  recreate the approved composition with semantic HTML, CSS, SVG, and
  responsive image assets; it shall not use a screenshot of the composition
  as a baked interface.

## Safe first paint and product truth — `PN-TRUTH-*`

- **REQ-PN-TRUTH-001 — Silent entry:** WHEN the standalone document mounts,
  it shall not create or resume an `AudioContext`, start playback, run a
  count-in or timer, or request MIDI or microphone permission.
- **REQ-PN-TRUTH-002 — Explicit preview state:** WHERE Phase 1A controls only
  visual prototype state, the interface shall identify that state as a
  preview and shall not imply that sound, input, persistence, or analysis ran.
- **REQ-PN-TRUTH-003 — Illustrative evidence:** Synthetic notes, notation,
  performance traces, scores, phrase advice, dynamics, and pedal evidence
  shall be labelled illustrative or synthetic at the surface where they
  appear.
- **REQ-PN-TRUTH-004 — Missing evidence:** IF a real score, reference phrase,
  input stream, or measured result is unavailable, THEN Piano Night shall show
  an honest empty or unavailable state rather than fabricate a value.
- **REQ-PN-TRUTH-005 — Unimplemented actions:** An action that Phase 1A does
  not implement shall be absent, disabled with an explanation, or explicitly
  labelled as a preview; it shall not report false success.
- **REQ-PN-TRUTH-006 — Input limits:** Phase 1A shall not claim polyphonic
  microphone transcription, acoustic-piano scoring, MIDI connection, pedal
  detection, or touch-to-sound unless the corresponding runtime is present
  and measured.
- **REQ-PN-TRUTH-007 — Local-bank limits:** Phase 1A shall not claim that a
  custom soundbank was imported, uploaded, installed, persisted, or rendered.
- **REQ-PN-TRUTH-008 — Visual and sonic separation:** Changing or previewing a
  visual room shall not change an instrument, effect, mix, or room response.

## Room artwork and entitlement truth — `PN-ROOM-*`

- **REQ-PN-ROOM-001 — Nocturne pilot default:** WHEN no Phase 1A room choice
  exists, the standalone shell shall use Nocturne Studio as its free pilot
  backdrop.
- **REQ-PN-ROOM-002 — Responsive sources:** Nocturne Studio shall provide
  landscape and portrait WebP sources, and the responsive stage shall choose
  a suitable source without stretching or exposing an unreadable crop.
- **REQ-PN-ROOM-003 — Independent contrast:** Text and musical information
  shall remain legible through authored contrast surfaces independent of the
  room image's local brightness.
- **REQ-PN-ROOM-004 — Free asset identity:** Phase 1A room art shall use a
  Piano-specific public asset path and shall not reuse a Jam background ID,
  Jam preference, Jam guest capability, or protected source URL.
- **REQ-PN-ROOM-005 — No premium preview:** WHILE Piano is not a typed third
  supporter-background surface, the standalone shell shall show no locked
  premium room, entitlement badge, or premium-access claim.
- **REQ-PN-ROOM-006 — Art failure fallback:** IF a room image is unavailable
  or fails to decode, THEN the stage shall retain a usable opaque fallback,
  readable controls, and musical state.

## Interaction and accessibility — `PN-A11Y-*`

- **REQ-PN-A11Y-001 — Skip link:** The standalone document shall provide a
  keyboard-operable skip link to the primary Piano stage.
- **REQ-PN-A11Y-002 — Control names:** Every interactive control shall expose
  an accessible name aligned with its visible label and outcome.
- **REQ-PN-A11Y-003 — Target size:** Primary controls shall provide a target
  of at least 44 by 44 CSS pixels at supported viewport sizes.
- **REQ-PN-A11Y-004 — Visible focus:** Keyboard focus shall remain visibly
  distinguishable over the photographic room and every smoked control
  surface.
- **REQ-PN-A11Y-005 — Drawer focus:** WHEN a modal control drawer or mobile
  coach sheet opens, it shall contain focus, make the obscured background
  inert, close on Escape, and restore focus to its opener.
- **REQ-PN-A11Y-006 — Escape order:** WHEN more than one dismissible surface
  exists, Escape shall close only the topmost surface before affecting any
  transport state.
- **REQ-PN-A11Y-007 — Reduced motion:** WHERE reduced motion is requested,
  falling travel, strike particles, and hammer travel shall stop; static note
  position, active-key, and timing information shall remain available.
- **REQ-PN-A11Y-008 — Non-colour meaning:** Hand, pitch, timing, pedal,
  selected, disabled, and locked states shall not rely on colour alone.
- **REQ-PN-A11Y-009 — Canvas alternative:** A canvas-based performance view
  shall expose a meaningful text summary or equivalent semantic state rather
  than only generic fallback copy.

## Responsive composition — `PN-RESPONSIVE-*`

- **REQ-PN-RESPONSIVE-001 — Desktop geometry:** At supported desktop and
  short-laptop widths, the rail, session capsule, coach, key horizon, and
  fallboard transport shall not overlap or extend beyond the visual viewport.
- **REQ-PN-RESPONSIVE-002 — Mobile recomposition:** On phone portrait, desktop
  rail and coach surfaces shall recompose as bottom navigation and sheets
  rather than shrink into unreadable desktop panels.
- **REQ-PN-RESPONSIVE-003 — Reachable keys:** The phone composition shall keep
  a usable touch-key range and the primary transport reachable above the safe
  area while a compact sheet is open.
- **REQ-PN-RESPONSIVE-004 — No page overflow:** At 320, 390, 768, 1024, and
  1440 CSS pixels, the standalone document shall have no horizontal page
  overflow and no clipped primary control.
- **REQ-PN-RESPONSIVE-005 — Runtime continuity:** WHEN the viewport or
  orientation changes, responsive presentation shall not create a second
  transport, input owner, or permission request.

## Phase 1A exclusions

Phase 1A does not include project or transport handoff from `/#/piano`, a new
audio-clock runtime, real MIDI or microphone integration, sampled-piano audio,
Dexie/OPFS project or soundbank storage, Mercury Bank/SFZ/SF2 import, a typed
premium Piano background surface, real phrase analysis, arranger/drummer/bass
workspaces, public indexing, or production deployment. Those capabilities
require separately tested slices and shall not be implied by the Phase 1A
interface.

## Phase 1A verification map

| Requirement area           | Minimum evidence                                                                                     |
| -------------------------- | ---------------------------------------------------------------------------------------------------- |
| `PN-ROUTE`                 | Direct dev/preview/build route assertions and standalone-bundle import audit                         |
| `PN-LEGACY`                | Focused Piano tab launcher test and affected tour-selector resolution                                |
| `PN-REUSE`                 | Pure adapter fixtures and unchanged focused legacy Piano tests                                       |
| `PN-STAGE`, `PN-TRUTH`     | Standalone component tests for composition, empty/preview states, and silent mount                   |
| `PN-ROOM`                  | Asset-response, responsive-source, missing-image, and no-premium assertions                          |
| `PN-A11Y`, `PN-RESPONSIVE` | Desktop/mobile browser smoke, keyboard/focus checks, reduced-motion check, and overflow measurements |

## Slice 2 — route-neutral transport and input

Slice 2 builds reusable runtime seams and adopts them behind the existing
`/#/piano` experience. It does not cut the standalone Piano Night shell over
to real playback; that remains a later slice. The Phase 1A exclusions above
describe the first visual slice and remain historically accurate.

### Audio-clock transport — `PN-TRANSPORT-*`

- **REQ-PN-TRANSPORT-001 — Silent construction:** Creating a route-neutral
  Piano transport shall not create or resume an `AudioContext`; only an
  explicit Play request may activate audio.
- **REQ-PN-TRANSPORT-002 — One clock:** WHILE playback is active, the
  transport shall derive its beat position from one injected audio clock and
  shall not advance a competing RAF, interval, or wall-clock timeline.
- **REQ-PN-TRANSPORT-003 — Stable pause:** WHEN Pause is requested, the
  transport shall snapshot its audio-clock-derived beat and subsequent reads
  shall remain stable until Play, Seek, or Stop.
- **REQ-PN-TRANSPORT-004 — Continuity:** WHEN tempo or speed changes during
  playback, the transport shall rebase its audio-clock origin so the current
  beat does not jump.
- **REQ-PN-TRANSPORT-005 — Bounded seek:** WHEN a seek is requested, the
  target shall be clamped to the score duration and shall become the origin
  for subsequent playback.
- **REQ-PN-TRANSPORT-006 — Completion:** WHEN the audio clock reaches the
  score duration, the transport shall clamp at the final beat and enter the
  complete phase.
- **REQ-PN-TRANSPORT-007 — Lifetime safety:** WHEN a transport is disposed,
  pending activation shall not revive it and subsequent commands shall not
  create audio resources.

### Normalized performance input — `PN-INPUT-*`

- **REQ-PN-INPUT-001 — Polyphonic identity:** Piano input shall normalize
  simultaneous note-on and note-off activity without collapsing distinct
  source, device, channel, pointer, pitch, or velocity identity.
- **REQ-PN-INPUT-002 — Sustain:** WHILE sustain (CC64) is down, releasing a
  key shall remove it from physically held notes but retain it among sounding
  notes until sustain is released or its source is cleared.
- **REQ-PN-INPUT-003 — Sostenuto:** WHEN sostenuto (CC66) is pressed, only
  notes physically held at that transition shall be latched; later notes
  shall not join that latch.
- **REQ-PN-INPUT-004 — Soft pedal:** WHILE soft pedal (CC67) is down, the
  normalized pedal state shall expose that fact without rewriting the
  player's source velocity.
- **REQ-PN-INPUT-005 — Safety messages:** WHEN an input source disconnects,
  changes selection, receives all-sound-off, or is disposed, every note and
  pedal it owns shall be released deterministically. Channel all-notes-off
  shall release physical keys while respecting active pedals; reset-controllers
  shall clear pedal latches and then release eligible notes.
- **REQ-PN-INPUT-006 — Touch pointers:** Each on-screen key pointer shall own
  an independent note lifecycle; pointer movement may change its pitch, and
  pointer-up, pointer-cancel, lost capture, or pinch takeover shall release
  only the notes owned by the affected pointer or gesture.
- **REQ-PN-INPUT-007 — Explicit MIDI permission:** The Web MIDI port shall
  request access only after an explicit Connect action and shall remain
  silent and permission-free at construction.
- **REQ-PN-INPUT-008 — MIDI device selection:** WHERE multiple MIDI inputs
  are available, exactly one selected input shall publish performance
  messages; selection and hot-plug changes shall detach stale listeners and
  release their state.
- **REQ-PN-INPUT-009 — Channel messages:** The MIDI port shall normalize
  note-on, velocity-zero note-off, note-off, CC64, CC66, CC67, and channel
  all-notes-off, all-sound-off, and reset-controllers messages while ignoring
  unsupported traffic.

### Legacy adoption — `PN-COMPAT-*`

- **REQ-PN-COMPAT-001 — Production adapter:** The current Piano page shall
  consume its timeline and transport actions through the legacy Piano
  performance adapter; that adapter shall delegate to the existing
  falling-notes owner rather than create a clock.
- **REQ-PN-COMPAT-002 — One input owner:** The current falling-notes
  controller shall adapt normalized MIDI and touch activity into its existing
  pitch, scoring, and key-highlight surfaces without retaining a second MIDI
  owner.
- **REQ-PN-COMPAT-003 — Chord scoring:** WHERE MIDI or touch input is active,
  every currently sounding normalized pitch shall be eligible for scoring;
  the compatibility `currentPitch` surface may still expose one primary note.
- **REQ-PN-COMPAT-004 — Visible continuity:** Adopting the runtime seams shall
  preserve existing song loading, loop, seek-then-play, count-in, repeat,
  scoring, microphone, playback, responsive composition, and tour selectors.
- **REQ-PN-COMPAT-005 — Audio activation:** Existing Piano Play shall use the
  shared user-gesture audio activation path before starting playback.

### Slice 2 verification map

| Requirement area | Minimum evidence                                                                                                              |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `PN-TRANSPORT`   | Deterministic injected-clock tests for silent construction, play/pause/seek, tempo/speed continuity, completion, and disposal |
| `PN-INPUT`       | Normalized input and Web MIDI port fixtures, including dense-chord/pedal soak, device selection, hot-plug, panic, and cleanup |
| `PN-COMPAT`      | Legacy-adapter production wiring, focused existing playback regressions, and a real-pointer Piano key and scrub browser smoke |
