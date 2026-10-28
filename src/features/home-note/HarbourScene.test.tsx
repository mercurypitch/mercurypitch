// ============================================================
// The harbour: a painting when the app carries one, the drawing until then
// ============================================================

import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import { afterEach, describe, expect, it } from 'vitest'
import { layoutHarbour } from './harbour-layout'
import { HARBOUR_ART, HarbourScene } from './HarbourScene'

const layout = layoutHarbour(390, 844, 0.9)

function scene(art?: { portrait: string; landscape: string } | null) {
  return render(() => (
    <HarbourScene
      layout={layout}
      bandHalf={12}
      beat={0}
      turn={false}
      lit={false}
      trailRef={() => undefined}
      art={art}
    />
  ))
}

const root = (): HTMLElement => screen.getByTestId('home-note-scene')

afterEach(() => {
  cleanup()
})

describe('the harbour', () => {
  it('asks for the painting, upright and on its side, pinned at the lamp', () => {
    scene()
    const img = screen.getByTestId('home-note-painting') as HTMLImageElement
    expect(img.getAttribute('src')).toBe(HARBOUR_ART.portrait)
    expect(img.getAttribute('src')).toBe('/ear-rooms/harbour-portrait.webp')
    const source = img.parentElement?.querySelector('source')
    expect(source?.getAttribute('srcset')).toBe(
      '/ear-rooms/harbour-landscape.webp',
    )
    expect(source?.getAttribute('media')).toBe('(orientation: landscape)')
    // The layout's lamp: 84% across, 44% down.
    expect(img.style.objectPosition).toBe('84.00% 44.00%')
  })

  it('keeps the drawing until the painting has loaded, then rests it', () => {
    scene()
    expect(root().dataset.art).toBe('drawing')
    fireEvent.load(screen.getByTestId('home-note-painting'))
    expect(root().dataset.art).toBe('painting')
    // The exercise is drawn over the painting all the same.
    expect(screen.getByTestId('home-note-beam')).toBeTruthy()
    expect(screen.getByTestId('home-note-band')).toBeTruthy()
    expect(screen.getByTestId('home-note-lamp')).toBeTruthy()
  })

  it('keeps the drawing where the app does not carry the painting', () => {
    scene()
    fireEvent.error(screen.getByTestId('home-note-painting'))
    expect(root().dataset.art).toBe('drawing')
    expect(screen.getByTestId('home-note-beam')).toBeTruthy()
  })

  it('draws alone when asked for no painting', () => {
    scene(null)
    expect(screen.queryByTestId('home-note-painting')).toBeNull()
    expect(root().dataset.art).toBe('drawing')
  })
})
