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
    description:
      'Build breath support and pitch stability with sustained notes',
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
  {
    id: 'interval-focus',
    name: 'Interval Mastery',
    description: 'Sharpen your ear with interval training and melody recall',
    segments: [
      {
        type: 'warmup',
        durationSec: 90,
        config: { pattern: 'ascending-scale' },
      },
      {
        type: 'exercise',
        durationSec: 210,
        config: { exercise: 'interval-trainer', notes: ['C4'] },
      },
      {
        type: 'exercise',
        durationSec: 210,
        config: { exercise: 'call-response', notes: ['C4'] },
      },
      {
        type: 'cooldown',
        durationSec: 60,
        config: { mode: 'humming' },
      },
    ],
  },
  {
    id: 'scale-focus',
    name: 'Scale & Agility',
    description: 'Build vocal agility with scales, arpeggios, and staccato drills',
    segments: [
      {
        type: 'warmup',
        durationSec: 90,
        config: { pattern: 'lip-trill' },
      },
      {
        type: 'exercise',
        durationSec: 210,
        config: { exercise: 'scale-runner', notes: ['C4'] },
      },
      {
        type: 'exercise',
        durationSec: 180,
        config: { exercise: 'arpeggio-jumper', notes: ['C4'] },
      },
      {
        type: 'exercise',
        durationSec: 150,
        config: { exercise: 'staccato-precision', notes: ['C4'] },
      },
      {
        type: 'cooldown',
        durationSec: 60,
        config: { mode: 'free-sing' },
      },
    ],
  },
  {
    id: 'harmony-focus',
    name: 'Harmony & Intonation',
    description: 'Develop harmonic awareness with chords, drones, and pitch precision',
    segments: [
      {
        type: 'warmup',
        durationSec: 90,
        config: { pattern: 'ascending-scale' },
      },
      {
        type: 'exercise',
        durationSec: 180,
        config: { exercise: 'drone-intonation', notes: ['C4'] },
      },
      {
        type: 'exercise',
        durationSec: 210,
        config: { exercise: 'chord-stacker', notes: ['C4'] },
      },
      {
        type: 'challenge-prep',
        durationSec: 90,
        config: { challengeCategory: 'harmony' },
      },
      {
        type: 'cooldown',
        durationSec: 60,
        config: { mode: 'humming' },
      },
    ],
  },
  {
    id: 'range-focus',
    name: 'Range & Dynamics',
    description: 'Expand your range and control your dynamics with sirens and swells',
    segments: [
      {
        type: 'warmup',
        durationSec: 90,
        config: { pattern: 'sirens' },
      },
      {
        type: 'exercise',
        durationSec: 240,
        config: { exercise: 'siren', notes: ['C4'] },
      },
      {
        type: 'exercise',
        durationSec: 210,
        config: { exercise: 'dynamic-swell', notes: ['C4'] },
      },
      {
        type: 'challenge-prep',
        durationSec: 90,
        config: { challengeCategory: 'range' },
      },
      {
        type: 'cooldown',
        durationSec: 60,
        config: { mode: 'free-sing' },
      },
    ],
  },
  {
    id: 'full-warmup',
    name: 'Complete Warm-Up',
    description: 'A guided full warm-up sequence through all phases',
    segments: [
      {
        type: 'warmup',
        durationSec: 60,
        config: { pattern: 'sirens' },
      },
      {
        type: 'exercise',
        durationSec: 300,
        config: { exercise: 'routine-runner', notes: ['C4'] },
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
