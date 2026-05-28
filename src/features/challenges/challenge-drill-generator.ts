import type { ChallengeType } from '@/components/VocalChallenges'
import type { ExerciseType } from '@/features/exercises/types'

export interface ChallengeDrill {
  exercise: ExerciseType
  notes: string[]
  challengeType: ChallengeType
  challengeName: string
  tip: string
}

const drillConfigs: Record<
  ChallengeType,
  { exercise: ExerciseType; notes: string[]; tip: string }
> = {
  'high-notes': {
    exercise: 'siren',
    notes: ['C4', 'E4', 'G4', 'C5', 'E5'],
    tip: 'Glide smoothly up to each target note — focus on tension-free high notes',
  },
  'low-notes': {
    exercise: 'drone-intonation',
    notes: ['C3', 'E3', 'G3', 'A3'],
    tip: 'Sing each interval against the drone — lock in your intonation',
  },
  speed: {
    exercise: 'staccato-precision',
    notes: ['C4', 'E4', 'G4', 'C5', 'G4', 'E4', 'C4'],
    tip: 'Attack each note crisply and accurately — no scooping',
  },
  perfect: {
    exercise: 'interval-trainer',
    notes: ['C4', 'E4', 'G4', 'C5'],
    tip: 'Sing each interval with <±15 cents deviation — precision over power',
  },
  scales: {
    exercise: 'scale-runner',
    notes: ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5'],
    tip: 'Move smoothly through each degree of the scale — even tone throughout',
  },
  intervals: {
    exercise: 'interval-trainer',
    notes: ['C4', 'E4', 'G4', 'B4', 'C5'],
    tip: 'Internalize each interval distance — hear the gap before you sing',
  },
  harmony: {
    exercise: 'chord-stacker',
    notes: ['C4', 'E4', 'G4', 'B4'],
    tip: 'Build chords one note at a time — feel how each voice fits together',
  },
  agility: {
    exercise: 'arpeggio-jumper',
    notes: ['C4', 'E4', 'G4', 'C5'],
    tip: 'Leap between chord tones with clean attack and no sliding',
  },
  range: {
    exercise: 'siren',
    notes: ['C4', 'E4', 'G4', 'C5', 'E5'],
    tip: 'Explore your full range — smooth register transitions without breaks',
  },
  dynamic: {
    exercise: 'dynamic-swell',
    notes: ['C4', 'E4', 'G4'],
    tip: 'Control your volume from soft to loud and back — steady pitch throughout',
  },
  'call-response': {
    exercise: 'call-response',
    notes: ['C4', 'D4', 'E4', 'G4'],
    tip: 'Listen carefully to the phrase, then reproduce it exactly',
  },
}

export function generateChallengeDrill(
  challengeType: ChallengeType,
  challengeName: string,
): ChallengeDrill {
  const config = drillConfigs[challengeType] ?? drillConfigs.perfect
  return {
    ...config,
    challengeType,
    challengeName,
  }
}
