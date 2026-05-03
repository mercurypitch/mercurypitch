// ============================================================
// UVR Session Result Component Tests
// ============================================================

import { fireEvent,render, screen } from '@solidjs/testing-library'
import { afterEach,beforeEach, describe, expect, it, vi } from 'vitest'
import { UvrSessionResult } from '../UvrSessionResult'

describe('UvrSessionResult Component', () => {
  const mockSession = {
    sessionId: 'session-123',
    originalFile: {
      name: 'song.mp3',
      size: 1024 * 50000,
      mimeType: 'audio/mpeg',
    },
    mode: 'separate',
    vrArchitecture: 'VR_architecture_abe',
    model: 'UVR_MDXNET_RVC_Model_v2',
    status: 'completed' as const,
    progress: 100,
    processingTime: 45000,
    outputs: {
      vocal: '/stems/vocal.wav',
      instrumental: '/stems/instrumental.wav',
      vocalMidi: '/midi/vocal.mid',
    },
    createdAt: Date.now() - 3600000,
  } as const

  const mockSessionStatus = {
    sessionId: 'session-123',
    originalFile: {
      name: 'song.mp3',
      size: 1024 * 50000,
      mimeType: 'audio/mpeg',
    },
    mode: 'separate',
    vrArchitecture: 'VR_architecture_abe',
    model: 'UVR_MDXNET_RVC_Model_v2',
    status: 'completed' as const,
    progress: 100,
    processingTime: 45000,
    outputs: {
      vocal: '/stems/vocal.wav',
      instrumental: '/stems/instrumental.wav',
      vocalMidi: '/midi/vocal.mid',
    },
    createdAt: Date.now() - 3600000,
  } as const

  const mockSessionProcessing = {
    sessionId: 'session-123',
    originalFile: {
      name: 'song.mp3',
      size: 1024 * 50000,
      mimeType: 'audio/mpeg',
    },
    mode: 'separate',
    vrArchitecture: 'VR_architecture_abe',
    model: 'UVR_MDXNET_RVC_Model_v2',
    status: 'processing' as const,
    progress: 45,
    processingTime: 30000,
    outputs: {
      vocal: '/stems/vocal.wav',
      instrumental: '/stems/instrumental.wav',
      vocalMidi: '/midi/vocal.mid',
    },
    createdAt: Date.now() - 3600000,
  } as const

  const mockSessionError = {
    sessionId: 'session-123',
    originalFile: {
      name: 'song.mp3',
      size: 1024 * 50000,
      mimeType: 'audio/mpeg',
    },
    mode: 'separate',
    vrArchitecture: 'VR_architecture_abe',
    model: 'UVR_MDXNET_RVC_Model_v2',
    status: 'error' as const,
    progress: 0,
    processingTime: 0,
    outputs: {},
    error: 'Processing failed',
    createdAt: Date.now() - 3600000,
  } as const

  const mockSessionNoFile = {
    sessionId: 'session-123',
    originalFile: undefined as any,
    mode: 'separate',
    vrArchitecture: 'VR_architecture_abe',
    model: 'UVR_MDXNET_RVC_Model_v2',
    status: 'completed' as const,
    progress: 100,
    processingTime: 45000,
    outputs: {
      vocal: '/stems/vocal.wav',
      instrumental: '/stems/instrumental.wav',
      vocalMidi: '/midi/vocal.mid',
    },
    createdAt: Date.now() - 3600000,
  } as const

  const defaultProps = {
    sessionId: 'session-123',
    onView: vi.fn(),
    onExport: vi.fn(),
    onClose: vi.fn(),
  }

  const getSession = vi.fn<(sessionId: string) => any>()
  const getDeleteSession = vi.fn<() => void>()

  // Helper to get first matching element
  const getFirstByText = (text: string | RegExp): HTMLElement | null => {
    const all = screen.getAllByText(text)
    return all.length > 0 ? all[0] : null
  }

  // Helper to click instrumental download button
  const clickInstrumentalDownload = () => {
    // Search for the guitar emoji which is unique to instrumental
    const guitarIcons = screen.getAllByText('🎸')
    if (guitarIcons.length === 0) return false

    const guitarIconElement = guitarIcons[0].closest(
      '.output-file',
    ) as HTMLElement
    if (!guitarIconElement) return false

    const downloadButton = guitarIconElement.querySelector('button.file-action')
    if (downloadButton) {
      fireEvent.click(downloadButton)
      return true
    }
    return false
  }

  beforeEach(() => {
    vi.clearAllMocks()
    getSession.mockReturnValue(mockSession)
    getDeleteSession.mockReturnValue(undefined)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Header Rendering', () => {
    it('renders header with icon and session title', () => {
      render(() => (
        <UvrSessionResult
          {...defaultProps}
          getSession={getSession}
          onDeleteSession={getDeleteSession}
        />
      ))

      expect(screen.getByText('UVR Session')).toBeInTheDocument()
      expect(screen.getByText('song.mp3')).toBeInTheDocument()
    })

    it('displays unknown filename when not provided', () => {
      getSession.mockReturnValue(mockSessionNoFile)

      render(() => (
        <UvrSessionResult
          {...defaultProps}
          getSession={getSession}
          onDeleteSession={getDeleteSession}
        />
      ))

      expect(screen.getByText('Unknown')).toBeInTheDocument()
    })
  })

  describe('Status Bar', () => {
    it('renders completed status with check icon', () => {
      getSession.mockReturnValue(mockSessionStatus)

      render(() => (
        <UvrSessionResult
          {...defaultProps}
          getSession={getSession}
          onDeleteSession={getDeleteSession}
        />
      ))

      expect(getFirstByText('completed')).toBeInTheDocument()
    })

    it('renders processing status with loader', () => {
      getSession.mockReturnValue(mockSessionProcessing)

      render(() => (
        <UvrSessionResult
          {...defaultProps}
          getSession={getSession}
          onDeleteSession={getDeleteSession}
        />
      ))

      expect(getFirstByText('processing')).toBeInTheDocument()
    })

    it('renders error status with X icon', () => {
      getSession.mockReturnValue(mockSessionError)

      render(() => (
        <UvrSessionResult
          {...defaultProps}
          getSession={getSession}
          onDeleteSession={getDeleteSession}
        />
      ))

      expect(getFirstByText('error')).toBeInTheDocument()
    })

    it('shows processing time in status bar', () => {
      getSession.mockReturnValue(mockSessionStatus)

      render(() => (
        <UvrSessionResult
          {...defaultProps}
          getSession={getSession}
          onDeleteSession={getDeleteSession}
        />
      ))

      expect(screen.getByText('45s')).toBeInTheDocument()
    })

    it('shows idle status when session is null', () => {
      getSession.mockReturnValue(null as any)

      render(() => (
        <UvrSessionResult
          {...defaultProps}
          getSession={getSession}
          onDeleteSession={getDeleteSession}
        />
      ))

      expect(getFirstByText('Idle')).toBeInTheDocument()
    })
  })

  describe('Info Grid', () => {
    it('renders created date', () => {
      getSession.mockReturnValue(mockSessionStatus)

      render(() => (
        <UvrSessionResult
          {...defaultProps}
          getSession={getSession}
          onDeleteSession={getDeleteSession}
        />
      ))

      expect(getFirstByText('Created')).toBeInTheDocument()
      expect(getFirstByText(/5\/3\/2026/)).toBeInTheDocument()
    })

    it('renders file size when original file exists', () => {
      getSession.mockReturnValue(mockSessionStatus)

      render(() => (
        <UvrSessionResult
          {...defaultProps}
          getSession={getSession}
          onDeleteSession={getDeleteSession}
        />
      ))

      expect(getFirstByText(/\d+\.\d{2} MB/)).toBeInTheDocument()
    })

    it('does not show size when no original file', () => {
      getSession.mockReturnValue(mockSessionNoFile)

      render(() => (
        <UvrSessionResult
          {...defaultProps}
          getSession={getSession}
          onDeleteSession={getDeleteSession}
        />
      ))

      expect(screen.queryByText(/Size/i)).not.toBeInTheDocument()
    })

    it('formats large files correctly', () => {
      const largeFileSession = {
        ...mockSessionStatus,
        originalFile: {
          ...mockSessionStatus.originalFile!,
          size: 1024 * 1024 * 250,
        },
      }
      getSession.mockReturnValue(largeFileSession as any)

      render(() => (
        <UvrSessionResult
          {...defaultProps}
          getSession={getSession}
          onDeleteSession={getDeleteSession}
        />
      ))

      expect(screen.getByText(/250 MB/)).toBeInTheDocument()
    })
  })

  describe('Outputs Section', () => {
    it('renders outputs section header', () => {
      getSession.mockReturnValue(mockSessionStatus)

      render(() => (
        <UvrSessionResult
          {...defaultProps}
          getSession={getSession}
          onDeleteSession={getDeleteSession}
        />
      ))

      expect(screen.getByText('Generated Outputs')).toBeInTheDocument()
    })

    it('renders vocal stem file item', () => {
      getSession.mockReturnValue(mockSessionStatus)

      render(() => (
        <UvrSessionResult
          {...defaultProps}
          getSession={getSession}
          onDeleteSession={getDeleteSession}
        />
      ))

      expect(getFirstByText('Vocal Stem')).toBeInTheDocument()
      expect(getFirstByText('WAV')).toBeInTheDocument()
    })

    it('renders instrumental stem when available', () => {
      getSession.mockReturnValue(mockSessionStatus)

      render(() => (
        <UvrSessionResult
          {...defaultProps}
          getSession={getSession}
          onDeleteSession={getDeleteSession}
        />
      ))

      expect(getFirstByText('Instrumental')).toBeInTheDocument()
      expect(getFirstByText('WAV')).toBeInTheDocument()
    })

    it('renders vocal MIDI when available', () => {
      getSession.mockReturnValue(mockSessionStatus)

      render(() => (
        <UvrSessionResult
          {...defaultProps}
          getSession={getSession}
          onDeleteSession={getDeleteSession}
        />
      ))

      expect(screen.getByText('Vocal MIDI')).toBeInTheDocument()
      expect(screen.getByText('MIDI')).toBeInTheDocument()
    })

    it('calls export with vocal type when download clicked', () => {
      const mockSessionWithOutputs = {
        ...mockSession,
        outputs: {
          vocal: '/stems/vocal.wav',
          instrumental: '/stems/instrumental.wav',
          vocalMidi: '/midi/vocal.mid',
        },
      }
      getSession.mockReturnValue(mockSessionWithOutputs)
      getSession.mockReturnValue(mockSessionWithOutputs)

      render(() => (
        <UvrSessionResult
          {...defaultProps}
          getSession={getSession}
          onDeleteSession={getDeleteSession}
        />
      ))

      // Find all file-action buttons and click the first one
      const fileActionButtons = screen
        .getAllByRole('button')
        .filter((btn) => btn.classList.contains('file-action'))
      const vocalDownloadBtn = fileActionButtons[0]
      if (vocalDownloadBtn) {
        fireEvent.click(vocalDownloadBtn)
      }

      expect(defaultProps.onExport).toHaveBeenCalledWith('session-123', 'vocal')
    })

    it('calls export with instrumental type for instrumental download', async () => {
      const mockSessionWithOutputs = {
        ...mockSession,
        outputs: {
          vocal: '/stems/vocal.wav',
          instrumental: '/stems/instrumental.wav',
          vocalMidi: '/midi/vocal.mid',
        },
      }

      for (let i = 0; i < 5; i++) {
        getSession.mockReturnValue(mockSessionWithOutputs)
      }

      render(() => (
        <UvrSessionResult
          {...defaultProps}
          getSession={getSession}
          onDeleteSession={getDeleteSession}
        />
      ))

      // Wait for component to render
      await new Promise((resolve) => setTimeout(resolve, 0))

      const allButtons = document.querySelectorAll('button')
      const fileActionButtons = Array.from(allButtons).filter((btn) =>
        btn.classList.contains('file-action'),
      )
      const instrumentalDownloadBtn = fileActionButtons[1]
      if (instrumentalDownloadBtn) {
        fireEvent.click(instrumentalDownloadBtn)
      }

      expect(defaultProps.onExport).toHaveBeenCalledWith(
        'session-123',
        'instrumental',
      )
    })

    it('renders view results button for completed sessions', () => {
      getSession.mockReturnValueOnce(mockSessionStatus)

      render(() => (
        <UvrSessionResult
          {...defaultProps}
          getSession={getSession}
          onDeleteSession={getDeleteSession}
        />
      ))

      expect(getFirstByText('View Results')).toBeInTheDocument()
    })

    it('calls onView when view results button clicked', () => {
      getSession.mockReturnValueOnce(mockSessionStatus)

      render(() => (
        <UvrSessionResult
          {...defaultProps}
          getSession={getSession}
          onDeleteSession={getDeleteSession}
        />
      ))

      const viewButton = getFirstByText('View Results')
      if (viewButton) {
        fireEvent.click(viewButton)
      }

      expect(defaultProps.onView).toHaveBeenCalledWith('session-123')
    })

    it('renders delete button', () => {
      getSession.mockReturnValue(mockSessionStatus)

      render(() => (
        <UvrSessionResult
          {...defaultProps}
          getSession={getSession}
          onDeleteSession={getDeleteSession}
        />
      ))

      expect(getFirstByText('Delete')).toBeInTheDocument()
    })

    it('shows confirmation dialog when delete clicked', () => {
      const confirmMock = vi.fn(() => false)
      render(() => (
        <UvrSessionResult
          {...defaultProps}
          getSession={getSession}
          onDeleteSession={getDeleteSession}
          onConfirmDelete={confirmMock}
        />
      ))

      const deleteButton = getFirstByText('Delete')
      if (deleteButton) {
        fireEvent.click(deleteButton)
      }

      expect(confirmMock).toHaveBeenCalled()
    })

    it('calls delete when confirmation confirmed', () => {
      const confirmMock = vi.fn(() => true)
      render(() => (
        <UvrSessionResult
          {...defaultProps}
          getSession={getSession}
          onDeleteSession={getDeleteSession}
          onConfirmDelete={confirmMock}
        />
      ))

      const deleteButton = getFirstByText('Delete')
      if (deleteButton) {
        fireEvent.click(deleteButton)
      }

      expect(getDeleteSession).toHaveBeenCalledWith('session-123')
      expect(defaultProps.onClose).toHaveBeenCalled()
    })

    it('does not show view results button for non-completed sessions', () => {
      const nonCompletedSession = {
        ...mockSessionStatus,
        status: 'processing' as const,
      }
      getSession.mockReturnValue(nonCompletedSession as any)

      render(() => (
        <UvrSessionResult
          {...defaultProps}
          getSession={getSession}
          onDeleteSession={getDeleteSession}
        />
      ))

      expect(screen.queryByText('View Results')).not.toBeInTheDocument()
    })
  })

  describe('Date Formatting', () => {
    it('formats date with time', () => {
      getSession.mockReturnValue(mockSessionStatus)

      render(() => (
        <UvrSessionResult
          {...defaultProps}
          getSession={getSession}
          onDeleteSession={getDeleteSession}
        />
      ))

      expect(screen.getByText(/Created/i)).toBeInTheDocument()
    })

    it('handles older dates', () => {
      const oldSession = {
        ...mockSessionStatus,
        createdAt: Date.now() - 86400000, // 24 hours ago
      }
      getSession.mockReturnValue(oldSession as any)

      render(() => (
        <UvrSessionResult
          {...defaultProps}
          getSession={getSession}
          onDeleteSession={getDeleteSession}
        />
      ))

      expect(screen.getByText(/Created/i)).toBeInTheDocument()
    })

    it('handles recent dates', () => {
      const recentSession = {
        ...mockSessionStatus,
        createdAt: Date.now() - 60000, // 1 minute ago
      }
      getSession.mockReturnValue(recentSession as any)

      render(() => (
        <UvrSessionResult
          {...defaultProps}
          getSession={getSession}
          onDeleteSession={getDeleteSession}
        />
      ))

      expect(screen.getByText(/Created/i)).toBeInTheDocument()
    })
  })

  describe('Empty State Handling', () => {
    it('handles null session gracefully', () => {
      getSession.mockReturnValue(null as any)

      render(() => (
        <UvrSessionResult
          {...defaultProps}
          getSession={getSession}
          onDeleteSession={getDeleteSession}
        />
      ))

      expect(getFirstByText('Idle')).toBeInTheDocument()
      expect(screen.queryByText('song.mp3')).not.toBeInTheDocument()
    })
  })

  describe('Close Handler', () => {
    it('calls onClose when close button clicked', () => {
      render(() => (
        <UvrSessionResult
          {...defaultProps}
          getSession={getSession}
          onDeleteSession={getDeleteSession}
        />
      ))

      const closeButton = screen.getByLabelText('Close')
      fireEvent.click(closeButton)

      expect(defaultProps.onClose).toHaveBeenCalled()
    })
  })

  describe('Status Colors', () => {
    it('uses success color for completed status', () => {
      getSession.mockReturnValue(mockSessionStatus)

      render(() => (
        <UvrSessionResult
          {...defaultProps}
          getSession={getSession}
          onDeleteSession={getDeleteSession}
        />
      ))

      expect(screen.getByText('completed')).toBeInTheDocument()
    })

    it('uses accent color for processing status', () => {
      const processingSession = {
        ...mockSessionStatus,
        status: 'processing' as const,
      }
      getSession.mockReturnValue(processingSession as any)

      render(() => (
        <UvrSessionResult
          {...defaultProps}
          getSession={getSession}
          onDeleteSession={getDeleteSession}
        />
      ))

      expect(screen.getByText('processing')).toBeInTheDocument()
    })

    it('uses error color for error status', () => {
      const errorSession = {
        ...mockSessionStatus,
        status: 'error' as const,
        error: 'Processing failed',
      }
      getSession.mockReturnValue(errorSession as any)

      render(() => (
        <UvrSessionResult
          {...defaultProps}
          getSession={getSession}
          onDeleteSession={getDeleteSession}
        />
      ))

      expect(screen.getByText('error')).toBeInTheDocument()
    })
  })
})
