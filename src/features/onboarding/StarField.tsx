// ============================================================
// First Light — the sky
// ============================================================
//
// A canvas field of dim stars over the obsidian ground, with a
// spectrum pitch contour that ignites left to right. This is the
// recurring backdrop for every beat; Phase 2 drives the ignition
// from live pitch instead of the scripted sweep.
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
   * 0–1. How far the ignition has travelled. Beats drive this to
   * animate their own moment; the default sweeps once on mount.
   */
  ignition?: number
  /** Dim the whole field — used behind text-heavy beats like the Map. */
  recede?: boolean
}

const STAR_COUNT = 150
const LIT_COUNT = 13
const SWEEP_MS = 3400

interface Star {
  x: number
  y: number
  r: number
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
  let started = 0
  const stars = seedStars()

  onMount(() => {
    const el = canvas
    if (el === undefined) return
    const ctx = el.getContext('2d')
    if (ctx === null) return

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)')
    let width = 0
    let height = 0

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

    const resize = () => {
      const rect = el.getBoundingClientRect()
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      width = rect.width
      height = rect.height
      el.width = Math.max(1, Math.round(width * dpr))
      el.height = Math.max(1, Math.round(height * dpr))
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    const draw = (progress: number) => {
      if (width === 0 || height === 0) return
      ctx.clearRect(0, 0, width, height)
      const fade = props.recede === true ? 0.45 : 1

      ctx.fillStyle = colors.dim
      ctx.globalAlpha = fade
      for (const star of stars) {
        ctx.beginPath()
        ctx.arc(star.x * width, star.y * height, star.r, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.globalAlpha = 1

      const eased = 1 - Math.pow(1 - Math.min(1, Math.max(0, progress)), 3)
      if (eased <= 0) return

      // The contour, drawn only as far as the sweep has reached.
      const gradient = ctx.createLinearGradient(
        0.06 * width,
        0,
        0.94 * width,
        0,
      )
      gradient.addColorStop(0, colors.blue)
      gradient.addColorStop(0.52, colors.teal)
      gradient.addColorStop(1, colors.violet)
      ctx.strokeStyle = gradient
      ctx.lineWidth = 1.5
      ctx.lineCap = 'round'
      ctx.globalAlpha = 0.32 * fade
      ctx.beginPath()
      for (let p = 0; p <= eased; p += 0.004) {
        const x = 0.06 + p * 0.88
        const px = x * width
        const py = contour(x) * height
        if (p === 0) ctx.moveTo(px, py)
        else ctx.lineTo(px, py)
      }
      ctx.stroke()
      ctx.globalAlpha = 1

      // Stars ignite as the sweep passes them.
      for (let i = 0; i < LIT_COUNT; i++) {
        const x = 0.06 + (i / (LIT_COUNT - 1)) * 0.88
        const at = (x - 0.06) / 0.88
        if (eased < at) continue
        const age = Math.min(1, (eased - at) * 5)
        const cx = x * width
        const cy = contour(x) * height
        const radius = 2 + age * 1.4
        ctx.fillStyle =
          at < 0.5 ? colors.blue : at < 0.8 ? colors.teal : colors.violet

        ctx.globalAlpha = 0.16 * age * fade
        ctx.beginPath()
        ctx.arc(cx, cy, radius * 6, 0, Math.PI * 2)
        ctx.fill()

        ctx.globalAlpha = 0.9 * age * fade
        ctx.beginPath()
        ctx.arc(cx, cy, radius, 0, Math.PI * 2)
        ctx.fill()
        ctx.globalAlpha = 1
      }
    }

    const tick = (now: number) => {
      if (started === 0) started = now
      draw((now - started) / SWEEP_MS)
      if (now - started < SWEEP_MS) frame = requestAnimationFrame(tick)
    }

    const start = () => {
      resize()
      started = 0
      cancelAnimationFrame(frame)
      if (reduce.matches) draw(1)
      else frame = requestAnimationFrame(tick)
    }

    // A driven ignition (Phase 2) overrides the scripted sweep.
    createEffect(() => {
      const driven = props.ignition
      if (driven === undefined) return
      cancelAnimationFrame(frame)
      draw(driven)
    })

    // Redraw when the beat asks the field to recede.
    createEffect(() => {
      void props.recede
      if (props.ignition === undefined && started === 0) return
      draw(props.ignition ?? 1)
    })

    const observer = new ResizeObserver(() => {
      resize()
      draw(props.ignition ?? 1)
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
