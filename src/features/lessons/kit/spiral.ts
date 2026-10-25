// ============================================================
// Lesson spiral — the pitch spiral and the keyboard it unrolls into
// ============================================================
//
// One control with three ways in: drag to turn the spiral and tap a bead
// (or, unrolled, a key) to hear it; from the keyboard the canvas is a slider
// over the 37 notes, Shift with Left or Right turning it. Unrolled on a
// phone, the keyboard shows one octave at a time and pans. Taps are tested
// against the hit lists the last frame drew, snapping to the nearest bead or
// key within 22 px. The drawing is in spiral-draw.ts and spiral-keys.ts.
//
// Turning never needs a drag (WCAG 2.5.7): the `[data-spiral-turn]` buttons
// turn it one bead a press. And an activation with no pointer behind it,
// which is how a screen reader's double-tap or a switch arrives, plays the
// selected note: the note picked by swiping, not whatever bead sits at the
// middle of the canvas.
//
// Mounted on a root, any number per page, each copy with its own state:
// its turn, its selection and the black keys it has lit (Lesson 2's five
// "?" beads light once heard on that copy, and on no other). Inside the
// root: the canvas, and optionally the `[data-spiral-hint]` line, the
// `[data-spiral-readout]` value, the `[data-spiral-drift]`,
// `[data-spiral-turn]` (-1 or 1) and `[data-spiral-unroll]` buttons, the
// `[data-spiral-pan]` box (its `[data-pan]` buttons and `[data-pan-window]`
// label) and `[data-key]` buttons that play a note. Every name follows the
// page's sharps-or-flats choice (names.ts).
//
// A page can take the figure further without forking it: look straight down
// the axis (`setView('top')`), keep the selection inside the notes it shows
// (`range`), and draw the unrolled keys itself (`keys`, a layer that also
// says where each key is and where it takes taps), as Lesson 2 does to
// straighten the keyboard into a row of equal tiles.
//
// On a page that plays one sound at a time (`owner`, now-playing.ts), a
// note the viewer plays here (a tap on a bead or a key, Enter on the
// slider, an activation) is one of the page's sounds: it claims the owner,
// so the sound before it stops, lets go at its end, and stops where it
// stands when another sound claims the page. `play` is the page's own and
// leaves the owner to the page. Without an owner every note plays to its
// end, as it always has.
//
// It draws only while something it shows moves (the drift, a turn, the
// camera, the unroll, the pan, a tap's flash and tag) or has changed; still,
// it asks the page's frame loop for nothing (frame-loop.ts, `wants`). It
// compares what it shows with what it last drew, so a change made with no
// wake draws at the next input. A page's own drawing asks for frames by
// `overlayWants`; one that says nothing draws every frame (Lesson 2's).

import { clamp, q, qa, TAU } from './dom'
import { addDrawer, surface, wake, watch, watchPixelRatio } from './frame-loop'
import { Motion, reducedMotion } from './motion-switch'
import { Names, namesFor, spokenNames } from './names'
import { fmtHz, hz, isBlack, nameHtml, nameOf, noteColor, signName, } from './notes'
import type { SoundOwner } from './now-playing'
import type { Voice } from './sound'
import { playTone, Sound } from './sound'
import type { BeadHit, BeadLabels, KeysLayer } from './spiral-draw'
import { drawOverlays, drawSpiral, TAG_MS } from './spiral-draw'
import type { KeyboardView, KeyHit, KeyLabels } from './spiral-keys'
import { KEY_SLOP, LO, N, pulseOf, wIndex } from './spiral-keys'

/** The phone keyboard's three windows, by pan / 7. */
const WIN = ['A2 to A3', 'A3 to A4', 'A4 to A5']

/** How far each key moves the selection, in semitones. */
const STEP_KEYS: ReadonlyMap<string, number> = new Map([
  ['ArrowUp', 1],
  ['ArrowRight', 1],
  ['ArrowDown', -1],
  ['ArrowLeft', -1],
  ['PageUp', 12],
  ['PageDown', -12],
])

/** A click this long after the last pointerup came from no pointer: assistive technology. */
const ACTIVATION_GAP_MS = 500

/** A note the viewer plays here lasts this long, seconds. */
const NOTE_SEC = 0.9
/** How fast that note fades when another sound takes the page, seconds: as a cut-short run does (tune-line.ts). */
const CUT_SEC = 0.08

/** What the hint line can depend on. */
export interface SpiralState {
  readonly focused: boolean
  readonly unrolled: boolean
  readonly labels: BeadLabels
}

/** One drawn frame, for a page's own marks over the figure. */
export interface SpiralFrame {
  readonly ctx: CanvasRenderingContext2D
  readonly W: number
  readonly H: number
  readonly now: number
  /** 0 is the spiral, 1 the keyboard. */
  readonly u: number
  /** Where each bead and key landed this frame. */
  readonly beads: readonly BeadHit[]
  readonly keys: readonly KeyHit[]
}

export interface SpiralOptions {
  /** When the figure draws: a deck's `toyActive(n)`; default while its root is on screen. */
  readonly active?: () => boolean
  /** A black key's bead lights once heard on this copy (Lesson 2); default false (Lesson 1's stay "?"). */
  readonly lightOnPlay?: boolean
  /** Which keys carry their names once unrolled; default 'landmarks'. */
  readonly keyLabels?: KeyLabels
  /** The label of the arc over A3 to A4 on the keyboard; default none. */
  readonly span?: string | null
  /** The hint line for the figure's state. */
  readonly hint?: (s: SpiralState) => string
  /** The slider's spoken value for a note; default "C sharp 4, 277 hertz". */
  readonly valueText?: (midi: number) => string
  /** The name tag over a bead; default "A3 · 220 Hz". */
  readonly tag?: (midi: number) => string
  /** The unroll button's label, rolled up and unrolled. */
  readonly unrollLabels?: readonly [string, string]
  /** Draws a page's own marks over each frame. */
  readonly overlay?: (frame: SpiralFrame) => void
  /**
   * Whether the page's own drawing (`overlay`, `keys`) has a frame to draw;
   * one that starts to move with no input behind it also calls `wake`
   * (frame-loop.ts). Default: every frame, for a page that draws either.
   */
  readonly overlayWants?: () => boolean
  /** The page's own unrolled keys, built for each frame; default the kit's keyboard. */
  readonly keys?: (frame: KeysFrame) => KeysLayer
  /** The notes the selection may reach, MIDI low and high; default A2 to A5. */
  readonly range?: () => readonly [number, number]
  /** The turn that stays lit from above starts here, MIDI; default A3. */
  readonly ring?: number
  /**
   * The page's one-sound owner (now-playing.ts): a note the viewer plays
   * here claims it, and stops when another sound claims it; default none.
   */
  readonly owner?: SoundOwner
}

/** What a page's keys layer is built from: the canvas size, the time and the figure's state. */
export interface KeysFrame {
  readonly W: number
  readonly H: number
  readonly now: number
  readonly view: KeyboardView
}

/** From the side, or straight down the axis. */
export type SpiralCamera = 'side' | 'top'

export interface Spiral {
  readonly root: HTMLElement
  /** The black keys lit on this copy, by MIDI number. */
  readonly lit: ReadonlySet<number>
  /** The selected note's MIDI number. */
  readonly selected: number
  /**
   * Plays a note on this copy: its bead or key pulses (and lights, with
   * lightOnPlay); resolves when it ends. It never claims the owner: a page
   * that plays one sound at a time claims it for its own run.
   */
  play(
    midi: number,
    o?: { audible?: boolean; dur?: number },
  ): Promise<Voice | null>
  /** Lights a black key's bead on this copy without a sound. */
  light(midi: number): void
  /** Moves the selection (and the slider's value) to a note. */
  select(midi: number): void
  setUnrolled(on: boolean): void
  /** True once the keys show (unrolled and settled). */
  readonly unrolled: boolean
  setLabels(labels: BeadLabels): void
  /** Whether the spiral may turn by itself (never under Pause animations or reduced motion). */
  setTurning(on: boolean): void
  /** Moves the camera over the axis or back to the side (at once under reduced motion). */
  setView(camera: SpiralCamera): void
  /** How far the camera has moved over the axis, 0 to 1. */
  readonly top: number
  /** How far the spiral has turned, in radians. */
  readonly yaw: number
  /** Says the hint and the slider's value again, after something they read has changed. */
  refresh(): void
}

const DEFAULT_HINT = (s: SpiralState): string =>
  s.focused
    ? s.unrolled
      ? 'Arrows pick a key · Enter plays it'
      : 'Arrows pick a note · Enter plays · Shift+arrows turn'
    : s.unrolled
      ? 'Tap any key to hear it'
      : 'Drag to turn · tap a bead to hear it'

export function mountSpiral(
  root: HTMLElement,
  opts: SpiralOptions = {},
): Spiral {
  const canvas = q<HTMLCanvasElement>('canvas', root)
  const cv = surface(canvas)
  const hint = root.querySelector<HTMLElement>('[data-spiral-hint]')
  const readout = root.querySelector<HTMLElement>('[data-spiral-readout]')
  const driftBtn = root.querySelector<HTMLButtonElement>('[data-spiral-drift]')
  const turnBtns = qa<HTMLButtonElement>('[data-spiral-turn]', root)
  const unrollBtn = root.querySelector<HTMLButtonElement>(
    '[data-spiral-unroll]',
  )
  const panBox = root.querySelector<HTMLElement>('[data-spiral-pan]')
  const hintFor = opts.hint ?? DEFAULT_HINT
  const [rolledLabel, unrolledLabel] = opts.unrollLabels ?? [
    'Unroll the spiral',
    'Roll it back up',
  ]
  const lit = new Set<number>()
  const named = (m: number): boolean => !isBlack(m) || lit.has(m)
  const valueText =
    opts.valueText ??
    ((m: number): string => `${spokenNames(m)}, ${fmtHz(hz(m))} hertz`)
  const tag =
    opts.tag ??
    ((m: number): string =>
      `${
        named(m)
          ? namesFor(m)
              .map((n) => signName(n))
              .join(' / ')
          : '?'
      } · ${fmtHz(hz(m))} Hz`)
  let yaw = 0
  let vel = 0
  let userDrift = true
  let turning = true
  let labels: BeadLabels = 'letter'
  let dragging = false
  let moved = 0
  let lastX = 0
  // the turn the buttons asked for and the spiral has still to make, in radians
  let turnLeft = 0
  // when the last pointer left the canvas, so its own click is not a second play
  let lastUp = -Infinity
  let u = 0
  let uTarget = 0
  let hits: BeadHit[] = []
  let keyHits: KeyHit[] = []
  let hover: number | null = null
  let tapLabel: { s: number; t: number } | null = null
  // the selection (A3 to start); on a phone the unrolled keyboard shows one octave at a time and pans
  let sel = 12
  let focused = false
  let narrow = false
  let pan = 7
  let panTarget = 7
  let top = 0
  let topTarget = 0
  const pulses = new Map<number, number>()
  const drifting = (): boolean => userDrift && !Motion.paused
  // on a page with an owner, the note the viewer last played here, and the
  // timer that lets the owner go at its end
  let asked: Voice | null = null
  let askedEnds = 0
  // something the figure shows has changed since its last frame; whether
  // that frame had room to draw in, and how the figure looked in it
  let dirty = true
  let room = false
  let drawnLook = ''

  /** The selection's reach, in semitones from A2: every bead, or the page's range. */
  function reach(): [number, number] {
    if (opts.range === undefined) return [0, N - 1]
    const [lo, hi] = opts.range()
    return [clamp(lo - LO, 0, N - 1), clamp(hi - LO, 0, N - 1)]
  }

  function setSel(s: number): void {
    const [lo, hi] = reach()
    sel = clamp(s, lo, hi)
    tapLabel = null // the label follows the selection (a tap sets it again when it plays)
    if (opts.range !== undefined) {
      canvas.setAttribute('aria-valuemin', String(lo))
      canvas.setAttribute('aria-valuemax', String(hi))
    }
    canvas.setAttribute('aria-valuenow', String(sel))
    canvas.setAttribute('aria-valuetext', valueText(LO + sel))
    if (narrow && uTarget > 0.5) {
      const wi = wIndex(sel)
      if (wi < panTarget) panTarget = Math.max(0, panTarget - 7)
      else if (wi > panTarget + 7) panTarget = Math.min(14, panTarget + 7)
      if (reducedMotion()) pan = panTarget
      syncPan()
    }
    wake()
  }

  function hit(s: number): void {
    const m = LO + s
    if (opts.lightOnPlay === true && isBlack(m)) lit.add(m)
    pulses.set(m, performance.now())
    tapLabel = { s, t: performance.now() }
    wake()
    if (readout === null) return
    const name = named(m)
      ? namesFor(m)
          .map((n) => nameHtml(n))
          .join(' / ')
      : (nameOf(m) ?? '?')
    readout.innerHTML = `${name}<small>${fmtHz(hz(m))} Hz</small>`
    readout.style.color = noteColor(m)
  }

  function play(
    m: number,
    audible = Sound.canPlay(),
    dur = NOTE_SEC,
  ): Promise<Voice | null> {
    hit(m - LO)
    return playTone(hz(m), dur, { audible })
  }

  /** Stops the viewer's note where it stands: another sound has taken the page. */
  function stopAsked(): void {
    window.clearTimeout(askedEnds)
    asked?.stop(CUT_SEC)
    asked = null
  }

  /**
   * A note the viewer plays here: a tap on a bead or a key, Enter on the
   * slider, an activation. With the page's owner its voice is one the owner
   * can stop: it claims the owner before it sounds, so the sound before it
   * stops (this copy's own last note too), and lets go at its end. Without
   * one it plays as any note does, to its end.
   */
  function playAsked(m: number): void {
    const owner = opts.owner
    if (owner === undefined) {
      void play(m)
      return
    }
    stopAsked()
    owner.claim(stopAsked)
    const audible = Sound.canPlay()
    hit(m - LO)
    asked = audible ? Sound.voice(hz(m), { dur: NOTE_SEC }) : null
    askedEnds = window.setTimeout(() => {
      asked = null
      owner.release(stopAsked)
    }, NOTE_SEC * 1000)
  }

  // the drift: the viewer's own pause, and never while animations are paused (reduced motion included)
  function syncDrift(): void {
    if (driftBtn === null) return
    const on = drifting()
    driftBtn.disabled = Motion.paused
    q('span', driftBtn).textContent = on ? 'Pause turning' : 'Resume turning'
    q<SVGUseElement>('use', driftBtn).setAttribute(
      'href',
      on ? '#i-pause' : '#i-play',
    )
    driftBtn.title = Motion.paused
      ? Motion.locked
        ? 'Paused by your reduced-motion setting'
        : 'Animations are paused'
      : ''
  }
  if (driftBtn !== null) {
    driftBtn.removeAttribute('aria-pressed')
    driftBtn.addEventListener('click', () => {
      if (Motion.paused) return
      userDrift = !userDrift
      syncDrift()
    })
    Motion.subscribe(syncDrift)
  }
  qa('[data-key]', root).forEach((b) =>
    b.addEventListener('click', () => {
      setSel(Number(b.dataset.key) - LO)
      playAsked(Number(b.dataset.key))
    }),
  )
  unrollBtn?.addEventListener('click', () => {
    uTarget = uTarget > 0.5 ? 0 : 1
    if (reducedMotion()) u = uTarget
    syncUnroll()
  })

  function syncPan(): void {
    if (panBox === null) return
    const win = panBox.querySelector('[data-pan-window]')
    if (win !== null) win.textContent = WIN[Math.round(panTarget / 7)]
    qa('[data-pan]', panBox).forEach((b) =>
      b.setAttribute(
        'aria-disabled',
        String(Number(b.dataset.pan) < 0 ? panTarget === 0 : panTarget === 14),
      ),
    )
  }
  if (panBox !== null) {
    qa('[data-pan]', panBox).forEach((b) =>
      b.addEventListener('click', () => {
        if (b.getAttribute('aria-disabled') === 'true') return
        panTarget = clamp(panTarget + 7 * Number(b.dataset.pan), 0, 14)
        if (reducedMotion()) pan = panTarget
        syncPan()
      }),
    )
  }

  // one bead a press, eased like a flick, at once under reduced motion
  turnBtns.forEach((b) =>
    b.addEventListener('click', () => {
      if (uTarget > 0.5) return
      const by = (Number(b.dataset.spiralTurn) * TAU) / 12
      if (reducedMotion()) yaw += by
      else turnLeft += by
    }),
  )

  function syncUnroll(): void {
    const keys = uTarget > 0.5
    // the keys do not turn
    turnBtns.forEach((b) => {
      b.hidden = keys
    })
    if (unrollBtn !== null)
      q('span', unrollBtn).textContent = keys ? unrolledLabel : rolledLabel
    if (hint !== null)
      hint.textContent = hintFor({ focused, unrolled: keys, labels })
    if (panBox !== null) panBox.hidden = !(narrow && keys)
    syncPan()
  }

  bindPointer()
  bindKeys()

  // pointer: drag to turn, tap to play; a tap snaps to the nearest bead or key within 22 px
  function bindPointer(): void {
    canvas.addEventListener('pointerdown', (e) => {
      dragging = true
      moved = 0
      lastX = e.clientX
      vel = 0
      try {
        canvas.setPointerCapture(e.pointerId)
      } catch {
        // ignore
      }
    })
    canvas.addEventListener('pointermove', (e) => {
      if (e.pointerType === 'mouse' && !dragging) hoverAt(e)
      if (!dragging) return
      const dx = e.clientX - lastX
      lastX = e.clientX
      moved += Math.abs(dx)
      if (u < 0.5) {
        yaw += dx * 0.011
        vel = dx * 0.011 * 60
      }
    })
    canvas.addEventListener('pointerup', up)
    canvas.addEventListener('pointercancel', () => {
      dragging = false
    })
    // not an input the page's frame loop hears: the tag it leaves goes now
    canvas.addEventListener('pointerleave', () => {
      hover = null
      wake()
    })
    // A click with no pointer just before it is a screen reader's double-tap,
    // a switch or voice control: they activate the slider, so it plays the
    // note they picked. A finger's own click follows its pointerup at once.
    canvas.addEventListener('click', (e) => {
      if (e.timeStamp - lastUp < ACTIVATION_GAP_MS) return
      playAsked(LO + sel)
    })
  }

  function hoverAt(e: PointerEvent): void {
    const r = canvas.getBoundingClientRect()
    const x = e.clientX - r.left
    const y = e.clientY - r.top
    let best: BeadHit | null = null
    let bd = 1e9
    for (const h of hits) {
      const d = Math.hypot(h.x - x, h.y - y)
      if (d < Math.max(h.r + 8, 16) && d < bd) {
        bd = d
        best = h
      }
    }
    hover = best !== null && u < 0.6 ? best.s : null
    canvas.style.cursor = best !== null || u > 0.6 ? 'pointer' : 'grab'
  }

  // the key under a tap, or failing that the nearest within 22 px
  function keyAt(x: number, y: number): KeyHit | undefined {
    const under = keyHits.find(
      (kh) =>
        x >= kh.x &&
        x <= kh.x + kh.w &&
        y >= kh.y - KEY_SLOP &&
        y <= kh.y + kh.h + KEY_SLOP,
    )
    if (under) return under
    let best: KeyHit | undefined
    let bd = 22
    for (const kk of keyHits) {
      const d = Math.hypot(
        clamp(x, kk.x, kk.x + kk.w) - x,
        clamp(y, kk.y, kk.y + kk.h) - y,
      )
      if (d < bd) {
        bd = d
        best = kk
      }
    }
    return best
  }

  // the bead under a tap: the nearest within reach, the side facing the viewer winning a near tie
  function beadAt(x: number, y: number): BeadHit | undefined {
    let best: BeadHit | undefined
    let bd = 1e9
    for (const h of hits) {
      const d = Math.hypot(h.x - x, h.y - y)
      if (d < Math.max(h.r + 10, 22) && d - h.z * 0.02 < bd) {
        bd = d - h.z * 0.02
        best = h
      }
    }
    return best
  }

  function up(e: PointerEvent): void {
    lastUp = e.timeStamp
    if (!dragging) return
    dragging = false
    if (moved > 6) return
    const r = canvas.getBoundingClientRect()
    const x = e.clientX - r.left
    const y = e.clientY - r.top
    // unrolled, a tap plays a key; otherwise a bead
    const target = u > 0.6 ? keyAt(x, y) : beadAt(x, y)
    if (target) {
      setSel(target.s)
      playAsked(LO + target.s)
    }
  }

  // keyboard: a slider over the 37 notes. Arrows pick, Enter or Space plays, Shift with Left or Right turns the spiral
  function bindKeys(): void {
    canvas.tabIndex = 0
    canvas.setAttribute('aria-valuemin', '0')
    canvas.setAttribute('aria-valuemax', String(N - 1))
    setSel(sel)
    canvas.addEventListener('focus', () => {
      focused = true
      syncUnroll()
    })
    canvas.addEventListener('blur', () => {
      focused = false
      syncUnroll()
    })
    canvas.addEventListener('keydown', onKey)
  }

  function onKey(e: KeyboardEvent): void {
    const k = e.key
    if (e.shiftKey && (k === 'ArrowLeft' || k === 'ArrowRight')) {
      if (u < 0.5) yaw += k === 'ArrowLeft' ? -0.26 : 0.26
      e.preventDefault()
      return
    }
    const d = STEP_KEYS.get(k) ?? 0
    if (d !== 0) {
      setSel(sel + d)
      e.preventDefault()
      return
    }
    if (k === 'Home' || k === 'End') {
      setSel(k === 'Home' ? 0 : N - 1)
      e.preventDefault()
      return
    }
    if (k === 'Enter' || k === ' ' || k === 'Spacebar') {
      e.preventDefault()
      playAsked(LO + sel)
    }
  }

  /** The spiral's own motion this frame: a flick's glide, the drift, the unroll, the pan. */
  function step(dt: number): void {
    if (turnLeft !== 0) {
      const by = Math.sign(turnLeft) * Math.min(Math.abs(turnLeft), dt * 3)
      yaw += by
      turnLeft -= by
    }
    if (!dragging) {
      if (Math.abs(vel) > 0.01) {
        yaw += vel * dt
        vel *= Math.pow(0.04, dt)
      } else if (drifting() && u < 0.02 && turning) yaw += dt * 0.2
    }
    const du = uTarget - u
    if (Math.abs(du) > 0.001) {
      u += Math.sign(du) * Math.min(Math.abs(du), dt / 1.7)
    } else u = uTarget
    const dTop = topTarget - top
    if (Math.abs(dTop) > 0.001) {
      top += Math.sign(dTop) * Math.min(Math.abs(dTop), dt / 1.2)
    } else top = topTarget
    const dp = panTarget - pan
    pan =
      reducedMotion() || Math.abs(dp) < 0.01
        ? panTarget
        : pan + dp * Math.min(1, dt * 7)
    // face A to the front before unrolling
    if (u > 0 && u < 1 && Math.abs(yaw) > 0.001) {
      const k = Math.round(yaw / TAU) * TAU
      yaw += (k - yaw) * Math.min(1, dt * 4)
    }
  }

  /** How the figure looks now, as its next frame would draw it, a flash or a tag's fade aside. */
  const look = (): string =>
    `${canvas.clientWidth}x${canvas.clientHeight}@${window.devicePixelRatio || 1} ${yaw} ${u} ${top} ${pan} ${sel} ${focused} ${hover} ${labels} ${lit.size} ${Names.mode}`

  /** Whether the figure moves by itself in its next frame: a turn, a glide, the drift, the unroll, the camera, the pan. */
  const moving = (): boolean =>
    turnLeft !== 0 ||
    (!dragging &&
      (Math.abs(vel) > 0.01 || (drifting() && turning && u < 0.02))) ||
    u !== uTarget ||
    top !== topTarget ||
    pan !== panTarget

  /** Whether a tap's flash, or its bead's name tag, is still showing at `t`. */
  function fadingAt(t: number): boolean {
    if (tapLabel !== null && u < 0.6 && t - tapLabel.t < TAG_MS) return true
    for (const m of pulses.keys()) if (pulseOf(pulses, m, t) > 0) return true
    return false
  }

  /** Whether the page's own drawing asks for a frame: by its word, or always when it says nothing. */
  const pageWants = (): boolean =>
    opts.overlayWants?.() ??
    (opts.overlay !== undefined || opts.keys !== undefined)

  /** Whether the figure has a frame to draw: a change since its last, or something it shows moving. */
  const wants = (): boolean =>
    dirty ||
    look() !== drawnLook ||
    (room && (moving() || fadingAt(performance.now()) || pageWants()))

  /** Something the figure shows has changed with no input behind it: it draws in the next frame. */
  function changed(): void {
    dirty = true
    wake()
  }

  addDrawer({
    active: opts.active ?? watch(root),
    wants,
    draw(now, dt) {
      dirty = false
      const { ctx, w: W, h: H } = cv.fit()
      // a canvas not laid out yet (a hidden or collapsing box) has nothing
      // to show, and nothing on it moves until it has room
      room = W >= 24 && H >= 24
      if (!room) {
        drawnLook = look()
        return
      }
      const nar = W < 560
      if (nar !== narrow) {
        narrow = nar
        panTarget = narrow ? 7 : 0
        pan = panTarget
        syncUnroll()
      }
      step(dt)
      const keyView: KeyboardView = {
        narrow,
        pan,
        focused,
        sel,
        pulses,
        keyLabels: opts.keyLabels ?? 'landmarks',
        span: opts.span ?? null,
        spelling: Names.mode,
      }
      const view = {
        ...keyView,
        yaw,
        u,
        labels,
        lit,
        top,
        ringFrom: (opts.ring ?? 57) - LO,
        layer: opts.keys?.({ W, H, now, view: keyView }),
      }
      const drawn = drawSpiral(ctx, W, H, now, view)
      hits = drawn.hits
      keyHits = drawn.keyHits
      drawOverlays(ctx, W, now, hits, {
        u,
        focused,
        sel,
        hover,
        tapLabel,
        tag,
      })
      opts.overlay?.({ ctx, W, H, now, u, beads: hits, keys: keyHits })
      drawnLook = look()
    },
  })
  // a new size or pixel ratio draws again, and so does a font that loads
  // after a frame drew the tags and labels in another
  new ResizeObserver(changed).observe(canvas)
  watchPixelRatio(changed)
  void document.fonts?.ready.then(changed)
  document.fonts?.addEventListener('loadingdone', changed)

  // a change of names re-says the selected note, and draws it
  Names.subscribe(() => {
    canvas.setAttribute('aria-valuetext', valueText(LO + sel))
    wake()
  })

  return {
    root,
    lit,
    get selected() {
      return LO + sel
    },
    play(midi, o = {}) {
      return play(midi, o.audible, o.dur)
    },
    light(midi) {
      if (isBlack(midi)) lit.add(midi)
      wake()
    },
    select(midi) {
      setSel(midi - LO)
    },
    setUnrolled(on) {
      uTarget = on ? 1 : 0
      if (reducedMotion()) u = uTarget
      syncUnroll()
      wake()
    },
    get unrolled() {
      return u === 1
    },
    setLabels(next) {
      labels = next
      syncUnroll()
      wake()
    },
    setTurning(on) {
      turning = on
      wake()
    },
    setView(camera) {
      topTarget = camera === 'top' ? 1 : 0
      if (reducedMotion()) top = topTarget
      wake()
    },
    get top() {
      return top
    },
    get yaw() {
      return yaw
    },
    refresh() {
      syncUnroll()
      // the page's range may have moved: keep the selection inside it
      if (opts.range !== undefined) setSel(sel)
      canvas.setAttribute('aria-valuetext', valueText(LO + sel))
    },
  }
}
