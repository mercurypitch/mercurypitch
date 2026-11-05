// ============================================================
// Lesson 14 cold open — Merc's two takes of one phrase, on the hero's song line
// ============================================================
//
// The kit's predict as it is (kit/predict.ts; WEB-SPEC, Toys 2): two
// choices, "It rises" and "It stays level", that lock on the first press;
// Play take 1, a free play that works before a choice and never reveals,
// since take 1 has no swell and so says nothing of what one does to the
// line; and Play take 2, locked until a choice, whose sound heard to its
// end with sound on reveals. Both draw on the hero's compact song line in
// the chosen voice as they sound, each band lit as its note sounds, its
// breath mark as the breath comes, with sound off as with sound on; only
// the reveal's words wait for the sound.
//
// Each play claims the page's one sound, so a Four words play or a step's
// cuts it short, as do the Sound switch going off and the tab going hidden
// (every run stops when every sound does, kit/run.ts): a play cut short
// resolves false, and the kit reveals nothing. The Merc of the chosen
// voice sings Merc's notes; Tavi, the puzzled one, celebrates once at the
// reveal, whichever choice was made. The live line says what a take drew
// once it has played to its end, and take 2's words come with the reveal.

import { q } from '@/features/lessons/kit/dom'
import { mercCelebrate } from '@/features/lessons/kit/merc-duo'
import { NowPlaying } from '@/features/lessons/kit/now-playing'
import type { Predict } from '@/features/lessons/kit/predict'
import { mountPredict } from '@/features/lessons/kit/predict'
import { mercOf, VoiceChoice } from '@/features/lessons/kit/voice-choice'
import { TAKE_SAID } from './lines'
import { singAlong, singNotes } from './plays'
import type { TakeId } from './song'
import type { SongLine } from './song-line'
import { mountSongLine, takePlay } from './song-line'

/** The predict's hints (LESSON.md, the cold open; the page's lock hint is the markup's). */
export const HINTS = {
  chosen: 'Locked in. Now play take 2, and watch “star”.',
  silent: 'Sound is off, so nothing played. Turn sound on, then play it again.',
  again: 'Play either take again.',
} as const

/** The reveal's line about the choice, in Lesson 2's form. */
export const guess = (choice: string): string =>
  choice === 'rises' ? 'You said: it rises' : 'You said: it stays level'

/** The take a play button plays. */
const TAKES: Readonly<Record<string, TakeId>> = { take1: 1, take2: 2 }

export interface ColdOpen {
  readonly line: SongLine
  readonly predict: Predict
}

export function initColdOpen(): ColdOpen {
  const root = q('#heroSong')
  const said = q('[data-hero-said]', root)
  const line = mountSongLine(root, { state: 'compact' })
  const say = (text: string): void => {
    if (said.textContent !== text) said.textContent = text
  }
  let revealed = false

  const predict = mountPredict(q('#predict'), {
    plays: [
      q<HTMLButtonElement>('#heroPlay'),
      q<HTMLButtonElement>('.hero [data-play="take2"]'),
    ],
    revealOn: ['take2'],
    hints: HINTS,
    guess,
    async play(what, audible) {
      const id = TAKES[what]
      if (id === undefined) return false
      const p = takePlay(id, line.doMidi)
      const run = singNotes(p.notes, audible)
      const stop = (): void => run.stop()
      NowPlaying.claim(stop)
      const drawing = line.play(p)
      const quiet = singAlong(
        p.notes,
        mercOf(VoiceChoice.voice ?? 'lower'),
        audible,
      )
      const heard = await run.done
      NowPlaying.release(stop)
      quiet()
      if (heard) drawing.end()
      else drawing.cancel()
      // take 2's words wait for the reveal, which this play may bring
      if (heard && (id === 1 || revealed)) say(TAKE_SAID[id])
      return heard
    },
    onReveal() {
      revealed = true
      say(TAKE_SAID[2])
      mercCelebrate('orange')
    },
  })
  return { line, predict }
}
