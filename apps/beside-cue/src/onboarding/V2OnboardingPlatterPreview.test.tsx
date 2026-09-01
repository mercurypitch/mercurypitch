// ============================================================
// V2OnboardingPlatterPreview tests — one clock, one correlated stop
// ============================================================

import { render } from '@solidjs/testing-library'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import sharp from 'sharp'
import { createSignal } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { V2OnboardingStillResource } from './v2-onboarding-media-presenter'
import type { V2OnboardingPlatterPhase } from './V2OnboardingPlatterPreview'
import { V2OnboardingPlatterPreview } from './V2OnboardingPlatterPreview'

const BASE: V2OnboardingStillResource = {
  kind: 'still',
  src: '/onboarding/corky-v2.4/stills/p02-table-ready-v0_17.webp',
  alt: 'Corky beside the record player',
}

const P02_AUTHORITY_PATH = resolve(
  process.cwd(),
  'public/onboarding/corky-v2.4/stills/p02-table-ready-v0_17.webp',
)

interface RecordPlaneGeometry {
  readonly centerX: number
  readonly centerY: number
  readonly radius: number
  readonly yScale: number
}

type FrameCallback = (timestamp: number) => void

let nextFrameHandle = 0
let frameCallbacks = new Map<number, FrameCallback>()
const cancelledFrames = vi.fn<(handle: number) => void>()

function paintNextFrame(timestamp: number): void {
  const pending = [...frameCallbacks.entries()]
  frameCallbacks = new Map()
  if (pending.length !== 1) {
    throw new RangeError(
      `Expected one animation frame, received ${String(pending.length)}.`,
    )
  }
  pending[0]?.[1](timestamp)
}

function platter(): HTMLElement {
  // The preview is intentionally decorative; the data contract exposes its
  // phase without inventing an interactive or duplicate image role.
  const element = document.querySelector<HTMLElement>(
    '[data-v2-platter-preview]',
  )
  if (element === null) throw new TypeError('Expected the platter preview.')
  return element
}

function motionSvg(): SVGSVGElement {
  const element = platter().querySelector<SVGSVGElement>('svg[data-visible]')
  if (element === null) throw new TypeError('Expected the platter motion SVG.')
  return element
}

function recordTexture(element: SVGSVGElement): SVGImageElement | undefined {
  return [...element.querySelectorAll<SVGImageElement>('image')].find(
    (image) =>
      image.parentElement?.getAttribute('transform')?.startsWith('rotate(') ===
      true,
  )
}

function recordPlaneGeometry(element: SVGSVGElement): RecordPlaneGeometry {
  const texture = recordTexture(element)
  const plane = texture?.parentElement?.parentElement?.parentElement
  const planeTransform = plane?.getAttribute('transform') ?? ''
  const planeMatch =
    /^translate\(([-\d.]+) ([-\d.]+)\) scale\(1 ([-\d.]+)\)$/.exec(
      planeTransform,
    )
  const boundary = element.querySelector<SVGCircleElement>(
    'defs > mask circle, defs > clipPath circle:not([cx])',
  )

  if (planeMatch === null || boundary === null) {
    throw new TypeError('Expected the authored record plane geometry.')
  }

  return {
    centerX: Number(planeMatch[1]),
    centerY: Number(planeMatch[2]),
    radius: Number(boundary.getAttribute('r')),
    yScale: Number(planeMatch[3]),
  }
}

async function countCreamTabletopPixels(
  element: SVGSVGElement,
  authorityBytes: Buffer,
): Promise<{
  readonly paintedPixels: number
  readonly tabletopPixels: number
}> {
  const clone = element.cloneNode(true) as SVGSVGElement
  const texture = recordTexture(clone)
  if (texture === undefined) {
    throw new TypeError('Expected the authored record texture.')
  }

  for (const image of clone.querySelectorAll('image')) {
    if (image !== texture) image.remove()
  }
  texture.setAttribute(
    'href',
    `data:image/png;base64,${authorityBytes.toString('base64')}`,
  )
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  clone.setAttribute('width', '720')
  clone.setAttribute('height', '1280')

  const { data, info } = await sharp(Buffer.from(clone.outerHTML))
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  const geometry = recordPlaneGeometry(element)
  const minX = Math.floor(geometry.centerX - geometry.radius)
  const maxX = Math.ceil(geometry.centerX + geometry.radius)
  const minY = Math.floor(geometry.centerY - geometry.radius * geometry.yScale)
  const maxY = Math.ceil(geometry.centerY + geometry.radius * geometry.yScale)
  let paintedPixels = 0
  let tabletopPixels = 0

  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const planeRadius = Math.hypot(
        x - geometry.centerX,
        (y - geometry.centerY) / geometry.yScale,
      )
      // The label and spindle legitimately contain pale pixels. The reported
      // regression is the cream plate leaking into the outer vinyl surface.
      if (planeRadius < 40 || planeRadius > geometry.radius) continue

      const offset = (y * info.width + x) * info.channels
      const red = data[offset] ?? 0
      const green = data[offset + 1] ?? 0
      const blue = data[offset + 2] ?? 0
      const alpha = data[offset + 3] ?? 0
      if (alpha >= 64) paintedPixels += 1
      if (alpha >= 64 && red >= 170 && green >= 140 && blue >= 90) {
        tabletopPixels += 1
      }
    }
  }

  return { paintedPixels, tabletopPixels }
}

beforeEach(() => {
  nextFrameHandle = 0
  frameCallbacks = new Map()
  cancelledFrames.mockClear()

  vi.stubGlobal(
    'requestAnimationFrame',
    vi.fn((callback: FrameCallback) => {
      nextFrameHandle += 1
      frameCallbacks.set(nextFrameHandle, callback)
      return nextFrameHandle
    }),
  )
  vi.stubGlobal(
    'cancelAnimationFrame',
    vi.fn((handle: number) => {
      cancelledFrames(handle)
      frameCallbacks.delete(handle)
    }),
  )
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('V2OnboardingPlatterPreview', () => {
  it('carries the current rigid-spin angle into one correlated deceleration', () => {
    // Arrange
    const [phase, setPhase] = createSignal<V2OnboardingPlatterPhase>('spinning')
    const onStopped = vi.fn<(token: string) => void>()
    render(() => (
      <V2OnboardingPlatterPreview
        base={BASE}
        phase={phase()}
        token="stop-7"
        foreground={true}
        reducedMotion={false}
        onStopped={onStopped}
      />
    ))
    paintNextFrame(0)
    paintNextFrame(1_000)
    const spinningAngle = Number(platter().dataset.platterAngleRad)

    // Act
    setPhase('stopping')
    paintNextFrame(2_000)
    const deceleratingAngle = Number(platter().dataset.platterAngleRad)
    paintNextFrame(3_000)

    // Assert
    expect(spinningAngle).toBeCloseTo(Math.PI, 12)
    expect(deceleratingAngle).toBeGreaterThan(spinningAngle)
    expect(deceleratingAngle).toBeLessThan(2 * Math.PI)
    expect(Number(platter().dataset.platterAngleRad)).toBeCloseTo(
      2 * Math.PI,
      12,
    )
    expect(platter()).toHaveAttribute('data-platter-overlay', 'hidden')
    expect(onStopped).toHaveBeenCalledTimes(1)
    expect(onStopped).toHaveBeenCalledWith('stop-7')
    expect(frameCallbacks.size).toBe(0)
  })

  it('excludes background time from the mounted spin clock', () => {
    // Arrange
    const [foreground, setForeground] = createSignal(true)
    render(() => (
      <V2OnboardingPlatterPreview
        base={BASE}
        phase="spinning"
        token="spin"
        foreground={foreground()}
        reducedMotion={false}
        onStopped={() => undefined}
      />
    ))
    paintNextFrame(0)
    paintNextFrame(1_000)
    const beforeBackground = Number(platter().dataset.platterAngleRad)

    // Act
    setForeground(false)
    setForeground(true)
    paintNextFrame(8_000)
    const resumedBaseline = Number(platter().dataset.platterAngleRad)
    paintNextFrame(9_000)

    // Assert
    expect(cancelledFrames).toHaveBeenCalledTimes(1)
    expect(beforeBackground).toBeCloseTo(Math.PI, 12)
    expect(resumedBaseline).toBeCloseTo(beforeBackground, 12)
    expect(Number(platter().dataset.platterAngleRad)).toBeCloseTo(
      2 * Math.PI,
      12,
    )
  })

  it('completes reduced-motion stops immediately once per token without media', () => {
    // Arrange
    const [token, setToken] = createSignal('reduced-1')
    const [foreground, setForeground] = createSignal(false)
    const onStopped = vi.fn<(token: string) => void>()
    render(() => (
      <V2OnboardingPlatterPreview
        phase="stopping"
        token={token()}
        foreground={foreground()}
        reducedMotion={true}
        onStopped={onStopped}
      />
    ))

    // Act
    setForeground(true)
    setForeground(false)
    setToken('reduced-2')

    // Assert
    expect(onStopped.mock.calls).toEqual([['reduced-1'], ['reduced-2']])
    expect(platter()).toHaveAttribute('data-platter-source', 'native')
    expect(platter()).toHaveAttribute('data-platter-overlay', 'hidden')
    expect(platter()).toHaveAttribute('data-platter-angle-rad', '0')
    expect(frameCallbacks.size).toBe(0)
    expect(document.querySelector('img')).not.toBeInTheDocument()
  })

  it('reacts to a replacement stopped authority without introducing another asset', () => {
    // Arrange
    const [base, setBase] = createSignal<V2OnboardingStillResource>(BASE)
    render(() => (
      <V2OnboardingPlatterPreview
        base={base()}
        phase="stopped"
        token="still"
        foreground={true}
        reducedMotion={false}
        onStopped={() => undefined}
      />
    ))
    const replacement: V2OnboardingStillResource = {
      kind: 'still',
      src: '/p02-promoted.webp',
      alt: 'Promoted stopped authority',
    }

    // Act
    setBase(replacement)

    // Assert
    expect(document.querySelector('img')).toHaveAttribute(
      'src',
      '/p02-promoted.webp',
    )
    expect(document.querySelector('img')).toHaveAttribute(
      'alt',
      'Promoted stopped authority',
    )
    expect(
      document.querySelectorAll('svg image[href="/p02-promoted.webp"]'),
    ).toHaveLength(3)
    expect(platter()).toHaveAttribute('data-platter-source', 'authored')
  })

  it('feathers the moving surface inside the static vinyl and holdouts', () => {
    // Arrange
    render(() => (
      <V2OnboardingPlatterPreview
        base={BASE}
        phase="spinning"
        token="feather"
        foreground={true}
        reducedMotion={false}
        onStopped={() => undefined}
      />
    ))
    const svg = motionSvg()

    // Act
    const mask = svg.querySelector<SVGMaskElement>(
      '[data-v2-record-motion-mask]',
    )
    const gradient =
      svg.querySelector<SVGRadialGradientElement>('radialGradient')
    const maskedGroup = [...svg.querySelectorAll<SVGGElement>('g')].find(
      (group) => group.getAttribute('mask') === `url(#${mask?.id ?? ''})`,
    )

    // Assert
    expect(mask).toHaveAttribute('mask-type', 'alpha')
    expect(mask).toHaveAttribute('data-record-motion-radius', '80')
    expect(mask).toHaveAttribute('data-record-motion-feather', '2')
    expect(mask?.querySelector('circle')).toHaveAttribute('r', '80')
    expect(
      [...(gradient?.querySelectorAll('stop') ?? [])].map((stop) => [
        stop.getAttribute('offset'),
        stop.getAttribute('stop-opacity'),
      ]),
    ).toEqual([
      ['0.975', '1'],
      ['1', '0'],
    ])
    expect(maskedGroup).toContainElement(recordTexture(svg) ?? null)
    expect(svg.querySelectorAll('clipPath')).toHaveLength(2)
    expect(svg.querySelectorAll('image')).toHaveLength(3)
  })

  it('never samples cream tabletop into the authored record surface at key spin angles', async () => {
    // Arrange
    const authorityBytes = await sharp(await readFile(P02_AUTHORITY_PATH))
      .png()
      .toBuffer()
    render(() => (
      <V2OnboardingPlatterPreview
        base={BASE}
        phase="spinning"
        token="no-rim"
        foreground={true}
        reducedMotion={false}
        onStopped={() => undefined}
      />
    ))
    paintNextFrame(0)
    const samples: Array<readonly [number, number]> = []

    // Act
    for (const [angleDegrees, timestamp] of [
      [0, undefined],
      [60, 1_000 / 3],
      [90, 500],
    ] as const) {
      if (timestamp !== undefined) paintNextFrame(timestamp)
      expect(Number(platter().dataset.platterAngleRad)).toBeCloseTo(
        (angleDegrees * Math.PI) / 180,
        10,
      )
      const sample = await countCreamTabletopPixels(motionSvg(), authorityBytes)
      expect(sample.paintedPixels).toBeGreaterThan(4_000)
      samples.push([angleDegrees, sample.tabletopPixels])
    }

    // Assert
    expect(samples).toEqual([
      [0, 0],
      [60, 0],
      [90, 0],
    ])
  })

  it('cancels its pending frame when the mounted preview leaves the tree', () => {
    // Arrange
    const result = render(() => (
      <V2OnboardingPlatterPreview
        base={BASE}
        phase="spinning"
        token="unmount"
        foreground={true}
        reducedMotion={false}
        onStopped={() => undefined}
      />
    ))

    // Act
    result.unmount()

    // Assert
    expect(cancelledFrames).toHaveBeenCalledTimes(1)
    expect(frameCallbacks.size).toBe(0)
  })
})
