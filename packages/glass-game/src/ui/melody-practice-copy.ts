// Melody coaching copy — short live prompts and optional longer explanations.
import type { MelodyDefinition } from '../core/melody-contour'
import type { MelodyJudgeSnapshot } from '../core/melody-judge'

export function idleCopy(melody: MelodyDefinition): {
  message: string
  hint: string
} {
  return {
    message: melody.title,
    hint: `${melody.description} Listen first, or sing when you are ready.`,
  }
}

export function feedbackCopy(snapshot: MelodyJudgeSnapshot): {
  message: string
  hint: string
} {
  if (snapshot.complete)
    return {
      message: 'The whole ribbon is glowing.',
      hint: 'You carried the melody all the way through.',
    }
  if (snapshot.phase === 'breath')
    return {
      message: 'Next phrase when you are ready.',
      hint: 'Breathe if you want to, then begin on the glowing note.',
    }
  if (snapshot.feedback === 'retry')
    return {
      message: 'Try this phrase again.',
      hint: 'Return to its first note and let the shape unfold gently.',
    }
  if (snapshot.feedback === 'high')
    return {
      message: 'A little lower.',
      hint: 'Follow the ribbon; there is no need to sing loudly.',
    }
  if (snapshot.feedback === 'low')
    return {
      message: 'A little higher.',
      hint: 'Follow the ribbon; there is no need to sing loudly.',
    }
  if (snapshot.feedback === 'dropout' || snapshot.feedback === 'stale')
    return {
      message: 'Let the note come through clearly.',
      hint: 'A gentle hum is enough. Begin this phrase again if you need to.',
    }
  if (snapshot.feedback === 'find-start')
    return {
      message: 'Find the glowing note.',
      hint: 'Settle there briefly, then follow the ribbon forward.',
    }
  return {
    message: 'Follow the ribbon.',
    hint: 'Keep moving gently through the shape. Breathe between phrases if you want to.',
  }
}
