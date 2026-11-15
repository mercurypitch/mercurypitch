// ============================================================
// ExerciseShell: the voice take's notice over Merc's bubble
// ============================================================
//
// Whether to keep a run's voice take used to be a block in the result card.
// It is a notice in Merc's bubble now: these pin where it is, how long it
// stays, what it gives way to, and that the card is left with the result
// alone. The words of each state are pinned in stage/take-notice.test.ts,
// and the keep itself in src/tests/exercise-shell-voice-capture.test.tsx.

import { cleanup, fireEvent, render, waitFor } from '@solidjs/testing-library'
import { createSignal } from 'solid-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ExerciseSessionVoiceTake, ExerciseVoiceCaptureController, ExerciseVoiceCaptureState, } from '@/lib/domain/exercise-voice-capture'
import { encodeVoiceAtlasContour } from '@/lib/voice-contour'
import type { ExerciseDemo } from './ExerciseShell'
import { ExerciseShell } from './ExerciseShell'
import { TAKE_KEPT_LINGER_MS } from './stage/take-notice'
import { TAKE_NOTICE_EXIT_MS } from './stage/TakeNotice'
import type { ExerciseStatus, GuidedPracticeLaunchConfig } from './types'
import { EXERCISE_PITCH_HOLD } from './types'

const { keepMock, notificationMock } = vi.hoisted(() => ({
  keepMock: vi.fn(),
  notificationMock: vi.fn(),
}))

vi.mock('./exercise-voice-take', () => ({ keepExerciseVoiceTake: keepMock }))
vi.mock('@/stores/notifications-store', () => ({
  showNotification: notificationMock,
}))
vi.mock('@/lib/analytics', () => ({ trackEvent: () => {} }))
// jsdom has no WebGL, so Merc is his still here whatever the gate says; the
// stub only spares the log the probe's "not implemented" notice.
vi.mock('@/lib/merc/gpu-gate', () => ({
  canRunLiveMerc: () => false,
  waitForLiveMerc: () => () => undefined,
}))

const take: ExerciseSessionVoiceTake = {
  blob: new Blob(['voice'], { type: 'audio/webm' }),
  durationMs: 4200,
  peaks: new Float32Array([0.2, 0.8]),
  capturedAt: '2026-11-15T12:00:00.000Z',
  contour: encodeVoiceAtlasContour([], { source: 'practice-engine-v1' }),
  config: { type: EXERCISE_PITCH_HOLD, targetNote: 'E3' },
  result: {
    type: EXERCISE_PITCH_HOLD,
    score: 72,
    metrics: {},
    completedAt: Date.UTC(2026, 10, 15, 12),
  },
}

const kept = { ok: true, quotaExceeded: false, roomAvailable: true, value: {} }

const BRIEF = (
  <div class="exercise-idle-placeholder">
    <p>Keep your pitch locked inside the target zone.</p>
  </div>
)

/** A finished Pitch Hold run whose take is in `state` until moved on. */
function finished(
  options: {
    capture?: ExerciseVoiceCaptureState
    demo?: ExerciseDemo
    guidedPractice?: GuidedPracticeLaunchConfig
  } = {},
) {
  const [status, setStatus] = createSignal<ExerciseStatus>('complete')
  const [capture, setCapture] = createSignal<ExerciseVoiceCaptureState>(
    options.capture ?? 'ready',
  )
  const discard = vi.fn(() => setCapture('idle'))
  const voiceCapture: ExerciseVoiceCaptureController = {
    state: capture,
    take: () => (capture() === 'ready' ? take : null),
    awaitOutcome: async () => ({ state: 'ready', take }),
    discard,
  }
  const view = render(() => (
    <ExerciseShell
      type={EXERCISE_PITCH_HOLD}
      title="Pitch Hold"
      status={status}
      currentScore={() => 72}
      resultScore={() => (status() === 'complete' ? 72 : null)}
      voiceCapture={voiceCapture}
      idlePlaceholder={BRIEF}
      demo={options.demo}
      guidedPractice={options.guidedPractice}
      onBack={() => {}}
      onStart={() => {}}
      activeContent={<div>active</div>}
      onStop={() => {}}
      resultSummary={<>In Zone: 64%</>}
      onTryAgain={() => {}}
      onChangeTarget={() => {}}
    />
  ))
  const coach = view.getByTestId('exercise-stage-coach')
  return {
    ...view,
    setStatus,
    setCapture,
    discard,
    coach,
    notice: () => view.queryByTestId('exercise-take-notice'),
    brief: () =>
      coach.querySelector('.exercise-idle-placeholder')!.parentElement!,
    card: () => view.container.querySelector('.exercise-result-card')!,
  }
}

describe('the take notice on the stage', () => {
  afterEach(() => {
    vi.useRealTimers()
    cleanup()
    vi.clearAllMocks()
  })

  it("asks in Merc's bubble, and leaves the result card to the result", () => {
    const drill = finished()

    const notice = drill.notice()
    expect(notice).not.toBeNull()
    expect(drill.coach.contains(notice)).toBe(true)
    expect(notice?.textContent).toContain('Keep this take?')
    // The card holds the result and nothing about the take.
    expect(drill.card().textContent).not.toMatch(/keep|take|replay/i)
    expect(drill.card().querySelector('button')).toBeNull()
  })

  it('speaks through a polite live region, over a brief hidden from a screen reader', async () => {
    const drill = finished()

    const region = drill.notice()!.closest('[role="status"]')
    expect(region?.getAttribute('aria-live')).toBe('polite')
    expect(drill.brief().getAttribute('aria-hidden')).toBe('true')

    fireEvent.click(drill.getByRole('button', { name: 'Discard take' }))
    expect(drill.brief().hasAttribute('aria-hidden')).toBe(false)
    await waitFor(() => expect(drill.notice()).toBeNull())
    // The region stays for the next run's notice.
    expect(drill.coach.querySelector('[role="status"]')).toBe(region)
  })

  it('never takes the focus', () => {
    const drill = finished()
    const before = document.activeElement

    drill.setCapture('processing')
    drill.setCapture('ready')

    expect(drill.notice()).not.toBeNull()
    expect(document.activeElement).toBe(before)
  })

  it('keeps the focus it was pressed with, through the keep and on to Dismiss', async () => {
    let finish: (value: { ok: true }) => void = () => {}
    keepMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve
        }),
    )
    const drill = finished()
    const keep = drill.getByRole('button', { name: 'Keep' })
    keep.focus()
    fireEvent.click(keep)

    // Busy, not disabled: a disabled button would have dropped the focus.
    const busy = drill.getByRole('button', { name: 'Keeping' })
    expect(busy).toBe(keep)
    expect(document.activeElement).toBe(busy)

    // "Take kept" has no capsule; the close takes the focus over.
    finish({ ok: true })
    const dismiss = await drill.findByRole('button', { name: 'Dismiss' })
    await waitFor(() => expect(document.activeElement).toBe(dismiss))
  })

  it('leaves the focus alone when the capsule was not holding it', async () => {
    keepMock.mockResolvedValue({ ok: true })
    const drill = finished()
    const before = document.activeElement
    fireEvent.click(drill.getByRole('button', { name: 'Keep' }))
    await drill.findByRole('button', { name: 'Dismiss' })
    expect(document.activeElement).toBe(before)
  })

  it('waits for a take that is still being prepared', () => {
    const drill = finished({ capture: 'processing' })
    expect(drill.notice()).toBeNull()

    drill.setCapture('ready')
    expect(drill.notice()?.textContent).toContain('Keep this take?')
  })

  it.each([
    [
      'unsupported',
      'This browser can score the run but cannot record a replay.',
    ],
    ['error', 'No replay was captured. Your score is unchanged.'],
  ] as const)(
    'says a "%s" take was never recorded at the foot of the card, not in a notice',
    (capture, line) => {
      const drill = finished({ capture })

      expect(drill.notice()).toBeNull()
      expect(drill.brief().hasAttribute('aria-hidden')).toBe(false)
      expect(
        drill.card().querySelector('.exercise-result-replay-note')?.textContent,
      ).toBe(line)
    },
  )

  it('leaves 4 s after "Take kept", gives the brief back, and is not offered again', async () => {
    vi.useFakeTimers({
      toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'],
    })
    keepMock.mockResolvedValue(kept)
    const drill = finished()

    fireEvent.click(drill.getByRole('button', { name: 'Keep' }))
    await vi.advanceTimersByTimeAsync(0)
    expect(drill.notice()?.textContent).toContain('Take kept')
    expect(drill.getByRole('button', { name: 'Dismiss' })).toBeTruthy()

    await vi.advanceTimersByTimeAsync(TAKE_KEPT_LINGER_MS - 1)
    expect(drill.notice()?.textContent).toContain('Take kept')

    await vi.advanceTimersByTimeAsync(1)
    expect(drill.brief().hasAttribute('aria-hidden')).toBe(false)
    await vi.advanceTimersByTimeAsync(TAKE_NOTICE_EXIT_MS)
    expect(drill.notice()).toBeNull()

    // The take is still ready, but it has been kept: nothing more to ask.
    await vi.advanceTimersByTimeAsync(TAKE_KEPT_LINGER_MS)
    expect(drill.notice()).toBeNull()
    expect(keepMock).toHaveBeenCalledOnce()
    expect(notificationMock).not.toHaveBeenCalled()
  })

  it('lets "Take kept" be dismissed at once', async () => {
    keepMock.mockResolvedValue(kept)
    const drill = finished()

    fireEvent.click(drill.getByRole('button', { name: 'Keep' }))
    fireEvent.click(await drill.findByRole('button', { name: 'Dismiss' }))

    await waitFor(() => expect(drill.notice()).toBeNull())
    expect(drill.discard).not.toHaveBeenCalled()
  })

  it('asks again after the next run', async () => {
    keepMock.mockResolvedValue(kept)
    const drill = finished()
    fireEvent.click(drill.getByRole('button', { name: 'Keep' }))
    fireEvent.click(await drill.findByRole('button', { name: 'Dismiss' }))
    await waitFor(() => expect(drill.notice()).toBeNull())

    drill.setStatus('active')
    drill.setStatus('complete')

    expect(drill.notice()?.textContent).toContain('Keep this take?')
  })

  it('gives the bubble to "Hear it first" while it plays, and comes back after', async () => {
    let finish: () => void = () => {}
    const demo: ExerciseDemo = {
      play: () =>
        new Promise<void>((resolve) => {
          finish = resolve
        }),
      stop: () => finish(),
      line: () => 'Listen: E3. That is the note to stay on.',
    }
    const drill = finished({ demo })

    fireEvent.click(drill.getByRole('button', { name: 'Hear it first' }))
    await waitFor(() => expect(drill.notice()).toBeNull())
    expect(drill.coach.textContent).toContain('Listen: E3.')
    expect(
      drill.coach
        .querySelector('.exercise-stage-demo-line')
        ?.closest('[aria-hidden="true"]'),
    ).toBeNull()

    // The notice is back when the line goes, which is two seconds after it
    // came however short the example was.
    finish()
    await waitFor(
      () => expect(drill.notice()?.textContent).toContain('Keep this take?'),
      { timeout: 4000 },
    )
  })

  it('is not offered once a guided hold has ended for comfort', async () => {
    const guidedPractice: GuidedPracticeLaunchConfig = {
      assessmentRunId: 'run-guided',
      exercise: {
        exerciseId: EXERCISE_PITCH_HOLD,
        exerciseVersion: '1.0.0',
        configuration: {
          configurationId: 'pitch-hold.guided-pitch-centre',
          configurationVersion: '1.0.0',
        },
      },
      dose: {
        durationMilliseconds: 5_000,
        repetitions: 3,
        sets: 1,
        comfortableRangeMidiCents: null,
        demand: 'same',
      },
      stopRuleId: 'guided.stop-on-discomfort-v1',
      targetMidiCents: 6_000,
      toleranceCents: 35,
    }
    const drill = finished({ guidedPractice })
    drill.setStatus('active')
    drill.setStatus('complete')
    expect(drill.notice()).not.toBeNull()

    fireEvent.click(
      drill.getByRole('button', { name: 'It felt uncomfortable' }),
    )

    expect(drill.discard).toHaveBeenCalledOnce()
    await waitFor(() => expect(drill.notice()).toBeNull())
  })
})
