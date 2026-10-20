// ============================================================
// Lesson 3 folds toy — Fig. 1, the vocal folds seen from above
// ============================================================
//
// A schematic, not anatomy to scale (FACTS, Illustrations): two folds in a
// V that opens at the back, apart while breathing. Sing (hold it) brings
// them together and sounds Merc's "ooh" at Stretch's pitch while they
// vibrate; at real speed that is a blur, as Lesson 1's string is. Slow
// motion slows the vibration 220 times (kit/slow-motion.ts), so each open
// and close shows, with a tick and a counter: once a second at 220 Hz,
// twice at 440 Hz (FACTS 22), and no "ooh", since the sound is never slowed.
// Stretch is the dial's log slider, 110 to 440 Hz (FACTS 48): the folds
// draw longer and thinner as it rises, and the rail's bead climbs in the
// note's colour. Under reduced motion the singing folds are two stills,
// open and closed, with the rate in words. The folds themselves are the
// kit's drawing (kit/folds.ts), which Lesson 5's three starts share.
//
// Mounted on a root, twice on the page (Step 1 and free play): inside it the
// canvas, `[data-folds="breathe" | "sing" | "slow" | "stretch"]`, the
// `[data-folds-ro]` readout, the `[data-folds-count]` counter, the
// `[data-folds-note]` label and the `[data-folds-live]` line.

import { clamp, lerp, q, TAU } from '@/features/lessons/kit/dom'
import { drawFoldLabels, drawFoldPair, drawFoldText, foldShapeAt, } from '@/features/lessons/kit/folds'
import { addDrawer, surface, watch } from '@/features/lessons/kit/frame-loop'
import { reducedMotion } from '@/features/lessons/kit/motion-switch'
import { COLOR, fmtHz, nameHtml, noteColor, sharpOf, wordName, } from '@/features/lessons/kit/notes'
import { createSlowClock, slowRate } from '@/features/lessons/kit/slow-motion'
import type { Voice } from '@/features/lessons/kit/sound'
import { Sound } from '@/features/lessons/kit/sound'
import { drawRail, rangeFill } from '@/features/lessons/kit/toy-helpers'

/** Stretch's log scale, 110 to 440 Hz (A2 to A4): each octave the same travel. */
export const stretchHz = (value: number): number => 110 * 4 ** (value / 1000)

/** The note a frequency sits on, within 15 cents, or null between notes. */
export function noteAt(f: number): number | null {
  const m = 69 + 12 * Math.log2(f / 440)
  const r = Math.round(m)
  return Math.abs(m - r) * 100 <= 15 ? r : null
}

/** Stretch's spoken value: "220 hertz, A3: the folds open and close 220 times a second". */
export function stretchText(f: number): string {
  const n = Math.round(f)
  const midi = noteAt(f)
  const name = midi === null ? '' : `, ${wordName(sharpOf(midi))}`
  return `${n} hertz${name}: the folds open and close ${n} times a second`
}

/** The readout: "220 Hz: 220 swings a second", or slowed, "slowed 220 times: 1 a second". */
export function foldsReadout(f: number, slow: boolean): string {
  return slow
    ? `slowed 220 times: ${slowRate(f)} a second`
    : `${fmtHz(f)}\u202fHz: ${Math.round(f)} swings a second`
}

export interface FoldsOptions {
  /** When the figure draws: a deck's `toyActive(n)`; default while its root is on screen. */
  readonly active?: () => boolean
}

export interface Folds {
  /** Stops singing now (the viewer left the step). */
  stop(): void
}

const MONO = '500 12px "JetBrains Mono", monospace'

export function mountFolds(root: HTMLElement, opts: FoldsOptions = {}): Folds {
  const cv = surface(q<HTMLCanvasElement>('canvas', root))
  const breathe = q<HTMLButtonElement>('[data-folds="breathe"]', root)
  const sing = q<HTMLButtonElement>('[data-folds="sing"]', root)
  const slowBtn = q<HTMLButtonElement>('[data-folds="slow"]', root)
  const stretch = q<HTMLInputElement>('[data-folds="stretch"]', root)
  const ro = q('[data-folds-ro]', root)
  const count = q('[data-folds-count]', root)
  const note = q('[data-folds-note]', root)
  const live = q('[data-folds-live]', root)
  const clock = createSlowClock()
  let f = stretchHz(Number(stretch.value))
  let singing = false
  let slow = false
  let open = 1
  let breathT0 = -1e9
  let v: Voice | null = null
  let shownCount = ''

  function readouts(): void {
    ro.textContent = foldsReadout(f, slow)
    const midi = noteAt(f)
    note.innerHTML = `${fmtHz(f)}\u202fHz${midi === null ? '' : `, ${nameHtml(sharpOf(midi))}`}`
    stretch.setAttribute('aria-valuetext', stretchText(f))
  }

  function say(): void {
    if (!singing) live.textContent = 'Breathing: the folds are apart.'
    else if (slow)
      live.textContent = `Singing, slowed 220 times: the folds open and close ${slowRate(f)} a second.`
    else
      live.textContent = `Singing: the folds open and close ${Math.round(f)} times a second.`
  }

  function start(): void {
    if (singing) return
    singing = true
    clock.reset()
    sing.setAttribute('aria-pressed', 'true')
    if (!slow && Sound.canPlay()) v = Sound.voice(f, { kind: 'merc' })
    say()
  }

  function stop(): void {
    if (v) {
      v.stop()
      v = null
    }
    if (!singing) return
    singing = false
    sing.setAttribute('aria-pressed', 'false')
    say()
  }

  // Sing is held: a pointer from down to up, or Space or Enter from down to up
  sing.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return
    sing.setPointerCapture(e.pointerId)
    start()
  })
  for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture', 'blur'])
    sing.addEventListener(ev, stop)
  sing.addEventListener('keydown', (e) => {
    if (e.key !== ' ' && e.key !== 'Enter') return
    e.preventDefault()
    if (!e.repeat) start()
  })
  sing.addEventListener('keyup', (e) => {
    if (e.key === ' ' || e.key === 'Enter') stop()
  })

  breathe.addEventListener('click', () => {
    stop()
    breathT0 = performance.now()
    live.textContent = 'Breathing: the folds are apart.'
  })
  slowBtn.addEventListener('click', () => {
    slow = slowBtn.getAttribute('aria-pressed') !== 'true'
    slowBtn.setAttribute('aria-pressed', String(slow))
    clock.reset()
    // the "ooh" sounds only at real speed: slowed, each cycle ticks instead
    if (slow && v) {
      v.stop()
      v = null
    } else if (!slow && singing && Sound.canPlay())
      v = Sound.voice(f, { kind: 'merc' })
    readouts()
    say()
  })
  stretch.addEventListener('input', () => {
    f = stretchHz(Number(stretch.value))
    rangeFill(stretch)
    v?.setFreq(f, 0.015)
    readouts()
  })
  rangeFill(stretch)
  readouts()

  function counter(): void {
    const text = slow ? String(clock.cycles) : `${Math.round(f)}`
    if (text === shownCount) return
    shownCount = text
    count.innerHTML = slow ? text : `${text}<small>a second</small>`
  }

  // the opening this frame: apart for breathing (wider mid-breath), together for singing
  function openness(now: number, dt: number): number {
    const b = (now - breathT0) / 1800
    const breath = b >= 0 && b < 1 ? 0.3 * Math.sin(Math.PI * b) : 0
    const target = singing ? 0 : 1 + breath
    if (reducedMotion()) return singing ? 0 : 1
    open += (target - open) * (1 - Math.exp(-dt * 9))
    return open
  }

  function drawLive(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    now: number,
    dt: number,
  ): void {
    const s = clamp(Math.log2(f / 110) / 2, 0, 1)
    const shape = foldShapeAt(h, s, (w - 70) / 2 + 6)
    const o = openness(now, dt)
    shape.gap = lerp(1, shape.len * 0.3, clamp(o, 0, 1.3))
    const vib = 6 * (1 - 0.3 * s)
    if (singing && slow) {
      if (clock.advance(dt, f) && Sound.canPlay()) Sound.tick(1500, 0.06)
      shape.bulge = vib * Math.max(0, Math.sin(TAU * clock.phase))
      drawFoldPair(ctx, shape)
    } else if (singing) {
      // too fast to see: the blur between closed and open
      drawFoldPair(ctx, { ...shape, bulge: vib }, 0.35)
      drawFoldPair(ctx, shape, 0.75)
    } else drawFoldPair(ctx, shape)
    drawFoldLabels(ctx, shape)
  }

  // reduced motion: two stills while singing, open and closed; one still, apart, while breathing
  function drawStills(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
  ): void {
    const s = clamp(Math.log2(f / 110) / 2, 0, 1)
    const plot = w - 70
    if (!singing) {
      const shape = foldShapeAt(h, s, plot / 2 + 6)
      shape.gap = shape.len * 0.3
      drawFoldPair(ctx, shape)
      drawFoldLabels(ctx, shape)
      return
    }
    const vib = 6 * (1 - 0.3 * s)
    for (const [i, word] of ['OPEN', 'CLOSED'].entries()) {
      const shape = foldShapeAt(h * 0.86, s, plot * (0.3 + 0.42 * i))
      shape.bulge = i === 0 ? vib : 0
      drawFoldPair(ctx, shape)
      drawFoldText(ctx, word, shape.cx, shape.y0 + shape.len + 18, 'center')
    }
  }

  addDrawer({
    active: opts.active ?? watch(root),
    draw(now, dt) {
      const { ctx, w, h } = cv.fit()
      if (reducedMotion()) drawStills(ctx, w, h)
      else drawLive(ctx, w, h, now, dt)
      const midi = noteAt(f)
      ctx.font = MONO
      ctx.fillStyle = COLOR.ink3
      ctx.textAlign = 'right'
      ctx.textBaseline = 'alphabetic'
      ctx.fillText('PITCH', w - 12, 18)
      drawRail(ctx, {
        x: w - 30,
        top: 30,
        bot: h - 30,
        f,
        glow: singing ? 1 : 0,
        color: midi === null ? COLOR.chrome : noteColor(midi),
      })
      counter()
    },
  })

  return { stop }
}
