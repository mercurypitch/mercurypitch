// ============================================================
// Lesson 1 string toy — Fig. 1, a plucked string you can slow 220 times
// ============================================================
//
// In real time the string rings at 220 Hz, far too fast to see, so the
// drawing shows what the eye catches: the envelope and a few softened
// snapshots, while a push travels out through a fixed field of air every
// 0.18 s. Slowed 220 times the fundamental swings once a second: a tick and a
// ripple mark each swing, and a pen trace of the string's middle draws
// "there and back" as a wave. Under reduced motion the pushes do not travel;
// the air beside the string glows instead.

import { mulberry32, q, TAU } from '@/features/lessons/kit/dom'
import { addDrawer, surface } from '@/features/lessons/kit/frame-loop'
import { reducedMotion } from '@/features/lessons/kit/motion-switch'
import { COLOR, rgba } from '@/features/lessons/kit/notes'
import { Sound } from '@/features/lessons/kit/sound'
import type { StepDeck } from '@/features/lessons/kit/step-deck'
import { registerToy } from '@/features/lessons/kit/step-deck'

/** One molecule of the air: where it sits, its size and its resting brightness. */
interface Mote {
  x: number
  y: number
  r: number
  a: number
}

/** A push on the air in real time: when it left the string, and how hard. */
interface Front {
  t: number
  a: number
}

const STEEL: [number, string][] = [
  [0, '#5b6b7b'],
  [0.16, '#c3ccd6'],
  [0.3, '#f4f8fd'],
  [0.48, '#8a97a6'],
  [0.66, '#dfe6ee'],
  [0.84, '#a8b3bf'],
  [1, '#5b6b7b'],
]

// a polished steel string: a gradient along its length, a soft halo, a thin sheen on top
function metal(
  ctx: CanvasRenderingContext2D,
  x0: number,
  x1: number,
  path: () => void,
  w: number,
  alpha = 1,
): void {
  const g = ctx.createLinearGradient(x0, 0, x1, 0)
  STEEL.forEach(([o, c]) => g.addColorStop(o, c))
  ctx.globalAlpha = alpha
  path()
  ctx.strokeStyle = rgba(COLOR.chrome, 0.09)
  ctx.lineWidth = w * 7
  ctx.stroke()
  path()
  ctx.strokeStyle = g
  ctx.lineWidth = w
  ctx.stroke()
  ctx.save()
  ctx.translate(0, -w * 0.3)
  path()
  ctx.strokeStyle = 'rgba(255,255,255,.5)'
  ctx.lineWidth = Math.max(0.6, w * 0.26)
  ctx.stroke()
  ctx.restore()
  ctx.globalAlpha = 1
}

export function initStringToy(deck: StepDeck): void {
  const canvas = q<HTMLCanvasElement>('#cvString')
  const cv = surface(canvas)
  const slowBtn = q<HTMLButtonElement>('#slowBtn')
  const hint = q('#stringHint')
  const ro = { sw: q('#roSwings'), t: q('#roTime'), rate: q('#roRate') }
  let mode: 'real' | 'slow' = 'real'
  let t0 = -1e9
  let slowT0 = 0
  let swings = 0
  let ripples: number[] = []
  let trail: [number, number][] = []
  let lastRo = ''
  let fronts: Front[] = []
  let lastFront = 0
  // the air: a faint, fixed field of molecules. A passing push brightens them and nudges them outward,
  // so the frame is never empty and "each push travels outward" has something to travel through.
  const rnd = mulberry32(220)
  const air: Mote[] = Array.from({ length: 1100 }, () => ({
    x: rnd(),
    y: rnd(),
    r: 0.7 + rnd() * 0.8,
    a: 0.05 + rnd() * 0.09,
  }))

  function pluck(): void {
    const now = performance.now()
    if (mode === 'slow') {
      slowT0 = now
      swings = 0
      ripples = []
      trail = []
      if (Sound.canPlay()) Sound.tick(1200, 0.07)
    } else {
      t0 = now
      fronts = []
      lastFront = 0
      if (Sound.canPlay()) Sound.pluck(220)
      hint.textContent = 'Too fast to see: that blur is 220 swings a second'
    }
  }
  canvas.addEventListener('pointerdown', pluck)
  q('#pluckBtn').addEventListener('click', pluck)
  slowBtn.addEventListener('click', () => {
    const on = slowBtn.getAttribute('aria-pressed') !== 'true'
    slowBtn.setAttribute('aria-pressed', String(on))
    mode = on ? 'slow' : 'real'
    hint.textContent = on
      ? 'Slowed 220 times: one swing a second'
      : 'Tap the string to pluck it'
    if (on) {
      slowT0 = performance.now()
      swings = 0
      ripples = []
      trail = []
    }
  })
  registerToy({
    onStep() {
      // a pluck dies away by itself, so a step change has nothing to stop
    },
  })

  addDrawer({
    active: deck.toyActive(1),
    draw(now) {
      const { ctx, w: W, h: H } = cv.fit()
      const x0 = W * 0.07
      const x1 = W * 0.93
      const y = H * 0.56
      const L = x1 - x0
      const cx = W / 2
      const still = reducedMotion()
      const el = (now - t0) / 1000
      const Areal =
        mode === 'real' ? H * 0.2 * Math.exp(-el * 2.1) * (el >= 0 ? 1 : 0) : 0
      // pushes on the air: in real time a front every 0.18 s while the string rings; slowed, one per swing
      if (mode === 'real' && Areal > 0.35 && !still && now - lastFront > 180) {
        fronts.push({ t: now, a: Areal / (H * 0.2) })
        lastFront = now
      }
      const speed = W * 0.36
      const frontR = (f: Front): number => 8 + ((now - f.t) / 1000) * speed
      fronts = fronts.filter((f) => frontR(f) < W * 0.8)
      const pushes =
        mode === 'slow'
          ? ripples.map((r) => ({
              rad: 14 + ((now - r) / 1000) * W * 0.16,
              a: 0.9 * (1 - (now - r) / 4200),
            }))
          : fronts.map((f) => ({
              rad: frontR(f),
              a: f.a * (1 - frontR(f) / (W * 0.8)),
            }))
      // reduced motion: the air by the string glows instead of travelling
      const near = mode === 'real' && still ? Areal / (H * 0.2) : 0
      for (const d of air) {
        const px = d.x * W
        const py = d.y * H
        const ex = (px - cx) / 1.35
        const ey = (py - y) / 0.62
        const e = Math.hypot(ex, ey) || 1
        let boost = near * Math.exp(-Math.pow(Math.abs(py - y) / 26, 2))
        for (const p of pushes) {
          boost += p.a * Math.exp(-Math.pow((e - p.rad) / 9, 2))
        }
        const nud = Math.min(3, boost * 2.4)
        ctx.fillStyle = rgba(COLOR.chrome, Math.min(0.75, d.a + boost * 0.45))
        ctx.fillRect(
          px + (ex / e) * nud * 1.35 - d.r / 2,
          py + (ey / e) * nud * 0.62 - d.r / 2,
          d.r,
          d.r,
        )
      }
      // the bridge pins
      const peg = (x: number): void => {
        const g = ctx.createRadialGradient(x - 2, y - 2, 1, x, y, 8)
        g.addColorStop(0, '#fff')
        g.addColorStop(0.5, COLOR.chrome)
        g.addColorStop(1, '#4a5563')
        ctx.fillStyle = g
        ctx.beginPath()
        ctx.arc(x, y, 6.5, 0, TAU)
        ctx.fill()
      }
      let text: string
      if (mode === 'real') {
        const A = Areal
        if (A > 0.35) {
          // too fast to see: the eye catches a blur, so draw the envelope and a few frozen snapshots, softened
          ctx.beginPath()
          for (let i = 0; i <= 80; i++) {
            const l = i / 80
            ctx.lineTo(x0 + l * L, y - A * Math.sin(Math.PI * l))
          }
          for (let i = 80; i >= 0; i--) {
            const l = i / 80
            ctx.lineTo(x0 + l * L, y + A * Math.sin(Math.PI * l))
          }
          const fg = ctx.createLinearGradient(0, y - A, 0, y + A)
          fg.addColorStop(0, rgba(COLOR.chrome, 0.05))
          fg.addColorStop(0.5, rgba(COLOR.chrome, 0.2))
          fg.addColorStop(1, rgba(COLOR.chrome, 0.05))
          ctx.fillStyle = fg
          ctx.fill()
          if ('filter' in ctx) ctx.filter = 'blur(1.2px)'
          for (let k = 0; k < 7; k++) {
            const ph = (k / 7) * TAU + now * 0.05
            ctx.beginPath()
            for (let i = 0; i <= 80; i++) {
              const l = i / 80
              ctx.lineTo(
                x0 + l * L,
                y +
                  A *
                    (Math.sin(Math.PI * l) * Math.cos(ph) +
                      0.3 * Math.sin(TAU * l) * Math.cos(2 * ph + 0.6)),
              )
            }
            ctx.strokeStyle = rgba(COLOR.chrome, 0.26)
            ctx.lineWidth = 1.2
            ctx.stroke()
          }
          if ('filter' in ctx) ctx.filter = 'none'
        } else if (
          el > 2.4 &&
          (hint.textContent ?? '').startsWith('Too fast')
        ) {
          hint.textContent = 'Tap to pluck again, or turn on slow motion'
        }
        metal(
          ctx,
          x0,
          x1,
          () => {
            ctx.beginPath()
            ctx.moveTo(x0, y)
            ctx.lineTo(x1, y)
          },
          2.2,
          A > 0.35 ? 0.4 : 1,
        )
        text = 'real'
      } else {
        // slowed 220 times: the fundamental swings at 220 / 220 = 1 per second (plus a quieter second harmonic at 2)
        const ts = (now - slowT0) / 1000
        const A = H * 0.23
        const n = Math.floor(ts)
        if (n > swings) {
          swings = n
          ripples.push(now)
          Sound.tick(1500, 0.06)
        }
        ripples = ripples.filter((r) => now - r < 4200)
        for (const r of ripples) {
          const age = (now - r) / 1000
          const rad = 14 + age * W * 0.16
          const a = 0.22 * (1 - age / 4.2)
          ctx.strokeStyle = rgba(COLOR.chrome, a)
          ctx.lineWidth = 1
          ctx.beginPath()
          ctx.ellipse(cx, y, rad * 1.35, rad * 0.62, 0, 0, TAU)
          ctx.stroke()
        }
        const yy = (l: number): number =>
          y +
          A *
            (Math.sin(Math.PI * l) * Math.cos(TAU * ts) +
              0.16 * Math.sin(TAU * l) * Math.cos(TAU * 2 * ts + 0.6))
        metal(
          ctx,
          x0,
          x1,
          () => {
            ctx.beginPath()
            for (let i = 0; i <= 120; i++) {
              const l = i / 120
              ctx.lineTo(x0 + l * L, yy(l))
            }
          },
          2.6,
        )
        // a pen trace of the string's middle, sliding left as time passes: there and back, drawn as a wave
        const my = yy(0.5)
        trail.push([now, my])
        trail = trail.filter((p) => now - p[0] < 2600)
        const pxs = W * 0.12 // pixels per second of slowed time
        for (let i = 1; i < trail.length; i++) {
          const a = i / trail.length
          const xa = cx - ((now - trail[i - 1][0]) / 1000) * pxs
          const xb = cx - ((now - trail[i][0]) / 1000) * pxs
          ctx.strokeStyle = rgba(COLOR.aqua, a * 0.7)
          ctx.lineWidth = 1 + 1.6 * a
          ctx.beginPath()
          ctx.moveTo(xa, trail[i - 1][1])
          ctx.lineTo(xb, trail[i][1])
          ctx.stroke()
        }
        ctx.fillStyle = COLOR.aqua
        ctx.beginPath()
        ctx.arc(cx, my, 5, 0, TAU)
        ctx.fill()
        ctx.font = '500 12px "JetBrains Mono", monospace'
        ctx.fillStyle = COLOR.ink3
        ctx.textAlign = 'left'
        ctx.textBaseline = 'middle'
        ctx.fillText('THERE', cx + 16, y - A)
        ctx.fillText('AND BACK', cx + 16, y + A)
        ctx.strokeStyle = 'rgba(195,204,214,.25)'
        ctx.beginPath()
        ctx.moveTo(cx + 8, y - A)
        ctx.lineTo(cx + 12, y - A)
        ctx.moveTo(cx + 8, y + A)
        ctx.lineTo(cx + 12, y + A)
        ctx.stroke()
        text = `${swings}|${ts.toFixed(1)}`
      }
      peg(x0)
      peg(x1)
      if (text !== lastRo) {
        lastRo = text
        if (mode === 'real') {
          ro.sw.textContent = '220'
          ro.t.innerHTML = '1.0<small>s</small>'
          ro.rate.innerHTML = '220<small>per s</small>'
        } else {
          ro.sw.textContent = String(swings)
          ro.t.innerHTML = `${((now - slowT0) / 1000).toFixed(1)}<small>s</small>`
          ro.rate.innerHTML = '1<small>per s</small>'
        }
      }
    },
  })
}
