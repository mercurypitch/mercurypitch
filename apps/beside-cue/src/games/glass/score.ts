// ============================================================
// Run scoring — how perfect was the run, per mode.
//
// Design (melody-levels.md §8, folded from the ear-training research):
// the score LEADS with a real unit — cents off target, milliseconds
// off the beat, first-try answers — because real units stay comparable
// across sessions and months. The research's rule is "never show a
// number your own difficulty adaptation pins in place"; these levels
// are static, so a run percent is honest here, and the real unit is
// the growth meter that keeps meaning later when difficulty adapts.
// Passing is a band, not a finish line — maff's 70–80% call, default
// passPct 75. Nothing is GATED by any of it yet: the score informs,
// the learning path builds on it later.
//
// Pure module: the engine collects a RunTally; everything here is
// arithmetic + localStorage for per-song-per-mode bests.
// ============================================================

import type { PlayMode } from './levels/compile'

/** The score section of JOURNEY_CONFIG (feel-overridable per level). */
export interface ScoreConfig {
  passPct: number
  greatPct: number
  bronzePct: number
  centsPerfect: number
  centsZero: number
  fallPenaltyPct: number
  listenWrongPenalty: number
}

/** What the engine collects while a melody level runs. Quality is
 * per node index (a Map so a retried note keeps only its last
 * attempt); the arrays feed the real-unit detail line. */
export interface RunTally {
  quality: Map<number, number>
  /** Sung modes: time-weighted mean |cents off| per completed note. */
  centsMeans: number[]
  /** Rhythm: signed ms off the beat per hit tap. */
  offsetsMs: number[]
  falls: number
}

export const emptyTally = (): RunTally => ({
  quality: new Map(),
  centsMeans: [],
  offsetsMs: [],
  falls: 0,
})

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v))

/** Sung note quality from its mean cents-off: centsPerfect¢ or tighter
 * is a 1.0, centsZero¢ is a 0, linear between. */
export const qualityFromCents = (
  meanAbsCents: number,
  S: ScoreConfig,
): number =>
  clamp01((S.centsZero - meanAbsCents) / (S.centsZero - S.centsPerfect))

/** Tap quality from its signed offset: on the beat is 1.0, the window
 * edge is 0. */
export const qualityFromOffset = (offMs: number, windowMs: number): number =>
  clamp01(1 - Math.abs(offMs) / windowMs)

export interface RunScore {
  /** 0–100, the run's perfection. */
  pct: number
  /** Inside the pass band (>= passPct). */
  passed: boolean
  /** >= greatPct — the polished run. */
  great: boolean
  /** The real-unit line ("about 12¢ off target", "median 21 ms…"). */
  detail: string
  /** The simple shareable grade (maff 2026-08-31): gold >= greatPct,
   * silver >= passPct, bronze >= bronzePct, below that just the units. */
  grade: 'gold' | 'silver' | 'bronze' | null
}

const median = (xs: number[]): number => {
  if (xs.length === 0) return 0
  const s = [...xs].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 === 1 ? s[m] : (s[m - 1] + s[m]) / 2
}

const mean = (xs: number[]): number =>
  xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length

/** The run summary, or null when the run had nothing scoreable
 * (classic journey/trials stages track no tally). */
export const computeRunScore = (
  mode: PlayMode,
  t: RunTally,
  S: ScoreConfig,
): RunScore | null => {
  const qs = [...t.quality.values()]
  if (qs.length === 0) return null
  const base = mean(qs) * 100
  const pct = Math.round(
    Math.min(100, Math.max(0, base - t.falls * S.fallPenaltyPct)),
  )
  let detail: string
  if (mode === 'rhythm') {
    const misses = qs.filter((q) => q === 0).length
    detail =
      t.offsetsMs.length > 0
        ? `median ${Math.round(median(t.offsetsMs.map(Math.abs)))} ms off the beat${
            misses > 0 ? `, ${misses} missed` : ''
          }`
        : `${misses} missed`
  } else if (mode === 'listen') {
    const first = qs.filter((q) => q === 1).length
    detail = `${first} of ${qs.length} first-try`
  } else {
    detail = `about ${Math.round(mean(t.centsMeans))}¢ off target${
      t.falls > 0 ? `, fell ${t.falls}×` : ''
    }`
  }
  const passed = pct >= S.passPct
  const great = pct >= S.greatPct
  const grade = great
    ? ('gold' as const)
    : passed
      ? ('silver' as const)
      : pct >= S.bronzePct
        ? ('bronze' as const)
        : null
  return { pct, passed, great, detail, grade }
}

// --- per-song-per-mode bests (device-local, like every other pref) ---

export const bestKey = (levelId: string, mode: PlayMode): string =>
  `beside-cue:games:best:${levelId}:${mode}`

export const readBest = (levelId: string, mode: PlayMode): number | null => {
  try {
    const v = Number(window.localStorage.getItem(bestKey(levelId, mode)))
    return Number.isInteger(v) && v > 0 && v <= 100 ? v : null
  } catch {
    return null
  }
}

/** Persist the run if it beats the stored best; returns the best. */
export const writeBest = (
  levelId: string,
  mode: PlayMode,
  pct: number,
): number => {
  const best = Math.max(readBest(levelId, mode) ?? 0, pct)
  try {
    window.localStorage.setItem(bestKey(levelId, mode), String(best))
  } catch {
    // the run score still shows; only the memory of it is lost
  }
  return best
}
