import { cleanup, render, screen } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { UvrSession } from '@/stores/uvr-store'

const mocks = vi.hoisted(() => ({
  session: null as UvrSession | null,
  loadPitchAnalysis: vi.fn(),
  setActiveTab: vi.fn(),
}))

vi.mock('@/stores/uvr-store', () => ({
  currentUvrSession: () => mocks.session,
}))

vi.mock('@/stores', () => ({
  setActiveTab: mocks.setActiveTab,
}))

vi.mock('@/db/services/session-pitch-analysis-service', () => ({
  loadPitchAnalysisFromDb: mocks.loadPitchAnalysis,
}))

import { AnalysisMobileOverview } from '@/components/AnalysisMobileOverview'

describe('AnalysisMobileOverview', () => {
  beforeEach(() => {
    mocks.session = {
      sessionId: 'session-1',
      status: 'completed',
      progress: 100,
      processingMode: 'server',
      createdAt: Date.now(),
      originalFile: {
        name: 'A very long vocal performance name.wav',
        size: 12 * 1024 * 1024,
        mimeType: 'audio/wav',
      },
      outputs: {
        vocal: 'blob:vocal',
        instrumental: 'blob:instrumental',
      },
      stemMeta: {
        vocal: { duration: 95 },
        instrumental: { duration: 95 },
      },
    }
    mocks.loadPitchAnalysis.mockResolvedValue({
      mergedNotes: [
        { midi: 60, noteName: 'C4', startSec: 0, endSec: 1 },
        { midi: 64, noteName: 'E4', startSec: 1, endSec: 2 },
        { midi: 67, noteName: 'G4', startSec: 2, endSec: 3 },
      ],
      segmentedNotes: [
        { midi: 60, noteName: 'C4', startSec: 0, endSec: 1 },
        { midi: 64, noteName: 'E4', startSec: 1, endSec: 2 },
        { midi: 67, noteName: 'G4', startSec: 2, endSec: 3 },
      ],
      pitchHistory: [],
    })
  })

  afterEach(() => {
    cleanup()
    mocks.session = null
    vi.clearAllMocks()
  })

  it('renders a loaded UVR session while its cached pitch pass loads', () => {
    render(() => <AnalysisMobileOverview />)

    expect(
      screen.getByText('A very long vocal performance name.wav'),
    ).toBeInTheDocument()
    expect(screen.getByText('Server separation')).toBeInTheDocument()
    expect(screen.getByText('2 available')).toBeInTheDocument()
    expect(screen.getByText('1m 35s')).toBeInTheDocument()
    expect(
      screen.getByText('Reading the session pitch map…'),
    ).toBeInTheDocument()
    expect(mocks.loadPitchAnalysis).toHaveBeenCalledWith('session-1')
  })

  it('offers a route to Karaoke when no session is loaded', () => {
    mocks.session = null
    render(() => <AnalysisMobileOverview />)

    screen.getByRole('button', { name: 'Choose a Karaoke session' }).click()

    expect(mocks.setActiveTab).toHaveBeenCalledWith('karaoke')
    expect(mocks.loadPitchAnalysis).not.toHaveBeenCalled()
  })
})
