// Archive notes — written placards, reference tones and judging share one range-safe calibrated target.

import type { PitchStepDefinition, PitchTargets } from '../contracts'

const NOTES = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B']

function validMidi(midi: number | undefined): midi is number {
  return midi !== undefined && Number.isFinite(midi) && midi >= 0 && midi <= 127
}

/** No inferred range: without two calibrated bounds, every glass uses the easy note. */
export function resolveArchiveNote(
  targets: PitchTargets,
  degree: 0 | 1 | 2,
): number | null {
  const comfortable = targets.comfortable
  if (!validMidi(comfortable) || ![0, 1, 2].includes(degree)) return null
  const { low, high } = targets
  if (
    !validMidi(low) ||
    !validMidi(high) ||
    low > comfortable ||
    high < comfortable ||
    low >= high
  )
    return comfortable
  const headroom = high - comfortable
  const intervals =
    headroom >= 7
      ? [0, 4, 7]
      : headroom >= 4
        ? [0, 2, 4]
        : headroom >= 2
          ? [0, 1, 2]
          : [0, 0, 0]
  return comfortable + intervals[degree]!
}

/** Resolve this exact authored step; consumers must not derive their own label or reference target. */
export function resolvePitchStepTarget(
  step: PitchStepDefinition,
  targets: PitchTargets,
): number | null {
  if (step.archiveNoteDegree !== undefined) {
    if (step.target !== 'comfortable') return null
    return resolveArchiveNote(targets, step.archiveNoteDegree)
  }
  const midi = targets[step.target]
  return validMidi(midi) ? midi : null
}

export function formatArchiveNote(midi: number): string {
  const rounded = Math.round(midi)
  return `${NOTES[((rounded % 12) + 12) % 12]}${Math.floor(rounded / 12) - 1}`
}
