// ============================================================
// Glass — cross-visit baseline (spec §4): the last session's
// summary lives in localStorage so a returning singer sees an
// honest delta ("since Tuesday: lock +0.8s"). Mirrors the
// Voice Mirror baseline pattern; numbers only, never audio.
// ============================================================

const STORAGE_KEY = 'glass.baseline.v1'

export interface GlassBaseline {
  /** epoch ms of the run */
  at: number
  targetMidi: number
  /** 0 = the glass held that session */
  shatterRep: number
  bestLockMs: number
  /** Mean |cents| of the final rep (null: nothing voiced). */
  precisionCents: number | null
}

export function saveGlassBaseline(
  storage: Storage,
  baseline: Omit<GlassBaseline, 'at'>,
): void {
  try {
    storage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...baseline, at: Date.now() }),
    )
  } catch {
    // No storage — the delta just won't show next visit.
  }
}

export function loadGlassBaseline(storage: Storage): GlassBaseline | null {
  try {
    const raw = storage.getItem(STORAGE_KEY)
    if (raw === null || raw === '') return null
    const parsed = JSON.parse(raw) as Partial<GlassBaseline>
    if (
      typeof parsed.at !== 'number' ||
      typeof parsed.targetMidi !== 'number' ||
      typeof parsed.shatterRep !== 'number' ||
      typeof parsed.bestLockMs !== 'number'
    ) {
      return null
    }
    return {
      at: parsed.at,
      targetMidi: parsed.targetMidi,
      shatterRep: parsed.shatterRep,
      bestLockMs: parsed.bestLockMs,
      precisionCents:
        typeof parsed.precisionCents === 'number'
          ? parsed.precisionCents
          : null,
    }
  } catch {
    return null
  }
}

/**
 * A short, honest "since last time" line, or null when there is nothing
 * meaningful to say (first visit, or no comparable numbers).
 */
export function formatGlassDelta(
  previous: GlassBaseline,
  current: Omit<GlassBaseline, 'at'>,
): string | null {
  const parts: string[] = []
  const semis = current.targetMidi - previous.targetMidi
  if (semis !== 0) {
    parts.push(
      `target ${semis > 0 ? '+' : ''}${semis} semitone${Math.abs(semis) === 1 ? '' : 's'}`,
    )
  }
  const lockDelta = (current.bestLockMs - previous.bestLockMs) / 1000
  if (Math.abs(lockDelta) >= 0.2) {
    parts.push(`lock ${lockDelta > 0 ? '+' : ''}${lockDelta.toFixed(1)}s`)
  }
  if (current.precisionCents !== null && previous.precisionCents !== null) {
    const tighter = Math.round(previous.precisionCents - current.precisionCents)
    if (Math.abs(tighter) >= 3) {
      parts.push(tighter > 0 ? `${tighter}¢ tighter` : `${-tighter}¢ looser`)
    }
  }
  if (parts.length === 0) return null
  const when = new Date(previous.at).toLocaleDateString(undefined, {
    weekday: 'short',
  })
  return `Since ${when}: ${parts.join(' · ')}`
}
