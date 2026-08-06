// ============================================================
// UVR Panel Component Tests
// ============================================================

import { fireEvent, render, screen, waitFor } from '@solidjs/testing-library'
import { beforeAll, describe, expect, it, vi } from 'vitest'
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
  applyUvrSettings: vi.fn().mockResolvedValue(undefined),

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
        deleteUvrSession(sessionId)
      }
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
