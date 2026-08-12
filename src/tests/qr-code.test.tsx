// A QR that does not scan is worse than no QR: the person is standing in
// front of a TV holding a phone up at it. These check the properties a
// camera actually depends on -- a quiet zone, hard module edges, fixed
// contrast -- rather than that the component rendered something.

import { render } from '@solidjs/testing-library'
import { describe, expect, it } from 'vitest'
import { QrCode } from '@/components/QrCode'

describe('QrCode', () => {
  it('encodes what it was given, with a quiet zone around it', () => {
    const { container } = render(() => (
      <QrCode value="https://mercurypitch.com/#/sync:ABCD2345" />
    ))
    const svg = container.querySelector('svg')
    expect(svg).not.toBeNull()

    const size = Number(svg?.getAttribute('viewBox')?.split(' ')[3])
    expect(size).toBeGreaterThan(20)

    // The border is not decoration: a scanner finds a code by its edge,
    // and a QR flush against a dark panel is one many phones never see.
    // Four clear modules on each side is the spec's number.
    const path = container.querySelector('path')?.getAttribute('d') ?? ''
    const modules = [...path.matchAll(/M(\d+) (\d+)h1v1h-1z/g)].map((m) => ({
      x: Number(m[1]),
      y: Number(m[2]),
    }))
    expect(modules.length).toBeGreaterThan(0)
    expect(Math.min(...modules.map((m) => m.x))).toBeGreaterThanOrEqual(4)
    expect(Math.min(...modules.map((m) => m.y))).toBeGreaterThanOrEqual(4)
    expect(Math.max(...modules.map((m) => m.x))).toBeLessThanOrEqual(size - 5)
    expect(Math.max(...modules.map((m) => m.y))).toBeLessThanOrEqual(size - 5)
  })

  it('keeps camera contrast fixed rather than following the theme', () => {
    const { container } = render(() => <QrCode value="x" />)
    // A themed QR is a QR that fails in a dim living room, which is
    // precisely where a TV is.
    expect(container.querySelector('rect')?.getAttribute('fill')).toBe(
      '#ffffff',
    )
    expect(container.querySelector('path')?.getAttribute('fill')).toBe(
      '#000000',
    )
    expect(
      container.querySelector('svg')?.getAttribute('shape-rendering'),
    ).toBe('crispEdges')
  })

  it('draws every module in one element', () => {
    const { container } = render(() => (
      <QrCode value="https://mercurypitch.com/#/link:ZZZZ9999" />
    ))
    // Several hundred rects is a visible pause on a TV browser, and this
    // renders while somebody is waiting to scan it.
    expect(container.querySelectorAll('path')).toHaveLength(1)
    expect(container.querySelectorAll('rect')).toHaveLength(1)
  })

  it('re-encodes when the code changes', () => {
    const first = render(() => <QrCode value="AAAA1111" />)
    const second = render(() => <QrCode value="BBBB2222" />)
    expect(first.container.querySelector('path')?.getAttribute('d')).not.toBe(
      second.container.querySelector('path')?.getAttribute('d'),
    )
  })
})
