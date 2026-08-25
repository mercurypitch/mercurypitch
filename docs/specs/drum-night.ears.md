# Drum Night functional pilot — EARS Requirements

Approved requirements for the playable standalone Drum Night experience at
`/drum-night` after the authored-session and room-background integrations.

**Status:** functional pilot; intentionally private from search indexing.

**Visual authority:** the Pocket Console composition remains the default visual
world. The Score Sheet and Drummer Seat are alternate readings of the same
session. Product and evidence truth always override illustrative mock state.

EARS keywords: **WHEN** (event), **WHILE** (state), **IF/THEN** (unwanted
behaviour), **WHERE** (optional feature), otherwise ubiquitous ("shall").

## Route and pilot boundary — `DN-ROUTE-*`

- **REQ-DN-ROUTE-001 — Standalone entry:** Drum Night shall use the canonical
  `/drum-night` URL and a standalone Solid/Vite document rather than a new
  main-app hash tab.
- **REQ-DN-ROUTE-002 — Direct document:** The built application shall serve
  the Drum Night document for `/drum-night` and `/drum-night.html`; the clean
  path shall remain canonical.
- **REQ-DN-ROUTE-003 — Pilot indexing:** WHILE Drum Night remains a pilot, its
  document shall declare `noindex, nofollow` and shall stay out of the public
  sitemap.
- **REQ-DN-ROUTE-004 — Independent entry:** The standalone entry shall not
  statically import or mount the main application shell or App-owned stores.
- **REQ-DN-ROUTE-005 — Service-worker identity:** The service worker shall
  treat both Drum Night paths as standalone documents and shall not substitute
  the main application shell.
- **REQ-DN-ROUTE-006 — Lazy capability code:** MIDI/Guitar Pro parsers and
  sampled-kit media shall load only after the corresponding user import or
  audio action; they shall not be part of first-paint work.

## Safe first paint and activation — `DN-ACTIVATE-*`

- **REQ-DN-ACTIVATE-001 — Silent entry:** WHEN Drum Night mounts, it shall not
  create or resume an `AudioContext`, fetch or decode drum samples, request
  MIDI or microphone permission, open IndexedDB, create a Worker, start a
  timer, or begin playback.
- **REQ-DN-ACTIVATE-002 — Gesture-owned audio:** WHEN the user first activates
  Play, a touch pad, or a drum keyboard shortcut, Drum Night may create or
  resume its route-owned audio session. Connecting MIDI shall request only MIDI
  access and shall not activate audio by itself.
- **REQ-DN-ACTIVATE-003 — Inert browsing:** WHEN the user changes a view, opens
  a drawer, opens input details, or selects a kit before audio activation, Drum
  Night shall not activate audio or fetch that kit's samples.
- **REQ-DN-ACTIVATE-004 — Safe audio failure:** IF the route-owned audio graph
  cannot activate, THEN Drum Night shall remain operable, expose a recoverable
  error, and shall not claim that sound played.
- **REQ-DN-ACTIVATE-005 — Hidden-page release:** WHEN the document becomes
  hidden, Drum Night shall pause the shared transport and release active drum
  voices.
- **REQ-DN-ACTIVATE-006 — No microphone boundary:** Drum Night shall not
  request microphone access or present microphone analysis as available in
  this pilot.

## Room and composition — `DN-STAGE-*`

- **REQ-DN-STAGE-001 — Room as interface:** The first viewport shall read as
  a prepared drum tracking room, with the kit and pocket guide as its primary
  object rather than a dashboard of equal-weight cards.
- **REQ-DN-STAGE-002 — One musical document:** Pocket, Score, and Drummer Seat
  shall be alternate views of one route-owned session. A view change shall
  retain import, tempo, loop, count-in, recorded hits, and transport state.
- **REQ-DN-STAGE-003 — Drum primitives:** The visual language shall encode
  subdivision, kit piece, articulation, velocity, and early/on/late timing; it
  shall not reuse a guitar note highway or piano pitch fall.
- **REQ-DN-STAGE-004 — One transport:** Each responsive composition shall
  expose one primary Play/Pause owner. Opening Coach, input details, or a rack
  drawer shall not create a second clock or transport.
- **REQ-DN-STAGE-005 — Contextual depth:** Groove, Kit, Mix, Room, Songs,
  Learn, and Coach depth shall open in one tethered desktop/tablet workbench or
  one modal phone sheet rather than compete with the performance surface.
- **REQ-DN-STAGE-006 — Semantic implementation:** The production shell shall
  recreate the composition with semantic Solid, HTML, CSS, SVG, and responsive
  image assets; it shall not embed a screenshot, iframe, or exported mock UI.
- **REQ-DN-STAGE-007 — Authored responsive art:** Pocket and Drummer Seat
  scenes shall provide independently authored landscape and portrait assets
  rather than treating the phone stage as a blind desktop crop.
- **REQ-DN-STAGE-008 — Durable contrast:** Musical information and controls
  shall remain legible through authored contrast layers if local image
  brightness changes or a room asset fails to decode.
- **REQ-DN-STAGE-009 — Branded home:** The room rail and compact header shall
  use the canonical MercuryPitch mark rather than a generic planet glyph. The
  rail mark shall link home with an outcome-aligned accessible name.
- **REQ-DN-STAGE-010 — Switchable tethered workbench:** WHILE the
  desktop/tablet workbench is open, its room-rail launchers shall remain
  operable. Activating a different launcher shall replace the workbench content
  in place, activating its selected launcher shall close it, and activating
  Pocket shall close it and restore the performance surface.
- **REQ-DN-STAGE-011 — Quiet Pocket guide:** Pocket shall present current beat,
  phrase-step, and current/next authored-attack guidance from the route-owned
  transport. Idle markers shall remain still; any state change shall pause,
  seek, loop, and stop with that transport. Pocket shall not run an
  unsynchronised scan, breathe, pulse, or other decorative timing loop and
  shall not imply that it owns a second metronome.

## Visual room catalog — `DN-ROOM-*`

- **REQ-DN-ROOM-001 — First-class surface:** Drum Night shall use the shared
  typed background lifecycle as the `drum` surface, with
  `drum-pocket-console` as its shipped public default.
- **REQ-DN-ROOM-002 — Included first pack:** The public Drum gallery shall
  expose Pocket Console, Tape Room, Daylight Riser, and After-Hours Booth as
  independently selectable free rooms.
- **REQ-DN-ROOM-003 — Supporter first pack:** The protected Drum allowlist
  shall contain Blue Hour Live Room, Bronze Soundstage, Rain Glass Studio,
  Walnut Live Room, and Sunrise Pavilion; locked cards shall not request their
  protected image bytes, and no premium artwork shall ship under `public/`.
- **REQ-DN-ROOM-004 — Authored orientation:** Every included or supporter
  Drum room shall provide independently composed landscape and portrait art;
  the runtime shall select by viewport orientation rather than blindly crop a
  desktop master.
- **REQ-DN-ROOM-005 — Visual-only selection:** WHEN a room is selected, Drum
  Night shall change only the stage image and focal point. It shall not change
  the kit, volume, mix, ambience, transport, tempo, mapping, or session.
- **REQ-DN-ROOM-006 — Local preference, current access:** WHEN a known Drum
  room is selected, Drum Night shall persist only its identifier under
  `pitchperfect_drum_background`; supporter access shall be checked again from
  current server evidence before protected bytes resolve.
- **REQ-DN-ROOM-007 — Silent-first catalogue:** A free Drum preference shall
  resolve without retaining or fetching premium metadata. Drum Night shall
  cross the premium-catalogue boundary only after the user first opens Room,
  and may keep that controller retained for the route lifetime thereafter.
- **REQ-DN-ROOM-008 — Seat authority:** WHILE Drummer Seat is selected, its
  authored landscape or portrait scene shall remain the visible backdrop;
  changing the general room preference shall apply to Pocket and Score without
  replacing the Drummer Seat perspective.

## Live kit and input — `DN-INPUT-*`

- **REQ-DN-INPUT-001 — Six immediate surfaces:** Drum Night shall expose
  playable closed-hi-hat, snare, kick, tom, ride, and crash surfaces mapped to
  their declared General MIDI articulations. Pocket Console and Drummer Seat
  shall use authored kit-aligned hit zones; phone Pocket and Score layouts
  shall additionally retain a dedicated six-pad fallback.
- **REQ-DN-INPUT-002 — Pointer velocity:** WHEN a primary pointer strikes a
  playable surface, Drum Night shall put one bounded 1–127 velocity event on
  the shared performance timeline; non-primary and non-left-button pointer
  events shall not trigger a hit.
- **REQ-DN-INPUT-003 — Keyboard kit:** WHERE no editable control is active,
  top-row or numpad keys 1–6 shall trigger the six immediate pads. Modified,
  repeated, already-handled, and editable-field keystrokes shall be ignored.
- **REQ-DN-INPUT-004 — Explicit WebMIDI:** WHEN the input panel opens, Drum
  Night shall describe MIDI availability without requesting permission. Only
  Connect MIDI or a later explicit scan may call `requestMIDIAccess`.
- **REQ-DN-INPUT-005 — Device truth:** WHILE MIDI permission or device state is
  known, Drum Night shall distinguish requesting, connected, no-inputs,
  disconnected, unsupported, denied, and error states and expose an applicable
  recovery action.
- **REQ-DN-INPUT-006 — Selected input:** WHERE multiple MIDI inputs are
  visible, the user shall be able to select one active input; listener and
  calibration ownership shall follow that selection without duplicating
  strikes.
- **REQ-DN-INPUT-007 — MIDI evidence:** WHEN the selected e-kit emits a note-on,
  Drum Night shall preserve its velocity, raw key, zero-based source channel,
  source device, and normalized event time. Note-off shall not become a hit.
- **REQ-DN-INPUT-008 — Learn by strike:** WHEN the user arms Learn for a drum
  articulation, the next physical note-on from the selected input shall map
  that raw key to the chosen General MIDI articulation and shall end learning.
- **REQ-DN-INPUT-009 — Device-scoped mapping:** Learned MIDI mappings shall be
  scoped to the selected input identifier and may be retained locally; clearing
  one profile shall not silently rewrite another device's profile.
- **REQ-DN-INPUT-010 — Unmapped truth:** IF a physical note is outside the
  General MIDI drum range and has no learned mapping, THEN Drum Night shall
  identify the raw note and channel and shall not guess a kit voice.
- **REQ-DN-INPUT-011 — Five-strike calibration:** WHERE a MIDI input is
  connected, Drum Night shall require five expected/observed strike pairs
  before offering a latency estimate, report sample consistency, reject
  non-finite evidence, and bound an applied estimate to 0–250 ms.
- **REQ-DN-INPUT-012 — Calibration ownership:** WHEN a ready latency estimate
  is applied, compensation shall affect only hits from the input that supplied
  its evidence. Changing or disconnecting that input shall clear the applied
  estimate.

## Drum sound catalog — `DN-KIT-*`

- **REQ-DN-KIT-001 — Four flavors:** The first sound catalog shall offer
  Mercury Synth, Classic GM, Studio, and Live as four independently selectable
  kit flavors.
- **REQ-DN-KIT-002 — Zero-byte floor:** Mercury Synth shall remain an
  immediate local synthesis option with no sample download.
- **REQ-DN-KIT-003 — Lazy sampled kits:** WHEN a sampled kit is selected, Drum
  Night shall defer its sample fetch and decode until a user-owned audio action
  and shall prepare only that selected kit's required sample plan.
- **REQ-DN-KIT-004 — Per-hit fallback:** WHILE a sampled articulation is not
  ready or cannot decode, Drum Night shall use its supported synth fallback for
  that hit and expose that fallback state rather than claiming sampled audio.
- **REQ-DN-KIT-005 — Unsupported silence:** IF neither a sample nor a declared
  synth route supports an articulation, THEN that hit shall stay silent and be
  reported as unmapped or dropped; it shall not be substituted with a snare or
  another guessed voice.
- **REQ-DN-KIT-006 — Load truth and recovery:** WHILE samples load or after a
  load failure, the Kit surface shall expose selected-kit progress, fallback
  readiness, failure, attribution where required, and an explicit retry.
- **REQ-DN-KIT-007 — Integrity and provenance:** Every published sample shall
  have a manifest byte count, SHA-256 digest, immutable resource path, source
  provenance, transformation record, and redistribution terms.
- **REQ-DN-KIT-008 — Local kit preference:** WHEN a user selects a kit, Drum
  Night may retain that kit identifier locally and restore it on a later visit
  without activating audio or downloading samples.

## Session import and canonical truth — `DN-IMPORT-*`

- **REQ-DN-IMPORT-001 — Supported sources:** Songs shall accept `.mid`,
  `.midi`, `.gp`, `.gp3`, `.gp4`, `.gp5`, and `.gpx` files from a picker or
  drop zone and route each accepted file through the shared canonical song
  parsers.
- **REQ-DN-IMPORT-002 — Pre-read size bound:** IF a selected file exceeds 20
  MiB, THEN Drum Night shall reject it before reading or parsing its contents
  and shall report both the actual and maximum size.
- **REQ-DN-IMPORT-003 — Latest selection wins:** WHEN a newer import begins or
  the current import is cleared, a slower result from any prior selection shall
  not replace the current session.
- **REQ-DN-IMPORT-004 — Percussion projection:** WHEN an accepted file contains
  percussion, Drum Night shall retain the canonical song for provenance and
  project only percussion tracks into drum hits.
- **REQ-DN-IMPORT-005 — Mixed-file truth:** WHILE a source also contains
  pitched tracks, those tracks shall remain in the canonical source and shall
  be counted in import evidence, but they shall never become drum hits or kit
  voices.
- **REQ-DN-IMPORT-006 — Exact source evidence:** Mapped percussion shall retain
  available authored timing, tempo, meter, velocity, written duration, source
  articulation, track identity, and MIDI/Guitar Pro provenance.
- **REQ-DN-IMPORT-007 — Import state truth:** Drum Night shall distinguish
  idle, loading, ready, empty, too-large, unsupported-file, no-drums,
  unsupported-mapping, and parser-error states with recovery-oriented copy.
- **REQ-DN-IMPORT-008 — No guessed mapping:** IF a percussion source event
  cannot be safely mapped, THEN Drum Night shall count and disclose it without
  inventing a replacement articulation or sound.
- **REQ-DN-IMPORT-009 — Ephemeral session:** Imported file contents and the
  resulting session shall remain route-memory state for this pilot; they shall
  not be uploaded or restored after a reload.
- **REQ-DN-IMPORT-010 — Worker isolation:** WHEN a supported file is selected,
  Drum Night shall pass the `File` to a lazily created one-shot module Worker;
  the UI thread shall not read or parse its bytes. Replacing, cancelling, or
  disposing an attempt shall terminate its Worker, and an attempt exceeding 10
  seconds shall fail with recoverable copy.
- **REQ-DN-IMPORT-011 — Complexity bound:** MIDI parsing shall accept at most
  131,072 source events and the canonical Drum Night projection shall accept
  at most 32,768 musical events. One authored text field shall contain at most
  4,096 characters, authored text shall total at most 1,048,576 characters,
  and bend contours shall total at most 131,072 points. IF any bound is
  exceeded, THEN the whole import shall be rejected with no truncation or
  partial session.
- **REQ-DN-IMPORT-012 — Loading escape:** WHILE an import is loading, Songs
  shall keep a replacement file picker available and expose a Cancel action;
  either action shall stop the current attempt.

## Score, Seat, and Coach — `DN-SESSION-*`

- **REQ-DN-SESSION-001 — Shared index:** WHEN an import becomes ready, Score,
  Drummer Seat, Coach, the session map, and authored playback shall consume one
  canonical percussion document and a reusable whole-song score index.
- **REQ-DN-SESSION-002 — Percussion score:** Score shall render percussion
  staff positions and noteheads, authored meter and bar boundaries, velocity
  accents, source evidence, and the shared playhead; it shall not reinterpret
  General MIDI drum keys as pitched melody.
- **REQ-DN-SESSION-003 — Drummer-seat reading:** Drummer Seat shall place
  authored targets on stable physical kit zones, make those zones directly
  pointer-playable, and visually distinguish the authored target from a
  current live hit.
- **REQ-DN-SESSION-004 — Bounded views:** Score and Drummer Seat shall query
  only the visible or current authored range and shall keep rendered and
  semantic event counts bounded independently from the canonical session.
- **REQ-DN-SESSION-005 — Omission disclosure:** IF a display range, semantic
  list, simultaneous-seat highlight, or 4,096-bar safety range omits authored
  events, THEN the affected view shall report the omitted count and shall not
  fold those events into another bar or kit zone.
- **REQ-DN-SESSION-006 — Direct-hit coaching:** Coach shall compare captured
  touch, keyboard, or e-kit hits only with the exact authored General MIDI
  articulation in deterministic source order; a related voice-family hit shall
  not become a timing match.
- **REQ-DN-SESSION-007 — Evidence scope:** Coach shall make timing claims only
  from aligned event-time evidence and dynamics claims only from inputs that
  carry velocity. Low-confidence or ambiguous timing direction shall be
  explicitly withheld.
- **REQ-DN-SESSION-008 — Recovery action:** WHEN measured timing or dynamics
  evidence crosses its declared threshold, Coach may offer one authored-bar
  recovery loop at 70% speed on the owning transport.
- **REQ-DN-SESSION-009 — Recovery escape:** WHILE a recovery loop is active, a
  visible control shall clear it at every supported viewport and restore 100%
  speed if that recovery action applied the slowdown.
- **REQ-DN-SESSION-010 — No technique inference:** Coaching shall not claim or
  infer limb, sticking, grip, technique, or acoustic-kit identity.

## Authored playback and bounded work — `DN-PLAYBACK-*`

- **REQ-DN-PLAYBACK-001 — One authored clock:** WHEN a ready session plays,
  authored percussion and captured live hits shall use the same route-owned
  transport timeline and audio-clock mapping.
- **REQ-DN-PLAYBACK-002 — Authored timing:** Playback shall follow the source
  tempo map, meter-aligned position, written trailing duration, user speed,
  count-in, and any valid bounded loop without mutating the canonical session.
- **REQ-DN-PLAYBACK-003 — Audible count-in:** WHEN count-in is enabled and the
  user starts playback, Drum Night shall present it visually and schedule its
  audible count-in cue on the route clock whether or not the optional
  continuous click is enabled. An authored attack at beat zero may be prepared
  once for the playback boundary but shall not double-trigger.
- **REQ-DN-PLAYBACK-004 — Pause and replay:** WHEN playback pauses, stops,
  seeks, changes session, or changes scheduling authority, queued drum voices
  shall be invalidated. WHEN a completed session is played again, it shall
  restart from beat zero.
- **REQ-DN-PLAYBACK-005 — Audio-clock wait:** IF authored playback has no
  active route-owned audio-clock mapping, THEN it shall report that it is
  waiting for audio and shall not claim that authored hits sounded.
- **REQ-DN-PLAYBACK-006 — Tempo-map bounds:** Authored playback shall accept
  source tempo only within the supported 40–280 BPM range, retain at most 128
  sufficiently spaced changes from a bounded whole-song sample, and disclose
  counts of omitted or clamped source changes.
- **REQ-DN-PLAYBACK-007 — Scheduling bounds:** One scheduler pass shall enqueue
  no more than 256 occurrences and one timestamp shall sound no more than 48
  simultaneous occurrences. In-range work may be deferred without changing
  its authored time.
- **REQ-DN-PLAYBACK-008 — Durable omission truth:** IF deferred work expires
  before scheduler capacity becomes available, or a simultaneous group exceeds
  the audio ceiling, THEN Drum Night shall retain and expose a durable omission
  count; omitted attacks shall stay silent.
- **REQ-DN-PLAYBACK-009 — Loop identity:** WHILE a loop repeats, each authored
  occurrence shall retain its loop iteration and monotonic timeline identity;
  overlapping lookahead passes shall not double-schedule it.
- **REQ-DN-PLAYBACK-010 — Audible first pocket:** Drum Night shall ship one
  route-owned, velocity-aware prepared groove with truthful Classic, Funk,
  Driving, and Half-time authored variants. Play shall sound that document
  through the selected kit on the same clock used by Pocket, Score, Seat, and
  Coach.
- **REQ-DN-PLAYBACK-011 — Bounded take evidence:** Drum Night shall retain at
  most 4,096 captured live hits for the current take. IF newer hits replace
  older retained evidence, THEN the route shall expose a durable discarded-hit
  count, Coach shall use only the retained window, and clearing or replacing
  the take shall reset both values.
- **REQ-DN-PLAYBACK-012 — Optional click:** Drum Night shall expose one
  off-by-default continuous playback click. Enabling or changing it before
  Play shall remain audio-inert; while transport runs it shall follow authored
  meter, tempo changes, speed, loops, invalidation, and teardown on the route
  clock. Its enabled state shall not gate the audible count-in. Backing controls
  shall not be presented until that source exists.
- **REQ-DN-PLAYBACK-013 — Shared full-song timeline:** Drum Night shall present
  the shared `LoopRangeRail` across Pocket, Score, and Drummer Seat rather than
  copy a feature-local rail. Its seek axis shall show elapsed seconds while its
  A/B marks retain authored-beat identity through tempo and speed changes.
- **REQ-DN-PLAYBACK-014 — Explicit range states:** The timeline shall expose
  full-song, one-mark-waiting, and active A/B states. A and B shall snap to a
  quarter-beat grid with a minimum quarter-beat gap; Drum Night shall not
  manufacture a fixed-length loop when no marks exist.
- **REQ-DN-PLAYBACK-015 — One loop authority:** WHEN both marks form a valid
  range, Drum Night shall commit that range once to the route transport. A
  Coach recovery range shall adopt the same visible marks, and clearing the
  range shall preserve the visible playhead while restoring full-song playback.
- **REQ-DN-PLAYBACK-016 — Scrub lifecycle:** WHEN a running take begins a
  pointer or keyboard scrub, Drum Night shall pause once, seek on the elapsed
  axis, and resume once when the scrub ends. An idle scrub shall remain idle,
  and neither path shall create another clock or an extra count-in.
- **REQ-DN-PLAYBACK-017 — Session boundary:** WHEN the prepared groove or an
  imported document replaces the current session, Drum Night shall clear both
  A/B marks and the active transport loop before the new document plays.

## Interaction and accessibility — `DN-A11Y-*`

- **REQ-DN-A11Y-001 — Control names:** Every control shall expose an
  outcome-aligned accessible name and selected or pressed state where relevant.
- **REQ-DN-A11Y-002 — Target size:** Every visible primary control shall
  provide a target of at least 44 by 44 CSS pixels.
- **REQ-DN-A11Y-003 — Visible focus:** Keyboard focus shall remain visibly
  distinguishable across photographic rooms, notation, kit zones, and smoked
  control surfaces.
- **REQ-DN-A11Y-004 — Modal focus:** WHEN the phone workbench sheet or an input
  dialog opens, it shall take and contain focus, identify itself as modal,
  close on Escape or its scrim where applicable, and restore focus to its
  opener.
- **REQ-DN-A11Y-005 — Composite keyboard behavior:** Tab lists and kit radio
  groups shall expose their roles and selected state and shall support arrow,
  Home, and End navigation without creating multiple tab stops per group.
- **REQ-DN-A11Y-006 — Space transport:** WHERE no form field or modal dialog
  owns the key event, Space shall toggle the one Play/Pause transport without
  scrolling the page.
- **REQ-DN-A11Y-007 — Reduced motion:** WHERE reduced motion is requested,
  scanning, pulsing, and hit travel shall stop while selected, timing, input,
  and transport state remain legible.
- **REQ-DN-A11Y-008 — Non-colour meaning:** Timing, selected, input, kit,
  fallback, and transport state shall not depend on colour alone.
- **REQ-DN-A11Y-009 — Tethered-workbench semantics:** The desktop/tablet
  workbench shall identify itself as a nonmodal labelled region and shall not
  trap focus or make its room rail inert. Each launcher shall expose its
  expanded and selected state, and Escape shall close the workbench without
  losing a useful focus position.

## Responsive composition — `DN-RESPONSIVE-*`

- **REQ-DN-RESPONSIVE-001 — Wide-screen geometry:** Desktop and tablet shall
  keep a narrow room rail, compact session bar, full performance stage, bounded
  coach, and one single-row bottom console without overlap or page overflow.
  They shall not reserve a detached persistent six-pad strip beneath the stage.
- **REQ-DN-RESPONSIVE-002 — Compact composition:** Phone portrait and compact
  landscape shall preserve the performance stage, six playable hit surfaces,
  contextual navigation, and one raised Play control without clipping.
- **REQ-DN-RESPONSIVE-003 — Carried kit:** On phone, the dedicated six-pad
  fallback shall remain available in Pocket and Score whenever a modal layer
  is closed; Drummer Seat shall instead carry its six mapped photo zones at a
  playable size. On desktop/tablet, Pocket Console and Drummer Seat shall carry
  pointer-playable kit zones without a detached pad strip; keyboard and
  connected e-kit input shall remain available in every view.
- **REQ-DN-RESPONSIVE-004 — Viewport coverage:** At 320×568, 390×844,
  844×390, 768×1024, 1024×768, and 1440×900 CSS pixels, Drum Night shall have
  no horizontal or vertical page overflow and no clipped primary control.
- **REQ-DN-RESPONSIVE-005 — Safe areas:** Fixed compact controls shall clear
  applicable viewport safe-area insets.

## Pilot exclusions and persistence boundary

This pilot does not include room-microphone capture or analysis; limb,
sticking, grip, or technique inference; backing or guide tracks; Groove Mirror
generation; imported-session, recorded-take, coaching-history, or A/B-range
persistence; public indexing; or production deployment. The locally retained
kit choice, Drum room choice, and device-scoped MIDI learn map are preferences,
not session or performance persistence.

## Verification map

| Requirement area            | Minimum evidence                                                                                                                                                                                                                                                            |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DN-ROUTE`, `DN-ACTIVATE`   | Direct dev/build route assertions; canonical/noindex/sitemap and standalone service-worker checks; instrumented silent-first-paint browser smoke                                                                                                                            |
| `DN-STAGE`, `DN-RESPONSIVE` | Brand-asset and workbench-switching assertions; Pocket/Score/Seat state-retention tests; route-clock Pocket-guide checks; desktop single-console, phone-pad, orientation, overflow, and target-size smoke                                                                   |
| `DN-ROOM`                   | Typed catalog/default and storage-key tests; public-file shape and size checks; protected allowlist/migration parity; silent-first gallery and visual-only selection smoke                                                                                                  |
| `DN-INPUT`, `DN-KIT`        | Pointer/keyboard/WebMIDI integration tests; permission and hotplug state tests; device-scoped learn/calibration tests; manifest integrity, lazy-loading, fallback, and retry                                                                                                |
| `DN-IMPORT`, `DN-SESSION`   | MIDI and Guitar Pro parser fixtures; mixed/percussion/no-drums/error/stale import tests; whole-song index, late-range, Score, Seat, coaching, and omission tests                                                                                                            |
| `DN-PLAYBACK`               | Deterministic transport/audio-clock tests for audible count-in, authored tempo/duration, seconds/beat conversion, pause/replay, loop identity, A/B state and reset, scrub lifecycle, dedupe, capacity, unsupported hits, and fallback truth; real-pointer seek/marker smoke |
| `DN-A11Y`                   | Accessible-name/state assertions; nonmodal workbench and modal-sheet focus checks; composite keyboard behavior; reduced-motion and non-colour review                                                                                                                        |
