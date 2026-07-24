import { cleanup, render, screen } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { UvrSession } from '@/stores/uvr-store'

const mocks = vi.hoisted(() => ({
  session: null as UvrSession | null,
  sessions: [] as UvrSession[],
  setCurrentUvrSession: vi.fn(),
  loadPitchAnalysis: vi.fn(),
  setActiveTab: vi.fn(),
}))

vi.mock('@/stores/uvr-store', () => ({
  currentUvrSession: () => mocks.session,
  getAllUvrSessionsReactive: () => mocks.sessions,
  setCurrentUvrSession: mocks.setCurrentUvrSession,
}))

vi.mock('@/stores', () => ({
  setActiveTab: mocks.setActiveTab,
}))

vi.mock('@/db/services/session-pitch-analysis-service', () => ({
  loadPitchAnalysisFromDb: mocks.loadPitchAnalysis,
}))

import { AnalysisMobileOverview, loadMobileAnalysis, relativeTime, } from '@/components/AnalysisMobileOverview'

const COMPLETED_SESSION: UvrSession = {
  sessionId: 'session-1',
  status: 'completed',
  progress: 100,
  processingMode: 'server',
  createdAt: Date.now() - 60_000, // 1 minute ago
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

const SECOND_SESSION: UvrSession = {
  sessionId: 'session-2',
  status: 'completed',
  progress: 100,
  processingMode: 'local',
  createdAt: Date.now() - 3_600_000, // 1 hour ago
  originalFile: {
    name: 'Another song.mp3',
    size: 6 * 1024 * 1024,
    mimeType: 'audio/mp3',
  },
  outputs: { vocal: 'blob:vocal2' },
  stemMeta: { vocal: { duration: 200 } },
}

describe('AnalysisMobileOverview', () => {
  beforeEach(() => {
    mocks.session = COMPLETED_SESSION
    mocks.sessions = [COMPLETED_SESSION, SECOND_SESSION]
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
    mocks.sessions = []
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

  it('shows a session gallery when no session is loaded', () => {
    mocks.session = null
    render(() => <AnalysisMobileOverview />)

    expect(screen.getByTestId('session-gallery')).toBeInTheDocument()
    expect(
      screen.getByText('A very long vocal performance name.wav'),
    ).toBeInTheDocument()
    expect(screen.getByText('Another song.mp3')).toBeInTheDocument()
    expect(mocks.loadPitchAnalysis).not.toHaveBeenCalled()
  })

  it('shows empty gallery fallback with Karaoke link when no sessions exist', () => {
    mocks.session = null
    mocks.sessions = []
    render(() => <AnalysisMobileOverview />)

    expect(screen.getByText('No sessions yet')).toBeInTheDocument()
    screen.getByRole('button', { name: 'Go to Karaoke' }).click()
    expect(mocks.setActiveTab).toHaveBeenCalledWith('karaoke')
  })

  it('selects a session from the gallery', () => {
    mocks.session = null
    render(() => <AnalysisMobileOverview />)

    screen.getByTestId('session-pick-session-2').click()

    expect(mocks.setCurrentUvrSession).toHaveBeenCalledWith(SECOND_SESSION)
  })

  it('opens the session gallery via "Change song" button', () => {
    render(() => <AnalysisMobileOverview />)

    // Session detail is visible
    expect(
      screen.getByText('A very long vocal performance name.wav'),
    ).toBeInTheDocument()

    // Click change song
    screen.getByTestId('change-song-btn').click()

    // Gallery is now visible
    expect(screen.getByTestId('session-gallery')).toBeInTheDocument()
  })

  it('turns a pitch-cache failure into a recoverable load result', async () => {
    const load = vi.fn().mockRejectedValue(new Error('IndexedDB failed'))

    await expect(loadMobileAnalysis('session-1', load)).resolves.toEqual({
      data: null,
      failed: true,
    })
    expect(load).toHaveBeenCalledWith('session-1')
  })
})

describe('relativeTime', () => {
  it('returns "just now" for very recent timestamps', () => {
    expect(relativeTime(Date.now() - 5_000)).toBe('just now')
  })

  it('returns minutes ago', () => {
    expect(relativeTime(Date.now() - 5 * 60_000)).toBe('5m ago')
  })

  it('returns hours ago', () => {
    expect(relativeTime(Date.now() - 3 * 3_600_000)).toBe('3h ago')
  })

  it('returns days ago', () => {
    expect(relativeTime(Date.now() - 7 * 86_400_000)).toBe('7d ago')
  })

  it('returns months ago for older timestamps', () => {
    expect(relativeTime(Date.now() - 60 * 86_400_000)).toBe('2mo ago')
  })

  it('returns "just now" for future timestamps', () => {
    expect(relativeTime(Date.now() + 60_000)).toBe('just now')
  })
})
