// ============================================================
// Lesson 1 hero — the night sky, the living staff and the pitch rail
// ============================================================
//
// The cold open's stage: the kit's stars (kit/hero-sky.ts), then a
// five-line staff pinned at both ends (sin(pi x)) that breathes while idle
// and rings when a Merc sings, Merc's side at 220 Hz and Tavi's twice as
// fast and twice as dense, then Merc and Tavi either side of a log-scale
// pitch rail (110 to 880 Hz, octaves equally spaced). The entrance pushes
// the camera in: the far sky moves least, the staff more, Merc and Tavi in the
// DOM most (`heroCamera`).

import { lerp, q, svg, TAU } from '@/features/lessons/kit/dom'
import { addDrawer, surface, watch } from '@/features/lessons/kit/frame-loop'
import { drawStars, makeStars } from '@/features/lessons/kit/hero-sky'
import { energy } from '@/features/lessons/kit/merc-duo'
import { Motion } from '@/features/lessons/kit/motion-switch'
import { COLOR, logPos, rgba } from '@/features/lessons/kit/notes'

/** Driven by the entrance: `intro` grows the staff in, `cam` pushes the camera. */
export const heroCamera = { intro: 1, cam: 1 }

export function initHero(): void {
  const stage = q('#heroStage')
  const cv = surface(q<HTMLCanvasElement>('#sky'))
  const duo = q('#duo')
  const shot = q('#stageShot')
  const blue = q('#mercBlue')
  const visible = watch(stage)
  const stars = makeStars()
  const shown = { blue: 0, orange: 0 }
  let idleT = 0

  addDrawer({
    active: visible,
    draw(now, dt) {
      const { ctx, w: W, h: H } = cv.fit()
      if (!Motion.paused) idleT += dt * 1000
      const twinkle = Motion.paused ? 0 : 1
      const cam = heroCamera.cam
      const ox = W / 2
      const oy = H * 0.7
      const sStaff = lerp(1.05, 1, cam)
      drawStars(ctx, W, H, stars, { idleT, twinkle, cam })
      ctx.save()
      ctx.translate(ox, oy + 8 * (1 - cam))
      ctx.scale(sStaff, sStaff)
      ctx.translate(-ox, -oy)
      for (const k of ['blue', 'orange'] as const) {
        const rate = energy[k] > shown[k] ? 7 : 2.4
        shown[k] += (energy[k] - shown[k]) * (1 - Math.exp(-dt * rate))
      }
      // the living staff, fitted to Merc and Tavi
      const merc = blue.offsetWidth || 200
      const sp = merc * 0.062
      const y0 = shot.offsetTop + duo.offsetTop + merc * 0.44 - 2 * sp
      const g = ctx.createLinearGradient(0, 0, W, 0)
      g.addColorStop(0, rgba(COLOR.blue, 0))
      g.addColorStop(0.12, rgba(COLOR.blue, 1))
      g.addColorStop(0.5, rgba(COLOR.chrome, 1))
      g.addColorStop(0.88, rgba(COLOR.orange, 1))
      g.addColorStop(1, rgba(COLOR.orange, 0))
      const eB = shown.blue
      const eO = shown.orange
      const intro = heroCamera.intro
      for (let k = 0; k < 5; k++) {
        const lw = 1 + k * 0.3
        const f = 1.5 + k * 0.5
        const ph = k * 1.7
        const yk = y0 + k * sp
        ctx.beginPath()
        for (let px = 0; px <= W; px += 3) {
          const x = px / W
          const pin = Math.sin(Math.PI * x)
          const idle =
            sp *
            0.16 *
            Math.sin(TAU * f * x + idleT * 0.0011 * (1 + k * 0.17) + ph) *
            (0.55 + 0.45 * Math.sin(idleT * 0.0006 + k * 1.3))
          // blue's note: 220 Hz; orange's: 440 Hz, drawn twice as fast and twice as dense
          const b =
            eB *
            sp *
            0.7 *
            Math.exp(-(((x - 0.22) / 0.3) ** 2)) *
            Math.sin(TAU * 3 * x - now * 0.006 + k * 0.5)
          const o =
            eO *
            sp *
            0.7 *
            Math.exp(-(((x - 0.78) / 0.3) ** 2)) *
            Math.sin(TAU * 6 * x - now * 0.012 + k * 0.5)
          const y = yk + pin * (idle + b + o) * intro
          if (px > 0) ctx.lineTo(px, y)
          else ctx.moveTo(px, y)
        }
        ctx.strokeStyle = g
        ctx.globalAlpha = 0.07 * intro * (1 + eB + eO)
        ctx.lineWidth = lw * 6
        ctx.stroke()
        ctx.globalAlpha = (0.34 + 0.2 * Math.max(eB, eO)) * intro
        ctx.lineWidth = lw
        ctx.stroke()
      }
      ctx.globalAlpha = 1
      ctx.restore()
    },
  })

  buildRail()
}

/** The rail between Merc and Tavi: log scale 110 to 880 Hz, with Merc's A at 220 and Tavi's at 440. */
function buildRail(): void {
  const rail = q<SVGSVGElement>('#heroRail')
  const box = rail.parentElement
  if (box === null) return
  const draw = (): void => {
    const W = box.clientWidth
    const H = box.clientHeight
    if (W === 0 || H === 0) return
    rail.setAttribute('viewBox', `0 0 ${W} ${H}`)
    rail.textContent = ''
    const defs = svg('defs', {}, rail)
    for (const [id, a, b, c] of [
      ['bb', '#cfe5ff', COLOR.blue, '#1d4f8f'],
      ['bo', '#ffe0cf', COLOR.orange, '#8f2d12'],
    ]) {
      const grad = svg(
        'radialGradient',
        { id, cx: 0.36, cy: 0.3, r: 0.8 },
        defs,
      )
      svg('stop', { offset: 0, 'stop-color': a }, grad)
      svg('stop', { offset: 0.45, 'stop-color': b }, grad)
      svg('stop', { offset: 1, 'stop-color': c }, grad)
    }
    const cx = W / 2
    const top = 6
    const bot = H - 6
    const yOf = (f: number): number => bot - logPos(f) * (bot - top)
    svg(
      'line',
      {
        x1: cx,
        x2: cx,
        y1: top - 4,
        y2: bot + 4,
        stroke: 'rgba(195,204,214,.35)',
        'stroke-width': 1,
      },
      rail,
    )
    for (let s = 0; s <= 36; s++) {
      const octave = s % 12 === 0
      const y = yOf(110 * 2 ** (s / 12))
      const len = octave ? 9 : 4
      svg(
        'line',
        {
          class: octave ? 'tick oct' : 'tick',
          x1: cx - len,
          x2: cx + len,
          y1: y,
          y2: y,
        },
        rail,
      )
    }
    const bead = (which: 'blue' | 'orange', f: number, side: -1 | 1): void => {
      const y = yOf(f)
      const col = which === 'blue' ? COLOR.blue : COLOR.orange
      const g = svg(
        'g',
        { 'data-bead': which, class: 'bead', style: `--y:${y}px` },
        rail,
      )
      svg(
        'circle',
        {
          class: 'halo',
          cx,
          cy: y,
          r: 13,
          fill: 'none',
          stroke: col,
          'stroke-width': 1.4,
        },
        g,
      )
      svg('circle', { cx, cy: y, r: 16, fill: rgba(col, 0.12) }, g)
      svg(
        'circle',
        { cx, cy: y, r: 7.5, fill: `url(#${which === 'blue' ? 'bb' : 'bo'})` },
        g,
      )
      svg(
        'ellipse',
        {
          cx: cx - 2.4,
          cy: y - 2.6,
          rx: 2.4,
          ry: 1.6,
          fill: 'rgba(255,255,255,.85)',
        },
        g,
      )
      const narrow = W < 70
      const off = narrow ? 14 : 24
      const tx = side < 0 ? cx - off : cx + off
      const anchor = side < 0 ? 'end' : 'start'
      svg(
        'text',
        {
          x: tx,
          y: y - 1,
          'text-anchor': anchor,
          class: 'lbl',
          fill: col,
          text: 'A',
        },
        g,
      )
      svg(
        'text',
        {
          x: tx,
          y: y + 13,
          'text-anchor': anchor,
          class: 'unit',
          text: narrow ? String(f) : `${f} HZ`,
        },
        g,
      )
    }
    bead('blue', 220, -1)
    bead('orange', 440, 1)
  }
  draw()
  new ResizeObserver(draw).observe(box)
}
