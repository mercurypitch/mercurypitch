// ============================================================
// CelebrationStar: the round 4 star, drawn and set in motion from its spec
// ============================================================

import { cleanup, render, screen } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CelebrationStar } from './CelebrationStar'
import { CELEBRATION } from './echo-geometry'
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
    expect(parts('star-glow')).toHaveLength(1)
    expect(parts('fill')).toHaveLength(1)
    expect(parts('inner')).toHaveLength(1)
    expect(parts('outer')).toHaveLength(1)
  })

  it("paints in A0's order: the star with its ribbons, the dots, the starburst", () => {
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
      'outer',
      'dot',
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
    const corner = (part: string, i: number) => {
      const d = parts(part)[0].getAttribute('d') ?? ''
      const [x, y] = d
        .replace(/[MLZ]/gu, ' ')
        .trim()
        .split(/\s+/u)
        .map(Number)
        .slice(2 * i, 2 * i + 2)
      return Math.hypot(x, y)
    }
    const { inner } = CELEBRATION.star

    // The top tip: factor 0, against the outer outline's tip.
    expect(corner('inner', 0) / corner('outer', 0)).toBeCloseTo(
      inner.scale * inner.wobbleCcw[0],
      2,
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
    // The ribbons stand whole, at their alpha (0.3 at most).
    expect(ribbonPeak()).toBeGreaterThan(0.2 * 255)
    expect(ribbonPeak()).toBeLessThanOrEqual(Math.ceil(0.3 * 255))
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
    expect(idle.filter((p) => p.part === 'star-glow')).toHaveLength(1)
    expect(idle.filter((p) => p.part === 'ray')).toHaveLength(8)
    expect(
      idle.every(
        (p) => (p.options.delay ?? 0) >= CELEBRATION.timing.idleFromMs,
      ),
    ).toBe(true)
  })
})
