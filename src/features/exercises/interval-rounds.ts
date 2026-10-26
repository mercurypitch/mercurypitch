// ============================================================
// Interval rounds — a launch's own intervals, dealt one per round
// ============================================================
//
// A launch (a lesson's slug) may hand a drill its own intervals in place of
// the drill's pool. Interval Trainer and Drone Intonation deal such a list
// the same way, from this one draw: a run as long as the difficulty asks,
// an interval may come back, never twice running.

/** A Fisher-Yates shuffle of a copy. */
function shuffledCopy<T>(xs: readonly T[], random: () => number): T[] {
  const out = [...xs]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/**
 * A run's intervals on a launch's own list, one per round, in semitones
 * above the start note. They are dealt from shuffled bags of the whole
 * list, one bag after another, so no interval comes a second time before
 * every one has come once, and a run at least as long as the list plays
 * each of them. Inside a bag nothing repeats; where one bag meets the next,
 * an opener that matches the round before trades places with another of
 * its bag, so no interval comes twice running. A run shorter than the list
 * plays that many of them, each once, as a run on the pool does. A list of
 * one has nothing to alternate with, so it plays every round.
 */
export function drawIntervalRounds(
  intervals: readonly number[],
  rounds: number,
  random: () => number = Math.random,
): number[] {
  const distinct = [...new Set(intervals)]
  const drawn: number[] = []
  // Whole rounds only: the loop would never reach a count like 2.5.
  const total = Math.floor(rounds)
  if (distinct.length === 0) return drawn
  while (drawn.length < total) {
    const bag = shuffledCopy(distinct, random)
    if (bag.length > 1 && bag[0] === drawn.at(-1)) {
      const other = 1 + Math.floor(random() * (bag.length - 1))
      ;[bag[0], bag[other]] = [bag[other], bag[0]]
    }
    drawn.push(...bag.slice(0, total - drawn.length))
  }
  return drawn
}
