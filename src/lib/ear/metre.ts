// ============================================================
// metre — Subdivide's bars.
//
// Five metres the drum kit plays two bars of: 3/4, 4/4, 5/4, 6/8
// and 7/8, each in two patterns so the same grouping is heard under
// a different backbeat. The accent is always on one — the kick — and
// the question is what the bar is. Onsets are steps on the metre's
// own grid: quarters for the /4 metres, eighths for /8.
//
// Pure. Nothing here plays a sound.
// ============================================================

import type { DrumVoiceId } from '@/lib/drum-voices'
import type { EarBankItem } from './banks'

export interface MetreId {
  beats: number
  /** The note value of a beat: 4 for quarters, 8 for eighths. */
  unit: 4 | 8
}

export interface MetreStep {
  /** 0-based step in the bar. */
  step: number
  voice: DrumVoiceId
  /** Beat one: louder, and the reveal's lamp. */
  accent?: boolean
}

export interface MetrePattern {
  itemId: string
  metre: MetreId
  steps: readonly MetreStep[]
  seed: number
}

export function metreName(metre: MetreId): string {
  return `${metre.beats}/${metre.unit}`
}

export const METRES: readonly MetreId[] = [
  { beats: 3, unit: 4 },
  { beats: 4, unit: 4 },
  { beats: 5, unit: 4 },
  { beats: 6, unit: 8 },
  { beats: 7, unit: 8 },
]

const K = 'kick'
const S = 'snare'
const H = 'hh-closed'
const R = 'sidestick'

function bar(
  itemId: string,
  metre: MetreId,
  voices: readonly DrumVoiceId[],
  seed: number,
): MetrePattern {
  return {
    itemId,
    metre,
    seed,
    steps: voices.map((voice, step) => ({
      step,
      voice,
      ...(step === 0 ? { accent: true } : {}),
    })),
  }
}

export const METRE_PATTERNS: readonly MetrePattern[] = [
  bar('metre:4-4:a', { beats: 4, unit: 4 }, [K, H, S, H], 900),
  bar('metre:3-4:a', { beats: 3, unit: 4 }, [K, H, H], 950),
  bar('metre:4-4:b', { beats: 4, unit: 4 }, [K, R, S, R], 1000),
  bar('metre:3-4:b', { beats: 3, unit: 4 }, [K, S, H], 1050),
  bar('metre:6-8:a', { beats: 6, unit: 8 }, [K, H, H, S, H, H], 1150),
  bar('metre:5-4:a', { beats: 5, unit: 4 }, [K, H, H, S, H], 1250),
  bar('metre:6-8:b', { beats: 6, unit: 8 }, [K, H, R, K, H, R], 1250),
  bar('metre:5-4:b', { beats: 5, unit: 4 }, [K, H, S, H, H], 1300),
  bar('metre:7-8:a', { beats: 7, unit: 8 }, [K, H, S, H, K, H, H], 1350),
  bar('metre:7-8:b', { beats: 7, unit: 8 }, [K, H, H, S, H, K, H], 1450),
]

/** The bank the controller rates over: the payload is beats and unit. */
export const METRE_BANK: readonly EarBankItem[] = METRE_PATTERNS.map(
  (pattern) => ({
    itemId: pattern.itemId,
    label: metreName(pattern.metre),
    name: metreName(pattern.metre),
    seed: pattern.seed,
    payload: [pattern.metre.beats, pattern.metre.unit],
  }),
)

export function patternOf(itemId: string): MetrePattern | undefined {
  return METRE_PATTERNS.find((pattern) => pattern.itemId === itemId)
}

/** The length of one step in ms at a quarter of `quarterMs`. */
export function stepMs(metre: MetreId, quarterMs: number): number {
  return metre.unit === 8 ? quarterMs / 2 : quarterMs
}
