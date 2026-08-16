// ============================================================
// LabSurface — focused-shell navigation and isolation tests
// ============================================================

import { cleanup, fireEvent, render, screen, waitFor, } from '@solidjs/testing-library'
import { onCleanup } from 'solid-js'
import { afterEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  detectorCrash: false,
  setActiveTab: vi.fn(),
  workbenchCleanup: vi.fn(),
}))

vi.mock('@/stores', () => ({ setActiveTab: mocks.setActiveTab }))
vi.mock('@/features/lab/SpectralWorkbench', () => ({
  SpectralWorkbench: () => {
    onCleanup(mocks.workbenchCleanup)
    return (
      <label>
        Workbench frequency
        <input aria-label="Workbench frequency" value="440" />
      </label>
    )
  },
}))
vi.mock('@/components/PitchTestingTab', () => ({
  PitchTestingTab: () => {
    if (mocks.detectorCrash) throw new Error('detector fixture failed')
    return <div>Detector fixture</div>
  },
}))
vi.mock('@/components/PitchAlgorithmTester', () => ({
  PitchAlgorithmTester: () => <div>Algorithm fixture</div>,
}))
vi.mock('@/features/lab/TranscriptionBench', () => ({
  TranscriptionBench: () => <div>Transcription fixture</div>,
}))
vi.mock('@/features/lab/LrcDiffTool', () => ({
  LrcDiffTool: () => <div>Mapping fixture</div>,
}))

import { LabSurface } from '@/features/lab/LabSurface'

afterEach(() => {
  cleanup()
  mocks.detectorCrash = false
  vi.clearAllMocks()
})

describe('LabSurface', () => {
  it('implements automatic keyboard tab navigation with one tab stop', async () => {
    render(() => <LabSurface />)

    const workbench = screen.getByRole('tab', { name: 'Capture & inspect' })
    const detector = screen.getByRole('tab', { name: 'Tune detector' })
    expect(workbench).toHaveAttribute('tabindex', '0')
    expect(detector).toHaveAttribute('tabindex', '-1')

    workbench.focus()
    fireEvent.keyDown(workbench, { key: 'ArrowRight' })

    expect(await screen.findByText('Detector fixture')).toBeInTheDocument()
    await waitFor(() => expect(document.activeElement).toBe(detector))
    expect(detector).toHaveAttribute('aria-selected', 'true')
    expect(detector).toHaveAttribute('tabindex', '0')
    expect(mocks.setActiveTab).toHaveBeenCalledWith('pitch-test')
  })

  it('unmounts inactive tools so their owned resources are cleaned up', async () => {
    render(() => <LabSurface />)

    const input = screen.getByLabelText('Workbench frequency')
    fireEvent.input(input, { target: { value: '442' } })
    fireEvent.click(screen.getByRole('tab', { name: 'Tune detector' }))
    expect(await screen.findByText('Detector fixture')).toBeInTheDocument()

    expect(
      document.getElementById('lab-panel-workbench'),
    ).not.toBeInTheDocument()
    expect(document.body.contains(input)).toBe(false)
    expect(mocks.workbenchCleanup).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('tab', { name: 'Capture & inspect' }))

    const remountedInput = screen.getByLabelText('Workbench frequency')
    expect(remountedInput).not.toBe(input)
    expect(remountedInput).toHaveValue('440')
  })

  it('contains a tool failure without replacing the Lab shell', async () => {
    mocks.detectorCrash = true
    render(() => <LabSurface />)

    fireEvent.click(screen.getByRole('tab', { name: 'Tune detector' }))

    expect(
      await screen.findByText('Tune detector stopped unexpectedly'),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Exit Lab' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Back to workbench' }))
    expect(
      screen.getByRole('tab', { name: 'Capture & inspect' }),
    ).toHaveAttribute('aria-selected', 'true')
  })

  it('opens a deep-linked tool without rewriting the route on mount', async () => {
    render(() => <LabSurface initialTab="transcribe" />)

    expect(
      screen.getByRole('tab', { name: 'Transcribe stem' }),
    ).toHaveAttribute('aria-selected', 'true')
    expect(await screen.findByText('Transcription fixture')).toBeInTheDocument()
    expect(mocks.setActiveTab).not.toHaveBeenCalled()
  })
})
