// ============================================================
// Mercury Sing auto-open policy — when does the band join in?
// ============================================================
//
// Pure decision core, deliberately free of clocks, audio and UI: the engine
// feeds it (elapsedMs, fused candidate scores) every matcher tick and it
// answers "keep listening", "this song is arming" or — exactly once —
// "open". The rules, per docs/plans/mercury-sing.md M2:
//
//   open when the SAME candidate holds `score >= openThreshold` with at
//   least `minMargin` lead over the runner-up for `sustainMs`, and at
//   least `minMaterialMs` of singing has been heard.
//
// Sustain + margin + latch is what prevents the "picked 3 times" failure
// class by construction: one hot tick cannot open, a photo-finish between
// two songs cannot open, and once opened the policy never fires again.
// Scores are on the fused 0..1 scale (the engine normalizes the matcher's
// 0-100 confidence and blends lyrics in).

export interface ScoredCandidate {
  /** Stable identity — the karaoke session id. */
  id: string
  /** Fused melody+lyrics score, 0..1. */
  score: number
}

export interface AutoOpenPolicyOptions {
  /** Score the leader must hold. */
  openThreshold?: number
  /** Required lead over the runner-up (a lone candidate always leads). */
  minMargin?: number
  /** How long the leader must hold threshold+margin, in ms. */
  sustainMs?: number
  /** Minimum listening time before ANY open, in ms. */
  minMaterialMs?: number
  /**
   * A condition lapse no longer than this does not reset the sustain
   * clock — matcher confidence jitters at window boundaries, and one noisy
   * tick must not discard two seconds of held evidence. A leader CHANGE
   * always resets immediately; grace applies only to dips.
   */
  lapseGraceMs?: number
}

export interface AutoOpenSnapshot {
  /**
   * listening — no candidate is holding the bar.
   * arming    — `leaderId` is holding it; `armedFraction` fills 0..1.
   * open      — the decision, returned for exactly one report.
   * opened    — latched; the policy never opens twice.
   */
  kind: 'listening' | 'arming' | 'open' | 'opened'
  leaderId: string | null
  /** Sustain progress 0..1 (1 once `sustainMs` is held). */
  armedFraction: number
}

export interface AutoOpenPolicy {
  /**
   * Report the current fused scores at `nowMs` (monotonic ms since the
   * stage started listening). Order of `candidates` does not matter.
   */
  report(
    nowMs: number,
    candidates: readonly ScoredCandidate[],
  ): AutoOpenSnapshot
}

export const AUTO_OPEN_DEFAULTS = {
  openThreshold: 0.95,
  minMargin: 0.08,
  sustainMs: 2000,
  minMaterialMs: 6000,
  lapseGraceMs: 400,
} as const

/** One policy instance per listening session — create on stage open. */
export function createAutoOpenPolicy(
  options?: AutoOpenPolicyOptions,
): AutoOpenPolicy {
  const openThreshold =
    options?.openThreshold ?? AUTO_OPEN_DEFAULTS.openThreshold
  const minMargin = options?.minMargin ?? AUTO_OPEN_DEFAULTS.minMargin
  const sustainMs = options?.sustainMs ?? AUTO_OPEN_DEFAULTS.sustainMs
  const minMaterialMs =
    options?.minMaterialMs ?? AUTO_OPEN_DEFAULTS.minMaterialMs
  const lapseGraceMs = options?.lapseGraceMs ?? AUTO_OPEN_DEFAULTS.lapseGraceMs

  /** Candidate currently accumulating sustain, and since when. */
  let armedId: string | null = null
  let armedSinceMs = 0
  /** Start of an in-grace condition lapse, when one is running. */
  let lapsedSinceMs: number | null = null
  let openedId: string | null = null

  return {
    report(nowMs, candidates) {
      if (openedId !== null) {
        return { kind: 'opened', leaderId: openedId, armedFraction: 1 }
      }

      const sorted = [...candidates].sort((a, b) => b.score - a.score)
      const top = sorted[0]
      const second = sorted[1]
      const topQualifies =
        top !== undefined &&
        top.score >= openThreshold &&
        (second === undefined || top.score - second.score >= minMargin)

      if (topQualifies) {
        if (armedId === top.id) {
          // Holding — a running grace lapse is forgiven.
          lapsedSinceMs = null
        } else {
          // A new leader starts its own clock, even mid-grace: sustained
          // evidence only counts per-song.
          armedId = top.id
          armedSinceMs = nowMs
          lapsedSinceMs = null
        }
      } else if (armedId !== null) {
        lapsedSinceMs ??= nowMs
        if (nowMs - lapsedSinceMs > lapseGraceMs) {
          armedId = null
          lapsedSinceMs = null
        }
      }

      if (armedId === null) {
        return { kind: 'listening', leaderId: null, armedFraction: 0 }
      }

      const heldMs = nowMs - armedSinceMs
      // The open itself only fires on a tick where the leader qualifies —
      // never from inside a grace lapse.
      if (topQualifies && heldMs >= sustainMs && nowMs >= minMaterialMs) {
        openedId = armedId
        return { kind: 'open', leaderId: openedId, armedFraction: 1 }
      }
      return {
        kind: 'arming',
        leaderId: armedId,
        armedFraction: Math.min(heldMs / sustainMs, 1),
      }
    },
  }
}
