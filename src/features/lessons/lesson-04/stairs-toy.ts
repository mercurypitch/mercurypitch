// ============================================================
// Lesson 4 staircase toy — the steps' stage, and free play's
// ============================================================
//
// The full staircase in five states and free play (WEB-SPEC, Toys 1). Over
// the drawing sit real buttons, one per stair, so every stair plays by
// keyboard and says its name ("Stair 3, mi, F sharp 4"); Group's brackets
// are buttons too. The start is a slider (C4 to B4, arrow keys a semitone,
// Home and End to C and B) between Start lower and Start higher. One action
// per tap: a stair plays its note; a key of the strip plays in steps 1 and
// 2 and, from step 3 on, makes that key do. With a mouse or pen a vertical
// drag on the staircase slides it, and a pointer that moves more than 6 px
// is a drag, not a tap. On touch the figure keeps `touch-action: pan-y`, so
// a vertical swipe scrolls the page and the buttons and keys slide instead.
// A slide is silent; Play up plays the scale from the new start.

import { clamp, q, qa, wait } from '@/features/lessons/kit/dom'
import { stripHit } from '@/features/lessons/kit/key-strip'
import { majorScale, scaleNotes, whiteKeysFrom, } from '@/features/lessons/kit/major-scale'
import type { ModeStore } from '@/features/lessons/kit/names'
import { bindModeToggle } from '@/features/lessons/kit/names'
import type { NamesMode } from '@/features/lessons/kit/names-modes'
import { isBlack, signName } from '@/features/lessons/kit/notes'
import { Sound } from '@/features/lessons/kit/sound'
import { groupOf, landOnDo, scaleDown, scaleUp, stopOnTi, whiteKeysRun, } from './examples'
import type { StairsCore } from './stairs-core'
import { mountStairs } from './stairs-core'
import type { StairsLayout } from './stairs-geometry'
import { findParts, groupName, place } from './stairs-parts'
import { readout, sliderText, stairLabel, START_HI, START_LO, stopSaid, summary, whiteKeysSaid, } from './stairs-words'

/** A step of the deck, or the Wrap's free play, which has every control. */
export type StairsStep = 1 | 2 | 3 | 4 | 5 | 'free'

interface Features {
  readonly group: boolean
  readonly white: boolean
  readonly slide: boolean
  readonly names: boolean
  readonly stop: boolean
  /** A key of the strip plays its note (steps 1 and 2) rather than becoming do. */
  readonly keysPlay: boolean
}

const NONE: Features = {
  group: false,
  white: false,
  slide: false,
  names: false,
  stop: false,
  keysPlay: true,
}

const FEATURES: Readonly<Record<string, Features>> = {
  1: NONE,
  2: { ...NONE, group: true },
  3: { ...NONE, white: true, slide: true, keysPlay: false },
  4: { ...NONE, names: true, slide: true, keysPlay: false },
  5: { ...NONE, stop: true, slide: true, keysPlay: false },
  free: {
    group: true,
    white: true,
    slide: true,
    names: true,
    stop: true,
    keysPlay: false,
  },
}

/** How far a pointer moves before a tap becomes a drag (as on Lesson 1's spiral). */
const DRAG_PX = 6
/** A tapped stair's or key's note, seconds. */
const TAP_SEC = 0.6

export interface StairsToy {
  readonly core: StairsCore
  setStep(step: StairsStep): void
  /** Slides to `midi` and waits for the travel to land. */
  slideTo(midi: number): Promise<void>
  /** Play up, from the current start. */
  playUp(audible: boolean): Promise<void>
  /** White keys only from the current start, its overlay on. */
  playWhite(audible: boolean): Promise<void>
  /** Stops the sound, and the summary a slide has queued. */
  stop(): void
}

export interface StairsToyOptions {
  readonly active: () => boolean
  readonly names: ModeStore<NamesMode>
}

/** The start a key of the strip makes: its own pitch if it can be a start, else the same letter an octave or two down. */
export function startFromKey(midi: number): number {
  let m = midi
  while (m > START_HI) m -= 12
  return m
}

export function mountStairsToy(
  root: HTMLElement,
  opts: StairsToyOptions,
): StairsToy {
  const p = findParts(root)
  let features: Features = FEATURES[1]
  let step: StairsStep = 1
  let slow = false
  let goldEarned = false
  let summaryTimer = 0
  const core = mountStairs({
    canvas: q<HTMLCanvasElement>('canvas', p.viz),
    compact: false,
    active: opts.active,
    names: () => opts.names.mode,
    onLayout: layOut,
  })
  core.set({ steps: true })

  function layOut(L: StairsLayout): void {
    L.stairs.forEach((st, i) => place(p.stairBtns[i], st.zone))
    L.brackets.forEach((b, g) => place(p.bracketBtns[g], b.zone))
  }

  // an event's line wins over the summary a slide has queued
  const say = (line: string): void => {
    window.clearTimeout(summaryTimer)
    p.said.textContent = line
  }

  const speed = (): number => (slow ? 2 : 1)

  /** Every word that follows the start: the stairs' names, the readout, the slider. */
  function relabel(): void {
    const t = core.tonic
    p.stairBtns.forEach((b, i) =>
      b.setAttribute('aria-label', stairLabel(i, t)),
    )
    p.bracketBtns.forEach((b, g) =>
      b.setAttribute('aria-label', groupName(t, g)),
    )
    p.readoutEl.innerHTML = readout(t)
    p.description.textContent = summary(t)
    if (p.slider !== null) {
      p.slider.setAttribute('aria-valuenow', String(t))
      p.slider.setAttribute('aria-valuetext', sliderText(t))
    }
    if (p.sliderValue !== null)
      p.sliderValue.textContent = `Do is ${signName(majorScale(t)[0])}`
    qa<HTMLButtonElement>('[data-slide]', root).forEach((b) => {
      const d = Number(b.dataset.slide)
      b.disabled = (d < 0 && t <= START_LO) || (d > 0 && t >= START_HI)
    })
    syncWhite()
  }

  /** White keys only is off from a black-key start, and an overlay already showing goes. */
  function syncWhite(): void {
    const black = isBlack(core.tonic)
    const btn = root.querySelector<HTMLButtonElement>('[data-stairs-white]')
    if (black && core.switches.white) core.set({ white: false })
    btn?.setAttribute('aria-disabled', String(black))
    btn?.setAttribute('aria-pressed', String(core.switches.white))
    if (p.whiteHint !== null) p.whiteHint.hidden = !(features.white && black)
    if (p.whiteNote !== null)
      p.whiteNote.hidden = !(core.switches.white && core.tonic % 12 === 0)
  }

  function slide(midi: number): void {
    if (!features.slide) return
    const next = clamp(midi, START_LO, START_HI)
    if (next === core.tonic) return
    core.stop()
    core.set({ waiting: false, home: false })
    core.setTonic(next)
    relabel()
    window.clearTimeout(summaryTimer)
    summaryTimer = window.setTimeout(() => say(summary(core.tonic)), 700)
  }

  async function playUp(audible: boolean): Promise<void> {
    core.set({ waiting: false, home: false })
    await core.play(scaleUp(core.tonic, speed()), audible)
    if (step === 1 || step === 2) {
      goldEarned = true
      core.set({ gold: true })
    }
  }

  // ti, held: the top stair is left an outline, with the arrow up from ti
  async function stopTi(audible: boolean): Promise<void> {
    const events = stopOnTi(core.tonic, speed())
    core.set({ waiting: false, home: false })
    await core.play(events, audible, {
      onNote: (_e, i) => {
        if (i !== events.length - 1) return
        core.set({ waiting: true })
        say(stopSaid(core.tonic))
      },
    })
  }

  async function landDo(audible: boolean): Promise<void> {
    await core.play(landOnDo(core.tonic, speed()), audible, {
      onNote: (_e, i) => {
        if (i === 1) core.set({ waiting: false, home: true })
      },
    })
  }

  async function playWhite(audible: boolean): Promise<void> {
    if (whiteKeysFrom(core.tonic) === null) return
    core.set({ white: true, waiting: false, home: false })
    syncWhite()
    say(whiteKeysSaid(core.tonic) ?? '')
    await core.play(whiteKeysRun(core.tonic, speed()), audible, {
      overlay: true,
    })
  }

  const PLAYS: Readonly<Record<string, (audible: boolean) => Promise<void>>> = {
    up: playUp,
    down: (audible) => core.play(scaleDown(core.tonic, speed()), audible),
    stop: stopTi,
    land: landDo,
  }

  function bindPlays(): void {
    for (const b of qa<HTMLButtonElement>('[data-stairs-play]', root)) {
      b.addEventListener('click', () => {
        const run = PLAYS[b.dataset.stairsPlay ?? '']
        if (run === undefined || core.busy) return
        b.classList.add('is-on')
        void run(Sound.canPlay()).then(() => b.classList.remove('is-on'))
      })
    }
    p.stairBtns.forEach((b, i) =>
      b.addEventListener('click', () => {
        const midi = scaleNotes(core.tonic)[i]
        void core.play([{ midi, at: 0, dur: TAP_SEC }], Sound.canPlay())
      }),
    )
    p.bracketBtns.forEach((b, g) =>
      b.addEventListener('click', () => {
        void core.play(
          groupOf(core.tonic, g === 0 ? 0 : 1, speed()),
          Sound.canPlay(),
        )
      }),
    )
  }

  function bindSwitches(): void {
    const slowBtn = root.querySelector<HTMLButtonElement>('[data-stairs-slow]')
    slowBtn?.addEventListener('click', () => {
      slow = !slow
      slowBtn.setAttribute('aria-pressed', String(slow))
    })
    const groupBtn = root.querySelector<HTMLButtonElement>(
      '[data-stairs-group]',
    )
    groupBtn?.addEventListener('click', () => {
      const on = !core.switches.group
      core.set({ group: on })
      groupBtn.setAttribute('aria-pressed', String(on))
      p.bracketBtns.forEach((b) => {
        b.hidden = !on
      })
      if (on) core.flashBrackets()
    })
    const whiteBtn = root.querySelector<HTMLButtonElement>(
      '[data-stairs-white]',
    )
    whiteBtn?.addEventListener('click', () => {
      if (isBlack(core.tonic)) {
        say('Start on a white key to compare.')
        return
      }
      if (core.switches.white) {
        core.stop()
        core.set({ white: false })
        syncWhite()
        return
      }
      void playWhite(Sound.canPlay())
    })
  }

  function bindSlider(): void {
    qa<HTMLButtonElement>('[data-slide]', root).forEach((b) =>
      b.addEventListener('click', () =>
        slide(core.tonic + Number(b.dataset.slide)),
      ),
    )
    p.slider?.addEventListener('keydown', (e) => {
      const to: Readonly<Record<string, number>> = {
        ArrowUp: core.tonic + 1,
        ArrowRight: core.tonic + 1,
        ArrowDown: core.tonic - 1,
        ArrowLeft: core.tonic - 1,
        Home: START_LO,
        End: START_HI,
      }
      const next = to[e.key]
      if (next === undefined) return
      e.preventDefault()
      slide(next)
    })
  }

  // one action per pointer: a tap plays or slides, a drag (mouse or pen) slides
  function bindPointer(): void {
    let down: { x: number; y: number; tonic: number; id: number } | null = null
    let dragged = false
    const canvas = q('canvas', p.viz)
    const local = (e: PointerEvent): { x: number; y: number } => {
      const r = canvas.getBoundingClientRect()
      return { x: e.clientX - r.left, y: e.clientY - r.top }
    }
    p.viz.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return
      down = { ...local(e), tonic: core.tonic, id: e.pointerId }
      dragged = false
    })
    p.viz.addEventListener('pointermove', (e) => {
      if (down === null || e.pointerId !== down.id) return
      const at = local(e)
      const dy = at.y - down.y
      if (!dragged && Math.hypot(at.x - down.x, dy) <= DRAG_PX) return
      if (!dragged) {
        dragged = true
        if (e.pointerType !== 'touch' && features.slide)
          p.viz.setPointerCapture(e.pointerId)
      }
      if (e.pointerType === 'touch' || !features.slide) return
      const rowH = core.layout?.rowH ?? 12
      slide(down.tonic - Math.round(dy / rowH))
    })
    const end = (e: PointerEvent): void => {
      if (down === null || e.pointerId !== down.id) return
      const tap = !dragged
      const at = local(e)
      down = null
      if (!tap) return
      const onButton =
        e.target instanceof Element && e.target.closest('button') !== null
      if (!onButton) tapKey(at.x, at.y)
    }
    p.viz.addEventListener('pointerup', end)
    p.viz.addEventListener('pointercancel', () => {
      down = null
    })
    // a drag that ends on a stair is not a press of it
    p.viz.addEventListener(
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

  function tapKey(x: number, y: number): void {
    const strip = core.layout?.strip ?? null
    const midi = strip === null ? null : stripHit(strip, x, y)
    if (midi === null) return
    if (features.keysPlay) {
      void core.play([{ midi, at: 0, dur: TAP_SEC }], Sound.canPlay())
      return
    }
    slide(startFromKey(midi))
  }

  function show(selector: string, on: boolean): void {
    qa(selector, root).forEach((el) => {
      el.hidden = !on
    })
  }

  function setStep(next: StairsStep): void {
    step = next
    features = FEATURES[String(next)]
    core.stop()
    if (next === 1 || next === 2) {
      // steps 1 and 2 stand on C
      core.setTonic(START_LO)
    }
    if (!features.group) {
      core.set({ group: false })
      p.bracketBtns.forEach((b) => {
        b.hidden = true
      })
    }
    if (!features.white) core.set({ white: false })
    if (!features.stop) core.set({ waiting: false, home: false })
    core.set({ gold: goldEarned && (next === 1 || next === 2) })
    show('[data-stairs-group]', features.group)
    show('[data-stairs-white]', features.white)
    show('[data-stairs-play="stop"], [data-stairs-play="land"]', features.stop)
    show('[data-slide-row]', features.slide)
    show('[data-names-bar]', features.names)
    root
      .querySelector('[data-stairs-group]')
      ?.setAttribute('aria-pressed', String(core.switches.group))
    relabel()
  }

  bindPlays()
  bindSwitches()
  bindSlider()
  bindPointer()
  const namesBar = root.querySelector<HTMLElement>('[data-names-bar]')
  if (namesBar !== null) bindModeToggle(namesBar, opts.names, 'data-names')
  setStep(1)

  return {
    core,
    setStep,
    async slideTo(midi) {
      const was = features
      features = { ...features, slide: true }
      slide(midi)
      features = was
      await wait(core.travel)
    },
    playUp,
    playWhite,
    stop: () => {
      window.clearTimeout(summaryTimer)
      core.stop()
    },
  }
}
