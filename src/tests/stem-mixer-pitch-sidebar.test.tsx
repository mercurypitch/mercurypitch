// ============================================================
// stem-mixer-pitch-sidebar.test.tsx — Unit tests for the
// Stem Mixer Pitch & Denoising transparent sidebar component
// (REQ-SMP-001 to REQ-SMP-010)
// ============================================================

import { fireEvent, render, screen } from '@solidjs/testing-library'
import { describe, expect, it, vi } from 'vitest'
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

  it('renders title and close button (REQ-SMP-001, REQ-SMP-006)', () => {
    render(() => <StemMixerPitchAnalysisPanel {...defaultProps} />)

    expect(screen.getByText('Vocal Pitch Settings')).toBeInTheDocument()
    expect(screen.getByTitle('Close')).toBeInTheDocument()
  })

  it('calls onClose when close button is clicked (REQ-SMP-004)', () => {
    const onClose = vi.fn()
    render(() => (
      <StemMixerPitchAnalysisPanel {...defaultProps} onClose={onClose} />
    ))

    fireEvent.click(screen.getByTitle('Close'))
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
    expect(screen.getByDisplayValue('2048')).toBeInTheDocument()
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

    fireEvent.click(screen.getByText('Offline Denoised'))
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
})
