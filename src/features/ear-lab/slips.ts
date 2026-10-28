// ============================================================
// Where a run slipped: this run's misses as counts, never rates.
//
// The Ear Report ranks a lifetime of confusions by rate
// (lib/ear/confusion-report.ts). A plate has one run, a dozen
// answers at most, and a rate over two attempts would claim more
// than it knows; so it says what happened and how often: "Fa heard
// as Sol, twice". The native room's rated plate reads it.
// ============================================================

export interface Slip {
  expected: string
  answered: string
  count: number
}

/** The outcomes a run keeps: what was asked, what was answered. */
interface Answered {
  correct: boolean
  expected: string
  answered: string | null
}

/** Most frequent first, then in the order they first happened; at most
 *  `limit`. `nameOf` turns an id into the words the plate prints. */
export function runSlips(
  outcomes: readonly Answered[],
  nameOf: (id: string) => string,
  limit = 3,
): Slip[] {
  const order: string[] = []
  const counts = new Map<string, Slip>()
  for (const outcome of outcomes) {
    if (outcome.correct || outcome.answered === null) continue
    if (outcome.answered === outcome.expected) continue
    const key = `${outcome.expected}>${outcome.answered}`
    const found = counts.get(key)
    if (found) {
      found.count += 1
      continue
    }
    order.push(key)
    counts.set(key, {
      expected: nameOf(outcome.expected),
      answered: nameOf(outcome.answered),
      count: 1,
    })
  }
  return order
    .map((key, index) => ({ slip: counts.get(key) as Slip, index }))
    .sort((a, b) => b.slip.count - a.slip.count || a.index - b.index)
    .slice(0, limit)
    .map(({ slip }) => slip)
}

/** An identification run's outcomes, as the plate's slips. */
export function slipsOf(
  outcomes: ReadonlyArray<{
    expectedId: string
    answeredId: string
    correct: boolean
  }>,
  nameOf: (id: string) => string,
): Slip[] {
  return runSlips(
    outcomes.map((outcome) => ({
      correct: outcome.correct,
      expected: outcome.expectedId,
      answered: outcome.answeredId,
    })),
    nameOf,
  )
}
