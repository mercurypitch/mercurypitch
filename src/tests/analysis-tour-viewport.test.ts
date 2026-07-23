import { describe, expect, it, vi } from 'vitest'

const viewport = vi.hoisted(() => ({ narrow: true }))

vi.mock('@/lib/use-viewport', () => ({
  isNarrow: () => viewport.narrow,
}))

import { hasPageTour } from '@/stores/app-store'

describe('Analysis tour viewport gate', () => {
  it('does not offer the desktop analysis tour on phones', () => {
    viewport.narrow = true
    expect(hasPageTour('analysis')).toBe(false)
  })

  it('keeps the full analysis tour available on desktop', () => {
    viewport.narrow = false
    expect(hasPageTour('analysis')).toBe(true)
  })
})
