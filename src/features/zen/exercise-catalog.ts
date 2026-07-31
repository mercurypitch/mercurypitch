import type { ZenExerciseDefinition, ZenExerciseTarget } from './types'

const DEFAULT_SCORING = {
  pitchWeight: 0.55,
  coverageWeight: 0.25,
  steadinessWeight: 0.2,
  toleranceCents: 100,
} as const

function noteTargets(
  offsets: readonly number[],
  cues: readonly string[],
  options: {
    startBeat?: number
    beatsPerNote?: number
    cueEveryNote?: boolean
  } = {},
): ZenExerciseTarget[] {
  const startBeat = options.startBeat ?? 1
  const beatsPerNote = options.beatsPerNote ?? 1
  const cueEveryNote = options.cueEveryNote ?? true

  return offsets.map((semitone, index) => ({
    id: `note-${index + 1}`,
    startBeat: startBeat + index * beatsPerNote,
    durationBeats: beatsPerNote * 0.82,
    semitone,
    cue: cues[index % cues.length] ?? '',
    showCue: cueEveryNote || index === 0,
  }))
}

export const ZEN_EXERCISES: readonly ZenExerciseDefinition[] = [
  {
    id: 'major-scale-ascending',
    version: 1,
    title: 'Major Scale Ascending',
    category: 'scales',
    level: 'foundation',
    summary: 'One octave, one connected vowel.',
    goal: 'Keep every step even as the scale rises.',
    instructions:
      'Sing “ah” on each note in one comfortable breath. Keep the jaw loose and let the volume stay level.',
    safetyNote: 'Transpose down if the top note needs extra force.',
    pronunciationHint: 'Ah: an open UK “ah” vowel.',
    bpm: 78,
    countInBeats: 2,
    loopBeats: 10,
    defaultRootMidi: 60,
    targets: noteTargets([0, 2, 4, 5, 7, 9, 11, 12], ['Ah']),
    defaultTargetVisibility: 'on',
    defaultProgressCue: 'playhead',
    scoring: DEFAULT_SCORING,
  },
  {
    id: 'three-note-run',
    version: 1,
    title: 'Three-Note Run',
    category: 'agility',
    level: 'developing',
    summary: 'A compact pattern for clean, even movement.',
    goal: 'Land each note without smearing the steps together.',
    instructions:
      'Use a small, clear “gee.” Start slowly and keep the jaw quiet; accuracy matters more than speed.',
    pronunciationHint: 'Gee: a light UK “gee”, never pushed.',
    bpm: 92,
    countInBeats: 2,
    loopBeats: 8,
    defaultRootMidi: 60,
    targets: noteTargets([0, 2, 4, 2, 0, 2, 4, 2, 0], ['Gee'], {
      beatsPerNote: 0.5,
      cueEveryNote: false,
    }),
    defaultTargetVisibility: 'on',
    defaultProgressCue: 'playhead',
    scoring: {
      ...DEFAULT_SCORING,
      pitchWeight: 0.5,
      coverageWeight: 0.35,
      steadinessWeight: 0.15,
    },
  },
  {
    id: 'octave-repeat-nay',
    version: 1,
    title: 'Octave Repeat Nay',
    category: 'range',
    level: 'developing',
    summary: 'Visit the octave lightly, then return home.',
    goal: 'Reach the upper note without shouting or scooping.',
    instructions:
      'Use a clear, light “nay.” Keep the upper note brief and transpose the pattern until both notes feel easy.',
    safetyNote: 'Stop or transpose down if the upper note feels pressed.',
    pronunciationHint: 'Nay: /neɪ/ in UK English.',
    bpm: 76,
    countInBeats: 2,
    loopBeats: 8,
    defaultRootMidi: 55,
    targets: noteTargets([0, 12, 0, 12, 0], ['Nay']),
    defaultTargetVisibility: 'on',
    defaultProgressCue: 'playhead',
    scoring: DEFAULT_SCORING,
  },
  {
    id: 'descending-nya',
    version: 1,
    title: 'Descending Nya',
    category: 'tone',
    level: 'foundation',
    summary: 'A bright descending line with an easy release.',
    goal: 'Keep the tone consistent while the pitch descends.',
    instructions:
      'Sing “nya” lightly on every note. Connect the phrase and avoid dropping the final note out of the breath.',
    pronunciationHint: 'Nya: “nyah”, as one joined syllable.',
    bpm: 74,
    countInBeats: 2,
    loopBeats: 8,
    defaultRootMidi: 60,
    targets: noteTargets([7, 5, 4, 2, 0], ['Nya']),
    defaultTargetVisibility: 'on',
    defaultProgressCue: 'playhead',
    scoring: DEFAULT_SCORING,
  },
  {
    id: 'ng-five-tone',
    version: 1,
    title: 'NG Five-Tone',
    category: 'tone',
    level: 'foundation',
    summary: 'A connected five-tone hum for an easy start.',
    goal: 'Carry one even resonance through the whole phrase.',
    instructions:
      'Use the final sound of “sing.” Keep the jaw loose and connect each pitch without adding a new consonant.',
    pronunciationHint: 'NG: /ŋ/, the final sound in “sing”.',
    bpm: 72,
    countInBeats: 2,
    loopBeats: 12,
    defaultRootMidi: 57,
    targets: noteTargets([0, 2, 4, 5, 7, 5, 4, 2, 0], ['NG']),
    defaultTargetVisibility: 'on',
    defaultProgressCue: 'playhead',
    scoring: {
      ...DEFAULT_SCORING,
      steadinessWeight: 0.25,
      pitchWeight: 0.5,
    },
  },
  {
    id: 'mam-arpeggio',
    version: 1,
    title: 'Mam Arpeggio',
    category: 'tone',
    level: 'foundation',
    summary: 'A speech-like arpeggio through the chord.',
    goal: 'Keep the vowel and volume unchanged across each leap.',
    instructions:
      'Use a comfortable, speech-like “mam.” Let the lips release naturally and avoid pressing into the upper note.',
    pronunciationHint: 'Mam: /mæm/ in UK English.',
    bpm: 76,
    countInBeats: 2,
    loopBeats: 8,
    defaultRootMidi: 57,
    targets: noteTargets([0, 4, 7, 4, 0], ['Mam']),
    defaultTargetVisibility: 'on',
    defaultProgressCue: 'playhead',
    scoring: DEFAULT_SCORING,
  },
  {
    id: 'mah-meh-mee-moh-moo',
    version: 1,
    title: 'Mah Meh Mee Moh Moo',
    category: 'articulation',
    level: 'foundation',
    summary: 'Five vowels on one steady pitch.',
    goal: 'Internalise clear enunciation without moving the pitch.',
    instructions:
      'Sing all five sounds in one breath. Keep placement consistent and let each vowel remain pure.',
    pronunciationHint:
      'UK English vowels; the example recording is the source of truth.',
    bpm: 66,
    countInBeats: 2,
    loopBeats: 8,
    defaultRootMidi: 57,
    targets: noteTargets([0, 0, 0, 0, 0], ['Mah', 'Meh', 'Mee', 'Moh', 'Moo']),
    defaultTargetVisibility: 'on',
    defaultProgressCue: 'playhead',
    scoring: {
      ...DEFAULT_SCORING,
      pitchWeight: 0.5,
      steadinessWeight: 0.3,
      coverageWeight: 0.2,
    },
    exampleAudio: {
      src: '/exercises/examples/exercises-develop-strong.mp3',
      durationMs: 3500,
      locale: 'en-GB',
      source: 'coach',
      transcript: 'Mah, Meh, Mee, Moh, Moo',
    },
  },
  {
    id: 'noo-siren',
    version: 1,
    title: 'Noo Siren',
    category: 'range',
    level: 'foundation',
    summary: 'A smooth octave glide up and back.',
    goal: 'Travel continuously without stepping or pushing at the ends.',
    instructions:
      'Use a gentle rounded “noo.” Glide evenly through the middle and keep both endpoints comfortable.',
    safetyNote: 'Shorten or transpose the glide if either end feels strained.',
    pronunciationHint: 'Noo: /nuː/ in UK English.',
    bpm: 60,
    countInBeats: 2,
    loopBeats: 10,
    defaultRootMidi: 55,
    targets: [
      {
        id: 'glide-up',
        startBeat: 1,
        durationBeats: 4,
        semitone: 0,
        endSemitone: 12,
        cue: 'Noo',
        showCue: true,
      },
      {
        id: 'glide-down',
        startBeat: 5,
        durationBeats: 4,
        semitone: 12,
        endSemitone: 0,
        cue: 'Noo',
        showCue: false,
      },
    ],
    defaultTargetVisibility: 'on',
    defaultProgressCue: 'none',
    scoring: {
      ...DEFAULT_SCORING,
      coverageWeight: 0.2,
      steadinessWeight: 0.3,
    },
  },
] as const

export function getZenExercise(
  id: string | null | undefined,
): ZenExerciseDefinition | null {
  if (id === null || id === undefined) return null
  return ZEN_EXERCISES.find((exercise) => exercise.id === id) ?? null
}
