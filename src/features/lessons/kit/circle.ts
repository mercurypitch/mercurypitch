// ============================================================
// Circle toy — the circle of fifths: the house round it, and the walk of twelve fifths
// ============================================================
//
// Lesson 2's ring grown into the circle of fifths (Lesson 21's WEB-SPEC,
// Toys 3; SEASON-2 § 6.2 item 4), mounted on a figure (`[data-circle-viz]`
// with its `[data-circle-svg]`). Threaded by fifths, each bead is a major
// key, C at the top, the sharp keys clockwise and the flat keys
// anticlockwise (circle-geometry.ts); a toy that opens threaded by
// semitones re-threads as a page asks (`thread`), the beads moving round
// the ring until each sits a fifth from its neighbours.
//
// The house moves within a part of the circle (`part`): Step 2's C round to
// A, Step 3's C back to E flat, free play's E flat round to A. Step round
// and Step back (`[data-circle-step]`) move it a fifth, marked
// `aria-disabled` at the part's ends; each bead in the part is a button of
// at least 44 px laid over its bead (`[data-circle-beads]`), named for its
// key ("G major, one sharp"), and Left and Right step back and round from a
// focused one. A bead past three sharps or flats is drawn and named,
// dimmed, and is no button. The toy itself plays nothing as the house
// moves: the page hears each move (`onMove`) and plays the key's scale on
// the staff beside it.
//
// The walk (Step 5; `[data-walk-tuning]`, Pure · Equal, and
// `[data-walk-play]`) plays twelve fifths up from C4, each folded into the
// octave from C4, then the C it reaches and, after a breath, the first C
// again (FACTS 31, 63), the thread drawn bead to bead as each sounds; on
// Pure it runs on past C by the gap, drawn and labelled. Its notes are the
// page's one sound (`owner`) and are announced only at its end.
//
// It draws only while something moves or has changed (frame-loop.ts,
// `wants`). Under reduced motion, or with Pause animations on, the beads,
// the house and the thread jump to where they end; every sound still plays.

import type { BeadView, CircleLayout, CircleScene } from './circle-draw'
import { circleSize, drawCircle } from './circle-draw'
import type { CircleKey, CirclePart, Threading } from './circle-geometry'
import { angleBetween, angleOf, CIRCLE, FIFTHS, inPart, seatsOf, stepSeat, walkHz, } from './circle-geometry'
import { q, qa } from './dom'
import { addDrawer, wake } from './frame-loop'
import { Motion } from './motion-switch'
import type { Spelled } from './notes'
import { signName, wordName } from './notes'
import type { SoundOwner } from './now-playing'
import type { Run } from './run'
import { playNotes } from './run'
import { Sound } from './sound'

export interface CircleToyOptions {
  /** When it draws: on screen, and on its step. */
  readonly active: () => boolean
  /** The part the house moves within, and the seat it stands on (C when unset). */
  readonly part: CirclePart
  readonly seat?: number
  /** How the beads sit as it opens: by fifths unless set. */
  readonly threading?: Threading
  /** One sound at a time: the page's owner (kit/now-playing.ts), for the walk. */
  readonly owner: SoundOwner
  /** Hears each move of the house, by a step, a bead's button or an arrow, with the key it left. */
  readonly onMove?: (key: CircleKey, from: CircleKey) => void
}

export interface CircleToy {
  /** The key the house is on. */
  readonly key: CircleKey
  /** A new part; a house outside it goes back to C, silently. */
  setPart(part: CirclePart): void
  /** Moves the house to `seat`, within the part, round the ring, and tells the page unless `tell` is false. */
  moveTo(seat: number, tell?: boolean): void
  /** Re-threads the ring: the beads move until each sits a fifth, or a semitone, from its neighbours. */
  thread(to: Threading): void
  /** The walk of twelve fifths: true when heard to its end. */
  walk(tuning: 'pure' | 'equal'): Promise<boolean>
  stop(): void
}

/** A note of the walk apart, its length, the last C's hold, the breath before the first C again, and its length, s (FACTS 63). */
const WALK = { gap: 0.45, dur: 0.4, last: 1.0, rest: 0.2, again: 1.0 }
/** The re-threading's length, and a step of the house's walk round the ring, s. */
const THREAD_SEC = 1.2
const HOUSE_STEP_SEC = 0.22
/** The gap past C, drawn half a bead's gap long: a figure, labelled, not to scale. */
const GAP_SWEEP = Math.PI / 12

const COUNT = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven']

/** A key's name, for the eye: "B♭ major", or the bottom three's two, "F♯ or G♭ major". */
export function keyName(k: CircleKey): string {
  const one = (s: Spelled): string => signName(s, { octave: false })
  return k.twin === null
    ? `${one(k.tonic)} major`
    : `${one(k.tonic)} or ${one(k.twin)} major`
}

/** A key in words, as its bead's button says it: "G major, one sharp", "C major, no sharps or flats". */
export function keyLabel(k: CircleKey): string {
  const said = (s: Spelled): string => wordName(s, { octave: false })
  const name =
    k.twin === null
      ? `${said(k.tonic)} major`
      : `${said(k.tonic)} or ${said(k.twin)} major`
  if (k.key.count === 0) return `${name}, no sharps or flats`
  const plural = k.key.count === 1 ? '' : 's'
  return `${name}, ${COUNT[k.key.count]} ${k.key.sign}${plural}`
}

/** A walk's frequency as the run plays it: a MIDI number, fractional off the equal-tempered grid. */
const midiOfHz = (f: number): number => 69 + 12 * Math.log2(f / 440)

const smoothstep = (u: number): number => u * u * (3 - 2 * u)

export function mountCircle(root: HTMLElement, o: CircleToyOptions): CircleToy {
  const el = q<SVGSVGElement>('[data-circle-svg]', root)
  const beadsBox = root.querySelector<HTMLElement>('[data-circle-beads]')
  const said = root.querySelector<HTMLElement>('[data-circle-said]')

  let part = o.part
  let seat = o.seat ?? 0
  // the threading the beads move between, and how far along (1: arrived)
  let from: Threading = o.threading ?? 'fifths'
  let to: Threading = from
  let threadU = 1
  // the house's angle as it walks, from one seat's to another's, the long way round within the part
  let houseFrom = angleOf(seat)
  let houseTo = houseFrom
  let houseU = 1
  let houseSec = 0
  // the walk's thread so far, and its gap once a pure walk ends
  let walkThread: number[] = []
  let walkGap = false
  let tuning: 'pure' | 'equal' = 'pure'
  let playing: Run | null = null
  let plays = 0
  let timers: number[] = []
  let layout: CircleLayout | null = null
  let buttons: HTMLButtonElement[] = []
  let dirty = true
  let drawnSize = { w: 0, h: 0 }

  const key = (): CircleKey => CIRCLE[seat]
  const fifths = (): boolean => to === 'fifths' && threadU >= 1

  function say(text: string): void {
    if (said !== null && said.textContent !== text) said.textContent = text
  }

  function changed(): void {
    dirty = true
    wake()
  }

  /** Each bead as drawn now: its angle part way through a re-threading, its look and its names. */
  function beads(): BeadView[] {
    return FIFTHS.map((pc, s) => {
      const k = CIRCLE[s]
      const names = !fifths()
        ? []
        : k.twin === null
          ? [signName(k.tonic, { octave: false })]
          : [
              signName(k.tonic, { octave: false }),
              signName(k.twin, { octave: false }),
            ]
      // a bead the walk has reached is lit, every one of the twelve; else
      // one past three sharps or flats is dimmed, and the house's is lit
      const look = walkThread.includes(s)
        ? 'lit'
        : !k.read
          ? 'dim'
          : s === seat && beadsBox !== null
            ? 'lit'
            : 'rest'
      return {
        pc,
        angle: angleBetween(pc, from, to, smoothstep(threadU)),
        look,
        names,
        big: true,
      } satisfies BeadView
    })
  }

  function scene(): CircleScene {
    const u = smoothstep(houseU)
    return {
      beads: beads(),
      fifths: true,
      house:
        beadsBox === null || !fifths()
          ? null
          : houseFrom + (houseTo - houseFrom) * u,
      thread: walkThread.map((s) => FIFTHS[s]),
      gap: walkGap ? { sweep: GAP_SWEEP, label: '23.46 cents' } : null,
    }
  }

  /** The bead buttons, one per seat in the part, each over its bead and at least 44 px. */
  function makeButtons(): void {
    if (beadsBox === null) return
    beadsBox.replaceChildren()
    buttons = seatsOf(part).map((s) => {
      const b = document.createElement('button')
      b.type = 'button'
      b.dataset.seat = String(s)
      b.setAttribute('aria-label', keyLabel(CIRCLE[s]))
      b.addEventListener('click', () => moveTo(s))
      b.addEventListener('keydown', (e) => {
        if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
        e.preventDefault()
        stepBy(e.key === 'ArrowRight' ? 1 : -1, true)
      })
      beadsBox.appendChild(b)
      return b
    })
    placeButtons()
  }

  function placeButtons(): void {
    if (layout === null) return
    const L = layout
    const side = Math.max(44, L.bead * 2.4)
    for (const b of buttons) {
      const s = Number(b.dataset.seat)
      const at = L.at(angleOf(s))
      b.style.left = `${at.x - side / 2}px`
      b.style.top = `${at.y - side / 2}px`
      b.style.width = `${side}px`
      b.style.height = `${side}px`
      b.hidden = !fifths()
    }
  }

  function syncControls(): void {
    for (const b of buttons) {
      if (Number(b.dataset.seat) === seat)
        b.setAttribute('aria-current', 'true')
      else b.removeAttribute('aria-current')
    }
    for (const b of qa<HTMLButtonElement>('[data-circle-step]', root)) {
      const dir = Number(b.dataset.circleStep) > 0 ? 1 : -1
      b.setAttribute(
        'aria-disabled',
        String(stepSeat(seat, dir, part) === null),
      )
    }
  }

  function moving(): boolean {
    return threadU < 1 || houseU < 1
  }

  function wants(): boolean {
    if (dirty || moving()) return true
    const box = circleSize(el)
    return (
      Math.round(box.w) !== drawnSize.w || Math.round(box.h) !== drawnSize.h
    )
  }

  function draw(_now: number, dt: number): void {
    const still = Motion.paused
    if (threadU < 1)
      threadU = still ? 1 : Math.min(1, threadU + dt / THREAD_SEC)
    if (houseU < 1)
      houseU = still ? 1 : Math.min(1, houseU + dt / Math.max(0.01, houseSec))
    const size = circleSize(el)
    drawnSize = { w: Math.round(size.w), h: Math.round(size.h) }
    layout = drawCircle(el, scene(), size)
    placeButtons()
    dirty = false
  }

  addDrawer({ active: o.active, draw, wants })

  function moveTo(next: number, tell = true): void {
    if (!inPart(next, part) || next === seat || !fifths()) return
    const was = key()
    // the house walks the part's way round, never through a dimmed bead
    const seats = seatsOf(part)
    const i0 = seats.indexOf(seat)
    const i1 = seats.indexOf(next)
    const a0 = angleOf(part.from) + i0 * (Math.PI / 6)
    houseFrom = a0
    houseTo = angleOf(part.from) + i1 * (Math.PI / 6)
    houseU = Motion.paused ? 1 : 0
    houseSec = Math.abs(i1 - i0) * HOUSE_STEP_SEC
    seat = next
    syncControls()
    say(keyLabel(key()))
    changed()
    if (tell) o.onMove?.(key(), was)
  }

  function stepBy(dir: 1 | -1, focus: boolean): void {
    const next = stepSeat(seat, dir, part)
    if (next === null) return
    moveTo(next)
    if (focus) buttons.find((b) => Number(b.dataset.seat) === next)?.focus()
  }

  function stopWalk(): void {
    timers.forEach((id) => window.clearTimeout(id))
    timers = []
    if (playing !== null) {
      plays += 1
      playing.stop()
      playing = null
      o.owner.release(stopWalk)
    }
  }

  function walk(t: 'pure' | 'equal'): Promise<boolean> {
    stopWalk()
    o.owner.claim(stopWalk)
    const mine = ++plays
    tuning = t
    const hz = walkHz(t)
    const order = [...FIFTHS.keys(), 0]
    walkGap = false
    // under reduced motion the thread jumps to where it ends
    walkThread = Motion.paused ? order : []
    if (Motion.paused && t === 'pure') walkGap = true
    changed()
    const notes = hz.map((f, i) => ({
      t: i * WALK.gap,
      midi: midiOfHz(f),
      dur: i === 12 ? WALK.last : WALK.dur,
      kind: 'soft' as const,
    }))
    const againAt = 12 * WALK.gap + WALK.last + WALK.rest
    notes.push({
      t: againAt,
      midi: midiOfHz(hz[0]),
      dur: WALK.again,
      kind: 'soft',
    })
    const r = playNotes(notes, {
      audible: Sound.canPlay(),
      kind: 'soft',
      onNote: (_n, i) => {
        if (mine !== plays || i > 12 || Motion.paused) return
        walkThread = order.slice(0, i + 1)
        if (i === 12 && t === 'pure') walkGap = true
        changed()
      },
    })
    playing = r
    return r.done.then((heard) => {
      if (mine !== plays) return false
      playing = null
      o.owner.release(stopWalk)
      if (heard)
        say(
          t === 'pure'
            ? 'The walk ended 23.46 cents above C'
            : 'The walk ended on C',
        )
      return heard
    })
  }

  // ------------------------------------------------------------ controls

  for (const b of qa<HTMLButtonElement>('[data-circle-step]', root))
    b.addEventListener('click', () => {
      if (b.getAttribute('aria-disabled') === 'true') return
      stepBy(Number(b.dataset.circleStep) > 0 ? 1 : -1, false)
    })
  const tuningBtns = qa<HTMLButtonElement>(
    '[data-walk-tuning] [data-tuning]',
    root,
  )
  const showTuning = (): void => {
    for (const b of tuningBtns)
      b.setAttribute('aria-pressed', String(b.dataset.tuning === tuning))
  }
  for (const b of tuningBtns)
    b.addEventListener('click', () => {
      tuning = b.dataset.tuning === 'equal' ? 'equal' : 'pure'
      showTuning()
    })
  const walkBtn = root.querySelector<HTMLButtonElement>('[data-walk-play]')
  walkBtn?.addEventListener('click', () => {
    walkBtn.classList.add('is-on')
    void walk(tuning).then(() => walkBtn.classList.remove('is-on'))
  })

  makeButtons()
  syncControls()
  showTuning()

  return {
    get key() {
      return key()
    },
    setPart(p) {
      part = p
      if (!inPart(seat, part)) {
        seat = 0
        houseFrom = angleOf(0)
        houseTo = houseFrom
        houseU = 1
      } else {
        houseFrom =
          angleOf(part.from) + seatsOf(part).indexOf(seat) * (Math.PI / 6)
        houseTo = houseFrom
      }
      makeButtons()
      syncControls()
      changed()
    },
    moveTo,
    thread(next) {
      // already there, or on its way: a step shown again lets it go on
      if (next === to) return
      from = to
      to = next
      threadU = Motion.paused ? 1 : 0
      changed()
    },
    walk,
    stop() {
      stopWalk()
    },
  }
}
