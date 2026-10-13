// ============================================================
// CelebrationStar: the hollow neon star, its sparkles and the starburst
// ============================================================
//
// Storyboard screen 4, as art round 3 drew it (CELEBRATION in
// echo-geometry.ts; spec: echo-a0/geometry/echo-celebration-star.json r3).
// Bottom to top, in A0's paint order:
//
//   star       a glow, a translucent blue fill, then a small inner outline
//              and the bright outer one, both running from violet-white at
//              the top tip to cyan at the bottom tips
//   dots       33 sparkles, each a soft glow round a crisp core
//   starburst  a soft glow, four tapered rays, a white core
//
// The two glows are light added to the plate: radial gradients screened
// over it, their colours fitted to the plate (celebration-paint.ts).
//
// Placed on the plate itself (it belongs to the town), not with the sky's
// content. t 0 is when the result's stars are up: the starburst pops, the
// dots appear nearest it first, the outlines draw on from the top tip,
// clockwise, then the fill and the glow come up; from 1.8 s the dots
// twinkle, the glow breathes and the rays shimmer (CELEBRATION.timing).
// Every motion is a Web Animation of opacity, transform or a dash offset;
// with reduced motion, or in a fixture, the star is drawn at its end state
// and nothing moves.

import type { JSX } from 'solid-js'
import { createUniqueId, For, onCleanup, onMount } from 'solid-js'
import { prefersReducedMotion } from '@/components/room-kit/reduced-motion'
import { alphaStops, BOTTOM_TIPS, dotTimings, gauss, GAUSS_REACH, keyframeOffsets, screenStops, sigmaOf, starPath, } from './celebration-paint'
import styles from './CelebrationStar.module.css'
import { CELEBRATION } from './echo-geometry'
import type { ScreenPoint, SkyLayout } from './sky-layout'
import { onPlate } from './sky-layout'

type Ray = keyof typeof CELEBRATION.burst.rays.lengthW
type Glow = typeof CELEBRATION.star.glow | typeof CELEBRATION.burst.glow

/** Each ray's turn from pointing right, clockwise on screen. */
const RAY_TURN: Record<Ray, number> = { right: 0, down: 90, left: 180, up: -90 }
const RAYS = Object.keys(RAY_TURN) as Ray[]

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
      width: px(CELEBRATION.burst.rays.lengthW[ray] * unit()),
      height: px(2 * half),
      transform: `rotate(${RAY_TURN[ray]}deg)`,
      background: `linear-gradient(to bottom, ${across.join(', ')})`,
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

  // ── The star ──────────────────────────────────────────────
  const tip = (): number => CELEBRATION.star.tipW * unit()
  /** The star's SVG box: its tips, its stroke and a margin, px about its centre. */
  const box = (): number => tip() + CELEBRATION.star.outer.strokeW * unit() + 2

  // ── Motion ────────────────────────────────────────────────
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

  const play = (): void => {
    const { burst: b, star: s, dots, idle, idleFromMs } = timing
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
      const turn = `rotate(${RAY_TURN[ray]}deg)`
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
  })

  return (
    <div class={styles.celebration} data-testid="echo-celebration">
      <div
        ref={starGlowEl}
        class={styles.light}
        data-part="star-glow"
        style={glowStyle(star(), CELEBRATION.star.glow)}
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
            data-ray={ray}
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
