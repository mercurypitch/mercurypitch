// ============================================================
// Lesson 6 cold open — "Twinkle" from C, then with every note moved up six
// ============================================================
//
// The hero is the cold open, in Lesson 2's order (CURIOSITY-MOMENTS § 3.1):
// the bubbles over the two Mercs either side of the compact tune line on C,
// Play from C under the stage, then the predict card. Play from C works from
// the start, because orange's line answers it. Play from F♯ waits for a
// guess, then lifts the line and slides it up six rows, announced "Twinkle
// from F sharp", before blue Merc sings it in Merc's "ooh" (FACTS 36, 63).
// The reveal follows once Play from F♯ has been heard to its end; with
// sound off the hint says so and the reveal waits. Each play is the page's
// one sound (kit/now-playing.ts) from its press, the slide included: a
// newer sound anywhere stops it, Merc falls quiet, and a play cut short
// reveals nothing. Orange celebrates once. The compact line takes no taps
// (the buttons carry every action), so its drawing is hidden from a screen
// reader and a polite live region speaks for it. Its stars are drawn once
// and never twinkle: on this page only the two Mercs' idle loops move by
// themselves (WEB-SPEC, Look).

import { q, wait } from '@/features/lessons/kit/dom'
import { watch } from '@/features/lessons/kit/frame-loop'
import { mercCelebrate, mercSing, mercsReady, } from '@/features/lessons/kit/merc-duo'
import { COLOR, signsHtml } from '@/features/lessons/kit/notes'
import { NowPlaying } from '@/features/lessons/kit/now-playing'
import { mountPredict } from '@/features/lessons/kit/predict'
import { stillSky } from '@/features/lessons/kit/still-sky'
import type { TuneShape } from '@/features/lessons/kit/tune-line'
import { mountTuneLine } from '@/features/lessons/kit/tune-line'
import type { NoteEvent } from './examples'
import { LINE_C, LINE_FS } from './examples'
import { C4, FS4 } from './melody'
import { TUNE } from './tune-toy'

/**
 * The compact line: the first line alone, with no names, numbers or marks,
 * on sixteen rows from C4 to D♯5, so both starts fit without rescaling.
 */
export const COMPACT: TuneShape = {
  lines: [0],
  window: [60, 75],
  fill: true,
  names: false,
  below: null,
  beadButtons: false,
  gapButtons: false,
  brackets: [],
  ghost: null,
}

/** The reveal's first line, by the choice: never "right" or "wrong". */
export const GUESS: Readonly<Record<string, string>> = {
  notes: 'You said: some of the notes',
  gaps: 'You said: the gaps between the notes',
}

/** What the live region says as each start begins. */
export const STARTS_SAID = {
  c: 'Twinkle from C',
  fs: 'Twinkle from F sharp',
} as const

/**
 * A hint that names F♯, in one span: the lock hint is a flex row, whose
 * gap would part the F from its sign and could wrap the sign alone.
 */
const signedHint = (text: string): string => `<span>${signsHtml(text)}</span>`

/** Blue Merc sings along: each note as it starts, quiet once the last has ended. */
function singAlong(e: NoteEvent, i: number, count: number): void {
  mercSing('blue', e.midi, true)
  if (i === count - 1)
    window.setTimeout(() => mercSing('blue', e.midi, false), e.dur * 1000)
}

export function initColdOpen(): void {
  const stage = q('#heroStage')
  stillSky(stage)
  // the stills wait while a live Merc may still mount, then step in
  void mercsReady.then(() => q('#duo').classList.remove('pending'))
  const box = q('#heroTune')
  const said = q('[data-hero-said]', box)
  const line = mountTuneLine({
    canvas: q<HTMLCanvasElement>('canvas', box),
    tune: TUNE,
    start: C4,
    shape: COMPACT,
    active: watch(stage),
  })

  // the stops so far: a play stopped while its line still slides finds them changed
  let stops = 0

  /** Stops the hero's play, or the start a slide is still carrying it to; Merc falls quiet. */
  function stop(): void {
    stops += 1
    line.stop()
    mercSing('blue', C4, false)
  }

  /** Plays a start; resolves false if another sound cut it short. */
  async function play(what: string, audible: boolean): Promise<boolean> {
    NowPlaying.claim(stop)
    const mine = stops
    const fs = what === 'fs'
    const lands = line.setStart(fs ? FS4 : C4)
    if (lands > 0) await wait(lands)
    if (mine !== stops) return false
    said.textContent = fs ? STARTS_SAID.fs : STARTS_SAID.c
    const events = fs ? LINE_FS : LINE_C
    const finished = await line.play(events, audible, {
      kind: 'merc',
      color: COLOR.blue,
      onNote: (e, i) => singAlong(e, i, events.length),
    })
    if (finished) NowPlaying.release(stop)
    return finished
  }

  mountPredict(q('#predict'), {
    play,
    // Play from C sits under the stage, so it is on the first screen
    plays: [
      q<HTMLButtonElement>('#heroPlay'),
      q<HTMLButtonElement>('#predict [data-play="fs"]'),
    ],
    revealOn: ['fs'],
    hints: {
      chosen: signedHint(
        'Locked in. Play from F♯: the line slides up six rows, then Merc sings it.',
      ),
      silent: signedHint(
        'Sound is off, so nothing played. Turn sound on to hear it, then press Play from F♯.',
      ),
      again: 'Play either start again, and listen to the gaps.',
    },
    guess: (choice) => GUESS[choice] ?? 'You said',
    onReveal: () => mercCelebrate('orange', 1600),
  })
}
