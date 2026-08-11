# Piano Night foundations — EARS Requirements

Approved requirements for the first production slice of the standalone Piano
Night experience at `/piano-night`. Phase 1A selects the Performance Horizon
composition, adds a discoverable launcher to the existing Piano tab, and
establishes reusable presentation boundaries without replacing the current
Piano runtime.

**Status:** Phase 1A and Slices 2–6 implemented.

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
- **REQ-PN-STAGE-008 — Consolidated settings:** Each responsive composition
  shall expose one Settings entry for the shared Session, Sound, and Room
  drawer; the session HUD and transport shall not duplicate that drawer
  action.

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

## Slice 3 — standalone free Piano Night runtime

Slice 3 turns the standalone Performance Horizon pilot into a truthful free
practice session. It composes the route-neutral project, transport, and input
foundations without importing the current App-owned Piano runtime. The
Phase 1A preview requirements above remain the historical contract for the
first visual slice; the requirements below supersede preview-only copy and
Nocturne-only room behavior inside `/piano-night`.

### Prepared session — `PN-SESSION-*`

- **REQ-PN-SESSION-001 — Canonical prepared project:** WHEN Piano Night opens
  without a handoff, it shall stage one bundled, canonical Piano project whose
  title, tempo, duration, pitches, note starts, and note lengths are the source
  for every performance lens.
- **REQ-PN-SESSION-002 — Store-free first paint:** Loading the prepared
  project shall not open IndexedDB, read the legacy MIDI local-storage key,
  create a Worker, or import the App-owned song library.
- **REQ-PN-SESSION-003 — One live projection:** Fall, Score, Keys, the session
  clock, and active key highlights shall project the same transport playhead
  and project notes rather than advance independent preview timelines.
- **REQ-PN-SESSION-004 — Honest coach boundary:** WHILE phrase analysis has no
  measured performance evidence, coach guidance, dynamics, and pedal content
  shall remain explicitly labelled as a practice prompt rather than a scored
  result.
- **REQ-PN-SESSION-005 — No future surfaces:** The standalone free session
  shall not statically import VexFlow, the main App, a soundbank parser,
  premium-background access, or arranger modules.
- **REQ-PN-SESSION-006 — Truthful fall geometry:** WHILE the Fall lens is
  moving, each project note's leading edge shall reach the key horizon at its
  transport start beat and its trailing edge shall reach the same horizon at
  its transport end beat, using one viewport-independent beat scale for travel
  and duration.
- **REQ-PN-SESSION-007 — Visible seek position:** The session trace shall
  expose a visible playhead derived from the shared transport position; WHEN a
  pointer seek updates the transport, the playhead and accessible beat value
  shall update to the same bounded position.
- **REQ-PN-SESSION-008 — Bounded fall rendering:** WHILE the Fall lens moves,
  nearby notes shall retain static local geometry and one bounded temporal
  track shall carry frame-by-frame travel; the renderer shall not rewrite the
  position style of every project note on every sampled frame.

### Standalone transport and sound — `PN-PLAYBACK-*`

- **REQ-PN-PLAYBACK-001 — Silent mount:** Mounting the standalone runtime
  shall not create or resume an `AudioContext`, schedule a note, start a
  render loop, or request MIDI or microphone permission.
- **REQ-PN-PLAYBACK-002 — Explicit activation:** WHEN the player explicitly
  chooses Play, Connect MIDI, or presses an on-screen key, Piano Night may
  create and resume exactly one route-owned `AudioContext`.
  This supersedes the Play-only activation wording in `REQ-PN-TRANSPORT-001`
  for this standalone live-input shell while preserving silent construction.
- **REQ-PN-PLAYBACK-003 — Real transport owner:** WHEN Play succeeds, the one
  fallboard transport shall control the shared audio-clock transport; Pause,
  Space, tempo changes, phrase seeks, and completion shall update that same
  owner.
- **REQ-PN-PLAYBACK-004 — Audio-clock scheduling:** Scheduled project notes
  shall derive their start and stop times from the transport's audio clock.
  A presentation frame loop may sample the playhead but shall not become a
  competing time authority.
- **REQ-PN-PLAYBACK-005 — Bounded fallback:** The free shell shall identify
  its built-in sound as a lightweight fallback synth, cap simultaneous
  voices, and release scheduled and live voices on pause, seek, source
  cleanup, visibility loss, and disposal.
- **REQ-PN-PLAYBACK-006 — No sampled-piano claim:** The fallback synth shall
  not be described as a sampled, licensed, premium, or imported piano and
  shall not load soundbank or sample bytes.
- **REQ-PN-PLAYBACK-007 — Recoverable activation:** IF audio activation fails,
  THEN playback shall remain stopped, the interface shall name the failure
  and recovery, and a later explicit action may retry.

### Touch and MIDI input — `PN-LIVE-INPUT-*`

- **REQ-PN-LIVE-INPUT-001 — Shared input authority:** Touch keys and the
  selected Web MIDI device shall publish into one normalized Piano input
  state; active-key and fallback-synth lifetimes shall consume its snapshots.
- **REQ-PN-LIVE-INPUT-002 — Touch ownership:** Pointer down, movement between
  keys, pointer up, pointer cancel, lost capture, and disposal shall preserve
  independent pointer ownership and shall not leave a sounding voice behind.
- **REQ-PN-LIVE-INPUT-003 — Explicit MIDI connect:** Piano Night shall expose
  a Connect MIDI action, and only that explicit action may request Web MIDI
  permission or select the first available input.
- **REQ-PN-LIVE-INPUT-004 — MIDI truth:** The interface shall distinguish
  disconnected, requesting, connected, denied, and unsupported MIDI states
  without claiming that a keyboard is connected before the port reports it.
- **REQ-PN-LIVE-INPUT-005 — Pedal projection:** WHERE normalized MIDI pedal
  evidence exists, the session shall project sustain, sostenuto, and soft
  state; without it, the UI shall show no detected pedal claim.
- **REQ-PN-LIVE-INPUT-006 — Reachable compact controls:** AT compact widths,
  Session, Sound, Room, and Coach shall open as attached non-modal sheets
  above the fixed key horizon so transport and playable keys remain
  reachable. This supersedes the compact-modal behavior in
  `REQ-PN-A11Y-005`; desktop modal drawers retain the documented focus trap
  and restoration behavior.
- **REQ-PN-LIVE-INPUT-007 — Keyboard alternative:** The playable key horizon
  shall expose one tab stop, arrow-key movement between visible keys, and an
  explicit keyboard activation path without creating audio on focus alone.

### Free rooms — `PN-FREE-ROOM-*`

- **REQ-PN-FREE-ROOM-001 — Free identities:** Slice 3 shall ship Afterglow
  Studio and Morning Conservatory as Piano-specific public room identities,
  each with landscape and portrait WebP sources.
- **REQ-PN-FREE-ROOM-002 — Explicit visual selection:** Changing the selected
  free room shall update only the visual plate and contrast treatment; it
  shall not change the project, transport, input, synth, mix, or ambience.
- **REQ-PN-FREE-ROOM-003 — Default and persistence boundary:** Afterglow
  Studio shall be the prepared-session default. Slice 3 shall keep selection
  route-local and shall not imply account, cloud, entitlement, or protected
  preference persistence.
- **REQ-PN-FREE-ROOM-004 — Light-room legibility:** Morning Conservatory shall
  use an authored warm contrast treatment so controls and musical state remain
  readable without forcing the dark-room grade onto the image.
- **REQ-PN-FREE-ROOM-005 — No premium catalog:** The free room sheet shall not
  render locked cards, supporter badges, protected URLs, or a premium
  background picker.

### Slice 3 verification map

| Requirement area | Minimum evidence                                                                                                                                                                              |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PN-SESSION`     | Canonical-project projection, anchor/window geometry tests, silent standalone mount assertions, real-browser bounded-track mutation and seek/playhead alignment, and built entry import audit |
| `PN-PLAYBACK`    | Injected audio-clock/synth tests plus Play, Pause, tempo, failure, visibility, and disposal coverage                                                                                          |
| `PN-LIVE-INPUT`  | Existing normalized-input fixtures plus real-pointer key smoke and explicit MIDI permission assertions                                                                                        |
| `PN-FREE-ROOM`   | Asset-response and responsive-source assertions, visual-only room-switch test, and no-premium import/UI assertions                                                                            |

## Slice 4 — shared Piano background surface

Slice 4 adopts the shared protected-background architecture without adopting
main-App state. It supersedes `REQ-PN-FREE-ROOM-003` and
`REQ-PN-FREE-ROOM-005`. It also supersedes the protected-background exclusion
in `REQ-PN-ROUTE-004` and `REQ-PN-SESSION-005` only for the route-neutral
background catalog, delivery, and picker modules; every other standalone
bundle boundary remains in force.

### Piano background lifecycle — `PN-BACKGROUND-*`

- **REQ-PN-BACKGROUND-001 — Distinct surface:** Piano Night shall be a third
  typed background surface with `piano-afterglow` as its shipped public free
  default and shall not reuse a Karaoke or Jam identity.
- **REQ-PN-BACKGROUND-002 — Free-room continuity:** The shared catalog shall
  preserve Afterglow Studio and Morning Conservatory from Slice 3 and shall
  ship Nocturne Studio, Brick Practice Loft, and Quiet Music Library as
  additional public free rooms; every room shall declare landscape, portrait,
  focal-point, and authored contrast behavior.
- **REQ-PN-BACKGROUND-003 — Sonic separation:** Changing a Piano room shall
  update only room art and contrast treatment; it shall not change the synth,
  mix, ambience, project, transport, or input state.
- **REQ-PN-BACKGROUND-004 — Device preference:** WHEN a room is selected, the
  client shall persist only its known Piano identifier under
  `pitchperfect_piano_background`; WHEN restored, current server evidence
  shall revalidate its access.
- **REQ-PN-BACKGROUND-005 — Safe locked metadata:** WHILE a published Piano
  supporter edition is locked, the picker may show its safe catalog metadata
  but shall not request, decode, or expose protected image bytes.
- **REQ-PN-BACKGROUND-006 — Protected lifetime:** WHILE a Piano supporter
  edition is unlocked, protected bytes shall use authenticated private,
  no-store delivery and a short-lived object URL that is revoked on variant
  change, room switch, final release, or disposal.
- **REQ-PN-BACKGROUND-007 — Failure fallback:** IF catalog, authorization,
  network, decoding, or variant delivery fails, THEN the stage shall retain
  its shipped free room, readable controls, and all musical state.
- **REQ-PN-BACKGROUND-008 — Responsive variants:** WHEN viewport orientation
  or density changes, the controller shall prefer authored portrait art on a
  portrait viewport and 2K or 4K landscape art otherwise, with a safe
  available-variant fallback, focal point, and contrast treatment.
- **REQ-PN-BACKGROUND-009 — No Jam delegation:** Piano Night shall never
  request, store, mint, or redeem a Jam guest background capability.
- **REQ-PN-BACKGROUND-010 — One owner:** One route-retained shared controller
  shall own the resolved room and protected object URL; the stage shall not
  create a competing protected fetch owner.
- **REQ-PN-BACKGROUND-011 — Silent metadata mount:** The safe metadata catalog
  may refresh when Piano Night mounts, but mount shall remain audio-, MIDI-,
  microphone-, IndexedDB-, and Worker-silent.
- **REQ-PN-BACKGROUND-012 — Accessible room gallery:** The Room tab shall use
  Piano-specific accessible copy and an inline gallery within its existing
  drawer, preserving desktop focus containment and compact-sheet reachability.
- **REQ-PN-BACKGROUND-013 — Publication truth:** The shared catalog shall
  recognize the ten mastered Piano premium identities while D1 and Studio own
  their publication state; an identity shall not appear in the runtime catalog
  or be described as shipped until a complete revision is explicitly
  published.

### Slice 4 verification map

| Requirement area          | Minimum evidence                                                                                                                     |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `PN-BACKGROUND-001`–`004` | Catalog, selection-key, cross-surface fallback, persistence, and visual-only component tests                                         |
| `PN-BACKGROUND-005`–`010` | Runtime/controller/picker tests for locked fetch suppression, responsive variants, decode/authorization fallback, and URL revocation |
| `PN-BACKGROUND-011`–`012` | Silent-mount component test, drawer focus coverage, standalone build audit, and desktop/mobile browser smoke                         |
| `PN-BACKGROUND-013`       | Empty/populated D1 migration tests plus Worker catalog, byte-delivery, Studio, and non-Jam capability tests                          |

## Slice 5 — device music and canonical MIDI loading

Slice 5 lets the standalone room stage music already authored or imported on
this device. It reuses the canonical Piano project and Worker-import
foundations without mounting the App-owned legacy song picker or changing the
separate Guitar Night surface. The bundled study remains the silent fallback.

### Intent-lazy music library — `PN-MUSIC-*`

- **REQ-PN-MUSIC-001 — Explicit library boundary:** Loading Piano Night or
  opening Session, Sound, Room, or Coach shall not read IndexedDB, the legacy
  MIDI key, or the MercuryPitch composition library. Only an explicit Music
  action may load those device-local sources.
- **REQ-PN-MUSIC-002 — Intent-only importer:** Opening Music may load the
  failure-bearing project catalog, but the MIDI importer module and its Worker
  shall load only after a file-selection gesture.
- **REQ-PN-MUSIC-003 — Canonical catalog:** WHEN Music opens, Piano Night shall
  list valid canonical Piano projects in deterministic library order and may
  run the existing non-destructive legacy MIDI migration so older device-local
  imports become discoverable.
- **REQ-PN-MUSIC-004 — Composition projection:** Valid, pitched, non-empty
  melodies from the MercuryPitch composition library shall project through a
  pure, bounded adapter into the same beat-native performance stage without
  being mislabeled or persisted as a MIDI-derived PianoProject.
- **REQ-PN-MUSIC-005 — Durable import before stage:** WHEN a local MIDI import
  succeeds, Piano Night shall validate it in the bounded Worker and durably
  save the canonical project before exposing it as the active stage. IF
  parsing or persistence fails, THEN the current source shall remain active.
- **REQ-PN-MUSIC-006 — Atomic source replacement:** WHEN a valid source is
  selected, the one route-owned scheduler shall stop old score voices, the
  transport shall cancel pending playback and reset to beat zero, live voices
  shall release, and title, notes, duration, active-note index, and initial
  tempo shall change as one source replacement.
- **REQ-PN-MUSIC-007 — One runtime owner:** Source replacement shall retain the
  same transport, scheduler, synth, AudioContext, normalized input, touch port,
  and selected MIDI port rather than construct a competing owner.
- **REQ-PN-MUSIC-008 — Stale-result safety:** WHEN a library read, import, or
  pending Play is cancelled or superseded, its late completion shall not stage
  content, start a scheduler, overwrite status, or report success.
- **REQ-PN-MUSIC-009 — Failure-bearing states:** Music shall distinguish
  loading, empty, partial/skipped, unavailable, importing, and import-failure
  states; Included music shall remain selectable and Retry shall remain
  available after a device-library read failure.
- **REQ-PN-MUSIC-010 — Selection identity:** Current-source indication shall
  use stable source identity rather than title and shall expose visible and
  accessible `On stage` state.
- **REQ-PN-MUSIC-011 — Imported-content truth:** The authored Afterglow phrase,
  notation, dynamics, pedal, key, and bar copy shall appear only for the
  bundled study. Other sources shall use factual project sections, dynamic
  title/duration/note metadata, and an explicit not-analysed coach state.
- **REQ-PN-MUSIC-012 — Playback limits:** WHILE Piano Night performs only the
  selected score lane at one initial tempo, it shall identify additional
  tracks as saved rather than audible and shall not claim tempo-map-aware,
  backing-track, arranger, or percussion playback.
- **REQ-PN-MUSIC-013 — One controls surface:** Music shall be a distinct entry
  into the existing Piano Night controls drawer. Settings shall remain one
  entry per responsive composition and shall reopen the last settings section,
  not silently reopen Music.
- **REQ-PN-MUSIC-014 — Compact reachability:** At compact widths the Music tab,
  import action, current selection, retry/error copy, transport, and playable
  key horizon shall remain reachable without horizontal page overflow.
- **REQ-PN-MUSIC-015 — Guitar isolation:** Slice 5 shall not change Guitar
  Night or replace its in-flight picker work; only route-neutral canonical
  project/import foundations may be shared.

### Slice 5 verification map

| Requirement area     | Minimum evidence                                                                                                                          |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `PN-MUSIC-001`–`003` | Silent mount/settings assertions, Music-intent DB assertion, importer-module/Worker first-gesture audit, and migration/catalog fixtures   |
| `PN-MUSIC-004`–`008` | Composition adapter fixtures, durable import tests, source-swap scheduler/transport tests, and cancelled/stale completion tests           |
| `PN-MUSIC-009`–`011` | Component loading/empty/error/retry/current/large-title cases plus all-lens imported-content truth checks                                 |
| `PN-MUSIC-012`–`015` | Additional-track/tempo-limit copy assertions, one-Settings regression, responsive browser smoke, and a standalone MIDI import/reload test |

## Slice 6 — mapped tempo, track assignment, and measured practice

Slice 6 supersedes the playback limits in `REQ-PN-MUSIC-012` for pitched
project lanes. It keeps one practice lane while making imported tempo changes,
canonical score/backing choices, accompaniment, and live-input results part of
the same route-owned performance runtime. Multi-hand targets, percussion
rendering, General MIDI timbres, and installed soundbanks remain later slices.

### Performance truth — `PN-PRACTICE-*`

- **REQ-PN-PRACTICE-001 — Canonical tempo map:** A canonical Piano project
  shall project every valid tempo event into one deterministic beat-to-time
  map; events shall be ordered by tick, source track, and source order without
  mutating the persisted project.
- **REQ-PN-PRACTICE-002 — MIDI default tempo:** IF no tempo exists at beat
  zero, THEN playback shall use the Standard MIDI default of 120 BPM until the
  first authored tempo event.
- **REQ-PN-PRACTICE-003 — Piecewise clock:** The playhead, seek, session clock,
  scheduler lookahead, note starts, and note releases shall use the same
  piecewise tempo conversion, including notes that span a tempo boundary.
- **REQ-PN-PRACTICE-004 — Practice-tempo scaling:** WHEN the player changes
  the reference tempo or playback speed, Piano Night shall scale the complete
  authored tempo map without flattening its relative changes or jumping the
  playhead.
- **REQ-PN-PRACTICE-005 — Single practice lane:** A multi-track canonical
  project shall expose one pitched Score choice and zero or more pitched Hear
  choices. The Score lane shall remain the only lane judged in this slice.
- **REQ-PN-PRACTICE-006 — Canonical selection persistence:** WHEN a saved
  project's Score or Hear choices change, Piano Night shall validate and write
  those choices through the local Piano project authority before reporting
  them as saved; a session-only migration fallback may apply the choice only
  to that staged session and shall say so.
- **REQ-PN-PRACTICE-007 — Import assignment:** A MIDI import with one pitched
  lane may stage immediately. An import with multiple pitched lanes shall offer
  Score and Hear assignment before it replaces the active source.
- **REQ-PN-PRACTICE-008 — Pitched accompaniment:** Selected Hear lanes shall
  follow the same transport and tempo map as the Score lane, shall release on
  pause, seek, replacement, visibility loss, and disposal, and shall never
  enter score judgments.
- **REQ-PN-PRACTICE-009 — Sound truth:** WHILE the free fallback synth remains
  the only renderer, every audible lane shall be described as using that
  fallback sound. Instrument names remain assignment metadata, not a claim of
  General MIDI, sampled-piano, arranger, or soundbank playback.
- **REQ-PN-PRACTICE-010 — Percussion boundary:** Percussion lanes shall remain
  preserved in the canonical project but shall not be offered as pitched
  Score or Hear lanes or rendered through the fallback piano synth.
- **REQ-PN-PRACTICE-011 — Normalized scoring input:** WHILE the transport is
  playing, note-on evidence from the shared MIDI/touch input authority shall be
  compared with the Score lane only, using bounded timing windows and exact
  target MIDI pitch.
- **REQ-PN-PRACTICE-012 — Discontinuity safety:** Pause, seek, repeat, source
  replacement, and completion shall not replay stale judgments, count skipped
  notes as misses, preserve a prior source's score, or leave scheduled or live
  voices sounding.
- **REQ-PN-PRACTICE-013 — Measured-result truth:** Accuracy, streak, hits, and
  misses shall remain visibly pending before evidence exists and shall derive
  only from completed judgments; authored coaching prompts shall remain
  distinct from measured results.
- **REQ-PN-PRACTICE-014 — Bounded runtime:** Tempo lookup, scheduler, and
  scoring work shall remain bounded by indexed, binary-searched, or fixed-size
  score windows rather than scanning or copying the complete imported project
  on every animation, scheduling, or judgment sample.
- **REQ-PN-PRACTICE-015 — Deferred multi-hand mode:** This slice shall not
  represent multiple simultaneous Score lanes or infer left/right hands. That
  later model shall build on the canonical track assignment rather than merge
  every MIDI lane into one unreviewable target.

### Slice 6 verification map

| Requirement area        | Minimum evidence                                                                                                                          |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `PN-PRACTICE-001`–`004` | Pure tempo-map fixtures plus transport/scheduler boundary, seek, speed, duration, and source-replacement tests                            |
| `PN-PRACTICE-005`–`010` | Canonical assignment component/service tests, import staging tests, accompaniment scheduling tests, and percussion/sound-truth assertions |
| `PN-PRACTICE-011`–`013` | Input-event scoring fixtures plus miss, seek, pause, replacement, completion, and pending/result UI tests                                 |
| `PN-PRACTICE-014`–`015` | Dense scheduler/scorer bounded-work assertions, single-Score control assertion, responsive browser smoke, and first-paint boundary audit  |
