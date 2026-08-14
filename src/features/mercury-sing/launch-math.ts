// ============================================================
// Mercury Sing launch math — where does the backing start?
// ============================================================
//
// Pure and separate from the engine so a sign flip here cannot ship green:
// the engine's other imports (audio, db) make it hostile to unit tests,
// and this one line of arithmetic is the difference between joining the
// singer and launching into the wrong minute.

/**
 * The backing starts this far BEHIND the singer's estimated position:
 * slightly early is forgiving (you re-enter on the phrase you just sang),
 * overshooting drops you mid-line. Tuned on device once M3 field data
 * exists; one constant on purpose.
 */
export const PRE_ROLL_SEC = 2.0

/**
 * Seek target for the handoff: where the matched excerpt STARTS in the
 * reference, plus how long the singer has been singing (they are that far
 * past the match start by now), minus the pre-roll. A null offset means
 * the matcher could not place the excerpt — launch from wherever singing
 * began, i.e. treat the start as 0.
 */
export const launchStartSec = (
  matchOffsetSec: number | null,
  sungDurationSec: number,
): number => Math.max(0, (matchOffsetSec ?? 0) + sungDurationSec - PRE_ROLL_SEC)
