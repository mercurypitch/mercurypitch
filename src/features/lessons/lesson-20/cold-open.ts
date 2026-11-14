// ============================================================
// Lesson 20 cold open — Merc's run fast and slowly, and what one study found
// ============================================================
//
// The hero is the cold open, in Lesson 2's order (CURIOSITY-MOMENTS § 3.1):
// Merc and Tavi either side of the hero's own pitch line, its two plays
// under it, then the predict (WEB-SPEC, Toys 2 and 3). The pitch line is
// the run chart (run-chart.ts) on Merc's D3 for everyone, since the voice
// choice comes later on the page (FACTS 8): the run's nine beads on their
// string, each in its band, faint, with no name shown until its note
// sounds (FACTS 11). Play the run fast and Play it slowly work before and
// after the choice (`data-free`): Merc's run at 0.2 s a note, 1.80 s, or at
// 0.6 s, 5.40 s (FACTS 12), the drawing redrawn for the tempo played, so
// the fast run's beads crowd together, each still in its band (FACTS 38),
// and each bead glows and shows its syllable as its note sounds. With
// sound off the beads still light in time and the hint says nothing
// played. Either play stops the other, Merc and Tavi listen while a run
// plays, and leaving the hero ends it.
//
// The predict is Lesson 3's research predict (kit/predict.ts): no play
// and nothing in it to hear, since the answer is a finding (FACTS 15). On
// the choice the page's lock hint hides, the choices lock, and the reveal
// shows under them, the keyboard's place moved to it and its words said
// on the page's status line; it opens on the answer whichever was chosen
// and calls neither wrong. On a first visit the welcome tour waits for the
// choice (kit/tour-gate.ts `holdTour`), since Step 3's text and its mix-up
// card give the answer (FACTS 1a).

import { announce, announcer, spokenText, } from '@/features/lessons/kit/announce'
import { q, qa } from '@/features/lessons/kit/dom'
import { watch } from '@/features/lessons/kit/frame-loop'
import { onLeave } from '@/features/lessons/kit/leave'
import { mercListen } from '@/features/lessons/kit/merc-duo'
import { NowPlaying } from '@/features/lessons/kit/now-playing'
import type { Predict } from '@/features/lessons/kit/predict'
import { mountPredict } from '@/features/lessons/kit/predict'
import type { Run, RunNote } from '@/features/lessons/kit/run'
import { allOf, playLine, playNotes } from '@/features/lessons/kit/run'
import { Sound } from '@/features/lessons/kit/sound'
import type { StepDeck } from '@/features/lessons/kit/step-deck'
import { holdTour } from '@/features/lessons/kit/tour-gate'
import type { RunChart } from './run-chart'
import { mountRunChart } from './run-chart'
import { runDo, runLine, runNotes } from './sounds'

/** The hero's two plays, s a note: the run fast and slowly (FACTS 12). */
export const HERO_TEMPO: Readonly<Record<string, number>> = {
  fast: 0.2,
  slow: 0.6,
}

/** The hint after a play that sound off kept silent. */
export const SILENT_HINT =
  "Sound is off, so nothing played. Turn sound on to hear Merc's run."

/** What a play says as it starts: "Merc's run, 0.2 seconds a note." */
export const heroSaid = (every: number): string =>
  `Merc's run, ${every} seconds a note.`

export interface ColdOpen {
  readonly predict: Predict
  readonly chart: RunChart
  /** Plays the run at `every` s a note; resolves true when heard to its end. */
  play(every: number): Promise<boolean>
  stop(): void
}

/**
 * Mounts the hero's pitch line, its two plays and the predict. Call it in
 * the same task as the masthead's start, so a first visit's tour waits for
 * the choice.
 */
export function initColdOpen(deck: StepDeck): ColdOpen {
  const stage = q('#heroStage')
  const viz = q('#heroRun')
  const said = q('[data-hero-said]', viz)
  const hint = q('[data-hero-hint]')
  const canvas = q('canvas', viz)
  const DO = runDo(null)
  const chart = mountRunChart(viz, {
    active: watch(canvas),
    doMidi: DO,
    names: false,
    faint: true,
  })
  let run: Run | null = null
  let plays = 0
  // the play button lit while its run plays
  let lit: HTMLButtonElement | null = null

  function stop(): void {
    if (run === null) return
    plays += 1
    run.stop()
    end()
  }

  /** The run over: no bead lit, its button out, and Merc and Tavi back from listening. */
  function end(): void {
    run = null
    lit?.classList.remove('is-on')
    lit = null
    chart.rest()
    NowPlaying.release(stop)
    mercListen('blue', false)
    mercListen('orange', false)
  }

  function play(every: number): Promise<boolean> {
    stop()
    NowPlaying.claim(stop)
    const mine = ++plays
    const audible = Sound.canPlay()
    hint.textContent = audible ? '' : SILENT_HINT
    hint.hidden = audible
    chart.rest()
    chart.setTempo(every)
    const notes: RunNote[] = runNotes(DO, every)
    run = allOf([
      playLine(runLine(DO, every), { audible, kind: 'merc' }),
      // the beads light on the line's own clock, silently
      playNotes(notes, {
        audible: false,
        onNote: (n, i) => {
          if (mine === plays) chart.glow(i, n.dur)
        },
      }),
    ])
    said.textContent = heroSaid(every)
    mercListen('blue', true)
    mercListen('orange', true)
    return run.done.then((heard) => {
      if (mine !== plays) return false
      end()
      return heard
    })
  }

  for (const b of qa<HTMLButtonElement>('.hero-plays [data-play]')) {
    const every = HERO_TEMPO[b.dataset.play ?? '']
    if (every === undefined) continue
    b.addEventListener('click', () => {
      // a play stops the one before, its button out, then lights its own
      void play(every)
      lit = b
      b.classList.add('is-on')
    })
  }

  // the welcome tour waits for the choice, which its steps' stop would answer
  let chose: (c: string) => void = () => undefined
  const chosen = new Promise<string>((resolve) => {
    chose = resolve
  })
  holdTour(chosen, () => undefined)

  const root = q('#predict')
  const lock = q('.lock-hint', root)
  const reveal = q('.reveal', root)
  // the reveal is said on the page's status line, made before it is needed
  reveal.removeAttribute('aria-live')
  announcer()
  const predict = mountPredict(root, {
    // the answer needs no sound: the reveal comes with the choice
    play: () => Promise.resolve(),
    plays: [],
    reveal: [],
    hints: { chosen: '', silent: '', again: '' },
    onChoice: (c) => {
      chose(c)
      lock.hidden = true
      reveal.hidden = false
      // the pressed choice is now disabled: the keyboard's place goes to what it revealed
      reveal.tabIndex = -1
      reveal.focus({ preventScroll: true })
      announce(spokenText(reveal))
    },
  })

  // leaving the hero ends its play: a step change of the deck, by any
  // route, or the hero off screen for 600 ms, a hidden page or a page gone
  deck.subscribe(() => stop())
  onLeave(stage, stop)

  return { predict, chart, play, stop }
}
