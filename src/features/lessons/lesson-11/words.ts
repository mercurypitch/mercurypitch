// ============================================================
// Lesson 11 four words — register, chest voice, head voice, flip, each heard
// ============================================================
//
// Lesson 1's strip of figure, word, definition and play button
// (kit/words-strip.ts), each figure a small drawing of the range chart's
// lines (WEB-SPEC, Toys 3; FACTS 76): Register plays one note in each gear,
// G sharp 3 (or F sharp 4), 2.0 s each with 0.3 s between, beside a thick
// and a thin line at one height; Chest voice plays the lower gear, 2.0 s,
// beside a thick line; Head voice, or falsetto, the upper gear, 2.0 s,
// beside a thin line; Flip plays the cold open's up half, 4.0 s, beside a
// rising line that jumps across a small seam and goes on thin. Each line of
// a figure lights while its gear sounds; lighting is the only change, so
// under reduced motion they light just the same. The voice is the chart's,
// the stored one or else the lower. The four plays are the page's one sound
// (kit/now-playing.ts), in Merc's two gears (gear-sound.ts): a press stops
// the sound before it, anywhere on the page, and a newer one stops them.

import { q, qa } from '@/features/lessons/kit/dom'
import { mercSing } from '@/features/lessons/kit/merc-duo'
import { NowPlaying } from '@/features/lessons/kit/now-playing'
import type { Run } from '@/features/lessons/kit/run'
import type { Voice } from '@/features/lessons/kit/voice-choice'
import { mercOf, VoiceChoice } from '@/features/lessons/kit/voice-choice'
import { bindWordPlays } from '@/features/lessons/kit/words-strip'
import { playGears } from './gear-sound'
import type { GearLine } from './lines'
import { gearNote, gearNoteOf, gearPair, JUMP_SEC, NOTE_SEC, PAIR_GAP, SIREN_RATE, SIREN_UP, upHalf, } from './lines'

export const WORD_IDS = ['register', 'chest', 'head', 'flip'] as const
export type WordId = (typeof WORD_IDS)[number]

/** A lit line of a figure: Merc's amber, glowing. */
export const LIT = 'drop-shadow(0 0 4px rgba(245, 158, 11, 0.9))'

/** What a word sings, in a voice. */
export function wordLine(word: WordId, v: Voice): GearLine {
  if (word === 'register') return gearPair(v)
  if (word === 'chest') return gearNote(v, 1)
  if (word === 'head') return gearNote(v, 0)
  return upHalf(v)
}

/** When each line of a word's figure is lit, seconds from the start of its play: one span a line, in the markup's order. */
export function wordLamps(
  word: WordId,
): readonly (readonly [number, number])[] {
  if (word === 'register')
    return [
      [0, NOTE_SEC],
      [NOTE_SEC + PAIR_GAP, NOTE_SEC * 2 + PAIR_GAP],
    ]
  if (word === 'flip') {
    // the thick line up to the jump, the thin one from its end
    const jump = 3 / SIREN_RATE
    return [
      [0, jump],
      [jump + JUMP_SEC, SIREN_UP],
    ]
  }
  return [[0, NOTE_SEC]]
}

const isWord = (w: string): w is WordId =>
  (WORD_IDS as readonly string[]).includes(w)

export function initWords(): void {
  const strip = q('#words')
  const runs: Partial<Record<WordId, Run>> = {}
  bindWordPlays(
    strip,
    async (word, audible) => {
      if (!isWord(word)) return
      const v = VoiceChoice.voice ?? 'lower'
      const lamps = qa<SVGElement>(`[data-word="${word}"] [data-lamp]`, strip)
      const timers: number[] = []
      const light = (i: number, on: boolean): void => {
        const lamp = lamps[i]
        if (lamp !== undefined) lamp.style.filter = on ? LIT : ''
      }
      wordLamps(word).forEach(([from, to], i) => {
        timers.push(
          window.setTimeout(() => light(i, true), from * 1000),
          window.setTimeout(() => light(i, false), to * 1000),
        )
      })
      const run = playGears(wordLine(word, v), audible)
      runs[word] = run
      mercSing(mercOf(v), gearNoteOf(v), true)
      await run.done
      timers.forEach((id) => window.clearTimeout(id))
      lamps.forEach((_, i) => light(i, false))
      mercSing(mercOf(v), gearNoteOf(v), false)
      if (runs[word] === run) delete runs[word]
    },
    {
      owner: NowPlaying,
      stop: (word) => {
        if (isWord(word)) runs[word]?.stop()
      },
    },
  )
}
