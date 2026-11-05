// ============================================================
// Lesson 8 clicks on the beat clock — a round of Count the bar, or the quiz's two bars
// ============================================================
//
// Count the bar's rounds (count-the-bar.ts) and the quick check's question
// 2 (quiz-play.ts) sound their clicks the same way: as one bar on the beat
// clock, at the tempo their spacing gives, the high click at 1,500 Hz and
// the plain one at 1,000 (bar-rounds.ts `clicksAsBar`). A module apart from
// the game, so a page that asks question 2 again (Lesson 17's recall)
// plays it without loading Lesson 8's ear game, and the chunks the other
// lessons share keep their modules and their stylesheets.

import { BeatClock } from '@/features/lessons/kit/beat-clock'
import { bookHit } from '@/features/lessons/kit/beat-machine'
import type { MachineHit } from '@/features/lessons/kit/beat-patterns'
import type { EarNote, EarPlaying } from '@/features/lessons/kit/ear-game'
import { clicksAsBar } from './bar-rounds'

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
