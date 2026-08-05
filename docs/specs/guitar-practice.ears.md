# EARS Specification — Guitar Practice (legacy Guitar tab)

> **EARS** = Easy Approach to Requirements Syntax  
> Version: 2.0 | Date: 2026-08-05 | Scope: the implemented `/#/guitar`
> tab, not the planned standalone Guitar Night experience

**Status:** audited as-built contract. Sections 1–7 describe the observable
legacy implementation at this version. Section 8 records known limitations;
it does not claim that later Guitar Night work already exists.

**Source:** `src/lib/guitar/guitar-synth.ts`,
`src/lib/guitar/drum-machine.ts`,
`src/lib/audio-engine.ts`, `src/lib/practice-engine.ts`,
`src/features/guitar-practice/useGuitarPracticeController.ts`,
`src/contexts/GuitarContext.tsx`, `src/pages/GuitarPage.tsx`,
`src/components/guitar/GuitarFretboardCanvas.tsx`,
`src/components/guitar/GuitarFretboardModeTabs.tsx`,
`src/features/guitar-tab-3d/`, and the Guitar tab transition in `src/App.tsx`

**Tests (partial coverage):** `src/tests/guitar-synth.test.ts`,
`src/tests/drum-machine.test.ts`, `src/tests/guitar-practice.test.ts`,
`src/tests/audio-engine.test.ts`, `src/tests/mic-reconciliation.test.ts`,
`src/tests/guitar-context-lifecycle.test.tsx`,
`src/tests/guitar-tab-3d-projection.test.ts`,
`src/tests/caged-shapes.test.ts`, `src/tests/guitar-tuner.test.ts`,
`src/tests/transcription-trainer-state.test.ts`, and `src/e2e/guitar.spec.ts`

EARS keywords: **WHEN** (event), **WHILE** (state), **IF/THEN** (unwanted
behaviour), **WHERE** (optional feature), otherwise ubiquitous ("shall").

---

## 1. Note and voice model

### REQ-GP-001 — Acoustic plucked-string voice

**WHEN** `guitar-acoustic` is selected and the audio engine creates a note,
the system shall use the cached Karplus–Strong acoustic profile (damping
`0.995`, brightness `0.6`, pick position `0.18`, rendered ring `2.2 s`, level
`0.6`) followed by its body-resonance and high-frequency roll-off filters.

### REQ-GP-002 — Electric plucked-string voice

**WHEN** `guitar-electric` is selected and the audio engine creates a note,
the system shall use the cached Karplus–Strong electric profile (damping
`0.998`, brightness `0.85`, pick position `0.12`, rendered ring `2.8 s`, level
`0.45`) followed by overdrive, presence and cabinet filtering.

### REQ-GP-003 — Bass plucked-string voice

**WHEN** `bass` is selected and the audio engine creates a note, the system
shall use the cached Karplus–Strong bass profile (damping `0.996`, brightness
`0.3`, pick position `0.35`, rendered ring `1.8 s`, level `0.7`) followed by a
frequency-relative low-pass filter. The implemented bass voice is not the
additive oscillator recipe described by version 1.0 of this specification.

### REQ-GP-004 — String indexing and automatic fingering

**Ubiquitous:** Guitar string indices shall run high-to-low: `0` = high e
(`E4`, MIDI 64), `1` = B3 (MIDI 59), `2` = G3 (MIDI 55), `3` = D3 (MIDI 50),
`4` = A2 (MIDI 45), and `5` = low E (`E2`, MIDI 40). Automatic assignment
shall choose the valid `0..24` fret with the lowest fret number. A pitch below
the supported range shall clamp to open low E; a pitch above it shall clamp to
the high-e string at no more than fret 24.

### REQ-GP-005 — Guitar note adaptation

**WHEN** melody, MIDI or Guitar Pro items are adapted for Guitar practice,
the system shall produce notes with `id`, `midi`, `noteName`, `stringIndex`,
`fret`, `startBeat`, `duration` and `targetFreq`, plus optional `isBacking` and
`trackId`. **WHERE** an imported item supplies both `stringIndex` and `fret`,
the adapter shall preserve that authored fingering; otherwise it shall use
REQ-GP-004.

## 2. Drum machine

### REQ-GP-006 — Synthesized drum set

**Ubiquitous:** The drum machine shall synthesize eight shared Web Audio drum
voices without sample files: kick, snare, closed and open hi-hat, high/mid/low
tom, and crash.

### REQ-GP-007 — Patterns and presets

**Ubiquitous:** The drum machine shall hold one 16-step boolean pattern for
each of the eight voices. **WHEN** `basic-rock`, `funk`, `hip-hop`, `jazz`,
`latin` or `empty` is selected, it shall install a deep clone of that preset.

### REQ-GP-008 — Independent sequencer clock

**WHILE** the drum machine is playing, it shall advance one sixteenth-note
step every `60 / bpm / 4` seconds, wrap after step 15, and use `setTimeout`
with elapsed-time compensation. It currently owns this clock independently
of the Guitar song-practice controller.

### REQ-GP-009 — Drum controls

**WHEN** drum BPM or voice gain is changed, the system shall clamp BPM to
`40..300` and each gain to `0..1`. Direct audition shall trigger one voice
without changing the pattern or sequencer position.

### REQ-GP-010 — User-gesture audio activation

**WHEN** the Drum Machine panel's Play or voice-audition control is used, the
panel shall initialize the machine's own interactive-latency `AudioContext`
and initiate resume inside the originating gesture before starting or
triggering. The lower-level `start`, `playStep` and `trigger` methods shall
remain no-ops until `init()` has succeeded. **WHEN** the panel is unmounted,
it shall stop the transport before unsubscribing, including a start awaiting
resume. This activation is separate from `startGame()`.

## 3. Practice visualization

### REQ-GP-011 — Responsive Canvas 2D stage

**Ubiquitous:** `GuitarFretboardCanvas` shall render a device-pixel-ratio-aware
Canvas 2D stage, resize it with `ResizeObserver`, and stop its render loop when
its host reports that the Guitar surface is inactive.

### REQ-GP-012 — Side-scrolling string lanes

**Ubiquitous:** The practice stage shall show six horizontal lanes in the
high-to-low order from REQ-GP-004, a fixed playhead/target near the left edge,
and notes moving horizontally according to their distance from the current
beat. Note width, rather than a separate vertical tail, shall represent note
duration.

### REQ-GP-013 — Note and judgment rendering

**WHILE** notes are visible, the stage shall color unjudged notes by pitch,
render visible backing-track notes as non-scored translucent notes, and render
judgments as gold `perfect`, green `great`, blue `good` or red/ghosted `miss`
feedback. It shall expose note labels, fret badges, detected-pitch feedback,
score, combo and countdown/pause/finish overlays when applicable.

### REQ-GP-014 — Lane input

**WHEN** a pointer click or touch lands anywhere in a string lane, the canvas
shall pass that lane's string index to the practice controller and show
immediate lane feedback. The current stage does not have the bottom-only
"strum zone" specified in version 1.0.

### REQ-GP-015 — Three Guitar views

**Ubiquitous:** The Guitar page shall offer `Practice` (`hero`, the default),
`Fretboard` (`interactive`) and `3D`. The current 3D view shall reuse the
Canvas 2D perspective renderer and provide its Guitar HUD, transport,
transpose, rate, A/B loop, input-monitor and camera controls; it shall not be
represented as a new GPU renderer or Guitar Night stage.

## 4. Song practice controller

### REQ-GP-016 — State machine and configurable count-in

**Ubiquitous:** Song practice shall use `idle`, `countdown`, `playing`,
`paused` and `finished` states. **WHEN** play begins with loaded notes, the
controller shall use the shared configured count-in beat count; zero shall
start immediately. Countdown clicks shall use the audio engine metronome bus.

### REQ-GP-017 — Current timing authority

**WHILE** counting in or playing, the legacy controller shall derive its beat
from `performance.now()` inside a `requestAnimationFrame` loop. Practice rate
shall scale the playing beat, and seeking or rate changes shall re-anchor that
mapping. No requirement in this legacy specification claims sample-clock
authority or drum/song phase lock.

### REQ-GP-018 — Keyboard and lane scoring

**WHEN** the player uses keys `1..6` or `A/S/D/F/G/H` (mapped high e to low
E), or a canvas lane, the controller shall choose the nearest unjudged note on
that string within ±150 ms. It shall award `perfect` at ≤30 ms (100 points),
`great` at ≤75 ms (75 points), and `good` at ≤150 ms (50 points); a note that
ends more than 150 ms in the past shall miss, reset combo, and score zero.

### REQ-GP-019 — Detected-input scoring

**WHILE** microphone or MIDI input is active, one fresh articulation shall be
eligible to score at most one target. MIDI shall require the exact target MIDI
pitch; microphone detection shall accept the target pitch class across
octaves. Detected input shall be eligible from 150 ms before the note start
through 150 ms after the note end. Its judgment shall use absolute deviation
from the note start, clamped to 150 ms, and then apply the `perfect`, `great`
and `good` values from REQ-GP-018.

### REQ-GP-020 — Transport, seek and practice loop

**WHEN** practice is paused or seeked, sounding Guitar/backing voices shall be
stopped and subsequent playback shall continue from the retained beat. **WHERE**
a valid A/B region is enabled, the practice loop shall wrap to A and optionally
increase its playback rate by the configured step. A fresh `startGame()` shall
disable that practice-loop wrap and play the whole song; resuming paused
practice shall preserve the active loop.

### REQ-GP-021 — Automatic guide and backing playback

**WHILE** song practice is playing, each scored note shall trigger the selected
instrument once as it crosses the playhead. Other imported tracks may play as
backing unless muted; visible backing notes shall not be judged. A seek or loop
wrap shall reset per-note playback/judgment bookkeeping for the destination.

### REQ-GP-022 — Song and score-track changes

**WHEN** a new song is loaded, the controller shall stop and rewind, clear
score/combo/hit/playback state, reset transpose, rebuild score and backing
notes, and update total length. **WHEN** the scored track of the same imported
song changes, it shall reset scoring while retaining the current transport
position and play/pause posture.

## 5. Sources, tracks and page state

### REQ-GP-023 — Supported practice sources

**Ubiquitous:** The Guitar page shall accept a library melody, a saved MIDI
song, a MIDI import, or a Guitar Pro import/drop through the current import
pipeline. Empty or unsupported content shall not start a practice run.

### REQ-GP-024 — Imported track choices

**WHERE** an imported song contains multiple tracks, the player shall be able
to select the scored track, mute backing tracks and choose which non-scored
tracks are visible. Backing audibility/mute changes shall update the saved
MIDI-song record through the existing store; track visibility shall remain
in-memory only.

### REQ-GP-025 — App-lifetime continuity

**WHILE** the main MercuryPitch document remains mounted, the Guitar provider
shall live above the tab switch and retain the selected Guitar view, activity,
song and related in-memory state across a visit to another tab. This is
in-document continuity, not standalone route or cross-document continuity.

### REQ-GP-026 — Narrow-screen controls

**WHEN** the current Guitar page is narrow, page-level sound, view, import and
device choices shall be collected in its Options sheet. This requirement does
not claim the dedicated `100dvh` Guitar Night mobile composition.

## 6. Interactive fretboard activities

### REQ-GP-027 — Activity set

**Ubiquitous:** Fretboard view shall expose exactly these implemented activity
IDs: `explore`, `noteQuiz`, `earTraining`, `jam`, `melodyTranscription`,
`callResponse`, `cagedTrainer`, `chordProgression`, `singToFretboard`,
`transcriptionTrainer`, `adaptiveJam`, `tuner`, and `riffTracker`.

### REQ-GP-028 — Activity routing and owned resources

**WHEN** the active fretboard activity changes or the interactive Guitar
surface becomes inactive, the provider shall route fret input only to the
active activity and stop the timers, subscriptions, recording state or mic
claim owned by the activity being left. Tuner, Riff Tracker and
Sing-to-Fretboard shall share one automatic Guitar mic claim, independent of
the player's manual claim. A late mic acquisition shall follow the current
app-wide aggregate claims, so leaving one activity cannot stop a replacement
Guitar or non-Guitar owner. Stopping an activity tone shall also invalidate a
tone start still awaiting audio initialization or resume.

## 7. Legacy host cleanup

### REQ-GP-029 — Guitar tab deactivation

**WHEN** the main app leaves the Guitar tab, its single synchronous tab
transition handler shall stop non-idle song practice and the independent drum
machine, clear every Guitar mic claim and any legacy PracticeEngine claim
opened from the Guitar surface, and return the preferred capture device to the
system default. The global microphone shortcut shall route through the Guitar
controller while that tab is active. Pending drum activation or microphone
acquisition invalidated by the transition shall not restore a hidden active
state after it resolves. The current handler does not provide
standalone-document disposal.

### REQ-GP-030 — Provider/controller disposal

**WHEN** the Guitar provider is disposed, it shall dispose the drum machine
and its owned context, cancel activity resources, cancel controller animation
and detection loops, disconnect MIDI, unregister mic-loss/sentinel/run-guard
callbacks, and release Guitar-owned mic resources. It shall not close the
main app's shared audio engine.

## 8. Known limitations and migration gaps

These are observed boundaries of the legacy implementation, not features to
pretend are complete:

1. The drum machine owns an independent `AudioContext` and `setTimeout` clock;
   song Play/count-in/pause/seek/loop do not start, stop or phase-lock it.
2. Progression and Adaptive Jam pass chord quality through `selectedChord`
   without the selected root; CAGED owns a separate chord state that defaults
   to C. Shared highlights therefore do not carry complete chord identity.
3. Both Guitar canvases register separate `touchstart` and `click` handlers,
   so touch-generated click duplication is not ruled out by the current
   contract. The canvases also lack a semantic text alternative for their
   visual state.
4. A dormant left-handed display option is not evidence of an implemented
   left-handed Guitar workflow.

The planned standalone route, one-clock runtime, Velvet Rehearsal shell,
versioned beginner activation, room-band bass, separated-song accompaniment
and evidence-backed Jam Doctor are specified separately in
`docs/specs/guitar-night.ears.md`.
