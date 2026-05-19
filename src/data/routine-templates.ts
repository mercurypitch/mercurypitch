import type { RoutineTemplate } from '@/features/routines/types'

export const dailyRoutines: RoutineTemplate[] = [
  {
    id: 'vibrato-focus',
    name: 'Vibrato Focus',
    description: 'Develop controlled, even vibrato across your range',
    segments: [
      {
        type: 'warmup',
        durationSec: 90,
        config: { pattern: 'ascending-scale' },
      },
      {
        type: 'exercise',
        durationSec: 180,
        config: { exercise: 'vibrato', notes: ['C4', 'E4', 'G4'] },
      },
      {
        type: 'challenge-prep',
        durationSec: 120,
        config: { challengeCategory: 'perfect' },
      },
      {
        type: 'cooldown',
        durationSec: 60,
        config: { mode: 'free-sing' },
      },
    ],
  },
  {
    id: 'long-note-focus',
    name: 'Breath & Stability',
    description: 'Build breath support and pitch stability with sustained notes',
    segments: [
      {
        type: 'warmup',
        durationSec: 90,
        config: { pattern: 'lip-trill' },
      },
      {
        type: 'exercise',
        durationSec: 240,
        config: { exercise: 'long-note', notes: ['C4', 'G3', 'E4'] },
      },
      {
        type: 'challenge-prep',
        durationSec: 90,
        config: { challengeCategory: 'high-notes' },
      },
      {
        type: 'cooldown',
        durationSec: 60,
        config: { mode: 'humming' },
      },
    ],
  },
  {
    id: 'slide-focus',
    name: 'Smooth Transitions',
    description: 'Practice clean slides and pitch transitions',
    segments: [
      {
        type: 'warmup',
        durationSec: 60,
        config: { pattern: 'sirens' },
      },
      {
        type: 'exercise',
        durationSec: 210,
        config: { exercise: 'slide', notes: ['C4', 'E4', 'G4', 'C5'] },
      },
      {
        type: 'challenge-prep',
        durationSec: 120,
        config: { challengeCategory: 'scales' },
      },
      {
        type: 'cooldown',
        durationSec: 60,
        config: { mode: 'free-sing' },
      },
    ],
  },
  {
    id: 'all-around',
    name: 'All-Around Vocal Workout',
    description: 'A balanced routine covering all exercise types',
    segments: [
      {
        type: 'warmup',
        durationSec: 90,
        config: { pattern: 'ascending-scale' },
      },
      {
        type: 'exercise',
        durationSec: 120,
        config: { exercise: 'long-note', notes: ['C4'] },
      },
      {
        type: 'exercise',
        durationSec: 120,
        config: { exercise: 'vibrato', notes: ['E4'] },
      },
      {
        type: 'exercise',
        durationSec: 120,
        config: { exercise: 'slide', notes: ['C4', 'G4'] },
      },
      {
        type: 'cooldown',
        durationSec: 60,
        config: { mode: 'free-sing' },
      },
    ],
  },
]

export function getRandomRoutine(): RoutineTemplate {
  return dailyRoutines[Math.floor(Math.random() * dailyRoutines.length)]
}

export function getRoutineById(id: string): RoutineTemplate | undefined {
  return dailyRoutines.find((r) => r.id === id)
}
