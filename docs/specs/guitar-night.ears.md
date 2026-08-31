# Guitar Night — EARS Requirements

Approved target requirements for the standalone Guitar Night experience at
`/guitar-night`. These requirements define the target contract while the
current `/#/guitar` host is refactored into the first consumer of the shared
Guitar runtime.

**Status:** approved target contract; standalone foundation implemented,
legacy cutover still pending. The Velvet Rehearsal entry, configurable first
win, durable local-song preparation, exact lightweight stem hydration,
two-stem-to-full-band upgrade, synchronized buffered/streamed transport,
pitch-preserving practice speed, shared output buses, a full-viewport
Highway/Grid/Tab/Neck stage, explicit local Listening, and evidence-only Jam
Doctor are integrated. The legacy tab and standalone room now share the
host-neutral 3D performance source and pure renderer-scene boundary. Guitar
Night can project that one scene as string lanes or the original fret grid
without remounting it; the broader runtime lifecycle cutover remains pending.
Entry, preparation, staging, room handoff, and speed changes before Play remain
silent. Playback, count-in, and microphone capture each begin only from their
explicit player actions; a Listening route never rewrites the player's mix. A distinct
guitar stem defaults muted, while two-stem fallback copy states that guitar
remains in the accompaniment.

Authored and measured reference adapters, the score-only rehearsal room,
shared A/B loop ownership, timestamped AudioWorklet attacks, route-local
latency calibration, the stage-first beginner lesson, and the responsive
Velvet camera/target treatment were merged through
[#458](https://github.com/mercurypitch/mercurypitch/pull/458). That work records
attacks in one bounded, memory-only take with stable identity, exact or
explicitly coarse clock provenance, and a pinned latency snapshot. It also
carries explicit room-microphone, direct-interface, and Web MIDI routes; MIDI
attack/release evidence; deterministic guitar-input fixtures; authored
tuning, capo, chord, and technique notation; and the camera, effects, and
handedness stage upgrade.
Authored-score-to-recording alignment, audio-input release and continuous-pitch
evidence, dependable polyphonic analysis, real-device latency and
highway-performance validation, and the legacy runtime cutover remain target
work.

The score-only room now also has an independent compact live score for
ordinary authored-note rehearsal. It consumes the same bounded input take and
exact room boundary as playback, while Jam Doctor remains an explicit,
separate diagnostic review. The initial score is notes-only: unmeasured route
delay never becomes a timing grade, and unsupported acoustic chords or fast
passages are excluded rather than counted as mistakes.

The restrained Learn shelf and the first rebuilt legacy activity, Note Hunt,
were merged through
[#492](https://github.com/mercurypitch/mercurypitch/pull/492). Hear & Find,
Echo a Phrase, Shape Walk, and their shared active-tuning Learn host are
implemented by
[#494](https://github.com/mercurypitch/mercurypitch/pull/494). Broader
professional Jam parity and the legacy cutover remain target work.

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
- **REQ-GN-ROUTE-008 — Direct song restoration:** WHEN a valid prepared-song
  URL opens directly into song detail, the visible local tab library shall
  initialize without requiring a Back or Load-a-song round trip and without
  starting audio or capture.

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
  orientation, room, sheet, or Highway/Grid/Tab/Neck view changes, the active
  runtime and transport shall survive without restarting audio or capture.
- **REQ-GN-RUNTIME-009 — Pitch-preserving practice speed:** WHEN playback
  speed differs from `1×`, separated stems shall remain synchronized and keep
  their musical pitch. WHEN speed changes during buffered playback, the room
  shall preserve the visible song position while handing off to a
  pitch-preserving playback path; changing speed before Play shall not create
  or activate audio.
- **REQ-GN-RUNTIME-010 — Complete authored tempo map:** WHEN an imported score
  supplies tempo changes, Guitar Night shall preserve them through local song
  persistence and shall use the same complete map for beat-to-seconds,
  seconds-to-beat, click, guide, playhead, note duration, and take completion.
  WHEN the player changes the opening tempo, every authored tempo segment shall
  scale by the same ratio rather than flattening to one tempo.
- **REQ-GN-RUNTIME-011 — Stable take, live mix:** WHEN a score-room count-in
  starts, its tempo map, authored targets, duration, instrument voice, loop,
  and exact scheduler boundary shall remain fixed until that take stops or
  completes. Master level, click, and authored/backing lane gains may change
  live through pop-free ramps without restarting that clock. A count-in change
  made during a scheduled take shall apply to the next count-in. A tempo,
  scored-track, or input-route change shall park at the exact visible beat,
  retain the earned partial result, release the pinned run, and remain paused
  for an explicit restart rather than fail, jump to zero, or silently retime
  admitted evidence.
- **REQ-GN-RUNTIME-012 — Measured-reference ownership:** WHEN notes are
  measured from a separated stem, the reference shall retain the exact backing
  session that produced them. IF a different backing is staged, THEN Guitar
  Night shall detach that measured reference rather than display it against the
  new recording.
- **REQ-GN-RUNTIME-013 — Calibration isolation:** WHILE route-latency
  calibration is active, playback and assessed Listening shall not start, and
  calibration attacks shall not enter the player's take. WHEN calibration is
  cancelled, superseded, stopped, or disposed, its scheduled clicks, temporary
  nodes, timeout, and captured evidence shall be released.
- **REQ-GN-RUNTIME-014 — Complete input-channel analysis:** WHERE a browser or
  interface exposes two through 32 non-empty input channels, onset analysis
  shall inspect every such channel and analyze the strongest intact channel
  rather than assume the instrument is present on channel one or attenuate it
  through channel averaging. IF an input exceeds Web Audio's 32-channel splitter
  limit, THEN assessed Listening shall fail visibly with a routing action rather
  than silently ignore channels.
- **REQ-GN-RUNTIME-015 — Exact score transport:** WHEN the player points,
  drags, or uses the keyboard on an authored-score timeline, the room shall
  park at that exact fractional beat through the complete tempo map without
  opening audio. WHEN an active take is paused or scrubbed, the scheduler shall
  silence its lookahead immediately and preserve the exact parked position on
  the same audio context without replaying past note attacks. WHEN a scrub of
  an active take ends, its automatic resume shall not add a second count-in.
  WHEN the player deliberately resumes an ordinary paused rehearsal with Play,
  Space, or a voice command, the currently selected count-in shall lead into
  that parked position. A parked pre-play position shall not lock setup
  controls.
- **REQ-GN-RUNTIME-016 — Control-state truth:** WHEN a route-owned transport
  survives room navigation, every visible transport control shall be restored
  from that transport's current state rather than from a presentation default.
- **REQ-GN-RUNTIME-017 — Pinned input take:** WHEN assessed Listening begins,
  Guitar Night shall create one bounded, memory-only take anchored to the
  route's audio clock. That take shall pin its sample rate, attack-clock
  precision, latency correction, latency provenance, and known uncertainty;
  later calibration or device-setting changes shall not retime evidence already
  admitted to it.
- **REQ-GN-RUNTIME-018 — Traceable input events:** Every event admitted to an
  input take shall have a stable identity, raw and latency-compensated
  transport-relative frames, and either the exact AudioWorklet frame or an
  explicit coarse frame-loop observation window. A late pitch result may
  replace the provisional metadata for the same event but shall not append a
  duplicate or change either clock. Evidence before the take or after its end
  shall be excluded; bounded truncation shall be recorded. Stop shall complete
  the take, while failed activation or disposal shall cancel it. Guitar Night
  shall neither retain raw input audio nor persist Capture v0 takes.
- **REQ-GN-RUNTIME-019 — Explicit input routes:** Guitar Night shall present
  room microphone, direct interface, and MIDI as explicit Listening routes.
  The selected route and device may persist locally, but access shall begin
  only after a player gesture. The active take shall record the requested and
  actual device identity; IF the browser opens a fallback device, THEN the
  room shall name that fallback rather than label it as the unavailable saved
  device.
- **REQ-GN-RUNTIME-020 — Input loss and handoff:** WHEN an active audio or MIDI
  device disconnects, or another tab takes over the shared microphone hold,
  Guitar Night shall complete the bounded take, detach analysis nodes and
  handlers, and expose a recoverable error. IF another tab holds the selected
  audio input, THEN the room shall offer an explicit `Use it here` handoff and
  shall not claim ownership before the shared manager confirms it.
- **REQ-GN-RUNTIME-021 — MIDI clock truth:** MIDI attacks and releases shall
  retain a stable voice identity, input port, channel, event timestamp, receipt
  timestamp, and mapping onto the room AudioContext clock. That mapping may
  support high-resolution event spacing, but MIDI route delay shall remain
  explicitly unmeasured and shall not unlock absolute early/late claims.
- **REQ-GN-RUNTIME-022 — Input evidence harness:** A deterministic synthetic
  corpus shall separately report detector delay, misses, false attacks, note
  error, and cents error where monophonic ground truth exists. Polyphonic and
  unusable fixtures shall name why pitch evidence is unavailable. A
  development-only real-device export may include route, clock, aggregate
  health, latency provenance, and event counts, but shall contain no raw audio
  or event timeline and shall label the capture as user-run and unverified.
- **REQ-GN-RUNTIME-023 — Rehearsal control parity:** WHILE an authored score
  room is open, its primary rail shall expose persistent master volume, shared
  A/B marks, a coarse Off/Room mic/Direct input/MIDI Listening cycle, click,
  count-in, and authored-tab sound without requiring the Session sheet. Mute
  and solo shall change audible lanes during playback; changing the scored
  track or input route may park the run but shall preserve the playhead. Voice
  control shall advertise only the Rehearse commands it can execute, including
  transport, marks, click, count-in, tab sound, Listening, and Score.
- **REQ-GN-RUNTIME-024 — Live loop admission:** WHEN an ordinary authored-score
  rehearsal is playing and a valid B mark completes an A/B span, the room shall
  immediately relaunch the same pinned rehearsal at A with no second count-in
  and schedule that loop into its audio clock. WHEN that active loop is cleared,
  the unlooped rehearsal shall continue from the exact currently visible beat.
  Phrase-review and live-score evidence runs shall refuse loop mutation rather
  than blending evidence from different ranges.
- **REQ-GN-RUNTIME-025 — Percussion-room timeline parity:** WHEN a
  percussion-only reference opens, its full authored horizon shall remain
  seekable in elapsed seconds through the complete tempo map, with the same
  shared labelled A/B rail used by authored-score rehearsal. Loop boundaries
  shall snap to whole exercise beats; a B marker at the right edge shall admit
  the last fractional-horizon drum attack. WHEN a running percussion rehearsal
  is scrubbed, it shall pause once and automatically resume once without a
  second count-in. Scrubbing before Play shall remain silent. WHEN the reference
  changes or the player clears the range, the percussion room shall release its
  owned A/B marks and active scheduler loop together.

## Tuner — `GN-TUNER-*`

- **REQ-GN-TUNER-001 — Silent entry:** WHEN the tuner opens, it shall be ready
  without requesting device permission, activating capture, starting or
  resuming room playback, or sounding a reference tone.
- **REQ-GN-TUNER-002 — Explicit audio start:** WHEN the player selects `Start
listening` or the first-use `Allow microphone` action, the tuner shall use an
  explicitly selected microphone or direct audio-interface route. MIDI shall
  not be presented or interpreted as a
  pitch-tuning input. WHEN the tuner opens, it shall inspect existing browser
  permission without opening capture, name the first-use action truthfully, and
  explain a site-level block rather than waiting for a prompt that cannot open.
- **REQ-GN-TUNER-003 — Shared listening graph:** WHILE the tuner is open from
  an existing room, it shall reuse that room's single listening controller,
  input lease, detector path, `AudioContext`, and output graph rather than
  create a tuner-owned listener, capture lease, detector loop, or audio graph.
- **REQ-GN-TUNER-004 — Instrument tuning truth:** Tuner targets shall derive
  from the current declared 4–8-string guitar or bass tuning in stage row
  order. WHERE that tuning carries source-authored pitches or a capo, each
  target shall use the corresponding sounding open pitch, including the capo.
- **REQ-GN-TUNER-005 — Automatic and explicit targets:** WHILE no string is
  selected, the tuner shall acquire the nearest open-string target only within
  its bounded automatic signal window. WHEN the player selects a string, the
  complete string tile shall retain that exact row identity, sound its
  reference, and show useful flat/sharp deviation even outside the automatic
  window.
- **REQ-GN-TUNER-006 — Exclusive reference tone:** WHEN the player starts a
  reference tone, active capture shall stop first and the tone shall sound
  through the room's guide bus. WHEN capture starts, every reference tone
  shall stop first; reference tone and capture shall never be active together.
  IF that reference interrupted an explicitly active tuner, capture shall
  resume after the reference ends unless the player stops listening, closes
  the tuner, or supersedes the request.
  WHEN either action supersedes a pending cross-tab input handoff, a late
  handoff result shall be released without starting hidden capture.
- **REQ-GN-TUNER-007 — Non-destructive room pause:** WHEN the tuner opens from
  either a backing room or score room, the active transport shall pause without
  resetting parked position, A/B loop, or mix, while the guide bus remains
  audible at the player's master level. WHILE a phrase assessment is recording,
  Tune shall remain unavailable rather than discarding its evidence. WHEN the
  tuner closes, it shall not resume transport or capture automatically.
- **REQ-GN-TUNER-008 — Overlay navigation and keyboard ownership:** WHEN the
  player invokes Back or Escape, the tuner shall close and restore focus to its
  trigger. WHILE the tuner overlay is open, the underlying room transport
  shall not own Space, and Space shall not start or resume hidden playback.
- **REQ-GN-TUNER-009 — Accessible responsive controls:** Tuner controls shall
  remain at least 44 by 44 CSS pixels on supported phone and desktop layouts.
  Target, cents direction, listening state, and in-tune judgment shall be
  available without colour alone; live announcements shall be throttled; and
  readings outside the visible cents rail shall retain an edge cue naming the
  corrective direction. Idle and active listening controls shall each retain
  WCAG AA text contrast, including while a pointer hover remains latched after
  touch. Reduced motion shall remove continuous needle or lock animation
  without hiding the current reading.
- **REQ-GN-TUNER-010 — Preset synchronization:** WHEN the player chooses a
  built-in tuning preset, Guitar Night shall update the current
  `InstrumentTuning`, tuner targets, reference tones, and every stage
  projection together in high-string-first row order; a preset shall never be
  a label-only tuner change. WHILE the preset choices are open, they shall
  overlay rather than reflow the tuner, close on an outside pointer, and yield
  the first Escape press before Escape closes the tuner.
- **REQ-GN-TUNER-011 — Listening-intent continuity:** WHILE tuner capture is
  explicitly active, changing between Auto and Manual or selecting a target
  string shall not release it. WHEN the player selects another physical audio
  route, the tuner shall re-acquire capture on that route without requiring a
  second Start action. IF the player invokes Stop, Back, or Escape while that
  transfer is pending, a late result shall not restart hidden capture.

## Continuous authored-note score — `GN-SCORE-*`

- **REQ-GN-SCORE-001 — Explicit scored take:** WHERE an authored score is
  staged and Listening is already active, WHEN the player selects Play,
  Guitar Night shall begin one continuous live-score take without requesting
  input permission, opening Jam Doctor, or creating another input recorder.
  Play without active Listening shall remain an ordinary unscored rehearsal.
- **REQ-GN-SCORE-002 — Independent contract:** Live score shall use a neutral,
  framework-free scoring boundary with no Jam Doctor diagnosis, recovery,
  history, or persistence dependency. Opening, closing, or clearing Jam Doctor
  shall not create, change, or be required for a live score.
- **REQ-GN-SCORE-003 — Exact run boundary:** A scored take shall pin the
  authored reference, track, half-open beat range, complete tempo map, sample
  rate, input route, and exact scheduled AudioContext start and end. Count-in
  evidence shall be excluded, and one input event and one authored target shall
  each be consumed at most once.
- **REQ-GN-SCORE-004 — Notes-only evidence:** The initial live score shall
  award an exact authored MIDI-pitch match and count an expired unmatched
  eligible target as a miss. Its timing window may associate an attack with a
  target but shall not change the score or imply early/late accuracy. A timing
  basis shall remain unavailable until the active route has separately
  validated latency evidence.
- **REQ-GN-SCORE-005 — Route honesty:** MIDI may score simultaneous targets and
  fast passages but shall not claim absolute timing while route delay is
  unmeasured. Room microphone and direct-interface routes shall exclude
  simultaneous targets and passages closer than the validated pitch-attachment
  window. Clipping, noisy or uncertain input and unobserved recorder windows
  shall exclude affected targets rather than turn them into misses.
- **REQ-GN-SCORE-006 — Recoverable live result:** WHILE a take runs, the visible
  percentage shall use at most the latest 16 eligible judgments; WHEN it
  completes, the result shall settle to the cumulative eligible judgments.
  The S/A/B/C/D grade shall remain hidden until at least four targets are
  judged. No zero, failing grade, or placeholder grade shall appear before
  sufficient evidence exists.
- **REQ-GN-SCORE-007 — Explicit scored-take mix:** Selecting Room mic, Direct
  input, or MIDI shall not mute or restore the authored target, backing parts,
  click, or master output. Those lanes shall remain explicit, independent live
  controls throughout the scored take. WHERE Room mic is listening, master
  output is above the silence floor, and any authored target, backing part, or
  click is audible, Guitar Night shall classify the mix as a known speaker-bleed
  risk. BEFORE the first scored take with that risk in the mounted room, Guitar
  Night shall require an explicit choice to continue while acknowledging that
  speaker playback can make the score inaccurate, mute the room audio, or
  cancel. Because a browser cannot reliably distinguish headphones from
  speakers, the warning shall describe the known app mix and shall not claim to
  have detected the physical output route. Guitar Night shall not auto-mute the
  mix or silently exclude score evidence solely because this risk exists.
  Phrase review shall remain quiet under REQ-GN-DOCTOR-002.
- **REQ-GN-SCORE-008 — Calm stage latch:** Live score shall extend the existing
  stage signal faceplate with its basis, percentage, and letter rather than add
  a dashboard, modal, streak, combo, celebration, or second coaching cue.
  Rolling number changes shall not enter a live region; only readiness, first
  established grade, letter changes, pause, input loss, and completion may be
  announced politely.
- **REQ-GN-SCORE-009 — Discontinuities:** Pause or input loss shall retain the
  last earned result without continuing to sample. A new scored Play, seek,
  source, track, tempo, or loop configuration shall create a fresh score run;
  one marked loop shall be scored as one bounded pass. Backing-only rooms shall
  remain unscored until an authored reference has an explicit alignment to the
  recording.
- **REQ-GN-SCORE-010 — Objective take ledger:** Guitar Night shall offer one
  calm Score sheet, separate from Jam Doctor, with the latest cumulative grade,
  percentage, judged/hit/missed/skipped counts, best streak, pinned range,
  track, and input kind. A held take may appear as an explicitly partial result
  for the current session but shall not enter history. Only canonical completed
  cumulative results may persist, with bounded scalar-only history and no raw
  audio, event timeline, or device identifier. Play again shall start a fresh
  scored run; phrase diagnosis shall remain a distinct, explicit action.

## Phrase review and Jam Doctor — `GN-DOCTOR-*`

- **REQ-GN-DOCTOR-001 — Explicit review range:** WHEN a player requests a
  score-room review, Guitar Night shall assess the quantized A/B range when one
  exists; otherwise it shall name and assess one bounded four-beat range at or
  after the parked playhead. It shall run that range once and shall not blend
  loop repetitions into one take.
- **REQ-GN-DOCTOR-002 — Quiet assessed run:** WHEN a score-room review starts,
  its count-in shall remain audible, while the authored voice and exercise
  pulse shall remain silent. Score callbacks and the visible playhead shall
  continue on the same clock without making the room's own audio microphone
  evidence.
- **REQ-GN-DOCTOR-003 — Exact phrase boundary:** The assessed take shall pin the
  reference, track, complete tempo map, range, tempo, sample rate, and exact
  scheduled AudioContext start and end. Count-in evidence shall be excluded;
  the pitch-enrichment window may drain after the scheduled end, but completion
  shall retain the scheduler's exact end and the range shall remain half-open
  `[A, B)`.
- **REQ-GN-DOCTOR-004 — Evidence-gated measurements:** Jam Doctor shall expose
  timing consistency only from sufficient matched sample-exact attacks;
  absolute early or late timing only from a stored calibration with known,
  sufficiently narrow uncertainty; and pitch relationship only from
  clarity-qualified, monophonic aligned events. Every available metric shall
  retain the event and target identities that support it in memory.
- **REQ-GN-DOCTOR-005 — Honest unavailable states:** IF a take is silent,
  partial, truncated, coarse-clock, uncalibrated, variably calibrated, noisy,
  clipping, polyphonic, too sparse, or too fast for the validated microphone
  path, THEN the affected metric shall be unavailable with a concrete reason.
  Attack completeness, sustain, pitch center, and pitch stability shall remain
  unavailable until articulation, release, or continuous-pitch evidence exists.
- **REQ-GN-DOCTOR-006 — Minimal diagnostic state:** WHILE Listening is active,
  Jam Doctor shall add no live diagnosis beyond the heard-note and input-health
  state. A separate compact live score may appear under `GN-SCORE-*`, but a
  completed diagnostic take shall announce only one compact `Take ready` cue
  and shall not open its full review automatically.
- **REQ-GN-DOCTOR-007 — One-action recovery:** Every completed phrase review
  shall identify one primary issue or supported success and one direct action.
  Replay, slowdown, shorter-range, and range-selection actions shall restage the
  exact promised range; calibration recovery shall complete calibration before
  returning to the same review range.
- **REQ-GN-DOCTOR-008 — Stage-owned sheet:** Opening or closing Jam Doctor shall
  not change stage dimensions, transport state, playhead, loop, microphone
  ownership, or AudioContext count. Desktop shall use a fixed stage faceplate;
  mobile shall use a bounded bottom sheet. Escape shall close the sheet and
  return focus to its trigger.
- **REQ-GN-DOCTOR-009 — Compact local history:** Guitar Night may persist at
  most eight canonical scalar summaries containing range, tempo, evidence
  quality, provenance, counts, and available metric values. It shall not
  persist raw microphone audio, full input events, event IDs, or target IDs.
- **REQ-GN-DOCTOR-010 — Compatible comparison:** A/B take comparison shall be
  available only for complete, non-truncated takes of the same reference,
  track, exact range, tempo, playback rate, target count, clock provenance, and
  compatible evidence quality. Incompatible or unchanged summaries shall not
  produce a comparison claim.
- **REQ-GN-DOCTOR-011 — Free-play truth:** WHERE no authored range is attached,
  Jam Doctor may summarize signal-only facts such as heard note starts, clarity,
  and range, but shall state that beat and authored-note comparison was not
  performed.

## Configurable first win — `GN-FIRST-*`

- **REQ-GN-FIRST-001 — Versioned configuration:** The beginner intro shall be
  driven by a versioned `GuitarFirstWinConfig` rather than hard-coded
  component timings or notes.
- **REQ-GN-FIRST-002 — Configurable parameters:** `GuitarFirstWinConfig` shall
  define whether the intro is offered, tempo, count-in, timing tolerance,
  requested hit count, pass threshold, target string label, expected pitch,
  tuning assumption, percussion preset and variant list, tab-note sequence,
  phrase chunks, guide behaviour, enabled input fallbacks, completion actions,
  and schema version.
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
    percussionVariantPresets: string[]
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
    // ordered primary-action preferences; default starts with 'load-song'
    skipDestination: 'quick-jam'
    returnEntry: 'learn:first-win'
  }
  ```

  The default tuning shall be `[64, 59, 55, 50, 45, 40]`; a selected
  alternate tuning shall provide another six-value high-to-low MIDI array.
  The open-string step shall target string index `5` (`low E`) with frets
  `[0, 0, 0, 0]`. The tab step shall target string index `0` (`high e`) and
  shall offer the full phrase in readable chunks:
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
  and contain only values within `0..127`. Percussion variant configuration
  shall contain at most eight safe local preset identifiers; unknown identifiers
  shall resolve to the bundled default and shall never be treated as asset URLs.
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
- **REQ-GN-FIRST-009 — Explicit Room-mic risk:** First-run assessment shall
  preserve the player's Target, Backing, Click, and master-output choices rather
  than impose a silent mix. WHERE Room mic is listening, master output is above
  the silence floor, and any app audio is audible, the first scored take shall
  require the same explicit speaker-bleed acknowledgement as
  REQ-GN-SCORE-007. The experience shall recommend headphones without claiming
  that the browser detected them, shall not auto-mute the chosen mix, and shall
  not silently exclude evidence solely because speaker bleed may make the score
  inaccurate. Open-speaker scoring shall remain a user-accepted risk until
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
  a song without changing transport ownership. The first configured completion
  action shall be the primary handoff; Keep jamming and Try another riff shall
  open the full Guitar workspace until an in-room riff catalog exists.
- **REQ-GN-FIRST-013 — Versioned progress:** First-win progress shall persist
  `schemaVersion`, `flowVersion`, `configVersion`, status (`not-started`,
  `in-progress`, `completed`, or `skipped`), current step ID, attempts per
  step, completed step IDs, best absolute timing per step, last input kind,
  tuning, handedness, and self-reported tab familiarity.
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
    completedStepIds: string[]
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
- **REQ-GN-FIRST-015 — Stage-first lesson:** WHILE the first-win exercise is
  open, its 3D instrument shall own the flexible viewport; the short reading
  explanation shall overlay that stage, and progress plus the primary musical
  actions shall live in one bounded bottom deck. Opening intro adjustments
  shall not resize the instrument or introduce a nested document scroller.
  Flow shall show fret numbers for this tab lesson, and each accepted untimed
  fallback hit shall visibly advance to the next configured target.
- **REQ-GN-FIRST-016 — Default lesson progression:** WHEN the default
  open-string step passes, Guitar Night shall offer the configured one-string
  tab as the next lesson inside Guitar Night rather than route to the legacy
  workspace. The tab step shall present every configured fret in phrase order,
  retain the stage and quiet guide controls, and mark the flow complete only
  after the full phrase. A completed legacy one-step record shall migrate to
  this newly incomplete tab step without starting audio or capture.
- **REQ-GN-FIRST-017 — Opt-in practice loop:** WHEN the player enables `Loop`
  before starting a first-win groove, the current configured exercise shall
  repeat gaplessly on the same room clock until the player explicitly stops or
  leaves. A later lap shall not replay the count-in or recreate the audio graph.
- **REQ-GN-FIRST-018 — Earned progress while looping:** WHEN a looping player
  reaches the configured pass or completion threshold, the system shall persist
  that progress without stopping the groove. Each new lap shall reset only the
  visible lap markers and playhead; it shall not revoke a completed step.
- **REQ-GN-FIRST-019 — Tempo-free beat catalog:** First-win drum variants shall
  be data-only semantic hit patterns with no embedded tempo, audio ownership,
  arbitrary code, or asset URL. The room band shall render those patterns on
  its existing drum bus, leaving a stable preset boundary for a later approved
  soundbank renderer.
- **REQ-GN-FIRST-020 — Boundary-safe beat shuffle:** WHERE `Loop` and `Shuffle`
  are enabled, the next allowed beat shall be chosen only at a lap boundary,
  shall retain the take's snapshotted tempo, and shall avoid an immediate repeat
  while more than one variant is available. Choosing a beat directly shall take
  effect at the first lap boundary admitted to the Web Audio scheduling
  horizon after that choice, without interrupting the current lap.
- **REQ-GN-FIRST-021 — Loop timing integrity:** A looping assessed exercise
  shall map each newly scheduled target onto the performance clock with the
  configured timing tolerance. Enabling Loop shall not silently downgrade a
  timed microphone, interface, MIDI, keyboard, or touch attempt into an untimed
  completion path.
- **REQ-GN-FIRST-022 — Boundary-window ownership:** WHEN the timing tolerance
  admits an early hit for the next lap, that hit shall belong to the next
  iteration and its visible marker shall carry across the audible boundary. It
  shall not complete the previous lap or be erased when the next lap begins.

## Learn setlist and Note Hunt — `GN-LEARN-*`

- **REQ-GN-LEARN-001 — One calm setlist:** Guitar Night shall expose Learn as
  one restrained, stage-owned setlist rather than a grid, dropdown, or peer
  selector of legacy practice modes. First Steps, Note Hunt, Hear & Find, Echo
  a Phrase, and Shape Walk shall appear as focused rows in that same
  information architecture.
- **REQ-GN-LEARN-002 — Silent disclosure:** WHEN the Learn setlist opens from
  entry, a backing room, a score room, or another Learn activity, Guitar Night
  shall pause active playback or first-win percussion, preserve the parked room
  state, and shall not start or resume playback, capture, MIDI, count-in,
  analysis, audio contexts, or timers. Closing the setlist shall not resume
  them automatically.
- **REQ-GN-LEARN-003 — Continuation truth:** The first-steps row shall name
  whether it will Start, Resume, or Replay from versioned local progress.
  Returning from a Learn activity shall reopen the setlist at that activity,
  and closing the setlist shall restore focus to its invoking control when that
  control remains available.
- **REQ-GN-LEARN-004 — Physical-position identity:** Note Hunt shall ask the
  player to find every occurrence of one target pitch class inside an inclusive
  bounded fret range. It shall identify positions by exact string index and
  fret, preserve unison positions separately even when they share one MIDI
  pitch, and its host-neutral activity shall derive every cell from the tuning
  and capo supplied by its host. Guitar Night shall use the Learn session's
  active 4–8-string room or first-win tuning rather than silently replace it
  with a six-string default.
- **REQ-GN-LEARN-005 — Bounded neck lesson:** The default Note Hunt round shall
  use frets zero through four and shall never span more than six frets at once.
  Its stage shall expose only the interactive Neck projection, keep the neck as
  the dominant object, and present each declared 4–8-string position as a
  keyboard- and touch-operable control with string, fret, and mark state in its
  accessible name. The neck shall use one Tab stop with arrow-key navigation,
  and shall scroll every declared string into reach in short layouts.
- **REQ-GN-LEARN-006 — Honest pitch-only Listening:** WHERE the player
  explicitly starts Listening, room microphone, direct-interface, or MIDI
  evidence may say which pitch was heard but shall never mark or claim a
  physical string/fret position. WHEN the target pitch is heard, Note Hunt
  shall ask the player to select where it was played. A provisional event may
  become eligible after late pitch enrichment under its stable identity, but
  one input event shall contribute evidence at most once.
- **REQ-GN-LEARN-007 — Explicit input ownership:** Opening Note Hunt shall not
  request input access or create audio. Start Listening shall be the only audio
  capture action; an explicit MIDI profile or device action may request MIDI
  access under the established Guitar Night input contract. Stop, Back,
  Learn-setlist suspension, route deactivation, and disposal shall release the
  active listener, and recoverable cross-tab handoff shall reuse that shared
  input contract.
- **REQ-GN-LEARN-008 — Calm round feedback:** Correct selections shall retain
  their exact marks, while a wrong selection shall be identified without colour
  alone and shall not increase progress. Completion shall require every exact
  target position in the round and shall offer one primary `Find another note`
  action rather than starting the next round or a timer automatically. Starting
  another round shall reset the neck scroll and preserve keyboard focus on the
  new primary action.
- **REQ-GN-LEARN-009 — Versioned local resume:** Note Hunt may persist one
  compact local round containing `schemaVersion`, target pitch class, exact
  found position IDs, completed-round count, fret range, and a playable-tuning
  signature. A compatible round shall restore without starting audio, capture,
  MIDI, analysis, or a timer. Malformed, unsupported, different-range, or
  different-tuning progress shall reset safely rather than bind old marks to a
  new neck.
- **REQ-GN-LEARN-010 — Modal and responsive behavior:** The Learn setlist shall
  trap focus while open, close on Escape or an explicit Close action, and
  lock and restore background scroll while remaining a bounded sheet/dialog
  that does not resize the mounted stage.
  Learn-setlist and focused-activity actions shall retain at least 44 by 44
  CSS-pixel targets on supported phone and desktop layouts, and reduced motion
  shall remove their arrival animation without hiding state.
- **REQ-GN-LEARN-011 — Stable activity tuning:** WHEN Learn opens from a room,
  score, entry, or first-win lesson, Guitar Night shall snapshot the active
  room/reference tuning or the active first-win tuning for that Learn session.
  Every focused activity in that session shall receive the same instrument,
  string count, open pitches, labels, and capo. A later room tuning change shall
  apply only after the player returns from the focused activity, so a neck
  shall never change underneath an unfinished prompt.
- **REQ-GN-LEARN-012 — Hear & Find:** Opening Hear & Find shall create neither
  audio nor input capture. The player shall explicitly request one clean guide
  note before an answer is judged, then may answer by an exact neck position or
  optional pitch evidence. A physical unison that sounds the same target MIDI
  note shall be correct; pitch evidence shall not claim a physical position.
  The player may choose the bounded fret windows `0–3`, `0–5`, or `0–7`, and a
  correct answer shall offer an explicit next note rather than auto-advance.
- **REQ-GN-LEARN-013 — Echo a Phrase:** Opening Echo a Phrase shall stay
  silent and shall offer a three-, four-, or five-note major-key phrase derived
  from playable positions in the Learn tuning. The player shall explicitly
  request the phrase, then answer its pitches in order by neck or optional
  listening evidence. Replay shall preserve the current answer position. A
  wrong pitch shall pause at that one step and offer one explicit reference-note
  repair before continuing; no timer shall repair or advance the phrase.
- **REQ-GN-LEARN-014 — Shape Walk truth:** Shape Walk shall require an explicit
  major chord root and CAGED shape, label root, major-third, and perfect-fifth
  positions in text as well as colour, and sound a cell or the voicing only
  after an explicit action. It may apply standard CAGED geometry to a
  six-string guitar whose string intervals match standard tuning, including a
  capo or equal detune. For bass or changed string intervals, it shall explain
  the limitation and leave the active tuning untouched rather than draw false
  chord positions.
- **REQ-GN-LEARN-015 — Shared guide and lifecycle:** Hear & Find, Echo a
  Phrase, and Shape Walk shall route requested reference notes through the
  Guitar Night guide bus without a count-in or exercise pulse. Back, Learn
  suspension, route deactivation, activity replacement, and disposal shall
  stop scheduled guide audio and optional listening. Opening or returning to
  any Learn surface shall not resume either one automatically.

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
- **REQ-GN-SONG-008 — Visible local preparation:** WHEN the player selects a
  supported local audio file, Guitar Night shall show named preparation
  phases, determinate percentage where the pipeline provides it, an accessible
  indeterminate state otherwise, and actionable storage warnings or errors.
- **REQ-GN-SONG-009 — Cancellable preparation:** WHEN the player cancels an
  active preparation, replaces its source, or leaves the surface, Guitar
  Night shall abort the active work, cancel its durable session where
  appropriate, ignore late progress or completion, and never stage the
  cancelled result.
- **REQ-GN-SONG-010 — Silent preparation and staging:** WHILE Guitar Night
  checks, saves, separates, refreshes, or stages a local song, and WHEN that
  work completes or reuses an existing session, it shall not automatically
  start playback, listening, microphone, MIDI, count-in, analysis, or timers.
- **REQ-GN-SONG-011 — Completion refresh and exact staging:** WHEN local
  preparation completes or reuses a matching completed session, Guitar Night
  shall refresh the durable local catalog and then stage that exact session
  under a route-owned lease, updating its explicit session URL state without
  starting playback.
- **REQ-GN-SONG-012 — Stale-result protection:** IF an older preparation,
  catalog refresh, or hydration settles after a newer selection,
  cancellation, or route state change, THEN it shall not replace the newest
  selection, and any stale route-owned URLs shall be released.
- **REQ-GN-SONG-013 — Saved-stem recovery:** IF separation finishes and its
  stems are saved but catalog refresh or staging fails, THEN Guitar Night
  shall explain that the prepared song remains available in Prepared songs
  and offer a retry or reopen path without requiring separation to run again.
- **REQ-GN-SONG-014 — Duplicate-work avoidance:** WHEN the selected file
  matches a completed durable session, Guitar Night shall reuse it. IF the
  matching session is a recoverable active job, THEN Guitar Night shall report
  that state, hydrate its durable claim into the current tab, and reattach to
  it without submitting duplicate separation work.
- **REQ-GN-SONG-015 — Deliberate room handoff:** WHEN a prepared backing is
  staged, Guitar Night shall offer an explicit `Enter room` action. Entering
  the room shall configure the visible mix and transport without creating an
  audio context or starting playback; only the player's Play action may
  activate and begin audible audio.
- **REQ-GN-SONG-016 — Silent exit and true resume:** WHEN the player returns
  to Songs during activation, decoding, or playback, Guitar Night shall cancel
  any pending start or pause every active stem before hiding the room. WHEN
  the player re-enters the same staged session, its decoded buffers, mix, and
  parked playhead shall be retained rather than reconfigured from zero.
- **REQ-GN-SONG-017 — Unified local import:** The Songs surface shall expose
  one visible picker and one drag-and-drop well for supported audio, MIDI, and
  Guitar Pro files. Audio shall enter the durable preparation pipeline; MIDI
  and Guitar Pro shall enter the saved-score library. Importing on either axis
  shall preserve the other staged axis, accept one file at a time, explain
  unsupported input, and prevent an older score parse from attaching over a
  newer selection. Choosing or dropping a file shall not start playback,
  listening, capture, count-in, or an audio context.
- **REQ-GN-SONG-018 — Streamed-start readiness:** WHEN an oversized or
  speed-controlled backing uses media-element streaming, THEN cold Play and a
  playing seek shall keep the transport in its cancellable loading state until
  every usable stem has settled on the requested position and exposes a
  target-containing forward buffer sufficient for continuous playback. The
  buffer goal shall contract near the end of the recording, and newer Play,
  seek, Pause, Stop, source replacement, or disposal intent shall prevent an
  older warm-up from reopening audio.
- **REQ-GN-SONG-019 — Account-gated separation:** WHEN a signed-out player
  requests cloud guitar separation, THEN Guitar Night shall keep the song
  unchanged, charge nothing, and open its in-page account dialog from one
  `Sign in` action. WHEN authentication succeeds, THEN the room shall refresh
  account and credit truth before retrying that exact separation request. IF
  the signed-in balance is known to be insufficient, THEN it shall offer one
  styled `Get credits` action instead of submitting billable work.
- **REQ-GN-SONG-020 — Distinct percussion identity:** WHEN MIDI or Guitar Pro
  contains authored percussion, Guitar Night shall retain each supported GM
  articulation, velocity, track identity, and authored time outside the
  pitched-note score model. It shall never interpret a drum key as a guitar
  pitch or make percussion a live-score authority.
- **REQ-GN-SONG-021 — Percussion-only room:** WHEN a saved reference contains
  authored percussion but no playable pitched track, Guitar Night shall offer
  a backing-only free-play room instead of rejecting the reference. The room
  shall state that no guitar score or neck grading is active and shall retain
  one gesture-owned transport for the authored drums.
- **REQ-GN-SONG-022 — Readable mixed drum lane:** WHEN a saved reference mixes
  pitched and percussion tracks, the Sheet view shall expose each authored
  drum track as a separately hideable, non-scoreable GM reference lane while
  retaining a pitched track as the only eligible score authority.
- **REQ-GN-SONG-023 — Shared drum-player boundary:** WHEN an authored drum part
  starts, Guitar Night shall lazily acquire a drum player, schedule exact GM
  identity and velocity on the room AudioContext clock, and route each track
  through its live mute gate. A failed player activation shall abort the run
  without exposing a false Playing state; pitched-only rooms shall not load or
  construct this drum path.

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
  keep Highway/Grid/Tab/Neck as the visual priority. Primary controls shall be
  at least 44 by 44 CSS pixels, and secondary controls shall use
  safe-area-aware sheets without horizontal discovery scrolling.
- **REQ-GN-STAGE-006 — Accessible feedback:** Target, detected input,
  confidence, and judgment shall be distinguishable without colour alone, and
  canvas/3D output shall expose an accessible name and meaningful fallback
  summary.
- **REQ-GN-STAGE-007 — Motion and power:** WHERE reduced motion or a low-power
  fallback is active, room ambience and 3D motion shall reduce without hiding
  the current beat, next note, or performance result.
- **REQ-GN-STAGE-021 — Visible account access:** Guitar Night shall keep one
  account action in the top rail beside Room rather than hiding it inside room
  settings. A signed-in desktop player shall see their compact identity and
  available credits; signed-out state shall open the shared in-page account
  dialog instead of navigating away. At narrow widths the same action may
  collapse visually, but it shall retain a 44 by 44 CSS-pixel target and an
  explicit accessible name.
- **REQ-GN-STAGE-008 — Full-room topology:** WHILE a prepared song room is
  open, the entry faceplate shall not constrain it. A compact session bar,
  flexible musical stage, edge-to-edge pedalboard, and status rail shall fit
  inside the bounded first viewport at supported desktop and phone sizes.
- **REQ-GN-STAGE-009 — Truthful score time:** IF a verified tab or score is not
  attached, THEN the shared performance source shall expose no beat or tempo;
  Highway, Grid, Tab, and Neck shall remain useful in an explicit free-play
  state and shall not infer score time from backing seconds.
- **REQ-GN-STAGE-010 — Stage-first control disclosure:** WHILE a backing or
  score room is open, song identity, Back, the primary transport, and
  Highway/Grid/Tab/Neck shall remain immediately available. Band channels,
  loop marks, count-in, guide sound, and other setup shall use bounded
  stage-owned sheets rather than permanent rows that reduce the instrument.
  Those sheets shall overlay without changing stage dimensions and remain
  usable in portrait and short landscape viewports.
- **REQ-GN-STAGE-011 — Surface-owned 3D framing:** Guitar Night may supply a
  responsive starting and Reset camera, Velvet target scale, and arrival rail
  through the shared 3D adapter. Without those host overrides, the legacy
  Guitar renderer shall retain its existing camera and display defaults.
- **REQ-GN-STAGE-012 — Selectable shared projections:** Guitar Night shall
  default to `Highway`, mapping one visible lane to each declared instrument
  string and encoding fret position inside each target. `Grid` shall preserve
  the existing fret-axis projection. Switching either direction shall reuse
  the same mounted renderer, scene, camera, score, transport, and input state;
  the selected projection shall persist locally. The legacy Guitar host shall
  continue to default to `Grid` unless it explicitly opts into another
  projection.
- **REQ-GN-STAGE-013 — Authored instrument meaning:** WHERE the imported score
  supplies tuning, tuning name, capo, fingering, chord labels, or techniques,
  the reference adapter shall preserve that source meaning through the shared
  scene. The renderer may show simultaneous chord targets, bends, slides,
  hammer-ons, pull-offs, vibrato, palm mute, and let ring only when authored;
  it shall not infer labels or techniques from visual coincidence.
- **REQ-GN-STAGE-014 — Player-owned framing:** Guitar Night shall offer calm
  Flow, player-neck, full-neck, and phrase-focus camera presets. Automatic
  phrase framing shall yield immediately to pointer, touch, wheel, or keyboard
  camera input and shall resume only after an explicit Reset. Reduced motion
  shall snap camera changes instead of tweening them.
- **REQ-GN-STAGE-015 — Instrument preferences:** Guitar Night shall preserve
  right- and left-handed Highway, Grid, Tab, and Neck meaning; support declared
  4–8-string guitar/bass setups, alternate tuning, and capo; and keep Tab and
  a moving thirteen-fret Neck useful as fast non-canvas alternatives. View,
  handedness, and reduced-effects preferences may persist without changing the
  legacy Guitar host defaults.
- **REQ-GN-STAGE-016 — Bounded rendering cost:** The shared canvas shall cap
  its device-pixel ratio, observe actual surface size, reuse compiled score
  structure, and repaint from relevant scene/camera signals rather than run a
  permanent frame loop while paused. Reduced effects shall remove additive
  glow and shadow work without hiding the now-line, targets, techniques, or
  result identity.
- **REQ-GN-STAGE-017 — Player-placed tab preview:** WHERE a secondary authored
  part is available on a non-mobile stage, its preview shall provide explicit
  drag and horizontal-resize handles with pointer and keyboard equivalents.
  Placement shall persist per Highway/Grid/Neck view, remain within the stage,
  and never cover protected signal, camera, or gesture chrome. Width shall
  increase the visible upcoming beat window within a bounded range. On narrow
  viewports the preview shall use a stable non-draggable dock instead of
  introducing overflow or unsafe targets.
- **REQ-GN-STAGE-018 — Visible loop range:** WHERE an authored A or B mark is
  set, the elapsed-time rail and every time-bearing stage projection shall show
  its labelled boundary without colour being the only distinction. A complete
  range shall remain visible through Tab, Sheet, Highway, and Grid motion; Neck
  may use a compact range status because fret space is not a time axis. The
  elapsed rail shall keep the full-score seek mapping after B is set, offer an
  explicit focused boundary editor only when close marks need more room, and
  support pointer and keyboard boundary edits without pausing the ordinary
  rehearsal or moving its seek thumb unexpectedly.
- **REQ-GN-STAGE-019 — Adaptive moving Tab:** WHEN an authored score opens in
  `Tab`, Guitar Night shall choose one stable reading window from tempo and
  distinct onset density, keep that window within 1.75–10 beats, and offer one
  persisted Tab-only zoom from 75–300% through an accessible range, wheel input
  over the lanes, and a two-pointer pinch. New players shall begin at 125%.
  The same control cluster shall offer an independent persisted Compact/Large
  reading-distance presentation; Large shall increase note diameter and string
  cadence without changing the beat window, and shall remain bounded by the
  available stage for 4–8 strings and magnified text. Notes and visible A/B
  context shall share the exact same window. `Highway` and `Grid` camera
  framing shall remain unchanged, and free play shall not expose inert Tab
  reading controls.
- **REQ-GN-STAGE-020 — Dense-score work bounds:** WHILE a long authored score
  plays, Guitar Night shall preserve keyed moving-Tab note elements between
  animation frames, query precompiled score indexes rather than repeatedly
  sorting the whole reference, advance live-score judgments from a monotonic
  unresolved frontier, and avoid rebuilding immutable synthesis data for each
  scheduled note. The resulting views and judgments shall remain equivalent
  to the unindexed score contract.

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
