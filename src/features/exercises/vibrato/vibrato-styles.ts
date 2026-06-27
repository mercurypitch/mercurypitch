// ============================================================
// Vibrato styles — practice presets (slow/wide → fast/fine)
// ============================================================
//
// Healthy vibrato is ~5-7 Hz with an extent of roughly half a semitone to a
// semitone (±50-100 cents); below ~20 cents reads as a straight tone and above
// ~150 cents as a wobble (Journal of Voice; voicescience.org). Teachers build
// it by oscillating ~a semitone slowly, then speeding up — the swing narrows as
// it accelerates (Ramsey Voice, SingWise). These presets follow that
// slow/wide → fast/fine progression so a singer can pick where to train.

export type VibratoStyleId = 'slow' | 'medium' | 'fast'

export interface VibratoStyle {
  id: VibratoStyleId
  label: string
  /** One-line coaching hint shown next to the picker. */
  hint: string
  /** Accepted rate window (Hz) for scoring. */
  rateMin: number
  rateMax: number
  /** Accepted depth window (cents, 2×RMS measure) for scoring. */
  depthMin: number
  depthMax: number
  /** Sine-guide oscillation rate (Hz). */
  guideRateHz: number
  /** Sine-guide peak amplitude around the target note (cents). */
  guideDepthCents: number
}

export const VIBRATO_STYLES: Record<VibratoStyleId, VibratoStyle> = {
  slow: {
    id: 'slow',
    label: 'Slow & Wide',
    hint: 'Deliberate, wide swing — learn the motion first.',
    rateMin: 3,
    rateMax: 5,
    depthMin: 80,
    depthMax: 180,
    guideRateHz: 3.5,
    guideDepthCents: 85,
  },
  medium: {
    id: 'medium',
    label: 'Natural',
    hint: 'A balanced, singable vibrato.',
    rateMin: 4.5,
    rateMax: 6.5,
    depthMin: 40,
    depthMax: 90,
    guideRateHz: 5.5,
    guideDepthCents: 50,
  },
  fast: {
    id: 'fast',
    label: 'Fine & Fast',
    hint: 'Quick, subtle shimmer — the polished sound.',
    rateMin: 4,
    rateMax: 7,
    depthMin: 10,
    depthMax: 50,
    guideRateHz: 6,
    guideDepthCents: 30,
  },
}

export const VIBRATO_STYLE_ORDER: VibratoStyleId[] = ['slow', 'medium', 'fast']

// Default keeps the original accepted ranges (4-7 Hz, 10-50 cents) so existing
// behavior/tests are unchanged unless a style is explicitly chosen.
export const DEFAULT_VIBRATO_STYLE: VibratoStyleId = 'fast'
