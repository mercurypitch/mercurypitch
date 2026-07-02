// ============================================================
// Warmup steps — data for the guided vocal warmup
// ============================================================
//
// Standard vocal-pedagogy warmup blocks: relaxed breathing, gentle
// hums, lip trills, sirens, and a light ascending scale. A "pattern"
// (from a daily-routine segment or the exercise's own picker) selects
// which blocks run, so the routine warmup slots are actually guided
// instead of "warm up on your own".

export type WarmupStepKind = 'breath' | 'sing'

export interface WarmupStep {
  /** Short name shown large during the step ("Lip trills"). */
  name: string
  kind: WarmupStepKind
  /** One-line coaching instruction for the step. */
  instruction: string
  /**
   * For sing steps: semitone offsets relative to the singer's comfort note,
   * played as the reference melody before their sing-back window.
   */
  offsets?: number[]
  /** Sing-back / timer window in seconds. */
  seconds: number
}

export type WarmupPattern =
  | 'full'
  | 'gentle'
  | 'lip-trill'
  | 'sirens'
  | 'ascending-scale'
  | 'cooldown'

export const WARMUP_PATTERN_LABELS: Record<WarmupPattern, string> = {
  full: 'Full warmup',
  gentle: 'Gentle (breath + hums)',
  'lip-trill': 'Lip trills',
  sirens: 'Sirens',
  'ascending-scale': 'Scales',
  cooldown: 'Cool-down',
}

const BREATHING: WarmupStep[] = [
  {
    name: 'Breathe in',
    kind: 'breath',
    seconds: 4,
    instruction: 'Slowly through the nose, low into your belly.',
  },
  {
    name: 'Hold',
    kind: 'breath',
    seconds: 4,
    instruction: 'Hold gently — shoulders down and relaxed.',
  },
  {
    name: 'Breathe out',
    kind: 'breath',
    seconds: 8,
    instruction: 'Release on a slow, steady hiss: "sssss".',
  },
]

const HUMS: WarmupStep[] = [
  {
    name: 'Gentle hum',
    kind: 'sing',
    seconds: 6,
    offsets: [7, 5, 4, 2, 0],
    instruction: 'Hum the falling line softly — lips closed, feel the buzz.',
  },
  {
    name: 'Gentle hum',
    kind: 'sing',
    seconds: 6,
    offsets: [9, 7, 5, 4, 2],
    instruction: 'Again, a step higher. Keep it light and easy.',
  },
]

const LIP_TRILLS: WarmupStep[] = [
  {
    name: 'Lip trill',
    kind: 'sing',
    seconds: 6,
    offsets: [0, 7, 0],
    instruction: 'Loose lips, "brrr" up to the top note and back down.',
  },
  {
    name: 'Lip trill',
    kind: 'sing',
    seconds: 6,
    offsets: [2, 9, 2],
    instruction: 'One step up — keep the air flowing evenly.',
  },
]

const SIRENS: WarmupStep[] = [
  {
    name: 'Siren',
    kind: 'sing',
    seconds: 8,
    offsets: [0, 12, 0],
    instruction: 'Glide smoothly up an octave and back, like a slow siren.',
  },
  {
    name: 'Siren',
    kind: 'sing',
    seconds: 8,
    offsets: [12, 0, 12],
    instruction: 'Now start high, swoop down, and rise again.',
  },
]

const SCALES: WarmupStep[] = [
  {
    name: 'Five-note scale',
    kind: 'sing',
    seconds: 8,
    offsets: [0, 2, 4, 5, 7, 5, 4, 2, 0],
    instruction: 'Sing "mah" up and down the five notes, nice and even.',
  },
  {
    name: 'Five-note scale',
    kind: 'sing',
    seconds: 8,
    offsets: [2, 4, 6, 7, 9, 7, 6, 4, 2],
    instruction: 'Up a step — stay relaxed as it rises.',
  },
]

const COOLDOWN: WarmupStep[] = [
  {
    name: 'Soft hum down',
    kind: 'sing',
    seconds: 6,
    offsets: [7, 5, 4, 2, 0],
    instruction: 'Hum gently down the line, letting the voice settle.',
  },
  {
    name: 'Sigh it out',
    kind: 'sing',
    seconds: 6,
    offsets: [12, 0],
    instruction: 'A relaxed sliding sigh from high to low. Let everything go.',
  },
  {
    name: 'Breathe out',
    kind: 'breath',
    seconds: 8,
    instruction: 'One last slow exhale. Done — great session.',
  },
]

/** Resolve a routine/segment pattern string to a known pattern. */
export function normalizeWarmupPattern(
  pattern: string | undefined,
): WarmupPattern {
  switch (pattern) {
    case 'lip-trill':
    case 'sirens':
    case 'ascending-scale':
    case 'gentle':
    case 'cooldown':
      return pattern
    case 'free-sing':
    case 'humming':
      return 'cooldown'
    default:
      return 'full'
  }
}

export function buildWarmupSteps(pattern: WarmupPattern): WarmupStep[] {
  switch (pattern) {
    case 'gentle':
      return [...BREATHING, ...HUMS]
    case 'lip-trill':
      return [...BREATHING, ...LIP_TRILLS, ...HUMS]
    case 'sirens':
      return [...BREATHING, ...LIP_TRILLS, ...SIRENS]
    case 'ascending-scale':
      return [...BREATHING, ...HUMS, ...SCALES]
    case 'cooldown':
      return [...COOLDOWN]
    case 'full':
      return [...BREATHING, ...HUMS, ...LIP_TRILLS, ...SIRENS, ...SCALES]
  }
}

export function warmupTotalSeconds(steps: WarmupStep[]): number {
  // Sing steps also spend ~0.45s per reference note before the sing window.
  return steps.reduce(
    (sum, s) => sum + s.seconds + (s.offsets?.length ?? 0) * 0.45,
    0,
  )
}
