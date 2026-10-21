// ============================================================
// Lesson 6 games — Step or leap? in Step 2, Name it in Step 5
// ============================================================
//
// The kit's ear game in two modes (WEB-SPEC, Toys 4), each on its card in
// its step's text column, under the Notice: ten rounds of Step or leap?,
// two answers, either direction; eight rounds of Name it, four answers,
// each in its anchor's direction. Each round is a pair in the soft tone,
// 0.6 s then 0.8 s (FACTS 67), and a missed one plays again 1.5 times
// slower. One sound at a time: each game's pair, and a miss's replay, is
// the page's one sound (kit/now-playing.ts), so it stops whatever played
// before it and gives way to whatever plays next, the other game's pair
// included; and both stop when the viewer leaves their step (steps.ts).

import { q } from '@/features/lessons/kit/dom'
import type { EarGame, EarNote, EarPlaying, } from '@/features/lessons/kit/ear-game'
import { mountEarGame } from '@/features/lessons/kit/ear-game'
import { NowPlaying } from '@/features/lessons/kit/now-playing'
import { Sound } from '@/features/lessons/kit/sound'
import { MISS_SLOWER, playNotes } from './examples'
import { dealNameIt, dealStepOrLeap, NAME_IT, STEP_OR_LEAP, } from './game-rounds'

export interface Games {
  /** Stops both games: the pair sounding, and a miss's replay still to come. */
  stop(): void
}

export function initGames(): Games {
  const play = (events: readonly EarNote[]): EarPlaying =>
    playNotes(events, { audible: Sound.canPlay() })
  const stepOrLeap = mountEarGame(q('#stepLeapGame'), {
    answers: STEP_OR_LEAP,
    deal: dealStepOrLeap,
    play,
    owner: NowPlaying,
    slower: MISS_SLOWER,
    labels: {
      start: 'Play a pair',
      again: 'Play it again',
      next: 'Next round',
      more: 'Play ten more',
    },
  })
  const nameIt = mountEarGame(q('#nameItGame'), {
    answers: NAME_IT,
    deal: dealNameIt,
    play,
    owner: NowPlaying,
    slower: MISS_SLOWER,
    labels: {
      start: 'Play a pair',
      again: 'Play it again',
      next: 'Next round',
      more: 'Play eight more',
    },
  })
  const games: readonly EarGame[] = [stepOrLeap, nameIt]
  return {
    stop() {
      for (const game of games) game.stop()
    },
  }
}
