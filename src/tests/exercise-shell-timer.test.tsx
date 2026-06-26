import { fireEvent, render, screen } from '@solidjs/testing-library'
import { createSignal } from 'solid-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ExerciseShell } from '@/features/exercises/ExerciseShell'
import type { ExerciseStatus } from '@/features/exercises/types'
import { EXERCISE_LONG_NOTE } from '@/features/exercises/types'

const tick = () => new Promise((r) => setTimeout(r, 0))

describe('ExerciseShell auto-timer', () => {
  afterEach(() => vi.restoreAllMocks())

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
})
