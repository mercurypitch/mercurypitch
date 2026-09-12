// ============================================================
// Home scene — the record's faces, its motion, and the room around it
// ============================================================
import { fireEvent, render, screen } from '@solidjs/testing-library'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CORKY_REST_ART } from '@/content'
import { HomeScene } from './HomeScene'

function record(container: HTMLElement): SVGSVGElement {
  const svg = container.querySelector<SVGSVGElement>('svg[data-side]')
  if (svg === null) throw new Error('Expected the record on the platter')
  return svg
}

describe('Home scene', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('seats the brand record on Side A with the plan Pull on its gold label', () => {
    const { container } = render(() => (
      <HomeScene record={{ side: 'A', motion: 'still', pullId: 'scrolling' }} />
    ))
    const scene = container.querySelector('[data-record]')!
    expect(scene).toHaveAttribute('data-record', 'A')
    expect(scene).toHaveAttribute('data-motion', 'still')
    expect(scene).toHaveAttribute('data-selection', 'none')
    expect(scene).toHaveAttribute('data-callout', 'none')
    const svg = record(container)
    expect(svg).toHaveAttribute('aria-hidden', 'true')
    expect(svg).toHaveAttribute('data-label', 'scrolling')
    // The app icon's five grooves, then the label face in the Side A gold.
    expect(svg.querySelectorAll('g[fill="#027b79"] path')).toHaveLength(5)
    expect(svg.querySelector('circle[fill="#efc13b"]')).not.toBeNull()
    expect(svg.querySelector('circle[fill="#83c5bb"]')).toBeNull()
    const art = svg.querySelector('image')!
    expect(art.getAttribute('href')).toContain('pull-the-scroll')
    expect(art).toHaveAttribute('width', '96')
    expect(svg.textContent).toContain('SIDE A')
  })

  it('draws a premium Pull, cropped to its silhouette, in the tighter box', () => {
    const { container } = render(() => (
      <HomeScene record={{ side: 'A', motion: 'still', pullId: 'the-tape' }} />
    ))
    const art = record(container).querySelector('image')!
    expect(art.getAttribute('href')).toContain('pull-the-tape')
    expect(art).toHaveAttribute('width', '84')
  })

  it('gives a custom Pull the ink-drop mark and no creature', () => {
    const { container } = render(() => (
      <HomeScene record={{ side: 'A', motion: 'still' }} />
    ))
    const svg = record(container)
    expect(svg).toHaveAttribute('data-label', 'mark')
    expect(svg.querySelector('image')).toBeNull()
    expect(svg.querySelector('circle[fill="#e42403"]')).not.toBeNull()
  })

  it('wears the pale turquoise face on Side B', () => {
    const { container } = render(() => (
      <HomeScene record={{ side: 'B', motion: 'still', pullId: 'snacking' }} />
    ))
    const svg = record(container)
    expect(svg).toHaveAttribute('data-side', 'B')
    expect(svg.querySelector('circle[fill="#83c5bb"]')).not.toBeNull()
    expect(svg.querySelector('circle[fill="#efc13b"]')).toBeNull()
    expect(svg.textContent).toContain('SIDE B')
  })

  it('spins only while asked to and reports the settle once', () => {
    const onSettled = vi.fn()
    const { container } = render(() => (
      <HomeScene
        record={{ side: 'B', motion: 'settle' }}
        onSettled={onSettled}
      />
    ))
    const svg = record(container)
    expect(svg).toHaveAttribute('data-motion', 'settle')
    const disc = svg.querySelector('g')!
    fireEvent.animationEnd(disc)
    fireEvent.animationEnd(disc)
    expect(onSettled).toHaveBeenCalledTimes(1)
  })

  it('reports the settle on a timer when no animation can end', () => {
    vi.useFakeTimers()
    const onSettled = vi.fn()
    render(() => (
      <HomeScene
        record={{ side: 'B', motion: 'settle' }}
        onSettled={onSettled}
      />
    ))
    vi.advanceTimersByTime(2500)
    expect(onSettled).not.toHaveBeenCalled()
    vi.advanceTimersByTime(200)
    expect(onSettled).toHaveBeenCalledTimes(1)
  })

  it('marks the spin on the scene while a cue is on its way', () => {
    const { container } = render(() => (
      <HomeScene record={{ side: 'A', motion: 'spin' }} />
    ))
    expect(container.querySelector('[data-record]')).toHaveAttribute(
      'data-motion',
      'spin',
    )
    expect(record(container)).toHaveAttribute('data-motion', 'spin')
  })

  it('keeps the record when the deck bitmap fails to load', () => {
    const { container } = render(() => (
      <HomeScene record={{ side: 'A', motion: 'still' }} />
    ))
    const deck = container.querySelector<HTMLImageElement>(
      'img[src*="turntable-hero"]',
    )!
    expect(deck).toHaveAttribute('alt', '')
    fireEvent.error(deck)
    expect(deck).not.toBeVisible()
    expect(container.querySelector('[data-record]')).toHaveAttribute(
      'data-deck',
      'missing',
    )
    expect(record(container)).toBeInTheDocument()
  })

  it('leaves the platter empty without a plan and shows the paused chip', () => {
    const { container } = render(() => <HomeScene paused />)
    expect(container.querySelector('[data-record]')).toHaveAttribute(
      'data-record',
      'empty',
    )
    expect(container.querySelector('svg[data-side]')).toBeNull()
    expect(
      container.querySelector('img[src*="turntable-hero"]'),
    ).toBeInTheDocument()
    expect(screen.getByText('Paused')).toBeInTheDocument()
  })

  it('stands Corky beside the deck as the approved rest still', () => {
    const { container } = render(() => (
      <HomeScene record={{ side: 'A', motion: 'still' }} />
    ))
    const corky = screen.getByRole('img', { name: CORKY_REST_ART.alt })
    expect(corky).toHaveAttribute('src', CORKY_REST_ART.still)
    expect(corky).toHaveAttribute('draggable', 'false')
    expect(container.querySelector('video')).toBeNull()
    expect(screen.queryByText('Paused')).not.toBeInTheDocument()
  })
})
