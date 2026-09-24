// ============================================================
// Glass melody catalogue — authored notes and feel, independent of difficulty.
// ============================================================
//
// These are the four original listening-study sketches. Times describe musical
// phrasing; capture tolerances and legal singer pace live in the judge policy.

import type { MelodyDefinition, MelodyFeelDefinition, } from '../core/melody-contour'

export const BEGINNER_RIBBON_FEEL: MelodyFeelDefinition = {
  landingSeconds: 0.4,
  finalLandingSeconds: 0.6,
  transitionSeconds: 0.65,
  breathSeconds: 0.85,
  connection: 'glide',
}

export const GLASS_MELODIES = [
  {
    id: 'first-arc',
    version: 1,
    title: 'First arc',
    description: 'A small rise, then gently home.',
    feel: BEGINNER_RIBBON_FEEL,
    phrases: [
      {
        id: 'first-arc-phrase',
        allowBreathAfter: false,
        anchors: [
          { id: 'first-arc-home', offsetSemitones: 0 },
          { id: 'first-arc-rise', offsetSemitones: 2 },
          { id: 'first-arc-return', offsetSemitones: 0 },
        ],
      },
    ],
  },
  {
    id: 'sunlit-steps',
    version: 1,
    title: 'Sunlit steps',
    description: 'Two steps into the light, then back.',
    feel: BEGINNER_RIBBON_FEEL,
    phrases: [
      {
        id: 'sunlit-steps-phrase',
        allowBreathAfter: false,
        anchors: [
          { id: 'sunlit-steps-home', offsetSemitones: 0 },
          { id: 'sunlit-steps-two', offsetSemitones: 2 },
          { id: 'sunlit-steps-four', offsetSemitones: 4 },
          { id: 'sunlit-steps-back-two', offsetSemitones: 2 },
          { id: 'sunlit-steps-return', offsetSemitones: 0 },
        ],
      },
    ],
  },
  {
    id: 'gallery-arch',
    version: 1,
    title: 'Gallery arch',
    description: 'A longer arch with a little more sky.',
    feel: BEGINNER_RIBBON_FEEL,
    phrases: [
      {
        id: 'gallery-arch-phrase',
        allowBreathAfter: false,
        anchors: [
          { id: 'gallery-arch-home', offsetSemitones: 0 },
          { id: 'gallery-arch-two', offsetSemitones: 2 },
          { id: 'gallery-arch-four', offsetSemitones: 4 },
          { id: 'gallery-arch-seven', offsetSemitones: 7 },
          { id: 'gallery-arch-back-four', offsetSemitones: 4 },
          { id: 'gallery-arch-back-two', offsetSemitones: 2 },
          { id: 'gallery-arch-return', offsetSemitones: 0 },
        ],
      },
    ],
  },
  {
    id: 'two-windows',
    version: 1,
    title: 'Two windows',
    description: 'Two short phrases. Take a breath between them.',
    feel: BEGINNER_RIBBON_FEEL,
    phrases: [
      {
        id: 'two-windows-first',
        allowBreathAfter: true,
        anchors: [
          { id: 'two-windows-first-home', offsetSemitones: 0 },
          { id: 'two-windows-first-two', offsetSemitones: 2 },
          { id: 'two-windows-first-four', offsetSemitones: 4 },
          { id: 'two-windows-first-back-two', offsetSemitones: 2 },
          { id: 'two-windows-first-return', offsetSemitones: 0 },
        ],
      },
      {
        id: 'two-windows-second',
        allowBreathAfter: false,
        anchors: [
          { id: 'two-windows-second-home', offsetSemitones: 0 },
          { id: 'two-windows-second-two', offsetSemitones: 2 },
          { id: 'two-windows-second-five', offsetSemitones: 5 },
          { id: 'two-windows-second-back-two', offsetSemitones: 2 },
          { id: 'two-windows-second-return', offsetSemitones: 0 },
        ],
      },
    ],
  },
] as const satisfies readonly MelodyDefinition[]

export type GlassMelodyId = (typeof GLASS_MELODIES)[number]['id']

export function glassMelody(id: GlassMelodyId): MelodyDefinition {
  const melody = GLASS_MELODIES.find((candidate) => candidate.id === id)
  if (!melody) throw new Error(`Unknown glass melody: ${id}.`)
  return melody
}
