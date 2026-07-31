import { describe, expect, it, vi } from 'vitest'

const viewport = vi.hoisted(() => ({ narrow: true }))

vi.mock('@/lib/use-viewport', () => ({
  isNarrow: () => viewport.narrow,
}))

import { hasPageTour } from '@/stores/app-store'

// The Analysis page used to render a different component per viewport, and
// its tour was gated to desktop as a result. There is one responsive page
// now, so the tour must be offered everywhere.
describe('Analysis tour viewport availability', () => {
  it('offers the analysis tour on phones', () => {
    viewport.narrow = true
    expect(hasPageTour('analysis')).toBe(true)
  })

  it('offers the analysis tour on desktop', () => {
    viewport.narrow = false
    expect(hasPageTour('analysis')).toBe(true)
  })
})
