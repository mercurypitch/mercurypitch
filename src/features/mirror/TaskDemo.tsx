// ============================================================
// Voice Mirror — looping task demo animations (onboarding).
//
// Draws a synthetic, seeded "perfect take" of each task so first-time
// visitors see what to do before the mic ever turns on:
//   glide-up/down — a comet rides a gold guide path up (or down)
//   hold          — the note sits on the line, the ring tightens
//   match         — a note pulses (listen), then the voice scoops
//                   onto it and locks green (sing it back)
//
// Purely visual — frames come from the deterministic timelines in
// src/lib/mirror/demo-timeline.ts, never from the microphone. When
// `active` is false (dimmed overview cards) or the visitor prefers
// reduced motion, a single static frame of the full path is drawn
// and no animation loop runs.
// ============================================================

import type { Component } from 'solid-js'
import { createEffect, createSignal, onCleanup, onMount, Show } from 'solid-js'
import type { DemoKind, DemoTimeline } from '@/lib/mirror/demo-timeline'
import { buildDemoTimeline, demoStateAt } from '@/lib/mirror/demo-timeline'
import { CONF_MIN, foldCents, hzToCents } from '@/lib/mirror/metrics'

interface TaskDemoProps {
  kind: DemoKind
  /** card ≈ overview tile, stage = LiveViz-sized (default). */
  size?: 'card' | 'stage'
  /** Accessible description — the canvas is role="img". */
  label: string
  /** When false, freeze on a static full-path frame (no rAF). */
  active?: () => boolean
  /** Fires each time the loop wraps (drives the overview spotlight). */
  onLoopEnd?: () => void
}

const SIZES = { card: { w: 320, h: 132 }, stage: { w: 640, h: 240 } }
const PAD_X = 20
const PAD_Y = 18
/** Same lock tolerance the live match viz uses (LiveViz drawMatch). */
const LOCK_CENTS = 35

interface Star {
  x: number
  y: number
  r: number
  phase: number
}

/** A few seeded background twinkles — enough space-dust to feel at home. */
function starsFor(kind: DemoKind, w: number, h: number): Star[] {
  const tl = buildDemoTimeline(kind)
  let s = (tl.voice.length * 2654435761) >>> 0
  const rand = () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 2 ** 32
  }
  return Array.from({ length: 6 }, () => ({
    x: PAD_X / 2 + rand() * (w - PAD_X),
    y: PAD_Y / 2 + rand() * (h - PAD_Y),
    r: 0.8 + rand() * 1,
    phase: rand() * Math.PI * 2,
  }))
}

/** Loop time (s) at which the match take first locks onto the target. */
function lockTimeFor(tl: DemoTimeline): number {
  const target = hzToCents(tl.guide[0].f0)
  for (const f of tl.voice) {
    if (
      f.conf >= CONF_MIN &&
      Math.abs(foldCents(hzToCents(f.f0) - target)) <= LOCK_CENTS
    ) {
      return f.t
    }
  }
  return Infinity
}

const easeOutCubic = (p: number) => 1 - (1 - p) ** 3

export const TaskDemo: Component<TaskDemoProps> = (props) => {
  /* eslint-disable solid/reactivity -- kind and size are static per
     instance: every call site passes a literal, and a different task's
     demo is a remount (keyed <Show> branches), never a prop morph. */
  const kind = props.kind
  const dims = SIZES[props.size ?? 'stage']
  const isCard = (props.size ?? 'stage') === 'card'
  /* eslint-enable solid/reactivity */
  const isActive = () => props.active?.() ?? true
  const tl = buildDemoTimeline(kind)
  const stars = starsFor(kind, dims.w, dims.h)
  const lockT = kind === 'match' ? lockTimeFor(tl) : Infinity
  const targetCents = hzToCents(tl.guide[0].f0)
  const sing = tl.segments.find((s) => s.kind === 'sing') ?? tl.segments[0]
  // Glides/hold map the sing window across the width; match maps the whole
  // loop so the listen beat visibly precedes the sung scoop.
  const winStart = kind === 'match' ? 0 : sing.start
  const winEnd = kind === 'match' ? tl.durationSec : sing.end

  const [caption, setCaption] = createSignal<
    'listen' | 'ready' | 'sing' | 'rest'
  >('listen')

  let canvas: HTMLCanvasElement | undefined
  let rafId = 0
  let running = false
  let epoch = 0
  let lastLoopT = 0
  let visible = true
  let onScreen = true
  const reducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches

  const xFor = (t: number): number =>
    PAD_X + ((t - winStart) / (winEnd - winStart)) * (dims.w - 2 * PAD_X)
  const yFor = (cents: number): number =>
    dims.h -
    PAD_Y -
    ((cents - tl.centsMin) / (tl.centsMax - tl.centsMin)) * (dims.h - 2 * PAD_Y)

  function drawStars(
    ctx: CanvasRenderingContext2D,
    t: number,
    still: boolean,
  ): void {
    for (const star of stars) {
      const alpha = still
        ? 0.28
        : 0.18 + 0.22 * (0.5 + 0.5 * Math.sin(t * 1.7 + star.phase))
      ctx.fillStyle = `rgba(244, 240, 255, ${alpha.toFixed(3)})`
      ctx.beginPath()
      ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  function drawGuide(ctx: CanvasRenderingContext2D, alpha: number): void {
    ctx.strokeStyle = `rgba(255, 233, 168, ${(0.55 * alpha).toFixed(3)})`
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.setLineDash([6, 7])
    ctx.beginPath()
    for (let i = 0; i < tl.guide.length; i++) {
      const f = tl.guide[i]
      const x = xFor(f.t)
      const y = yFor(hzToCents(f.f0))
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.stroke()
    ctx.setLineDash([])
  }

  /** Direction chevron near the start of a glide path. */
  function drawChevron(ctx: CanvasRenderingContext2D): void {
    if (kind !== 'glide-up' && kind !== 'glide-down') return
    const up = kind === 'glide-up'
    const x = xFor(winStart) + 10
    const y = yFor(hzToCents(tl.guide[0].f0)) + (up ? -18 : 18)
    ctx.strokeStyle = 'rgba(255, 233, 168, 0.75)'
    ctx.lineWidth = 2.4
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    for (const dy of [0, 8]) {
      ctx.beginPath()
      ctx.moveTo(x - 6, y + dy + (up ? 4 : -4))
      ctx.lineTo(x, y + dy + (up ? -2 : 2))
      ctx.lineTo(x + 6, y + dy + (up ? 4 : -4))
      ctx.stroke()
    }
  }

  function drawTrail(
    ctx: CanvasRenderingContext2D,
    count: number,
    fade: number,
  ): void {
    const dotR = isCard ? 1.9 : 2.4
    for (let i = 0; i < count; i++) {
      const f = tl.voice[i]
      if (f.conf < CONF_MIN) continue
      // Newest dots glow brightest; the tail settles to a faint memory.
      const recency = count <= 1 ? 1 : i / (count - 1)
      const alpha = (0.15 + 0.65 * recency) * fade
      ctx.fillStyle = `rgba(143, 163, 255, ${alpha.toFixed(3)})`
      ctx.beginPath()
      ctx.arc(xFor(f.t), yFor(hzToCents(f.f0)), dotR, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  function drawHead(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    locked: boolean,
    fade: number,
  ): void {
    const glow = locked ? '139, 233, 184' : '143, 163, 255'
    const glowR = isCard ? 11 : 14
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, glowR)
    gradient.addColorStop(0, `rgba(${glow}, ${(0.85 * fade).toFixed(3)})`)
    gradient.addColorStop(1, `rgba(${glow}, 0)`)
    ctx.fillStyle = gradient
    ctx.beginPath()
    ctx.arc(x, y, glowR, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = locked
      ? `rgba(217, 255, 233, ${fade.toFixed(3)})`
      : `rgba(205, 214, 255, ${fade.toFixed(3)})`
    ctx.beginPath()
    ctx.arc(x, y, isCard ? 2.8 : 3.4, 0, Math.PI * 2)
    ctx.fill()
  }

  /** The tightening steadiness ring around the held note. */
  function drawHoldRing(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    singProgress: number,
    fade: number,
  ): void {
    const scale = isCard ? 0.62 : 1
    const spread = (50 - 36 * easeOutCubic(singProgress)) * scale
    ctx.strokeStyle = `rgba(168, 182, 255, ${(0.85 * fade).toFixed(3)})`
    ctx.lineWidth = 2.4
    ctx.beginPath()
    ctx.arc(x, y, 12 * scale + spread, 0, Math.PI * 2)
    ctx.stroke()
  }

  /** Listen beat: the reference note pulses expanding rings on the line. */
  function drawListenPulse(
    ctx: CanvasRenderingContext2D,
    t: number,
    segStart: number,
    segEnd: number,
  ): void {
    const x = xFor(segStart + (segEnd - segStart) / 2)
    const y = yFor(targetCents)
    const noteR = isCard ? 4 : 5
    const maxR = isCard ? 22 : 30
    for (const offset of [0, 0.5]) {
      const p = ((t - segStart) / 1.0 + offset) % 1
      const alpha = 0.5 * (1 - p)
      ctx.strokeStyle = `rgba(255, 233, 168, ${alpha.toFixed(3)})`
      ctx.lineWidth = 1.6
      ctx.beginPath()
      ctx.arc(x, y, noteR + p * maxR, 0, Math.PI * 2)
      ctx.stroke()
    }
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, noteR * 2.6)
    gradient.addColorStop(0, 'rgba(255, 233, 168, 0.9)')
    gradient.addColorStop(1, 'rgba(255, 233, 168, 0)')
    ctx.fillStyle = gradient
    ctx.beginPath()
    ctx.arc(x, y, noteR * 2.6, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#ffe9a8'
    ctx.beginPath()
    ctx.arc(x, y, noteR, 0, Math.PI * 2)
    ctx.fill()
  }

  /** A tiny 4-spark burst the moment the sung note locks on. */
  function drawLockSparks(
    ctx: CanvasRenderingContext2D,
    t: number,
    x: number,
    y: number,
  ): void {
    const since = t - lockT
    if (since < 0 || since > 0.55) return
    const p = since / 0.55
    const dist = 6 + 20 * easeOutCubic(p)
    const alpha = 0.9 * (1 - p)
    ctx.fillStyle = `rgba(139, 233, 184, ${alpha.toFixed(3)})`
    for (let i = 0; i < 4; i++) {
      const angle = (Math.PI / 4) * (1 + 2 * i)
      ctx.beginPath()
      ctx.arc(
        x + Math.cos(angle) * dist,
        y + Math.sin(angle) * dist,
        1.8 * (1 - p * 0.5),
        0,
        Math.PI * 2,
      )
      ctx.fill()
    }
  }

  function render(loopT: number, still: boolean): void {
    const ctx = canvas?.getContext('2d')
    if (!ctx) return
    const { w, h } = dims
    ctx.clearRect(0, 0, w, h)
    const state = demoStateAt(tl, loopT)
    const seg = state.segment
    // Everything sung fades out together during the rest beat.
    const fade =
      seg.kind === 'rest' && !still
        ? 1 - (state.t - seg.start) / (seg.end - seg.start)
        : 1

    drawStars(ctx, loopT, still)

    let guideAlpha = 1
    if (kind === 'match' && seg.kind === 'ready' && !still) {
      // Two count-in pulses on the target line before the sing beat.
      const p = (state.t - seg.start) / (seg.end - seg.start)
      guideAlpha = 0.55 + 0.45 * Math.abs(Math.sin(Math.PI * 2 * p))
    }
    drawGuide(ctx, guideAlpha)
    drawChevron(ctx)

    if (kind === 'match' && seg.kind === 'listen' && !still) {
      const listen = tl.segments[0]
      drawListenPulse(ctx, state.t, listen.start, listen.end)
    }

    const count = still ? tl.voice.length : state.voiceIndex
    const trailFade = still ? 0.55 : fade
    drawTrail(ctx, count, trailFade)

    const head = still ? tl.voice[tl.voice.length - 1] : state.headFrame
    if (head && head.conf >= CONF_MIN) {
      const cents = hzToCents(head.f0)
      const x = xFor(head.t)
      const y = yFor(cents)
      const locked =
        (kind === 'match' || kind === 'hold') &&
        Math.abs(foldCents(cents - targetCents)) <= LOCK_CENTS
      if (kind === 'hold') {
        const p = still
          ? 1
          : Math.min(1, (state.t - sing.start) / (sing.end - sing.start))
        drawHoldRing(ctx, x, y, p, fade)
      }
      drawHead(ctx, x, y, locked, still ? 0.9 : fade)
      if (kind === 'match' && !still) drawLockSparks(ctx, state.t, x, y)
    }

    if (kind === 'match' && !still && seg.kind !== caption()) {
      setCaption(seg.kind)
    }
  }

  function tick(now: number): void {
    rafId = requestAnimationFrame(tick)
    // Anchor the loop clock to the first frame's own timestamp — rAF
    // timestamps are vsync times and can precede a performance.now() taken
    // at schedule time, which would read as an instant (spurious) wrap.
    if (epoch < 0) epoch = now
    const loopT = (now - epoch) / 1000
    const wrapped = loopT % tl.durationSec
    if (wrapped < lastLoopT) props.onLoopEnd?.()
    lastLoopT = wrapped
    render(wrapped, false)
  }

  function stopLoop(): void {
    if (!running) return
    running = false
    cancelAnimationFrame(rafId)
  }

  function startLoop(): void {
    if (running || reducedMotion || !isActive() || !visible || !onScreen) return
    running = true
    lastLoopT = 0
    epoch = -1 // set by the first tick
    rafId = requestAnimationFrame(tick)
  }

  /** The frozen "poster" frame: full path, full trail, head at the end. */
  function renderStatic(): void {
    render(sing.end - 0.001, true)
  }

  function syncLoop(): void {
    if (reducedMotion || !isActive() || !visible || !onScreen) {
      stopLoop()
      renderStatic()
    } else {
      startLoop()
    }
  }

  onMount(() => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    if (canvas) {
      const { w, h } = dims
      canvas.width = w * dpr
      canvas.height = h * dpr
      canvas.getContext('2d')?.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    const onVisibility = (): void => {
      visible = document.visibilityState === 'visible'
      syncLoop()
    }
    document.addEventListener('visibilitychange', onVisibility)

    let observer: IntersectionObserver | undefined
    if (canvas && typeof IntersectionObserver !== 'undefined') {
      observer = new IntersectionObserver((entries) => {
        onScreen = entries[0]?.isIntersecting ?? true
        syncLoop()
      })
      observer.observe(canvas)
    }

    syncLoop()

    onCleanup(() => {
      document.removeEventListener('visibilitychange', onVisibility)
      observer?.disconnect()
      stopLoop()
    })
  })

  // Dimmed ↔ spotlighted transitions (the overview cycle).
  createEffect(() => {
    void isActive()
    if (canvas) syncLoop()
  })

  return (
    <div class="mirror-demo">
      <canvas
        ref={canvas}
        role="img"
        aria-label={props.label}
        style={{ 'max-width': `${dims.w}px` }}
      />
      <Show when={kind === 'match'}>
        <div class="mirror-demo-caption" aria-hidden="true">
          {caption() === 'listen'
            ? 'Listen…'
            : caption() === 'ready'
              ? 'Get ready…'
              : caption() === 'sing'
                ? 'Now sing it back'
                : ' '}
        </div>
      </Show>
    </div>
  )
}
