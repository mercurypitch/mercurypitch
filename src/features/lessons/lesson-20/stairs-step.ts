// ============================================================
// Lesson 20 Steps 1 and 2 — the staircase without fa and ti, and from la
// ============================================================
//
// Lesson 4's staircase, the kit's (stairs-core.ts), on C in the learner's
// octave, C3 for the lower voice or none stored and C4 for the higher
// (WEB-SPEC, Toys 1): each stair's syllable printed over its letter, with
// no names switch, and each riser's size in semitones in place of T and S.
// Step 1 has Play up, Leave out fa and ti (a switch, off at first) and
// Lesson 4's Slide, its starts running C3 to B3, or C4 to B4: on, the
// switch takes fa's and ti's stairs away and the stairs close up, two
// risers of three semitones where the semitones were, and Play up plays the
// five. Step 2 keeps the five, with Major · Minor and no Slide: Minor moves
// the house from C to A below it and draws the same five from A, named
// from do as do, me, fa, so, te and do (FACTS 24, 27). Free play has every
// control: Minor there takes the five from la, as Step 2's does, and puts
// the Slide away until Major brings it back, since a staircase's starts
// keep to one octave from C (stairs-geometry.ts `floorOf`).
//
// The step's own plays play here, the stairs changing as they play: C
// major then the five, the switch moving as the five starts (7.7 s); both
// fives, the house moving as A's begins (6.8 s); and the minor five on C,
// then A's five again (FACTS 80). A slide is silent, as in Lesson 4. Every
// sound is the page's one (`NowPlaying`), so a sound anywhere stops a play
// here where it stands; a stair plays its note and says its name ("Stair
// 2, me, E flat 3"), and the polite line says each change in words.

import { clamp, q, qa } from '@/features/lessons/kit/dom'
import { stripHit } from '@/features/lessons/kit/key-strip'
import { MAJOR_DEGREES, majorScale } from '@/features/lessons/kit/major-scale'
import { signName, wordName } from '@/features/lessons/kit/notes'
import { NowPlaying } from '@/features/lessons/kit/now-playing'
import type { PlayLight } from '@/features/lessons/kit/play-lights'
import { playLights } from '@/features/lessons/kit/play-lights'
import { Sound } from '@/features/lessons/kit/sound'
import type { StairsCore } from '@/features/lessons/kit/stairs-core'
import { mountStairs } from '@/features/lessons/kit/stairs-core'
import type { StairsLayout, StairsRange, } from '@/features/lessons/kit/stairs-geometry'
import { findParts, place } from '@/features/lessons/kit/stairs-parts'
import type { NoteEvent } from '@/features/lessons/kit/stairs-plays'
import { scaleUp } from '@/features/lessons/kit/stairs-plays'
import type { Degrees } from '@/features/lessons/kit/stairs-scales'
import { MAJOR_FIVE, MINOR_FIVE, sameDegrees, spellDegrees, } from '@/features/lessons/kit/stairs-scales'
import { risersSaid, sliderText, stairLabel, summary, } from '@/features/lessons/kit/stairs-words'
import type { Voice } from '@/features/lessons/kit/voice-choice'
import { BETWEEN_SEC, stairsDo } from './sounds'

/** What the staircase offers in one place on the page. */
export interface StairsState {
  /** Leave out fa and ti, a switch; without it the five are always drawn. */
  readonly fiveSwitch: boolean
  /** Lesson 4's Slide: the start slider, Start lower and Start higher, a key that makes do, a drag. */
  readonly slide: boolean
  /** Major · Minor. */
  readonly modes: boolean
}

/** Step 1's, Step 2's and free play's. */
export const STAIRS_STATES = {
  1: { fiveSwitch: true, slide: true, modes: false },
  2: { fiveSwitch: false, slide: false, modes: true },
  free: { fiveSwitch: true, slide: true, modes: true },
} as const satisfies Readonly<Record<string | number, StairsState>>

/** How far a pointer moves before a tap becomes a drag, px (Lesson 4's). */
const DRAG_PX = 6
/** A tapped stair's or key's note, s (Lesson 4's). */
const TAP_SEC = 0.6
/** How long after a slide its summary is said, ms (Lesson 4's). */
const SUMMARY_MS = 700

/** A scale's start in words, no octave: "A", "F sharp". */
const startSaid = (tonic: number, degrees: Degrees): string =>
  wordName(spellDegrees(tonic, degrees)[0], { octave: false })

/** What the switch says, on and off. */
export const fiveSaid = (on: boolean): string =>
  on
    ? `Fa and ti left out: five notes, steps of ${risersSaid(MAJOR_FIVE)} semitones.`
    : `Fa and ti back: seven notes, steps of ${risersSaid(MAJOR_DEGREES)} semitones.`

/** What Major · Minor says: "Minor: the same five notes from A, steps of 3, 2, 2, 3 and 2." */
export function modeSaid(minor: boolean, tonic: number): string {
  const degrees = minor ? MINOR_FIVE : MAJOR_FIVE
  const from = startSaid(tonic, degrees)
  return minor
    ? `Minor: the same five notes from ${from}, steps of ${risersSaid(degrees)}.`
    : `Major: the five notes from ${from}, steps of ${risersSaid(degrees)}.`
}

/** The start slider's words: Lesson 4's, or the five's, "Do is D3: D major pentatonic". */
export function sliderSaid(start: number, five: boolean): string {
  if (!five) return sliderText(start)
  const tonic = majorScale(start)[0]
  return `Do is ${wordName(tonic)}: ${wordName(tonic, { octave: false })} major pentatonic`
}

export interface StairsStep {
  readonly core: StairsCore
  /** Opens one place's controls. */
  setState(state: StairsState): void
  /** The learner's voice: the staircase on the other C. */
  setVoice(v: Voice | null): void
  /** Step 1's inline play: C major, 0.5 s, then the five, the switch moving as they start. */
  majorThenFive(): Promise<boolean>
  /** Step 2's: C's five, 0.5 s, then A's, the house moving as they start. */
  both(): Promise<boolean>
  /** Step 2's: the minor five on C, then A's five again. */
  onC(): Promise<boolean>
  stop(): void
}

/** A press's sound: whether it may still go on, and whether it sounds. */
interface Press {
  readonly mine: number
  readonly audible: boolean
}

export function mountStairsStep(
  root: HTMLElement,
  o: {
    /** When it draws: its stage on screen, on its step (the deck's `toyActive`). */
    readonly active: () => boolean
    readonly voice: Voice | null
    readonly state: StairsState
    readonly light?: PlayLight
  },
): StairsStep {
  const p = findParts(root)
  const light = o.light ?? playLights()
  const playBtn = q<HTMLButtonElement>('[data-stairs-play="up"]', root)
  const fiveBtn = q<HTMLButtonElement>('[data-stairs-five]', root)
  const modeSeg = q('[data-stairs-mode]', root)
  const modeBtns = qa<HTMLButtonElement>('[data-mode]', modeSeg)
  const slideRow = q('[data-slide-row]', root)
  const slideBtns = qa<HTMLButtonElement>('[data-slide]', root)

  let state: StairsState = o.state
  let doMidi = stairsDo(o.voice)
  /** The Slide's start: do of the major scale, or of the major five. */
  let start = doMidi
  let five = false
  let minor = false
  /** Step 2's minor five on C, while it plays. */
  let onC = false
  let token = 0
  /** A pause's wake-up, which a stop runs. */
  let pending: (() => void) | null = null
  let summaryTimer = 0

  const fives = (): boolean => five || minor || !state.fiveSwitch
  const sliding = (): boolean => state.slide && !minor && !onC
  const degreesNow = (): Degrees =>
    minor ? MINOR_FIVE : fives() ? MAJOR_FIVE : MAJOR_DEGREES
  const tonicNow = (): number =>
    onC ? doMidi : minor ? doMidi - 3 : state.slide ? start : doMidi
  // a Slide's starts run up an octave from do; Step 2's take la below it
  const rangeNow = (): StairsRange =>
    sliding() ? { lo: doMidi, hi: doMidi + 11 } : { lo: doMidi - 3, hi: doMidi }

  let range = rangeNow()
  const core = mountStairs({
    canvas: q<HTMLCanvasElement>('canvas', p.viz),
    compact: false,
    active: o.active,
    range,
    degrees: degreesNow(),
    both: true,
    numbers: true,
    onLayout: (L: StairsLayout) =>
      L.stairs.forEach((st, i) => place(p.stairBtns[i], st.zone)),
  })
  core.set({ steps: true })

  /** Every word that follows the drawing: the stairs' names, the summary, the slider, the switches. */
  function relabel(): void {
    const t = core.tonic
    const d = core.degrees
    p.stairBtns.forEach((b, i) => {
      b.hidden = i >= d.length
      if (i < d.length) b.setAttribute('aria-label', stairLabel(i, t, d))
    })
    p.description.textContent = summary(t, d)
    if (p.slider !== null) {
      p.slider.setAttribute('aria-valuemin', String(doMidi))
      p.slider.setAttribute('aria-valuemax', String(doMidi + 11))
      p.slider.setAttribute('aria-valuenow', String(start))
      p.slider.setAttribute('aria-valuetext', sliderSaid(start, fives()))
    }
    if (p.sliderValue !== null)
      p.sliderValue.textContent = `Do is ${signName(majorScale(start)[0])}`
    slideBtns.forEach((b) => {
      const dir = Number(b.dataset.slide)
      b.disabled =
        (dir < 0 && start <= doMidi) || (dir > 0 && start >= doMidi + 11)
    })
    fiveBtn.hidden = !state.fiveSwitch
    fiveBtn.setAttribute('aria-pressed', String(fives()))
    modeSeg.hidden = !state.modes
    modeBtns.forEach((b) =>
      b.setAttribute(
        'aria-pressed',
        String((b.dataset.mode === 'minor') === minor),
      ),
    )
    slideRow.hidden = !sliding()
  }

  /** The drawing as the switches say: its starts, its stairs and where it stands. */
  function apply(): void {
    const next = rangeNow()
    if (next.lo !== range.lo || next.hi !== range.hi) {
      range = next
      // new starts stand on the scale's own start at once: Step 2 opens on
      // C, never sliding there from A, the move it teaches the other way
      core.setRange(next, tonicNow())
    }
    const d = degreesNow()
    if (!sameDegrees(d, core.degrees)) core.setDegrees(d)
    core.setTonic(tonicNow())
    relabel()
  }

  // an event's line wins over the summary a slide has queued
  function say(line: string): void {
    window.clearTimeout(summaryTimer)
    p.said.textContent = line
  }

  /** Stops what plays here, a pause between its halves too, and puts the minor five on C back on A. */
  function halt(): void {
    token += 1
    core.stop()
    const wake = pending
    pending = null
    wake?.()
    if (onC) {
      onC = false
      apply()
    }
  }

  /** A press: the page's one sound from here, sounding or not, decided once. */
  function begin(): Press {
    halt()
    NowPlaying.claim(halt)
    return { mine: ++token, audible: Sound.canPlay() }
  }

  /** A press that has ended lets the page's sound go; true when it was heard to its end. */
  function end(press: Press, heard: boolean): boolean {
    if (press.mine !== token) return false
    NowPlaying.release(halt)
    return heard
  }

  const sing = (events: readonly NoteEvent[], press: Press): Promise<boolean> =>
    core.play(events, press.audible).then(() => press.mine === token)

  const pause = (press: Press): Promise<boolean> =>
    new Promise((resolve) => {
      const id = window.setTimeout(() => {
        pending = null
        resolve(press.mine === token)
      }, BETWEEN_SEC * 1000)
      pending = () => {
        window.clearTimeout(id)
        resolve(false)
      }
    })

  const scaleNow = (): NoteEvent[] => scaleUp(core.tonic, 1, core.degrees)

  async function playUp(): Promise<boolean> {
    const press = begin()
    return end(press, await sing(scaleNow(), press))
  }

  function setFive(on: boolean): void {
    if (on === five && !minor) return
    halt()
    five = on
    // the seven notes have no minor here: their switch brings Major back
    if (!on) minor = false
    apply()
    say(fiveSaid(on))
  }

  function setMinor(on: boolean): void {
    if (on === minor) return
    halt()
    minor = on
    apply()
    say(modeSaid(on, core.tonic))
  }

  async function majorThenFive(): Promise<boolean> {
    const press = begin()
    start = doMidi
    five = false
    minor = false
    apply()
    if (!(await sing(scaleNow(), press)) || !(await pause(press)))
      return end(press, false)
    five = true
    apply()
    say(fiveSaid(true))
    return end(press, await sing(scaleNow(), press))
  }

  async function both(): Promise<boolean> {
    const press = begin()
    minor = false
    apply()
    if (!(await sing(scaleNow(), press)) || !(await pause(press)))
      return end(press, false)
    minor = true
    apply()
    say(modeSaid(true, core.tonic))
    return end(press, await sing(scaleNow(), press))
  }

  async function playOnC(): Promise<boolean> {
    const press = begin()
    minor = true
    onC = true
    apply()
    say(summary(core.tonic, core.degrees))
    const heard = await sing(scaleNow(), press)
    if (press.mine === token) {
      // A's five again after it
      onC = false
      apply()
    }
    return end(press, heard)
  }

  function slide(midi: number): void {
    if (!sliding()) return
    const next = clamp(midi, doMidi, doMidi + 11)
    if (next === start) return
    halt()
    start = next
    apply()
    window.clearTimeout(summaryTimer)
    summaryTimer = window.setTimeout(() => {
      p.said.textContent = summary(core.tonic, core.degrees)
    }, SUMMARY_MS)
  }

  /** A note tapped on a stair or a key: 0.6 s, its stair lit. */
  function tap(midi: number): void {
    const press = begin()
    void sing([{ midi, at: 0, dur: TAP_SEC }], press).then((heard) =>
      end(press, heard),
    )
  }

  function tapKey(x: number, y: number): void {
    const strip = core.layout?.strip ?? null
    const midi = strip === null ? null : stripHit(strip, x, y)
    if (midi === null) return
    if (!sliding()) {
      tap(midi)
      return
    }
    // a key makes do: its own pitch if it can be a start, else the same letter lower
    let m = midi
    while (m > doMidi + 11) m -= 12
    slide(m)
  }

  // one action per pointer: a tap plays or slides, a drag (mouse or pen) slides
  function bindPointer(): void {
    let down: { x: number; y: number; start: number; id: number } | null = null
    let dragged = false
    const canvas = q('canvas', p.viz)
    const local = (e: PointerEvent): { x: number; y: number } => {
      const r = canvas.getBoundingClientRect()
      return { x: e.clientX - r.left, y: e.clientY - r.top }
    }
    p.viz.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return
      down = { ...local(e), start, id: e.pointerId }
      dragged = false
    })
    p.viz.addEventListener('pointermove', (e) => {
      if (down === null || e.pointerId !== down.id) return
      const at = local(e)
      const dy = at.y - down.y
      if (!dragged && Math.hypot(at.x - down.x, dy) <= DRAG_PX) return
      if (!dragged) {
        dragged = true
        if (e.pointerType !== 'touch' && sliding())
          p.viz.setPointerCapture(e.pointerId)
      }
      if (e.pointerType === 'touch' || !sliding()) return
      slide(down.start - Math.round(dy / (core.layout?.rowH ?? 12)))
    })
    p.viz.addEventListener('pointerup', (e) => {
      if (down === null || e.pointerId !== down.id) return
      const wasTap = !dragged
      const at = local(e)
      down = null
      const onButton =
        e.target instanceof Element && e.target.closest('button') !== null
      if (wasTap && !onButton) tapKey(at.x, at.y)
    })
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

  playBtn.addEventListener('click', () => light(playBtn, playUp()))
  fiveBtn.addEventListener('click', () => setFive(!fives()))
  modeBtns.forEach((b) =>
    b.addEventListener('click', () => setMinor(b.dataset.mode === 'minor')),
  )
  slideBtns.forEach((b) =>
    b.addEventListener('click', () => slide(start + Number(b.dataset.slide))),
  )
  p.slider?.addEventListener('keydown', (e) => {
    const to: Readonly<Record<string, number>> = {
      ArrowUp: start + 1,
      ArrowRight: start + 1,
      ArrowDown: start - 1,
      ArrowLeft: start - 1,
      Home: doMidi,
      End: doMidi + 11,
    }
    const next = to[e.key]
    if (next === undefined) return
    e.preventDefault()
    slide(next)
  })
  p.stairBtns.forEach((b, i) =>
    b.addEventListener('click', () => {
      const d = core.degrees[i]
      if (d !== undefined) tap(core.tonic + d)
    }),
  )
  bindPointer()
  relabel()

  return {
    core,
    setState(next) {
      halt()
      state = next
      apply()
    },
    setVoice(v) {
      const moved = stairsDo(v) - doMidi
      if (moved === 0) return
      halt()
      doMidi += moved
      start += moved
      apply()
    },
    majorThenFive,
    both,
    onC: playOnC,
    stop: halt,
  }
}
