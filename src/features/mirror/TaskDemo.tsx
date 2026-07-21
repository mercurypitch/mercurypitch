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
import { getDevicePixelRatio } from '@/lib/dom-utils'
import { seeded } from '@/lib/mirror/demo-frames'
import type { DemoKind, DemoTimeline } from '@/lib/mirror/demo-timeline'
import { buildDemoTimeline, demoStateAt } from '@/lib/mirror/demo-timeline'
import { CONF_MIN, foldCents, HIT_TOLERANCE_CENTS, hzToCents, } from '@/lib/mirror/metrics'
import { createDemoCue, planDemoCue } from './demo-cue'

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
  /**
   * Optional AudioContext for the guide cue (siren/hold). Returns the context,
   * or null to stay silent. The cue plays once each time the demo becomes
   * active + visible + on-screen (see planDemoCue). Glass's decision 18:
   * users should HEAR what to do, not just watch it.
   */
  getAudioContext?: () => AudioContext | null
}

const SIZES = { card: { w: 320, h: 132 }, stage: { w: 640, h: 240 } }
const PAD_X = 20
const PAD_Y = 18

const CAPTIONS: Record<'listen' | 'ready' | 'sing' | 'rest', string> = {
  listen: 'Listen…',
  ready: 'Get ready…',
  sing: 'Now sing it back',
  rest: ' ',
}

/** Pre-rendered radial glow — building a gradient (two color-stop parses)
 *  per frame is among the pricier canvas allocations on the rAF path. */
function glowSprite(
  rgb: string,
  radius: number,
  centerAlpha = 0.85,
): HTMLCanvasElement {
  const sprite = document.createElement('canvas')
  sprite.width = sprite.height = Math.ceil(radius * 2)
  const ctx = sprite.getContext('2d')
  if (ctx) {
    const g = ctx.createRadialGradient(
      radius,
      radius,
      0,
      radius,
      radius,
      radius,
    )
    g.addColorStop(0, `rgba(${rgb}, ${centerAlpha})`)
    g.addColorStop(1, `rgba(${rgb}, 0)`)
    ctx.fillStyle = g
    ctx.fillRect(0, 0, sprite.width, sprite.height)
  }
  return sprite
}

interface Star {
  x: number
  y: number
  r: number
  phase: number
}

/** A few seeded background twinkles — enough space-dust to feel at home. */
function starsFor(kind: DemoKind, w: number, h: number): Star[] {
  const tl = buildDemoTimeline(kind)
  const rand = seeded(tl.voice.length * 2654435761)
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
      Math.abs(foldCents(hzToCents(f.f0) - target)) <= HIT_TOLERANCE_CENTS
    ) {
      return f.t
    }
  }
  return Infinity
}

const easeOutCubic = (p: number) => 1 - (1 - p) ** 3

export const TaskDemo: Component<TaskDemoProps> = (props) => {
  const kind = () => props.kind
  const size = () => props.size ?? 'stage'
  const dims = SIZES[size()]
  const isCard = size() === 'card'
  const isActive = () => props.active?.() ?? true
  const tl = buildDemoTimeline(kind())
  // The guide cue (siren/hold) that plays alongside the animation — Glass's
  // decision 18: users should HEAR what to do, not just watch it.
  const cue = createDemoCue(
    planDemoCue(kind(), tl),
    () => props.getAudioContext?.() ?? null,
  )
  const stars = starsFor(kind(), dims.w, dims.h)
  const lockT = kind() === 'match' ? lockTimeFor(tl) : Infinity
  const targetCents = hzToCents(tl.guide[0].f0)
  const sing = tl.segments.find((s) => s.kind === 'sing') ?? tl.segments[0]
  // Glides/hold map the sing window across the width; match maps the whole
  // loop so the listen beat visibly precedes the sung scoop.
  const winStart = kind() === 'match' ? 0 : sing.start
  const winEnd = kind() === 'match' ? tl.durationSec : sing.end

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

  // The timeline is immutable and the canvas size fixed per instance, so
  // every projection (log2 + scaling) happens exactly once here — the rAF
  // loop only reads points, never recomputes or allocates color strings.
  const voicePts = tl.voice.map((f) => {
    const cents = hzToCents(f.f0)
    return {
      x: xFor(f.t),
      y: yFor(cents),
      voiced: f.conf >= CONF_MIN,
      locked:
        (kind() === 'match' || kind() === 'hold') &&
        Math.abs(foldCents(cents - targetCents)) <= HIT_TOLERANCE_CENTS,
    }
  })
  const guidePath = new Path2D()
  tl.guide.forEach((f, i) => {
    const x = xFor(f.t)
    const y = yFor(hzToCents(f.f0))
    if (i === 0) guidePath.moveTo(x, y)
    else guidePath.lineTo(x, y)
  })
  const glowR = isCard ? 11 : 14
  const noteR = isCard ? 4 : 5
  const headGlow = glowSprite('143, 163, 255', glowR)
  const headGlowLocked = glowSprite('139, 233, 184', glowR)
  const noteGlow = glowSprite('255, 233, 168', noteR * 2.6, 0.9)

  function drawStars(
    ctx: CanvasRenderingContext2D,
    t: number,
    still: boolean,
  ): void {
    ctx.fillStyle = '#f4f0ff'
    for (const star of stars) {
      ctx.globalAlpha = still
        ? 0.28
        : 0.18 + 0.22 * (0.5 + 0.5 * Math.sin(t * 1.7 + star.phase))
      ctx.beginPath()
      ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalAlpha = 1
  }

  function drawGuide(ctx: CanvasRenderingContext2D, alpha: number): void {
    ctx.strokeStyle = '#ffe9a8'
    ctx.globalAlpha = 0.55 * alpha
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.setLineDash([6, 7])
    ctx.stroke(guidePath)
    ctx.setLineDash([])
    ctx.globalAlpha = 1
  }

  /** Direction chevron near the start of a glide path. */
  function drawChevron(ctx: CanvasRenderingContext2D): void {
    if (kind() !== 'glide-up' && kind() !== 'glide-down') return
    const up = kind() === 'glide-up'
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
    if (count <= 0) return
    const dotR = isCard ? 1.9 : 2.4
    ctx.fillStyle = '#8fa3ff'
    // Newest dots glow brightest; the tail settles to a faint memory.
    // Recency is quantized into a few alpha buckets so the whole trail
    // fills in ~8 draw calls instead of one styled path per dot.
    const BUCKETS = 8
    for (let b = 0; b < BUCKETS; b++) {
      const start = Math.floor((count * b) / BUCKETS)
      const end =
        b === BUCKETS - 1 ? count : Math.floor((count * (b + 1)) / BUCKETS)
      if (end <= start) continue
      const recency = count <= 1 ? 1 : (start + end - 1) / 2 / (count - 1)
      ctx.globalAlpha = (0.15 + 0.65 * recency) * fade
      ctx.beginPath()
      for (let i = start; i < end; i++) {
        const p = voicePts[i]
        if (!p.voiced) continue
        ctx.moveTo(p.x + dotR, p.y)
        ctx.arc(p.x, p.y, dotR, 0, Math.PI * 2)
      }
      ctx.fill()
    }
    ctx.globalAlpha = 1
  }

  function drawHead(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    locked: boolean,
    fade: number,
  ): void {
    ctx.globalAlpha = fade
    ctx.drawImage(locked ? headGlowLocked : headGlow, x - glowR, y - glowR)
    ctx.fillStyle = locked ? '#d9ffe9' : '#cdd6ff'
    ctx.beginPath()
    ctx.arc(x, y, isCard ? 2.8 : 3.4, 0, Math.PI * 2)
    ctx.fill()
    ctx.globalAlpha = 1
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
    ctx.strokeStyle = '#a8b6ff'
    ctx.globalAlpha = 0.85 * fade
    ctx.lineWidth = 2.4
    ctx.beginPath()
    ctx.arc(x, y, 12 * scale + spread, 0, Math.PI * 2)
    ctx.stroke()
    ctx.globalAlpha = 1
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
    const maxR = isCard ? 22 : 30
    ctx.strokeStyle = '#ffe9a8'
    ctx.lineWidth = 1.6
    for (const offset of [0, 0.5]) {
      const p = ((t - segStart) / 1.0 + offset) % 1
      ctx.globalAlpha = 0.5 * (1 - p)
      ctx.beginPath()
      ctx.arc(x, y, noteR + p * maxR, 0, Math.PI * 2)
      ctx.stroke()
    }
    ctx.globalAlpha = 1
    const haloR = noteR * 2.6
    ctx.drawImage(noteGlow, x - haloR, y - haloR)
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
    const sparkR = 1.8 * (1 - p * 0.5)
    ctx.fillStyle = '#8be9b8'
    ctx.globalAlpha = 0.9 * (1 - p)
    ctx.beginPath()
    for (let i = 0; i < 4; i++) {
      const angle = (Math.PI / 4) * (1 + 2 * i)
      const sx = x + Math.cos(angle) * dist
      const sy = y + Math.sin(angle) * dist
      ctx.moveTo(sx + sparkR, sy)
      ctx.arc(sx, sy, sparkR, 0, Math.PI * 2)
    }
    ctx.fill()
    ctx.globalAlpha = 1
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
    if (kind() === 'match' && seg.kind === 'ready' && !still) {
      // Two count-in pulses on the target line before the sing beat.
      const p = (state.t - seg.start) / (seg.end - seg.start)
      guideAlpha = 0.55 + 0.45 * Math.abs(Math.sin(Math.PI * 2 * p))
    }
    drawGuide(ctx, guideAlpha)
    drawChevron(ctx)

    if (kind() === 'match' && seg.kind === 'listen' && !still) {
      const listen = tl.segments[0]
      drawListenPulse(ctx, state.t, listen.start, listen.end)
    }

    const count = still ? voicePts.length : state.voiceIndex
    const trailFade = still ? 0.55 : fade
    drawTrail(ctx, count, trailFade)

    const head = count > 0 ? voicePts[count - 1] : null
    if (head && head.voiced) {
      if (kind() === 'hold') {
        const p = still
          ? 1
          : Math.min(1, (state.t - sing.start) / (sing.end - sing.start))
        drawHoldRing(ctx, head.x, head.y, p, fade)
      }
      drawHead(ctx, head.x, head.y, head.locked, still ? 0.9 : fade)
      if (kind() === 'match' && !still) {
        drawLockSparks(ctx, state.t, head.x, head.y)
      }
    }

    if (kind() === 'match') {
      // The static poster shows the completed, locked-on take — caption it
      // with the sing step, not the "Listen…" the loop happens to start on.
      setCaption(still ? 'sing' : seg.kind)
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
    const didWrap = wrapped < lastLoopT
    lastLoopT = wrapped
    render(wrapped, false)
    // Notify AFTER painting: onLoopEnd advances the overview spotlight,
    // whose effect synchronously stops this loop and draws the static
    // poster — painting after that would overwrite it with frame 0.
    if (didWrap) props.onLoopEnd?.()
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
    // The cue plays whenever the demo is on show — decoupled from the motion
    // loop, so reduced-motion viewers still hear it.
    cue.sync(isActive() && visible && onScreen)
  }

  onMount(() => {
    const dpr = Math.min(getDevicePixelRatio(), 2)
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
      cue.stop()
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
      <Show when={kind() === 'match'}>
        <div class="mirror-demo-caption" aria-hidden="true">
          {CAPTIONS[caption()]}
        </div>
      </Show>
    </div>
  )
}
