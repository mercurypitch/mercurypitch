// ============================================================
// Lesson 26's steps' toy — the tune line with a second voice beside it
// ============================================================
//
// One toy in five places, Steps 1 to 4 and free play (WEB-SPEC, Toys 2):
// the kit's tune line (kit/tune-line.ts) drawing each step's state, its
// shape, words and plays described in part-shapes.ts. Step 1 walks a pair
// up the scale with Step up and Step down, each step playing its two notes
// together, the button at an end `aria-disabled` rather than disabled, so
// the focus stays on it; Step 2's switch moves the copy between C major's
// thirds and four semitones up, the beads that change sliding (the kit's
// part slide); Step 3's switch draws the part above or below, and its plays
// set it; Play Merc and Tavi redraws the band for the two singers. Free
// play adds a state switch of four buttons, one a step.
//
// Until the cold open's choice (`unlock`) every place draws the hero's
// plain "Twinkle" and its controls wait, disabled, under the lock line,
// since every state shows the answer (FACTS 40). Each state's words go on
// the canvas's name, and into the live line when the learner changes what
// it draws. A play sounds through a run (kit/run.ts) and lights the line
// on the same clock, silently, the line lighting each part's bead in its
// own colour; the page's one sound (`NowPlaying`) owns them together.

import { q, qa } from '@/features/lessons/kit/dom'
import { NowPlaying } from '@/features/lessons/kit/now-playing'
import type { PlayLight } from '@/features/lessons/kit/play-lights'
import { playLights } from '@/features/lessons/kit/play-lights'
import type { Run } from '@/features/lessons/kit/run'
import { allOf, playNotes } from '@/features/lessons/kit/run'
import { Sound } from '@/features/lessons/kit/sound'
import { showParts } from '@/features/lessons/kit/step-parts'
import type { TuneLine, TuneNote } from '@/features/lessons/kit/tune-line'
import { mountTuneLine } from '@/features/lessons/kit/tune-line'
import { DRESS } from '@/features/lessons/kit/tune-line-parts-draw'
import type { PlayId, Settings, StepState } from './part-shapes'
import { PLAIN, PLAIN_SAID, playOf, said, shapeOf, START, stateOfPlay, } from './part-shapes'
import { C4, LINES, SCALE } from './parts'

/** Every line the toy can show, as the tune line takes them. */
export const TUNE: readonly (readonly TuneNote[])[] = LINES.map((l) =>
  l.at.map((at, i) => ({ at, beats: l.beats[i] })),
)

/** Step 1's last pair: ti and the re above it. */
const LAST = SCALE.at.length - 1

export interface PartToy {
  readonly line: TuneLine
  /** The step whose state it draws once the cold open's choice has come. */
  readonly state: StepState
  readonly settings: Settings
  /** Still waiting for the cold open's choice. */
  readonly held: boolean
  /** Opens a step's state: stops what plays, its settings back to their start. */
  setState(n: StepState): void
  /** The cold open's choice: each state draws, and the controls open. */
  unlock(): void
  /** Plays `id`, with the settings it sets; true when heard to its end. */
  play(id: PlayId): Promise<boolean>
  stop(): void
}

export function mountPartToy(
  root: HTMLElement,
  o: {
    /** When it draws: its stage on screen, on its step. */
    readonly active: () => boolean
    readonly state: StepState
    readonly light?: PlayLight
  },
): PartToy {
  const light = o.light ?? playLights()
  const canvas = q<HTMLCanvasElement>('[data-tune-canvas]', root)
  const saidLine = q('[data-tune-said]', root)
  const pairBtns = qa<HTMLButtonElement>('[data-pair]', root)
  const copyBtns = qa<HTMLButtonElement>('[data-copy]', root)
  const sideBtns = qa<HTMLButtonElement>('[data-side]', root)
  const stateBtns = qa<HTMLButtonElement>('[data-state]', root)
  const playBtns = qa<HTMLButtonElement>('[data-toy-play]', root)
  const lockLine = root.querySelector<HTMLElement>('[data-lock-line]')

  let n: StepState = o.state
  let s: Settings = START
  let held = true
  let run: Run | null = null
  let token = 0

  const line = mountTuneLine({
    canvas,
    tune: TUNE,
    start: C4,
    shape: PLAIN,
    active: o.active,
    dressPainter: DRESS,
  })

  /** Draws the state as it stands, its words on the canvas, and in the live line when `speak`. */
  function draw(speak: boolean): void {
    line.setShape(held ? PLAIN : shapeOf(n, s))
    const words = held ? PLAIN_SAID : said(n, s)
    canvas.setAttribute('aria-label', words)
    if (speak) saidLine.textContent = words
  }

  function syncControls(): void {
    for (const b of pairBtns) {
      b.disabled = held
      // at an end the press does nothing, and says so, keeping the focus
      const end = Number(b.dataset.pair) < 0 ? s.pair === 0 : s.pair === LAST
      if (end) b.setAttribute('aria-disabled', 'true')
      else b.removeAttribute('aria-disabled')
    }
    for (const b of copyBtns) {
      b.disabled = held
      b.setAttribute('aria-pressed', String(b.dataset.copy === s.copy))
    }
    // the duet is neither: its band is redrawn for the two singers
    for (const b of sideBtns) {
      b.disabled = held
      b.setAttribute(
        'aria-pressed',
        String(!s.duet && b.dataset.side === s.side),
      )
    }
    for (const b of stateBtns) {
      b.disabled = held
      b.setAttribute('aria-pressed', String(Number(b.dataset.state) === n))
    }
    for (const b of playBtns) b.disabled = held
    if (lockLine !== null) lockLine.hidden = !held
  }

  // ------------------------------------------------------------ the plays

  function halt(): void {
    token += 1
    run?.stop()
    run = null
    line.stop()
    NowPlaying.release(halt)
  }

  async function play(id: PlayId): Promise<boolean> {
    if (held) return false
    halt()
    const to = stateOfPlay(id, s)
    if (to.n !== n) setState(to.n)
    if (to.s.side !== s.side || to.s.duet !== s.duet) {
      s = to.s
      syncControls()
      draw(true)
    }
    const p = playOf(id, s)
    NowPlaying.claim(halt)
    const mine = token
    const audible = Sound.canPlay()
    const sound = playNotes(p.notes, { audible, kind: p.kind })
    // the lights on the same clock, silent: the run is the sound
    const lit = line.play(p.events, false, {
      ...p.look,
      onNote: (_e, i) => {
        // Step 1's walk: the pair moves up the scale with the play
        const k = p.pairOf?.[i]
        if (mine !== token || k === undefined || k === s.pair) return
        s = { ...s, pair: k }
        syncControls()
        draw(false)
      },
    })
    const r = allOf([sound, { done: lit, stop: () => line.stop() }])
    run = r
    const heard = await r.done
    if (mine !== token) return false
    run = null
    NowPlaying.release(halt)
    return heard
  }

  // ------------------------------------------------------------ the controls

  for (const b of pairBtns)
    b.addEventListener('click', () => {
      const to = s.pair + Number(b.dataset.pair)
      if (held || to < 0 || to > LAST) return
      halt()
      s = { ...s, pair: to }
      syncControls()
      draw(true)
      light(b, play('pair'))
    })

  for (const b of copyBtns)
    b.addEventListener('click', () => {
      const copy = b.dataset.copy === 'up4' ? 'up4' : 'key'
      if (held || copy === s.copy) return
      // the sound and the drawing keep to one copy: a play stops
      halt()
      s = { ...s, copy }
      syncControls()
      draw(true)
    })

  for (const b of sideBtns)
    b.addEventListener('click', () => {
      const side = b.dataset.side === 'below' ? 'below' : 'above'
      if (held || (side === s.side && !s.duet)) return
      halt()
      s = { ...s, side, duet: false }
      syncControls()
      draw(true)
    })

  for (const b of stateBtns)
    b.addEventListener('click', () => {
      const next = Number(b.dataset.state) as StepState
      if (held || next === n) return
      setState(next)
      saidLine.textContent = said(n, s)
    })

  for (const b of playBtns) {
    const id = b.dataset.toyPlay as PlayId
    b.addEventListener('click', () => light(b, play(id)))
  }

  function setState(next: StepState): void {
    halt()
    n = next
    s = START
    showParts(root, n)
    // after the parts, which show the lock line on every step
    syncControls()
    draw(false)
  }

  showParts(root, n)
  syncControls()
  draw(false)

  return {
    line,
    get state() {
      return n
    },
    get settings() {
      return s
    },
    get held() {
      return held
    },
    setState,
    unlock() {
      if (!held) return
      held = false
      syncControls()
      draw(false)
    },
    play,
    stop: halt,
  }
}
