// ============================================================
// Lesson 3 match toy — Fig. 3, match it by ear with a slider
// ============================================================
//
// Pitch is height on an upright stage, ±300 cents around Merc's note. Your
// note starts a seeded 80 to 200 cents above or below his (FACTS 47) and
// sounds while you drag it (the kit's `holdToPlay`). Play Merc's note plays
// his A3 in the kit's soft tone, steady, so the comparison and the beats are
// clean; Compare plays his, then yours, a second each, and only then shows
// the gap, a tick at his pitch and the 35-cent band with "in the band" or
// "outside the band". Moving your note hides the gap again until the next
// Compare: the ear does the comparing (WEB-SPEC, Toys 4). Nothing is rated.
// Play together sounds both at once, for the beats (Go deeper).
//
// Mounted on a root, twice on the page: Step 3's one round on A3, and free
// play's rounds on A3, C4 and F3 (`[data-round]` buttons inside the root).

import { BAND_COLOR } from '@/features/lessons/kit/band-chart'
import { BAND_WORDS, gapWords, HIT_TOLERANCE_CENTS, inBand, } from '@/features/lessons/kit/band-words'
import { bindCentsSlider } from '@/features/lessons/kit/cents-slider'
import { clamp, mulberry32, q, qa, TAU, wait } from '@/features/lessons/kit/dom'
import { addDrawer, surface, watch } from '@/features/lessons/kit/frame-loop'
import { A3, COLOR, hz, rgba } from '@/features/lessons/kit/notes'
import type { Voice } from '@/features/lessons/kit/sound'
import { Sound } from '@/features/lessons/kit/sound'
import { holdToPlay } from '@/features/lessons/kit/toy-helpers'

/** The stage's reach either side of Merc's note, cents. */
const REACH = 300
/** Room above and below the track, px. */
const PAD = 26

/** Where a round's note starts: 80 to 200 cents above or below Merc's (FACTS 47). */
export function startOffset(random: () => number): number {
  const size = 80 + Math.round(random() * 120)
  return random() < 0.5 ? -size : size
}

/** The slider's words before Compare: where your note is against where it started. */
export function relativeText(cents: number, start: number): string {
  const d = Math.round(cents - start)
  if (d === 0) return 'Your note, where it started'
  return `Your note, ${d > 0 ? 'above' : 'below'} where it started`
}

/** The gap once Compare has played: "Your note sits 18 cents below Merc's note". */
export const gapLine = (cents: number): string =>
  `Your note sits ${gapWords(cents)}`

export interface MatchOptions {
  readonly active?: () => boolean
}

export interface Match {
  /** Stops any note this toy is sounding. */
  stop(): void
}

type Busy = 'merc' | 'compare' | 'together' | null

export function mountMatch(root: HTMLElement, opts: MatchOptions = {}): Match {
  const canvas = q<HTMLCanvasElement>('canvas', root)
  const cv = surface(canvas)
  const handle = q('[data-match-handle]', root)
  const gapEl = q('[data-match-gap]', root)
  const live = q('[data-match-live]', root)
  const buttons = qa<HTMLButtonElement>('[data-match]', root)
  const rounds = qa<HTMLButtonElement>('[data-round]', root)
  const random = mulberry32(Math.floor(Math.random() * 1e9))
  let target = A3
  let start = startOffset(random)
  let cents = start
  let shown = false
  let busy: Busy = null
  let held: Voice | null = null
  let voices: Voice[] = []

  const yOf = (c: number, h: number): number =>
    PAD + ((REACH - c) / (2 * REACH)) * (h - 2 * PAD)
  const yourHz = (): number => hz(target) * 2 ** (cents / 1200)

  const slider = bindCentsSlider(handle, {
    min: -REACH,
    max: REACH,
    value: () => cents,
    set(c) {
      cents = c
      held?.setFreq(yourHz(), 0.015)
      hide()
    },
    valueAt(clientY) {
      const r = canvas.getBoundingClientRect()
      const t = (clientY - r.top - PAD) / Math.max(1, r.height - 2 * PAD)
      return REACH - clamp(t, 0, 1) * 2 * REACH
    },
    valueText: (c) => (shown ? gapLine(c) : relativeText(c, start)),
  })

  function place(): void {
    const h = canvas.clientHeight
    if (h > 0) handle.style.top = `${yOf(cents, h)}px`
  }

  function hide(): void {
    if (!shown) return
    shown = false
    gapEl.textContent = 'Compare again to see the gap'
    slider.refresh()
  }

  function reveal(): void {
    shown = true
    const words = inBand(cents) ? BAND_WORDS.band : BAND_WORDS.outside
    const line = `${gapLine(cents)}: ${words}`
    gapEl.textContent = line
    live.textContent = line
    slider.refresh()
  }

  holdToPlay(handle, {
    start() {
      if (Sound.canPlay()) held = Sound.voice(yourHz())
    },
    stop() {
      held?.stop()
      held = null
    },
  })

  function stop(): void {
    held?.stop()
    held = null
    voices.forEach((v) => v.stop())
    voices = []
  }

  async function run(what: Exclude<Busy, null>): Promise<void> {
    const audible = Sound.canPlay()
    // the kit's soft tone, steady; kept so a step change can stop it
    const tone = async (
      f: number,
      dur: number,
      gain?: number,
    ): Promise<void> => {
      const v = audible ? Sound.voice(f, { dur, gain }) : null
      if (v) voices.push(v)
      await wait(dur)
      voices = voices.filter((x) => x !== v)
    }
    if (what === 'merc') await tone(hz(target), 1.5)
    if (what === 'together')
      await Promise.all([tone(hz(target), 3, 0.1), tone(yourHz(), 3, 0.1)])
    if (what === 'compare') {
      await tone(hz(target), 1)
      await wait(0.15)
      await tone(yourHz(), 1)
      reveal()
    }
  }

  for (const b of buttons) {
    b.addEventListener('click', () => {
      const what = b.dataset.match
      if (busy !== null) return
      if (what !== 'merc' && what !== 'compare' && what !== 'together') return
      busy = what
      buttons.forEach((x) => {
        x.disabled = true
        x.classList.toggle('is-on', x === b)
      })
      void run(what).then(() => {
        busy = null
        buttons.forEach((x) => {
          x.disabled = false
          x.classList.remove('is-on')
        })
      })
    })
  }

  // free play: Merc's note on A3, C4 or F3, and a fresh start each round
  for (const b of rounds) {
    b.addEventListener('click', () => {
      target = Number(b.dataset.round)
      rounds.forEach((x) => x.setAttribute('aria-pressed', String(x === b)))
      start = startOffset(random)
      cents = start
      shown = false
      gapEl.textContent = 'Drag your note, then press Compare'
      live.textContent = ''
      slider.refresh()
    })
  }

  function drawTrack(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
  ): number {
    const x = w / 2
    ctx.strokeStyle = 'rgba(195,204,214,.3)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(x, PAD - 8)
    ctx.lineTo(x, h - PAD + 8)
    ctx.stroke()
    // a faint tick per semitone, unnamed: the ear compares, not the eye
    for (let c = -REACH; c <= REACH; c += 100) {
      const y = yOf(c, h)
      ctx.beginPath()
      ctx.moveTo(x - 6, y)
      ctx.lineTo(x + 6, y)
      ctx.stroke()
    }
    ctx.font = '500 12px "JetBrains Mono", monospace'
    ctx.fillStyle = COLOR.ink3
    ctx.textAlign = 'center'
    ctx.textBaseline = 'bottom'
    ctx.fillText('HIGHER', x, PAD - 10)
    ctx.textBaseline = 'top'
    ctx.fillText('LOWER', x, h - PAD + 10)
    return x
  }

  // Merc's note, his band and the gap: only once Compare has played
  function drawGap(
    ctx: CanvasRenderingContext2D,
    x: number,
    h: number,
    yYou: number,
  ): void {
    const y0 = yOf(0, h)
    const top = yOf(HIT_TOLERANCE_CENTS, h)
    const bot = yOf(-HIT_TOLERANCE_CENTS, h)
    const half = Math.min(120, x - 20)
    ctx.fillStyle = rgba(BAND_COLOR.target, 0.13)
    ctx.fillRect(x - half, top, 2 * half, bot - top)
    const lit = inBand(cents)
    ctx.strokeStyle = lit ? BAND_COLOR.mint : rgba(BAND_COLOR.target, 0.6)
    ctx.lineWidth = lit ? 2 : 1
    for (const yy of [top, bot]) {
      ctx.beginPath()
      ctx.moveTo(x - half, yy)
      ctx.lineTo(x + half, yy)
      ctx.stroke()
    }
    ctx.strokeStyle = BAND_COLOR.target
    ctx.lineWidth = 2.4
    ctx.beginPath()
    ctx.moveTo(x - half, y0)
    ctx.lineTo(x + half, y0)
    ctx.stroke()
    ctx.font = '500 12px "JetBrains Mono", monospace'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'bottom'
    ctx.fillStyle = lit ? BAND_COLOR.mint : COLOR.ink2
    ctx.fillText(lit ? 'IN THE BAND' : 'OUTSIDE THE BAND', x - half, top - 4)
    ctx.textAlign = 'right'
    ctx.fillStyle = BAND_COLOR.target
    ctx.fillText("MERC'S NOTE", x + half, y0 - 4)
    // the gap, bracketed beside the track
    const bx = x + 26
    ctx.strokeStyle = rgba(COLOR.chrome, 0.6)
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(bx - 4, y0)
    ctx.lineTo(bx, y0)
    ctx.lineTo(bx, yYou)
    ctx.lineTo(bx - 4, yYou)
    ctx.stroke()
  }

  function drawYou(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    t: number,
  ): void {
    const glow = held === null ? 0 : 0.5 + 0.5 * Math.sin((TAU * t) / 600)
    ctx.fillStyle = rgba(BAND_COLOR.singer, 0.18 + 0.12 * glow)
    ctx.beginPath()
    ctx.arc(x, y, 18, 0, TAU)
    ctx.fill()
    ctx.fillStyle = BAND_COLOR.singer
    ctx.beginPath()
    ctx.arc(x, y, 8, 0, TAU)
    ctx.fill()
    ctx.font = '500 12px "JetBrains Mono", monospace'
    ctx.textAlign = 'right'
    ctx.textBaseline = 'middle'
    ctx.fillText('YOUR NOTE', x - 26, y)
  }

  addDrawer({
    active: opts.active ?? watch(root),
    draw(now) {
      const { ctx, w, h } = cv.fit()
      const x = drawTrack(ctx, w, h)
      const y = yOf(cents, h)
      if (shown) drawGap(ctx, x, h, y)
      drawYou(ctx, x, y, now)
      place()
    },
  })

  return { stop }
}
