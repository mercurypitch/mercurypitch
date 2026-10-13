// ============================================================
// CelebrationStar: the round 3 star, drawn and set in motion from its spec
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

beforeEach(() => {
  motion.reduced = false
  played = []
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
  it('draws the starburst, the 33 dots and the hollow star', () => {
    render(() => <CelebrationStar layout={LAYOUT} still />)

    expect(parts('burst-glow')).toHaveLength(1)
    expect(parts('ray').map((ray) => ray.getAttribute('data-ray'))).toEqual([
      'right',
      'down',
      'left',
      'up',
    ])
    expect(parts('burst-core')).toHaveLength(1)
    expect(parts('dot')).toHaveLength(CELEBRATION.dots.length)
    expect(parts('star-glow')).toHaveLength(1)
    expect(parts('fill')).toHaveLength(1)
    expect(parts('inner')).toHaveLength(1)
    expect(parts('outer')).toHaveLength(1)
  })

  it("paints in A0's order: the star, then the dots, then the starburst", () => {
    render(() => <CelebrationStar layout={LAYOUT} still />)
    const order = [
      ...screen.getByTestId('echo-celebration').querySelectorAll('[data-part]'),
    ].map((el) => el.getAttribute('data-part'))
    const runs = order.filter((part, i) => part !== order[i - 1])

    expect(runs).toEqual([
      'star-glow',
      'fill',
      'inner',
      'outer',
      'dot',
      'burst-glow',
      'ray',
      'burst-core',
    ])
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
  })

  it('stands at its end state with reduced motion', () => {
    motion.reduced = true
    render(() => <CelebrationStar layout={LAYOUT} still={false} />)

    expect(played).toEqual([])
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

  it('keeps twinkling, breathing and shimmering once it is drawn', () => {
    render(() => <CelebrationStar layout={LAYOUT} still={false} />)
    const idle = played.filter((p) => p.options.iterations === Infinity)

    expect(idle.filter((p) => p.part === 'dot')).toHaveLength(
      CELEBRATION.dots.length,
    )
    expect(idle.filter((p) => p.part === 'star-glow')).toHaveLength(1)
    expect(idle.filter((p) => p.part === 'ray')).toHaveLength(4)
    expect(
      idle.every(
        (p) => (p.options.delay ?? 0) >= CELEBRATION.timing.idleFromMs,
      ),
    ).toBe(true)
  })
})
