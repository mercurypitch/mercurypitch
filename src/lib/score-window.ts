// ============================================================
// score-window — which part of a sung note counts toward its score
// ============================================================
//
// A real singer slides into a note: the first fraction of it is the approach,
// not the intent. Scoring the whole window (the only behaviour before 0.8.1)
// averaged that slide into the note's cents error, so a note sung dead-on
// after a normal approach still read as wide. The modes here trim the frames
// that are approach rather than note.
//
// Trimming is by frame count, not wall time: samples arrive once per animation
// frame for as long as the note is scored, so count is proportional to time
// and the window needs no timestamps.
//
// Kept dependency-free on purpose. Both the engine (@/lib/practice-engine)
// and the settings store import it, and practice-engine already imports from
// @/stores — a definition in either would put a cycle through the stores
// barrel. See docs/agent/MISTAKES.md on chunk cycles for why that is not a
// warning but a broken first paint.
//
// Tests: src/lib/score-window.test.ts.

/** Fraction of a note's frames a trimming mode drops from an end. */
export const SCORE_TRIM_FRACTION = 0.15

export const SCORE_MODES = ['full', 'settled', 'core'] as const

/**
 * 'full'    — every voiced frame counts, slide-in included.
 * 'settled' — the first 15% is not scored: the slide into the note.
 * 'core'    — the first and last 15% are not scored: the slide in and the
 *             release out. Bound to the Learning tier, whose singer is still
 *             finding notes rather than holding them.
 */
export type ScoreMode = (typeof SCORE_MODES)[number]

export const isScoreMode = (v: unknown): v is ScoreMode =>
  SCORE_MODES.includes(v as ScoreMode)

export interface ScoreModeInfo {
  id: ScoreMode
  label: string
  description: string
}

export const SCORE_MODE_INFO: Record<ScoreMode, ScoreModeInfo> = {
  full: {
    id: 'full',
    label: 'Strict',
    description: 'The whole note counts, the slide into it included.',
  },
  settled: {
    id: 'settled',
    label: 'Standard',
    description: 'The first 15% of each note — the slide in — is not scored.',
  },
  core: {
    id: 'core',
    label: 'Relaxed',
    description: 'The first and last 15% of each note are not scored.',
  },
}

/**
 * The frames of one note that its score is computed over, in order.
 *
 * `Math.floor` keeps short notes whole: below 7 frames (about 110 ms at
 * 60 fps) nothing is trimmed, because there is no meaningful slide to remove
 * from a note that brief — and a trimmed short note would be scored on almost
 * nothing. Even at 'core' the window keeps at least 70% of the frames, so it
 * can never be empty; the guard below is against a caller breaking that
 * invariant, not a reachable case.
 */
export function scoreWindow<T>(samples: readonly T[], mode: ScoreMode): T[] {
  if (mode === 'full' || samples.length === 0) return [...samples]
  const trim = Math.floor(samples.length * SCORE_TRIM_FRACTION)
  const start = trim
  const end = mode === 'core' ? samples.length - trim : samples.length
  return start < end ? samples.slice(start, end) : [...samples]
}
