// ============================================================
// The warm-up, authored
// ============================================================
//
// Every warm-up step is a Zen exercise. Not "will be" — is. The step list the
// runtime walks is derived from these definitions rather than hand-written
// beside them, so there is one place a warm-up is described and it is the
// place an admin can eventually publish to.
//
// That is the whole reason for the move. A hardcoded `WarmupStep[]` can only
// change by deploying; a `ZenExerciseDefinition` is versioned, validated by
// `validate-exercise.ts` and publishable. Half a move would have left the
// array alive for the other half and bought nothing.
//
// Three kinds of block appear here, and only the first existed before schema
// version 2:
//
//   pitch      hums, lip trills, sirens, scales — a tracker can hear these
//   amplitude  the hiss on the exhale — no pitch, but plenty of signal
//   breath     breathe in, hold — nothing to hear, and that is the point
//
// Every exercise runs at 60 BPM so that one beat is one second. The warm-up
// speaks in seconds ("hold for four"), and a tempo that makes the two the same
// number keeps the authored file readable next to the coaching it encodes.

import type { ZenExerciseDefinition, ZenExerciseTarget, } from '@/features/zen/types'
import type { WarmupPattern, WarmupStep } from './warmup-steps'

/** One beat, one second. See the note above. */
const WARMUP_BPM = 60

/**
 * Warm-ups transpose to the singer's comfort note before anything is sung, so
 * the authored root only has to leave room for the offsets above it.
 */
const WARMUP_ROOT_MIDI = 57

/**
 * A warm-up is not graded — the exercise reports participation, not accuracy.
 * The weights still have to be present and positive, so they lean towards
 * coverage and steadiness: showing up and holding on, rather than landing the
 * centre of every pitch.
 */
const WARMUP_SCORING = {
  pitchWeight: 0.4,
  coverageWeight: 0.35,
  steadinessWeight: 0.25,
  toleranceCents: 150,
} as const

// No `category` here: the enum is shared with the frozen version-one schema,
// so a warm-up gets the closest existing bucket rather than a new one.
const BASE = {
  version: 1,
  level: 'foundation',
  defaultTargetVisibility: 'on',
  defaultProgressCue: 'playhead',
  bpm: WARMUP_BPM,
  countInBeats: 2,
  defaultRootMidi: WARMUP_ROOT_MIDI,
  scoring: WARMUP_SCORING,
} as const satisfies Partial<ZenExerciseDefinition>

/**
 * Lay a melody across the loop, each note taking an equal share of it.
 *
 * A note stops a little short of the next one's start so the blocks read as
 * separate events rather than one long bar — the same 82% the Zen catalogue
 * uses.
 */
function melodyTargets(
  offsets: readonly number[],
  cue: string,
  loopBeats: number,
): ZenExerciseTarget[] {
  const slot = loopBeats / offsets.length
  return offsets.map((semitone, index) => ({
    id: `note-${index + 1}`,
    startBeat: Number((index * slot).toFixed(4)),
    durationBeats: Number((slot * 0.82).toFixed(4)),
    semitone,
    cue,
    showCue: index === 0,
  }))
}

/** Two glides that meet in the middle: up and back, or down and back. */
function sirenTargets(
  low: number,
  high: number,
  cue: string,
  loopBeats: number,
): ZenExerciseTarget[] {
  const half = loopBeats / 2
  return [
    {
      id: 'glide-out',
      startBeat: 0,
      durationBeats: half,
      semitone: low,
      endSemitone: high,
      cue,
      showCue: true,
    },
    {
      id: 'glide-back',
      startBeat: half,
      durationBeats: half,
      semitone: high,
      endSemitone: low,
      cue,
      showCue: false,
    },
  ]
}

/**
 * The twelve blocks a warm-up is built from.
 *
 * The three breathing steps that used to run separately are one exercise here.
 * They are one breath — in, hold, out — and splitting them restarted the
 * breathing shape twice in the middle of a single cycle. The total time is
 * unchanged; what changes is that the singer sees one continuous instruction
 * instead of three that interrupt each other.
 */
export const WARMUP_EXERCISES: readonly ZenExerciseDefinition[] = [
  {
    ...BASE,
    id: 'warmup-breath-cycle',
    category: 'tone',
    title: 'Settle the breath',
    summary: 'One slow cycle: in for four, hold for four, out for eight.',
    goal: 'Start from a low, unhurried breath rather than from the throat.',
    instructions:
      'In slowly through the nose, low into the belly. Hold gently with the shoulders down. Then release on a long, steady hiss — "sssss" — and let it run out evenly.',
    loopBeats: 16,
    targets: [
      {
        id: 'breathe-in',
        startBeat: 0,
        durationBeats: 4,
        semitone: 0,
        cue: 'Breathe in',
        showCue: true,
        kind: 'breath',
      },
      {
        id: 'hold',
        startBeat: 4,
        durationBeats: 4,
        semitone: 0,
        cue: 'Hold',
        showCue: true,
        kind: 'breath',
      },
      {
        id: 'hiss-out',
        startBeat: 8,
        durationBeats: 8,
        semitone: 0,
        cue: 'Sssss',
        showCue: true,
        kind: 'amplitude',
      },
    ],
  },
  {
    ...BASE,
    id: 'warmup-hum-low',
    category: 'tone',
    title: 'Gentle hum',
    summary: 'A falling five-note hum, lips closed.',
    goal: 'Find an easy buzz before asking the voice for anything.',
    instructions:
      'Hum the falling line softly — lips closed, feel the buzz on the front of the face.',
    loopBeats: 6,
    targets: melodyTargets([7, 5, 4, 2, 0], 'Mmm', 6),
  },
  {
    ...BASE,
    id: 'warmup-hum-high',
    category: 'tone',
    title: 'Gentle hum',
    summary: 'The same falling hum, a step higher.',
    goal: 'Carry the same easy buzz up a step.',
    instructions: 'Again, a step higher. Keep it light and easy.',
    loopBeats: 6,
    targets: melodyTargets([9, 7, 5, 4, 2], 'Mmm', 6),
  },
  {
    ...BASE,
    id: 'warmup-lip-trill-low',
    category: 'tone',
    title: 'Lip trill',
    summary: 'Up a fifth and back on a loose lip buzz.',
    goal: 'Let the air do the work while the lips stay loose.',
    instructions: 'Loose lips, "brrr" up to the top note and back down.',
    loopBeats: 6,
    targets: melodyTargets([0, 7, 0], 'Brrr', 6),
  },
  {
    ...BASE,
    id: 'warmup-lip-trill-high',
    category: 'tone',
    title: 'Lip trill',
    summary: 'The same trill, a step higher.',
    goal: 'Keep the airflow even as the pattern rises.',
    instructions: 'One step up — keep the air flowing evenly.',
    loopBeats: 6,
    targets: melodyTargets([2, 9, 2], 'Brrr', 6),
  },
  {
    ...BASE,
    id: 'warmup-siren-up',
    category: 'range',
    title: 'Siren',
    summary: 'A smooth octave glide up and back down.',
    goal: 'Travel through the whole range without stepping or pushing.',
    instructions: 'Glide smoothly up an octave and back, like a slow siren.',
    safetyNote: 'Shorten the glide if either end feels strained.',
    loopBeats: 8,
    targets: sirenTargets(0, 12, 'Ooo', 8),
  },
  {
    ...BASE,
    id: 'warmup-siren-down',
    category: 'range',
    title: 'Siren',
    summary: 'The same octave, starting from the top.',
    goal: 'Come down through the range as smoothly as going up.',
    instructions: 'Now start high, swoop down, and rise again.',
    safetyNote: 'Shorten the glide if either end feels strained.',
    loopBeats: 8,
    targets: sirenTargets(12, 0, 'Ooo', 8),
  },
  {
    ...BASE,
    id: 'warmup-scale-low',
    category: 'scales',
    title: 'Five-note scale',
    summary: 'Five notes up and back on an open vowel.',
    goal: 'Keep every step the same size and the same weight.',
    instructions: 'Sing "mah" up and down the five notes, nice and even.',
    loopBeats: 8,
    targets: melodyTargets([0, 2, 4, 5, 7, 5, 4, 2, 0], 'Mah', 8),
  },
  {
    ...BASE,
    id: 'warmup-scale-high',
    category: 'scales',
    title: 'Five-note scale',
    summary: 'The same scale, a step higher.',
    goal: 'Stay relaxed as the pattern climbs.',
    instructions: 'Up a step — stay relaxed as it rises.',
    loopBeats: 8,
    targets: melodyTargets([2, 4, 6, 7, 9, 7, 6, 4, 2], 'Mah', 8),
  },
  {
    ...BASE,
    id: 'warmup-cooldown-hum',
    category: 'tone',
    title: 'Soft hum down',
    summary: 'A falling hum to let the voice settle.',
    goal: 'Come down gently rather than stopping mid-session.',
    instructions: 'Hum gently down the line, letting the voice settle.',
    loopBeats: 6,
    targets: melodyTargets([7, 5, 4, 2, 0], 'Mmm', 6),
  },
  {
    ...BASE,
    id: 'warmup-sigh',
    category: 'range',
    title: 'Sigh it out',
    summary: 'One relaxed slide from the top of the octave to the bottom.',
    goal: 'Release the effort the session built up.',
    instructions: 'A relaxed sliding sigh from high to low. Let everything go.',
    loopBeats: 6,
    targets: [
      {
        id: 'sigh',
        startBeat: 0,
        durationBeats: 6,
        semitone: 12,
        endSemitone: 0,
        cue: 'Haa',
        showCue: true,
      },
    ],
  },
  {
    ...BASE,
    id: 'warmup-final-breath',
    category: 'tone',
    title: 'Breathe out',
    summary: 'One last long exhale to close the session.',
    goal: 'Finish on a breath rather than on a note.',
    instructions: 'One last slow exhale. Done — great session.',
    loopBeats: 8,
    targets: [
      {
        id: 'hiss-out',
        startBeat: 0,
        durationBeats: 8,
        semitone: 0,
        cue: 'Sssss',
        showCue: true,
        kind: 'amplitude',
      },
    ],
  },
]

const BY_ID = new Map(
  WARMUP_EXERCISES.map((exercise) => [exercise.id, exercise]),
)

/**
 * The six patterns, as ordered lists of exercise ids.
 *
 * These ids are load-bearing in two directions. `normalizeWarmupPattern` and
 * `segmentVariantLabel` key routine segments off the *pattern* names, which is
 * why those six strings do not change; the *exercise* ids below are what a
 * future published catalogue has to keep stable.
 */
export const WARMUP_PATTERN_EXERCISES: Record<
  WarmupPattern,
  readonly string[]
> = {
  gentle: ['warmup-breath-cycle', 'warmup-hum-low', 'warmup-hum-high'],
  'lip-trill': [
    'warmup-breath-cycle',
    'warmup-lip-trill-low',
    'warmup-lip-trill-high',
    'warmup-hum-low',
    'warmup-hum-high',
  ],
  sirens: [
    'warmup-breath-cycle',
    'warmup-lip-trill-low',
    'warmup-lip-trill-high',
    'warmup-siren-up',
    'warmup-siren-down',
  ],
  'ascending-scale': [
    'warmup-breath-cycle',
    'warmup-hum-low',
    'warmup-hum-high',
    'warmup-scale-low',
    'warmup-scale-high',
  ],
  cooldown: ['warmup-cooldown-hum', 'warmup-sigh', 'warmup-final-breath'],
  full: [
    'warmup-breath-cycle',
    'warmup-hum-low',
    'warmup-hum-high',
    'warmup-lip-trill-low',
    'warmup-lip-trill-high',
    'warmup-siren-up',
    'warmup-siren-down',
    'warmup-scale-low',
    'warmup-scale-high',
  ],
}

/** The authored exercises a pattern runs, in order. */
export function warmupPatternExercises(
  pattern: WarmupPattern,
): ZenExerciseDefinition[] {
  return WARMUP_PATTERN_EXERCISES[pattern].flatMap((id) => {
    const exercise = BY_ID.get(id)
    return exercise === undefined ? [] : [exercise]
  })
}

/**
 * The reference melody a step plays before the singer sings it back.
 *
 * A glide contributes both of its pitches; a note contributes one. Where a
 * glide ends on the pitch the next block starts from — the turn at the top of
 * a siren — that is one place in the melody, not two, so the repeat collapses.
 * Two separate notes at the same pitch do not collapse: they are two events.
 */
function referenceMelody(exercise: ZenExerciseDefinition): number[] {
  const melody: number[] = []
  let glideEndedAt: number | null = null

  for (const target of [...exercise.targets].sort(
    (a, b) => a.startBeat - b.startBeat,
  )) {
    if ((target.kind ?? 'pitch') !== 'pitch') continue
    if (glideEndedAt !== target.semitone) melody.push(target.semitone)
    if (
      target.endSemitone !== undefined &&
      target.endSemitone !== target.semitone
    ) {
      melody.push(target.endSemitone)
      glideEndedAt = target.endSemitone
    } else {
      glideEndedAt = null
    }
  }
  return melody
}

/**
 * Project an authored exercise onto the step shape the warm-up runtime walks.
 *
 * A step is sung when there is something for the pitch tracker to follow.
 * Everything else — a breath, a hiss, the two together — is a timed step, the
 * same treatment the hardcoded list always gave them.
 */
export function warmupStepFromExercise(
  exercise: ZenExerciseDefinition,
): WarmupStep {
  const offsets = referenceMelody(exercise)
  return {
    name: exercise.title,
    kind: offsets.length > 0 ? 'sing' : 'breath',
    instruction: exercise.instructions,
    seconds: Math.round((exercise.loopBeats * 60) / exercise.bpm),
    ...(offsets.length > 0 ? { offsets } : {}),
  }
}
