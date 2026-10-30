// ============================================================
// Role chains — the industry-standard insert chain for each kind of track
// ============================================================
//
// A vocal, a bass and a drum kit need different things, so every role gets
// the chain an engineer would start from for that source, voiced for a clip
// already level-matched to REFERENCE_LUFS (auto-mix.ts adds that gain in
// front, a tone stage and the role's balance behind):
//
//   voice            fx-lab's vocal front end — 24 dB/oct low cut at 67 Hz,
//                    the dipper, mud and box cut only when loud, 2:1 character
//                    compression, nasal and harsh zones, air, a safety limiter
//                    — then a ducked quarter-note echo and a ducked plate.
//   backing-vocals   cut higher (150 Hz) and pulled back in the presence range
//                    so the lead sits in front, de-essed harder (stacked "s"
//                    sounds add up), compressed flatter, spread wide, more
//                    reverb.
//   acoustic-guitar  boom and mud out (dynamic at 180 Hz), string detail and
//                    air up, 3:1 with a slow attack that keeps the pick, a
//                    mono-safe Haas spread, a medium room.
//   electric-guitar  low end and fizz (11 kHz cut, dynamic 4 kHz) out,
//                    presence up, light 2:1 (amps already compress), a touch
//                    of drive, a wide Haas spread, a short room.
//   bass             subsonic cut, weight at 80 Hz, mud out, growl at 800 Hz,
//                    4:1, harmonic drive so it reads on a phone, mono.
//   piano            low-mid mud out, presence and air up, gentle wide-knee
//                    2:1, its own stereo image with a mono low end, a hall.
//   keys             cut to make room for bass and voice, gentle 2:1, wide,
//                    a dotted-eighth echo and a long reverb behind.
//   drums            a bus chain, not an instrument chain: kick weight, box
//                    cut, crack and air, transient attack up and ring down,
//                    cymbal harshness tamed when loud, 4:1 bus glue, parallel
//                    "New York" smash compression, tape, a mono kick, a short
//                    room, a safety limiter.
//   backing          an already-mixed track: a pocket cut at 2.8 kHz for the
//                    voice and light glue, nothing else.
//   other            a gentle all-rounder.
//
// Every effect has a stable id, so the mix macros (mix-macros.ts) and a live
// chain can change values without rebuilding anything.
//
// The voice's and the drums' safety limiters stay in the templates, and in
// every saved project, but a lane plays and exports without them
// (withoutSafetyLimiter): limiting happens once, on the master, which
// catches the sum. A lane limiter cost each of those lanes 10 ms of
// lookahead, and the slowest lane sets how soon every Play is heard.

import type { ChainSpec } from './chain-spec'
import type { EffectKind } from './effect-definitions'

/** The id of a role chain's own limiter, which lanes leave to the master. */
export const SAFETY_LIMITER_ID = 'safety'

/** A lane's chain as it plays and exports: without the role's safety limiter. */
export function withoutSafetyLimiter(spec: ChainSpec): ChainSpec {
  const kept = spec.effects.filter(
    (effect) => !(effect.id === SAFETY_LIMITER_ID && effect.kind === 'limiter'),
  )
  return kept.length === spec.effects.length ? spec : { ...spec, effects: kept }
}

export const TRACK_ROLES = [
  'voice',
  'backing-vocals',
  'acoustic-guitar',
  'electric-guitar',
  'bass',
  'piano',
  'keys',
  'drums',
  'backing',
  'other',
] as const

export type TrackRole = (typeof TRACK_ROLES)[number]

export const ROLE_LABELS: Readonly<Record<TrackRole, string>> = {
  voice: 'Lead vocal',
  'backing-vocals': 'Backing vocals',
  'acoustic-guitar': 'Acoustic guitar',
  'electric-guitar': 'Electric guitar',
  bass: 'Bass',
  piano: 'Piano',
  keys: 'Keys and synths',
  drums: 'Drums',
  backing: 'Backing track',
  other: 'Other',
}

const ROLE_ALIASES: Readonly<Record<string, TrackRole>> = {
  vocal: 'voice',
  vocals: 'voice',
  'lead-vocal': 'voice',
  guitar: 'acoustic-guitar',
  synth: 'keys',
}

export function isTrackRole(value: unknown): value is TrackRole {
  return (
    typeof value === 'string' &&
    (TRACK_ROLES as readonly string[]).includes(value)
  )
}

/** Any stored role, including the plan's original `guitar`, as a current one. */
export function normalizeTrackRole(value: unknown): TrackRole {
  if (isTrackRole(value)) return value
  if (
    typeof value === 'string' &&
    Object.prototype.hasOwnProperty.call(ROLE_ALIASES, value)
  ) {
    return ROLE_ALIASES[value]
  }
  return 'other'
}

/**
 * Where each role sits against the lead vocal once every track is
 * level-matched: a pop or rock balance to start from, which the track's own
 * level control then moves.
 */
export const ROLE_BALANCE_DB: Readonly<Record<TrackRole, number>> = {
  voice: 0,
  'backing-vocals': -7,
  'acoustic-guitar': -6,
  'electric-guitar': -6,
  bass: -4,
  piano: -6,
  keys: -8,
  drums: -2,
  backing: -3,
  other: -6,
}

export interface EffectDraft {
  readonly id: string
  readonly kind: EffectKind
  readonly params: Readonly<Record<string, number>>
}

export interface RoleTemplateOptions {
  /** The song's tempo; sets the vocal pre-delay and the echo times. */
  readonly bpm?: number
}

type Params = Readonly<Record<string, number>>

const fx =
  (kind: EffectKind) =>
  (id: string, params: Params): EffectDraft => ({ id, kind, params })

const eq = fx('eq')
const dyneq = fx('dyneq')
const compressor = fx('compressor')
const transient = fx('transient')
const saturation = fx('saturation')
const exciter = fx('exciter')
const stereo = fx('stereo')
const delay = fx('delay')
const reverb = fx('reverb')
const limiter = fx('limiter')

/** A note value in milliseconds: `beats` quarter notes at `bpm`. */
export function tempoMs(bpm: number, beats: number): number {
  return (60000 / Math.min(280, Math.max(40, bpm))) * beats
}

function band(
  id: string,
  frequencyHz: number,
  q: number,
  thresholdDb: number,
  timing: { readonly attackMs: number; readonly releaseMs: number },
  depth: { readonly ratio: number; readonly rangeDb: number } = {
    ratio: 2,
    rangeDb: 4,
  },
): EffectDraft {
  return dyneq(id, { frequencyHz, q, thresholdDb, ...depth, ...timing })
}

function voiceTemplate(bpm: number | undefined): EffectDraft[] {
  const sixteenth = bpm === undefined ? 80 : tempoMs(bpm, 0.25)
  // On the beat when the tempo is known; a short slap when it is not.
  const echo =
    bpm === undefined
      ? { timeMs: 120, feedback: 10 }
      : { timeMs: tempoMs(bpm, 1), feedback: 22 }
  return [
    eq('cleanup-eq', {
      lowCutHz: 67,
      lowShelfHz: 100,
      lowShelfDb: 1.4,
      lowMidHz: 402,
      lowMidDb: -1.5,
      lowMidQ: 1,
      highShelfHz: 4040,
      highShelfDb: 2.5,
      highCutHz: 19000,
    }),
    band('mud', 280, 1, -24, { attackMs: 25, releaseMs: 220 }),
    band('box', 520, 1.2, -27, { attackMs: 20, releaseMs: 200 }),
    compressor('character', {
      thresholdDb: -20,
      ratio: 2,
      attackMs: 15,
      releaseMs: 180,
      kneeDb: 6,
      makeupDb: 1.5,
    }),
    band('nasal', 1100, 1.2, -34, { attackMs: 18, releaseMs: 180 }),
    band('harsh', 7500, 0.8, -40, { attackMs: 8, releaseMs: 90 }),
    exciter('air', { frequencyHz: 4500, driveDb: 24, amount: 25 }),
    limiter(SAFETY_LIMITER_ID, { ceilingDb: -1, releaseMs: 100 }),
    delay('echo', {
      ...echo,
      pingPong: 35,
      lowCutHz: 300,
      highCutHz: 5000,
      mix: 9,
      duck: 70,
    }),
    reverb('space', {
      decayS: 2.35,
      preDelayMs: Math.min(120, Math.max(20, sixteenth)),
      damping: 45,
      lowCutHz: 180,
      highCutHz: 10000,
      mix: 16,
      duck: 60,
    }),
  ]
}

const BACKING_VOCALS: readonly EffectDraft[] = [
  eq('cleanup-eq', {
    lowCutHz: 150,
    lowMidHz: 300,
    lowMidDb: -2.5,
    lowMidQ: 1,
    highMidHz: 3000,
    highMidDb: -1,
    highMidQ: 0.8,
    highShelfHz: 9000,
    highShelfDb: 1.5,
    highCutHz: 18000,
  }),
  band('mud', 250, 1, -26, { attackMs: 20, releaseMs: 200 }),
  band(
    'harsh',
    6500,
    0.8,
    -40,
    { attackMs: 5, releaseMs: 80 },
    { ratio: 3, rangeDb: 6 },
  ),
  compressor('glue', {
    thresholdDb: -24,
    ratio: 4,
    attackMs: 10,
    releaseMs: 120,
    kneeDb: 6,
    makeupDb: 3,
  }),
  stereo('spread', {
    widthPct: 130,
    monoBelowHz: 150,
    haasMs: 18,
    haasAmount: 40,
  }),
  reverb('space', {
    decayS: 2.8,
    preDelayMs: 30,
    damping: 50,
    lowCutHz: 250,
    highCutHz: 9000,
    mix: 26,
  }),
]

const ACOUSTIC_GUITAR: readonly EffectDraft[] = [
  eq('cleanup-eq', {
    lowCutHz: 90,
    lowMidHz: 220,
    lowMidDb: -3,
    lowMidQ: 1.2,
    highMidHz: 4500,
    highMidDb: 1.5,
    highMidQ: 0.9,
    highShelfHz: 11000,
    highShelfDb: 2,
  }),
  band(
    'boom',
    180,
    1.2,
    -24,
    { attackMs: 15, releaseMs: 150 },
    { ratio: 2.5, rangeDb: 5 },
  ),
  compressor('dynamics', {
    thresholdDb: -22,
    ratio: 3,
    attackMs: 20,
    releaseMs: 150,
    kneeDb: 6,
    makeupDb: 2,
  }),
  stereo('spread', {
    widthPct: 100,
    monoBelowHz: 120,
    haasMs: 16,
    haasAmount: 35,
  }),
  reverb('space', {
    decayS: 1.5,
    preDelayMs: 20,
    damping: 50,
    lowCutHz: 200,
    highCutHz: 10000,
    mix: 14,
  }),
]

const ELECTRIC_GUITAR: readonly EffectDraft[] = [
  eq('cleanup-eq', {
    lowCutHz: 100,
    lowMidHz: 300,
    lowMidDb: -2,
    lowMidQ: 1,
    highMidHz: 2500,
    highMidDb: 1.5,
    highMidQ: 1,
    highShelfHz: 8000,
    highShelfDb: -1,
    highCutHz: 11000,
  }),
  band('fizz', 4000, 1.2, -30, { attackMs: 5, releaseMs: 80 }),
  compressor('dynamics', {
    thresholdDb: -18,
    ratio: 2,
    attackMs: 25,
    releaseMs: 150,
    kneeDb: 8,
    makeupDb: 1,
  }),
  saturation('drive', { driveDb: 3, toneHz: 9000, mix: 25 }),
  stereo('spread', {
    widthPct: 100,
    monoBelowHz: 150,
    haasMs: 22,
    haasAmount: 45,
  }),
  reverb('space', {
    decayS: 1.2,
    preDelayMs: 15,
    damping: 60,
    lowCutHz: 250,
    highCutHz: 8000,
    mix: 11,
  }),
]

const BASS: readonly EffectDraft[] = [
  eq('cleanup-eq', {
    lowCutHz: 32,
    lowShelfHz: 80,
    lowShelfDb: 1.5,
    lowMidHz: 250,
    lowMidDb: -3,
    lowMidQ: 1.2,
    highMidHz: 800,
    highMidDb: 2,
    highMidQ: 1,
    highCutHz: 9000,
  }),
  compressor('dynamics', {
    thresholdDb: -24,
    ratio: 4,
    attackMs: 20,
    releaseMs: 120,
    kneeDb: 6,
    makeupDb: 3,
  }),
  saturation('drive', { driveDb: 6, toneHz: 5000, mix: 35 }),
  stereo('spread', { widthPct: 0, monoBelowHz: 20, haasAmount: 0 }),
]

const PIANO: readonly EffectDraft[] = [
  eq('cleanup-eq', {
    lowCutHz: 50,
    lowMidHz: 300,
    lowMidDb: -2,
    lowMidQ: 1,
    highMidHz: 2500,
    highMidDb: 1,
    highMidQ: 0.8,
    highShelfHz: 10000,
    highShelfDb: 1.5,
  }),
  compressor('dynamics', {
    thresholdDb: -22,
    ratio: 2,
    attackMs: 30,
    releaseMs: 200,
    kneeDb: 10,
    makeupDb: 1.5,
  }),
  stereo('spread', { widthPct: 100, monoBelowHz: 100, haasAmount: 0 }),
  reverb('space', {
    decayS: 2.2,
    preDelayMs: 25,
    damping: 40,
    lowCutHz: 150,
    highCutHz: 12000,
    mix: 18,
  }),
]

function keysTemplate(bpm: number | undefined): EffectDraft[] {
  return [
    eq('cleanup-eq', {
      lowCutHz: 100,
      lowMidHz: 400,
      lowMidDb: -2,
      lowMidQ: 1,
      highShelfHz: 9000,
      highShelfDb: 1,
      highCutHz: 16000,
    }),
    compressor('dynamics', {
      thresholdDb: -22,
      ratio: 2,
      attackMs: 25,
      releaseMs: 200,
      kneeDb: 10,
      makeupDb: 1,
    }),
    stereo('spread', {
      widthPct: 125,
      monoBelowHz: 150,
      haasMs: 20,
      haasAmount: 25,
    }),
    delay('echo', {
      timeMs: bpm === undefined ? 375 : tempoMs(bpm, 0.75),
      feedback: 25,
      pingPong: 100,
      lowCutHz: 400,
      highCutHz: 4000,
      mix: 7,
    }),
    reverb('space', {
      decayS: 2.6,
      preDelayMs: 20,
      damping: 50,
      lowCutHz: 200,
      highCutHz: 10000,
      mix: 22,
    }),
  ]
}

const DRUMS: readonly EffectDraft[] = [
  eq('cleanup-eq', {
    lowCutHz: 30,
    lowShelfHz: 60,
    lowShelfDb: 2,
    lowMidHz: 420,
    lowMidDb: -3,
    lowMidQ: 1,
    highMidHz: 4000,
    highMidDb: 1.5,
    highMidQ: 0.9,
    highShelfHz: 10000,
    highShelfDb: 2,
  }),
  transient('punch', { attack: 25, sustain: -10 }),
  band('cymbals', 6000, 0.8, -32, { attackMs: 5, releaseMs: 80 }),
  compressor('glue', {
    thresholdDb: -18,
    ratio: 4,
    attackMs: 30,
    releaseMs: 100,
    kneeDb: 4,
    makeupDb: 2,
  }),
  // Parallel "New York" compression: crushed, then blended under the kit.
  compressor('smash', {
    thresholdDb: -30,
    ratio: 8,
    attackMs: 2,
    releaseMs: 80,
    kneeDb: 0,
    makeupDb: 8,
    mix: 30,
  }),
  saturation('tape', { driveDb: 4, toneHz: 16000, mix: 35 }),
  stereo('spread', { widthPct: 110, monoBelowHz: 120, haasAmount: 0 }),
  reverb('space', {
    decayS: 0.8,
    preDelayMs: 5,
    damping: 60,
    lowCutHz: 300,
    highCutHz: 9000,
    mix: 9,
  }),
  limiter(SAFETY_LIMITER_ID, { ceilingDb: -1, releaseMs: 60 }),
]

const BACKING: readonly EffectDraft[] = [
  eq('pocket-eq', {
    lowCutHz: 30,
    highMidHz: 2800,
    highMidDb: -1.5,
    highMidQ: 0.8,
  }),
  compressor('glue', {
    thresholdDb: -16,
    ratio: 1.5,
    attackMs: 30,
    releaseMs: 250,
    kneeDb: 8,
  }),
  stereo('spread', { widthPct: 105, monoBelowHz: 100, haasAmount: 0 }),
]

const OTHER: readonly EffectDraft[] = [
  eq('cleanup-eq', {
    lowCutHz: 40,
    lowMidHz: 350,
    lowMidDb: -1.5,
    lowMidQ: 1,
  }),
  compressor('dynamics', {
    thresholdDb: -20,
    ratio: 2,
    attackMs: 20,
    releaseMs: 180,
    kneeDb: 8,
    makeupDb: 1,
  }),
  reverb('space', {
    decayS: 1.6,
    preDelayMs: 20,
    damping: 50,
    lowCutHz: 200,
    highCutHz: 10000,
    mix: 14,
  }),
]

const FIXED_TEMPLATES: Readonly<
  Record<Exclude<TrackRole, 'voice' | 'keys'>, readonly EffectDraft[]>
> = {
  'backing-vocals': BACKING_VOCALS,
  'acoustic-guitar': ACOUSTIC_GUITAR,
  'electric-guitar': ELECTRIC_GUITAR,
  bass: BASS,
  piano: PIANO,
  drums: DRUMS,
  backing: BACKING,
  other: OTHER,
}

/** The role's processing, without the level-match, tone and balance stages. */
export function roleTemplate(
  role: TrackRole,
  options: RoleTemplateOptions = {},
): readonly EffectDraft[] {
  if (role === 'voice') return voiceTemplate(options.bpm)
  if (role === 'keys') return keysTemplate(options.bpm)
  return FIXED_TEMPLATES[role]
}
