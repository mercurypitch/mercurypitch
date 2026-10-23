// ============================================================
// Lesson 1 octave toy — Fig. 4, two waves, their fit, and the octave ladder
// ============================================================
//
// Orange runs at 220 Hz times the ratio against blue's 220 Hz. A ruler under
// the waves marks each one's peaks, and gold (which means "fits" and nothing
// else) goes where a blue peak meets an orange one within 3 % of a slow
// cycle; the waves drift half a slow cycle a second so the fit can be
// watched holding, or failing to. The slider has a soft detent at 2. Beside
// it the ladder climbs A2 to A5: equal steps on screen, doubling gaps in
// hertz.

import { announce, announcer } from '@/features/lessons/kit/announce'
import { q, qa, TAU } from '@/features/lessons/kit/dom'
import { addDrawer, surface } from '@/features/lessons/kit/frame-loop'
import { Motion } from '@/features/lessons/kit/motion-switch'
import { COLOR, nameOf, noteColor, rgba } from '@/features/lessons/kit/notes'
import type { Voice } from '@/features/lessons/kit/sound'
import { playTone, Sound } from '@/features/lessons/kit/sound'
import type { StepDeck } from '@/features/lessons/kit/step-deck'
import { registerToy } from '@/features/lessons/kit/step-deck'
import { glowStroke, rangeFill } from '@/features/lessons/kit/toy-helpers'

/** The ladder's rungs, top down: MIDI note and frequency. */
const LADDER: [number, number][] = [
  [81, 880],
  [69, 440],
  [57, 220],
  [45, 110],
]

interface Rung {
  m: number
  f: number
  b: HTMLButtonElement
}

export function initOctaveToy(deck: StepDeck): void {
  const cv = surface(q<HTMLCanvasElement>('#cvOct'))
  const input = q<HTMLInputElement>('#ratio')
  const flag = q('#octFlag')
  const status = q('#octStatus')
  const playBtn = q<HTMLButtonElement>('#octPlay')
  const playLabel = q('span', playBtn)
  const playIcon = q<SVGUseElement>('use', playBtn)
  const roRatio = q('#roRatio')
  const ratioVal = q('#ratioVal')
  const roOrange = q('#roOrange')
  const readout = q('#vizOct .readout')
  // the readout's foot in the figure, px, read again when the figure's
  // height changes or the fonts arrive
  let readoutFoot = 0
  let footFor = -1
  void document.fonts?.ready.then(() => {
    footFor = -1
  })
  let r = 2
  // a pointer is dragging the ratio: only a drag feels the octave's detent
  let dragging = false
  let vb: Voice | null = null
  let vo: Voice | null = null
  let playT = 0
  let tau = 0.5 / 220

  function setFlag(): string {
    const near126 = Math.abs(r - 1.26) < 0.006
    let txt = ''
    let col: string = COLOR.chrome
    if (r === 2) {
      txt = 'Octave: 2 : 1'
      col = COLOR.gold
    } else if (r === 1) txt = 'Same note · 1 : 1'
    else if (r === 3) txt = '3 : 1 fits too: a different note (E5)'
    else if (r === 1.5) txt = '3 : 2 · meets on every other slow peak'
    else if (near126) {
      txt = '277 Hz · a different note'
      col = COLOR.violet
    }
    if (txt !== '') {
      flag.textContent = txt
      flag.style.color = col
      flag.style.background = rgba(col, 0.1)
      flag.style.border = `1px solid ${rgba(col, 0.5)}`
    }
    flag.style.opacity = txt !== '' ? '1' : '0'
    status.classList.toggle('flagged', txt !== '')
    return txt
  }

  /** Reads the slider, redraws the readouts and the flag, and returns what the slider now says aloud. */
  function update(): string {
    let val = Number(input.value) / 100
    // A soft detent at the octave, for a drag only: an arrow key or a screen
    // reader's swipe moves one step at a time, and the detent pulled every
    // step off 2.00 straight back to it.
    if (dragging && Math.abs(val - 2) < 0.035 && val !== 2) {
      val = 2
      input.value = '200'
    }
    r = Math.round(val * 100) / 100
    rangeFill(input)
    roRatio.innerHTML = `${r.toFixed(2)}<small>&#215;</small>`
    ratioVal.textContent = r.toFixed(2)
    roOrange.innerHTML = `${Math.round(220 * r)}<small>Hz</small>`
    // the flag is read out with the value, so a screen reader hears what the picture names
    const txt = setFlag()
    const said =
      txt !== '' ? `. ${txt.replace(/ : /g, ' to ').replace(' · ', ', ')}` : ''
    const valueText = `ratio ${r.toFixed(2)}, ${Math.round(220 * r)} hertz${said}`
    input.setAttribute('aria-valuetext', valueText)
    if (vo) vo.setFreq(220 * r, 0.015)
    return valueText
  }
  input.addEventListener('input', () => void update())
  input.addEventListener('pointerdown', () => {
    dragging = true
  })
  window.addEventListener('pointerup', () => {
    dragging = false
  })
  window.addEventListener('pointercancel', () => {
    dragging = false
  })
  // "Try 1.26", "Back to 2" and "Try 3" move a slider the keyboard is not
  // on: what it now says is spoken, as the flag shows it
  announcer()
  qa('[data-ratio]').forEach((b) =>
    b.addEventListener('click', () => {
      input.value = String(Math.round(Number(b.dataset.ratio) * 100))
      announce(update())
    }),
  )

  function stop(): void {
    if (vb) vb.stop()
    if (vo) vo.stop()
    vb = null
    vo = null
    window.clearTimeout(playT)
    playBtn.classList.remove('is-on')
    playLabel.textContent = 'Play both'
    playIcon.setAttribute('href', '#i-play')
  }
  playBtn.addEventListener('click', () => {
    if (vb || playBtn.classList.contains('is-on')) {
      stop()
      return
    }
    const audible = Sound.canPlay()
    playBtn.classList.add('is-on')
    playLabel.textContent = 'Stop'
    playIcon.setAttribute('href', '#i-stop')
    if (audible) {
      vb = Sound.voice(220, { gain: 0.11 })
      vo = Sound.voice(220 * r, { gain: 0.085 })
    }
    playT = window.setTimeout(stop, 9000)
  })
  update()

  // the octave ladder: equal steps on screen, doubling gaps in hertz
  const lad = q('#ladder')
  const rungs: Rung[] = []
  LADDER.forEach(([m, f], i, arr) => {
    const row = document.createElement('div')
    row.className = 'rung'
    row.innerHTML = `<button class="btn sm tint" type="button" style="--c:${noteColor(m)}"><span class="dot"></span>${nameOf(m)} · ${f} Hz</button>`
    lad.appendChild(row)
    rungs.push({ m, f, b: q<HTMLButtonElement>('button', row) })
    if (i < arr.length - 1) {
      const gap = document.createElement('div')
      gap.className = 'rung-gap'
      gap.textContent = `+${arr[i + 1][1]} Hz`
      lad.appendChild(gap)
    }
  })
  const ring = async (rg: Rung, audible: boolean): Promise<void> => {
    rg.b.classList.add('is-on')
    await playTone(rg.f, 0.62, { audible })
    rg.b.classList.remove('is-on')
  }
  rungs.forEach((rg) =>
    rg.b.addEventListener('click', () => void ring(rg, Sound.canPlay())),
  )
  let climbing = false

  async function climb(): Promise<void> {
    if (climbing) return
    climbing = true
    const audible = Sound.canPlay()
    for (const rg of rungs.slice().reverse()) await ring(rg, audible)
    climbing = false
  }
  q('#ladderAll').addEventListener('click', () => void climb())
  registerToy({
    onStep(n) {
      if (n !== 4) stop()
    },
  })

  addDrawer({
    active: deck.toyActive(4),
    draw(_now, dt) {
      const { ctx, w: W, h: H } = cv.fit()
      // the waves drift half a slow cycle a second (slowed down, of course)
      if (!Motion.paused) tau += (dt * 0.5) / 220
      const x0 = 16
      const x1 = W - 16
      const cycles = 6
      const T = cycles / 220
      // the waves keep clear of the readout in the corner above them (a
      // peak's glow reaches 14 px up) and of the peak ruler's label below:
      // a figure a short stage has shortened swings less, and nothing meets
      if (footFor !== H) {
        readoutFoot = readout.offsetTop + readout.offsetHeight
        footFor = H
      }
      const top = readoutFoot + 14
      const A = Math.max(0, Math.min(H * 0.17, 54, (H - 74 - top) / 2))
      const cy = Math.max(H * 0.44, top + A)
      const xOf = (t: number): number => x0 + (t / T) * (x1 - x0)
      ctx.strokeStyle = 'rgba(195,204,214,.12)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(x0, cy)
      ctx.lineTo(x1, cy)
      ctx.stroke()
      // the peak ruler: blue peaks, orange peaks, gold where they meet within 3 % of a slow cycle
      const rb = H - 52
      const roy = H - 32
      const k0 = Math.ceil(tau * 220 - 1e-9)
      const golds: number[] = []
      for (let k = k0; k <= k0 + cycles; k++) {
        const tb = k / 220 - tau
        if (k === 0 || tb < 0 || tb > T) continue
        const m = Math.round(k * r)
        const fit = Math.abs(k * r - m) <= 0.03 * r + 1e-9
        const x = xOf(tb)
        ctx.strokeStyle = rgba(COLOR.blue, 0.85)
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.moveTo(x, rb - 7)
        ctx.lineTo(x, rb + 7)
        ctx.stroke()
        if (fit) golds.push(x)
      }
      const m0 = Math.ceil(tau * 220 * r - 1e-9)
      for (let m = m0; ; m++) {
        const to = m / (220 * r) - tau
        if (to > T) break
        if (to < 0) continue
        const x = xOf(to)
        ctx.strokeStyle = rgba(COLOR.orange, 0.85)
        ctx.lineWidth = 1.6
        ctx.beginPath()
        ctx.moveTo(x, roy - 6)
        ctx.lineTo(x, roy + 6)
        ctx.stroke()
      }
      ctx.font = '500 12px "JetBrains Mono", monospace'
      ctx.textBaseline = 'middle'
      ctx.textAlign = 'left'
      ctx.fillStyle = COLOR.blue
      ctx.fillText('220 PEAKS', x0, rb - 16)
      ctx.fillStyle = COLOR.orange
      ctx.fillText(`${Math.round(220 * r)} PEAKS`, x0, roy + 15)
      for (const x of golds) {
        ctx.strokeStyle = rgba(COLOR.gold, 0.55)
        ctx.setLineDash([2, 4])
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(x, cy - A - 10)
        ctx.lineTo(x, roy + 7)
        ctx.stroke()
        ctx.setLineDash([])
        const g = ctx.createRadialGradient(x, cy - A, 0, x, cy - A, 14)
        g.addColorStop(0, rgba(COLOR.gold, 0.55))
        g.addColorStop(1, rgba(COLOR.gold, 0))
        ctx.fillStyle = g
        ctx.beginPath()
        ctx.arc(x, cy - A, 14, 0, TAU)
        ctx.fill()
        ctx.fillStyle = COLOR.gold
        ctx.beginPath()
        ctx.arc(x, cy - A, 3.6, 0, TAU)
        ctx.fill()
      }
      const wave = (f: number, amp: number, col: string, w: number): void => {
        ctx.beginPath()
        for (let px = x0; px <= x1; px += 1.25) {
          const t = ((px - x0) / (x1 - x0)) * T + tau
          const y = cy - amp * Math.cos(TAU * f * t)
          if (px === x0) ctx.moveTo(px, y)
          else ctx.lineTo(px, y)
        }
        glowStroke(ctx, col, w, 1)
      }
      wave(220, A, COLOR.blue, 2.4)
      wave(220 * r, A, COLOR.orange, 1.6)
    },
  })
}
