// ============================================================
// UVR Session Result Component Tests
// ============================================================

import { fireEvent, render, screen } from '@solidjs/testing-library'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { saveAllUvrSessions } from '@/stores/app-store'
import type { UvrSession } from '@/types/uvr'
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
  Trash2: () => <span data-testid="trash-icon">Trash2</span>,
  Voice: () => <span data-testid="voice-icon">Voice</span>,
  Headphones: () => <span data-testid="headphones-icon">Headphones</span>,
  Midi: () => <span data-testid="midi-icon">Midi</span>,
  SlidersHorizontal: () => (
    <span data-testid="sliders-icon">SlidersHorizontal</span>
  ),
  Share: () => <span data-testid="share-icon">Share</span>,
  RotateCcw: () => <span data-testid="rotate-icon">RotateCcw</span>,
  Cpu: () => <span data-testid="cpu-icon">Cpu</span>,
  Server: () => <span data-testid="server-icon">Server</span>,
  Zap: () => <span data-testid="zap-icon">Zap</span>,
  X: () => <span data-testid="x-icon">X</span>,
  ChevronDown: () => <span data-testid="chevron-icon">ChevronDown</span>,
  Plus: () => <span data-testid="plus-icon">Plus</span>,
  Repeat: () => <span data-testid="repeat-icon">Repeat</span>,
}))

// Helper to seed a session into the store so getUvrSession can find it
function seedSession(session: Record<string, unknown>) {
  saveAllUvrSessions([session as unknown as UvrSession])
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
    saveAllUvrSessions([])
  })

  describe('Rendering', () => {
    it('renders session header with the song title', () => {
      seedSession({
        sessionId: 'session-123',
        status: 'completed',
        progress: 100,
        originalFile: {
          name: 'my-song.mp3',
          size: 1024 * 50000,
          mimeType: 'audio/mpeg',
        },
        createdAt: Date.now() - 3600000,
      })

      render(() => <UvrSessionResult {...defaultProps} />)

      expect(screen.getByText('my-song.mp3')).toBeInTheDocument()
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

      expect(screen.getByText('Completed')).toBeInTheDocument()
    })

    it('renders processing status with loader', () => {
      seedSession({
        sessionId: 'session-123',
        status: 'processing',
        progress: 45,
        createdAt: Date.now() - 3600000,
      })

      render(() => <UvrSessionResult {...defaultProps} />)

      expect(screen.getByText(/Processing\.\.\./)).toBeInTheDocument()
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

      expect(screen.getByText('Processing failed')).toBeInTheDocument()
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
      const knownTimestamp = new Date('2026-05-03T12:00:00').getTime()
      seedSession({
        sessionId: 'session-123',
        status: 'completed',
        progress: 100,
        createdAt: knownTimestamp,
      })

      render(() => <UvrSessionResult {...defaultProps} />)

      expect(screen.getByText('Created')).toBeInTheDocument()
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

      expect(screen.getByText('Available Stems')).toBeInTheDocument()
    })

    it('renders vocal stem pill', () => {
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

    it('renders instrumental stem pill when available', () => {
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

    it('renders vocal MIDI pill when available', () => {
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

    it('toggles stem selection on click', () => {
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

      const vocalPill = screen.getByText('Vocal')
      fireEvent.click(vocalPill)
      // Vocal pill should now have the selected class
      const button = vocalPill.closest('button')
      expect(button?.classList.contains('stem-pill-selected')).toBe(true)
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
      fireEvent.click(viewButton)

      expect(defaultProps.onView).toHaveBeenCalledWith('session-123')
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

  describe('Delete Buttons', () => {
    it('renders top-right trash delete button', () => {
      seedSession({
        sessionId: 'session-123',
        status: 'completed',
        progress: 100,
        createdAt: Date.now() - 3600000,
      })

      render(() => <UvrSessionResult {...defaultProps} />)

      expect(screen.getByLabelText('Delete session')).toBeInTheDocument()
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

  describe('HQ re-run', () => {
    const localCompleted = {
      sessionId: 'session-123',
      status: 'completed',
      progress: 100,
      processingMode: 'local',
      originalFile: {
        name: 'song.mp3',
        size: 1024 * 1000,
        mimeType: 'audio/mpeg',
      },
      createdAt: Date.now() - 3600000,
    }

    it('shows the HQ button for a completed browser session', () => {
      seedSession(localCompleted)
      render(() => <UvrSessionResult {...defaultProps} onRerunHq={vi.fn()} />)
      expect(document.querySelector('.session-result-btn-hq')).toBeTruthy()
    })

    it('hides the HQ button for server-processed sessions', () => {
      seedSession({ ...localCompleted, processingMode: 'server' })
      render(() => <UvrSessionResult {...defaultProps} onRerunHq={vi.fn()} />)
      expect(document.querySelector('.session-result-btn-hq')).toBeNull()
    })

    it('hides the HQ button for manual-stem sessions', () => {
      seedSession({ ...localCompleted, provider: 'manual' })
      render(() => <UvrSessionResult {...defaultProps} onRerunHq={vi.fn()} />)
      expect(document.querySelector('.session-result-btn-hq')).toBeNull()
    })

    it('hides the HQ button when no handler is wired', () => {
      seedSession(localCompleted)
      render(() => <UvrSessionResult {...defaultProps} />)
      expect(document.querySelector('.session-result-btn-hq')).toBeNull()
    })

    it('fires onRerunHq with same/new from the menu options', () => {
      const onRerunHq = vi.fn()
      seedSession(localCompleted)
      render(() => <UvrSessionResult {...defaultProps} onRerunHq={onRerunHq} />)

      fireEvent.click(document.querySelector('.session-result-btn-hq')!)
      const items = document.querySelectorAll('.session-hq-rerun-item')
      expect(items.length).toBe(2)

      fireEvent.click(items[0])
      expect(onRerunHq).toHaveBeenLastCalledWith('session-123', 'same')

      fireEvent.click(document.querySelector('.session-result-btn-hq')!)
      fireEvent.click(document.querySelectorAll('.session-hq-rerun-item')[1])
      expect(onRerunHq).toHaveBeenLastCalledWith('session-123', 'new')
      expect(onRerunHq).toHaveBeenCalledTimes(2)
    })
  })
})
