// ============================================================
// Lesson 12 cold open — the four chords as rooms on the hero's ring, and two tunes walking through them
// ============================================================
//
// The hero is the cold open, in Lesson 2's order (CURIOSITY-MOMENTS § 3.1):
// Merc and Tavi either side of the hero's own ring, the three plays under
// it, then the predict (WEB-SPEC, Toys 2 and 3). The ring is the steps'
// ring of rooms (rooms.ts) in its own copy: the kit's spiral seen from
// above and held still, its five black keys lit and named by their
// sharps, letters on the beads and no syllables, and the loop's four rooms
// drawn faint, with no label and no numeral, since the numerals come in
// Step 2. Nothing marks a tune before the choice: no walk, no gold, no
// count.
//
// Play the four chords works from the start: each room lights while its
// chord sounds, 2.0 s each, which answers nothing. Once a choice locks,
// Play tune 1 and Play tune 2 each play the loop with Merc singing the tune
// over it (tune-play.ts): each sung note pulses its bead and a blue line
// joins it to the note before, a note on a corner of the lit room glows
// gold and grows a ring, and the count under the ring rises to 11 of 15 or
// 10 of 12. The reveal waits until both tunes have been heard to their end
// with sound on, since its counts are both tunes'. A tune cut short, by a
// bead tap, another sound on the page, a stop, a hidden page, a step change
// of the deck or the hero off screen for 600 ms, is not heard: it reveals
// nothing and its hint stays, its walk and its count where they reached.
//
// Both Mercs listen while the four chords sound; while a tune plays Merc
// sings it, note by note (kit/sing-along.ts), and Tavi listens. Tavi
// celebrates once, at the reveal. Each play is the page's one sound
// (kit/now-playing.ts). The drawing is a slider for the notes, as the
// kit's spiral is, and a polite live region speaks for the plays: the four
// chords' names as they start, a tune as it starts and its count once it
// ends.

import { q, qa } from '@/features/lessons/kit/dom'
import { watch } from '@/features/lessons/kit/frame-loop'
import { onLeave } from '@/features/lessons/kit/leave'
import { mercCelebrate, mercListen, mercsReady, } from '@/features/lessons/kit/merc-duo'
import { NowPlaying } from '@/features/lessons/kit/now-playing'
import type { Predict } from '@/features/lessons/kit/predict'
import { mountPredict } from '@/features/lessons/kit/predict'
import { singAlong, stopSingAlong } from '@/features/lessons/kit/sing-along'
import type { StepDeck } from '@/features/lessons/kit/step-deck'
import { stillSky } from '@/features/lessons/kit/still-sky'
import type { ColdChoice } from './lines'
import { COLD_PREDICT, fourChordsLine } from './lines'
import type { TuneId } from './music'
import type { Rooms } from './rooms'
import { mountRooms } from './rooms'

/** The predict's plays that answer it: both tunes, heard to their end (WEB-SPEC, Toys 3). */
export const REVEAL_ON: readonly TuneId[] = ['tune-1', 'tune-2']

const isTune = (what: string): what is TuneId =>
  (REVEAL_ON as readonly string[]).includes(what)

const isChoice = (choice: string): choice is ColdChoice =>
  Object.hasOwn(COLD_PREDICT.guess, choice)

export interface ColdOpen {
  /** The hero's ring of rooms. */
  readonly rooms: Rooms
  readonly predict: Predict
}

/** Mounts the cold open on the hero; a step change of the steps' `deck` ends its play. */
export function initColdOpen(deck: Pick<StepDeck, 'subscribe'>): ColdOpen {
  const stage = q('#heroStage')
  stillSky(stage)
  // the stills wait while a live Merc may still mount, then step in
  void mercsReady.then(() => q('#duo').classList.remove('pending'))

  // Merc sings each of a tune's notes as it starts; the last one sung, so a
  // tune cut short can quiet Merc at once
  const sing = singAlong('blue')
  let sung: number | null = null
  const rooms = mountRooms(stage, {
    mode: 'tunes',
    label: 'none',
    active: watch(stage),
    owner: NowPlaying,
    onSung: (n, i, count) => {
      sung = n.midi
      sing(n, i, count)
    },
  })

  /** Plays the four chords or a tune; resolves false if another sound, a stop or a leaving cut it short. */
  async function play(what: string, audible: boolean): Promise<boolean> {
    sung = null
    if (!isTune(what)) {
      mercListen('blue', true)
      mercListen('orange', true)
      const done = rooms.playLoop(audible)
      rooms.say(fourChordsLine('C'))
      const heard = await done
      mercListen('blue', false)
      mercListen('orange', false)
      return heard
    }
    mercListen('orange', true)
    const heard = await rooms.playTune(what, audible)
    mercListen('orange', false)
    if (!heard && sung !== null) stopSingAlong('blue', sung)
    return heard
  }

  const predict = mountPredict(q('#predict'), {
    play,
    // the three plays sit under the ring, outside the predict card
    plays: qa<HTMLButtonElement>('.hero-plays [data-play]'),
    revealOn: REVEAL_ON,
    revealAfter: 'all',
    hints: COLD_PREDICT.hints,
    guess: (choice) =>
      isChoice(choice) ? COLD_PREDICT.guess[choice] : 'You said',
    onReveal: () => mercCelebrate('orange', 1600),
  })

  // leaving the hero ends its play: a step change of the deck, by any
  // route, or the hero off screen for 600 ms, a hidden page or a page gone
  deck.subscribe(() => rooms.stop())
  onLeave(stage, rooms.stop)

  return { rooms, predict }
}
