// ============================================================
// Lesson loudness toy — how far against how fast, on one wave
// ============================================================
//
// The figure exists to pull the two apart: "how far" changes the wave's
// height and the loudness meter but never moves the bead, "how fast" moves
// the bead whatever the height. Loudness is drawn as a horizontal bar on
// purpose, so nothing about it reads as height, and a flag under the canvas
// names what each move did to the pitch. Either slider sounds while it is
// held. Lesson 1 names the sliders "how far" and "how fast" in a soft tone;
// Lesson 3 names them Louder and Higher, in Merc's "ooh". On both, a screen
// reader hears what each move did.
//
// Mounted on a root, any number per page. Inside the root: the canvas, the
// `input[data-loud="far"]` and `input[data-loud="fast"]` sliders, and
// optionally the `[data-loud-flag]` (inside a `.viz-status`), the
// `[data-loud-far-value]` and `[data-loud-fast-value]` labels and the
// `[data-loud-ro="loud"]` and `[data-loud-ro="pitch"]` readouts. The slider
// labels are the page's own markup.
//
// The flag is spoken through the page's status line (announce.ts), once
// for each new thing it says: a slider sets it on every step, and a screen
// reader should hear "Pitch: climbing" once, not at every step of the climb.

import { announce, announcer } from './announce'
import { q, TAU } from './dom'
import { addDrawer, surface, watch } from './frame-loop'
import { COLOR, rgba } from './notes'
import type { Voice, VoiceOptions } from './sound'
import { Sound } from './sound'
import { drawRail, glowStroke, holdToPlay, rangeFill } from './toy-helpers'

/** The flag's words for each move. */
export interface LoudFlags {
  /** "How far" moved: the pitch stays put. */
  readonly far: string
  /** "How fast" moved the pitch up, or down. */
  readonly up: string
  readonly down: string
}

export interface LoudOptions {
  /** When the figure draws: a deck's `toyActive(n)`; default while its root is on screen. */
  readonly active?: () => boolean
  /** The held tone: the kit's soft tone (default) or Merc's "ooh". */
  readonly kind?: VoiceOptions['kind']
  readonly flags?: LoudFlags
}

export interface Loud {
  /** Stops a held note now (the viewer left its step). */
  stop(): void
}

const FLAGS: LoudFlags = {
  far: 'Pitch: unchanged',
  up: 'Pitch: climbing',
  down: 'Pitch: falling',
}

/** The wave, its reach, the loudness bar and the pitch rail, for one frame. */
function drawLoud(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  s: { a: number; f: number; playing: boolean },
): void {
  const railX = W - 30
  const wx0 = 18
  const wx1 = W - 86
  const cy = H * 0.5
  const Amax = Math.min(H * 0.25, 78)
  const T = 0.02
  ctx.strokeStyle = 'rgba(195,204,214,.14)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(wx0, cy)
  ctx.lineTo(wx1, cy)
  ctx.stroke()
  // how far: dashed guides at the swing's reach
  ctx.setLineDash([3, 5])
  ctx.strokeStyle = rgba(COLOR.chrome, 0.4)
  for (const yy of [cy - Amax * s.a, cy + Amax * s.a]) {
    ctx.beginPath()
    ctx.moveTo(wx0, yy)
    ctx.lineTo(wx1, yy)
    ctx.stroke()
  }
  ctx.setLineDash([])
  ctx.beginPath()
  for (let px = wx0; px <= wx1; px += 1.5) {
    const tt = ((px - wx0) / (wx1 - wx0)) * T
    const yy = cy - Amax * s.a * Math.cos(TAU * s.f * tt)
    if (px === wx0) ctx.moveTo(px, yy)
    else ctx.lineTo(px, yy)
  }
  glowStroke(ctx, COLOR.chrome, 1.8, 0.95)
  // loudness is size: a horizontal meter, never height
  const mx = wx0
  const my = H - 26
  const mw = Math.min(220, (wx1 - wx0) * 0.6)
  ctx.font = '500 12px "JetBrains Mono", monospace'
  ctx.fillStyle = COLOR.ink3
  ctx.textAlign = 'left'
  ctx.textBaseline = 'bottom'
  ctx.fillText('LOUDNESS', mx, my - 6)
  ctx.fillStyle = 'rgba(195,204,214,.12)'
  ctx.fillRect(mx, my, mw, 6)
  const lg = ctx.createLinearGradient(mx, 0, mx + mw, 0)
  lg.addColorStop(0, rgba(COLOR.chrome, 0.45))
  lg.addColorStop(1, COLOR.chrome)
  ctx.fillStyle = lg
  ctx.fillRect(mx, my, mw * s.a, 6)
  ctx.fillStyle = COLOR.ink3
  ctx.textAlign = 'right'
  ctx.fillText('PITCH', railX + 18, 18)
  drawRail(ctx, {
    x: railX,
    top: 30,
    bot: H - 30,
    f: s.f,
    glow: s.playing ? 1 : 0,
  })
}

export function mountLoud(root: HTMLElement, opts: LoudOptions = {}): Loud {
  const cv = surface(q<HTMLCanvasElement>('canvas', root))
  const amp = q<HTMLInputElement>('input[data-loud="far"]', root)
  const fast = q<HTMLInputElement>('input[data-loud="fast"]', root)
  const flag = root.querySelector<HTMLElement>('[data-loud-flag]')
  const status = flag?.closest('.viz-status') ?? null
  const ampVal = root.querySelector('[data-loud-far-value]')
  const fastVal = root.querySelector('[data-loud-fast-value]')
  const roLoud = root.querySelector('[data-loud-ro="loud"]')
  const roPitch = root.querySelector('[data-loud-ro="pitch"]')
  const flags = opts.flags ?? FLAGS
  const kind = opts.kind
  let a = 0.5
  let f = 220
  let v: Voice | null = null
  let playing = false
  let flagT = 0
  // the pitch the flag last spoke from: an arrow key moves "how fast" by a
  // fraction of a hertz, under the flag's half-hertz bar, so each step is
  // measured from here and not from the step before, or a keyboard never
  // hears "Pitch: climbing"
  let flagFrom = 0
  // what the flag last said aloud, until it fades
  let said = ''
  if (flag !== null) announcer()
  const showFlag = (txt: string, col: string): void => {
    if (flag === null) return
    if (txt !== said) announce(txt)
    said = txt
    flag.textContent = txt
    flag.style.color = col
    flag.style.background = rgba(col, 0.1)
    flag.style.border = `1px solid ${rgba(col, 0.45)}`
    flag.style.opacity = '1'
    status?.classList.add('flagged')
    window.clearTimeout(flagT)
    flagT = window.setTimeout(() => {
      flag.style.opacity = '0'
      status?.classList.remove('flagged')
      said = ''
    }, 1600)
  }

  function update(which?: 'amp' | 'fast'): void {
    a = Number(amp.value) / 100
    f = 110 * Math.pow(8, Number(fast.value) / 1000)
    rangeFill(amp)
    rangeFill(fast)
    if (ampVal !== null) ampVal.textContent = `${Math.round(a * 100)}%`
    if (fastVal !== null) fastVal.textContent = `${Math.round(f)} Hz`
    if (roLoud !== null)
      roLoud.innerHTML = `${Math.round(a * 100)}<small>%</small>`
    if (roPitch !== null)
      roPitch.innerHTML = `${Math.round(f)}<small>Hz</small>`
    amp.setAttribute('aria-valuetext', `${Math.round(a * 100)} percent`)
    fast.setAttribute('aria-valuetext', `${Math.round(f)} hertz`)
    if (which === 'amp') showFlag(flags.far, COLOR.chrome)
    if (which === 'fast' && Math.abs(f - flagFrom) > 0.5) {
      showFlag(f > flagFrom ? flags.up : flags.down, COLOR.aqua)
      flagFrom = f
    }
    if (which === undefined) flagFrom = f
    if (v) {
      v.setFreq(f, 0.015)
      v.setGain(0.03 + 0.2 * a, 0.03)
    }
  }
  amp.addEventListener('input', () => update('amp'))
  fast.addEventListener('input', () => update('fast'))
  const stop = (): void => {
    if (v) {
      v.stop()
      v = null
    }
  }
  const hp = {
    start(): void {
      playing = true
      if (Sound.canPlay()) v = Sound.voice(f, { kind, gain: 0.03 + 0.2 * a })
    },
    stop(): void {
      playing = false
      stop()
    },
  }
  holdToPlay(amp, hp)
  holdToPlay(fast, hp)
  update()

  addDrawer({
    active: opts.active ?? watch(root),
    draw() {
      const { ctx, w, h } = cv.fit()
      drawLoud(ctx, w, h, { a, f, playing })
    },
  })

  return { stop }
}
