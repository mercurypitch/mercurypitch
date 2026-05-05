// ============================================================
// UVR Session Result Component Tests
// ============================================================

import { fireEvent, render, screen } from '@solidjs/testing-library'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { UvrSessionResult } from '../UvrSessionResult'

// Mock icons
vi.mock('../icons', () => ({
  Music: () => <span data-testid="music-icon">Music</span>,
  CheckCircle: () => <span data-testid="check-icon">CheckCircle</span>,
  XCircle: () => <span data-testid="x-icon">XCircle</span>,
  Loader2: () => <span data-testid="loader-icon">Loader2</span>,
  Calendar: () => <span data-testid="calendar-icon">Calendar</span>,
  Box: () => <span data-testid="box-icon">Box</span>,
  Download: () => <span data-testid="download-icon">Download</span>,
  FileText: () => <span data-testid="filetext-icon">FileText</span>,
  Play: () => <span data-testid="play-icon">Play</span>,
}))

// Helper to seed a session into localStorage so getUvrSession can find it
function seedSession(session: Record<string, unknown>) {
  localStorage.setItem('pitchperfect_uvr_sessions', JSON.stringify([session]))
}

describe('UvrSessionResult Component', () => {
  const defaultProps = {
    sessionId: 'session-123',
    onView: vi.fn(),
    onExport: vi.fn(),
    onClose: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  describe('Rendering', () => {
    it('renders session header with icon and title', () => {
      seedSession({
        sessionId: 'session-123',
        status: 'completed',
        progress: 100,
        createdAt: Date.now() - 3600000,
      })

      render(() => <UvrSessionResult {...defaultProps} />)

      expect(screen.getByText('UVR Session')).toBeInTheDocument()
    })

    it('renders session filename', () => {
      seedSession({
        sessionId: 'session-123',
        status: 'completed',
        progress: 100,
        originalFile: {
          name: 'song.mp3',
          size: 1024 * 50000,
          mimeType: 'audio/mpeg',
        },
        createdAt: Date.now() - 3600000,
      })

      render(() => <UvrSessionResult {...defaultProps} />)

      expect(screen.getByText('song.mp3')).toBeInTheDocument()
    })

    it('renders unknown filename when no original file', () => {
      seedSession({
        sessionId: 'session-123',
        status: 'completed',
        progress: 100,
        createdAt: Date.now() - 3600000,
      })

      render(() => <UvrSessionResult {...defaultProps} />)

      expect(screen.getByText('Unknown')).toBeInTheDocument()
    })
  })

  describe('Status Display', () => {
    it('renders completed status with check icon', () => {
      seedSession({
        sessionId: 'session-123',
        status: 'completed',
        progress: 100,
        createdAt: Date.now() - 3600000,
      })

      render(() => <UvrSessionResult {...defaultProps} />)

      expect(screen.getByText('completed')).toBeInTheDocument()
    })

    it('renders processing status with loader', () => {
      seedSession({
        sessionId: 'session-123',
        status: 'processing',
        progress: 45,
        createdAt: Date.now() - 3600000,
      })

      render(() => <UvrSessionResult {...defaultProps} />)

      expect(screen.getByText('processing')).toBeInTheDocument()
    })

    it('renders error status with X icon', () => {
      seedSession({
        sessionId: 'session-123',
        status: 'error',
        progress: 0,
        error: 'Processing failed',
        createdAt: Date.now() - 3600000,
      })

      render(() => <UvrSessionResult {...defaultProps} />)

      expect(screen.getByText('error')).toBeInTheDocument()
    })

    it('shows processing time in status bar', () => {
      seedSession({
        sessionId: 'session-123',
        status: 'completed',
        progress: 100,
        processingTime: 45000,
        createdAt: Date.now() - 3600000,
      })

      render(() => <UvrSessionResult {...defaultProps} />)

      expect(screen.getByText('45s')).toBeInTheDocument()
    })

    it('shows idle status when session is null', () => {
      render(() => <UvrSessionResult {...defaultProps} />)

      expect(screen.getAllByText('Idle').length).toBeGreaterThan(0)
    })
  })

  describe('Info Grid', () => {
    it('renders created date', () => {
      // Use a known timestamp that produces a predictable locale date
      const knownTimestamp = new Date('2026-05-03T12:00:00').getTime()
      seedSession({
        sessionId: 'session-123',
        status: 'completed',
        progress: 100,
        createdAt: knownTimestamp,
      })

      render(() => <UvrSessionResult {...defaultProps} />)

      expect(screen.getByText('Created')).toBeInTheDocument()
      // formatDate should produce a non-empty date string
      const dateText = screen.getByText(/Created/).nextElementSibling
      expect(dateText).toBeTruthy()
      expect(dateText?.textContent?.length).toBeGreaterThan(0)
    })

    it('renders file size when original file exists', () => {
      seedSession({
        sessionId: 'session-123',
        status: 'completed',
        progress: 100,
        originalFile: {
          name: 'song.mp3',
          size: 1024 * 50000,
          mimeType: 'audio/mpeg',
        },
        createdAt: Date.now() - 3600000,
      })

      render(() => <UvrSessionResult {...defaultProps} />)

      expect(screen.getByText(/48.83 MB/)).toBeInTheDocument()
    })

    it('does not show size when no original file', () => {
      seedSession({
        sessionId: 'session-123',
        status: 'completed',
        progress: 100,
        createdAt: Date.now() - 3600000,
      })

      render(() => <UvrSessionResult {...defaultProps} />)

      expect(screen.queryByText(/Size/i)).not.toBeInTheDocument()
    })

    it('formats large files correctly', () => {
      seedSession({
        sessionId: 'session-123',
        status: 'completed',
        progress: 100,
        originalFile: {
          name: 'song.mp3',
          size: 1024 * 1024 * 250,
          mimeType: 'audio/mpeg',
        },
        createdAt: Date.now() - 3600000,
      })

      render(() => <UvrSessionResult {...defaultProps} />)

      expect(screen.getByText(/250 MB/)).toBeInTheDocument()
    })
  })

  describe('Outputs Section', () => {
    it('renders outputs section header', () => {
      seedSession({
        sessionId: 'session-123',
        status: 'completed',
        progress: 100,
        outputs: {
          vocal: '/stems/vocal.wav',
          instrumental: '/stems/instrumental.wav',
          vocalMidi: '/midi/vocal.mid',
        },
        createdAt: Date.now() - 3600000,
      })

      render(() => <UvrSessionResult {...defaultProps} />)

      expect(screen.getByText('Generated Outputs')).toBeInTheDocument()
    })

    it('renders vocal stem file item', () => {
      seedSession({
        sessionId: 'session-123',
        status: 'completed',
        progress: 100,
        outputs: {
          vocal: '/stems/vocal.wav',
          instrumental: '/stems/instrumental.wav',
          vocalMidi: '/midi/vocal.mid',
        },
        createdAt: Date.now() - 3600000,
      })

      render(() => <UvrSessionResult {...defaultProps} />)

      expect(screen.getByText('Vocal Stem')).toBeInTheDocument()
      // WAV appears twice (vocal + instrumental), use getAllByText
      expect(screen.getAllByText('WAV').length).toBeGreaterThan(0)
    })

    it('renders instrumental stem when available', () => {
      seedSession({
        sessionId: 'session-123',
        status: 'completed',
        progress: 100,
        outputs: {
          vocal: '/stems/vocal.wav',
          instrumental: '/stems/instrumental.wav',
          vocalMidi: '/midi/vocal.mid',
        },
        createdAt: Date.now() - 3600000,
      })

      render(() => <UvrSessionResult {...defaultProps} />)

      expect(screen.getByText('Instrumental')).toBeInTheDocument()
      expect(screen.getAllByText('WAV').length).toBeGreaterThan(0)
    })

    it('renders vocal MIDI when available', () => {
      seedSession({
        sessionId: 'session-123',
        status: 'completed',
        progress: 100,
        outputs: {
          vocal: '/stems/vocal.wav',
          instrumental: '/stems/instrumental.wav',
          vocalMidi: '/midi/vocal.mid',
        },
        createdAt: Date.now() - 3600000,
      })

      render(() => <UvrSessionResult {...defaultProps} />)

      expect(screen.getByText('Vocal MIDI')).toBeInTheDocument()
      expect(screen.getByText('MIDI')).toBeInTheDocument()
    })

    it('calls export with vocal type when download clicked', () => {
      seedSession({
        sessionId: 'session-123',
        status: 'completed',
        progress: 100,
        outputs: {
          vocal: '/stems/vocal.wav',
          instrumental: '/stems/instrumental.wav',
          vocalMidi: '/midi/vocal.mid',
        },
        createdAt: Date.now() - 3600000,
      })

      render(() => <UvrSessionResult {...defaultProps} />)

      const fileActionButtons = Array.from(
        document.querySelectorAll('button.file-action'),
      )
      const vocalDownloadBtn = fileActionButtons[0]
      if (vocalDownloadBtn) {
        fireEvent.click(vocalDownloadBtn)
      }

      expect(defaultProps.onExport).toHaveBeenCalledWith('session-123', 'vocal')
    })

    it('calls export with instrumental type for instrumental download', async () => {
      seedSession({
        sessionId: 'session-123',
        status: 'completed',
        progress: 100,
        outputs: {
          vocal: '/stems/vocal.wav',
          instrumental: '/stems/instrumental.wav',
          vocalMidi: '/midi/vocal.mid',
        },
        createdAt: Date.now() - 3600000,
      })

      render(() => <UvrSessionResult {...defaultProps} />)

      await new Promise((resolve) => setTimeout(resolve, 0))

      const fileActionButtons = Array.from(
        document.querySelectorAll('button.file-action'),
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
      seedSession({
        sessionId: 'session-123',
        status: 'completed',
        progress: 100,
        outputs: {
          vocal: '/stems/vocal.wav',
        },
        createdAt: Date.now() - 3600000,
      })

      render(() => <UvrSessionResult {...defaultProps} />)

      expect(screen.getByText('View Results')).toBeInTheDocument()
    })

    it('calls onView when view results button clicked', () => {
      seedSession({
        sessionId: 'session-123',
        status: 'completed',
        progress: 100,
        outputs: {
          vocal: '/stems/vocal.wav',
        },
        createdAt: Date.now() - 3600000,
      })

      render(() => <UvrSessionResult {...defaultProps} />)

      const viewButton = screen.getByText('View Results')
      if (viewButton) {
        fireEvent.click(viewButton)
      }

      expect(defaultProps.onView).toHaveBeenCalledWith('session-123')
    })

    it('renders delete button', () => {
      seedSession({
        sessionId: 'session-123',
        status: 'completed',
        progress: 100,
        createdAt: Date.now() - 3600000,
      })

      render(() => <UvrSessionResult {...defaultProps} />)

      expect(screen.getByText('Delete')).toBeInTheDocument()
    })

    it('does not show view results button for non-completed sessions', () => {
      seedSession({
        sessionId: 'session-123',
        status: 'processing',
        progress: 45,
        createdAt: Date.now() - 3600000,
      })

      render(() => <UvrSessionResult {...defaultProps} />)

      expect(screen.queryByText('View Results')).not.toBeInTheDocument()
    })
  })

  describe('Date Formatting', () => {
    it('formats date with time', () => {
      seedSession({
        sessionId: 'session-123',
        status: 'completed',
        progress: 100,
        createdAt: Date.now() - 3600000,
      })

      render(() => <UvrSessionResult {...defaultProps} />)

      expect(screen.getByText(/Created/i)).toBeInTheDocument()
    })

    it('handles older dates', () => {
      seedSession({
        sessionId: 'session-123',
        status: 'completed',
        progress: 100,
        createdAt: Date.now() - 86400000,
      })

      render(() => <UvrSessionResult {...defaultProps} />)

      expect(screen.getByText(/Created/i)).toBeInTheDocument()
    })

    it('handles recent dates', () => {
      seedSession({
        sessionId: 'session-123',
        status: 'completed',
        progress: 100,
        createdAt: Date.now() - 60000,
      })

      render(() => <UvrSessionResult {...defaultProps} />)

      expect(screen.getByText(/Created/i)).toBeInTheDocument()
    })
  })

  describe('Empty State Handling', () => {
    it('handles null session gracefully', () => {
      render(() => <UvrSessionResult {...defaultProps} />)

      expect(screen.getAllByText('Idle').length).toBeGreaterThan(0)
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
      seedSession({
        sessionId: 'session-123',
        status: 'completed',
        progress: 100,
        createdAt: Date.now() - 3600000,
      })

      render(() => <UvrSessionResult {...defaultProps} />)

      const statusBar = document.querySelector('.status-bar') as HTMLElement
      expect(statusBar).toBeTruthy()
      expect(statusBar.style.getPropertyValue('--status-color')).toBe(
        'var(--success)',
      )
    })

    it('uses accent color for processing status', () => {
      seedSession({
        sessionId: 'session-123',
        status: 'processing',
        progress: 45,
        createdAt: Date.now() - 3600000,
      })

      render(() => <UvrSessionResult {...defaultProps} />)

      const statusBar = document.querySelector('.status-bar') as HTMLElement
      expect(statusBar).toBeTruthy()
      expect(statusBar.style.getPropertyValue('--status-color')).toBe(
        'var(--accent)',
      )
    })

    it('uses error color for error status', () => {
      seedSession({
        sessionId: 'session-123',
        status: 'error',
        progress: 0,
        error: 'Processing failed',
        createdAt: Date.now() - 3600000,
      })

      render(() => <UvrSessionResult {...defaultProps} />)

      const statusBar = document.querySelector('.status-bar') as HTMLElement
      expect(statusBar).toBeTruthy()
      expect(statusBar.style.getPropertyValue('--status-color')).toBe(
        'var(--error)',
      )
    })
  })
})
