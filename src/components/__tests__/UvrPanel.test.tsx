// ============================================================
// UVR Panel Component Tests
// ============================================================

import { fireEvent, render, screen, waitFor } from '@solidjs/testing-library'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { UvrSession } from '@/stores/app-store'
import { deleteUvrSession, importUvrSession } from '@/stores/app-store'
import { UvrPanel } from '../UvrPanel'

const archiveMocks = vi.hoisted(() => ({
  inspectSessionLibraryExport: vi.fn(),
  exportAllSessions: vi.fn(),
}))

vi.mock('@/db/services/session-export-service', async (importOriginal) => {
  const actual = (await importOriginal()) as object
  return {
    ...actual,
    inspectSessionLibraryExport: archiveMocks.inspectSessionLibraryExport,
    exportAllSessions: archiveMocks.exportAllSessions,
  }
})

// Mock Worker and URL.createObjectURL
beforeAll(() => {
  class MockWorker {
    onmessage: ((e: MessageEvent) => void) | null = null
    onerror: ((e: ErrorEvent) => void) | null = null
    postMessage = vi.fn()
    terminate = vi.fn()
    addEventListener = vi.fn()
    removeEventListener = vi.fn()
    dispatchEvent = vi.fn()
  }

  vi.stubGlobal('Worker', MockWorker)

  const originalURL = window.URL
  // Keep original URL but mock static methods
  vi.stubGlobal(
    'URL',
    class extends originalURL {
      static createObjectURL = vi.fn(() => 'blob:mock-url')
      static revokeObjectURL = vi.fn()
    },
  )
})

// The signpost renders only on a phone-shaped viewport that is not a TV,
// so both gates need a hand on them. Spread-the-actual keeps every other
// export (BREAKPOINTS, device tiers) real; only the two booleans move.
const viewportMocks = vi.hoisted(() => ({
  narrow: false,
  tv: false,
}))

vi.mock('@/lib/use-viewport', async (importOriginal) => {
  const actual = (await importOriginal()) as object
  return { ...actual, isNarrow: () => viewportMocks.narrow }
})

vi.mock('@/lib/device-tier', async (importOriginal) => {
  const actual = (await importOriginal()) as object
  return { ...actual, isTvDevice: () => viewportMocks.tv }
})

// The stashed code a scanned QR leaves behind (read at mount by the
// auto-open effect), with the modal stubbed so opening it does not pull
// the WebRTC machinery into this suite.
const syncMocks = vi.hoisted(() => ({ code: null as string | null }))
vi.mock('@/stores/sync-store', () => ({
  syncCodeToJoin: () => syncMocks.code,
}))
// The dialog itself mounts in the app shell (SyncHost); this panel only
// rings the bell, so the mock is the bell.
const syncUi = vi.hoisted(() => ({ openSyncModal: vi.fn() }))
vi.mock('@/stores/sync-ui-store', () => ({
  openSyncModal: syncUi.openSyncModal,
  syncModalOpen: () => false,
}))

// File-level, not per-describe: a leaked `narrow = true` re-renders every
// LATER test in the phone layout, where the desktop-only header controls
// (mode selector, CPU/GPU pills) do not exist.
beforeEach(() => {
  viewportMocks.narrow = false
  viewportMocks.tv = false
  syncMocks.code = null
  syncUi.openSyncModal.mockClear()
})

// Mock the entire stores barrel
vi.mock('@/stores', () => ({
  currentUvrSession: vi.fn(() => null),
  getAllUvrSessions: vi.fn(() => []),
  startUvrSession: vi.fn(() => 'session-123'),
  cancelUvrSession: vi.fn(),
  completeUvrSession: vi.fn(),
  updateUvrSessionProgress: vi.fn(),
  setErrorUvrSession: vi.fn(),
  getUvrSession: vi.fn(() => null),

  // Types
  UvrStatus: {
    idle: 'idle',
    uploading: 'uploading',
    processing: 'processing',
    completed: 'completed',
    error: 'error',
    cancelled: 'cancelled',
  } as const,
  UvrMode: {
    separate: 'separate',
    instrumental: 'instrumental',
    vocal: 'vocal',
    duo: 'duo',
  } as const,

  // Other exports
  walkthroughStep: vi.fn(() => ({
    title: '',
    targetSelector: '',
    description: '',
  })),
  walkthroughActive: vi.fn(() => false),
  WALKTHROUGH_STEPS: vi.fn(() => []),
  getSessionHistory: vi.fn(() => []),
  sessionResults: vi.fn(() => []),

  // Settings
  setKeyName: vi.fn(),
  setScaleType: vi.fn(),
  setInstrument: vi.fn(),

  // Stores
  micStore: {},
  notifStore: {},
  practiceStore: {},
  settingsStore: {},
  themeStore: {},
  transportStore: {},
  uiStore: {},
  playbackStateStore: {},

  // Audio engine
  initAudioEngine: vi.fn().mockResolvedValue(undefined),

  // Utils
  buildSessionItemMelody: vi.fn(),
}))

describe('UvrPanel Component', () => {
  const defaultProps = {
    initialView: 'upload' as const,
    onPracticeStart: vi.fn(),
    onExport: vi.fn(),
    onSessionView: vi.fn(),
    onClose: vi.fn(),
  }

  describe('Initial Rendering', () => {
    it('renders default upload view when no session exists', () => {
      render(() => <UvrPanel {...defaultProps} />)
      expect(screen.getByText('Upload Audio')).toBeInTheDocument()
    })

    it('renders header tabs', () => {
      render(() => <UvrPanel {...defaultProps} />)
      expect(screen.getByRole('button', { name: 'Guide' })).toBeInTheDocument()
      expect(
        screen.getByRole('button', { name: 'Settings' }),
      ).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Upload' })).toBeInTheDocument()
    })

    it('defaults to upload when initialView is not set', () => {
      render(() => <UvrPanel {...defaultProps} />)

      expect(screen.getByText('Upload Audio')).toBeInTheDocument()
    })

    it('renders results view when initialView is results', () => {
      const { container } = render(() => (
        <UvrPanel {...defaultProps} initialView="results" />
      ))

      expect(container.querySelector('.results-section')).toBeInTheDocument()
    })

    it('keeps selected ZIP archives when the import backdrop is clicked', async () => {
      const { container } = render(() => <UvrPanel {...defaultProps} />)
      const input = container.querySelector<HTMLInputElement>(
        'input[type="file"][accept=".zip"]',
      )
      expect(input).not.toBeNull()

      const archive = new File(['not-a-real-zip'], 'ten-songs.zip', {
        type: 'application/zip',
      })
      fireEvent.change(input as HTMLInputElement, {
        target: { files: [archive] },
      })

      expect(await screen.findByRole('dialog')).toBeInTheDocument()
      expect(screen.getByText('ten-songs.zip')).toBeInTheDocument()

      fireEvent.click(screen.getByTestId('uvr-import-overlay'))

      expect(screen.getByRole('dialog')).toBeInTheDocument()
      expect(screen.getByText('ten-songs.zip')).toBeInTheDocument()

      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    it('confirms the stem preset before exporting the full session library', async () => {
      const sessionId = 'library-export-confirmation'
      importUvrSession({
        sessionId,
        status: 'completed',
        progress: 100,
        createdAt: Date.now(),
        originalFile: {
          name: 'Full band.wav',
          size: 1024,
          mimeType: 'audio/wav',
        },
      } as UvrSession)
      archiveMocks.inspectSessionLibraryExport.mockResolvedValueOnce({
        availableStems: ['vocal', 'instrumental', 'drums', 'bass'],
        restorableSessions: 1,
        skippedSessions: 0,
      })
      archiveMocks.exportAllSessions.mockResolvedValueOnce({
        exportedSessions: 1,
        skippedSessions: 0,
      })

      try {
        render(() => <UvrPanel {...defaultProps} />)
        fireEvent.click(
          screen.getByTitle(
            'Choose stems and export all sessions to a ZIP file',
          ),
        )

        expect(await screen.findByRole('dialog')).toHaveTextContent(
          'Choose stems for every session',
        )
        expect(
          screen.getByRole('radio', { name: /All available stems/ }),
        ).toBeChecked()

        fireEvent.click(
          screen.getByRole('radio', { name: /Vocal \+ instrumental/ }),
        )
        fireEvent.click(screen.getByRole('button', { name: 'Export all' }))

        await waitFor(() =>
          expect(archiveMocks.exportAllSessions).toHaveBeenCalledWith(
            expect.any(Function),
            ['vocal', 'instrumental'],
          ),
        )
      } finally {
        await deleteUvrSession(sessionId)
      }
    })
  })

  // REQ-SKL-007 (docs/specs/wire-studio-karaoke-night.ears.md): a phone
  // arriving in the studio met the widest surface in the app with no hint
  // that a stage built for it was one tap away.
  describe('the signpost to Karaoke Night', () => {
    it('REQ-SKL-007: points a phone at the stage from the upload view', () => {
      viewportMocks.narrow = true
      render(() => <UvrPanel />)
      const note = screen.getByTestId('uvr-stage-lead')
      const link = note.querySelector('a')
      expect(link?.getAttribute('href')).toBe('/karaoke-night')
    })

    it('REQ-SKL-007: says nothing on a desktop', () => {
      render(() => <UvrPanel />)
      expect(screen.queryByTestId('uvr-stage-lead')).toBeNull()
    })

    it('REQ-SKL-007: says nothing on a TV, which has its own note', () => {
      viewportMocks.narrow = true
      viewportMocks.tv = true
      render(() => <UvrPanel />)
      expect(screen.queryByTestId('uvr-stage-lead')).toBeNull()
    })
  })

  describe('a scanned sync code', () => {
    it('REQ-SYNC-026: opens the sync modal without another press', async () => {
      // Scanning the QR lands here with the code stashed. Before the
      // auto-open, the scan sat inert until somebody happened to press
      // the sync button — at which point the code autofilled, proving
      // the stash worked and only the opening was missing.
      syncMocks.code = 'ABCD2345'
      render(() => <UvrPanel />)
      await waitFor(() => expect(syncUi.openSyncModal).toHaveBeenCalled())
    })

    it('leaves the modal closed when nothing was scanned', () => {
      render(() => <UvrPanel />)
      expect(syncUi.openSyncModal).not.toHaveBeenCalled()
    })
  })

  describe('Local Mode Device (CPU/GPU) Toggle', () => {
    it('renders CPU and GPU toggle pills in browser/local mode', () => {
      render(() => <UvrPanel {...defaultProps} />)
      expect(screen.getByTestId('uvr-device-cpu')).toBeInTheDocument()
      expect(screen.getByTestId('uvr-device-gpu')).toBeInTheDocument()
    })

    it('toggles CPU and GPU override states on click', () => {
      render(() => <UvrPanel {...defaultProps} />)
      const cpuBtn = screen.getByTestId('uvr-device-cpu')
      const gpuBtn = screen.getByTestId('uvr-device-gpu')

      gpuBtn.click()
      expect(gpuBtn).toHaveClass('active')
      expect(cpuBtn).not.toHaveClass('active')

      cpuBtn.click()
      expect(cpuBtn).toHaveClass('active')
      expect(gpuBtn).not.toHaveClass('active')
    })
  })
})

// ── Server mode auth gate ───────────────────────────────────────

describe('Server mode auth gate', () => {
  const defaultProps = {
    initialView: 'upload' as const,
    onPracticeStart: vi.fn(),
    onExport: vi.fn(),
    onSessionView: vi.fn(),
    onClose: vi.fn(),
  }

  it('refuses Server mode when signed out and offers the Account link', async () => {
    localStorage.removeItem('mp:authToken')
    localStorage.setItem('pitchperfect_uvr-processing-mode', 'local')
    const { notifications, setNotifications } =
      await import('@/stores/notifications-store')
    setNotifications([])

    render(() => <UvrPanel {...defaultProps} />)
    screen.getByTestId('uvr-mode-server').click()

    expect(localStorage.getItem('pitchperfect_uvr-processing-mode')).toBe(
      'local',
    )
    const toasts = notifications()
    expect(
      toasts.some((n) =>
        n.message.includes('Sign in to use cloud GPU processing'),
      ),
    ).toBe(true)
    expect(toasts.find((n) => n.action)?.action?.label).toBe('Open Account')
  })

  it('activates Server mode when a token is present', async () => {
    localStorage.setItem('mp:authToken', 'jwt-token')
    localStorage.setItem('pitchperfect_uvr-processing-mode', 'local')
    const { setNotifications } = await import('@/stores/notifications-store')
    setNotifications([])

    render(() => <UvrPanel {...defaultProps} />)
    screen.getByTestId('uvr-mode-server').click()

    expect(localStorage.getItem('pitchperfect_uvr-processing-mode')).toBe(
      'server',
    )
    localStorage.removeItem('mp:authToken')
    localStorage.setItem('pitchperfect_uvr-processing-mode', 'local')
  })
})
