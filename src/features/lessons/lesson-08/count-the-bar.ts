// ============================================================
// Lesson 8 Count the bar — the kit's ear game, in Step 3's text
// ============================================================
//
// Six rounds of two bars and the next bar's first beat, answered 2, 3 or 4
// on the buttons or the keys 2, 3 and 4 (WEB-SPEC, Toys 4). The game hands
// each round's clicks to this play, which sounds them on the beat clock,
// the high click at 1,500 Hz and the plain one at 1,000 (bar-rounds.ts);
// a miss plays the round again 1.5 times slower, at 60 BPM. A round, and a
// miss's replay, is the page's one sound (kit/now-playing.ts), which the
// game claims for it; the steps stop the game whenever the viewer leaves
// Step 3, the replay still to come included (steps.ts). A replay starts on
// a timer, not a tap, so it only reads the sound switch: with sound off it
// plays silently and shows no sound-off note.

import { BeatClock } from '@/features/lessons/kit/beat-clock'
import { bookHit } from '@/features/lessons/kit/beat-machine'
import type { MachineHit } from '@/features/lessons/kit/beat-patterns'
import { q } from '@/features/lessons/kit/dom'
import type { EarGame, EarNote, EarPlaying, } from '@/features/lessons/kit/ear-game'
import { mountEarGame } from '@/features/lessons/kit/ear-game'
import { NowPlaying } from '@/features/lessons/kit/now-playing'
import { Sound } from '@/features/lessons/kit/sound'
import { clicksAsBar, dealCountTheBar, MISS_SLOWER, SIZES } from './bar-rounds'

/** Plays clicks on the beat clock, as the ear game asks: resolves at their end, or at once when stopped. */
export function playClicks(
  events: readonly EarNote[],
  audible: boolean,
): EarPlaying {
  const { bar, bpm } = clicksAsBar(events)
  const run = BeatClock.start<MachineHit>({
    bar: (i) => (i === 0 ? bar : null),
    bpm: () => bpm,
    audible,
    book: bookHit,
  })
  return {
    done: run.done.then(() => undefined),
    stop: () => run.stop(),
  }
}

export function initCountTheBar(): EarGame {
  return mountEarGame(q('#countBarGame'), {
    answers: SIZES,
    keys: ['2', '3', '4'],
    deal: dealCountTheBar,
    play: (events, replay) =>
      playClicks(
        events,
        replay ? Sound.state === 'on' && !Sound.hushed : Sound.canPlay(),
      ),
    owner: NowPlaying,
    slower: MISS_SLOWER,
    labels: {
      start: 'Play a round',
      again: 'Play it again',
      next: 'Next round',
      more: 'Play six more',
    },
  })
}
