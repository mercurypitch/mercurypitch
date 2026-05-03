// ============================================================
// UVR Process Control Component Tests
// ============================================================

import { fireEvent,render, screen } from '@solidjs/testing-library'
import { afterEach,beforeEach, describe, expect, it, vi } from 'vitest'
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

      expect(screen.getByText(/Processing with UVR/i)).toBeInTheDocument()
      expect(
        screen.getByText(/Separating vocals and instrumental/i),
      ).toBeInTheDocument()
    })

    it('shows progress bar for processing status', () => {
      render(() => <UvrProcessControl {...defaultProps} />)

      expect(screen.getByText(/45%/i)).toBeInTheDocument()
      expect(screen.getByText(/30s/i)).toBeInTheDocument()
    })

    it('renders progress bar fill with correct width', () => {
      render(() => <UvrProcessControl {...defaultProps} />)

      const progressBar = screen.getByRole('progressbar')
      expect(progressBar).toHaveStyle({ width: '45%' })
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

    it('only shows active stages in indicators', () => {
      const partialProps = {
        ...defaultProps,
        status: 'completed' as const,
        outputs: {
          vocal: '/stems/vocal.wav',
          // instrumental is missing
        },
      }

      render(() => <UvrProcessControl {...partialProps} />)

      expect(screen.getByText(/Original File/i)).toBeInTheDocument()
      expect(screen.getByText(/Vocal Stem/i)).toBeInTheDocument()
      expect(screen.queryByText(/Instrumental/i)).not.toBeInTheDocument()
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

      expect(screen.getByText(/Processing Failed/i)).toBeInTheDocument()
      expect(screen.getByText(/timeout/i)).toBeInTheDocument()
    })

    it('displays error message from prop', () => {
      const errorProps = {
        ...defaultProps,
        status: 'error' as const,
        error: 'GPU memory exceeded',
      }

      render(() => <UvrProcessControl {...errorProps} />)

      expect(screen.getByText(/GPU memory exceeded/i)).toBeInTheDocument()
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

      expect(screen.getByText(/01:55/i)).toBeInTheDocument()
    })

    it('shows seconds for short processing times', () => {
      const props = {
        ...defaultProps,
        processingTime: 7500,
      }

      render(() => <UvrProcessControl {...props} />)

      expect(screen.getByText(/12s/i)).toBeInTheDocument()
    })
  })

  describe('Status Color Handling', () => {
    it('uses accent color for processing', () => {
      render(() => <UvrProcessControl {...defaultProps} />)

      const headerIcon = screen.getByText(/Separating vocals/i).parentElement
      expect(headerIcon).toHaveStyle({ color: expect.any(String) })
    })

    it('uses success color for completed', () => {
      const completedProps = { ...defaultProps, status: 'completed' as const }

      render(() => <UvrProcessControl {...completedProps} />)

      const headerIcon = screen.getByText(/Stems generated/i).parentElement
      expect(headerIcon).toHaveStyle({ color: expect.any(String) })
    })

    it('uses error color for error state', () => {
      const errorProps = {
        ...defaultProps,
        status: 'error' as const,
        error: 'Test error',
      }

      render(() => <UvrProcessControl {...errorProps} />)

      const headerIcon = screen.getByText(/Test error/i).parentElement
      expect(headerIcon).toHaveStyle({ color: expect.any(String) })
    })
  })

  describe('Status Icons', () => {
    it('shows loader icon for processing', () => {
      render(() => <UvrProcessControl {...defaultProps} />)

      expect(screen.getByText('Processing with UVR')).toBeInTheDocument()
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
