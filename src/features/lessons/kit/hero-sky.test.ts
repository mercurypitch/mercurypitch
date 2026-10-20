// ============================================================
// Hero sky tests — the still sky: every star once, at rest, and again on a resize
// ============================================================

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import './browser-doubles.test-fixtures'
import { makeStars, stillSky } from './hero-sky'

/** The stars' fills as a canvas saw them, one per star drawn. */
let fills: string[] = []
/** The resize callbacks a page started, and what each watches. */
let resized: (() => void)[] = []
let watched: Element[] = []

function recordingContext(): CanvasRenderingContext2D {
  const ctx: Record<string, unknown> = {}
  return new Proxy(ctx, {
    get: (target, k) =>
      k in target ? target[k as string] : (): undefined => undefined,
    set: (target, k, v: unknown) => {
      if (k === 'fillStyle') fills.push(String(v))
      target[k as string] = v
      return true
    },
  }) as unknown as CanvasRenderingContext2D
}

function stage(): HTMLElement {
  const el = document.createElement('div')
  el.innerHTML = '<canvas class="sky"></canvas>'
  document.body.appendChild(el)
  return el
}

beforeEach(() => {
  fills = []
  resized = []
  watched = []
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
    recordingContext as unknown as HTMLCanvasElement['getContext'],
  )
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(cb: () => void) {
        resized.push(cb)
      }
      observe(el: Element): void {
        watched.push(el)
      }
      unobserve(): void {}
      disconnect(): void {}
    },
  )
})

// the doubles' globals stay stubbed: the kit read them as it loaded
afterEach(() => {
  vi.restoreAllMocks()
  document.body.textContent = ''
})

describe('stillSky', () => {
  it('draws every star once as it mounts, each at its own brightness, with no twinkle', () => {
    // Arrange
    const still = makeStars().map(
      (s) => `rgba(214,224,240,${(s.a * 0.75).toFixed(3)})`,
    )
    const el = stage()

    // Act
    stillSky(el)

    // Assert
    expect(fills).toEqual(still)
  })

  it('draws the same sky again when its stage changes size', () => {
    // Arrange
    const el = stage()
    stillSky(el)
    const first = [...fills]

    // Act
    for (const cb of resized) cb()

    // Assert
    expect(watched).toEqual([el])
    expect(fills).toEqual([...first, ...first])
  })
})
