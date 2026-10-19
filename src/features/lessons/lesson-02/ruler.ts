// ============================================================
// Lesson 2 semitone ruler — A3 to A4 standing up, measured in cents
// ============================================================
//
// Lesson 1's dial turned to stand vertical, because pitch is height: a ruler
// from A3 (0 cents, at the bottom) to A4 (1,200, at the top), the notes'
// names on its left in the page's spelling and the cents on its right. The
// marker is the viewer's: drag it (a soft tone sounds at its pitch while it
// is held, the dial's `holdTone`), or use the keys: an arrow moves it 1 cent,
// Shift with an arrow 10, Page Up and Page Down 100. Beside it, the cents
// above A3, the frequency to two decimals, and how MercuryPitch's monitor
// shows the same pitch: the nearest note in the app's sharps and a bar from
// -50 to +50 that flips to the next note at 50 (FACTS 24, 30), its marker in
// ink at every reading. One semitone zooms to A3 to A♯3, a tick every 10
// cents; Glide plays the 100-cent glide (FACTS 25) and the marker rides it,
// or under reduced motion stays put while the readouts count.

import { clamp, q } from '@/features/lessons/kit/dom'
import { addDrawer, surface, watch } from '@/features/lessons/kit/frame-loop'
import { reducedMotion } from '@/features/lessons/kit/motion-switch'
import { Names, namesFor } from '@/features/lessons/kit/names'
import { COLOR, rgba, signName } from '@/features/lessons/kit/notes'
import { playContour, Sound } from '@/features/lessons/kit/sound'
import { holdTone } from '@/features/lessons/kit/toy-helpers'
import { CENTS_GLIDE, glideCents } from './examples'
import { appName, centsHz, hz1, hz2, markerAt, reading, RULER_TOP, rulerValueText, } from './ruler-math'

export interface RulerOptions {
  /** When the ruler draws: a deck's `toyActive(n)`; default while its root is on screen. */
  readonly active?: () => boolean
}

export interface Ruler {
  /** The marker's place, cents above A3. */
  readonly cents: number
  set(cents: number): void
  /** Stops a held tone (the viewer left the step). */
  stop(): void
}

/** The keys that move the marker, and by how much (Shift multiplies the arrows by ten). */
const STEP: ReadonlyMap<string, number> = new Map([
  ['ArrowUp', 1],
  ['ArrowRight', 1],
  ['ArrowDown', -1],
  ['ArrowLeft', -1],
  ['PageUp', 100],
  ['PageDown', -100],
])

/** The ruler's geometry on a W by H canvas: its axis, and the height of a pitch. */
interface Layout {
  readonly axis: number
  readonly top: number
  readonly bottom: number
  yOf(cents: number): number
}

function layout(W: number, H: number, span: readonly [number, number]): Layout {
  const top = 24
  const bottom = H - 24
  const axis = Math.round(W < 560 ? W * 0.34 : W * 0.3)
  return {
    axis,
    top,
    bottom,
    yOf: (c) => bottom - ((c - span[0]) / (span[1] - span[0])) * (bottom - top),
  }
}

/** A note's name for the ruler's left column, in the page's spelling. */
const tickName = (midi: number): string =>
  namesFor(midi, Names.mode)
    .map((n) => signName(n))
    .join('/')

function drawTicks(
  ctx: CanvasRenderingContext2D,
  L: Layout,
  span: readonly [number, number],
): void {
  const fine = span[1] - span[0] <= 100
  const every = fine ? 10 : 100
  ctx.textBaseline = 'middle'
  for (let c = span[0]; c <= span[1]; c += every) {
    const y = Math.round(L.yOf(c)) + 0.5
    const semitone = c % 100 === 0
    const half = c % 100 === 50
    const len = semitone ? 10 : half ? 7 : 4
    ctx.strokeStyle = rgba(COLOR.chrome, semitone ? 0.6 : 0.3)
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(L.axis - len, y)
    ctx.lineTo(L.axis + len, y)
    ctx.stroke()
    ctx.font = '500 12px "JetBrains Mono", monospace'
    ctx.fillStyle = half ? COLOR.ink2 : COLOR.ink3
    ctx.textAlign = 'left'
    if (semitone || half || !fine) ctx.fillText(String(c), L.axis + 16, y)
    if (!semitone) continue
    ctx.font = '600 13px Outfit, sans-serif'
    ctx.fillStyle = COLOR.ink
    ctx.textAlign = 'right'
    ctx.fillText(tickName(57 + c / 100), L.axis - 16, y)
  }
}

function drawMarker(
  ctx: CanvasRenderingContext2D,
  L: Layout,
  cents: number,
  held: boolean,
): void {
  const y = L.yOf(cents)
  // the ruler, faint, then the stretch below the marker lit, and a short line across it
  ctx.strokeStyle = rgba(COLOR.chrome, 0.2)
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(L.axis, L.bottom)
  ctx.lineTo(L.axis, L.top)
  ctx.stroke()
  ctx.strokeStyle = rgba(COLOR.chrome, 0.75)
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(L.axis, L.bottom)
  ctx.lineTo(L.axis, y)
  ctx.stroke()
  ctx.strokeStyle = rgba(COLOR.ink, 0.85)
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(L.axis - 14, y)
  ctx.lineTo(L.axis + 14, y)
  ctx.stroke()
  const halo = ctx.createRadialGradient(L.axis, y, 0, L.axis, y, held ? 30 : 20)
  halo.addColorStop(0, rgba(COLOR.chrome, held ? 0.55 : 0.35))
  halo.addColorStop(1, rgba(COLOR.chrome, 0))
  ctx.fillStyle = halo
  ctx.beginPath()
  ctx.arc(L.axis, y, held ? 30 : 20, 0, Math.PI * 2)
  ctx.fill()
  const bead = ctx.createRadialGradient(L.axis - 3, y - 3, 1, L.axis, y, 10)
  bead.addColorStop(0, '#ffffff')
  bead.addColorStop(0.5, COLOR.chrome)
  bead.addColorStop(1, '#5b6b7b')
  ctx.fillStyle = bead
  ctx.beginPath()
  ctx.arc(L.axis, y, 9, 0, Math.PI * 2)
  ctx.fill()
}

interface Parts {
  readonly slider: HTMLElement
  readonly cents: HTMLElement
  readonly hz: HTMLElement
  readonly note: HTMLElement
  readonly noteHz: HTMLElement
  readonly marker: HTMLElement
  readonly zoom: HTMLButtonElement | null
  readonly glide: HTMLButtonElement | null
}

function partsOf(root: HTMLElement): Parts {
  return {
    slider: q('.ruler-slider', root),
    cents: q('[data-ruler-cents]', root),
    hz: q('[data-ruler-hz]', root),
    note: q('[data-monitor-note]', root),
    noteHz: q('[data-monitor-hz]', root),
    marker: q('[data-monitor-marker]', root),
    zoom: root.querySelector<HTMLButtonElement>('[data-ruler-zoom]'),
    glide: root.querySelector<HTMLButtonElement>('[data-ruler-glide]'),
  }
}

/** Writes every readout for a pitch `c` cents above A3: the ruler's, the monitor's, the slider's spoken value. */
function readOut(p: Parts, c: number): void {
  const f = centsHz(c)
  const r = reading(c)
  p.cents.textContent = String(Math.round(c))
  p.hz.innerHTML = `${hz2(f)}<small>Hz</small>`
  p.note.textContent = appName(r.midi)
  p.noteHz.textContent = `${hz1(f)} Hz`
  p.marker.style.left = `${(markerAt(r.off) * 100).toFixed(2)}%`
}

export function mountRuler(root: HTMLElement, opts: RulerOptions = {}): Ruler {
  const cv = surface(q<HTMLCanvasElement>('canvas', root))
  const p = partsOf(root)
  let span: [number, number] = [0, RULER_TOP]
  let cents = 0
  let glideAt: number | null = null
  let lastL: Layout | null = null
  let stripAt = -1
  const tone = holdTone(p.slider, () => centsHz(cents))

  function set(c: number, quiet = false): void {
    cents = clamp(Math.round(c), span[0], span[1])
    p.slider.setAttribute('aria-valuenow', String(cents))
    p.slider.setAttribute('aria-valuetext', rulerValueText(cents))
    readOut(p, cents)
    if (!quiet) tone.follow()
  }

  function fromPointer(e: PointerEvent): void {
    if (lastL === null || glideAt !== null) return
    const r = cv.canvas.getBoundingClientRect()
    const y = e.clientY - r.top
    const u = (lastL.bottom - y) / (lastL.bottom - lastL.top)
    set(span[0] + u * (span[1] - span[0]))
  }

  let dragging = false
  p.slider.addEventListener('pointerdown', (e) => {
    dragging = true
    try {
      p.slider.setPointerCapture(e.pointerId)
    } catch {
      // ignore
    }
    fromPointer(e)
  })
  p.slider.addEventListener('pointermove', (e) => {
    if (dragging) fromPointer(e)
  })
  for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture'])
    p.slider.addEventListener(ev, () => {
      dragging = false
    })

  // the whole figure shows the keyboard's focus, so the outline never cuts the ruler's labels
  const viz = p.slider.parentElement
  p.slider.addEventListener('focus', () =>
    viz?.classList.toggle('is-focused', p.slider.matches(':focus-visible')),
  )
  p.slider.addEventListener('blur', () => viz?.classList.remove('is-focused'))

  p.slider.addEventListener('keydown', (e) => {
    // a key pressed is the keyboard's focus, however the slider was focused
    viz?.classList.add('is-focused')
    if (glideAt !== null) return
    const d = STEP.get(e.key)
    if (d !== undefined) {
      const k = e.shiftKey && Math.abs(d) === 1 ? 10 : 1
      set(cents + d * k)
      e.preventDefault()
    } else if (e.key === 'Home' || e.key === 'End') {
      set(e.key === 'Home' ? span[0] : span[1])
      e.preventDefault()
    }
  })

  p.zoom?.addEventListener('click', () => {
    const zoomed = span[1] !== RULER_TOP
    span = zoomed ? [0, RULER_TOP] : [0, 100]
    p.zoom?.setAttribute('aria-pressed', String(!zoomed))
    p.slider.setAttribute('aria-valuemax', String(span[1]))
    set(cents, true)
  })

  p.glide?.addEventListener('click', () => {
    if (glideAt !== null) return
    const audible = Sound.canPlay()
    set(0, true)
    glideAt = performance.now()
    p.glide?.classList.add('is-on')
    void playContour(CENTS_GLIDE, { audible }).then(() => {
      // the glide's last 0.6 s is A♯3 held: land there once it ends
      window.setTimeout(() => {
        glideAt = null
        set(100, true)
        p.glide?.classList.remove('is-on')
      }, 50)
    })
  })

  addDrawer({
    active: opts.active ?? watch(root),
    draw(now) {
      const { ctx, w: W, h: H } = cv.fit()
      const L = layout(W, H, span)
      lastL = L
      // the slider's strip, 88 px wide, follows the ruler's axis
      if (L.axis !== stripAt) {
        stripAt = L.axis
        p.slider.style.left = `${L.axis - 44}px`
      }
      drawTicks(ctx, L, span)
      let at = cents
      if (glideAt !== null) {
        const c = glideCents((now - glideAt) / 1000)
        readOut(p, c)
        if (!reducedMotion()) at = clamp(c, span[0], span[1])
      }
      drawMarker(ctx, L, at, tone.holding || glideAt !== null)
    },
  })

  set(0, true)
  return {
    get cents() {
      return cents
    },
    set: (c) => set(c, true),
    stop: () => tone.stop(),
  }
}
