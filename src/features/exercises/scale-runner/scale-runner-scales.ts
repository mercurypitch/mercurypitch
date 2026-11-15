// ============================================================
// Scale Runner's scales: the list it offers and a run's notes
// ============================================================
//
// One list serves the setup screen's Scale picker, the scale a launch may
// ask for (a lesson's slug, `scale` in slug-map.ts) and the notes a run
// asks the singer for, so the three cannot name different scales.

import { launchScale } from '@/features/practice-intelligence/launch-override'
import { getScaleDegrees } from '@/lib/scale-data'
import { EXERCISE_SCALE_RUNNER } from '../types'

/** The scales Scale Runner runs, in the order its picker lists them: each
 *  minor beside the natural one, and the minor pentatonic beside the major. */
export const SCALE_RUNNER_SCALES = [
  { value: 'major', label: 'Major' },
  { value: 'minor', label: 'Minor' },
  { value: 'harmonic-minor', label: 'Harmonic Minor' },
  { value: 'melodic-minor', label: 'Melodic Minor' },
  { value: 'pentatonic', label: 'Pentatonic' },
  { value: 'pentatonic-minor', label: 'Minor Pentatonic' },
  { value: 'chromatic', label: 'Chromatic' },
] as const

export type ScaleRunnerScale = (typeof SCALE_RUNNER_SCALES)[number]['value']

export type ScaleRunDirection = 'up' | 'down'

/** The picker's name for a scale ("Harmonic Minor" for `harmonic-minor`). */
export function scaleRunnerScaleLabel(scale: ScaleRunnerScale): string {
  return SCALE_RUNNER_SCALES.find((s) => s.value === scale)?.label ?? scale
}

/**
 * The scale a launch (a lesson's slug) asked Scale Runner to open on.
 * Undefined when no launch asked, or asked for a name that is not on the
 * list, so the setup screen keeps its own first choice.
 */
export function scaleRunnerLaunchScale(): ScaleRunnerScale | undefined {
  const asked = launchScale(EXERCISE_SCALE_RUNNER)
  return SCALE_RUNNER_SCALES.find((s) => s.value === asked)?.value
}

/**
 * The notes of one run in the order they are sung: the scale from
 * `baseMidi` up to its octave, or from the octave back down.
 *
 * Melodic minor comes down as the natural minor. Its raised sixth and
 * seventh belong to the way up, which is how it is sung and how Lesson 25
 * teaches it; run downward with them, it would be a different scale from
 * the one the lesson names.
 */
export function scaleRunNotes(
  baseMidi: number,
  scale: ScaleRunnerScale,
  direction: ScaleRunDirection,
): number[] {
  const degrees = getScaleDegrees(
    scale === 'melodic-minor' && direction === 'down' ? 'minor' : scale,
  )
  const notes = degrees.map((deg) => baseMidi + deg)
  // Close on the octave, but only if the scale definition did not already.
  // Every definition in scale-data does, so appending it unconditionally made
  // the run ask for the top note twice in a row; invisible when the target was
  // one flat line, obvious the moment the upcoming ladder drew it as two rungs
  // at the same pitch.
  if (notes[notes.length - 1] !== baseMidi + 12) notes.push(baseMidi + 12)
  return direction === 'down' ? notes.reverse() : notes
}
