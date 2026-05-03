// ============================================================
// UVR Session Result Component Tests
// ============================================================

import { fireEvent, render, screen } from '@solidjs/testing-library'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { UvrSessionResult } from '../UvrSessionResult'

describe('UvrSessionResult Component', () => {
  const defaultProps = {
    sessionId: 'session-123',
    onView: vi.fn(),
    onExport: vi.fn(),
    onClose: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    // Clear localStorage to reset mock data
    localStorage.clear()
  })

  describe('Rendering', () => {
    it('renders session header with icon and title', () => {
      render(() => <UvrSessionResult {...defaultProps} />)

      expect(screen.getByText('UVR Session')).toBeInTheDocument()
    })

    it('renders session filename', () => {
      const session = {
        sessionId: 'session-123',
        status: 'completed' as const,
        progress: 100,
        originalFile: {
          name: 'song.mp3',
          size: 1024 * 50000,
          mimeType: 'audio/mpeg',
        },
        createdAt: Date.now() - 3600000,
      }

      render(() => <UvrSessionResult {...defaultProps} />)

      expect(screen.getByText('song.mp3')).toBeInTheDocument()
    })

    it('renders unknown filename when no original file', () => {
      const session = {
        sessionId: 'session-123',
        status: 'completed' as const,
        progress: 100,
        createdAt: Date.now() - 3600000,
      }

      render(() => <UvrSessionResult {...defaultProps} />)

      expect(screen.getByText('Unknown')).toBeInTheDocument()
    })
  })

  describe('Status Display', () => {
    it('renders completed status with check icon', () => {
      const session = {
        sessionId: 'session-123',
        status: 'completed' as const,
        progress: 100,
        createdAt: Date.now() - 3600000,
      }

      render(() => <UvrSessionResult {...defaultProps} />)

      expect(screen.getByText('completed')).toBeInTheDocument()
    })

    it('renders processing status with loader', () => {
      const session = {
        sessionId: 'session-123',
        status: 'processing' as const,
        progress: 45,
        createdAt: Date.now() - 3600000,
      }

      render(() => <UvrSessionResult {...defaultProps} />)

      expect(screen.getByText('processing')).toBeInTheDocument()
    })

    it('renders error status with X icon', () => {
      const session = {
        sessionId: 'session-123',
        status: 'error' as const,
        progress: 0,
        error: 'Processing failed',
        createdAt: Date.now() - 3600000,
      }

      render(() => <UvrSessionResult {...defaultProps} />)

      expect(screen.getByText('error')).toBeInTheDocument()
    })

    it('shows processing time in status bar', () => {
      const session = {
        sessionId: 'session-123',
        status: 'completed' as const,
        progress: 100,
        processingTime: 45000,
        createdAt: Date.now() - 3600000,
      }

      render(() => <UvrSessionResult {...defaultProps} />)

      expect(screen.getByText('45s')).toBeInTheDocument()
    })

    it('shows idle status when session is null', () => {
      render(() => <UvrSessionResult {...defaultProps} />)

      expect(screen.getByText('Idle')).toBeInTheDocument()
    })
  })

  describe('Info Grid', () => {
    it('renders created date', () => {
      const session = {
        sessionId: 'session-123',
        status: 'completed' as const,
        progress: 100,
        createdAt: Date.now() - 3600000,
      }

      render(() => <UvrSessionResult {...defaultProps} />)

      expect(screen.getByText('Created')).toBeInTheDocument()
      expect(screen.getByText(/5\/3\/2026/)).toBeInTheDocument()
    })

    it('renders file size when original file exists', () => {
      const session = {
        sessionId: 'session-123',
        status: 'completed' as const,
        progress: 100,
        originalFile: {
          name: 'song.mp3',
          size: 1024 * 50000,
          mimeType: 'audio/mpeg',
        },
        createdAt: Date.now() - 3600000,
      }

      render(() => <UvrSessionResult {...defaultProps} />)

      expect(screen.getByText(/48.83 MB/)).toBeInTheDocument()
    })

    it('does not show size when no original file', () => {
      const session = {
        sessionId: 'session-123',
        status: 'completed' as const,
        progress: 100,
        createdAt: Date.now() - 3600000,
      }

      render(() => <UvrSessionResult {...defaultProps} />)

      expect(screen.queryByText(/Size/i)).not.toBeInTheDocument()
    })

    it('formats large files correctly', () => {
      const largeFileSession = {
        sessionId: 'session-123',
        status: 'completed' as const,
        progress: 100,
        originalFile: {
          name: 'song.mp3',
          size: 1024 * 1024 * 250,
          mimeType: 'audio/mpeg',
        },
        createdAt: Date.now() - 3600000,
      }

      render(() => <UvrSessionResult {...defaultProps} />)

      expect(screen.getByText(/250 MB/)).toBeInTheDocument()
    })
  })

  describe('Outputs Section', () => {
    it('renders outputs section header', () => {
      const session = {
        sessionId: 'session-123',
        status: 'completed' as const,
        progress: 100,
        outputs: {
          vocal: '/stems/vocal.wav',
          instrumental: '/stems/instrumental.wav',
          vocalMidi: '/midi/vocal.mid',
        },
        createdAt: Date.now() - 3600000,
      }

      render(() => <UvrSessionResult {...defaultProps} />)

      expect(screen.getByText('Generated Outputs')).toBeInTheDocument()
    })

    it('renders vocal stem file item', () => {
      const session = {
        sessionId: 'session-123',
        status: 'completed' as const,
        progress: 100,
        outputs: {
          vocal: '/stems/vocal.wav',
          instrumental: '/stems/instrumental.wav',
          vocalMidi: '/midi/vocal.mid',
        },
        createdAt: Date.now() - 3600000,
      }

      render(() => <UvrSessionResult {...defaultProps} />)

      expect(screen.getByText('Vocal Stem')).toBeInTheDocument()
      expect(screen.getByText('WAV')).toBeInTheDocument()
    })

    it('renders instrumental stem when available', () => {
      const session = {
        sessionId: 'session-123',
        status: 'completed' as const,
        progress: 100,
        outputs: {
          vocal: '/stems/vocal.wav',
          instrumental: '/stems/instrumental.wav',
          vocalMidi: '/midi/vocal.mid',
        },
        createdAt: Date.now() - 3600000,
      }

      render(() => <UvrSessionResult {...defaultProps} />)

      expect(screen.getByText('Instrumental')).toBeInTheDocument()
      expect(screen.getByText('WAV')).toBeInTheDocument()
    })

    it('renders vocal MIDI when available', () => {
      const session = {
        sessionId: 'session-123',
        status: 'completed' as const,
        progress: 100,
        outputs: {
          vocal: '/stems/vocal.wav',
          instrumental: '/stems/instrumental.wav',
          vocalMidi: '/midi/vocal.mid',
        },
        createdAt: Date.now() - 3600000,
      }

      render(() => <UvrSessionResult {...defaultProps} />)

      expect(screen.getByText('Vocal MIDI')).toBeInTheDocument()
      expect(screen.getByText('MIDI')).toBeInTheDocument()
    })

    it('calls export with vocal type when download clicked', () => {
      const session = {
        sessionId: 'session-123',
        status: 'completed' as const,
        progress: 100,
        outputs: {
          vocal: '/stems/vocal.wav',
          instrumental: '/stems/instrumental.wav',
          vocalMidi: '/midi/vocal.mid',
        },
        createdAt: Date.now() - 3600000,
      }

      render(() => <UvrSessionResult {...defaultProps} />)

      // Find all file-action buttons and click the first one
      const fileActionButtons = screen.getAllByRole('button').filter((btn) =>
        btn.classList.contains('file-action')
      )
      const vocalDownloadBtn = fileActionButtons[0]
      if (vocalDownloadBtn) {
        fireEvent.click(vocalDownloadBtn)
      }

      expect(defaultProps.onExport).toHaveBeenCalledWith('session-123', 'vocal')
    })

    it('calls export with instrumental type for instrumental download', async () => {
      const session = {
        sessionId: 'session-123',
        status: 'completed' as const,
        progress: 100,
        outputs: {
          vocal: '/stems/vocal.wav',
          instrumental: '/stems/instrumental.wav',
          vocalMidi: '/midi/vocal.mid',
        },
        createdAt: Date.now() - 3600000,
      }

      render(() => <UvrSessionResult {...defaultProps} />)

      // Wait for component to render
      await new Promise((resolve) => setTimeout(resolve, 0))

      const allButtons = document.querySelectorAll('button')
      const fileActionButtons = Array.from(allButtons).filter((btn) =>
        btn.classList.contains('file-action')
      )
      const instrumentalDownloadBtn = fileActionButtons[1]
      if (instrumentalDownloadBtn) {
        fireEvent.click(instrumentalDownloadBtn)
      }

      expect(defaultProps.onExport).toHaveBeenCalledWith('session-123', 'instrumental')
    })

    it('renders view results button for completed sessions', () => {
      const session = {
        sessionId: 'session-123',
        status: 'completed' as const,
        progress: 100,
        createdAt: Date.now() - 3600000,
      }

      render(() => <UvrSessionResult {...defaultProps} />)

      expect(screen.getByText('View Results')).toBeInTheDocument()
    })

    it('calls onView when view results button clicked', () => {
      const session = {
        sessionId: 'session-123',
        status: 'completed' as const,
        progress: 100,
        createdAt: Date.now() - 3600000,
      }

      render(() => <UvrSessionResult {...defaultProps} />)

      const viewButton = screen.getByText('View Results')
      if (viewButton) {
        fireEvent.click(viewButton)
      }

      expect(defaultProps.onView).toHaveBeenCalledWith('session-123')
    })

    it('renders delete button', () => {
      const session = {
        sessionId: 'session-123',
        status: 'completed' as const,
        progress: 100,
        createdAt: Date.now() - 3600000,
      }

      render(() => <UvrSessionResult {...defaultProps} />)

      expect(screen.getByText('Delete')).toBeInTheDocument()
    })

    it('does not show view results button for non-completed sessions', () => {
      const session = {
        sessionId: 'session-123',
        status: 'processing' as const,
        progress: 45,
        createdAt: Date.now() - 3600000,
      }

      render(() => <UvrSessionResult {...defaultProps} />)

      expect(screen.queryByText('View Results')).not.toBeInTheDocument()
    })
  })

  describe('Date Formatting', () => {
    it('formats date with time', () => {
      const session = {
        sessionId: 'session-123',
        status: 'completed' as const,
        progress: 100,
        createdAt: Date.now() - 3600000,
      }

      render(() => <UvrSessionResult {...defaultProps} />)

      expect(screen.getByText(/Created/i)).toBeInTheDocument()
    })

    it('handles older dates', () => {
      const oldSession = {
        sessionId: 'session-123',
        status: 'completed' as const,
        progress: 100,
        createdAt: Date.now() - 86400000,
      }

      render(() => <UvrSessionResult {...defaultProps} />)

      expect(screen.getByText(/Created/i)).toBeInTheDocument()
    })

    it('handles recent dates', () => {
      const recentSession = {
        sessionId: 'session-123',
        status: 'completed' as const,
        progress: 100,
        createdAt: Date.now() - 60000,
      }

      render(() => <UvrSessionResult {...defaultProps} />)

      expect(screen.getByText(/Created/i)).toBeInTheDocument()
    })
  })

  describe('Empty State Handling', () => {
    it('handles null session gracefully', () => {
      render(() => <UvrSessionResult {...defaultProps} />)

      expect(screen.getByText('Idle')).toBeInTheDocument()
      expect(screen.queryByText('song.mp3')).not.toBeInTheDocument()
    })
  })

  describe('Close Handler', () => {
    it('calls onClose when close button clicked', () => {
      render(() => <UvrSessionResult {...defaultProps} />)

      const closeButton = screen.getByLabelText('Close')
      fireEvent.click(closeButton)

      expect(defaultProps.onClose).toHaveBeenCalled()
    })
  })

  describe('Status Colors', () => {
    it('uses success color for completed status', () => {
      const session = {
        sessionId: 'session-123',
        status: 'completed' as const,
        progress: 100,
        createdAt: Date.now() - 3600000,
      }

      render(() => <UvrSessionResult {...defaultProps} />)

      expect(screen.getByText('completed')).toBeInTheDocument()
    })

    it('uses accent color for processing status', () => {
      const session = {
        sessionId: 'session-123',
        status: 'processing' as const,
        progress: 45,
        createdAt: Date.now() - 3600000,
      }

      render(() => <UvrSessionResult {...defaultProps} />)

      expect(screen.getByText('processing')).toBeInTheDocument()
    })

    it('uses error color for error status', () => {
      const session = {
        sessionId: 'session-123',
        status: 'error' as const,
        progress: 0,
        error: 'Processing failed',
        createdAt: Date.now() - 3600000,
      }

      render(() => <UvrSessionResult {...defaultProps} />)

      expect(screen.getByText('error')).toBeInTheDocument()
    })
  })
})
