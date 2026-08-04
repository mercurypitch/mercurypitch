// ============================================================
// First Light — the sky
// ============================================================
//
// A canvas field of dim stars over the obsidian ground, with a
// spectrum pitch contour that ignites left to right. This is the
// recurring backdrop for every beat.
//
// The contour is not decoration: its beads are the beats this visitor
// will actually walk. One bead per beat, lit behind them, accented on
// the one they are standing on, hollow ahead — the same information
// the progress hairline carries, drawn as the journey rather than as a
// percentage. It was previously a scripted sweep that ran once on
// mount and then sat still through the entire flow, which is what made
// the arc read as wallpaper.
//
// Two values drive it, and keeping them separate is what stops the
// animation ever running backwards:
//
//   • `sweep` — how much of the faint path has been revealed. Runs
//     0 to 1 once, on mount. This is the flourish.
//   • `lit` — how much of it is bright, i.e. how far the visitor has
//     come. Only ever grows, one bead at a time.
//
// Canvas rather than SVG because the field is a few hundred
// particles redrawn per frame — hand-authored path data would be
// both larger and slower (BRAND.md §5, generative artwork).
//
// Reduced motion renders the settled end state immediately: the
// composition is the point, the sweep is the flourish.

import type { Component } from 'solid-js'
import { createEffect, onCleanup, onMount } from 'solid-js'
import styles from './onboarding.module.css'

export interface StarFieldProps {
  /**
   * How many beads the arc carries — one per beat this visitor walks.
   * Omitted, the field keeps its purely decorative 13.
   */
  beads?: number
  /**
   * Which bead the visitor is standing on, 0-based. Omitted (or
   * negative), every revealed bead is lit and none is accented.
   */
  beadIndex?: number
  /** Dim the whole field — used behind text-heavy beats like the Map. */
  recede?: boolean
}

const STAR_COUNT = 150
const LIT_COUNT = 13

/** The one-off reveal of the faint path, left to right. */
const SWEEP_MS = 3400

/** One bead to the next. Long enough to see, short enough not to wait. */
const STEP_MS = 900

/** The current bead's breath. Slow — this is a backdrop, not a spinner. */
const PULSE_MS = 2600

/** Where the arc starts and how wide it runs, as fractions of the canvas. */
const ARC_X0 = 0.06
const ARC_W = 0.88

interface Star {
  x: number
  y: number
  r: number
}

/** A value easing toward a target, driven by the one animation loop. */
interface Tween {
  value: number
  from: number
  to: number
  t0: number
  dur: number
}

function tweenTo(tween: Tween, to: number, dur: number): void {
  tween.from = tween.value
  tween.to = to
  tween.dur = dur
  tween.t0 = 0
}

/** Advances a tween; returns true while it still has somewhere to go. */
function tweenStep(tween: Tween, now: number): boolean {
  if (tween.dur <= 0 || tween.to === tween.from) {
    tween.value = tween.to
    return false
  }
  if (tween.t0 === 0) tween.t0 = now
  const p = Math.min(1, (now - tween.t0) / tween.dur)
  const eased = 1 - Math.pow(1 - p, 3)
  tween.value = tween.from + (tween.to - tween.from) * eased
  return p < 1
}

/** The glide contour the ignited stars sit on: rises, dips, resolves. */
function contour(x: number): number {
  return 0.52 - Math.sin(x * 3.1 - 0.6) * 0.2 - Math.sin(x * 1.35 + 1.9) * 0.12
}

/**
 * Deterministic scatter — a golden-ratio walk rather than Math.random
 * so the field is identical across resizes, remounts and both themes.
 * A field that reshuffles on every resize reads as a bug.
 */
function seedStars(): Star[] {
  const stars: Star[] = []
  for (let i = 0; i < STAR_COUNT; i++) {
    stars.push({
      x: ((i * 61.803) % 100) / 100,
      y: ((i * 37.404) % 100) / 100,
      r: 0.5 + ((i * 13) % 7) / 7,
    })
  }
  return stars
}

export const StarField: Component<StarFieldProps> = (props) => {
  let canvas: HTMLCanvasElement | undefined
  let frame = 0
  const stars = seedStars()

  const beadCount = (): number => Math.max(2, props.beads ?? LIT_COUNT)
  const beadAt = (index: number, count: number): number => (index + 0.5) / count

  /**
   * How much of the arc is lit for the current beat. Beads sit at the
   * midpoint of their slice, so reaching the END of a slice always
   * clears its bead with a little room to spare — a target of exactly
   * the bead's own position leaves it half-lit on every step.
   */
  const litTarget = (): number => {
    const index = props.beadIndex ?? -1
    if (index < 0) return 1
    return Math.min(1, (index + 1) / beadCount())
  }

  onMount(() => {
    const el = canvas
    if (el === undefined) return
    const ctx = el.getContext('2d')
    if (ctx === null) return

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)')
    let width = 0
    let height = 0
    let running = false

    const sweep: Tween = { value: 0, from: 0, to: 0, t0: 0, dur: 0 }
    const lit: Tween = { value: 0, from: 0, to: 0, t0: 0, dur: 0 }

    // The overlay owns these (onboarding.module.css) rather than the app
    // theme — the flow commits to the obsidian sky in every theme.
    const tokens = () => {
      const cs = window.getComputedStyle(el)
      return {
        dim:
          cs.getPropertyValue('--star-dim').trim() || 'rgba(230,237,243,.18)',
        blue: cs.getPropertyValue('--ob-blue').trim() || '#58a6ff',
        teal: cs.getPropertyValue('--ob-teal').trim() || '#2dd4bf',
        violet: cs.getPropertyValue('--ob-violet').trim() || '#bc8cff',
      }
    }
    const colors = tokens()

    const beadColor = (at: number): string =>
      at < 0.5 ? colors.blue : at < 0.8 ? colors.teal : colors.violet

    // The 150 stars never move. The arc now animates continuously (the
    // current bead breathes), so redrawing them every frame would be
    // 150 arcs a frame for the whole flow, next to live pitch analysis.
    // Paint them once and blit.
    let starLayer: HTMLCanvasElement | null = null
    let starKey = ''

    const stampStars = (dpr: number) => {
      const key = `${width}x${height}@${dpr}`
      if (starLayer !== null && starKey === key) return
      const layer = document.createElement('canvas')
      layer.width = Math.max(1, Math.round(width * dpr))
      layer.height = Math.max(1, Math.round(height * dpr))
      const lctx = layer.getContext('2d')
      if (lctx === null) return
      lctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      lctx.fillStyle = colors.dim
      for (const star of stars) {
        lctx.beginPath()
        lctx.arc(star.x * width, star.y * height, star.r, 0, Math.PI * 2)
        lctx.fill()
      }
      starLayer = layer
      starKey = key
    }

    const resize = () => {
      const rect = el.getBoundingClientRect()
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      width = rect.width
      height = rect.height
      el.width = Math.max(1, Math.round(width * dpr))
      el.height = Math.max(1, Math.round(height * dpr))
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      stampStars(dpr)
    }

    const strokeArc = (to: number, alpha: number, lineWidth: number) => {
      if (to <= 0) return
      const gradient = ctx.createLinearGradient(
        ARC_X0 * width,
        0,
        (ARC_X0 + ARC_W) * width,
        0,
      )
      gradient.addColorStop(0, colors.blue)
      gradient.addColorStop(0.52, colors.teal)
      gradient.addColorStop(1, colors.violet)
      ctx.strokeStyle = gradient
      ctx.lineWidth = lineWidth
      ctx.lineCap = 'round'
      ctx.globalAlpha = alpha
      ctx.beginPath()
      for (let p = 0; p <= to; p += 0.004) {
        const x = ARC_X0 + p * ARC_W
        const px = x * width
        const py = contour(x) * height
        if (p === 0) ctx.moveTo(px, py)
        else ctx.lineTo(px, py)
      }
      ctx.stroke()
      ctx.globalAlpha = 1
    }

    const draw = (now: number) => {
      if (width === 0 || height === 0) return
      ctx.clearRect(0, 0, width, height)
      const fade = props.recede === true ? 0.45 : 1

      if (starLayer !== null) {
        ctx.globalAlpha = fade
        ctx.drawImage(starLayer, 0, 0, width, height)
        ctx.globalAlpha = 1
      }

      const revealed = Math.min(1, Math.max(0, sweep.value))
      const bright = Math.min(revealed, Math.max(0, lit.value))

      // The road ahead, then the part already walked on top of it.
      strokeArc(revealed, 0.13 * fade, 1.2)
      strokeArc(bright, 0.46 * fade, 1.8)

      const count = beadCount()
      const current = props.beadIndex ?? -1
      const breath = reduce.matches
        ? 1
        : 0.5 + 0.5 * Math.sin((now / PULSE_MS) * Math.PI * 2)

      for (let i = 0; i < count; i++) {
        const at = beadAt(i, count)
        if (revealed < at) continue
        const cx = (ARC_X0 + at * ARC_W) * width
        const cy = contour(ARC_X0 + at * ARC_W) * height
        const color = beadColor(at)
        const isCurrent = i === current
        const isLit = bright >= at

        // Ahead of the visitor: a hollow marker, so the shape of the
        // journey is visible before it is walked.
        if (!isLit && !isCurrent) {
          ctx.strokeStyle = colors.dim
          ctx.lineWidth = 1.2
          ctx.globalAlpha = 0.7 * fade
          ctx.beginPath()
          ctx.arc(cx, cy, 3.4, 0, Math.PI * 2)
          ctx.stroke()
          ctx.globalAlpha = 1
          continue
        }

        const age = Math.min(1, (bright - at) * 5 + (isCurrent ? 1 : 0))
        const radius = isCurrent ? 5.6 : 3.6

        // The accent: a slow ring around the bead the visitor is on.
        if (isCurrent) {
          ctx.strokeStyle = color
          ctx.lineWidth = 1.4
          ctx.globalAlpha = (0.42 - 0.24 * breath) * fade
          ctx.beginPath()
          ctx.arc(cx, cy, radius + 4 + breath * 5, 0, Math.PI * 2)
          ctx.stroke()
        }

        ctx.fillStyle = color
        ctx.globalAlpha = (isCurrent ? 0.22 : 0.14) * age * fade
        ctx.beginPath()
        ctx.arc(cx, cy, radius * 6, 0, Math.PI * 2)
        ctx.fill()

        ctx.globalAlpha = (isCurrent ? 1 : 0.78) * age * fade
        ctx.beginPath()
        ctx.arc(cx, cy, radius, 0, Math.PI * 2)
        ctx.fill()
        ctx.globalAlpha = 1
      }
    }

    /** True while anything on screen still has to change. */
    const restless = (): boolean => {
      if (reduce.matches) return false
      const index = props.beadIndex ?? -1
      return index >= 0
    }

    const loop = (now: number) => {
      const a = tweenStep(sweep, now)
      const b = tweenStep(lit, now)
      draw(now)
      if (a || b || restless()) {
        frame = requestAnimationFrame(loop)
        return
      }
      running = false
    }

    const kick = () => {
      if (running) return
      running = true
      frame = requestAnimationFrame(loop)
    }

    const start = () => {
      resize()
      cancelAnimationFrame(frame)
      running = false
      if (reduce.matches) {
        sweep.value = 1
        sweep.to = 1
        lit.value = litTarget()
        lit.to = lit.value
        draw(0)
        return
      }
      sweep.value = 0
      lit.value = 0
      tweenTo(sweep, 1, SWEEP_MS)
      // Beat one lights while the path is still drawing itself in. Its
      // share of the sweep is its share of the arc — anything faster
      // outruns the reveal and lights a bead over empty canvas.
      tweenTo(lit, litTarget(), Math.max(STEP_MS, SWEEP_MS * litTarget()))
      kick()
    }

    // Every later beat: extend the bright arc to the new bead.
    createEffect(() => {
      const target = litTarget()
      if (reduce.matches) {
        lit.value = target
        lit.to = target
        draw(0)
        return
      }
      if (target === lit.to) return
      tweenTo(lit, target, STEP_MS)
      kick()
    })

    // Redraw when the beat asks the field to recede.
    createEffect(() => {
      void props.recede
      if (reduce.matches) draw(0)
      else kick()
    })

    const observer = new ResizeObserver(() => {
      resize()
      if (reduce.matches) draw(0)
      else kick()
    })
    observer.observe(el)

    reduce.addEventListener('change', start)

    start()

    onCleanup(() => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      reduce.removeEventListener('change', start)
    })
  })

  return <canvas ref={canvas} class={styles.sky} aria-hidden="true" />
}

export default StarField
