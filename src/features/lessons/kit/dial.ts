// ============================================================
// Lesson dial — a frequency dial from 110 to 880 Hz, sounding while held
// ============================================================
//
// The dial is logarithmic, 110 * 8^(value / 1000), so each octave takes the
// same travel, as the ear hears it. The canvas holds 20 ms of air still, with
// one swing bracketed, so the squeeze is read against a fixed time axis while
// the bead on the pitch rail climbs. The note sounds only while the slider is
// held (`holdTone`), and a page stops it when the viewer leaves its step.
//
// Mounted on a root, any number per page. Inside the root: the canvas, the
// range input, and optionally the `[data-dial-hz]` and `[data-dial-period]`
// readouts and the `[data-dial-note]` name. Lesson 2's semitone ruler and
// Lesson 3's match toy reuse its parts (the log slider, `holdTone`, the
// rail) under drawings of their own.

import { q, TAU } from './dom'
import { addDrawer, surface, watch } from './frame-loop'
import { COLOR, fmtHz, nameOf, rgba } from './notes'
import { drawRail, glowStroke, holdTone, rangeFill } from './toy-helpers'

export interface DialOptions {
  /** When the figure draws: a deck's `toyActive(n)`; default while its root is on screen. */
  readonly active?: () => boolean
}

export interface Dial {
  /** The dial's frequency, Hz. */
  readonly frequency: number
  /** Stops a held note now (the viewer left its step). */
  stop(): void
}

export function mountDial(root: HTMLElement, opts: DialOptions = {}): Dial {
  const cv = surface(q<HTMLCanvasElement>('canvas', root))
  const input = q<HTMLInputElement>('input[type="range"]', root)
  const roHz = root.querySelector('[data-dial-hz]')
  const roPeriod = root.querySelector('[data-dial-period]')
  const dialNote = root.querySelector('[data-dial-note]')
  let f = 220
  const toF = (): number => 110 * Math.pow(8, Number(input.value) / 1000)
  const tone = holdTone(input, () => f)

  function update(): void {
    f = toF()
    rangeFill(input)
    if (roHz !== null) roHz.innerHTML = `${fmtHz(f)}<small>Hz</small>`
    if (roPeriod !== null)
      roPeriod.innerHTML = `${(1000 / f).toFixed(2)}<small>ms</small>`
    const m = 69 + 12 * Math.log2(f / 440)
    const mr = Math.round(m)
    const nm = Math.abs(m - mr) < 0.18 ? nameOf(mr) : null
    if (dialNote !== null) dialNote.textContent = nm ?? 'between letters'
    input.setAttribute('aria-valuetext', `${Math.round(f)} hertz`)
    tone.follow()
  }
  input.addEventListener('input', update)
  update()

  addDrawer({
    active: opts.active ?? watch(root),
    draw() {
      const playing = tone.holding
      const { ctx, w: W, h: H } = cv.fit()
      const railX = W - 30
      const wx0 = 18
      const wx1 = W - 86
      const cy = H * 0.6
      const A = Math.min(H * 0.19, 60)
      const T = 0.02
      // time axis: 20 ms of air
      ctx.strokeStyle = 'rgba(195,204,214,.14)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(wx0, cy)
      ctx.lineTo(wx1, cy)
      ctx.stroke()
      ctx.font = '500 12px "JetBrains Mono", monospace'
      ctx.fillStyle = COLOR.ink3
      ctx.textBaseline = 'top'
      for (let ms = 0; ms <= 20; ms += 5) {
        const x = wx0 + ((wx1 - wx0) * ms) / 20
        ctx.strokeStyle = 'rgba(195,204,214,.25)'
        ctx.beginPath()
        ctx.moveTo(x, H - 26)
        ctx.lineTo(x, H - 21)
        ctx.stroke()
        ctx.textAlign = ms === 0 ? 'left' : ms === 20 ? 'right' : 'center'
        ctx.fillText(ms === 20 ? '20 ms' : String(ms), x, H - 18)
      }
      // one swing, bracketed
      const per = (1 / f / T) * (wx1 - wx0)
      const by = cy - A - 14
      ctx.strokeStyle = rgba(COLOR.aqua, 0.7)
      ctx.beginPath()
      ctx.moveTo(wx0, by + 4)
      ctx.lineTo(wx0, by)
      ctx.lineTo(wx0 + per, by)
      ctx.lineTo(wx0 + per, by + 4)
      ctx.stroke()
      ctx.fillStyle = COLOR.aqua
      ctx.textAlign = 'left'
      ctx.textBaseline = 'bottom'
      ctx.fillText('ONE SWING', wx0, by - 3)
      // the wave holds still, so the bracket always spans its first swing
      ctx.beginPath()
      for (let px = wx0; px <= wx1; px += 1.5) {
        const tt = ((px - wx0) / (wx1 - wx0)) * T
        const yy = cy - A * Math.cos(TAU * f * tt)
        if (px === wx0) ctx.moveTo(px, yy)
        else ctx.lineTo(px, yy)
      }
      glowStroke(ctx, COLOR.chrome, 1.8, playing ? 1 : 0.85)
      drawRail(ctx, {
        x: railX,
        top: 26,
        bot: H - 30,
        f,
        glow: playing ? 1 : 0,
      })
    },
  })

  return {
    get frequency() {
      return f
    },
    stop: () => tone.stop(),
  }
}
