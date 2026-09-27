// Echo Curator audition — one optional, untimed 3→5→7-note call-and-response sequence.

import type { MelodyJudgePolicy } from '../core/melody-judge'
import { MERC_ENCORE_JUDGE_POLICY } from './encore-examples'
import type { GlassMelodyId } from './melodies'
import { glassMelody } from './melodies'

export interface EchoCuratorRoundDefinition {
  id: string
  melodyId: GlassMelodyId
  invitation: string
  success: string
}

export interface EchoCuratorAuditionDefinition {
  id: string
  revision: number
  title: string
  introduction: string
  completion: string
  rounds: readonly [
    EchoCuratorRoundDefinition,
    EchoCuratorRoundDefinition,
    EchoCuratorRoundDefinition,
  ]
  judgePolicy: Partial<MelodyJudgePolicy>
}

export function echoCuratorRoundNoteCount(
  round: EchoCuratorRoundDefinition,
): number {
  return glassMelody(round.melodyId).phrases.reduce(
    (count, phrase) => count + phrase.anchors.length,
    0,
  )
}

export const ECHO_CURATOR_AUDITION: EchoCuratorAuditionDefinition = {
  id: 'echo-curator-audition-v1',
  revision: 1,
  title: 'The Echo Curator',
  introduction:
    'Merc offers one small shape at a time. Listen, answer when you are ready, and let the cabinet remember the light.',
  completion:
    'Three echoes, answered. The Curator bows and leaves every gallery reward exactly where it was.',
  rounds: [
    {
      id: 'echo-curator-small-arc',
      melodyId: 'first-arc',
      invitation: 'Begin with three notes: home, a small rise, then home.',
      success: 'The first lamp answers.',
    },
    {
      id: 'echo-curator-sunlit-steps',
      melodyId: 'sunlit-steps',
      invitation: 'Add two more steps, then find the way home again.',
      success: 'The middle cabinet glows.',
    },
    {
      id: 'echo-curator-gallery-arch',
      melodyId: 'gallery-arch',
      invitation: 'Finish with the seven-note arch. There is no clock.',
      success: 'The long arch shines from end to end.',
    },
  ],
  judgePolicy: MERC_ENCORE_JUDGE_POLICY,
}
