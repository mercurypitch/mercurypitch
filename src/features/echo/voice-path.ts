// ============================================================
// The voice's path through the sky: the ribbon's points, in plate places
// ============================================================
//
// Pure. The ribbon runs from the last star the voice lit to the column of
// the note it is singing now, its head at the voice's height (DESIGN-echo.md
// 1): what the singer sang since that star, spread evenly across the gap,
// so the stretch between two stars is the path the voice took. With no
// star lit yet in the phrase, it starts a little short of the first ring.
//
// Heights are on the stars' own scale (voiceV), so a voice on the note
// meets its ring; at a level that folds the octave the controller hands in
// the voice folded to the note's octave, as the engine hears it.

import type { PlatePoint } from './echo-geometry'
import { voiceV } from './sky-layout'

/** One voiced frame: its pitch (fractional MIDI) and whether it is on the note. */
export interface VoiceSample {
  readonly midi: number
  readonly filling: boolean
}

/** One point of the ribbon: a plate place, and whether it is on the note. */
export interface VoicePoint {
  readonly u: number
  readonly v: number
  readonly filling: boolean
}

/** At most this many points: a longer wait is thinned to fit. */
export const VOICE_PATH_POINTS = 120

/** Before any star is lit, the ribbon starts this far left of its ring, W. */
export const LEAD_IN_W = 0.08

/** Every `step`-th sample, always ending on the newest. */
function thinned(samples: readonly VoiceSample[]): readonly VoiceSample[] {
  if (samples.length <= VOICE_PATH_POINTS) return samples
  const step = samples.length / VOICE_PATH_POINTS
  const out: VoiceSample[] = []
  for (let i = VOICE_PATH_POINTS - 1; i >= 0; i--) {
    out.push(samples[Math.floor(samples.length - 1 - i * step)])
  }
  return out
}

/**
 * The ribbon from `from` (the last lit star, or null) to the column `toU`
 * of the note being sung, for the voice since that star.
 */
export function voicePath(
  samples: readonly VoiceSample[],
  from: PlatePoint | null,
  toU: number,
  midis: readonly number[],
): VoicePoint[] {
  if (samples.length === 0 || midis.length === 0) return []
  const shown = thinned(samples)
  const n = shown.length
  const points: VoicePoint[] = []
  if (from === null) {
    const fromU = Math.max(0, toU - LEAD_IN_W)
    shown.forEach((sample, i) => {
      points.push({
        u: n === 1 ? toU : fromU + ((toU - fromU) * i) / (n - 1),
        v: voiceV(sample.midi, midis),
        filling: sample.filling,
      })
    })
    return points
  }
  points.push({ u: from.u, v: from.v, filling: shown[0].filling })
  shown.forEach((sample, i) => {
    points.push({
      u: from.u + ((toU - from.u) * (i + 1)) / n,
      v: voiceV(sample.midi, midis),
      filling: sample.filling,
    })
  })
  return points
}
