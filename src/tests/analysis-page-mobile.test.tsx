import { render, screen } from '@solidjs/testing-library'
import { afterEach, describe, expect, it, vi } from 'vitest'

const viewport = vi.hoisted(() => ({ narrow: true }))

vi.mock('@/lib/use-viewport', () => ({
  isNarrow: () => viewport.narrow,
}))

vi.mock('@/components/AnalysisMobileOverview', () => ({
  AnalysisMobileOverview: () => (
    <div data-testid="mock-analysis-mobile">Mobile analysis</div>
  ),
}))

vi.mock('@/components/VocalAnalysis', () => ({
  VocalAnalysis: () => <div>Desktop vocal analysis</div>,
}))

import { AnalysisPage } from '@/pages/AnalysisPage'

describe('AnalysisPage responsive workspace', () => {
  afterEach(() => {
    viewport.narrow = true
  })

  it('gates dense desktop tools behind the mobile overview', () => {
    viewport.narrow = true
    render(() => <AnalysisPage />)

    expect(screen.getByTestId('mock-analysis-mobile')).toBeInTheDocument()
    expect(
      screen.queryByRole('tab', { name: 'Pitch Detection' }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('tab', { name: 'Pitch Algorithms' }),
    ).not.toBeInTheDocument()
  })

  it('keeps the full analysis tool switcher on larger screens', () => {
    viewport.narrow = false
    render(() => <AnalysisPage />)

    expect(
      screen.getByRole('tab', { name: 'Pitch Detection' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('tab', { name: 'Pitch Algorithms' }),
    ).toBeInTheDocument()
    expect(screen.queryByTestId('mock-analysis-mobile')).not.toBeInTheDocument()
  })
})
