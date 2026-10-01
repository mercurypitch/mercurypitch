# The Singing Current: first moving course

The course reuses the reviewed floating-museum art and adds a separate moving
game mode. Merc travels forward through three lanes. The microphone stays open
after Start; staff notes fill as the player sings. Eight phrases progress from
a held note through higher/lower notes, two-note replies, a three-note arc and
the five-note Sunlit Steps finale. The default Learning run lasts 102.64 seconds plus
readiness, count-in and any checkpoint recovery.

## Where to edit it

- `packages/glass-game/src/runner/first-course-tuning.ts`: typed pace presets,
  target/cue timing, movement and breathing controls.
- `runner/first-course.ts`: one course builder, relative melodies, scoring
  tolerances and asset-profile catalogue.
- `runner/source.ts` and `source-parser.ts`: JSON-compatible source contract and
  validation. Compiler modules validate vocal spacing, lane paths, jumps,
  checkpoints and the bounded asset set before the game starts.
- `runner/game.ts`, `movement.ts`, `judge.ts`, `progress.ts`: deterministic
  simulation, capture-time pitch evidence and monotonic reward persistence.
- `browser/runner-session.ts`: one AudioContext clock, microphone lifetime,
  readiness/count-in, interruption and checkpoint recovery.
- `render/runner-*`: disposable presentation; it cannot award a hit or change
  the course collision geometry.

The melody is relative to the player's comfortable note. Range controls remain
within the course's certified range. Rendering speed does not determine singing
duration or progression. Loading draws the resident crack and shatter variants
once, restores their visibility and paints the genuine initial scene before
enabling play, so deferred GPU setup is paid before continuous judging.
Streamed targets start directly from their authored asset, without constructing
and discarding a procedural replacement first. Immutable crack outlines are
shared by bundle leases; per-target materials and animation remain independent,
and the final owner releases the shared geometry.
Completion and checkpoint recovery flush their final scene once even when
capture or input reaches the boundary before the pending animation frame.
References and backing are synthesized for this first course; they are not
newly recorded Merc singing performances.

## Chosen tradeoffs

| Choice                                  | Alternative considered                   | Reason                                                                                  |
| --------------------------------------- | ---------------------------------------- | --------------------------------------------------------------------------------------- |
| Three lanes and jump                    | Free steering and orbiting               | Keeps touch controls and approaching vocal targets readable.                            |
| One authored ending                     | An endless generator                     | Gives us a complete musical learning arc and testable recovery.                         |
| Silent backing inside protected phrases | Duck only after hearing the player       | Avoids playing the target through the speakers during its own assessment.               |
| Reviewed frost-and-gold score windows   | Small vases as every moving target       | Makes the staff visible as glass approaches. The new glassware has its own art terrace. |
| Exact missing-floor cuts                | Decorative gaps over an invisible runway | What the player sees matches the jump and landing geometry.                             |
| Instanced nearby chunks                 | Keep all 192 metres resident             | Bounds repeated draw/resource cost without reducing accepted model detail.              |
| Separate presentation ticks             | Render for every microphone callback     | Preserves immediate voice evidence while drawing only once per animation frame.         |

A missed note loses the combo and the missed pane becomes passable. A missed
jump offers checkpoint recovery. Finishing, singing stars, route pickups and the
portrait are separate. Replays keep best phrase grades and already collected
rewards, without granting duplicates.

## Access and test route

Development preview: `/glass-game/?layout=singing-current`.
Dev/CI comparisons add `&pace=current` or `&pace=learning`. Each trial has its
own save identity; release builds and `progression=earned` reject this override.
Normal journey access unlocks after First Light is complete. Development unlock
does not change release progression. The mini-game returns to the same journey.

1. Choose a comfortable note and use **Hear note** before Start.
2. Hold the readiness note. The four-beat count-in precedes movement.
3. Use left/right buttons or A/D, and Jump or Space. Lane change and jump work
   together on touch devices.
4. Sing approaching staff notes without pressing F. Leave room to breathe in
   the movement sections. The course teaches its two jumps away from singing.
5. Pause, background the app or disconnect the microphone; returning requires
   an explicit Resume and starts from a safe checkpoint.
6. Finish, inspect separate stars/pickups/portrait, then replay or return.

## Verification boundary

The shared-game suite, scoped typechecks and independent reviews cover the
simulation, browser session and presentation separately. Final-head CI results
are recorded on the pull request; physical-device acceptance remains separate.

Automated coverage includes compiler rejection, reproducible simulation at
30/60/120 Hz, stale/late voice evidence, silence, collision and missed-jump
recovery, rewards across replay, microphone interruption, cancelled asynchronous
work and GPU resource disposal. Browser checks use actual pointer/touch input
and PCM through the shared pitch detector, not fabricated target outcomes.
The full-course browser case keeps real PCM, capture timestamps, audio time,
pointer input, simulation, judging, result layout and persisted rewards while
substituting only the presentation module. It asserts the substitute is active
and receives the completed course snapshot. This prevents software-GPU scheduling
from turning an audio/control test into an emulator performance benchmark.
The other browser cases keep the real renderer while omitting pixel draws,
clears, multisample resolves and mipmaps. A separate real-GL streaming smoke
checks initial loading, chunk turnover and disposal without a wall-clock speed
assertion. No game timing threshold is widened for these checks.

Actual rendering is inspected separately with the real AMD/OpenGL path at fixed
desktop and phone viewports. The v5 hardware proof completed both full
90.88-second views with eight hits and 24/24 singing stars, collected the finale
portrait and reported no graphics errors or overflow. A post-terminal-fix phone
run repeated that result at v6. Raw screenshots and reports live in the synced
creative archive under `glass-adventure/song-runner/runtime-proof-v5` and
`glass-adventure/song-runner/runtime-proof-v6`.

Physical iPhone/Android frame pacing and speaker-to-microphone leakage still
require device testing. A browser screenshot and synthetic microphone cannot
establish those properties. The future TypeGPU renderer and endless-course
generator remain outside this delivery.

## R1: live pitch and glass response

During an approaching phrase, the compact staff panel shows **Target** and
**You**, with a live pitch rail. Fresh wrong input says **Sing higher** or
**Sing lower** and adds a rose double-dashed edge and arrow to the pane.
Accepted input says **Matched** and shows a continuous mint edge. Shape and
text carry the distinction as well as colour. Silence removes the actual-note
marker and returns the pane to neutral.

These are projections of the capture-time judge result, not another pitch
threshold. A bounded observation history keeps the newest eligible reading
visible when the fixed-step simulation trails a microphone capture. Readings
from the future, old notes, paused sessions and old epochs cannot light the
pane. Earned cracks persist, but new surface stress and tremor require fresh
accepted input. Retry clears presentation charge; retained checkpoint hits
remain completed. Reduced motion retains static edges and direction cues.

The pane edges use preallocated triangle strips, with no additional render
pass, texture or per-frame geometry upload. Their colours, 0.05m width,
0.72-second wrong-note pulse and 0.10-second completion pop live in
`render/runner-target-feedback-config.ts`. The display-only pitch rail spans
600 cents in `ui/runner-pitch-readout.ts`; changing it does not change the judge.

R1 verification: 58 focused judge/session tests, seven formatter tests and 39
renderer/vessel tests pass. Five compact viewport checks and a real-PCM
wrong/matched/silent/pause sequence pass. The full course passes all eight
phrases and 24 singing stars, with accepted labels asserted across sequential
notes, glides and the finale. Separate actual AMD/OpenGL checks at phone,
tablet and desktop sizes, including reduced motion, pass with no graphics
errors or post-start shader compilation. Raw evidence is in the synced
`glass-adventure/song-runner/r1-live-pitch-2026-10-01` archive. Physical mobile
frame pacing remains device verification.

## R2: Learning pace and comparison routes

Learning is the default: 84/96/104 BPM at beats 0/64/96, completing in
102.637363 seconds. The original 96/108/116 control remains available and
completes in 90.881226 seconds. Both use the same 160 beats, 192 metres, eight
phrases, four pickups, certified jumps, pitch tolerance and scoring profile.
The extra 11.756 seconds gives more reading and breathing time; sustained notes
also take longer, so physical-device singing feedback still matters.

Canonical revision 2 preserves completed status and known collected rewards
from revision 1. It deliberately discards old per-target quality receipts:
their absolute evidence durations were earned against shorter windows. Pace
trials use separate IDs and cannot replace canonical progress.

Verification: the focused runner domain passed 163 tests in 21 files, including
both tempo maps, checkpoint count-ins, protected music silence, full sessions
with 8/8 hits, 24 stars and all four pickups, both later recovery checkpoints,
and migration. Route tests cover dev/CI/release/earned gates. Four complete
real-renderer runs passed on AMD/OpenGL: original phone viewport, then Learning
phone, tablet and desktop viewports. All used real PCM through the detector,
real controls and isolated trial saves; all finished with eight hits and 24
stars and no page/WebGL errors. The automated browser route collected one of
four optional pickups; the deterministic session route covers all four.

Private proof archive: `song-runner/r2-pace-trials-2026-10-01` in the existing
Proton asset archive. It includes six beat-aligned screenshots per run, videos,
raw frame/draw receipts, source fixtures and hashes. The unthrottled desktop
GPU is not a native-device performance claim. Existing streaming created GPU
buffers/programs during the course; the art pass must avoid adding first-use
work and compare against this measured baseline. The 100,000-frame cap omits
late raw samples on the tablet/desktop runs; their finale screenshots, finish
assertions and error checks still completed. Phone raw samples cover the finale.
