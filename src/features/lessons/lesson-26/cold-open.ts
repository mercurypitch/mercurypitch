// ============================================================
// Lesson 26 cold open — "Twinkle" with a copy four semitones up: does every note fit?
// ============================================================
//
// The hero is the cold open, in Lesson 2's order (CURIOSITY-MOMENTS § 3.1):
// Merc and Tavi either side of the kit's tune line in its compact state,
// "Twinkle"'s two lines in C stacked, C4 to D5 a band, the house on do,
// every row alike and faint, taking no taps (WEB-SPEC, Toys 1). Play the
// tune is free: the two lines in the soft tone, 8.0 s, each bead lighting
// ink as it sounds. Play them together waits for a choice: the tune with
// the copy four semitones above it, note against note, 8.0 s; as it starts
// C major's rows light as lanes, and each note of the copy draws its bead
// as it sounds, joined to the one before, a bead off the lanes named
// inside, C♯, G♯ or F♯ (FACTS 15, 32, 35). The reveal waits for it heard to
// its end with sound on, and shows the hero's reveal and Steps 1 and 2's
// held words, the kit's status line reading them in order; the held lines
// go (FACTS 41). Its Play the copy that stays in the key plays the tune
// with the key's copy, 8.0 s, drawing on the lanes as it sounds, while the
// copy four semitones up fades to the kit's contrast case, dashed, with
// its "?" (`TuneOverlay`).
//
// The choice tells the page (`onChoice`): the steps' toy and free play
// draw their states and open their controls. On a first visit the welcome
// tour waits for the choice (kit/tour-gate.ts `holdTour`), with no time
// limit, since its steps' stop would answer it. A play pressed with the
// drawing scrolled away above the screen brings it back into view, so the
// copy is seen drawing as it sounds: on a phone the reveal's play sits
// more than a screen under it. A play cut short, by another sound, a step
// change of the deck or the hero, its stage and its predict, off screen,
// is not heard, and the hero goes back to how it stood before it.

import { q, qa } from '@/features/lessons/kit/dom'
import { watch } from '@/features/lessons/kit/frame-loop'
import { onLeave } from '@/features/lessons/kit/leave'
import { mercCelebrate, mercListen, mercsReady, } from '@/features/lessons/kit/merc-duo'
import { reducedMotion } from '@/features/lessons/kit/motion-switch'
import { COLOR } from '@/features/lessons/kit/notes'
import { NowPlaying } from '@/features/lessons/kit/now-playing'
import type { Predict } from '@/features/lessons/kit/predict'
import { mountPredict } from '@/features/lessons/kit/predict'
import type { Run } from '@/features/lessons/kit/run'
import { allOf, playNotes } from '@/features/lessons/kit/run'
import type { StepDeck } from '@/features/lessons/kit/step-deck'
import { stillSky } from '@/features/lessons/kit/still-sky'
import { holdTour } from '@/features/lessons/kit/tour-gate'
import type { TuneEvent, TuneLine, TuneOverlay, TuneShape, } from '@/features/lessons/kit/tune-line'
import { mountTuneLine } from '@/features/lessons/kit/tune-line'
import type { TunePart } from '@/features/lessons/kit/tune-line-parts'
import { DRESS } from '@/features/lessons/kit/tune-line-parts-draw'
import { PLAIN_SAID } from './part-shapes'
import { TUNE } from './part-toy'
import { C_MAJOR, C4, KEY_COPY, LINE, offLane, TWINKLE, TWINKLE_BEAT, UP4_COPY, } from './parts'

/** The predict's words (LESSON.md; WEB-SPEC, Toys 1); there is no `next` hint. */
export const COLD_PREDICT = {
  hints: {
    chosen: 'Locked in. Play them together.',
    silent: 'Sound is off: nothing played. Turn sound on, then play it again.',
    again: 'Play any of them again.',
  },
  guess: {
    fits: 'You said: every note fits the key',
    leaves: 'You said: some notes leave the key',
  },
} as const

const isChoice = (c: string): c is keyof typeof COLD_PREDICT.guess =>
  Object.hasOwn(COLD_PREDICT.guess, c)

/** The hero's words: at rest, after the answering play, after the reveal's (WEB-SPEC, Toys 1). */
export const HERO_SAID = {
  rest: PLAIN_SAID,
  up4: "The copy: six of its notes, on C sharp 5, G sharp 4 and F sharp 4, are off C major's rows.",
  key: "The copy that stays in the key: every note on C major's rows.",
} as const

/** The hero's plays: the tune alone, with the copy four semitones up, or with the key's. */
export type HeroPlay = 'tune' | 'together' | 'key'

/** "Twinkle"'s two lines stacked, compact, plain rows, the house on do. */
const REST: TuneShape = {
  lines: [LINE.twinkle1, LINE.twinkle2],
  window: [C4, C4 + 14],
  fill: true,
  names: false,
  below: null,
  beadButtons: false,
  gapButtons: false,
  brackets: [],
  ghost: null,
  dress: { house: C4 },
}

/** The copy moved four semitones, as the contrast case over the key's: dashed, with its "?". */
const MOVED: TuneOverlay = { at: UP4_COPY.flat(), changed: [] }

/** A copy of both lines, `shown` beads of each drawn, its notes off the lanes named. */
function copied(
  copy: readonly (readonly number[])[],
  shown: readonly number[],
): TuneShape {
  const parts: TunePart[] = [0, 1].map((k) => ({
    line: k === 0 ? LINE.twinkle1 : LINE.twinkle2,
    at: copy[k],
    label: 'copy',
    shown: shown[k],
    names: copy[k].map(offLane),
  }))
  return { ...REST, dress: { house: C4, lanes: C_MAJOR, parts } }
}

/** A hero play as the line takes it: each event, the bead it lights, and whose, the tune's or a line's copy. */
export interface HeroEvents {
  readonly events: readonly TuneEvent[]
  /** The note each event lights, counted across the tune: the tune's bead, or the copy's against it. */
  readonly notes: readonly number[]
  /** The copy each event lights, by line, or null for the tune. */
  readonly parts: readonly (number | null)[]
}

/** "Twinkle"'s two lines, 8.0 s, with a copy's note against each of the tune's, together. */
export function heroEvents(
  copy: readonly (readonly number[])[] | null,
): HeroEvents {
  const events: TuneEvent[] = []
  const notes: number[] = []
  const parts: (number | null)[] = []
  let t = 0
  TWINKLE.forEach((l, k) => {
    const first = k === 0 ? 0 : TWINKLE[0].at.length
    l.at.forEach((a, i) => {
      const dur = l.beats[i] * TWINKLE_BEAT
      events.push({ midi: C4 + a, at: t, dur })
      notes.push(first + i)
      parts.push(null)
      if (copy !== null) {
        events.push({ midi: C4 + copy[k][i], at: t, dur })
        notes.push(first + i)
        parts.push(k)
      }
      t += dur
    })
  })
  return { events, notes, parts }
}

export interface ColdOpen {
  readonly predict: Predict
  readonly line: TuneLine
  stop(): void
}

export interface ColdOpenOptions {
  /** Hears the choice: the steps' toy and free play open. */
  readonly onChoice: () => void
  /** Hears the reveal: the held lines go. */
  readonly onReveal: () => void
}

/**
 * Mounts the cold open on the hero; a step change of the steps' `deck`
 * ends its play. Call it after the masthead's start, in the same task, so
 * a first visit's tour waits for the choice.
 */
export function initColdOpen(
  deck: Pick<StepDeck, 'subscribe'>,
  o: ColdOpenOptions,
): ColdOpen {
  const stage = q('#heroStage')
  const figure = q('#heroTune')
  const canvas = q<HTMLCanvasElement>('[data-hero-canvas]', figure)
  const said = q('[data-hero-said]', figure)
  stillSky(stage)
  // the stills wait while a live Merc may still mount, then step in
  void mercsReady.then(() => q('#duo').classList.remove('pending'))

  const line = mountTuneLine({
    canvas,
    tune: TUNE,
    start: C4,
    shape: REST,
    active: watch(stage),
    dressPainter: DRESS,
  })

  /** The copy the hero draws whole when no play runs: none, four semitones up, or the key's. */
  let drawn: 'none' | 'up4' | 'key' = 'none'
  let run: Run | null = null
  let plays = 0

  /** The hero as it stands between plays, and its words: the key's copy over the moved one's contrast case. */
  function settle(): void {
    if (drawn === 'none') line.setShape(REST)
    else line.setShape(copied(drawn === 'up4' ? UP4_COPY : KEY_COPY, [7, 7]))
    line.setOverlay(drawn === 'key' ? MOVED : null)
    const words = HERO_SAID[drawn === 'none' ? 'rest' : drawn]
    canvas.setAttribute('aria-label', words)
  }

  function listen(on: boolean): void {
    mercListen('blue', on)
    mercListen('orange', on)
  }

  function stop(): void {
    if (run === null) return
    plays += 1
    run.stop()
    run = null
    line.stop()
    settle()
    NowPlaying.release(stop)
    listen(false)
  }

  /**
   * The drawing back in view when it is scrolled away above the screen, as
   * a play starts, centred, by the page's own scroll: the stage clips what
   * overflows it, so scrolling the figure into view would scroll the stage
   * too, and leave its bubbles cut off.
   */
  function bringBack(): void {
    const r = figure.getBoundingClientRect()
    if (r.top >= 0) return
    window.scrollBy({
      top: r.top + r.height / 2 - window.innerHeight / 2,
      behavior: reducedMotion() ? 'instant' : 'smooth',
    })
  }

  /** Plays the tune, with a copy or alone; resolves false when cut short. */
  function play(what: string, audible: boolean): Promise<boolean> {
    stop()
    bringBack()
    NowPlaying.claim(stop)
    const mine = ++plays
    const id: HeroPlay = what === 'together' || what === 'key' ? what : 'tune'
    const copy = id === 'together' ? UP4_COPY : id === 'key' ? KEY_COPY : null
    const { events, notes, parts } = heroEvents(copy)
    // a copy draws as it sounds: its beads from none, the contrast case
    // fading in over the key's as it starts
    const shown = [0, 0]
    if (copy !== null) {
      line.setShape(copied(copy, shown))
      line.setOverlay(id === 'key' ? MOVED : null)
    }
    listen(true)
    const sound = playNotes(
      events.map((e) => ({ t: e.at, midi: e.midi, dur: e.dur })),
      { audible, kind: 'soft' },
    )
    const lit = line.play(events, false, {
      color: COLOR.ink,
      notes,
      parts,
      onNote: (_e, i) => {
        const k = parts[i]
        if (mine !== plays || k === null || copy === null) return
        shown[k] += 1
        line.setShape(copied(copy, shown))
      },
    })
    const going = allOf([sound, { done: lit, stop: () => line.stop() }])
    run = going
    return going.done.then((heard) => {
      if (mine !== plays) return false
      run = null
      if (copy !== null) drawn = id === 'key' ? 'key' : 'up4'
      settle()
      if (copy !== null)
        said.textContent = HERO_SAID[drawn === 'key' ? 'key' : 'up4']
      NowPlaying.release(stop)
      listen(false)
      return heard
    })
  }

  // the welcome tour waits for the choice, which its steps' stop would answer
  let chose: (c: string) => void = () => undefined
  const chosen = new Promise<string>((resolve) => {
    chose = resolve
  })
  holdTour(chosen, () => undefined)

  const box = q('#predict')
  const reveal = q('.reveal', box)
  const predict = mountPredict(box, {
    play,
    // the two plays sit under the stage, outside the predict card, and the
    // key's copy in the reveal
    plays: [
      ...qa<HTMLButtonElement>('.hero-plays [data-play]'),
      q<HTMLButtonElement>('[data-play="key"]', reveal),
    ],
    revealOn: ['together'],
    hints: COLD_PREDICT.hints,
    guess: (c) => (isChoice(c) ? COLD_PREDICT.guess[c] : 'You said'),
    // the hero's reveal, then Steps 1 and 2's held words, read in order
    reveal: [
      reveal,
      q('.held-body[data-held="1"]'),
      q('.held-body[data-held="2"]'),
    ],
    onChoice: (c) => {
      // the choice ends Play the tune: the predict moves focus to the
      // answering play
      stop()
      chose(c)
      o.onChoice()
    },
    onReveal: () => {
      o.onReveal()
      // Tavi's quiet "oh", with no sparkles (the Mercs' options)
      mercCelebrate('orange', 1600)
    },
  })

  // leaving the hero ends its play: a step change of the deck, by any
  // route, or the hero off screen for 600 ms, a hidden page or a page gone.
  // The hero is its stage and its predict, so a play runs on while the
  // predict is read under it, as the reveal's play is pressed there
  deck.subscribe(() => stop())
  onLeave(stage.closest<HTMLElement>('section') ?? stage, stop)

  return { predict, line, stop }
}
