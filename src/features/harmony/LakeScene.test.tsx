// ============================================================
// The lake: a painting when the app carries one, the drawing until then
// ============================================================

import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import { afterEach, describe, expect, it } from 'vitest'
import { jettyBox, layoutLake, restingLines } from './lake-layout'
import type { LakeArt } from './LakeScene'
import { LAKE_ART, LakeScene } from './LakeScene'

const lines = restingLines(4)
const layout = layoutLake(390, 844, lines, 0.81)

function scene(art?: LakeArt | null, away = false) {
  return render(() => (
    <LakeScene
      layout={layout}
      merc={lines.merc}
      harmony={lines.harmony}
      mercLit={0}
      lamps={[]}
      showsHarmony
      live={false}
      turn={false}
      answering={null}
      away={away}
      trailRef={() => undefined}
      art={art}
    />
  ))
}

const root = (): HTMLElement => screen.getByTestId('harmony-scene')
const load = (testId: string): void => {
  fireEvent.load(screen.getByTestId(testId))
}

afterEach(() => {
  cleanup()
})

describe('the lake', () => {
  it('asks for the lake, upright and on its side, pinned at its shore', () => {
    scene()
    const img = screen.getByTestId('harmony-painting') as HTMLImageElement
    expect(img.getAttribute('src')).toBe(LAKE_ART.plates.portrait)
    expect(LAKE_ART.plates.portrait).toMatch(/lake-portrait\.webp$/u)
    const source = img.parentElement?.querySelector('source')
    expect(source?.getAttribute('srcset')).toBe(LAKE_ART.plates.landscape)
    expect(LAKE_ART.plates.landscape).toMatch(/lake-landscape\.webp$/u)
    expect(source?.getAttribute('media')).toBe('(orientation: landscape)')
    // The layout's shore is 51% down: so is both plates'.
    expect(layout.shore / layout.height).toBeCloseTo(0.51)
    expect(img.style.objectPosition).toBe('61% 51%')
  })

  it('lays the painted jetty on the deck, moving with it', () => {
    scene()
    const box = jettyBox(layout)
    const jetty = screen.getByTestId('harmony-jetty')
    expect(jetty.getAttribute('href')).toBe(LAKE_ART.jetty)
    expect(Number(jetty.getAttribute('x'))).toBeCloseTo(box.x)
    expect(Number(jetty.getAttribute('y'))).toBeCloseTo(box.y)
    expect(Number(jetty.getAttribute('width'))).toBeCloseTo(box.width)
    expect(Number(jetty.getAttribute('height'))).toBeCloseTo(box.height)
    expect(jetty.closest('g')?.getAttribute('style')).toContain(
      `translateY(${layout.jetty.top.toFixed(1)}px)`,
    )
  })

  it('keeps the drawing until the lake and the jetty have loaded', () => {
    scene()
    expect(root().dataset.art).toBe('drawing')
    load('harmony-painting')
    expect(root().dataset.art).toBe('drawing')
    load('harmony-jetty')
    expect(root().dataset.art).toBe('painting')
    // The exercise is drawn over the painting all the same.
    expect(screen.getAllByTestId('harmony-lamp').length).toBeGreaterThan(0)
  })

  it('keeps the drawing when a part of the painting will not load', () => {
    scene()
    load('harmony-jetty')
    fireEvent.error(screen.getByTestId('harmony-painting'))
    expect(root().dataset.art).toBe('drawing')
  })

  it('draws alone when asked for no painting', () => {
    scene(null)
    expect(screen.queryByTestId('harmony-painting')).toBeNull()
    expect(screen.queryByTestId('harmony-jetty')).toBeNull()
    expect(root().dataset.art).toBe('drawing')
  })
})
