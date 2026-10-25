// ============================================================
// Lesson 9 steps — five steps, one ladder chart
// ============================================================
//
// Every step shows the one ladder chart (`toyFor: () => 1`), each in its own
// state (WEB-SPEC, Toys 1): a step and a leap over the folds; hear it first;
// the ladder; the five leaps in order; a landing. Each step's controls are
// in the one toy, each marked with the steps it shows on (`data-part`, a
// list of step numbers), so no two controls on the stage ever share a name
// and Slow serves all five. The figure's label, which parts show and the
// chart's state follow the step, through the deck's `onStep`, whatever the
// route (Next or Back, a swipe, the lesson menu, an address that names a
// step, the quiz's step links); the chart draws only while the stage shows
// it, and the status line starts each step empty.
//
// Each play is a phrase of Merc's notes, 1.0 s each (FACTS 92), the page's
// one sound (kit/now-playing.ts): a press stops the sound before it,
// anywhere on the page, and a newer one stops it. The chart draws it as it
// sounds (ladder-chart.ts), a polite status line names it (lines.ts), and
// the Merc of the chart's voice sings each note. Slow (`aria-pressed`)
// doubles every length and onset, never a pitch. Step 1's Step and Leap
// say the folds' change as a ratio and sing the folds strip under the
// chart (folds-strip.ts); Step 2's Hear it first plays so alone, lighting
// its band, and its Leap names the move alone, beside Step 2's
// illustrated copy, which the chart draws from the start. With sound off a
// play still draws, and the kit's hint says why nothing was heard
// (`Sound.canPlay`). The other steps' plays are wired separately; until
// then their controls do nothing.

import { q, qa } from '@/features/lessons/kit/dom'
import type { Which } from '@/features/lessons/kit/merc-duo'
import { mercSing } from '@/features/lessons/kit/merc-duo'
import { hz } from '@/features/lessons/kit/notes'
import { NowPlaying } from '@/features/lessons/kit/now-playing'
import type { Run } from '@/features/lessons/kit/run'
import { playNotes } from '@/features/lessons/kit/run'
import { Sound } from '@/features/lessons/kit/sound'
import type { StepDeck } from '@/features/lessons/kit/step-deck'
import { registerToy } from '@/features/lessons/kit/step-deck'
import type { Voice } from '@/features/lessons/kit/voice-choice'
import { mercOf, VoiceChoice } from '@/features/lessons/kit/voice-choice'
import type { FoldsStrip } from './folds-strip'
import { mountFoldsStrip } from './folds-strip'
import type { LadderChart, Phrase, PhraseDrawing } from './ladder-chart'
import { mountLadderChart } from './ladder-chart'
import type { ChartState } from './ladder-data'
import { foldsLine, HEAR_LINE, moveLine } from './lines'
import { hearFirstNotes, leapNotes, MERC_LEAP, SLOW, stepNotes } from './sounds'

/** Each step's figure label. */
export const FIG: Readonly<Record<number, string>> = {
  1: '<span class="fig">Fig. 1</span> A step and a leap, and the folds slowed 220 times',
  2: '<span class="fig">Fig. 2</span> Hear it first, then leap',
  3: '<span class="fig">Fig. 3</span> Every rung of the ladder',
  4: '<span class="fig">Fig. 4</span> Five leaps, small ones first',
  5: '<span class="fig">Fig. 5</span> A landing, and an adjustment',
}

/** Each step's state of the chart (WEB-SPEC, Toys 1). */
export const STEP_STATE: Readonly<Record<number, ChartState>> = {
  1: 'step',
  2: 'hear',
  3: 'ladder',
  4: 'order',
  5: 'landing',
}

/** The steps a part shows on, from its `data-part` list ("1 2"). */
export const partSteps = (el: Element): readonly number[] =>
  (el.getAttribute('data-part') ?? '')
    .split(/\s+/)
    .filter((word) => word !== '')
    .map(Number)

/** Shows the parts of `root` that step `n` uses, and hides the rest. */
export function showParts(root: ParentNode, n: number): void {
  for (const el of qa<HTMLElement>('[data-part]', root))
    el.hidden = !partSteps(el).includes(n)
}

// -------------------------------------------------------------- the plays

/** The plays of Merc's notes on the steps' row (`data-ladder-play`). */
export type PlayId = 'step' | 'hear' | 'leap'

const PLAY_IDS: readonly PlayId[] = ['step', 'hear', 'leap']

const isPlayId = (id: string | undefined): id is PlayId =>
  (PLAY_IDS as readonly (string | undefined)[]).includes(id)

/** A play: the phrase it sounds and the chart draws, and what the status line says of it. */
export interface StepPlay {
  readonly phrase: Phrase
  /** The status as it starts; empty clears the line. */
  readonly said: string
  /** Its notes sing the folds strip: Step 1's. */
  readonly folds: boolean
}

/** A leap's two notes, its arc drawn as the second starts. */
const ONE_LEAP: Phrase['leaps'] = [[0, 1]]

/**
 * What each play sounds and says on do `d`, pressed on step `n`; `slow` 2
 * under Slow (FACTS 92). Leap serves Steps 1 and 2: on Step 1 it says the
 * folds' change too, and sings them.
 */
const PLAYS: Readonly<
  Record<PlayId, (d: number, slow: number, n: number) => StepPlay>
> = {
  step: (d, slow) => ({
    phrase: { notes: stepNotes(d, slow) },
    said: foldsLine(d, 'step'),
    folds: true,
  }),
  leap: (d, slow, n) => ({
    phrase: { notes: leapNotes(d, MERC_LEAP, slow), leaps: ONE_LEAP },
    said: n === 1 ? foldsLine(d, 'leap') : moveLine(d, 'leap'),
    folds: n === 1,
  }),
  hear: (d, slow) => ({
    phrase: { notes: hearFirstNotes(d, slow) },
    said: HEAR_LINE,
    folds: false,
  }),
}

/** What play `id` sounds and says on do `d`, pressed on step `n`; `slow` 2 under Slow. */
export const stepPlay = (
  id: PlayId,
  d: number,
  slow: number,
  n: number,
): StepPlay => PLAYS[id](d, slow, n)

// -------------------------------------------------------------- the steps

export interface Steps {
  readonly ladder: LadderChart
  readonly strip: FoldsStrip
}

/** Follows the deck: registered before `deck.start()`, so an address that names a step opens it. */
export function initSteps(deck: StepDeck): Steps {
  const root = q('#toyLadder')
  const label = q('[data-fig-label]', root)
  const status = q('[data-ladder-status]', root)
  const slowBtn = q<HTMLButtonElement>('[data-ladder-slow]', root)
  const stripCanvas = q<HTMLCanvasElement>('[data-folds-strip]', root)
  const active = deck.toyActive(1)
  const ladder = mountLadderChart(q('[data-ladder-viz]', root), {
    state: STEP_STATE[1],
    active,
  })
  const strip = mountFoldsStrip(stripCanvas, {
    active: () => active() && !stripCanvas.hidden,
    restHz: () => hz(ladder.doMidi),
  })

  let run: Run | null = null
  let drawing: PhraseDrawing | null = null
  let pressed: HTMLButtonElement | null = null
  let sung: { readonly which: Which; readonly midi: number } | null = null

  /** The status line, written only when it changes, so a polite region says each line once. */
  function say(line: string): void {
    if (status.textContent !== line) status.textContent = line
  }

  /** The play's end, by itself or cut short: the button, the folds and the Merc at rest. */
  function rest(): void {
    pressed?.classList.remove('is-on')
    pressed = null
    strip.rest()
    if (sung !== null) mercSing(sung.which, sung.midi, false)
    sung = null
  }

  /** Stops the play where it stands: its sound, its drawing, its button. */
  function stop(): void {
    run?.stop()
    run = null
    drawing?.cancel()
    drawing = null
    rest()
    NowPlaying.release(stop)
  }

  async function play(btn: HTMLButtonElement, id: PlayId): Promise<void> {
    stop()
    NowPlaying.claim(stop)
    const p = stepPlay(id, ladder.doMidi, slow() ? SLOW : 1, deck.current)
    say(p.said)
    const which = mercOf(ladder.voice)
    const d = ladder.play(p.phrase)
    const r = playNotes(p.phrase.notes, {
      audible: Sound.canPlay(),
      onNote: (n, i) => {
        d.note(i)
        if (p.folds) strip.sing(hz(n.midi))
        sung = { which, midi: n.midi }
        mercSing(which, n.midi, true)
      },
    })
    run = r
    drawing = d
    pressed = btn
    btn.classList.add('is-on')
    const heard = await r.done
    // a newer play, or a stop, has taken over
    if (run !== r) return
    run = null
    drawing = null
    // heard to its end, the phrase stays drawn; cut short as every sound
    // stopped (the Sound switch, a hidden page), the chart rests
    if (heard) d.end()
    else d.cancel()
    rest()
    NowPlaying.release(stop)
  }

  const slow = (): boolean => slowBtn.getAttribute('aria-pressed') === 'true'
  slowBtn.addEventListener('click', () => {
    slowBtn.setAttribute('aria-pressed', String(!slow()))
  })

  for (const btn of qa<HTMLButtonElement>('[data-ladder-play]', root)) {
    const id = btn.dataset.ladderPlay
    if (isPlayId(id)) btn.addEventListener('click', () => void play(btn, id))
  }

  // a voice chosen in Sing it moves do: the chart lays itself out again,
  // and a play on the old do stops
  let voice: Voice = ladder.voice
  VoiceChoice.subscribe((v) => {
    const next = v ?? 'lower'
    if (next === voice) return
    voice = next
    stop()
  })

  registerToy({
    onStep(n, previous) {
      // the step showing shown again, as the phone deck and the wide page
      // swap at a rotation or a resize, or Step 1 as the deck starts: the
      // markup already shows it
      if (n === previous) return
      showParts(root, n)
      label.innerHTML = FIG[n] ?? FIG[1]
      say('')
      ladder.show(STEP_STATE[n] ?? STEP_STATE[1])
    },
  })
  return { ladder, strip }
}
