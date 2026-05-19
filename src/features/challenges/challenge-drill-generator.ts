import type { ExerciseType } from '@/features/exercises/types'
import type { ChallengeType } from '@/components/VocalChallenges'

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
    exercise: 'long-note',
    notes: ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5'],
    tip: 'Start at C4, step up by semitone only when you hit >90% accuracy',
  },
  'low-notes': {
    exercise: 'long-note',
    notes: ['C4', 'B3', 'A3', 'G3', 'F3', 'E3', 'D3', 'C3'],
    tip: 'Start at C4, step down by semitone only when you hit >90% accuracy',
  },
  speed: {
    exercise: 'slide',
    notes: ['C4', 'E4', 'G4', 'C5', 'G4', 'E4', 'C4'],
    tip: 'Move quickly and cleanly between notes — no scooping',
  },
  perfect: {
    exercise: 'long-note',
    notes: ['C4', 'E4', 'G4'],
    tip: 'Sustain each note with <±15 cents deviation for the full duration',
  },
  scales: {
    exercise: 'slide',
    notes: ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5'],
    tip: 'Slide smoothly through each note in the scale',
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
