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

For the Conservatory, a beginner who settles the note, sings two comfortable
alternating sways and returns to the centre should reliably break the exhibit.
Brief detector dropouts should not erase a nearly completed valid gesture. The UI
must teach the actual gesture and never promise completion without a latched break.

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

- [ ] Reproduce beginner pitch traces and completion failures before changing rules.
- [ ] Implement bounded gap tolerance, an authored beginner range and reliable centre
      finish; retain fresh/confident evidence, intentional-cycle timing and one completion.
- [ ] Clarify the taught gesture, reference demonstration and finish cue.
- [ ] Compose an aspect-aware cinematic from real Merc/target bounds with wall checks.
- [ ] Preserve exploration state through input, cancellation, pause and full shatter.
- [ ] Focused judge/controller/camera tests and real keyboard/touch entry checks.
- [ ] Inspect compiled desktop/tablet/phone challenge and shatter screenshots.
- [ ] Shared/mobile typechecks, scoped formatting/lint and relevant host builds.
- [ ] Commit/push implementation and evidence; inspect exact-head PR CI.
- [ ] Mirror this checkpoint and future proposals to owner dotfiles.
- [ ] Owner real-microphone Conservatory acceptance and device camera playtest.

## Future work retained separately

- `REPLAY-DIFFICULTY-AND-LEVEL-STARS.md`: candidate profiles, default easy first
  visit, new tier evidence and migration of the current accuracy-star pilot.
- `CLOUDWAY-PLATFORM-TRIALS.md`: optional authored ice/moving/cracking route,
  camera/timer fairness and simulation requirements before Meshy production.
- `../platform-trials/v1/`: original three imagegen auditions and exact prompts.
