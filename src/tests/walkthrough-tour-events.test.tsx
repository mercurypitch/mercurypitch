// @vitest-environment jsdom
// ============================================================
// The tour's own buttons tell the funnel how the tour ended
// ============================================================
//
// The store tests call `endWalkthrough('done')` themselves. These click the
// real controls instead: Finish has to report a finish, and the overlay and
// the close button have to report a way out. A MouseEvent must never reach
// `endWalkthrough`'s reason.

import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Walkthrough } from '@/components/Walkthrough'
import { trackTour } from '@/lib/guide-funnel'
import type { WalkthroughStep } from '@/stores/app-store'
import { endWalkthrough, startTour } from '@/stores/app-store'

vi.mock('@/lib/guide-funnel', () => ({ trackTour: vi.fn() }))

function tour(length: number): WalkthroughStep[] {
  return Array.from({ length }, (_, index) => ({
    targetSelector: `[data-tour="step-${index}"]`,
    title: `Step ${index + 1}`,
    description: 'Somewhere to look.',
  }))
}

beforeEach(() => {
  vi.mocked(trackTour).mockClear()
})

afterEach(() => {
  endWalkthrough()
  cleanup()
})

describe('the tour controls and the funnel', () => {
  it('reports a finish, on the last step, when Finish is clicked', () => {
    startTour(tour(3), 'home')
    render(() => <Walkthrough />)
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    fireEvent.click(screen.getByRole('button', { name: 'Finish' }))

    expect(trackTour).toHaveBeenLastCalledWith('tour_done', 'home', 3)
  })

  it('reports an exit, on the step it was left on, when Skip tour is clicked', () => {
    startTour(tour(3), 'path')
    render(() => <Walkthrough />)
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    fireEvent.click(screen.getByRole('button', { name: 'Skip tour' }))

    expect(trackTour).toHaveBeenLastCalledWith('tour_exit', 'path', 2)
  })

  it('reports an exit when the overlay behind the tooltip is clicked', () => {
    startTour(tour(3), 'exercises')
    render(() => <Walkthrough />)
    const overlay = screen.getByRole('button', { name: 'Skip tour' })
      .parentElement?.parentElement as HTMLElement
    fireEvent.click(overlay)

    expect(trackTour).toHaveBeenLastCalledWith('tour_exit', 'exercises', 1)
  })

  it('reports an exit when Escape is pressed', () => {
    startTour(tour(3), 'guitar')
    render(() => <Walkthrough />)
    fireEvent.keyDown(document.body, { key: 'Escape' })

    expect(trackTour).toHaveBeenLastCalledWith('tour_exit', 'guitar', 1)
  })
})
