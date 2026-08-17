// Every tour says where you are, in the same place
// ============================================================
//
// The readout used to appear only from nine steps up and sat after the last
// mark. So the Toolbar tour opened from a Learn tutorial showed a bare
// "1/11" wedged among the dashes, while the same kind of tour offered by a
// notification showed nothing at all — a number that looked like one more
// mark on some tours and was simply absent on others. It leads the strip
// now, on every tour, and screen readers get the long form off the group
// rather than "one slash eleven".

import { cleanup, render, screen } from '@solidjs/testing-library'
import { afterEach, describe, expect, it } from 'vitest'
import { Walkthrough } from '@/components/Walkthrough'
import type { WalkthroughStep } from '@/stores/app-store'
import { endWalkthrough, startTour } from '@/stores/app-store'

function tour(length: number): WalkthroughStep[] {
  return Array.from({ length }, (_, index) => ({
    targetSelector: `[data-tour="step-${index}"]`,
    title: `Step ${index + 1}`,
    description: 'Somewhere to look.',
  }))
}

afterEach(() => {
  endWalkthrough()
  cleanup()
})

describe('the tour progress readout', () => {
  it('counts a short tour, not only a long one', () => {
    startTour(tour(4))
    render(() => <Walkthrough />)

    expect(screen.getByText('1/4')).toBeInTheDocument()
  })

  it('counts a long tour the same way', () => {
    startTour(tour(11))
    render(() => <Walkthrough />)

    expect(screen.getByText('1/11')).toBeInTheDocument()
  })

  it('leads the marks rather than trailing them', () => {
    startTour(tour(5))
    render(() => <Walkthrough />)

    const marks = screen.getByRole('group', { name: /Tour steps/ })
    const readout = screen.getByText('1/5')
    // Node.DOCUMENT_POSITION_FOLLOWING: the marks come after the readout.
    expect(readout.compareDocumentPosition(marks) & 4).toBeTruthy()
  })

  it('spells the position out for a screen reader instead of a fraction', () => {
    startTour(tour(5))
    render(() => <Walkthrough />)

    expect(
      screen.getByRole('group', { name: 'Tour steps: step 1 of 5' }),
    ).toBeInTheDocument()
    // The visible fraction is decoration beside that name, not a second
    // announcement of the same thing.
    expect(screen.getByText('1/5')).toHaveAttribute('aria-hidden', 'true')
  })
})
