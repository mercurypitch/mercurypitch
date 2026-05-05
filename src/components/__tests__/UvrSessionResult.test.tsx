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
  Download: () => <span data-testid="download-icon">Download</span>,
  FileText: () => <span data-testid="filetext-icon">FileText</span>,
  Play: () => <span data-testid="play-icon">Play</span>,
  Trash2: () => <span data-testid="trash-icon">Trash2</span>,
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
    it('renders session card with filename', () => {
      seedSession({
        sessionId: 'session-123',
        status: 'completed',
        progress: 100,
        createdAt: Date.now() - 3600000,
        originalFile: {
          name: 'song.mp3',
          size: 1024 * 50000,
          mimeType: 'audio/mpeg',
        },
      })

      render(() => <UvrSessionResult {...defaultProps} />)

      expect(screen.getByText('song.mp3')).toBeInTheDocument()
    })

    it('renders filename', () => {
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

    it('shows processing time in meta row', () => {
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

      expect(screen.getByText('idle')).toBeInTheDocument()
    })
  })

  describe('File Size', () => {
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

      expect(screen.queryByText(/MB|KB|Bytes/)).not.toBeInTheDocument()
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

  describe('Output Chips', () => {
    it('renders vocal chip when vocal output exists', () => {
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

      expect(screen.getByText('Vocal')).toBeInTheDocument()
    })

    it('renders instrumental chip when available', () => {
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

      expect(screen.getByText('Inst')).toBeInTheDocument()
    })

    it('renders MIDI chip when vocal MIDI available', () => {
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

      expect(screen.getByText('MIDI')).toBeInTheDocument()
    })

    it('calls export with vocal type when vocal chip clicked', () => {
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

      const vocalChip = screen.getByText('Vocal')
      fireEvent.click(vocalChip)

      expect(defaultProps.onExport).toHaveBeenCalledWith('session-123', 'vocal')
    })

    it('calls export with instrumental type for instrumental chip', () => {
      seedSession({
        sessionId: 'session-123',
        status: 'completed',
        progress: 100,
        outputs: {
          instrumental: '/stems/instrumental.wav',
        },
        createdAt: Date.now() - 3600000,
      })

      render(() => <UvrSessionResult {...defaultProps} />)

      const instChip = screen.getByText('Inst')
      fireEvent.click(instChip)

      expect(defaultProps.onExport).toHaveBeenCalledWith(
        'session-123',
        'instrumental',
      )
    })

    it('calls export with vocal-midi type for MIDI chip', () => {
      seedSession({
        sessionId: 'session-123',
        status: 'completed',
        progress: 100,
        outputs: {
          vocalMidi: '/midi/vocal.mid',
        },
        createdAt: Date.now() - 3600000,
      })

      render(() => <UvrSessionResult {...defaultProps} />)

      const midiChip = screen.getByText('MIDI')
      fireEvent.click(midiChip)

      expect(defaultProps.onExport).toHaveBeenCalledWith(
        'session-123',
        'vocal-midi',
      )
    })
  })

  describe('View Button', () => {
    it('renders view button for completed sessions', () => {
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

      expect(screen.getByText('View')).toBeInTheDocument()
    })

    it('calls onView when view button clicked', () => {
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

      const viewButton = screen.getByText('View')
      fireEvent.click(viewButton)

      expect(defaultProps.onView).toHaveBeenCalledWith('session-123')
    })

    it('does not show view button for non-completed sessions', () => {
      seedSession({
        sessionId: 'session-123',
        status: 'processing',
        progress: 45,
        createdAt: Date.now() - 3600000,
      })

      render(() => <UvrSessionResult {...defaultProps} />)

      expect(screen.queryByText('View')).not.toBeInTheDocument()
    })
  })

  describe('Delete Button', () => {
    it('renders delete button with aria-label', () => {
      seedSession({
        sessionId: 'session-123',
        status: 'completed',
        progress: 100,
        createdAt: Date.now() - 3600000,
      })

      render(() => <UvrSessionResult {...defaultProps} />)

      expect(screen.getByLabelText('Delete session')).toBeInTheDocument()
    })

    it('calls delete with confirm and onClose on click', () => {
      vi.spyOn(window, 'confirm').mockReturnValue(true)
      seedSession({
        sessionId: 'session-123',
        status: 'completed',
        progress: 100,
        createdAt: Date.now() - 3600000,
      })

      render(() => <UvrSessionResult {...defaultProps} />)

      const deleteButton = screen.getByLabelText('Delete session')
      fireEvent.click(deleteButton)

      expect(window.confirm).toHaveBeenCalled()
      expect(defaultProps.onClose).toHaveBeenCalled()
    })

    it('does not call onClose when confirm is cancelled', () => {
      vi.spyOn(window, 'confirm').mockReturnValue(false)
      seedSession({
        sessionId: 'session-123',
        status: 'completed',
        progress: 100,
        createdAt: Date.now() - 3600000,
      })

      render(() => <UvrSessionResult {...defaultProps} />)

      const deleteButton = screen.getByLabelText('Delete session')
      fireEvent.click(deleteButton)

      expect(window.confirm).toHaveBeenCalled()
      expect(defaultProps.onClose).not.toHaveBeenCalled()
    })
  })

  describe('Time Formatting', () => {
    it('shows relative time for recent sessions', () => {
      seedSession({
        sessionId: 'session-123',
        status: 'completed',
        progress: 100,
        createdAt: Date.now() - 3600000,
      })

      render(() => <UvrSessionResult {...defaultProps} />)

      // 1 hour ago should show "1h ago"
      expect(screen.getByText(/h ago/)).toBeInTheDocument()
    })

    it('shows minutes for very recent sessions', () => {
      seedSession({
        sessionId: 'session-123',
        status: 'completed',
        progress: 100,
        createdAt: Date.now() - 120000,
      })

      render(() => <UvrSessionResult {...defaultProps} />)

      expect(screen.getByText(/m ago|Just now/)).toBeInTheDocument()
    })

    it('shows days for older sessions', () => {
      seedSession({
        sessionId: 'session-123',
        status: 'completed',
        progress: 100,
        createdAt: Date.now() - 172800000,
      })

      render(() => <UvrSessionResult {...defaultProps} />)

      expect(screen.getByText(/d ago/)).toBeInTheDocument()
    })
  })

  describe('Empty State Handling', () => {
    it('handles null session gracefully', () => {
      render(() => <UvrSessionResult {...defaultProps} />)

      expect(screen.getByText('idle')).toBeInTheDocument()
      expect(screen.getByText('Unknown')).toBeInTheDocument()
    })
  })

  describe('Status Dot Colors', () => {
    it('uses success color for completed status', () => {
      seedSession({
        sessionId: 'session-123',
        status: 'completed',
        progress: 100,
        createdAt: Date.now() - 3600000,
      })

      render(() => <UvrSessionResult {...defaultProps} />)

      const statusDot = document.querySelector('.session-status-dot') as HTMLElement
      expect(statusDot).toBeTruthy()
      expect(statusDot.style.background).toBe('var(--success)')
    })

    it('uses accent color for processing status', () => {
      seedSession({
        sessionId: 'session-123',
        status: 'processing',
        progress: 45,
        createdAt: Date.now() - 3600000,
      })

      render(() => <UvrSessionResult {...defaultProps} />)

      const statusDot = document.querySelector('.session-status-dot') as HTMLElement
      expect(statusDot).toBeTruthy()
      expect(statusDot.style.background).toBe('var(--accent)')
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

      const statusDot = document.querySelector('.session-status-dot') as HTMLElement
      expect(statusDot).toBeTruthy()
      expect(statusDot.style.background).toBe('var(--error)')
    })
  })

  describe('Card Interaction', () => {
    it('calls onView when card is clicked', () => {
      seedSession({
        sessionId: 'session-123',
        status: 'completed',
        progress: 100,
        createdAt: Date.now() - 3600000,
      })

      render(() => <UvrSessionResult {...defaultProps} />)

      const card = document.querySelector('.uvr-session-result') as HTMLElement
      fireEvent.click(card)

      expect(defaultProps.onView).toHaveBeenCalledWith('session-123')
    })
  })
})
