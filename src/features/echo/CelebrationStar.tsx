// ============================================================
// CelebrationStar: the hollow neon star, its sparkles, ribbons and burst
// ============================================================
//
// Storyboard screen 4, as art round 4 draws it (CELEBRATION in
// echo-geometry.ts; spec: echo-a0/geometry/echo-celebration-star.json r3).
// Bottom to top, in A0's paint order (tools/celebration_r3.py draw):
//
//   star glow  light added round the star
//   ribbons    three thin wispy cyan strokes along the dots' chains, in a
//              canvas: their alpha varies along each curve (the wisp, the
//              tapers), which no CSS or SVG stroke can do
//   star       a translucent blue fill, then a small lumpy inner outline
//              and the bright outer one, both running from violet-white at
//              the top tip to cyan at the bottom tips
//   dots       33 sparkles, each a soft glow round a crisp core
//   starburst  a cyan mist laid over, a soft glow, four tapered rays and
//              four fainter diagonal ones, a white core
//
// The two glows are light added to the plate: radial gradients screened
// over it, their colours fitted to the plate and, for the starburst's, to
// the mist under it (celebration-paint.ts).
//
// Placed on the plate itself (it belongs to the town), not with the sky's
// content. t 0 is when the result's stars are up: the starburst pops and
// its mist swells, the dots appear nearest it first, the ribbons draw on
// from their ends nearest it, the outlines draw on from the top tip,
// clockwise, then the fill and the glow come up; from 1.8 s the dots
// twinkle, the glow breathes, the rays shimmer and the ribbons' wisps
// drift (CELEBRATION.timing). Every motion but the ribbons' is a Web
// Animation of opacity, transform or a dash offset; the ribbons' canvas
// is repainted on animation frames while they draw on, and five times a
// second (WISP_FRAME_MS) for the drift. With reduced motion, or in a
// fixture, the star is drawn at its end state and nothing moves.

import type { JSX } from 'solid-js'
import { createEffect, createMemo, createUniqueId, For, onCleanup, onMount, } from 'solid-js'
import { prefersReducedMotion } from '@/components/room-kit/reduced-motion'
import type { RibbonField, RibbonFrame } from './celebration-paint'
import { alphaStops, BOTTOM_TIPS, catmullRom, dotTimings, gauss, GAUSS_REACH, keyframeOffsets, MIST_REACH, mistAngleStops, paintRibbons, ribbonField, ribbonFrames, ribbonPlan, screenStops, sigmaOf, starPath, } from './celebration-paint'
import styles from './CelebrationStar.module.css'
import { CELEBRATION } from './echo-geometry'
import type { ScreenPoint, SkyLayout } from './sky-layout'
import { onPlate } from './sky-layout'

type Glow = typeof CELEBRATION.star.glow | typeof CELEBRATION.burst.glow

interface Ray {
  readonly name: string
  /** Its turn from pointing right, clockwise on screen. */
  readonly turn: number
  readonly lengthW: number
  readonly opacity: number
}

const { lengthW: RAY_LENGTH, diagonal: DIAGONAL } = CELEBRATION.burst.rays
/** The four rays, then the four diagonal ones (A0 paints them after). */
const RAYS: readonly Ray[] = [
  { name: 'right', turn: 0, lengthW: RAY_LENGTH.right, opacity: 1 },
  { name: 'down', turn: 90, lengthW: RAY_LENGTH.down, opacity: 1 },
  { name: 'left', turn: 180, lengthW: RAY_LENGTH.left, opacity: 1 },
  { name: 'up', turn: -90, lengthW: RAY_LENGTH.up, opacity: 1 },
  ...(DIAGONAL.lengthW > 0
    ? [
        ['up-right', -45],
        ['down-right', 45],
        ['down-left', 135],
        ['up-left', -135],
      ].map(([name, turn]) => ({
        name: name as string,
        turn: turn as number,
        lengthW: DIAGONAL.lengthW,
        opacity: DIAGONAL.alpha,
      }))
    : []),
]

/** The ribbons' drift is slow (about a px a second): five paints a second. */
const WISP_FRAME_MS = 200

const rgb = (c: readonly number[]): string => `rgb(${c.join(', ')})`
const px = (n: number): string => `${n.toFixed(2)}px`

/** A disc's box: `reach` px about a centre. */
function disc(x: number, y: number, reach: number): JSX.CSSProperties {
  return {
    left: px(x - reach),
    top: px(y - reach),
    width: px(2 * reach),
    height: px(2 * reach),
  }
}

export interface CelebrationStarProps {
  layout: SkyLayout
  /** A fixture: drawn at its end state, nothing moves. */
  still: boolean
}

export function CelebrationStar(props: CelebrationStarProps): JSX.Element {
  const id = createUniqueId()
  const unit = (): number => props.layout.unit
  const star = () => onPlate(props.layout, CELEBRATION.star)
  const burst = () => onPlate(props.layout, CELEBRATION.burst)
  const { timing } = CELEBRATION

  /** A glow about a place: its rings, screened over the plate. */
  const glowStyle = (at: ScreenPoint, glow: Glow): JSX.CSSProperties => ({
    ...disc(at.x, at.y, glow.reachW * unit()),
    background: `radial-gradient(circle closest-side, ${screenStops(glow.screen).join(', ')})`,
  })

  // ── The starburst ─────────────────────────────────────────
  const raySigma = (): number =>
    sigmaOf(CELEBRATION.burst.rays.widthFwhmW * unit())
  const rayStyle = (ray: Ray): JSX.CSSProperties => {
    const sigma = raySigma()
    const half = GAUSS_REACH * sigma
    const across = alphaStops(
      CELEBRATION.burst.rays.rgb,
      (r) => gauss(Math.abs(r - half), sigma),
      2 * half,
    )
    return {
      left: px(burst().x),
      top: px(burst().y - half),
      width: px(ray.lengthW * unit()),
      height: px(2 * half),
      opacity: ray.opacity,
      transform: `rotate(${ray.turn}deg)`,
      background: `linear-gradient(to bottom, ${across.join(', ')})`,
    }
  }
  /** The mist: laid over, about its own centre, thinned toward the right. */
  const mistStyle = (): JSX.CSSProperties => {
    const { mist } = CELEBRATION.burst
    const sigma = mist.sigmaW * unit()
    const reach = MIST_REACH * sigma
    const mask = `conic-gradient(${mistAngleStops().join(', ')})`
    return {
      ...disc(
        burst().x + mist.offsetW[0] * unit(),
        burst().y + mist.offsetW[1] * unit(),
        reach,
      ),
      background: `radial-gradient(circle closest-side, ${alphaStops(
        mist.rgb,
        (r) => mist.alpha * gauss(r, sigma),
        reach,
      ).join(', ')})`,
      'mask-image': mask,
      '-webkit-mask-image': mask,
    }
  }
  const burstCore = (): JSX.CSSProperties => {
    const sigma = sigmaOf(CELEBRATION.burst.core.fwhmW * unit())
    const reach = GAUSS_REACH * sigma
    return {
      ...disc(burst().x, burst().y, reach),
      background: `radial-gradient(circle closest-side, ${alphaStops(
        CELEBRATION.burst.core.rgb,
        (r) => gauss(r, sigma),
        reach,
      ).join(', ')})`,
    }
  }

  // ── The dots ──────────────────────────────────────────────
  const dotStyle = (
    dot: (typeof CELEBRATION.dots)[number],
  ): JSX.CSSProperties => {
    const at = onPlate(props.layout, dot)
    const glow = sigmaOf(dot.glowFwhmW * unit())
    const core = sigmaOf(dot.coreFwhmW * unit())
    const reach = GAUSS_REACH * Math.max(glow, core)
    const alphaAt = (r: number) =>
      1 - (1 - dot.glowAlpha * gauss(r, glow)) * (1 - gauss(r, core))
    return {
      ...disc(at.x, at.y, reach),
      background: `radial-gradient(circle closest-side, ${alphaStops(dot.rgb, alphaAt, reach).join(', ')})`,
    }
  }

  // ── The ribbons ───────────────────────────────────────────
  const plan = ribbonPlan()
  const ribbonSigma = (): number =>
    Math.max(...CELEBRATION.ribbons.map((r) => sigmaOf(r.fwhmW * unit())))
  const curves = createMemo(() =>
    CELEBRATION.ribbons.map((r) =>
      catmullRom(
        r.points.map((p) => {
          const at = onPlate(props.layout, { u: p[0], v: p[1] })
          return [at.x, at.y] as const
        }),
      ),
    ),
  )
  /** The ribbons' canvas: their curves' box, out to their reach, in px. */
  const ribbonBox = createMemo(() => {
    const dpr = Math.min(3, window.devicePixelRatio || 1)
    const pad = 4 * ribbonSigma() + 2
    const all = curves().flat()
    const left = Math.min(...all.map((p) => p[0])) - pad
    const top = Math.min(...all.map((p) => p[1])) - pad
    const width = Math.ceil(
      (Math.max(...all.map((p) => p[0])) + pad - left) * dpr,
    )
    const height = Math.ceil(
      (Math.max(...all.map((p) => p[1])) + pad - top) * dpr,
    )
    return { left, top, width, height, dpr }
  })
  const fields = createMemo((): RibbonField[] => {
    const box = ribbonBox()
    return CELEBRATION.ribbons.map((r, i) =>
      ribbonField(
        curves()[i].map(([x, y]) => [x - box.left, y - box.top] as const),
        {
          fwhm: r.fwhmW * unit(),
          taper: r.taperW * unit(),
          alpha: r.alpha,
          fromStart: plan[i].fromStart,
        },
        box,
      ),
    )
  })
  let ribbonEl: HTMLCanvasElement | undefined
  /**
   * The ribbons' state now: their end state, until play() starts them
   * undrawn (in the same tick as the first paint, before a frame shows it).
   */
  let ribbonNow: RibbonFrame[] = ribbonFrames(null)
  const paintRibbonCanvas = (): void => {
    const box = ribbonBox()
    const ctx = ribbonEl?.getContext('2d')
    if (ribbonEl === undefined || ctx === null || ctx === undefined) return
    if (ribbonEl.width !== box.width) ribbonEl.width = box.width
    if (ribbonEl.height !== box.height) ribbonEl.height = box.height
    const image = ctx.createImageData(box.width, box.height)
    paintRibbons(
      image.data,
      fields(),
      ribbonNow,
      CELEBRATION.ribbons.map((r) => ({
        depth: r.wisp.depth,
        periodPx: r.wisp.periodW * unit(),
      })),
      CELEBRATION.ribbons.map((r) => r.rgb),
    )
    ctx.putImageData(image, 0, 0)
  }
  // Repaint whenever the layout moves them (the fields follow it).
  createEffect(paintRibbonCanvas)

  // ── The star ──────────────────────────────────────────────
  const tip = (): number => CELEBRATION.star.tipW * unit()
  /** The star's SVG box: its tips, its stroke and a margin, px about its centre. */
  const box = (): number => tip() + CELEBRATION.star.outer.strokeW * unit() + 2

  // ── Motion ────────────────────────────────────────────────
  let mistEl: HTMLDivElement | undefined
  let burstGlowEl: HTMLDivElement | undefined
  let burstCoreEl: HTMLDivElement | undefined
  let starGlowEl: HTMLDivElement | undefined
  let fillEl: SVGPathElement | undefined
  let innerEl: SVGPathElement | undefined
  let outerEl: SVGPathElement | undefined
  const rayEls: HTMLDivElement[] = []
  const dotEls: HTMLDivElement[] = []
  const running: Animation[] = []

  const animate = (
    el: Element | undefined,
    frames: Keyframe[],
    options: KeyframeAnimationOptions,
  ): void => {
    if (el === undefined || typeof el.animate !== 'function') return
    running.push(el.animate(frames, { fill: 'both', ...options }))
  }
  const span = (pair: readonly number[]) => ({
    delay: pair[0],
    duration: pair[1] - pair[0],
  })

  let frame = 0
  /** The ribbons draw on, then their wisps drift: repainted from `start`. */
  const runRibbons = (start: number): void => {
    const { durationMs, fromMs } = timing.ribbons
    const drawnBy = Math.max(...plan.map((p) => p.revealAt)) + durationMs
    let painted = -Infinity
    const tick = (now: number): void => {
      const elapsed = now - start
      // One frame past the end, so the last paint is the whole ribbon.
      const drawing = elapsed >= fromMs && elapsed < drawnBy + 50
      const drifting = elapsed >= timing.idleFromMs
      if (drawing || (drifting && now - painted >= WISP_FRAME_MS)) {
        ribbonNow = ribbonFrames(elapsed)
        paintRibbonCanvas()
        painted = now
      }
      frame = requestAnimationFrame(tick)
    }
    ribbonNow = ribbonFrames(0)
    paintRibbonCanvas()
    frame = requestAnimationFrame(tick)
  }

  const play = (): void => {
    const { burst: b, star: s, dots, idle, idleFromMs } = timing
    runRibbons(performance.now())
    // The mist swells as it comes up.
    const mistOpacity = keyframeOffsets(timing.mist.opacity)
    const mistScale = keyframeOffsets(timing.mist.scale)
    animate(
      mistEl,
      mistOpacity.map((k, i) => ({
        offset: k.offset,
        opacity: k.value,
        transform: `scale(${mistScale[i].value})`,
      })),
      {
        ...span([
          timing.mist.opacity[0][0],
          timing.mist.opacity[timing.mist.opacity.length - 1][0],
        ]),
        easing: 'ease-out',
      },
    )
    // The starburst: the core overshoots and settles, the glow and rays grow.
    const core = keyframeOffsets(b.coreScale)
    animate(
      burstCoreEl,
      core.map((k, i) => ({
        offset: k.offset,
        transform: `scale(${k.value})`,
        easing: i === 0 ? 'ease-out' : 'ease-in-out',
      })),
      span([b.coreScale[0][0], b.coreScale[b.coreScale.length - 1][0]]),
    )
    animate(
      burstGlowEl,
      keyframeOffsets(b.glowOpacity).map((k) => ({
        offset: k.offset,
        opacity: k.value,
      })),
      {
        ...span([
          b.glowOpacity[0][0],
          b.glowOpacity[b.glowOpacity.length - 1][0],
        ]),
        easing: 'ease-out',
      },
    )
    RAYS.forEach((ray, i) => {
      const turn = `rotate(${ray.turn}deg)`
      animate(
        rayEls[i],
        keyframeOffsets(b.raysLength).map((k) => ({
          offset: k.offset,
          transform: `${turn} scaleX(${k.value})`,
        })),
        {
          ...span([
            b.raysLength[0][0],
            b.raysLength[b.raysLength.length - 1][0],
          ]),
          easing: 'ease-out',
        },
      )
      const [low, high] = idle.raysScale
      animate(
        rayEls[i],
        [
          { transform: `${turn} scaleX(${high})` },
          { transform: `${turn} scaleX(${low})` },
        ],
        {
          delay: idleFromMs,
          duration: idle.raysPeriodMs / 2,
          iterations: Infinity,
          direction: 'alternate',
          easing: 'ease-in-out',
          fill: 'none',
        },
      )
    })
    // The dots, nearest the starburst first; then each twinkles.
    const [dim, full] = idle.dotOpacity
    dotTimings().forEach((t, i) => {
      animate(
        dotEls[i],
        [
          { opacity: 0, transform: `scale(${dots.fromScale})` },
          { opacity: 1, transform: 'scale(1)' },
        ],
        { delay: t.revealAt, duration: dots.durationMs, easing: 'ease-out' },
      )
      animate(dotEls[i], [{ opacity: full }, { opacity: dim }], {
        delay: t.twinkleAt,
        duration: t.periodMs / 2,
        iterations: Infinity,
        direction: 'alternate',
        easing: 'ease-in-out',
        fill: 'none',
      })
    })
    // The star: the outlines draw on, then the fill and the glow come up.
    const draw = [{ strokeDashoffset: '1' }, { strokeDashoffset: '0' }]
    animate(outerEl, draw, { ...span(s.outer), easing: 'ease-in-out' })
    animate(innerEl, draw, { ...span(s.inner), easing: 'ease-in-out' })
    animate(fillEl, [{ opacity: 0 }, { opacity: 1 }], {
      ...span(s.fill),
      easing: 'ease-in-out',
    })
    animate(starGlowEl, [{ opacity: 0 }, { opacity: 1 }], {
      ...span(s.glow),
      easing: 'ease-in-out',
    })
    const [faint, bright] = idle.glowOpacity
    animate(starGlowEl, [{ opacity: bright }, { opacity: faint }], {
      delay: idleFromMs,
      duration: idle.glowPeriodMs / 2,
      iterations: Infinity,
      direction: 'alternate',
      easing: 'ease-in-out',
      fill: 'none',
    })
  }

  onMount(() => {
    if (!props.still && !prefersReducedMotion()) play()
  })
  onCleanup(() => {
    for (const animation of running) animation.cancel()
    cancelAnimationFrame(frame)
  })

  return (
    <div class={styles.celebration} data-testid="echo-celebration">
      <div
        ref={starGlowEl}
        class={styles.light}
        data-part="star-glow"
        style={glowStyle(star(), CELEBRATION.star.glow)}
      />
      <canvas
        ref={ribbonEl}
        class={styles.ribbons}
        data-part="ribbons"
        style={{
          left: px(ribbonBox().left),
          top: px(ribbonBox().top),
          width: px(ribbonBox().width / ribbonBox().dpr),
          height: px(ribbonBox().height / ribbonBox().dpr),
        }}
      />
      <svg
        class={styles.star}
        width={2 * box()}
        height={2 * box()}
        viewBox={`${-box()} ${-box()} ${2 * box()} ${2 * box()}`}
        style={{ left: px(star().x - box()), top: px(star().y - box()) }}
      >
        <defs>
          <linearGradient
            id={`${id}-outer`}
            gradientUnits="userSpaceOnUse"
            x1="0"
            y1={-tip()}
            x2="0"
            y2={tip() * BOTTOM_TIPS}
          >
            <stop offset="0" stop-color={rgb(CELEBRATION.star.outer.top)} />
            <stop offset="1" stop-color={rgb(CELEBRATION.star.outer.bottom)} />
          </linearGradient>
          <linearGradient
            id={`${id}-inner`}
            gradientUnits="userSpaceOnUse"
            x1="0"
            y1={-tip()}
            x2="0"
            y2={tip() * BOTTOM_TIPS}
          >
            <stop offset="0" stop-color={rgb(CELEBRATION.star.inner.top)} />
            <stop offset="1" stop-color={rgb(CELEBRATION.star.inner.bottom)} />
          </linearGradient>
        </defs>
        <path
          ref={fillEl}
          data-part="fill"
          d={starPath(tip(), CELEBRATION.star.outer.valleyOverTip)}
          fill={rgb(CELEBRATION.star.fill.rgb)}
          fill-opacity={CELEBRATION.star.fill.alpha}
        />
        <path
          ref={innerEl}
          data-part="inner"
          d={starPath(
            tip() * CELEBRATION.star.inner.scale,
            CELEBRATION.star.inner.valleyOverTip,
            CELEBRATION.star.inner.wobbleCcw,
          )}
          fill="none"
          stroke={`url(#${id}-inner)`}
          stroke-width={CELEBRATION.star.inner.strokeW * unit()}
          stroke-linejoin="round"
          pathLength="1"
          stroke-dasharray="1"
        />
        <path
          ref={outerEl}
          data-part="outer"
          d={starPath(tip(), CELEBRATION.star.outer.valleyOverTip)}
          fill="none"
          stroke={`url(#${id}-outer)`}
          stroke-width={CELEBRATION.star.outer.strokeW * unit()}
          stroke-linejoin="round"
          pathLength="1"
          stroke-dasharray="1"
        />
      </svg>
      <For each={CELEBRATION.dots}>
        {(dot, i) => (
          <div
            ref={(el) => {
              dotEls[i()] = el
            }}
            class={styles.disc}
            data-part="dot"
            style={dotStyle(dot)}
          />
        )}
      </For>
      <div
        ref={mistEl}
        class={styles.disc}
        data-part="mist"
        style={mistStyle()}
      />
      <div
        ref={burstGlowEl}
        class={styles.light}
        data-part="burst-glow"
        style={glowStyle(burst(), CELEBRATION.burst.glow)}
      />
      <For each={RAYS}>
        {(ray, i) => (
          <div
            ref={(el) => {
              rayEls[i()] = el
            }}
            class={styles.ray}
            data-part="ray"
            data-ray={ray.name}
            style={rayStyle(ray)}
          />
        )}
      </For>
      <div
        ref={burstCoreEl}
        class={styles.disc}
        data-part="burst-core"
        style={burstCore()}
      />
    </div>
  )
}
