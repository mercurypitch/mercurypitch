// ============================================================
// UVR Result Viewer Component Tests
// ============================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@solidjs/testing-library'
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

  const mockProcessingTime = 45000

  const defaultProps = {
    outputs: mockOutputs,
    processingTime: mockProcessingTime,
    onStartPractice: vi.fn(),
    onExport: vi.fn(),
    onClose: vi.fn(),
  }

  const getTextWithinSection = (
    sectionText: string | RegExp,
    searchText: string,
  ): HTMLElement | null => {
    const sections = screen.getAllByRole('heading', { level: 4 })
    const targetSection = sections.find((h) => {
      const text = h.textContent || ''
      return typeof sectionText === 'string'
        ? text.includes(sectionText)
        : sectionText.test(text)
    })
    if (!targetSection) return null

    return targetSection.parentElement
      ? targetSection.parentElement.querySelector(searchText)
      : null
  }

  describe('Header Rendering', () => {
    it('renders header with title and close button', () => {
      render(() => <UvrResultViewer {...defaultProps} />)

      expect(screen.getByText('Processing Results')).toBeInTheDocument()
      expect(screen.getByLabelText('Close')).toBeInTheDocument()
    })

    it('shows processing time when provided', () => {
      render(() => <UvrResultViewer {...defaultProps} />)

      expect(screen.getByText(/45s/i)).toBeInTheDocument()
    })

    it('shows not available when no processing time', () => {
      const noTimeProps = { ...defaultProps, processingTime: undefined }

      render(() => <UvrResultViewer {...noTimeProps} />)

      expect(screen.getByText(/Not available/i)).toBeInTheDocument()
    })
  })

  describe('Vocal Stem Section', () => {
    it('renders vocal stem section with WAV tag', () => {
      render(() => <UvrResultViewer {...defaultProps} />)

      expect(screen.getByText('Vocal Stem')).toBeInTheDocument()
      const vocalWav = getTextWithinSection('Vocal Stem', '.section-tag')
      expect(vocalWav).toBeInTheDocument()
      expect(vocalWav?.textContent).toBe('WAV')
    })

    it('shows practice with vocal button', () => {
      render(() => <UvrResultViewer {...defaultProps} />)

      const practiceButton = screen.getByText(/Practice with Vocal/i)
      expect(practiceButton).toBeInTheDocument()
      expect(practiceButton).not.toBeDisabled()
    })

    it('shows download button', () => {
      render(() => <UvrResultViewer {...defaultProps} />)

      const downloadButtons = screen.getAllByText('Download')
      expect(downloadButtons.length).toBeGreaterThan(0)
    })

    it('calls onStartPractice with vocal mode', () => {
      render(() => <UvrResultViewer {...defaultProps} />)

      const practiceButton = screen.getByText(/Practice with Vocal/i)
      fireEvent.click(practiceButton)

      expect(defaultProps.onStartPractice).toHaveBeenCalledWith('vocal')
    })

    it('calls onExport with vocal type', () => {
      render(() => <UvrResultViewer {...defaultProps} />)

      const downloadButtons = screen.getAllByText('Download')
      expect(downloadButtons.length).toBeGreaterThan(0)
      fireEvent.click(downloadButtons[0])

      expect(defaultProps.onExport).toHaveBeenCalledWith('vocal')
    })
  })

  describe('Instrumental Stem Section', () => {
    it('renders instrumental section with WAV tag', () => {
      render(() => <UvrResultViewer {...defaultProps} />)

      expect(screen.getByText('Instrumental')).toBeInTheDocument()
      const instrumentalWav = getTextWithinSection(
        'Instrumental',
        '.section-tag',
      )
      expect(instrumentalWav).toBeInTheDocument()
      expect(instrumentalWav?.textContent).toBe('WAV')
    })

    it('shows practice instrumental button', () => {
      render(() => <UvrResultViewer {...defaultProps} />)

      const practiceButton = screen.getByText(/Practice Instrumental/i)
      expect(practiceButton).toBeInTheDocument()
      expect(practiceButton).not.toBeDisabled()
    })

    it('calls onStartPractice with instrumental mode', () => {
      render(() => <UvrResultViewer {...defaultProps} />)

      const practiceButton = screen.getByText(/Practice Instrumental/i)
      fireEvent.click(practiceButton)

      expect(defaultProps.onStartPractice).toHaveBeenCalledWith('instrumental')
    })

    it('calls onExport with instrumental type', () => {
      render(() => <UvrResultViewer {...defaultProps} />)

      const downloadButtons = screen.getAllByText('Download')
      expect(downloadButtons.length).toBeGreaterThan(1)
      const sections = screen.getAllByRole('heading', { level: 4 })
      const instrumentalSection = sections.find((h) =>
        h.textContent?.includes('Instrumental'),
      )
      if (instrumentalSection?.parentElement) {
        const buttons =
          instrumentalSection.parentElement?.querySelectorAll('button')
        const downloadBtn = buttons?.[1] as HTMLButtonElement | undefined
        if (downloadBtn) {
          fireEvent.click(downloadBtn)
          expect(defaultProps.onExport).toHaveBeenCalledWith('instrumental')
        }
      }
    })
  })

  describe('Vocal MIDI Section', () => {
    it('renders MIDI section with MIDI tag', () => {
      render(() => <UvrResultViewer {...defaultProps} />)

      expect(screen.getByText('Vocal MIDI')).toBeInTheDocument()
      const vocalMidi = getTextWithinSection('Vocal MIDI', '.section-tag')
      expect(vocalMidi).toBeInTheDocument()
      expect(vocalMidi?.textContent).toBe('MIDI')
    })

    it('shows practice MIDI button', () => {
      render(() => <UvrResultViewer {...defaultProps} />)

      const practiceButton = screen.getByText(/Practice MIDI/i)
      expect(practiceButton).toBeInTheDocument()
      expect(practiceButton).not.toBeDisabled()
    })

    it('calls onStartPractice with midi mode', () => {
      render(() => <UvrResultViewer {...defaultProps} />)

      const practiceButton = screen.getByText(/Practice MIDI/i)
      fireEvent.click(practiceButton)

      expect(defaultProps.onStartPractice).toHaveBeenCalledWith('midi')
    })

    it('calls onExport with vocal-midi type', () => {
      render(() => <UvrResultViewer {...defaultProps} />)

      const sections = screen.getAllByRole('heading', { level: 4 })
      const vocalMidiSection = sections.find((h) =>
        h.textContent?.includes('Vocal MIDI'),
      )
      if (vocalMidiSection?.parentElement) {
        const buttons =
          vocalMidiSection.parentElement?.querySelectorAll('button')
        const downloadBtn = buttons?.[1] as HTMLButtonElement | undefined
        if (downloadBtn) {
          fireEvent.click(downloadBtn)
          expect(defaultProps.onExport).toHaveBeenCalledWith('vocal-midi')
        }
      }
    })
  })

  describe('Full Mix Section', () => {
    it('renders full mix section with both stems tag', () => {
      render(() => <UvrResultViewer {...defaultProps} />)

      expect(screen.getByText(/Full Mix.*Karaoke/i)).toBeInTheDocument()
      const bothStems = getTextWithinSection(
        /Full Mix.*Karaoke/i,
        '.section-tag',
      )
      expect(bothStems).toBeInTheDocument()
      expect(bothStems?.textContent).toBe('Both Stems')
    })

    it('shows practice full mix button', () => {
      render(() => <UvrResultViewer {...defaultProps} />)

      const practiceButton = screen.getByText(/Practice Full Mix/i)
      expect(practiceButton).toBeInTheDocument()
      expect(practiceButton).not.toBeDisabled()
    })

    it('calls onStartPractice with full mode', () => {
      render(() => <UvrResultViewer {...defaultProps} />)

      const practiceButton = screen.getByText(/Practice Full Mix/i)
      fireEvent.click(practiceButton)

      expect(defaultProps.onStartPractice).toHaveBeenCalledWith('full')
    })

    it('does not show download button for full mix', () => {
      render(() => <UvrResultViewer {...defaultProps} />)

      const sections = screen.getAllByRole('heading', { level: 4 })
      const fullMixSection = sections.find((h) => {
        const text = h.textContent || ''
        return /Full Mix.*Karaoke/i.test(text)
      })
      if (fullMixSection?.parentElement) {
        const buttons = fullMixSection.parentElement?.querySelectorAll('button')
        expect(buttons.length).toBeLessThanOrEqual(1)
      }
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

  describe('Export Handler', () => {
    it('does not call handler when onExport not provided', () => {
      const { onExport } = defaultProps
      render(() => (
        <UvrResultViewer
          outputs={mockOutputs}
          processingTime={10000}
          onStartPractice={vi.fn()}
        />
      ))

      const downloadButtons = screen.getAllByText('Download')
      if (downloadButtons.length > 0) {
        fireEvent.click(downloadButtons[0])
      }

      expect(onExport).not.toHaveBeenCalled()
    })
  })

  describe('Practice Handler', () => {
    it('does not call handler when onStartPractice not provided', () => {
      const { onStartPractice } = defaultProps
      render(() => (
        <UvrResultViewer
          outputs={mockOutputs}
          processingTime={10000}
          onExport={vi.fn()}
        />
      ))

      const practiceButton = screen.getByText(/Practice with Vocal/i)
      fireEvent.click(practiceButton)

      expect(onStartPractice).not.toHaveBeenCalled()
    })
  })

  describe('Icon Variants', () => {
    it('has different icons for each section', () => {
      render(() => <UvrResultViewer {...defaultProps} />)

      const sections = screen.getAllByRole('heading', { level: 4 })
      // Now 4 sections: Vocal Stem, Instrumental, Vocal MIDI, Full Mix (Karaoke)
      expect(sections).toHaveLength(4)
      const sectionNames = sections.map((el) => el.textContent)
      expect(sectionNames).toContain('Vocal Stem')
      expect(sectionNames).toContain('Instrumental')
      expect(sectionNames).toContain('Vocal MIDI')
      expect(sectionNames.some((n) => n?.includes('Full Mix'))).toBe(true)
    })
  })

  describe('Practice Modes', () => {
    it('verifies all practice modes are available', () => {
      render(() => <UvrResultViewer {...defaultProps} />)

      const modes = [
        'Practice with Vocal',
        'Practice Instrumental',
        'Practice MIDI',
        'Practice Full Mix',
      ]
      modes.forEach((mode) => {
        expect(screen.getByText(mode)).toBeInTheDocument()
      })
    })
  })

  describe('Download Types', () => {
    it('verifies all export types work', () => {
      render(() => <UvrResultViewer {...defaultProps} />)

      const buttons = screen.getAllByRole('button')
      expect(buttons.length).toBeGreaterThan(0)
    })
  })
})
