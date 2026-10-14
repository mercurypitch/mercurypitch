// ============================================================
// CelebrationStar: the hollow neon star, its sparkles, ribbons and burst
// ============================================================
//
// Storyboard screen 4, as art round 5 draws it (CELEBRATION in
// echo-celebration.ts; spec: echo-a0/geometry/echo-celebration-star.json r3).
// Bottom to top, in A0's paint order (tools/celebration_r3.py draw):
//
//   star glow  light added round the star
//   ribbons    three thin wispy cyan strokes along the dots' chains, in a
//              canvas: their alpha varies along each curve (the wisp, the
//              tapers, each link's gain), which no CSS or SVG stroke can do
//   star       a translucent blue fill, a small lumpy inner outline, blue
//              blotches inside (clipped to the fill), then the bright
//              lopsided outer outline; both outlines run from violet-white
//              at the top tip to cyan at the bottom tips
//   dots       33 sparkles, each a soft glow round a core, each its own
//              size and brightness
//   sparkles   26 smaller ones along the chains, drawn as the dots are
//   starburst  a cyan mist laid over, a soft glow, four tapered rays and
//              four fainter diagonal ones, a white core
//
// The two glows are light added to the plate: radial gradients screened
// over it, their colours fitted to the plate and, for the starburst's, to
// the mist under it (celebration-paint.ts).
//
// Placed on the plate itself (it belongs to the town), not with the sky's
// content. t 0 is when the result's stars are up: the starburst pops and
// its mist swells, the dots appear nearest it first, each sparkle a beat
// after its dot, the ribbons draw on from their ends nearest it, the
// outlines draw on from the top tip, clockwise, then the fill, its
// blotches and the glow come up; from 1.8 s the dots and sparkles
// twinkle, the glow breathes, the rays shimmer and the ribbons' wisps
// drift (CELEBRATION.timing). Every motion but the ribbons' is a Web
// Animation of opacity, transform or a dash offset; the ribbons' canvas
// is repainted on animation frames while they draw on, and five times a
// second for the drift (celebration-ribbons.ts). With reduced motion, or in a
// fixture, the star is drawn at its end state and nothing moves.

import type { JSX } from 'solid-js'
import { createSignal, createUniqueId, For, onCleanup, onMount, Show, untrack, } from 'solid-js'
import { prefersReducedMotion } from '@/components/room-kit/reduced-motion'
import type { DotTiming, PointLight } from './celebration-paint'
import { alphaStops, BOTTOM_TIPS, dotTimings, gauss, GAUSS_REACH, gaussStops, keyframeOffsets, MIST_REACH, mistAngleStops, pointLight, screenStops, sigmaOf, sparkleTimings, starPath, } from './celebration-paint'
import { createCelebrationRibbons } from './celebration-ribbons'
import styles from './CelebrationStar.module.css'
import { CELEBRATION } from './echo-celebration'
import { CELEBRATION_SPARKLES } from './echo-celebration-sparkles'
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

/** The share of the dots, then of the sparkles, up after each step. */
const STEP_SHARES = [1 / 4, 2 / 4, 3 / 4, 1]

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

  // ── The dots and the sparkles ─────────────────────────────
  const lightStyle = (
    light: PointLight & { readonly u: number; readonly v: number },
  ): JSX.CSSProperties => {
    const at = onPlate(props.layout, light)
    const { reach, stops } = pointLight(light, unit())
    return {
      ...disc(at.x, at.y, reach),
      background: `radial-gradient(circle closest-side, ${stops.join(', ')})`,
    }
  }

  // ── The ribbons ───────────────────────────────────────────
  /**
   * Undrawn while the celebration plays (playBurst starts their clock),
   * their end state in a fixture or with reduced motion.
   */
  const animated = untrack(() => !props.still && !prefersReducedMotion())
  const ribbons = createCelebrationRibbons(() => props.layout, animated)

  // ── The star ──────────────────────────────────────────────
  const tip = (): number => CELEBRATION.star.tipW * unit()
  /**
   * The star's SVG box: its farthest corner (the lopsided outline reaches
   * past the tip radius), its stroke and a margin, px about its centre.
   */
  const box = (): number =>
    tip() * Math.max(1, ...CELEBRATION.star.outer.lopsided.radiusCcw) +
    CELEBRATION.star.outer.strokeW * unit() +
    2
  const outerPath = (): string =>
    starPath(
      tip(),
      CELEBRATION.star.outer.valleyOverTip,
      undefined,
      CELEBRATION.star.outer.lopsided,
    )

  // ── Motion ────────────────────────────────────────────────
  let mistEl: HTMLDivElement | undefined
  let burstGlowEl: HTMLDivElement | undefined
  let burstCoreEl: HTMLDivElement | undefined
  let starGlowEl: HTMLDivElement | undefined
  let fillEl: SVGPathElement | undefined
  let blotchEl: SVGGElement | undefined
  let innerEl: SVGPathElement | undefined
  let outerEl: SVGPathElement | undefined
  const rayEls: HTMLDivElement[] = []
  const dotEls: HTMLDivElement[] = []
  const sparkleEls: HTMLDivElement[] = []
  const running: Animation[] = []

  /**
   * t 0 on the document's timeline: each part's animations run from it,
   * whichever frame the part came up in (null where there is no timeline).
   */
  let t0: number | null = null
  const animate = (
    el: Element | undefined,
    frames: Keyframe[],
    options: KeyframeAnimationOptions,
  ): void => {
    if (el === undefined || typeof el.animate !== 'function') return
    const animation = el.animate(frames, { fill: 'both', ...options })
    if (t0 !== null) animation.startTime = t0
    running.push(animation)
  }
  const span = (pair: readonly number[]) => ({
    delay: pair[0],
    duration: pair[1] - pair[0],
  })

  /** Lights come up from a scale, then twinkle between two opacities. */
  const revealLights = (
    els: readonly HTMLDivElement[],
    timings: readonly DotTiming[],
    o: {
      fromScale: number
      durationMs: number
      opacity: readonly number[]
    },
    from: number,
    to: number,
  ): void => {
    const [dim, full] = o.opacity
    timings.slice(from, to).forEach((t, k) => {
      const i = from + k
      animate(
        els[i],
        [
          { opacity: 0, transform: `scale(${o.fromScale})` },
          { opacity: 1, transform: 'scale(1)' },
        ],
        { delay: t.revealAt, duration: o.durationMs, easing: 'ease-out' },
      )
      animate(els[i], [{ opacity: full }, { opacity: dim }], {
        delay: t.twinkleAt,
        duration: t.periodMs / 2,
        iterations: Infinity,
        direction: 'alternate',
        easing: 'ease-in-out',
        fill: 'none',
      })
    })
  }

  /** t 0: the starburst pops, its mist swells, the ribbons' clock starts. */
  const playBurst = (): void => {
    const { burst: b } = timing
    const now = document.timeline?.currentTime
    t0 = typeof now === 'number' ? now : null
    ribbons.run(performance.now())
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
  }

  /** The rays grow from the starburst (from nothing at t 0), then shimmer. */
  const playRays = (): void => {
    const { burst: b, idle, idleFromMs } = timing
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
  }

  /** Dots `from` to `to`, nearest the starburst first; then each twinkles. */
  const playDots = (from: number, to: number): void => {
    const { dots, idle } = timing
    revealLights(
      dotEls,
      dotTimings(),
      {
        fromScale: dots.fromScale,
        durationMs: dots.durationMs,
        opacity: idle.dotOpacity,
      },
      from,
      to,
    )
  }

  /** Sparkles `from` to `to`, each a beat after its dot; then each twinkles. */
  const playSparkles = (from: number, to: number): void => {
    const { sparkles } = timing
    revealLights(
      sparkleEls,
      sparkleTimings(),
      {
        fromScale: sparkles.fromScale,
        durationMs: sparkles.durationMs,
        opacity: sparkles.idleOpacity,
      },
      from,
      to,
    )
  }

  /** The star: the outlines draw on, then the fill and the glow come up. */
  const playStar = (): void => {
    const { star: s } = timing
    const draw = [{ strokeDashoffset: '1' }, { strokeDashoffset: '0' }]
    animate(outerEl, draw, { ...span(s.outer), easing: 'ease-in-out' })
    animate(innerEl, draw, { ...span(s.inner), easing: 'ease-in-out' })
    for (const el of [fillEl, blotchEl]) {
      animate(el, [{ opacity: 0 }, { opacity: 1 }], {
        ...span(s.fill),
        easing: 'ease-in-out',
      })
    }
  }

  /** The star's glow comes up after its fill, then breathes. */
  const playStarGlow = (): void => {
    const { star: s, idle, idleFromMs } = timing
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

  /**
   * The parts come up a frame apart, each with its animations, so no one
   * frame carries the whole star: the starburst at t 0 and its rays, then the
   * dots and the sparkles a quarter at a time, the star, and its glow with
   * the ribbons' canvas (STEPS). Each part is up long before its first
   * animation starts (the first dot at 200 ms, after five frames), and
   * each runs from t 0, so the celebration plays as it would all at once.
   * A fixture or reduced motion has every part from the start.
   */
  const all = !animated
  const [dotsUp, setDotsUp] = createSignal(all ? CELEBRATION.dots.length : 0)
  const [sparklesUp, setSparklesUp] = createSignal(
    all ? CELEBRATION_SPARKLES.length : 0,
  )
  const [starUp, setStarUp] = createSignal(all)
  const [raysUp, setRaysUp] = createSignal(all)
  const [glowUp, setGlowUp] = createSignal(all)
  const upTo = (
    count: number,
    set: (n: number) => void,
    play: (from: number, to: number) => void,
  ): (() => void)[] =>
    STEP_SHARES.map((share, k) => () => {
      const from = Math.round(count * (k === 0 ? 0 : STEP_SHARES[k - 1]))
      const to = Math.round(count * share)
      set(to)
      play(from, to)
    })
  const STEPS: readonly (() => void)[] = [
    () => {
      setRaysUp(true)
      playRays()
    },
    ...upTo(CELEBRATION.dots.length, setDotsUp, playDots),
    ...upTo(CELEBRATION_SPARKLES.length, setSparklesUp, playSparkles),
    () => {
      setStarUp(true)
      playStar()
    },
    () => {
      setGlowUp(true)
      playStarGlow()
    },
  ]
  let step = 0
  let stepFrame = 0
  const nextStep = (): void => {
    stepFrame = requestAnimationFrame(() => {
      const play = STEPS[step]
      step += 1
      play()
      if (step < STEPS.length) nextStep()
    })
  }

  onMount(() => {
    if (!animated) return
    playBurst()
    nextStep()
    // The fields' first slice waits for the first frame to show.
    ribbons.buildInSlices()
  })
  onCleanup(() => {
    for (const animation of running) animation.cancel()
    ribbons.stop()
    cancelAnimationFrame(stepFrame)
  })

  return (
    <div class={styles.celebration} data-testid="echo-celebration">
      <Show when={glowUp()}>
        <div
          ref={starGlowEl}
          class={styles.light}
          data-part="star-glow"
          style={glowStyle(star(), CELEBRATION.star.glow)}
        />
        <canvas
          ref={ribbons.setCanvas}
          class={styles.ribbons}
          data-part="ribbons"
          style={{
            left: px(ribbons.box().left),
            top: px(ribbons.box().top),
            width: px(ribbons.box().width / ribbons.box().dpr),
            height: px(ribbons.box().height / ribbons.box().dpr),
          }}
        />
      </Show>
      <Show when={starUp()}>
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
              <stop
                offset="1"
                stop-color={rgb(CELEBRATION.star.outer.bottom)}
              />
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
              <stop
                offset="1"
                stop-color={rgb(CELEBRATION.star.inner.bottom)}
              />
            </linearGradient>
            <clipPath id={`${id}-inside`}>
              <path d={outerPath()} />
            </clipPath>
            <For each={CELEBRATION.star.blotches}>
              {(blotch, i) => (
                <radialGradient id={`${id}-blotch-${i()}`}>
                  <For each={gaussStops(blotch.alpha)}>
                    {(stop) => (
                      <stop
                        offset={stop.offset}
                        stop-color={rgb(blotch.rgb)}
                        stop-opacity={stop.opacity.toFixed(4)}
                      />
                    )}
                  </For>
                </radialGradient>
              )}
            </For>
          </defs>
          <path
            ref={fillEl}
            data-part="fill"
            d={outerPath()}
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
            stroke-opacity={CELEBRATION.star.inner.alpha}
            stroke-width={CELEBRATION.star.inner.strokeW * unit()}
            stroke-linejoin="round"
            pathLength="1"
            stroke-dasharray="1"
          />
          <g
            ref={blotchEl}
            data-part="blotches"
            clip-path={`url(#${id}-inside)`}
          >
            <For each={CELEBRATION.star.blotches}>
              {(blotch, i) => (
                <circle
                  cx={blotch.centreR[0] * tip()}
                  cy={blotch.centreR[1] * tip()}
                  r={GAUSS_REACH * blotch.sigmaR * tip()}
                  fill={`url(#${id}-blotch-${i()})`}
                />
              )}
            </For>
          </g>
          <path
            ref={outerEl}
            data-part="outer"
            d={outerPath()}
            fill="none"
            stroke={`url(#${id}-outer)`}
            stroke-width={CELEBRATION.star.outer.strokeW * unit()}
            stroke-linejoin="round"
            pathLength="1"
            stroke-dasharray="1"
          />
        </svg>
      </Show>
      <For each={CELEBRATION.dots.slice(0, dotsUp())}>
        {(dot, i) => (
          <div
            ref={(el) => {
              dotEls[i()] = el
            }}
            class={styles.disc}
            data-part="dot"
            style={lightStyle(dot)}
          />
        )}
      </For>
      <For each={CELEBRATION_SPARKLES.slice(0, sparklesUp())}>
        {(sparkle, i) => (
          <div
            ref={(el) => {
              sparkleEls[i()] = el
            }}
            class={styles.disc}
            data-part="sparkle"
            style={lightStyle(sparkle)}
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
      <Show when={raysUp()}>
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
      </Show>
      <div
        ref={burstCoreEl}
        class={styles.disc}
        data-part="burst-core"
        style={burstCore()}
      />
    </div>
  )
}
