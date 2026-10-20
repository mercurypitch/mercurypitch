// ============================================================
// Lesson 6 games — Step or leap? in Step 2, Name it in Step 5
// ============================================================
//
// The kit's ear game in two modes (WEB-SPEC, Toys 4), each on its card in
// its step's text column, under the Notice: ten rounds of Step or leap?,
// two answers, either direction; eight rounds of Name it, four answers,
// each in its anchor's direction. Each round is a pair in the soft tone,
// 0.6 s then 0.8 s (FACTS 67), and a missed one plays again 1.5 times
// slower. One sound at a time: a game's pair stops when the viewer leaves
// its step.

import { q } from '@/features/lessons/kit/dom'
import type { EarNote, EarPlaying } from '@/features/lessons/kit/ear-game'
import { mountEarGame } from '@/features/lessons/kit/ear-game'
import { Sound } from '@/features/lessons/kit/sound'
import { MISS_SLOWER, playNotes } from './examples'
import { dealNameIt, dealStepOrLeap, NAME_IT, STEP_OR_LEAP, } from './game-rounds'

export interface Games {
  /** Stops whichever pair is sounding. */
  stop(): void
}

export function initGames(): Games {
  let playing: EarPlaying | null = null
  const play = (events: readonly EarNote[]): EarPlaying => {
    playing?.stop()
    const run = playNotes(events, { audible: Sound.canPlay() })
    playing = run
    return run
  }
  mountEarGame(q('#stepLeapGame'), {
    answers: STEP_OR_LEAP,
    deal: dealStepOrLeap,
    play,
    slower: MISS_SLOWER,
    labels: {
      start: 'Play a pair',
      again: 'Play it again',
      next: 'Next round',
      more: 'Play ten more',
    },
  })
  mountEarGame(q('#nameItGame'), {
    answers: NAME_IT,
    deal: dealNameIt,
    play,
    slower: MISS_SLOWER,
    labels: {
      start: 'Play a pair',
      again: 'Play it again',
      next: 'Next round',
      more: 'Play eight more',
    },
  })
  return {
    stop() {
      playing?.stop()
      playing = null
    },
  }
}
