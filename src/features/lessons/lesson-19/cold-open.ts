// ============================================================
// Lesson 19 cold open — six pads between Merc and Tavi, grouped two ways
// ============================================================
//
// The hero is the cold open, in Lesson 2's order (CURIOSITY-MOMENTS § 3.1):
// Tavi's and Merc's bubbles over them, six of Lesson 8's pads between them
// in the rhythm bar's compact scene, nothing written and no grouping drawn,
// the three plays under the stage, then the predict (WEB-SPEC, Toys 2 and
// 3). Each play is two bars of six eighths, 4 s (FACTS 64):
//
// - Play six notes works from the start: twelve closed hi-hats a third of a
//   second apart, all at 0.7, each pad lighting as its note sounds, with no
//   grouping drawn and nobody hopping. It starts 0.1 s after the press.
// - Once a choice locks, Play in threes strikes Subdivide's 6/8, the kick
//   on pad 1 and the snare on pad 4, and Play in twos the page's own bar,
//   the kick on 1 and the snare on 3 and 5 (FACTS 18); each draws an arc
//   under each group as it starts, and Merc and Tavi hop on every kick and
//   snare, each hop started HOP_MS ahead so it lands on its drum. These
//   start 0.6 s after the press, Lesson 8's lead, so the first hop starts
//   after it (FACTS 57).
//
// The reveal waits for both groupings heard to their end (the kit's
// predict, `revealAfter: 'all'`, FACTS 59), and its closing line shows on a
// guess of "In twos" only. A play cut short, by another sound, a step change
// of the deck or the hero off screen, is not heard and changes nothing. The
// last grouping's arcs stay drawn until the next play. The figure is hidden
// from a screen reader; its caption names what it shows, and nothing is
// said of the answer before the reveal. The welcome tour waits for the
// choice, since Step 1 states the answer (FACTS 60).

import { q, qa } from '@/features/lessons/kit/dom'
import type { DrumHit } from '@/features/lessons/kit/drum-hits'
import { bookDrum } from '@/features/lessons/kit/drum-hits'
import { DRUM_LEVEL } from '@/features/lessons/kit/drum-hits'
import { onLeave } from '@/features/lessons/kit/leave'
import { mercsReady } from '@/features/lessons/kit/merc-duo'
import { HOP_MS, mercHop } from '@/features/lessons/kit/merc-hop'
import { A3, hz } from '@/features/lessons/kit/notes'
import { NowPlaying } from '@/features/lessons/kit/now-playing'
import type { Predict } from '@/features/lessons/kit/predict'
import { mountPredict } from '@/features/lessons/kit/predict'
import type { PlayPart, RhythmBar, RhythmView, } from '@/features/lessons/kit/rhythm-bar'
import { mountRhythmBar } from '@/features/lessons/kit/rhythm-bar'
import { SIX_EIGHT, THREE_FOUR } from '@/features/lessons/kit/rhythm-model'
import type { StepDeck } from '@/features/lessons/kit/step-deck'
import { stillSky } from '@/features/lessons/kit/still-sky'
import { holdTour } from '@/features/lessons/kit/tour-gate'
import { DRUMS, SIX_BPM, SIX_EIGHTHS } from './rhythm-views'

/** What the hero plays: the six even, or grouped. */
export type Grouping = 'six' | 'threes' | 'twos'

const isGrouping = (g: string): g is Grouping =>
  g === 'six' || g === 'threes' || g === 'twos'

/** The predict's lines (WEB-SPEC, Toys 3): no "next" line, which the kit would show after the free play too. */
export const COLD_PREDICT = {
  hints: {
    chosen: 'Locked in. Play both groupings, and watch Merc.',
    silent:
      'Sound is off, so nothing played. Turn sound on, then play it again.',
    again: 'Play either grouping again.',
  },
} as const

/** Play six notes' hits: a closed hi-hat on each eighth, all at 0.7 (FACTS 64). */
export const EVEN_HATS: readonly DrumHit[] = Array.from({ length: 6 }, () => ({
  voice: 'hh-closed' as const,
  level: DRUM_LEVEL,
}))

/** Each play's drums, one an eighth. */
export const HERO_DRUMS: Readonly<Record<Grouping, readonly DrumHit[]>> = {
  six: EVEN_HATS,
  threes: DRUMS['6-8'],
  twos: DRUMS['3-4'],
}

/** The figure's caption for each play: what it shows, never which grouping makes two beats. */
export const HERO_CAPTION: Readonly<Record<Grouping, string>> = {
  six: "Six of Lesson 8's beat pads in a row, numbered 1 to 6, all one size, with no grouping drawn and nothing written.",
  threes:
    "Six notes, grouped in threes: Lesson 8's six beat pads, an arc under each group of three.",
  twos: "Six notes, grouped in twos: Lesson 8's six beat pads, an arc under each group of two.",
}

/** Seconds from the press to the first beat: a grouping waits Lesson 8's 0.6 s so its first hop starts after the press (FACTS 57). */
export const GROUPING_LEAD = 0.6

/** The hero's figure: six pads alone in the compact scene, an arc under each group once a grouping plays. */
export function heroView(g: Grouping): RhythmView {
  return {
    scene: {
      staff: 'line',
      rows: [
        {
          bars: [SIX_EIGHTHS],
          bpm: SIX_BPM,
          metre: g === 'twos' ? THREE_FOUR : SIX_EIGHT,
        },
      ],
      padEvery: 0.5,
      arcs: g !== 'six',
      notation: false,
      strip: false,
      compact: true,
    },
    label: HERO_CAPTION[g],
    pads: null,
  }
}

/** A play's two bars, each the six on its drums, with no click. */
export const heroParts = (view: RhythmView, g: Grouping): PlayPart[] =>
  [0, 1].map(() => ({
    view,
    bpm: () => SIX_BPM,
    click: false,
    drums: HERO_DRUMS[g],
  }))

/** Whether a hit takes a hop: the kick and the snare (FACTS 57). */
export const hops = (d: DrumHit | null): boolean =>
  d?.voice === 'kick' || d?.voice === 'snare'

export interface ColdOpen {
  readonly predict: Predict
  readonly bar: RhythmBar
  stop(): void
}

export function initColdOpen(deck: StepDeck): ColdOpen {
  const stage = q('#heroStage')
  stillSky(stage)
  // the stills wait while a live Merc may still mount, then step in
  void mercsReady.then(() => q('#duo').classList.remove('pending'))
  const fig = q('#heroFig')
  const caption = q('[data-hero-caption]', fig)
  const fair = q('[data-fair-guess]')
  const bar = mountRhythmBar({
    figure: q('#heroPads', fig),
    pads: null,
    said: q('[data-hero-said]', fig),
    // the drums are pitchless: no note sounds here
    freq: () => hz(A3),
    voice: () => 'merc',
    owner: NowPlaying,
    drum: bookDrum,
  })
  bar.show(heroView('six'))

  /** Plays the six, even or grouped; resolves false when cut short. */
  function play(what: string): Promise<boolean> {
    const g: Grouping = isGrouping(what) ? what : 'six'
    const view = heroView(g)
    if (bar.view?.label !== view.label) bar.show(view)
    caption.textContent = HERO_CAPTION[g]
    const grouped = g !== 'six'
    return bar.play(
      heroParts(bar.view ?? view, g),
      grouped
        ? {
            lead: GROUPING_LEAD,
            cue: {
              early: HOP_MS / 1000,
              on: hops,
              fire: () => {
                mercHop('blue')
                mercHop('orange')
              },
            },
          }
        : {},
    )
  }

  // the welcome tour waits for the choice, which Step 1 would answer
  let chose: (c: string) => void = () => undefined
  const chosen = new Promise<string>((resolve) => {
    chose = resolve
  })
  holdTour(chosen, () => undefined)

  const predict = mountPredict(q('#predict'), {
    play,
    // the three plays sit under the stage, outside the predict card
    plays: qa<HTMLButtonElement>('.hero-plays [data-play]'),
    revealOn: ['threes', 'twos'],
    revealAfter: 'all',
    hints: COLD_PREDICT.hints,
    onChoice: (c) => chose(c),
    // the closing line, only for a guess of "In twos", is said with the rest
    onReveal: (c) => {
      fair.hidden = c !== 'twos'
    },
  })

  // leaving the hero ends its play: a step change of the deck, by any
  // route, or the hero off screen for 600 ms, a hidden page or a page gone
  const stop = (): void => bar.stop()
  deck.subscribe(stop)
  onLeave(stage, stop)
  return { predict, bar, stop }
}
