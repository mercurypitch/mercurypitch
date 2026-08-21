// ============================================================
// Exercise note tally — what "notes hit" counts, and on whose ruler
// ============================================================
//
// A run's note tally answers one question: of the notes this drill actually
// presented, how many did the singer land? It is a FACT about the take, and
// it is deliberately not an opinion.
//
// That distinction decides the threshold. A drill's 0-100 score is graded on
// a ruler the drill picks: `scoreSamples` uses 100 - cents*1.5, while
// staccato-precision and call-response divide their own slope by a difficulty
// factor. One score therefore means a different deviation per drill AND per
// difficulty, so a score threshold would silently make "hit" easier on an
// easy setting. The tally counts CENTS instead, at one fixed line for every
// run kind — Practice, Exercise, Challenge and Weekly alike.
//
// It is also not read from the singer's accuracy tier (Learning / Singer /
// Professional in settings-store). The tier is the singer's own ruler and it
// belongs on score and accuracy, which are theirs to calibrate. The tally
// feeds the Hundred/Thousand/Ten Thousand Notes badges, and a tier-relative
// count would award them faster for singing worse.
//
// Runs with no notes to count — a sustained pitch, a glide, a swell — report
// `0 / 0`, which every reader already treats as "no note data": see the
// `notesTotal > 0` guards in progress-view-model and progress-share-model.

import { CENTS_EXCELLENT } from '@/lib/practice-engine'

/**
 * A note counts as hit at 25 cents or better.
 *
 * `CENTS_EXCELLENT` is the line `centsToRating` already draws between 'good'
 * and 'okay' — a quarter of a semitone, which is "sang the right note"
 * rather than "sang it beautifully". Reusing it keeps one definition of
 * close-enough in the codebase instead of minting a second.
 */
export const NOTE_HIT_CENTS = CENTS_EXCELLENT

/**
 * Did this note land? `null` means nothing voiced was captured for it — no
 * evidence either way, which counts as a miss for the tally but must never
 * be confused with a measured 0 (see averageDeviationCents).
 */
export function isNoteHit(avgCents: number | null): boolean {
  return (
    avgCents !== null && Number.isFinite(avgCents) && avgCents <= NOTE_HIT_CENTS
  )
}

export interface NoteTally {
  notesHit: number
  notesTotal: number
}

/** No notes to count. The shape every untallied run reports. */
export const EMPTY_NOTE_TALLY: NoteTally = { notesHit: 0, notesTotal: 0 }

/**
 * Tally a run from its per-note deviations, one entry per note PRESENTED —
 * including the ones that captured nothing, which are misses, not absences.
 * Dropping them would let a singer who went quiet score 100%.
 *
 * The invariant `notesHit <= notesTotal` is not cosmetic: the worker's
 * `validateWrite` rejects a row that breaks it, and `saveSessionRecord`
 * swallows that 400 by design — so the whole run would bank nothing. No
 * record, no practice minutes, no streak, no badges.
 */
export function tallyFromDeviations(
  deviations: readonly (number | null)[],
): NoteTally {
  return {
    notesHit: deviations.filter(isNoteHit).length,
    notesTotal: deviations.length,
  }
}

/**
 * The tally a drill published in its metrics, or the empty one.
 *
 * Read defensively rather than trusted: metrics is a loose
 * `Record<string, number>`, and a payload carrying a hit count without a
 * total (or more hits than notes) fails the worker's evidence rule --
 * `saveSessionRecord` swallows that 400, so the run would bank NOTHING: no
 * record, no practice minutes, no streak, no badges. An unusable tally
 * degrades to "not measured", never to a lost run.
 */
export function noteTallyFromMetrics(
  metrics: Readonly<Record<string, number>> | undefined,
): NoteTally {
  const notesHit = metrics?.notesHit
  const notesTotal = metrics?.notesTotal
  if (
    notesHit === undefined ||
    notesTotal === undefined ||
    !Number.isInteger(notesHit) ||
    !Number.isInteger(notesTotal) ||
    notesHit < 0 ||
    notesHit > notesTotal
  ) {
    return EMPTY_NOTE_TALLY
  }
  return { notesHit, notesTotal }
}
