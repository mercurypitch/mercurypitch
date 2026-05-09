// ============================================================
// UVR Result Viewer Component Tests
// ============================================================

import { fireEvent, render, screen } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { UvrResultViewer } from '../UvrResultViewer'

describe('UvrResultViewer Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  const mockOutputs = {
    vocal: '/stems/vocal.wav',
    instrumental: '/stems/instrumental.wav',
    vocalMidi: '/midi/vocal.mid',
  }

  const defaultProps = {
    outputs: mockOutputs,
    processingTime: 45000,
    onStartPractice: vi.fn(),
    onClose: vi.fn(),
  }

  describe('Header Rendering', () => {
    it('renders stems header with processing time', () => {
      render(() => <UvrResultViewer {...defaultProps} />)

      expect(screen.getByText('Stems')).toBeInTheDocument()
      expect(screen.getByText(/processed in 45s/)).toBeInTheDocument()
    })

    it('renders share button', () => {
      render(() => <UvrResultViewer {...defaultProps} />)

      expect(screen.getByText('Share')).toBeInTheDocument()
    })

    it('renders close button when onClose provided', () => {
      render(() => <UvrResultViewer {...defaultProps} />)

      expect(screen.getByLabelText('Close')).toBeInTheDocument()
    })

    it('does not render close button when onClose not provided', () => {
      render(() => <UvrResultViewer outputs={mockOutputs} />)

      expect(screen.queryByLabelText('Close')).not.toBeInTheDocument()
    })
  })

  describe('Stem Cards', () => {
    it('renders Vocal stem card', () => {
      render(() => <UvrResultViewer {...defaultProps} />)

      expect(screen.getByText('Vocal')).toBeInTheDocument()
      expect(screen.getAllByText('WAV').length).toBeGreaterThanOrEqual(1)
    })

    it('renders Instrumental stem card', () => {
      render(() => <UvrResultViewer {...defaultProps} />)

      expect(screen.getByText('Instrumental')).toBeInTheDocument()
    })

    it('renders Vocal MIDI stem card', () => {
      render(() => <UvrResultViewer {...defaultProps} />)

      expect(screen.getByText('Vocal MIDI')).toBeInTheDocument()
      expect(screen.getByText('MID')).toBeInTheDocument()
    })

    it('does not render Vocal card when no vocal output', () => {
      render(() => (
        <UvrResultViewer
          outputs={{ instrumental: '/stems/inst.wav' }}
          onStartPractice={vi.fn()}
        />
      ))

      expect(screen.queryByText('Vocal')).not.toBeInTheDocument()
    })

    it('does not render Instrumental card when no instrumental output', () => {
      render(() => (
        <UvrResultViewer
          outputs={{ vocal: '/stems/vocal.wav' }}
          onStartPractice={vi.fn()}
        />
      ))

      expect(screen.queryByText('Instrumental')).not.toBeInTheDocument()
    })

    it('renders MIDI card when vocal stem is present (generated on-the-fly)', () => {
      render(() => (
        <UvrResultViewer
          outputs={{
            vocal: '/stems/vocal.wav',
            instrumental: '/stems/inst.wav',
          }}
          onStartPractice={vi.fn()}
        />
      ))

      // Vocal MIDI card is shown whenever vocal stem is available,
      // since MIDI can be generated on-the-fly from the vocal audio.
      expect(screen.getByText('Vocal MIDI')).toBeInTheDocument()
    })

    it('shows duration and size metadata when provided', () => {
      render(() => (
        <UvrResultViewer
          outputs={mockOutputs}
          stemMeta={{
            vocal: { duration: 125, size: 1024 * 1024 * 5 },
          }}
          onStartPractice={vi.fn()}
        />
      ))

      expect(screen.getByText('2:05')).toBeInTheDocument()
      expect(screen.getByText('5.0 MB')).toBeInTheDocument()
    })
  })

  describe('Stem Card Actions', () => {
    it('Play button calls onStartPractice with vocal mode', () => {
      render(() => <UvrResultViewer {...defaultProps} />)

      const playButtons = screen.getAllByText('Play')
      fireEvent.click(playButtons[0])

      expect(defaultProps.onStartPractice).toHaveBeenCalledWith('vocal')
    })

    it('Play button calls onStartPractice with midi mode for MIDI stem', () => {
      render(() => <UvrResultViewer {...defaultProps} />)

      const playButtons = screen.getAllByText('Play')
      // Vocal MIDI card should be third
      fireEvent.click(playButtons[2])

      expect(defaultProps.onStartPractice).toHaveBeenCalledWith('midi')
    })

    it('renders Play and Mix buttons for each stem', () => {
      render(() => <UvrResultViewer {...defaultProps} />)

      // Play buttons: vocal, instrumental, vocal midi, full mix = 4
      const playButtons = screen.getAllByText('Play')
      expect(playButtons.length).toBe(4)
      // Mix button on full mix card
      expect(screen.getByText('Mix')).toBeInTheDocument()
    })

    it('does not call onStartPractice when not provided', () => {
      render(() => <UvrResultViewer outputs={mockOutputs} />)

      // Should not throw
      const playButtons = screen.getAllByText('Play')
      fireEvent.click(playButtons[0])
    })
  })

  describe('Full Mix Card', () => {
    it('renders Full Mix card when both vocal and instrumental exist', () => {
      render(() => <UvrResultViewer {...defaultProps} />)

      expect(screen.getByText('Full Mix')).toBeInTheDocument()
      expect(screen.getByText('Vocal + Instrumental')).toBeInTheDocument()
    })

    it('does not render Full Mix card when missing vocal', () => {
      render(() => (
        <UvrResultViewer
          outputs={{ instrumental: '/stems/inst.wav' }}
          onStartPractice={vi.fn()}
        />
      ))

      expect(screen.queryByText('Full Mix')).not.toBeInTheDocument()
    })

    it('does not render Full Mix card when missing instrumental', () => {
      render(() => (
        <UvrResultViewer
          outputs={{ vocal: '/stems/vocal.wav' }}
          onStartPractice={vi.fn()}
        />
      ))

      expect(screen.queryByText('Full Mix')).not.toBeInTheDocument()
    })

    it('Full Mix Play button calls onStartPractice with full mode', () => {
      render(() => <UvrResultViewer {...defaultProps} />)

      const playButtons = screen.getAllByText('Play')
      // Last Play button is Full Mix card
      const fullMixPlay = playButtons[playButtons.length - 1]
      fireEvent.click(fullMixPlay)

      expect(defaultProps.onStartPractice).toHaveBeenCalledWith('full')
    })
  })

  describe('Close Handler', () => {
    it('calls onClose when close button clicked', () => {
      render(() => <UvrResultViewer {...defaultProps} />)

      const closeButton = screen.getByLabelText('Close')
      fireEvent.click(closeButton)

      expect(defaultProps.onClose).toHaveBeenCalled()
    })
  })

  describe('Share', () => {
    it('copies share link to clipboard on click', async () => {
      const writeText = vi.fn().mockResolvedValue(undefined)
      Object.assign(navigator, { clipboard: { writeText } })

      render(() => (
        <UvrResultViewer {...defaultProps} sessionId="session-456" />
      ))

      fireEvent.click(screen.getByText('Share'))

      expect(writeText).toHaveBeenCalledWith(
        expect.stringContaining('#/uvr/session/session-456'),
      )
    })
  })

  describe('Empty State', () => {
    it('renders no stem cards when outputs is empty', () => {
      render(() => <UvrResultViewer outputs={{}} />)

      expect(screen.getByText('Stems')).toBeInTheDocument()
      expect(screen.queryByText('Vocal')).not.toBeInTheDocument()
      expect(screen.queryByText('Full Mix')).not.toBeInTheDocument()
    })
  })
})
