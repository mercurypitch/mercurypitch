# Singing challenge camera and beginner sway polish

Owner playtest request: 2026-09-21. Current implementation work on draft PR #807;
no merge or release. Follow-up replay-star and platform-trial proposals remain
planning only, linked from `NEXT-MASTER-PLAN.md`.

## Expected behavior

When the player presses F or taps Sing, smoothly compose a low side/three-quarter
view of Merc and the actual target exhibit. Keep the mouth, vessel and full useful
shatter area above the instruction panel on desktop/tablet/phone. Preserve that
shot while requesting permission, calibrating, demonstrating and singing, and
through the shatter animation. Then smoothly return to the previous exploration
view. Cancel should return too; pause/background must not let motion race ahead.
Wall obstructions, tall portraits and the player's prior zoom/orbit need deliberate
handling. Existing manual movement, follow/orbit feel and challenge rules remain.
Review found that the core's 1.4-second shattering phase ended before the normal
vessel presentation's 0.1-second delay plus 2.2-second fragment flight. A shared pure timing
contract now holds input and camera ownership for the complete 2.3 seconds. Tests
verify the actual core phase, visible fragment lifetime and camera together.

For the Conservatory, a beginner who settles the note, sings two comfortable
alternating sways and returns to the centre should reliably break the exhibit.
Brief detector dropouts should not erase a nearly completed valid gesture. The UI
must teach the actual gesture and never promise completion without a latched break.

## Instruction and artwork polish added by the owner

Give the player one immediate action, with the explanation available when needed.
The singing panel is the scope; gallery artwork stories and long inspection text
remain intact. Do not shrink essential instructions until they are difficult to read.

| Surface                 | Compact intent                             | Longer explanation                                                                      |
| ----------------------- | ------------------------------------------ | --------------------------------------------------------------------------------------- |
| Example playback action | Hear example                               | The same label works for a hold, pair or wave; the lesson defines what plays.           |
| Recalibration action    | Change note / Change notes                 | Find a new comfortable target or pair; distinguish this from replaying the sound.       |
| Current singing goal    | A short instruction for the current step   | Explain the gesture, its finish and comfortable effort through a circular help control. |
| Finding/reference state | One clear next action or waiting cue       | Keep relevant guidance available without repeating a paragraph below every state.       |
| Error/retry state       | Explain the immediate problem and recovery | Do not conceal microphone failure or a required retry behind an optional tooltip.       |

The help control must work by touch, mouse and keyboard, with a meaningful accessible
name, an obvious close path and focus handling. Avoid hover-only explanations. Opening
help must not submit another attempt or play audio. At 320px the bottom action labels
stay on one line with useful touch targets; at larger font sizes accessibility wins
over forced clipping. Check hold, pair, wave, finding, reference and error states in
the real host. The camera observes the actual instruction area rather than guessing
from a fixed panel height.

For artwork inspection, a click/tap on the surrounding backdrop returns to the game.
Clicks on the portrait, story or controls inside the viewer stay inside it. Preserve
the existing explicit Return to gallery action, Escape behavior and focus return;
no artwork text or image is changed by this convenience.

## Evidence before the fix

The raw captured pitch subscription feeds the judge directly; successful judging
emits a synchronous game break event. The initial investigation found these causes
upstream of rendering:

- One fresh unvoiced/low-confidence frame resets all wave extrema, even though the
  hold lesson has a 150 ms dropout grace.
- The authored maximum excursion is 180 cents; a whole-tone sway around 200 cents
  is rejected. This is narrower than the reported beginner gesture.
- After enough alternating extrema, completion waits for exponentially smoothed
  pitch to reach a narrow half-minimum-excursion centre band. A singer can return
  to centre and stop before the filtered estimate reaches it.
- The exact reported transient 100% has not been reproduced from a steady judge
  snapshot. The old incomplete cap is 97.5% overall, displayed as 98%; do not claim
  percentage rounding alone caused the missing break.

## Checklist

- [x] Reproduce beginner pitch traces and completion failures before changing rules.
- [x] Implement bounded gap tolerance, an authored beginner range and reliable centre
      finish; retain fresh/confident evidence, intentional-cycle timing and one completion.
- [x] Clarify the taught gesture, reference demonstration and finish cue.
- [x] Compose an aspect-aware cinematic from real Merc/target bounds with wall checks.
- [x] Preserve exploration state through input, cancellation, pause and full shatter.
- [x] Focused judge/controller/camera tests and real keyboard/touch entry checks.
- [x] Inspect compiled desktop/tablet/phone challenge and shatter screenshots.
- [x] Compact singing labels, accessible detailed help and narrow-screen checks.
- [x] Artwork backdrop dismisses; portrait/story interaction and focus remain intact.
- [x] Shared/mobile typechecks, scoped formatting/lint and relevant host builds.
- [ ] Commit/push implementation and evidence; inspect exact-head PR CI.
- [x] Mirror this checkpoint and future proposals to owner dotfiles.
- [ ] Owner real-microphone Conservatory acceptance and device camera playtest.

## Future work retained separately

- `REPLAY-DIFFICULTY-AND-LEVEL-STARS.md`: candidate profiles, default easy first
  visit, new tier evidence and migration of the current accuracy-star pilot.
- `CLOUDWAY-PLATFORM-TRIALS.md`: optional authored ice/moving/cracking route,
  camera/timer fairness and simulation requirements before Meshy production.
- `../platform-trials/v1/`: original three imagegen auditions and exact prompts.
- `FRIENDLY-RIVALS-AND-RESONANCE-DUELS.md`: playful enemies, bubble sentries and
  singing races, with safe microphone timing and a recommended first NPC duel.
- `GAME-ASSET-QUALITY-AUDIT.md`: follow-up production audit and reusable playbook.

## Sway implementation checkpoint

Committed and pushed as `ba1e1dcb`, following the saved future proposals and concept
sheets in `aa8e2ace`. The authored Conservatory maximum excursion is now 225 cents,
so a whole-tone glide is accepted. Fresh unvoiced evidence has a 150 ms grace;
those gaps add no voiced gesture time. Long gaps, stale samples, implausible jumps
and out-of-range excursions still reset only the wave. Completion requires a
fresh return inside the 35-cent centre band after the alternating extrema and
minimum voiced time. Trailing silence cannot undo the persisted completion.
Conservatory content and tutorial revisions are now 2; prior cleared exhibits
remain saved.

Teaching: settle; glide above, below, above, below; return to the starting note.
Starting below also works. Two bends on the same side are not two full cycles.
A semitone each way is plenty; a whole tone each way is allowed. Take a breath
and retry if needed; the settled first step remains complete.

Evidence: the new synthetic regression failed before the fix (no completion),
as did the authored route with the old 180-cent bound. Focused judge/controller/
content tests pass (46 tests); full glass-game suite at this stage passes (489
tests in 68 files). A real browser oscillator PCM → YIN → voice controller → game
test passes, including a 75 ms dropout, incomplete 98% after the last extreme,
centre return, microphone shutdown and the saved fern exhibit. Physical microphone
and singer acceptance remain the owner's playtest.

## Camera review evidence

The first compiled 390 × 844 Conservatory finale proof caught actual side clipping:
combined projected X bounds were `[-1.102, 1.115]`. The museum wall prevented the
fixed side shot from pulling back enough. This is retained in
`../challenge-polish/v1/proofs/phone-framing-before.json`; the framing assertion is
not relaxed. Final room-constrained composition now passes at both phone sizes, including
expanded help at 320px; see the final capture receipt for the exact source versions.

Full-raster SwiftShader traversal was too slow for the initial proof timeouts.
The capture harness now suppresses only WebGL draw/clear calls during the controls-based
approach, then restores their original descriptors and full viewport before camera
composition and screenshots.
These are compiled UI/appearance proofs, not hardware performance measurements.

## Final implementation and review checkpoint

- `ba1e1dcb`: beginner sway completion.
- `1bf1c952`: initial cinematic camera.
- `63c01351`: friendly-rival and asset-audit proposals.
- `2fe9f8f5`: reviewed camera/portrait framing, shared full-shatter timing,
  compact instructions, accessible detailed help and artwork backdrop dismissal.
- `44d2ad5c`: final short finding/reference/hold headings and 320px state checks.

The normal shatter lifecycle is now shared between core and vessel rendering:
0.1-second anticipation plus 2.2-second fragment flight. Camera and input retain
ownership through the whole beat. Reduced motion keeps a restrained 0.45-second
visible effect; gameplay still uses the shared normal lock duration. The saved
exploration orbit returns after the beat or cancellation.

Local verification: 503 package tests across 70 files at the camera/shatter review;
16 controller tests and three real Chromium hold/pair/Conservatory flows after the
final copy pass. The broader focused checks include camera entry/full break/return,
artwork mouse/touch dismissal, help focus and whole-tone/dropout/centre completion.
Shared/mobile typechecking, scoped source lint/format, the actual `pnpm pr:validate`
command and both host production builds passed. CI remains the authoritative gate;
its exact remote result is recorded in the owner TASKS checkpoint, not inferred
from these local checks.

Compiled evidence and exact source/build/image receipts:
[`challenge-polish/v1`](../challenge-polish/v1/README.md). Desktop shard pixels use
a harness-controlled presentation clock after actual PCM success; they establish
appearance, not real-time timing. Phone/tablet final-copy views use actual mounted
panels; the tablet appearance capture uses reduced motion. All are software WebGL,
not measurements of physical-device speed or microphone fairness.
