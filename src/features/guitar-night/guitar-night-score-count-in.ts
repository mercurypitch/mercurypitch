// Guitar Night score count-in — one legal ladder for every Rehearse surface.
//
// The rail, voice controls and runtime all use these values. Keeping cycling
// here prevents a presentation component or command set from quietly growing
// a different count-in range.

export const GUITAR_NIGHT_SCORE_COUNT_IN_CHOICES = [0, 1, 2, 4] as const

export type GuitarNightScoreCountInBeats =
  (typeof GUITAR_NIGHT_SCORE_COUNT_IN_CHOICES)[number]

export const GUITAR_NIGHT_SCORE_MAX_COUNT_IN_BEATS =
  GUITAR_NIGHT_SCORE_COUNT_IN_CHOICES.at(-1) ?? 0

export function isGuitarNightScoreCountInBeats(
  value: number,
): value is GuitarNightScoreCountInBeats {
  return GUITAR_NIGHT_SCORE_COUNT_IN_CHOICES.some((choice) => choice === value)
}

export function nextGuitarNightScoreCountIn(
  current: number,
): GuitarNightScoreCountInBeats {
  const index = GUITAR_NIGHT_SCORE_COUNT_IN_CHOICES.findIndex(
    (choice) => choice === current,
  )
  return (
    GUITAR_NIGHT_SCORE_COUNT_IN_CHOICES[
      index < 0 ? 0 : (index + 1) % GUITAR_NIGHT_SCORE_COUNT_IN_CHOICES.length
    ] ?? 0
  )
}
