// ============================================================
// Challenge Stage Integration — weekly replay lifecycle at the UI boundary
// ============================================================

import { cleanup, fireEvent, render, screen, waitFor, } from '@solidjs/testing-library'
import { createSignal } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { DryVoiceCaptureController } from '@/features/voice-history/useDryVoiceCapture'
import type { ChallengeStageLaunch } from '@/stores/ui-store'
import type { MelodyItem, NoteName } from '@/types'
import type { ResolvedZenTarget, ZenPitchRun } from '../zen/types'
import type { UseZenPitchSessionOptions, ZenPitchSession, } from '../zen/useZenPitchSession'
import { ChallengeStage } from './ChallengeStage'

const harness = vi.hoisted(() => ({
  capture: undefined as unknown,
  events: [] as string[],
  recordResult: vi.fn(),
  session: undefined as unknown,
  sessionOptions: undefined as unknown,
}))

vi.mock('@/features/voice-history/useDryVoiceCapture', () => ({
  useDryVoiceCapture: () => harness.capture,
}))

vi.mock('../zen/useZenPitchSession', () => ({
  useZenPitchSession: (options: UseZenPitchSessionOptions) => {
    harness.sessionOptions = options
    return harness.session
  },
}))

vi.mock('./challenge-stage-voice-take', () => ({
  recordChallengeStageResult: (...args: unknown[]) =>
    harness.recordResult(...args),
}))

vi.mock('@/lib/mic-manager', () => ({
  micManager: {
    registerRunGuard: () => () => undefined,
  },
}))

vi.mock('@/features/mic-feedback/useMicInsights', () => ({
  useMicInsights: () => ({ message: () => null, insight: () => null }),
}))

vi.mock('@/components/MicInsightHint', () => ({
  MicInsightHint: () => null,
}))

vi.mock('@/components/MicTroubleshooting', () => ({
  MicTroubleshooting: () => null,
}))

vi.mock('@/components/pitch-stage/PitchStageShell', () => ({
  PitchStageShell: (props: {
    headerMeta: unknown
    primaryAction: unknown
    canvas: unknown
    footer: unknown
  }) => (
    <section data-testid="challenge-stage-shell">
      {props.headerMeta as never}
      {props.primaryAction as never}
      {props.canvas as never}
      {props.footer as never}
    </section>
  ),
}))

vi.mock('../zen/ZenPitchCanvas', () => ({
  ZenPitchCanvas: () => <div data-testid="challenge-canvas" />,
}))

function melodyItem(id: number, midi: number, startBeat: number): MelodyItem {
  return {
    id,
    note: {
      midi,
      name: 'C' as NoteName,
      octave: Math.floor(midi / 12) - 1,
      freq: 440 * 2 ** ((midi - 69) / 12),
    },
    duration: 1,
    startBeat,
  }
}

const targets: ResolvedZenTarget[] = [
  {
    id: 'early',
    startBeat: 2,
    durationBeats: 1,
    semitone: 0,
    cue: 'G4',
    startSec: 2,
    endSec: 3,
    startMidi: 67,
    endMidi: 67,
  },
  {
    id: 'late',
    startBeat: 4,
    durationBeats: 1,
    semitone: 5,
    cue: 'C5',
    startSec: 4,
    endSec: 5,
    startMidi: 72,
    endMidi: 72,
  },
]

const launch: ChallengeStageLaunch = {
  launchId: 1,
  challengeId: 'week-31',
  title: 'Ordered Legend',
  targetScore: 70,
  // Deliberately out of order: persisted context must follow the stage.
  targetItems: [melodyItem(2, 72, 2), melodyItem(1, 67, 0)],
  mode: 'ranked',
}

describe('ChallengeStage weekly voice handoff', () => {
  let setStatus: (status: 'idle' | 'running' | 'paused') => void
  let resolveHandoff: (() => void) | undefined
  let captureStart: ReturnType<typeof vi.fn>
  let sessionStart: ReturnType<typeof vi.fn>

  beforeEach(() => {
    harness.events = []
    harness.recordResult.mockReset()
    harness.recordResult.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveHandoff = resolve
        }),
    )
    const [status, updateStatus] = createSignal<'idle' | 'running' | 'paused'>(
      'idle',
    )
    setStatus = updateStatus

    sessionStart = vi.fn(async () => {
      harness.events.push('session:start')
      setStatus('running')
      return true
    })
    const run: ZenPitchRun = {
      id: 'run-1',
      takeNumber: 1,
      completedAt: 1,
      mode: 'exercise',
      durationSec: 5,
      points: [],
      viewport: { minMidi: 60, maxMidi: 76 },
    }
    harness.session = {
      status,
      elapsedSec: () => 3,
      loopDurationSec: () => 6,
      targets: () => targets,
      viewport: () => ({ minMidi: 60, maxMidi: 76 }),
      activePoints: () => [],
      start: sessionStart,
      finish: vi.fn(() => {
        setStatus('idle')
        const options = harness.sessionOptions as UseZenPitchSessionOptions
        options.onRunFinalized?.(run)
      }),
    } as unknown as ZenPitchSession

    captureStart = vi.fn(async () => {
      harness.events.push('capture:start')
      return true
    })
    harness.capture = {
      start: captureStart,
      discard: vi.fn(),
      state: () => 'recording',
      capture: () => null,
    } as unknown as DryVoiceCaptureController
  })

  afterEach(() => {
    cleanup()
    resolveHandoff?.()
    resolveHandoff = undefined
  })

  it('starts capture after the stage and locks exits until the exact take is handed off', async () => {
    const startMic = (): Promise<boolean> => Promise.resolve(true)
    const playTone = (): Promise<void> => Promise.resolve()
    render(() => (
      <ChallengeStage
        launch={launch}
        subscribeFrames={() => () => undefined}
        micActive={() => false}
        micError={() => null}
        getMicLevel={() => 0}
        isDetecting={() => false}
        startMic={startMic}
        stopMic={() => undefined}
        playTone={playTone}
        stopTone={() => undefined}
        onClose={() => undefined}
      />
    ))

    fireEvent.click(screen.getByTestId('challenge-begin'))
    await waitFor(() => expect(captureStart).toHaveBeenCalledOnce())
    expect(harness.events).toEqual(['session:start', 'capture:start'])

    fireEvent.click(screen.getByTestId('challenge-end'))
    await waitFor(() => expect(harness.recordResult).toHaveBeenCalledOnce())
    expect(harness.recordResult).toHaveBeenCalledWith(
      expect.objectContaining({
        challengeId: 'week-31',
        targetNotes: ['G4', 'C5'],
      }),
    )
    expect(screen.getByTestId('challenge-practice')).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Close' })).toBeDisabled()
    expect(screen.getByText('Preparing replay')).toBeInTheDocument()

    resolveHandoff?.()
    await waitFor(() =>
      expect(screen.getByTestId('challenge-practice')).toBeEnabled(),
    )

    fireEvent.click(screen.getByTestId('challenge-practice'))
    await waitFor(() => expect(sessionStart).toHaveBeenCalledTimes(2))
    expect(captureStart).toHaveBeenCalledOnce()
    expect(harness.recordResult).toHaveBeenCalledOnce()
  })
})
