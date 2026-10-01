# The Singing Current: first moving course

The course reuses the reviewed floating-museum art and adds a separate moving
game mode. Merc travels forward through three lanes. The microphone stays open
after Start; staff notes fill as the player sings. Eight phrases progress from
a held note through higher/lower notes, two-note replies, a three-note arc and
the five-note Sunlit Steps finale. The authored run lasts 90.88 seconds plus
readiness, count-in and any checkpoint recovery.

## Where to edit it

- `packages/glass-game/src/runner/first-course.ts`: authored course, tempo,
  relative melodies, movement, scoring tolerances and asset-profile catalogue.
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
