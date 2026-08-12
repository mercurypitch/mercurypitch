import { fireEvent, render, screen } from '@solidjs/testing-library'
import { createSignal } from 'solid-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ExerciseShell } from '@/features/exercises/ExerciseShell'
import { resetTimerPreference, setTimerMode, timerMode, } from '@/features/exercises/timer-preference'
import type { ExerciseStatus, GuidedPracticeLaunchConfig, } from '@/features/exercises/types'
import { EXERCISE_LONG_NOTE, EXERCISE_PITCH_HOLD, } from '@/features/exercises/types'

const tick = () => new Promise((r) => setTimeout(r, 0))

describe('ExerciseShell auto-timer', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    resetTimerPreference()
  })

  // Regression: the base exercise replaces its state object every animation
  // frame (elapsedMs), so an `on(() => props.status(), ...)` effect that reads
  // the whole state would re-run ~60x/sec and perpetually re-arm the timer —
  // the countdown never decreases and it never auto-stops. The status memo must
  // gate the effect so the timer is armed exactly once per activation.
  it('arms the countdown once on activation, not on every state change', async () => {
    const setIntervalSpy = vi
      .spyOn(globalThis, 'setInterval')
      .mockReturnValue(0 as unknown as ReturnType<typeof setInterval>)
    vi.spyOn(globalThis, 'clearInterval').mockImplementation(() => {})

    const [status, setStatus] = createSignal<ExerciseStatus>('idle')
    // Stands in for the per-frame state churn (elapsedMs updates).
    const [frame, setFrame] = createSignal(0)
    const onElapse = vi.fn()

    render(() => (
      <ExerciseShell
        type={EXERCISE_LONG_NOTE}
        title="Test"
        status={() => {
          frame() // status accessor depends on the churning state, as in the app
          return status()
        }}
        currentScore={() => 0}
        resultScore={() => null}
        onBack={() => {}}
        onStart={() => {}}
        activeContent={<div>active</div>}
        onStop={() => {}}
        resultSummary={<>summary</>}
        onTryAgain={() => {}}
        onChangeTarget={() => {}}
        autoTimer={{ presets: [5], onElapse }}
      />
    ))

    // Choose a 5s timer while idle.
    fireEvent.click(screen.getByText('5s'))
    await tick()
    expect(setIntervalSpy).not.toHaveBeenCalled()

    // Activate → timer armed exactly once.
    setStatus('active')
    await tick()
    expect(setIntervalSpy).toHaveBeenCalledTimes(1)

    // Simulate animation frames mutating the state the status accessor reads.
    for (let i = 0; i < 8; i++) {
      setFrame((n) => n + 1)
      await tick()
    }

    // Still armed only once — the memo prevented spurious re-arms.
    expect(setIntervalSpy).toHaveBeenCalledTimes(1)
    expect(onElapse).not.toHaveBeenCalled()
  })

  it('runs the reviewed guided dose without changing the global timer preference', async () => {
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
    const [status, setStatus] = createSignal<ExerciseStatus>('idle')
    const onBack = vi.fn()
    let now = 0
    let intervalCallback: (() => void) | undefined
    vi.spyOn(performance, 'now').mockImplementation(() => now)
    vi.spyOn(globalThis, 'setInterval').mockImplementation((callback) => {
      intervalCallback = callback as () => void
      return 1 as unknown as ReturnType<typeof setInterval>
    })
    vi.spyOn(globalThis, 'clearInterval').mockImplementation(() => {})
    setTimerMode(30)

    render(() => (
      <ExerciseShell
        type={EXERCISE_PITCH_HOLD}
        title="Pitch Hold"
        status={status}
        currentScore={() => 0}
        resultScore={() => (status() === 'complete' ? 80 : null)}
        onBack={onBack}
        guidedPractice={guidedPractice}
        guidedCompletionReady={() => true}
        onStart={() => setStatus('active')}
        activeContent={<div>active</div>}
        onStop={() => setStatus('complete')}
        resultSummary={<>summary</>}
        onTryAgain={() => setStatus('active')}
        onChangeTarget={() => {}}
        autoTimer={{ onElapse: () => setStatus('complete') }}
      />
    ))

    expect(screen.getByText('1 set · 3 holds · 5s each')).toBeVisible()
    expect(
      screen.getByText('Stop immediately if anything feels uncomfortable.'),
    ).toBeVisible()
    expect(screen.queryByRole('group', { name: 'Auto-score timer' })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Start' }))
    await tick()
    expect(screen.getByText('Hold 1 of 3')).toBeVisible()
    expect(timerMode()).toBe(30)

    for (let completed = 1; completed <= 3; completed += 1) {
      now += 5_000
      intervalCallback?.()
      await tick()
      const resultStatus = screen.getByRole('status')
      expect(resultStatus).toHaveTextContent('Hold complete')
      expect(resultStatus).toHaveFocus()
      expect(screen.queryByText('80%')).toBeNull()
      expect(document.querySelector('.exercise-score-display')).toBeNull()
      if (completed < 3) {
        fireEvent.click(
          screen.getByRole('button', {
            name: `Next hold · ${completed + 1} of 3`,
          }),
        )
        await tick()
      }
    }

    expect(
      screen.getByRole('button', { name: 'Return to Focus reading' }),
    ).toBeVisible()
    expect(timerMode()).toBe(30)
    fireEvent.click(
      screen.getByRole('button', { name: 'Return to Focus reading' }),
    )
    expect(onBack).toHaveBeenCalledOnce()
  })

  it('requires voiced evidence before a timed guided hold advances the dose', async () => {
    const guidedPractice: GuidedPracticeLaunchConfig = {
      assessmentRunId: 'run-silent',
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
    const [status, setStatus] = createSignal<ExerciseStatus>('idle')
    const [completionReady, setCompletionReady] = createSignal(false)
    let now = 0
    let intervalCallback: (() => void) | undefined
    vi.spyOn(performance, 'now').mockImplementation(() => now)
    vi.spyOn(globalThis, 'setInterval').mockImplementation((callback) => {
      intervalCallback = callback as () => void
      return 1 as unknown as ReturnType<typeof setInterval>
    })
    vi.spyOn(globalThis, 'clearInterval').mockImplementation(() => {})

    render(() => (
      <ExerciseShell
        type={EXERCISE_PITCH_HOLD}
        title="Pitch Hold"
        status={status}
        currentScore={() => 0}
        resultScore={() => (status() === 'complete' ? 0 : null)}
        onBack={() => {}}
        guidedPractice={guidedPractice}
        guidedCompletionReady={completionReady}
        onStart={() => setStatus('active')}
        activeContent={<div>active</div>}
        onStop={() => setStatus('complete')}
        resultSummary={<>silent result must be suppressed</>}
        onTryAgain={() => setStatus('active')}
        onChangeTarget={() => {}}
        autoTimer={{ onElapse: () => setStatus('complete') }}
      />
    ))

    fireEvent.click(screen.getByRole('button', { name: 'Start' }))
    await tick()
    now += 5_000
    intervalCallback?.()
    await tick()

    expect(screen.getByRole('status')).toHaveTextContent(
      'Hold needs another try',
    )
    expect(screen.getByText('Hold 1 of 3 needs another try')).toBeVisible()
    expect(
      screen.getByText(/did not hear enough sustained voice/),
    ).toBeVisible()
    expect(screen.queryByText('silent result must be suppressed')).toBeNull()
    expect(
      screen.queryByRole('group', { name: 'How did stopping feel?' }),
    ).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Retry hold · 1 of 3' }))
    await tick()
    expect(screen.getByText('Hold 1 of 3')).toBeVisible()

    setCompletionReady(true)
    now += 5_000
    intervalCallback?.()
    await tick()
    expect(
      screen.getByRole('button', { name: 'Next hold · 2 of 3' }),
    ).toBeVisible()
  })

  it('asks why an early guided stop happened and never escalates after discomfort', async () => {
    const guidedPractice: GuidedPracticeLaunchConfig = {
      assessmentRunId: 'run-discomfort',
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
    const [status, setStatus] = createSignal<ExerciseStatus>('idle')
    const onBack = vi.fn()
    const onTryAgain = vi.fn(() => setStatus('active'))

    render(() => (
      <ExerciseShell
        type={EXERCISE_PITCH_HOLD}
        title="Pitch Hold"
        status={status}
        currentScore={() => 0}
        resultScore={() => (status() === 'complete' ? 42 : null)}
        onBack={onBack}
        guidedPractice={guidedPractice}
        onStart={() => setStatus('active')}
        activeContent={<div>active</div>}
        stopLabel="Stop now"
        onStop={() => setStatus('complete')}
        resultSummary={<>pitch result that must be suppressed</>}
        onTryAgain={onTryAgain}
        onChangeTarget={() => {}}
      />
    ))

    fireEvent.click(screen.getByRole('button', { name: 'Start' }))
    fireEvent.click(screen.getByRole('button', { name: 'Stop now' }))
    await tick()

    expect(
      screen.getByRole('group', { name: 'How did stopping feel?' }),
    ).toBeVisible()
    expect(screen.queryByRole('button', { name: /Retry hold/ })).toBeNull()

    fireEvent.click(
      screen.getByRole('button', { name: 'It felt uncomfortable' }),
    )
    await tick()

    expect(screen.getByText('Stopped for comfort')).toBeVisible()
    expect(screen.getByText('Dose ended')).toBeVisible()
    expect(
      screen.getByText(
        'End this dose for today. No further hold is suggested.',
      ),
    ).toBeVisible()
    expect(
      screen.queryByText('pitch result that must be suppressed'),
    ).toBeNull()
    expect(onTryAgain).not.toHaveBeenCalled()

    fireEvent.click(
      screen.getByRole('button', { name: 'Return to Focus reading' }),
    )
    expect(onBack).toHaveBeenCalledOnce()
  })
})

describe('ExerciseShell stop control', () => {
  // The Stop control is icon-only at every viewport (the labelled pill ate
  // a full-width rail on tablets); the label must survive as aria-label and
  // title or the button is a mystery square to assistive tech and hover.
  it('renders icon-only with the label on aria-label and title', () => {
    const { container } = render(() => (
      <ExerciseShell
        type={EXERCISE_LONG_NOTE}
        title="Test"
        status={() => 'active'}
        currentScore={() => 0}
        resultScore={() => null}
        onBack={() => {}}
        onStart={() => {}}
        activeContent={<div>active</div>}
        onStop={() => {}}
        resultSummary={<>summary</>}
        onTryAgain={() => {}}
        onChangeTarget={() => {}}
        stopLabel="End Warmup"
      />
    ))

    const stop = container.querySelector('.exercise-btn-stop')
    expect(stop).not.toBeNull()
    expect(stop!.getAttribute('aria-label')).toBe('End Warmup')
    expect(stop!.getAttribute('title')).toBe('End Warmup')
    expect(stop!.textContent).toBe('')
    expect(stop!.querySelector('svg')).not.toBeNull()
  })
})
