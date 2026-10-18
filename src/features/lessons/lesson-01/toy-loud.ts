// ============================================================
// Lesson 1 loudness toy — Fig. 3, how far against how fast
// ============================================================
//
// The figure exists to pull the two apart: "how far" changes the wave's
// height and the loudness meter but never moves the bead, "how fast" moves
// the bead whatever the height. Loudness is drawn as a horizontal bar on
// purpose, so nothing about it reads as height, and a flag under the canvas
// names what each move did to the pitch. Either slider sounds while it is
// held.

import { q, TAU } from '@/features/lessons/kit/dom'
import { addDrawer, surface } from '@/features/lessons/kit/frame-loop'
import { COLOR, rgba } from '@/features/lessons/kit/notes'
import type { Voice } from '@/features/lessons/kit/sound'
import { Sound } from '@/features/lessons/kit/sound'
import type { StepDeck } from '@/features/lessons/kit/step-deck'
import { registerToy } from '@/features/lessons/kit/step-deck'
import { drawRail, glowStroke, holdToPlay, rangeFill, } from '@/features/lessons/kit/toy-helpers'

export function initLoudToy(deck: StepDeck): void {
  const cv = surface(q<HTMLCanvasElement>('#cvLoud'))
  const amp = q<HTMLInputElement>('#amp')
  const fast = q<HTMLInputElement>('#fast')
  const flag = q('#loudFlag')
  const status = q('#loudStatus')
  const ampVal = q('#ampVal')
  const fastVal = q('#fastVal')
  const roLoud = q('#roLoud')
  const roPitch = q('#roPitch')
  let a = 0.5
  let f = 220
  let v: Voice | null = null
  let playing = false
  let flagT = 0
  const showFlag = (txt: string, col: string): void => {
    flag.textContent = txt
    flag.style.color = col
    flag.style.background = rgba(col, 0.1)
    flag.style.border = `1px solid ${rgba(col, 0.45)}`
    flag.style.opacity = '1'
    status.classList.add('flagged')
    window.clearTimeout(flagT)
    flagT = window.setTimeout(() => {
      flag.style.opacity = '0'
      status.classList.remove('flagged')
    }, 1600)
  }

  function update(which?: 'amp' | 'fast'): void {
    const pf = f
    a = Number(amp.value) / 100
    f = 110 * Math.pow(8, Number(fast.value) / 1000)
    rangeFill(amp)
    rangeFill(fast)
    ampVal.textContent = `${Math.round(a * 100)}%`
    fastVal.textContent = `${Math.round(f)} Hz`
    roLoud.innerHTML = `${Math.round(a * 100)}<small>%</small>`
    roPitch.innerHTML = `${Math.round(f)}<small>Hz</small>`
    amp.setAttribute('aria-valuetext', `${Math.round(a * 100)} percent`)
    fast.setAttribute('aria-valuetext', `${Math.round(f)} hertz`)
    if (which === 'amp') showFlag('Pitch: unchanged', COLOR.chrome)
    if (which === 'fast' && Math.abs(f - pf) > 0.5) {
      showFlag(f > pf ? 'Pitch: climbing' : 'Pitch: falling', COLOR.aqua)
    }
    if (v) {
      v.setFreq(f, 0.015)
      v.setGain(0.03 + 0.2 * a, 0.03)
    }
  }
  amp.addEventListener('input', () => update('amp'))
  fast.addEventListener('input', () => update('fast'))
  const hp = {
    start(): void {
      playing = true
      if (Sound.canPlay()) v = Sound.voice(f, { gain: 0.03 + 0.2 * a })
    },
    stop(): void {
      playing = false
      if (v) {
        v.stop()
        v = null
      }
    },
  }
  holdToPlay(amp, hp)
  holdToPlay(fast, hp)
  update()
  registerToy({
    onStep(n) {
      if (n !== 3 && v) {
        v.stop()
        v = null
      }
    },
  })

  addDrawer({
    active: deck.toyActive(3),
    draw() {
      const { ctx, w: W, h: H } = cv.fit()
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
      for (const yy of [cy - Amax * a, cy + Amax * a]) {
        ctx.beginPath()
        ctx.moveTo(wx0, yy)
        ctx.lineTo(wx1, yy)
        ctx.stroke()
      }
      ctx.setLineDash([])
      ctx.beginPath()
      for (let px = wx0; px <= wx1; px += 1.5) {
        const tt = ((px - wx0) / (wx1 - wx0)) * T
        const yy = cy - Amax * a * Math.cos(TAU * f * tt)
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
      ctx.fillRect(mx, my, mw * a, 6)
      ctx.fillStyle = COLOR.ink3
      ctx.textAlign = 'right'
      ctx.fillText('PITCH', railX + 18, 18)
      drawRail(ctx, {
        x: railX,
        top: 30,
        bot: H - 30,
        f,
        glow: playing ? 1 : 0,
      })
    },
  })
}
