// ============================================================
// The cliffs: a painting when the app carries one, the drawing until then
// ============================================================

import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import { afterEach, describe, expect, it } from 'vitest'
import { columnBoxes, layoutCliffs } from './cliff-layout'
import type { CliffArt } from './CliffScene'
import { CLIFF_ART, CliffScene } from './CliffScene'

const layout = layoutCliffs(390, 844, { from: 55, to: 62 }, 0.81)

function scene(art?: CliffArt | null) {
  return render(() => (
    <CliffScene
      layout={layout}
      bandHalf={12}
      fromName="G3"
      toName={null}
      live
      turn={false}
      onFrom={false}
      warm={false}
      lit={false}
      answering={false}
      trailRef={() => undefined}
      art={art}
    />
  ))
}

const root = (): HTMLElement => screen.getByTestId('leap-scene')
const load = (testId: string): void => {
  fireEvent.load(screen.getByTestId(testId))
}

afterEach(() => {
  cleanup()
})

describe('the cliffs', () => {
  it('asks for the valley, upright and on its side, pinned at its moon', () => {
    scene()
    const img = screen.getByTestId('leap-painting') as HTMLImageElement
    expect(img.getAttribute('src')).toBe(CLIFF_ART.plates.portrait)
    expect(CLIFF_ART.plates.portrait).toMatch(/cliffs-portrait\.webp$/u)
    const source = img.parentElement?.querySelector('source')
    expect(source?.getAttribute('srcset')).toBe(CLIFF_ART.plates.landscape)
    expect(CLIFF_ART.plates.landscape).toMatch(/cliffs-landscape\.webp$/u)
    expect(source?.getAttribute('media')).toBe('(orientation: landscape)')
    expect(img.style.objectPosition).toBe('76% 21%')
  })

  it('stands each painted column on its ledge, from the room edge to its cliff edge', () => {
    scene()
    const boxes = columnBoxes(layout)
    for (const [testId, box] of [
      ['leap-column-near', boxes.near],
      ['leap-column-far', boxes.far],
    ] as const) {
      const column = screen.getByTestId(testId)
      expect(Number(column.getAttribute('x'))).toBeCloseTo(box.x)
      expect(Number(column.getAttribute('y'))).toBeCloseTo(box.y)
      expect(Number(column.getAttribute('width'))).toBeCloseTo(box.width)
      expect(Number(column.getAttribute('height'))).toBeCloseTo(box.height)
    }
    expect(screen.getByTestId('leap-column-near').getAttribute('href')).toBe(
      CLIFF_ART.near,
    )
    expect(screen.getByTestId('leap-column-far').getAttribute('href')).toBe(
      CLIFF_ART.far,
    )
    // In the groups the ledges move in, with the lantern on the far one.
    const far = screen.getByTestId('leap-column-far').closest('g')
    expect(far?.querySelector('[data-testid="leap-lantern"]')).toBeTruthy()
    expect(far?.getAttribute('style')).toContain(
      `translateY(${layout.toY.toFixed(1)}px)`,
    )
  })

  it('keeps the drawing until the valley and both columns have loaded', () => {
    scene()
    expect(root().dataset.art).toBe('drawing')
    load('leap-painting')
    load('leap-column-near')
    expect(root().dataset.art).toBe('drawing')
    load('leap-column-far')
    expect(root().dataset.art).toBe('painting')
    // The exercise is drawn over the painting all the same.
    expect(screen.getByTestId('leap-from-line')).toBeTruthy()
    expect(screen.getByTestId('leap-target-line')).toBeTruthy()
    expect(screen.getByTestId('leap-lantern')).toBeTruthy()
  })

  it('keeps the drawing when a part of the painting will not load', () => {
    scene()
    load('leap-painting')
    load('leap-column-far')
    fireEvent.error(screen.getByTestId('leap-column-near'))
    expect(root().dataset.art).toBe('drawing')
    expect(screen.getByTestId('leap-lantern')).toBeTruthy()
  })

  it('draws alone when asked for no painting', () => {
    scene(null)
    expect(screen.queryByTestId('leap-painting')).toBeNull()
    expect(screen.queryByTestId('leap-column-near')).toBeNull()
    expect(root().dataset.art).toBe('drawing')
    expect(screen.getByTestId('leap-lantern')).toBeTruthy()
  })
})
