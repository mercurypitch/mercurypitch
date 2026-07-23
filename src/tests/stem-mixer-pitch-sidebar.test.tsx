// ============================================================
// stem-mixer-pitch-sidebar.test.tsx — Unit tests for the
// Stem Mixer Pitch & Denoising transparent sidebar component
// (REQ-SMP-001 to REQ-SMP-010)
// ============================================================

import { fireEvent, render, screen } from '@solidjs/testing-library'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { StemMixerEditToolbar } from '@/components/StemMixerEditToolbar'
import { StemMixerPitchAnalysisPanel } from '@/components/StemMixerPitchAnalysisPanel'

describe('StemMixerPitchAnalysisPanel (Pitch Settings Sidebar)', () => {
  const defaultProps = {
    algorithm: 'auto' as const,
    setAlgorithm: vi.fn(),
    bufferSize: 2048,
    setBufferSize: vi.fn(),
    sensitivity: 5,
    setSensitivity: vi.fn(),
    minConfidence: 0.5,
    setMinConfidence: vi.fn(),
    minAmplitude: 0.01,
    setMinAmplitude: vi.fn(),
    isAnalyzing: false,
    progress: 0,
    pitchSourceMode: 'realtime' as const,
    setPitchSourceMode: vi.fn(),
    runAnalysis: vi.fn(),
    onClose: vi.fn(),
    cleanupAmount: 0.5,
    setCleanupAmount: vi.fn(),
    songKey: 'C',
    setSongKey: vi.fn(),
    songScale: 'major',
    setSongScale: vi.fn(),
    songBpm: 120,
    setSongBpm: vi.fn(),
    contourReady: true,
    detectedKeyLabel: 'C major',
    keyRegionCount: 1,
    editMode: false,
    onToggleEditMode: vi.fn(),
    canEdit: true,
    hasEdits: false,
    pitchView: 'edited' as const,
    setPitchView: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders title and close button (REQ-SMP-001, REQ-SMP-006)', () => {
    render(() => <StemMixerPitchAnalysisPanel {...defaultProps} />)

    expect(screen.getByText('Vocal Pitch Settings')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Close pitch settings' }),
    ).toBeInTheDocument()
  })

  it('calls onClose when close button is clicked (REQ-SMP-004)', () => {
    const onClose = vi.fn()
    render(() => (
      <StemMixerPitchAnalysisPanel {...defaultProps} onClose={onClose} />
    ))

    fireEvent.click(
      screen.getByRole('button', { name: 'Close pitch settings' }),
    )
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('calls onClose when Escape key is pressed (REQ-SMP-004)', () => {
    const onClose = vi.fn()
    render(() => (
      <StemMixerPitchAnalysisPanel {...defaultProps} onClose={onClose} />
    ))

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('renders pitch algorithm and denoising controls (REQ-SMP-007)', () => {
    render(() => <StemMixerPitchAnalysisPanel {...defaultProps} />)

    expect(screen.getByText('Denoising Engine')).toBeInTheDocument()
    expect(screen.getByText('Run Offline Denoising')).toBeInTheDocument()
    expect(screen.getByLabelText('Algorithm')).toHaveValue('auto')
    expect(screen.getByLabelText(/Buffer Size/)).toHaveValue('2048')
    expect(screen.getByLabelText(/Sensitivity/)).toHaveValue('5')
    expect(screen.getByLabelText(/Min Confidence/)).toHaveValue('0.5')
    expect(screen.getByLabelText(/Min Amplitude/)).toHaveValue('0.01')
  })

  it('associates every cleanup control with an accessible label', () => {
    render(() => <StemMixerPitchAnalysisPanel {...defaultProps} />)

    expect(screen.getByLabelText(/Cleanup Amount/)).toHaveValue('50')
    expect(screen.getByLabelText('Key')).toHaveValue('C')
    expect(screen.getByLabelText('Scale')).toHaveValue('major')
    expect(screen.getByLabelText('Tempo (BPM)')).toHaveValue(120)
  })

  it('triggers runAnalysis on button click (REQ-SMP-007)', () => {
    const runAnalysis = vi.fn()
    render(() => (
      <StemMixerPitchAnalysisPanel
        {...defaultProps}
        runAnalysis={runAnalysis}
      />
    ))

    fireEvent.click(screen.getByText('Run Offline Denoising'))
    expect(runAnalysis).toHaveBeenCalledTimes(1)
  })

  it('displays detected key badge when key label is provided (REQ-SMP-008)', () => {
    render(() => (
      <StemMixerPitchAnalysisPanel
        {...defaultProps}
        detectedKeyLabel="A minor"
        keyRegionCount={2}
      />
    ))

    expect(screen.getByText('A minor (2 regions)')).toBeInTheDocument()
  })

  it('triggers setPitchSourceMode when canvas pitch mode buttons are clicked (REQ-SMP-010)', () => {
    const setPitchSourceMode = vi.fn()
    render(() => (
      <StemMixerPitchAnalysisPanel
        {...defaultProps}
        setPitchSourceMode={setPitchSourceMode}
      />
    ))

    const realtime = screen.getByRole('button', { name: 'Realtime' })
    const offline = screen.getByRole('button', { name: 'Offline Denoised' })
    expect(realtime).toHaveAttribute('aria-pressed', 'true')
    expect(offline).toHaveAttribute('aria-pressed', 'false')

    fireEvent.click(offline)
    expect(setPitchSourceMode).toHaveBeenCalledWith('offline')
  })

  it('triggers onToggleEditMode when Edit Notes button is clicked (REQ-SMP-005)', () => {
    const onToggleEditMode = vi.fn()
    render(() => (
      <StemMixerPitchAnalysisPanel
        {...defaultProps}
        onToggleEditMode={onToggleEditMode}
      />
    ))

    fireEvent.click(screen.getByText('Edit notes'))
    expect(onToggleEditMode).toHaveBeenCalledTimes(1)
  })

  it('disables cleanup and editing until an offline contour is ready', () => {
    render(() => (
      <StemMixerPitchAnalysisPanel
        {...defaultProps}
        contourReady={false}
        canEdit={false}
      />
    ))

    expect(screen.getByLabelText(/Cleanup Amount/)).toBeDisabled()
    expect(screen.getByLabelText('Key')).toBeDisabled()
    expect(screen.getByLabelText('Scale')).toBeDisabled()
    expect(screen.getByLabelText('Tempo (BPM)')).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Edit notes' })).toBeDisabled()
  })
})

describe('StemMixerEditToolbar', () => {
  const defaultProps = {
    pitchView: 'edited' as const,
    setPitchView: vi.fn(),
    hasEdits: true,
    hasSelection: true,
    onDelete: vi.fn(),
    onSplit: vi.fn(),
    onMerge: vi.fn(),
    onUndo: vi.fn(),
    onReset: vi.fn(),
    onDone: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('exposes the toolbar and selected comparison view accessibly', () => {
    render(() => <StemMixerEditToolbar {...defaultProps} />)

    expect(
      screen.getByRole('toolbar', { name: 'Pitch note editing' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('group', { name: 'Pitch comparison view' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Original' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
    expect(screen.getByRole('button', { name: 'Edited' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  it('changes comparison view and exits with Escape', () => {
    const setPitchView = vi.fn()
    const onDone = vi.fn()
    render(() => (
      <StemMixerEditToolbar
        {...defaultProps}
        setPitchView={setPitchView}
        onDone={onDone}
      />
    ))

    fireEvent.click(screen.getByRole('button', { name: 'Both' }))
    expect(setPitchView).toHaveBeenCalledWith('both')

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onDone).toHaveBeenCalledTimes(1)
  })

  it('disables note and history actions when unavailable', () => {
    render(() => (
      <StemMixerEditToolbar
        {...defaultProps}
        hasEdits={false}
        hasSelection={false}
      />
    ))

    expect(screen.getByRole('button', { name: 'Delete note' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Split note' })).toBeDisabled()
    expect(
      screen.getByRole('button', { name: 'Merge with next note' }),
    ).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Undo edit' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Reset' })).toBeDisabled()
  })
})
