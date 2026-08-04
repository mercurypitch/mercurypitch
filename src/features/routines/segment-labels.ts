// ============================================================
// Segment labels — how a routine segment names itself in a list
// ============================================================
//
// A daily routine lists four segments, and two of them can be the same
// exercise in different clothes: the guided warm-up alone has six routines
// (Full warmup, Gentle, Lip trills, Sirens, Scales, Cool-down). Printing
// only "Warm-up" for all six makes a Sirens warm-up and a Lip-trill warm-up
// look like one thing listed twice.
//
// So the surfaces that list segments print two things: the exercise, and —
// when the exercise has modes — which mode. Kept here rather than in either
// list so Home and the sidebar panel cannot drift apart.

import type { ExerciseType } from '@/features/exercises/types'
import type { WarmupPattern } from '@/features/exercises/warmup/warmup-steps'
import { normalizeWarmupPattern } from '@/features/exercises/warmup/warmup-steps'
import type { RoutineSegment } from '@/features/routines/types'

/**
 * Chip-length names for the warm-up routines.
 *
 * Not `WARMUP_PATTERN_LABELS` — those spell themselves out for the picker,
 * where there is room ("Gentle (breath + hums)"). A chip sits beside a
 * duration in a 12px sidebar row, so it gets the head of the name only.
 */
const WARMUP_PATTERN_CHIPS: Record<WarmupPattern, string> = {
  full: 'Full',
  gentle: 'Gentle',
  'lip-trill': 'Lip trills',
  sirens: 'Sirens',
  'ascending-scale': 'Scales',
  cooldown: 'Cool-down',
}

/** Title-case an exercise slug for display: long-note → Long Note. */
export function exerciseLabel(type: ExerciseType | string): string {
  return type
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

/**
 * Which mode of the exercise this segment runs, or undefined when the
 * exercise has only one.
 *
 * Warm-ups and cool-downs are the only ones today; both read the same
 * `pattern` field, and cool-downs fall back to `mode` exactly as the
 * launcher in DailyRoutinePanel does.
 */
export function segmentVariantLabel(seg: RoutineSegment): string | undefined {
  const isGuidedWarmup =
    seg.type === 'warmup' ||
    seg.type === 'cooldown' ||
    seg.config.exercise === 'warmup'
  if (!isGuidedWarmup) return undefined
  return WARMUP_PATTERN_CHIPS[
    normalizeWarmupPattern(seg.config.pattern ?? seg.config.mode)
  ]
}
