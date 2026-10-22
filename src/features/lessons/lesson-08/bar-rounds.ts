// ============================================================
// Lesson 8 Count the bar — its rounds, their clicks and their words
// ============================================================
//
// Pure (WEB-SPEC, Toys 4; Tests 7). A round plays two bars and the next
// bar's first beat at 90 BPM, beat 1 alone on the high click, so a bar's
// size is heard from the high clicks: 5, 7 or 9 clicks (FACTS 77). Each
// click travels to the kit's ear game as an `EarNote`, MIDI 90 for the high
// click and 83 for the plain one, the notes nearest 1,500 and 1,000 Hz, and
// the page's play sounds the kit's tick at those two frequencies for them
// (FACTS 74). Six rounds, each size twice, shuffled with no size twice
// running, from the game's seeded generator. The feedback names the bar and
// the sound, never the listener.

import type { Bar } from '@/features/lessons/kit/beat-clock'
import type { MachineHit } from '@/features/lessons/kit/beat-patterns'
import type { EarNote, EarRound } from '@/features/lessons/kit/ear-game'
import { BEAT_SEC } from './patterns'

export type BarSize = '2' | '3' | '4'

/** The answers in their order, and the keys that give them: 2, 3 and 4. */
export const SIZES: readonly BarSize[] = ['2', '3', '4']

/** The high click's note and the plain one's, as the ear game carries them. */
export const HIGH_MIDI = 90
export const PLAIN_MIDI = 83
/** A click's length, seconds: the tick has died away by 70 ms (FACTS 74). */
export const CLICK_SEC = 0.07
/** A missed round plays again this much slower: at 60 BPM. */
export const MISS_SLOWER = 1.5

/** Each size's line, after "Yes." or "Here it is again, slower." */
export const BAR_WORDS: Readonly<Record<BarSize, string>> = {
  '2': 'Bars of 2: the high click came back every other beat, 1 2, 1 2.',
  '3': 'Bars of 3: the high click came back every third beat, 1 2 3, 1 2 3.',
  '4': 'Bars of 4: the high click came back every fourth beat, 1 2 3 4.',
}

/** Two bars of `beats` and the next bar's first beat, one click a beat at 90 BPM. */
export function barClicks(beats: number): EarNote[] {
  return Array.from({ length: beats * 2 + 1 }, (_, i) => ({
    midi: i % beats === 0 ? HIGH_MIDI : PLAIN_MIDI,
    at: i * BEAT_SEC,
    dur: CLICK_SEC,
  }))
}

/** A shuffled copy of the three sizes, from `random`. */
function shuffled(random: () => number): BarSize[] {
  const out = [...SIZES]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/** The six sizes: two shuffled runs of the three, the second never starting on the first's last. */
export function barOrder(random: () => number): BarSize[] {
  const first = shuffled(random)
  let second = shuffled(random)
  if (second[0] === first[2]) second = [second[1], second[0], second[2]]
  return [...first, ...second]
}

/** A game's six rounds. */
export function dealCountTheBar(
  random: () => number,
): readonly EarRound<BarSize>[] {
  return barOrder(random).map((size) => ({
    events: barClicks(Number(size)),
    answer: size,
    words: BAR_WORDS[size],
  }))
}

/**
 * A round's clicks as one bar for the beat clock: one beat a click, at the
 * tempo their spacing gives (60 BPM for a miss's slower replay), each click
 * high or plain as its note says.
 */
export function clicksAsBar(events: readonly EarNote[]): {
  readonly bar: Bar<MachineHit>
  readonly bpm: number
} {
  const gap = events.length > 1 ? events[1].at - events[0].at : BEAT_SEC
  return {
    bar: {
      beats: events.length,
      hits: events.map((e, beat) => ({
        beat,
        data: { kind: 'click', high: e.midi === HIGH_MIDI },
      })),
    },
    bpm: 60 / gap,
  }
}
