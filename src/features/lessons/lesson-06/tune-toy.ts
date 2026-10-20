// ============================================================
// Lesson 6 tune toy — the steps' tune line, and free play's
// ============================================================
//
// The kit's tune line in its five step states and free play (WEB-SPEC,
// Toys 1): the contour on C; both lines with their gaps numbered; the slide
// with the names switch; Swap sizes; the named intervals; and free play,
// every control on one stage. Over the drawing sit real buttons: every bead
// plays its note ("Note 3 of 7, F 5, twin"), every gap its two ("Gap 2: up 7
// semitones, a leap"), every bracket its interval. They follow the controls
// in reading order: Play, Slow, the slider and its buttons, the toggles and
// the names switch, then the beads and gaps, line 1 before line 2.
//
// The start is a slider (C4 to B4, arrow keys a semitone, Home and End to
// C4 and B4) between Start lower and Start higher, or, with a mouse or pen,
// a vertical drag on the line; on touch the figure keeps `touch-action:
// pan-y`, so a swipe scrolls the page and the buttons slide. A slide is
// silent: the line lifts, travels and settles, the gap numbers glow gold
// once, unchanged, and the readout names the new start. Play plays the line
// from wherever it stands. Steps 1, 2, 4 and 5 stand on C: arriving at one
// slides the line home.

import { clamp, q, qa } from '@/features/lessons/kit/dom'
import type { ModeStore } from '@/features/lessons/kit/names'
import { bindModeToggle } from '@/features/lessons/kit/names'
import { COLOR } from '@/features/lessons/kit/notes'
import { Sound } from '@/features/lessons/kit/sound'
import type { TuneLine, TuneShape } from '@/features/lessons/kit/tune-line'
import { mountTuneLine } from '@/features/lessons/kit/tune-line'
import { BEAT_SEC, bothLines, firstLine, pair, swappedLine } from './examples'
import { C4, semitonesOf, START_HI, START_LO, TWINKLE } from './melody'
import type { NamesMode } from './tune-words'
import { BRACKET_GAPS, bracketLabel, bracketText, drawnName, gapLabel, gapWords, noteLabel, readoutHtml, readoutSaid, sliderHtml, sliderText, summary, SWAP_SAID, swapOverlay, } from './tune-words'

/** A step of the deck, or the Wrap's free play, which has every control. */
export type TuneStep = 1 | 2 | 3 | 4 | 5 | 'free'

/** The tune as the kit draws it: each note's semitones above do, and its length. */
export const TUNE = TWINKLE.map((line) =>
  line.map((n) => ({ at: semitonesOf(n.degree), beats: n.beats })),
)

/** One line on C4 to G♯5, so a slide to B4 still fits (FACTS 62a). */
const ONE_LINE: readonly [number, number] = [60, 80]

const BRACKETS = BRACKET_GAPS.map((gap) => ({ gap, label: bracketText(gap) }))

interface Features {
  readonly shape: TuneShape
  readonly slide: boolean
  readonly swap: boolean
  readonly names: boolean
}

const BASE: TuneShape = {
  lines: [0],
  window: ONE_LINE,
  fill: false,
  names: true,
  below: 'gaps',
  beadButtons: true,
  gapButtons: false,
  brackets: [],
  ghost: null,
}

const OFF = { slide: false, swap: false, names: false }

const FEATURES: Readonly<Record<string, Features>> = {
  1: { ...OFF, shape: { ...BASE, below: 'marks' } },
  2: {
    ...OFF,
    shape: { ...BASE, lines: [0, 1], window: null, gapButtons: true },
  },
  3: { ...OFF, slide: true, names: true, shape: { ...BASE, ghost: C4 } },
  4: { ...OFF, swap: true, shape: BASE },
  5: {
    ...OFF,
    shape: {
      ...BASE,
      lines: [0, 1],
      window: null,
      below: null,
      brackets: BRACKETS,
    },
  },
  free: {
    slide: true,
    swap: true,
    names: true,
    shape: {
      ...BASE,
      lines: [0, 1],
      window: null,
      gapButtons: true,
      brackets: BRACKETS,
    },
  },
}

/** How far a pointer moves before a tap becomes a drag (as on Lesson 4's staircase). */
const DRAG_PX = 6

export interface TuneToy {
  readonly core: TuneLine
  setStep(step: TuneStep): void
  /** The first line from the current start, as the predict plays it. */
  playLine(audible: boolean): Promise<void>
  /** The swapped version over the line, as the predict plays it; it fades once played unless Swap sizes is on. */
  playSwapped(audible: boolean): Promise<void>
  stop(): void
}

export interface TuneToyOptions {
  readonly active: () => boolean
  readonly names: ModeStore<NamesMode>
}

export function mountTuneToy(root: HTMLElement, opts: TuneToyOptions): TuneToy {
  const viz = q('[data-tune-viz]', root)
  const hits = q('[data-tune-hits]', root)
  const said = q('[data-tune-said]', root)
  const description = q('[data-tune-summary]', root)
  const readout = root.querySelector<HTMLElement>('[data-tune-readout]')
  const slider = root.querySelector<HTMLElement>('[data-start-slider]')
  const sliderValue = root.querySelector<HTMLElement>('[data-start-value]')
  const playBtn = q<HTMLButtonElement>('[data-tune-play]', root)
  const slowBtn = q<HTMLButtonElement>('[data-tune-slow]', root)
  const swapBtn = root.querySelector<HTMLButtonElement>('[data-tune-swap]')
  let features: Features = FEATURES[1]
  let slow = false
  let swapped = false
  let landTimer = 0
  // the line's start, as the words follow it (the core's own moves with it)
  let start = C4

  const shownCount = (): number => (features.shape.lines.length === 1 ? 7 : 14)
  const mode = (): NamesMode => opts.names.mode

  const core = mountTuneLine({
    canvas: q<HTMLCanvasElement>('canvas', viz),
    hits,
    tune: TUNE,
    start,
    shape: features.shape,
    active: opts.active,
    name: (g, at) => drawnName(g, at, mode()),
    gapWords,
    labels: {
      note: (g) => noteLabel(g, shownCount(), start, mode()),
      gap: gapLabel,
      bracket: (g) => bracketLabel(g, start),
    },
    onNote: (g) => tapNote(g),
    onGap: (g) => tapPair(g),
    onBracket: (g) => tapPair(g),
  })

  const speed = (): number => (slow ? 2 : 1)
  const midiOf = (g: number): number => start + TUNE.flat()[g].at

  function tapNote(g: number): void {
    const beats = TUNE.flat()[g].beats
    void core.play(
      [{ midi: midiOf(g), at: 0, dur: beats * BEAT_SEC * speed() }],
      Sound.canPlay(),
      { notes: [g] },
    )
  }

  /** A gap or a bracket: its two notes, 0.6 s and 0.8 s, 0.15 s apart (FACTS 64). */
  function tapPair(g: number): void {
    void core.play(pair(midiOf(g), midiOf(g + 1), speed()), Sound.canPlay(), {
      notes: [g, g + 1],
    })
  }

  /** Every word that follows the start or the names: the buttons, the summary, the readout, the slider. */
  function relabel(): void {
    const t = start
    core.relabel()
    description.textContent = summary(t, features.shape.lines.length, mode())
    if (readout !== null) readout.innerHTML = readoutHtml(t)
    if (slider !== null) {
      slider.setAttribute('aria-valuenow', String(t))
      slider.setAttribute('aria-valuetext', sliderText(t))
    }
    if (sliderValue !== null) sliderValue.innerHTML = sliderHtml(t)
    qa<HTMLButtonElement>('[data-slide]', root).forEach((b) => {
      const d = Number(b.dataset.slide)
      b.disabled = (d < 0 && t <= START_LO) || (d > 0 && t >= START_HI)
    })
  }

  /** A slide, silent; the readout's line is said once the line has landed. */
  function slide(midi: number, announce = true): number {
    const next = clamp(Math.round(midi), START_LO, START_HI)
    if (next === start) return 0
    core.stop()
    const lands = core.setStart(next)
    start = next
    relabel()
    window.clearTimeout(landTimer)
    if (announce)
      landTimer = window.setTimeout(
        () => {
          said.textContent = readoutSaid(start)
        },
        lands * 1000 + 100,
      )
    return lands
  }

  function setSwap(on: boolean): void {
    swapped = on
    core.setOverlay(on ? swapOverlay() : null)
    swapBtn?.setAttribute('aria-pressed', String(on))
  }

  async function playLine(audible: boolean): Promise<void> {
    const events =
      features.shape.lines.length === 1
        ? firstLine(start, speed())
        : bothLines(start, speed())
    playBtn.classList.add('is-on')
    await core.play(events, audible)
    playBtn.classList.remove('is-on')
  }

  async function playSwappedOverlay(audible: boolean): Promise<void> {
    core.setOverlay(swapOverlay())
    await core.play(swappedLine(start, speed()), audible, {
      overlay: true,
      color: COLOR.ink2,
    })
    if (!swapped) core.setOverlay(null)
  }

  function bindControls(): void {
    playBtn.addEventListener('click', () => void playLine(Sound.canPlay()))
    slowBtn.addEventListener('click', () => {
      slow = !slow
      slowBtn.setAttribute('aria-pressed', String(slow))
    })
    swapBtn?.addEventListener('click', () => {
      if (swapped) {
        core.stop()
        setSwap(false)
        said.textContent = SWAP_SAID.off
        return
      }
      setSwap(true)
      said.textContent = SWAP_SAID.on
      void playSwappedOverlay(Sound.canPlay())
    })
    qa<HTMLButtonElement>('[data-slide]', root).forEach((b) =>
      b.addEventListener('click', () => slide(start + Number(b.dataset.slide))),
    )
    slider?.addEventListener('keydown', (e) => {
      const to: Readonly<Record<string, number>> = {
        ArrowUp: start + 1,
        ArrowRight: start + 1,
        ArrowDown: start - 1,
        ArrowLeft: start - 1,
        Home: START_LO,
        End: START_HI,
      }
      const next = to[e.key]
      if (next === undefined) return
      e.preventDefault()
      slide(next)
    })
  }

  // one action per pointer: a tap plays, a drag (mouse or pen) slides
  function bindPointer(): void {
    let down: { y: number; x: number; start: number; id: number } | null = null
    let dragged = false
    hits.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return
      down = { x: e.clientX, y: e.clientY, start, id: e.pointerId }
      dragged = false
    })
    hits.addEventListener('pointermove', (e) => {
      if (down === null || e.pointerId !== down.id) return
      const dy = e.clientY - down.y
      if (!dragged && Math.hypot(e.clientX - down.x, dy) <= DRAG_PX) return
      if (!dragged) {
        dragged = true
        if (e.pointerType !== 'touch' && features.slide)
          hits.setPointerCapture(e.pointerId)
      }
      if (e.pointerType === 'touch' || !features.slide) return
      const rowH = core.layout?.lines[0]?.rowGap ?? 9
      slide(down.start - Math.round(dy / Math.max(4, rowH)))
    })
    const end = (e: PointerEvent): void => {
      if (down !== null && e.pointerId === down.id) down = null
    }
    hits.addEventListener('pointerup', end)
    hits.addEventListener('pointercancel', end)
    // a drag that ends on a bead is not a press of it
    hits.addEventListener(
      'click',
      (e) => {
        if (!dragged) return
        dragged = false
        e.stopPropagation()
        e.preventDefault()
      },
      true,
    )
  }

  function show(selector: string, on: boolean): void {
    qa(selector, root).forEach((el) => {
      el.hidden = !on
    })
  }

  function setStep(next: TuneStep): void {
    features = FEATURES[String(next)]
    core.stop()
    if (!features.swap) setSwap(false)
    core.setShape(features.shape)
    // the steps that stand on C slide the line home; free play keeps its start
    if (next !== 3 && next !== 'free') slide(C4, false)
    show('[data-slide-row]', features.slide)
    show('[data-tune-readout]', features.slide)
    show('[data-tune-swap]', features.swap)
    show('[data-names-bar]', features.names)
    viz.dataset.shape =
      features.shape.lines.length === 1
        ? 'one'
        : next === 'free'
          ? 'free'
          : 'two'
    relabel()
  }

  bindControls()
  bindPointer()
  const namesBar = root.querySelector<HTMLElement>('[data-names-bar]')
  if (namesBar !== null) bindModeToggle(namesBar, opts.names, 'data-names')
  opts.names.subscribe(() => relabel())
  setStep(1)

  return {
    core,
    setStep,
    playLine,
    playSwapped: playSwappedOverlay,
    stop: () => core.stop(),
  }
}
