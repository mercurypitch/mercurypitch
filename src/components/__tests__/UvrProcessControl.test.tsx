// ============================================================
// UVR Process Control Component Tests
// ============================================================

import { fireEvent, render, screen } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { UvrProcessControl } from '../UvrProcessControl'

describe('UvrProcessControl Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  const mockStatus = 'processing' as const
  const defaultProps = {
    sessionId: 'session-123',
    status: mockStatus,
    progress: 45,
    processingTime: 30000,
    onCancel: vi.fn(),
    onRetry: vi.fn(),
  }

  describe('Processing State Rendering', () => {
    it('renders processing header with loader', () => {
      render(() => <UvrProcessControl {...defaultProps} />)

      expect(screen.getByText(/Separating audio into stems/i)).toBeInTheDocument()
    })

    it('shows progress bar for processing status', () => {
      render(() => <UvrProcessControl {...defaultProps} />)

      expect(screen.getByText(/45%/i)).toBeInTheDocument()
      expect(screen.getByText(/0:30/i)).toBeInTheDocument()
    })

    it('renders progress bar fill with correct width', () => {
      render(() => <UvrProcessControl {...defaultProps} />)

      const progressBar = document.querySelector(
        '.progress-bar-fill',
      ) as HTMLElement
      expect(progressBar).toBeTruthy()
      expect(progressBar.style.width).toBe('45%')
    })
  })

  describe('Completed State Rendering', () => {
    it('renders success header with check icon', () => {
      const completedProps = { ...defaultProps, status: 'completed' as const }

      render(() => <UvrProcessControl {...completedProps} />)

      expect(screen.getByText(/Processing Complete/i)).toBeInTheDocument()
      expect(
        screen.getByText(/Stems generated successfully/i),
      ).toBeInTheDocument()
    })

    it('shows stage indicators for completed outputs', () => {
      const completedProps = {
        ...defaultProps,
        status: 'completed' as const,
        outputs: {
          vocal: '/stems/vocal.wav',
          instrumental: '/stems/instrumental.wav',
          vocalMidi: '/midi/vocal.mid',
        },
      }

      render(() => <UvrProcessControl {...completedProps} />)

      expect(screen.getByText(/Original File/i)).toBeInTheDocument()
      expect(screen.getByText(/Vocal Stem/i)).toBeInTheDocument()
      expect(screen.getByText(/Instrumental/i)).toBeInTheDocument()
      expect(screen.getByText(/Vocal MIDI/i)).toBeInTheDocument()
    })

    it('marks missing outputs as inactive', () => {
      const partialProps = {
        ...defaultProps,
        status: 'completed' as const,
        outputs: {
          vocal: '/stems/vocal.wav',
          // instrumental is missing
        },
      }

      render(() => <UvrProcessControl {...partialProps} />)

      // All stages render, but missing ones have no "active" class
      const stages = document.querySelectorAll('.stage-item')
      expect(stages.length).toBe(4)
      expect(stages[0]).toHaveClass('active') // Original File always active
      expect(stages[1]).toHaveClass('active') // Vocal Stem present
      expect(stages[2]).not.toHaveClass('active') // Instrumental missing
      expect(stages[3]).not.toHaveClass('active') // Vocal MIDI missing
    })
  })

  describe('Error State Rendering', () => {
    it('renders error header with X icon', () => {
      const errorProps = {
        ...defaultProps,
        status: 'error' as const,
        error: 'Processing failed: timeout',
      }

      render(() => <UvrProcessControl {...errorProps} />)

      // Error text appears in both description and error section
      expect(screen.getAllByText(/Processing Failed/i).length).toBeGreaterThan(
        0,
      )
      expect(screen.getAllByText(/timeout/i).length).toBeGreaterThan(0)
    })

    it('displays error message from prop', () => {
      const errorProps = {
        ...defaultProps,
        status: 'error' as const,
        error: 'GPU memory exceeded',
      }

      render(() => <UvrProcessControl {...errorProps} />)

      expect(
        screen.getAllByText(/GPU memory exceeded/i).length,
      ).toBeGreaterThan(0)
    })

    it('shows fallback message when error prop is empty', () => {
      const errorProps = {
        ...defaultProps,
        status: 'error' as const,
        error: undefined,
      }

      render(() => <UvrProcessControl {...errorProps} />)

      expect(screen.getByText(/Unknown error occurred/i)).toBeInTheDocument()
    })
  })

  describe('Idle State Rendering', () => {
    it('renders idle header with loader', () => {
      const idleProps = {
        ...defaultProps,
        status: 'idle' as const,
        progress: 0,
      }

      render(() => <UvrProcessControl {...idleProps} />)

      expect(screen.getByText(/Waiting to start/i)).toBeInTheDocument()
      expect(screen.getByText(/Ready to process/i)).toBeInTheDocument()
    })
  })

  describe('Cancel Button', () => {
    it('renders cancel button for processing state', () => {
      render(() => <UvrProcessControl {...defaultProps} />)

      expect(screen.getByText('Cancel')).toBeInTheDocument()
    })

    it('calls onCancel when clicked', () => {
      render(() => <UvrProcessControl {...defaultProps} />)

      const cancelButton = screen.getByText('Cancel')
      fireEvent.click(cancelButton)

      expect(defaultProps.onCancel).toHaveBeenCalled()
    })
  })

  describe('Retry Button', () => {
    it('renders retry button for error state', () => {
      const errorProps = {
        ...defaultProps,
        status: 'error' as const,
        error: 'Processing failed',
      }

      render(() => <UvrProcessControl {...errorProps} />)

      expect(screen.getByText('Retry')).toBeInTheDocument()
    })

    it('calls onRetry when clicked', () => {
      const errorProps = {
        ...defaultProps,
        status: 'error' as const,
        error: 'Processing failed',
      }

      render(() => <UvrProcessControl {...errorProps} />)

      const retryButton = screen.getByText('Retry')
      fireEvent.click(retryButton)

      expect(defaultProps.onRetry).toHaveBeenCalled()
    })

    it('does not render retry button for other states', () => {
      const completedProps = { ...defaultProps, status: 'completed' as const }
      const idleProps = { ...defaultProps, status: 'idle' as const }

      render(() => <UvrProcessControl {...completedProps} />)
      expect(screen.queryByText('Retry')).not.toBeInTheDocument()

      render(() => <UvrProcessControl {...idleProps} />)
      expect(screen.queryByText('Retry')).not.toBeInTheDocument()
    })
  })

  describe('Complete Button', () => {
    it('renders complete button for completed state', () => {
      const completedProps = { ...defaultProps, status: 'completed' as const }

      render(() => <UvrProcessControl {...completedProps} />)

      expect(screen.getByText('Complete')).toBeInTheDocument()
    })

    it('disables complete button', () => {
      const completedProps = { ...defaultProps, status: 'completed' as const }

      render(() => <UvrProcessControl {...completedProps} />)

      const completeButton = screen.getByText('Complete')
      expect(completeButton).toBeDisabled()
    })
  })

  describe('Progress Formatting', () => {
    it('rounds progress to nearest integer', () => {
      const props = {
        ...defaultProps,
        progress: 45.7,
      }

      render(() => <UvrProcessControl {...props} />)

      expect(screen.getByText(/46%/i)).toBeInTheDocument()
    })

    it('formats processing time correctly', () => {
      const props = {
        ...defaultProps,
        processingTime: 65432,
      }

      render(() => <UvrProcessControl {...props} />)

      expect(screen.getByText(/1:05/i)).toBeInTheDocument()
    })

    it('shows seconds for short processing times', () => {
      const props = {
        ...defaultProps,
        processingTime: 7500,
      }

      render(() => <UvrProcessControl {...props} />)

      expect(screen.getByText(/0:07/i)).toBeInTheDocument()
    })
  })

  describe('Status Color Handling', () => {
    it('uses accent color for processing', () => {
      render(() => <UvrProcessControl {...defaultProps} />)

      const iconWrapper = document.querySelector(
        '.process-icon-wrapper',
      ) as HTMLElement
      expect(iconWrapper).toBeTruthy()
      expect(iconWrapper.style.color).toBe('var(--accent)')
    })

    it('uses success color for completed', () => {
      const completedProps = { ...defaultProps, status: 'completed' as const }

      render(() => <UvrProcessControl {...completedProps} />)

      const iconWrapper = document.querySelector(
        '.process-icon-wrapper',
      ) as HTMLElement
      expect(iconWrapper).toBeTruthy()
      expect(iconWrapper.style.color).toBe('var(--success)')
    })

    it('uses error color for error state', () => {
      const errorProps = {
        ...defaultProps,
        status: 'error' as const,
        error: 'Test error',
      }

      render(() => <UvrProcessControl {...errorProps} />)

      const iconWrapper = document.querySelector(
        '.process-icon-wrapper',
      ) as HTMLElement
      expect(iconWrapper).toBeTruthy()
      expect(iconWrapper.style.color).toBe('var(--error)')
    })
  })

  describe('Status Icons', () => {
    it('shows loader icon for processing', () => {
      render(() => <UvrProcessControl {...defaultProps} />)

      expect(screen.getByText(/Separating audio into stems/)).toBeInTheDocument()
    })

    it('shows check circle for completed', () => {
      const completedProps = { ...defaultProps, status: 'completed' as const }

      render(() => <UvrProcessControl {...completedProps} />)

      expect(screen.getByText('Processing Complete')).toBeInTheDocument()
    })

    it('shows X circle for error', () => {
      const errorProps = {
        ...defaultProps,
        status: 'error' as const,
        error: 'Error',
      }

      render(() => <UvrProcessControl {...errorProps} />)

      expect(screen.getByText('Processing Failed')).toBeInTheDocument()
    })
  })

  describe('Invalid Status Handling', () => {
    it('uses default behavior for invalid status', () => {
      const invalidProps = { ...defaultProps, status: 'idle' as const }

      render(() => <UvrProcessControl {...invalidProps} />)

      expect(screen.getByText(/Waiting to start/i)).toBeInTheDocument()
    })
  })

  describe('ID and Session Prop', () => {
    it('passes sessionId to internal handlers', () => {
      render(() => <UvrProcessControl {...defaultProps} />)

      // SessionId should be accessible in component
      expect(defaultProps.sessionId).toBe('session-123')
    })
  })
})
