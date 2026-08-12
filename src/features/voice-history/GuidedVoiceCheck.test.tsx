// ============================================================
// Guided Voice Check tests — comfort gate before local capture
// ============================================================

import { cleanup, fireEvent, render, screen, waitFor, } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPitchCentrePilotProtocol } from '@/lib/guided-voice'
import { GuidedVoiceCheck } from './GuidedVoiceCheck'
import type { DryVoiceCaptureController } from './useDryVoiceCapture'

const { useDryVoiceCaptureMock } = vi.hoisted(() => ({
  useDryVoiceCaptureMock: vi.fn(),
}))

vi.mock('@/lib/use-viewport', () => ({
  isNarrow: () => false,
}))
vi.mock('./useDryVoiceCapture', () => ({
  useDryVoiceCapture: useDryVoiceCaptureMock,
}))

function captureController(): DryVoiceCaptureController {
  return {
    state: () => 'idle',
    capture: () => null,
    elapsedMs: () => 0,
    message: () => null,
    previewUrl: () => null,
    previewPlaying: () => false,
    previewProgress: () => 0,
    previewCurrentTimeMs: () => 0,
    previewDurationMs: () => 0,
    latestFrame: () => null,
    latestSmoothedFrame: () => null,
    latestLevel: () => 0,
    maxLevel: () => 0,
    start: vi.fn(async () => false),
    pauseSegment: vi.fn(async () => null),
    resumeSegment: vi.fn(async () => false),
    stop: vi.fn(async () => null),
    togglePreview: vi.fn(),
    seekPreview: vi.fn(() => false),
    discard: vi.fn(),
  }
}

describe('GuidedVoiceCheck', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useDryVoiceCaptureMock.mockReturnValue(captureController())
  })

  afterEach(() => cleanup())

  it('requires explicit comfort confirmation before offering capture setup', () => {
    render(() => <GuidedVoiceCheck onClose={vi.fn()} onKept={vi.fn()} />)

    expect(
      screen.getByRole('heading', { name: 'Find one focus you can hear.' }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Start three landings' }),
    ).not.toBeInTheDocument()

    fireEvent.click(
      screen.getByRole('button', { name: 'Check comfort and begin' }),
    )
    expect(
      screen.getByRole('heading', {
        name: 'Does singing feel comfortable today?',
      }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Start three landings' }),
    ).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Yes, continue' }))
    expect(
      screen.getByRole('heading', {
        name: 'Three notes, centred where you are comfortable.',
      }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Start three landings' }),
    ).toBeDisabled()
  })

  it('moves focus into each newly presented guidance stage', async () => {
    render(() => <GuidedVoiceCheck onClose={vi.fn()} onKept={vi.fn()} />)

    fireEvent.click(
      screen.getByRole('button', { name: 'Check comfort and begin' }),
    )

    const comfortHeading = screen.getByRole('heading', {
      name: 'Does singing feel comfortable today?',
    })
    const guidance = comfortHeading.closest('[aria-label$="guidance"]')
    expect(guidance).not.toBeNull()
    await waitFor(() => expect(guidance).toHaveFocus())

    fireEvent.click(screen.getByRole('button', { name: 'Yes, continue' }))
    expect(
      screen.getByRole('heading', {
        name: 'Three notes, centred where you are comfortable.',
      }),
    ).toBeInTheDocument()
    await waitFor(() => expect(guidance).toHaveFocus())
  })

  it('locks the complete task when returning for a matched retake', () => {
    const initialProtocol = createPitchCentrePilotProtocol({
      comfortableRangeMidiCents: [5_700, 7_300],
      preferredMidiCents: 6_900,
    })
    render(() => (
      <GuidedVoiceCheck
        initialProtocol={initialProtocol}
        returningFromPractice
        onClose={vi.fn()}
        onKept={vi.fn()}
      />
    ))

    fireEvent.click(
      screen.getByRole('button', { name: 'Check comfort and begin' }),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Yes, continue' }))

    expect(screen.getByText('Matched route locked')).toBeInTheDocument()
    expect(
      screen.getByText(
        'The notes and timing stay identical so this take remains a fair comparison.',
      ),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', {
        name: 'Move the Pitch Centre route one semitone lower',
      }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', {
        name: 'Move the Pitch Centre route one semitone higher',
      }),
    ).not.toBeInTheDocument()
    expect(initialProtocol.comparisonFingerprint).toContain('pitch-centre')
  })

  it('stops an active temporary capture before asking whether to close', () => {
    const controller = captureController()
    controller.state = () => 'recording'
    useDryVoiceCaptureMock.mockReturnValue(controller)
    render(() => <GuidedVoiceCheck onClose={vi.fn()} onKept={vi.fn()} />)

    fireEvent.click(
      screen.getByRole('button', { name: 'Close guided voice check' }),
    )

    expect(controller.discard).toHaveBeenCalledTimes(1)
    expect(
      screen.getByRole('heading', { name: 'Discard this temporary take?' }),
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(
      screen.getByRole('heading', {
        name: 'Three notes, centred where you are comfortable.',
      }),
    ).toBeInTheDocument()
  })
})
