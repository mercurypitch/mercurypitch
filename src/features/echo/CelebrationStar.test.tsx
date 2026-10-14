// ============================================================
// CelebrationStar: the round 5 star, drawn and set in motion from its spec
// ============================================================

import { cleanup, render, screen } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CelebrationStar } from './CelebrationStar'
import { CELEBRATION } from './echo-celebration'
import { CELEBRATION_SPARKLES } from './echo-celebration-sparkles'
import { layoutSky } from './sky-layout'

const motion = vi.hoisted(() => ({ reduced: false }))
vi.mock('@/components/room-kit/reduced-motion', () => ({
  prefersReducedMotion: () => motion.reduced,
}))

interface Played {
  part: string | null
  frames: Keyframe[]
  options: KeyframeAnimationOptions
}

let played: Played[] = []
let frames: number[] = []
let painted: ImageData[] = []
/** The most alpha in the ribbons' last paint, 0 to 255. */
const ribbonPeak = (): number => {
  const data = painted[painted.length - 1].data
  let peak = 0
  for (let i = 3; i < data.length; i += 4) peak = Math.max(peak, data[i])
  return peak
}

beforeEach(() => {
  motion.reduced = false
  played = []
  frames = []
  vi.stubGlobal(
    'requestAnimationFrame',
    vi.fn((_: FrameRequestCallback) => {
      frames.push(frames.length + 1)
      return frames.length
    }),
  )
  vi.stubGlobal('cancelAnimationFrame', vi.fn())
  painted = []
  // The overloads end on WebGPU's context; this stands in for 2D.
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    createImageData: (w: number, h: number) => ({
      width: w,
      height: h,
      data: new Uint8ClampedArray(w * h * 4),
    }),
    putImageData: (image: ImageData) => painted.push(image),
  } as never)
  Element.prototype.animate = vi.fn(function animate(
    this: Element,
    frames: Keyframe[] | PropertyIndexedKeyframes | null,
    options?: number | KeyframeAnimationOptions,
  ) {
    played.push({
      part: this.getAttribute('data-part'),
      frames: frames as Keyframe[],
      options: options as KeyframeAnimationOptions,
    })
    return { cancel: vi.fn() } as unknown as Animation
  })
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

const LAYOUT = layoutSky({
  width: 390,
  height: 844,
  edgeClear: 103,
  chipClear: 161,
  resultClear: 235,
})

const parts = (part: string): Element[] => [
  ...screen
    .getByTestId('echo-celebration')
    .querySelectorAll(`[data-part="${part}"]`),
]
const playedFor = (part: string) => played.filter((p) => p.part === part)
/** A path's corner i, [x, y] px about the star's centre. */
const cornerOf = (part: string, i: number): number[] => {
  const d = parts(part)[0].getAttribute('d') ?? ''
  return d
    .replace(/[MLZ]/gu, ' ')
    .trim()
    .split(/\s+/u)
    .map(Number)
    .slice(2 * i, 2 * i + 2)
}
/** The star's tip radius on this layout, px. */
const TIP = CELEBRATION.star.tipW * LAYOUT.unit
/** The alpha of a disc's first gradient stop: its centre. */
const centreAlpha = (el: Element): number =>
  Number(
    /rgba\([^)]*,\s*([\d.]+)\)/u.exec(
      (el as HTMLElement).style.background,
    )?.[1],
  )

describe('the celebration star', () => {
  it('draws the starburst, the 33 dots, the ribbons and the hollow star', () => {
    render(() => <CelebrationStar layout={LAYOUT} still />)

    expect(parts('mist')).toHaveLength(1)
    expect(parts('burst-glow')).toHaveLength(1)
    expect(parts('ray').map((ray) => ray.getAttribute('data-ray'))).toEqual([
      'right',
      'down',
      'left',
      'up',
      'up-right',
      'down-right',
      'down-left',
      'up-left',
    ])
    expect(parts('ribbons')).toHaveLength(1)
    expect(parts('burst-core')).toHaveLength(1)
    expect(parts('dot')).toHaveLength(CELEBRATION.dots.length)
    expect(parts('sparkle')).toHaveLength(CELEBRATION_SPARKLES.length)
    expect(parts('blotches')).toHaveLength(1)
    expect(parts('star-glow')).toHaveLength(1)
    expect(parts('fill')).toHaveLength(1)
    expect(parts('inner')).toHaveLength(1)
    expect(parts('outer')).toHaveLength(1)
  })

  it("paints in A0's order: the star with its ribbons, the dots and sparkles, the starburst", () => {
    render(() => <CelebrationStar layout={LAYOUT} still />)
    const order = [
      ...screen.getByTestId('echo-celebration').querySelectorAll('[data-part]'),
    ].map((el) => el.getAttribute('data-part'))
    const runs = order.filter((part, i) => part !== order[i - 1])

    expect(runs).toEqual([
      'star-glow',
      'ribbons',
      'fill',
      'inner',
      'blotches',
      'outer',
      'dot',
      'sparkle',
      'mist',
      'burst-glow',
      'ray',
      'burst-core',
    ])
  })

  it('keeps the right ray short and the diagonal ones faint and short', () => {
    render(() => <CelebrationStar layout={LAYOUT} still />)
    const ray = (name: string) =>
      parts('ray').find(
        (el) => el.getAttribute('data-ray') === name,
      ) as HTMLElement
    const { lengthW, diagonal } = CELEBRATION.burst.rays

    expect(Number.parseFloat(ray('right').style.width)).toBeCloseTo(
      lengthW.right * LAYOUT.unit,
      1,
    )
    expect(Number.parseFloat(ray('up-left').style.width)).toBeCloseTo(
      diagonal.lengthW * LAYOUT.unit,
      1,
    )
    expect(Number(ray('up-left').style.opacity)).toBe(diagonal.alpha)
    expect(ray('up-left').style.transform).toBe('rotate(-135deg)')
  })

  it("lumps the inner outline by the spec's factors", () => {
    render(() => <CelebrationStar layout={LAYOUT} still />)
    const { inner } = CELEBRATION.star

    // The top tip: factor 0, against the regular tip radius (A0 scales the
    // regular star for the inner outline, not the lopsided one).
    expect(Math.hypot(...cornerOf('inner', 0)) / TIP).toBeCloseTo(
      inner.scale * inner.wobbleCcw[0],
      2,
    )
    expect(Number(parts('inner')[0].getAttribute('stroke-opacity'))).toBe(
      inner.alpha,
    )
  })

  it('makes the outer outline lopsided: each corner scaled and turned by the spec', () => {
    render(() => <CelebrationStar layout={LAYOUT} still />)
    const { outer } = CELEBRATION.star
    // Path corner i (clockwise from the top tip) is the spec's entry
    // (10 - i) % 10 (counter-clockwise from it).
    for (const i of [0, 3, 7]) {
      const ccw = (10 - i) % 10
      const [x, y] = cornerOf('outer', i)
      const regular = i % 2 === 0 ? TIP : TIP * outer.valleyOverTip
      const turn = 90 - 36 * i + outer.lopsided.turnCcwDeg[ccw]

      expect(Math.hypot(x, y)).toBeCloseTo(
        regular * outer.lopsided.radiusCcw[ccw],
        1,
      )
      expect(((Math.atan2(-y, x) * 180) / Math.PI + 360) % 360).toBeCloseTo(
        (turn + 360) % 360,
        0,
      )
    }
    // The fill is the same lopsided shape.
    expect(parts('fill')[0].getAttribute('d')).toBe(
      parts('outer')[0].getAttribute('d'),
    )
  })

  it('lays blue blotches inside the star, clipped to its outline', () => {
    render(() => <CelebrationStar layout={LAYOUT} still />)
    const group = parts('blotches')[0]
    const clipId = /url\(#(.+)\)/u.exec(
      group.getAttribute('clip-path') ?? '',
    )?.[1]
    const clip = group.closest('svg')?.querySelector(`[id="${clipId}"] path`)
    const circles = [...group.querySelectorAll('circle')]

    expect(clip?.getAttribute('d')).toBe(parts('fill')[0].getAttribute('d'))
    expect(circles).toHaveLength(CELEBRATION.star.blotches.length)
    CELEBRATION.star.blotches.forEach((b, i) => {
      expect(Number(circles[i].getAttribute('cx'))).toBeCloseTo(
        b.centreR[0] * TIP,
        3,
      )
      expect(Number(circles[i].getAttribute('cy'))).toBeCloseTo(
        b.centreR[1] * TIP,
        3,
      )
      expect(Number(circles[i].getAttribute('r'))).toBeCloseTo(
        3 * b.sigmaR * TIP,
        3,
      )
    })
  })

  it('gives each dot its own core brightness', () => {
    render(() => <CelebrationStar layout={LAYOUT} still />)
    const dim = CELEBRATION.dots.findIndex((d) => d.coreAlpha < 1)
    const dot = CELEBRATION.dots[dim]

    expect(dim).toBeGreaterThanOrEqual(0)
    expect(centreAlpha(parts('dot')[dim])).toBeCloseTo(
      1 - (1 - dot.glowAlpha) * (1 - dot.coreAlpha),
      3,
    )
  })

  it('centres the mist above the starburst, thinned toward the right', () => {
    render(() => <CelebrationStar layout={LAYOUT} still />)
    const mist = parts('mist')[0] as HTMLElement
    const core = parts('burst-core')[0] as HTMLElement
    const centre = (el: HTMLElement) => [
      Number.parseFloat(el.style.left) + Number.parseFloat(el.style.width) / 2,
      Number.parseFloat(el.style.top) + Number.parseFloat(el.style.height) / 2,
    ]
    const [mx, my] = centre(mist)
    const [bx, by] = centre(core)

    expect(mx).toBeCloseTo(bx, 1)
    expect(my - by).toBeCloseTo(
      CELEBRATION.burst.mist.offsetW[1] * LAYOUT.unit,
      1,
    )
    expect(mist.style.getPropertyValue('mask-image')).toContain(
      'conic-gradient',
    )
  })

  it('puts the star on the plate where the spec does, its outline as wide', () => {
    render(() => <CelebrationStar layout={LAYOUT} still />)
    const outer = parts('outer')[0]

    expect(Number(outer.getAttribute('stroke-width'))).toBeCloseTo(
      CELEBRATION.star.outer.strokeW * LAYOUT.unit,
      6,
    )
    const svg = outer.closest('svg') as SVGSVGElement
    const box = Number(svg.getAttribute('width')) / 2
    const left = Number.parseFloat(svg.style.left)
    expect(left + box).toBeCloseTo(
      LAYOUT.column.left + CELEBRATION.star.u * LAYOUT.unit,
      1,
    )
  })

  it('stands still in a fixture: nothing animates', () => {
    render(() => <CelebrationStar layout={LAYOUT} still />)

    expect(played).toEqual([])
    expect(frames).toEqual([])
    // The ribbons stand whole, at their alpha times the brightest link's gain.
    const most = Math.max(
      ...CELEBRATION.ribbons.map((r) => r.alpha * Math.max(...r.segmentGain)),
    )
    expect(ribbonPeak()).toBeGreaterThan(0.6 * most * 255)
    expect(ribbonPeak()).toBeLessThanOrEqual(Math.ceil(most * 255))
  })

  it('stands at its end state with reduced motion', () => {
    motion.reduced = true
    render(() => <CelebrationStar layout={LAYOUT} still={false} />)

    expect(played).toEqual([])
    expect(frames).toEqual([])
    // The resting outlines are whole: no dash offset left on them.
    expect(parts('outer')[0].getAttribute('stroke-dashoffset')).toBeNull()
  })

  it('pops the starburst, then the dots nearest it first, then draws the star', () => {
    render(() => <CelebrationStar layout={LAYOUT} still={false} />)
    const { star, dots } = CELEBRATION.timing

    expect(playedFor('burst-core')[0].frames.map((f) => f.transform)).toEqual([
      'scale(0)',
      'scale(1.25)',
      'scale(1)',
    ])
    const reveals = playedFor('dot')
      .filter((p) => p.options.iterations === undefined)
      .map((p) => p.options.delay)
    expect(reveals).toHaveLength(CELEBRATION.dots.length)
    expect(reveals[0]).toBe(dots.firstMs)
    expect(
      reveals.every((d, i) => i === 0 || (d ?? 0) > (reveals[i - 1] ?? 0)),
    ).toBe(true)

    const outline = playedFor('outer')[0]
    expect(outline.frames).toEqual([
      { strokeDashoffset: '1' },
      { strokeDashoffset: '0' },
    ])
    expect(outline.options.delay).toBe(star.outer[0])
    expect(outline.options.duration).toBe(star.outer[1] - star.outer[0])
    expect(playedFor('inner')[0].options.delay).toBe(star.inner[0])
    // The blotches come up with the fill.
    expect(playedFor('blotches')[0].options.delay).toBe(star.fill[0])
  })

  it('reveals each sparkle a beat after the dot it follows', () => {
    render(() => <CelebrationStar layout={LAYOUT} still={false} />)
    const { dots, sparkles } = CELEBRATION.timing
    const reveals = playedFor('sparkle').filter(
      (p) => p.options.iterations === undefined,
    )

    expect(reveals).toHaveLength(CELEBRATION_SPARKLES.length)
    reveals.forEach((p, i) => {
      expect(p.options.delay).toBe(
        dots.firstMs +
          CELEBRATION_SPARKLES[i].afterRank * dots.staggerMs +
          sparkles.delayMs,
      )
      expect(p.options.duration).toBe(sparkles.durationMs)
    })
    expect(reveals[0].frames[0]).toEqual({
      opacity: 0,
      transform: `scale(${sparkles.fromScale})`,
    })
  })

  it('swells the mist as the starburst pops, and starts the ribbons', () => {
    render(() => <CelebrationStar layout={LAYOUT} still={false} />)
    const mist = playedFor('mist')

    expect(mist).toHaveLength(1)
    expect(mist[0].frames).toEqual([
      { offset: 0, opacity: 0, transform: 'scale(0.7)' },
      { offset: 1, opacity: 1, transform: 'scale(1)' },
    ])
    expect(mist[0].options.duration).toBe(380)
    // The ribbons start undrawn and are repainted on animation frames.
    expect(ribbonPeak()).toBe(0)
    expect(frames.length).toBeGreaterThan(0)
  })

  it('keeps twinkling, breathing and shimmering once it is drawn', () => {
    render(() => <CelebrationStar layout={LAYOUT} still={false} />)
    const idle = played.filter((p) => p.options.iterations === Infinity)

    expect(idle.filter((p) => p.part === 'dot')).toHaveLength(
      CELEBRATION.dots.length,
    )
    const sparkleTwinkles = idle.filter((p) => p.part === 'sparkle')
    expect(sparkleTwinkles).toHaveLength(CELEBRATION_SPARKLES.length)
    expect(sparkleTwinkles[0].frames).toEqual([
      { opacity: CELEBRATION.timing.sparkles.idleOpacity[1] },
      { opacity: CELEBRATION.timing.sparkles.idleOpacity[0] },
    ])
    expect(idle.filter((p) => p.part === 'star-glow')).toHaveLength(1)
    expect(idle.filter((p) => p.part === 'ray')).toHaveLength(8)
    expect(
      idle.every(
        (p) => (p.options.delay ?? 0) >= CELEBRATION.timing.idleFromMs,
      ),
    ).toBe(true)
  })
})
