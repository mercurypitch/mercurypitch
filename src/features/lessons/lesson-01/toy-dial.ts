// ============================================================
// Lesson 1 dial toy — Fig. 2, a frequency dial from 110 to 880 Hz
// ============================================================
//
// The dial is logarithmic, 110 * 8^(value / 1000), so each octave takes the
// same travel, as the ear hears it. The canvas holds 20 ms of air still, with
// one swing bracketed, so the squeeze is read against a fixed time axis while
// the bead on the pitch rail climbs. The note sounds only while the slider is
// held, and stops if the viewer leaves the step mid-hold.

import { q, TAU } from '@/features/lessons/kit/dom'
import { addDrawer, surface } from '@/features/lessons/kit/frame-loop'
import { COLOR, fmtHz, nameOf, rgba } from '@/features/lessons/kit/notes'
import type { Voice } from '@/features/lessons/kit/sound'
import { Sound } from '@/features/lessons/kit/sound'
import type { StepDeck } from '@/features/lessons/kit/step-deck'
import { registerToy } from '@/features/lessons/kit/step-deck'
import { drawRail, glowStroke, holdToPlay, rangeFill, } from '@/features/lessons/kit/toy-helpers'

export function initDialToy(deck: StepDeck): void {
  const cv = surface(q<HTMLCanvasElement>('#cvDial'))
  const input = q<HTMLInputElement>('#dial')
  const roHz = q('#roHz')
  const roPeriod = q('#roPeriod')
  const dialNote = q('#dialNote')
  let f = 220
  let v: Voice | null = null
  let playing = false
  const toF = (): number => 110 * Math.pow(8, Number(input.value) / 1000)

  function update(): void {
    f = toF()
    rangeFill(input)
    roHz.innerHTML = `${fmtHz(f)}<small>Hz</small>`
    roPeriod.innerHTML = `${(1000 / f).toFixed(2)}<small>ms</small>`
    const m = 69 + 12 * Math.log2(f / 440)
    const mr = Math.round(m)
    const nm = Math.abs(m - mr) < 0.18 ? nameOf(mr) : null
    dialNote.textContent = nm ?? 'between letters'
    input.setAttribute('aria-valuetext', `${Math.round(f)} hertz`)
    if (v) v.setFreq(f, 0.015)
  }
  input.addEventListener('input', update)
  holdToPlay(input, {
    start() {
      playing = true
      if (Sound.canPlay()) v = Sound.voice(f, { gain: 0.13 })
    },
    stop() {
      playing = false
      if (v) {
        v.stop()
        v = null
      }
    },
  })
  update()
  registerToy({
    onStep(n) {
      if (n !== 2 && v) {
        v.stop()
        v = null
      }
    },
  })

  addDrawer({
    active: deck.toyActive(2),
    draw() {
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
}
