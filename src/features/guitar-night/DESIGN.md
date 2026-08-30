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
- **Room clarity:** the Room drawer keeps the chosen photograph visible at
  four named stops from `Focused` to `Open`. The full 0–100% control uses fine
  2.5% steps; its open endpoint removes nearly all blur and veil while keeping
  one thin contrast layer behind stage copy. Catalog-authored light rooms keep
  a stronger faceplate pigment floor rather than asking the browser to guess
  image luminance.
- **Hierarchy:** one primary musical action and one secondary import action.
  These must not read as equal feature cards.

## First-viewport contract

The approved room remains visibly present. A single entry surface offers
`Start` and `Load a song`, under a heading that asks `Ready to practice?`. No
microphone, MIDI, audio, analysis, or timer starts on entry. A quiet
`Tune guitar` utility sits outside those two primary paths and likewise opens
without capture or sound. A chevron beside the heading returns to the Guitar
workspace.

## Interaction contract

- `Start` first makes four open low-E notes feel musical, then teaches a
  one-string tab phrase. Touch and keyboard work before any listening
  permission. The explicit count-in starts a local percussion pulse; progress
  and expert skip are versioned and stored locally.
- The first win is a room, not a lesson card: its short tab explanation floats
  over the shared stage, accepted free taps move the visible fret target, and
  progress plus the two musical actions stay in one bounded bottom deck.
- Loop is an opt-in rehearsal state, not another mode. It repeats the current
  practice gaplessly on the same clock while earned progress remains earned.
  One compact beat choice and an optional Shuffle action can vary the drums at
  lap boundaries without changing tempo, restarting the room, or turning the
  bottom deck into a sequencer.
- `Load a song` opens completed separation sessions already on this device or
  selects one new local audio file. A distinct durable guitar stem may be
  staged muted; a two-stem instrumental must say that guitar remains in its
  mix. Neither path starts playback.
- The return chevron in the entry heading preserves continuity by opening the
  current Guitar workspace during the incremental migration. It was a third
  entry button reading `I know my way around` until that wording turned a way
  back into a claim about the reader's skill.
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
this section was merged through
[#458](https://github.com/mercurypitch/mercurypitch/pull/458). Targeted parity
then added the Velvet tuner in
[#484](https://github.com/mercurypitch/mercurypitch/pull/484), unified local
audio, MIDI, and Guitar Pro entry in
[#487](https://github.com/mercurypitch/mercurypitch/pull/487), the Learn shelf
and exact-position Note Hunt in
[#492](https://github.com/mercurypitch/mercurypitch/pull/492), and the remaining
core Learn set in
[#494](https://github.com/mercurypitch/mercurypitch/pull/494).

- `Tune guitar` opens the same full-room preflight from entry, the prepared-song
  room, and the authored-tab room. Entry owns a temporary listener; mounted
  rooms reuse their existing listener, input lease, detector path, audio graph,
  and guide bus. Entry inspects browser permission silently, names a known
  first-use prompt `Allow microphone`, and otherwise keeps the action neutral;
  nothing requests capture or sounds until that action or a reference-string
  action.
- The tuner follows the current 4–8-string guitar or bass tuning, including
  source pitches and capo, and offers honest Room mic / Direct input routes. MIDI
  is never presented as a pitch measurement route. Automatic targeting remains
  gated to nearby open strings, while the gauge keeps edge direction from
  farther evidence instead of hiding the player's position. Selecting anywhere
  on a physical string tile chooses it and auditions its reference; the whole
  tile remains one dependable touch target.
- Opening Tune parks playback without resetting the backing mix, score position,
  or A/B loop. Reference sound and capture are mutually exclusive. A reference
  requested while the tuner is listening parks capture and restores it after
  the tone; changing Room mic / Direct input transfers that same explicit
  listening intent to the new route. An explicit Stop, Back, or Escape cancels
  any pending restart. Back or Escape restores the Tune trigger, and the hidden
  transport does not own Space while the tuner is open.
- Backing playback gates only its stems bus while parked, leaving the shared
  guide and monitor paths audible at the player's master level. Closing Tune or
  starting a reference also invalidates a pending cross-tab input handoff, so a
  late ownership result cannot start hidden capture. An active phrase review
  keeps Tune unavailable until its evidence has completed rather than silently
  discarding the take.
- The phone composition keeps the gauge, all open strings, and the primary
  listening action immediately available. Its idle dark-on-amber and active
  pale-on-signal states switch as complete contrast-safe pairs, including a
  pointer hover that remains latched after a touch. Secondary input and preset
  setup can scroll beneath sticky navigation and controls without horizontal
  overflow;
  every visible action remains at least 44px and reduced motion removes needle
  interpolation. Tuning choices float above the room without moving strings or
  controls; outside pointer and Escape close them first and restore their
  summary. Overlay focus is contained, mobile visual and keyboard order agree,
  and spoken pitch direction changes only after the reading remains stable.

- The first-win rhythm catalog is a small data-only seam over the existing room
  drum bus. Straight, Pocket, and Lift are tempo-free patterns today; future
  approved soundbank assets can replace their renderer without changing lesson
  configuration, loop state, progress, or the audio clock.
- First-win progress is deliberately self-marked today: touch and Space advance
  the target, and a running groove accepts a mark only inside the configured
  timing window and saves the closest absolute offset. It does not hear or
  validate the played pitch and does not present a performance score. Real
  microphone, interface, and MIDI assessment remains a later evidence slice.

- Learn opens as one protected-focus setlist over the existing room rather than
  reproducing the legacy practice-mode selector. Opening it pauses or suspends
  the current musical surface without starting guide audio, input capture, a
  count-in, or a timer; closing it restores the invoking control.
- Every focused Learn activity receives one immutable snapshot of the active
  room or first-win tuning. Note Hunt persists exact physical positions; Hear &
  Find accepts physical unisons or optional pitch evidence; Echo a Phrase waits
  for an explicit guide and repairs one missed note in place; Shape Walk labels
  root, major third, and perfect fifth only when the active six-string tuning
  truthfully supports CAGED geometry.
- Focused activities reuse the full-room Neck stage and one bounded bottom
  deck. Guide notes use the shared room bus only after an explicit action,
  optional Listening retains the existing mic/interface/MIDI ownership model,
  reduced motion preserves every state change, and desktop and phone actions
  retain 44-pixel targets.

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
  existing full-band pipeline. Signed-out requests stay in place and open the
  shared account dialog; successful authentication refreshes account and
  credit truth before retrying that exact session, while a known insufficient
  balance offers one `Get credits` action. Failure retains the original
  two-stem mix; completion refreshes and restages the exact upgraded session.
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
  tempo maps, tracks, Guitar Pro fingering, source tuning/name/capo, chord
  labels, and techniques are attached only when the saved representation
  really carries them; meter and sections are not claimed. MIDI notes without
  authored fingering are placed by the shared helper.
- Authored score beat time is derived from the tab room's canonical audio
  clock, never from render frames. Beat-to-seconds and seconds-to-beat mapping
  both use the complete persisted tempo map; changing the opening tempo scales
  the whole map instead of flattening it. A launched take pins its tempo map,
  targets, loop and exact boundary so an already scheduled click cannot drift
  away from the visible score. Master volume, click and per-part gain remain
  pop-free live controls. Count-in changes apply to the next launch; tempo,
  scored-track and input-route changes park at the exact visible beat, retain
  an earned partial result and release the pinned run for an explicit restart.
  Without a usable reference, the stage reports free play.
- A reference is either authored or measured. Authored notes come from a file
  and carry a real musical tempo. Measured notes are heard in one separated
  stem: they are evidence about this recording, already on its timeline, so they
  need no alignment step and are never presented as a tab or given a BPM
  readout. A measured reference states which stem it came from and how much of
  that stem produced confident notes.
- A measured reference also retains the exact backing-session identity that
  produced it. Staging a different recording detaches that evidence rather than
  carrying a truthful result onto the wrong song.
- Bass and guitar stems are both offered for measurement, and each is claimed
  for what it is. A bass stem is effectively monophonic, which is the case
  pitch detection handles well. A guitar stem holds however many guitars the
  mix contained and is often chordal, so its result is presented as evidence
  about the recording rather than as a tab to read.
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
  Audio buses instead of allocating the full decoded PCM footprint. A streamed
  cold start or forward seek keeps the Play control in its loading state until
  every usable stem has a target-relative forward window and has settled on one
  common position; near the end, that window contracts to the music remaining.
  Newer transport intent cancels an older warm-up. Unknown compressed formats
  use a conservative estimate; persisted duration is preferred when available.
  Pause, resume, pointer seeking, master volume, drift correction, and real
  per-stem mute controls follow that audio clock.
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
  `Highway` adapts that renderer to a six-string-style runway with fret numbers
  inside the targets; `Grid` preserves the original fret-axis composition.
  Both are projections of the same scene and remain in one mounted canvas, so
  switching keeps camera, score, playback and input state intact. The player's
  choice is stored locally. Guitar Night supplies its own translucent Velvet
  palette, direct mouse/touch camera, responsive entry/Reset framing, larger
  next target and truthful `NOW` rail without changing the legacy renderer
  defaults. Four calm camera presets include phrase following that yields as
  soon as the player drags, wheels, touches, or uses the keyboard and resumes
  only on Reset. Left-handed Highway and Grid mirror their spatial projection;
  the moving thirteen-fret Neck reverses consistently; 4–8 strings, alternate
  tuning, and capo remain source-aware. Authored chords and bend, slide,
  hammer/pull, vibrato, palm-mute, and let-ring marks reach the stage without
  inferring technique from coincident notes. `Tab` and `Neck` remain fast,
  quieter alternatives. Moving Tab separates its persisted time window from a
  persisted Compact/Large reading-distance presentation: Large opens note size
  and string cadence toward the available stage without moving beat, playhead,
  or loop coordinates, and caps itself for 4–8 strings, short rooms, and
  magnified text. A song without an attached score exposes a nullable beat,
  says no tab is attached, and remains a useful free-play fretboard instead of
  deriving a fake beat from elapsed seconds.
- The canvas observes its actual bounds, caps its device-pixel ratio, reuses a
  compiled immutable score and queries only the visible time window. A paused
  room paints on scene or camera change instead of running a permanent frame
  loop. Reduced motion snaps camera changes, while reduced effects removes
  glow, shadows and additive compositing without removing musical meaning.
- The score-only room keeps Play, tempo and master volume visible. Its compact
  two-row pedalboard keeps Listening beside the timeline, then aligns the
  Backing/Target mix and speaker-risk note with the centred transport below.
  Play changes to Pause while the clock runs; pausing retains a separate End
  action so the held take can still settle into a grade. The rail reuses the
  same A/B marks, playback click, launch count-in and Tab-sound state as the
  restrained Session overlay, so routine rehearsal never requires reopening a
  sheet. Listening cycles through Off, Room mic, Direct input and MIDI while
  Session remains the place for an exact device. Count-in is one calm Off/1/2/4
  cycle rather than a fragile select; its non-Off choices share the playback
  click's active treatment and expose their pressed state. It cannot change
  after launch beats have already been queued, while the independent playback
  click remains live.
  Before Play, the stage rests just ahead of the first authored note so a long
  intro reads as intentional rather than broken. The score rail supports exact
  pointer, touch, and keyboard seeking through the authored tempo map. An idle
  seek remains silent and leaves setup editable; pausing an actual take pins its
  sound. Automatic resume after an active scrub continues without another
  count-in, while deliberate Play, Space, or voice-command resume runs the
  currently selected count-in before continuing from the parked beat.
  Completing B during ordinary playback immediately reschedules the pinned run
  at A with no second count-in; clearing the loop continues unlooped from the
  currently visible beat. The full-score seek map stays stable, while a separate
  explicit precision lens gives close A/B handles room. Tab, Sheet, Highway and
  Grid mirror the range as read-only musical context; Neck names it without
  pretending fret space is time. Input,
  instrument, tempo and scored-track changes park at that beat instead of
  resetting or presenting unexplained disabled controls. Per-part mute and solo
  remain live. Instrument and loop controls keep 44px targets. Account access
  remains a separate top-rail action beside Room: desktop shows the player name
  and credits, while tablet and phone widths retain one compact 44px action and
  its explicit accessible identity. Signed-out entry opens the shared auth
  dialog in Guitar Night's Velvet treatment rather than leaving the room.
  Studio and room-detail utilities stay in the Room drawer so the instrument
  keeps the viewport.
- Explicit Listening upgrades the next authored-score Play into one independent
  live-score take. Its quiet score latch extends the existing stage signal
  faceplate rather than adding a card, modal, arcade HUD, combo, or diagnosis.
  The active number is a recoverable last-16 note percentage, the completed
  number is cumulative, and the letter waits for four judged notes. V1 is
  deliberately notes-only: MIDI can prove chords and fast note messages, while
  microphone/interface chords and too-close notes are excluded. Listening never
  acts as a mix preset: compact Target and Backing controls retain their current
  state across Room mic, Direct input, and MIDI, while Click and per-track M/S
  remain independently live. Room mic plus nonzero master output and any audible
  Target, Backing, or Click is a known speaker-bleed risk. Before the first
  scored take with that risk in a mounted room, the player must explicitly
  continue knowing the score may be inaccurate, choose to mute room audio, or
  cancel. Browsers cannot reliably tell headphones from speakers, so the room
  warns from its known mix without claiming output-route detection. It never
  auto-mutes or silently excludes score evidence solely for that risk. Jam
  Doctor remains the separate quiet action for phrase evidence, explanation,
  and recovery.
- The top-level Score action opens a calm objective take ledger rather than a
  diagnosis dashboard. It shows the latest completed cumulative grade and
  scalar outcomes, may hold the current session's partial result without saving
  it, and keeps at most a bounded local history of completed takes. The ledger
  stores no raw input, event timeline or device identifier. Play again starts a
  fresh scored take; Review phrase remains the explicit bridge to Jam Doctor.
- A secondary authored part is a player-owned stage reference, not fixed
  chrome. On larger stages it has dedicated drag and horizontal-resize handles,
  keyboard equivalents, per-view placement and a bounded upcoming-note window.
  Its collision rules protect the signal faceplate, camera tools and orbit hint.
  Phones use a stable dock rather than a draggable layer.
- Jam Doctor is an on-demand overlay/sheet rather than normal-flow content, so
  opening it never collapses the instrument. Desktop, tablet, and phone
  regressions keep the stage and pedalboard in the first viewport, preserve
  44px controls, and wrap a six-part band without horizontal page or channel
  discovery scrolling.
- `Listening` is explicit and local. A compact Session/Band sheet offers Room
  mic, Direct input, and MIDI without requesting access until the player acts.
  The selected route and device persist independently; the active take records
  the device the browser actually opened, reports a saved-device fallback, and
  completes cleanly if that device disappears. A microphone held by another
  tab offers `Use it here` through the shared handoff instead of requiring a
  refresh. Audio routes reuse the room context without mutating the player's
  explicit Target, Backing, Click, master, or per-track mix, and run the existing
  guitar-range MPM detector. MIDI
  keeps per-voice attack/release identity and maps its high-resolution event
  timestamp onto the room clock while stating that route delay is unmeasured.
  The on-demand Jam Doctor stores no audio and makes no phrase, string, fret,
  latency, or quality claim that the evidence cannot support.
- Timestamped attacks are captured in an AudioWorklet and anchored to the
  shared audio clock; every browser-addressable input channel (up to Web
  Audio's 32-channel splitter limit) is inspected and the strongest intact
  channel is analyzed rather than assuming the guitar is on channel one or
  averaging channels that may cancel. Larger routes fail visibly with a routing
  action rather than silently truncating analysis. The coarse fallback
  identifies itself and preserves same-pitch restrikes without turning detector
  settling into a second note. Latency calibration is exclusive with playback
  and assessed Listening, is cancellable, and removes its scheduled clicks and
  temporary evidence when stopped or disposed.
- Eight deterministic synthetic fixtures cover a clean note, fast alternate
  picking, room noise, bend, slide, vibrato, chord onset and clipping. They
  report attack delay/misses/false attacks plus note and cents error only where
  ground truth is monophonic. A query-gated development export captures route,
  clock, aggregate health and event counts without audio or an event timeline;
  it labels a real-device run as user-captured and unverified.

## Where bars and beats come from

- There is one Standard MIDI reader in the tree. `parseMidiProject` decodes the
  format; `midi-song-from-project.ts` projects it down to the notes-on-beats
  view every reading surface consumes. A second, looser scanner used to sit
  beside it and quietly assumed common time. Two readers meant two answers for
  the same file, so it is gone.
- Bar lines come off the file, never off an assumption. Guitar Pro states a
  time signature on every master bar; a MIDI export carries whatever 0x58 meta
  events the exporter wrote; a measured stem carries none. `@/lib/midi-bars`
  turns whichever list exists into bars, and states common time only where the
  file said nothing.
- A bar's length is counted in quarter notes, the same unit note starts use, so
  a 6/8 bar is three beats long and not six. The last bar of a song keeps its
  full length even when the music stops inside it — cutting it to the notes it
  contains would space that bar twice as wide as every other and put the final
  note somewhere it is not.
- Signatures survive persistence alongside the tempo map. A score saved before
  the field existed simply has none, and reads as common time.
- Beats become seconds through `createBeatClock`, which walks the whole tempo
  map rather than holding the opening tempo. A measured reference is the one
  clock that is not musical: it counts a beat a second because that is the
  recording's own time, which is why a measured line and an authored score
  cannot share bar lines.

## A written part on a recording

- A measured line and a written tab count different things — seconds of a
  recording and musical beats — so they never shared a page. The stem
  measurement is what joins them: it is a transcription of this recording, so
  the windowed matcher can say where the written part lands against it.
- Hanging a written part on the recording produces a measured reference. One
  beat per second, no tempo shown, because once notes are pinned to a recording
  that speeds up and slows down there is no musical tempo left to claim.
- The offer refuses rather than guesses. At least one window has to align, and
  at least a quarter of the written notes have to be confirmed by the
  recording. A confidently wrong alignment reads to a player as their own
  timing being wrong, which is the worst failure this could have.
- The measure is recall against the written part, not precision against what
  was heard. A stem holds notes the tab never claimed, and that is not the tab
  being wrong.
- The alignment belongs to the pair, not to the score. It lives with the
  attached reference and is never written onto the saved score's tempo map: the
  score's tempo map is what the file says, and two recordings of the same song
  would fight over it.
- Changing instrument re-places the written part from the alignment already in
  hand. Choosing a neck never re-reads the audio.
- A reader can place a part by hand when nothing measured the recording. The
  gesture is the loop's gesture — play to a moment and say "here" — because the
  room already taught it, and the room is the only place that has the
  recording's clock to mark against.
- Two marks, the part's first note and its last, fix both where the part starts
  and how fast the recording runs against it. One mark alone is a constant
  shift, which is all one point can honestly claim.
- A hand placement carries no share of the part confirmed by anything, and is
  never given a made-up one. The two shapes are distinct in the type so the
  copy cannot print a 0% that means nothing.
- Coming back means going back to what the reader had: a part hung over a stem
  measurement returns to the transcribed line, one hung by hand on an attached
  tab returns to that tab on its own clock.

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

1. Finish the fast-input evidence gate with real-device browser checks,
   measured latency distributions, audio note-release/continuous-pitch
   evidence, a persisted high-resolution MIDI review contract, and a separately
   validated polyphonic path before publishing speed or quality claims.
2. Measure the upgraded string highway on representative mobile hardware, add
   stable screenshot baselines, and complete the final material/lighting pass.
3. Extend the shipped first-win loop into an input-assessed paced beginner
   progression and an approved soundbank catalog, then add professional band
   scenes, drummer controls, and take history without promoting them into
   first-viewport mode selectors.
4. Complete authored-score-to-recording alignment plus release and
   continuous-pitch evidence before adding sustain or intonation observations.
   The Lab already aligns a Guitar Pro score against a separated stem; the work
   left is lifting that out of the Lab, expressing an alignment as anchors, and
   persisting it against the session rather than editing the score's own tempo
   map.
5. Move the proved runtime lifecycle beneath the remaining legacy Guitar
   controls before an owner-approved cutover, then finish real-device art and
   performance tuning.
