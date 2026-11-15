// ============================================================
// Scale Runner's setup screen opens on the scale a launch asked for
// ============================================================
//
// A lesson's slug can ask Scale Runner for its own scale. The screen is read
// here through the real ExerciseShell: the picker's choice, the idle hint's
// promise of the run, and then Start is pressed and the real controller's
// run is held to that promise. Only the base exercise, which owns the
// microphone, is a stand-in.

import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { clearLaunchOverride, setLaunchOverride, } from '@/features/practice-intelligence/launch-override'
import { EXERCISE_SCALE_RUNNER } from '../types'
import ScaleRunnerExercise from './ScaleRunnerExercise'

const { baseRef } = vi.hoisted(() => ({
  baseRef: {
    metrics: [] as Array<Record<string, number>>,
    disposers: [] as Array<() => void>,
  },
}))

vi.mock('@/features/exercises/use-base-exercise', () => ({
  useBaseExercise: () => ({
    state: () => ({
      status: 'idle',
      currentScore: 0,
      elapsedMs: 0,
      metrics: {},
    }),
    start: async () => true,
    // What unmount does: the controller's dispose stops its note chain.
    reset: () => {
      for (const fn of baseRef.disposers.splice(0)) fn()
    },
    error: () => null,
    result: () => null,
    currentPitch: () => null,
    pitchHistory: () => [],
    _registerDispose: (fn: () => void) => baseRef.disposers.push(fn),
    _setTargetPitch: () => {},
    _getElapsed: () => 0,
    _setRunning: () => {},
    _updateScore: () => {},
    _updateMetrics: (m: Record<string, number>) => baseRef.metrics.push(m),
    _completeWithResult: () => {},
  }),
}))

/** Render the setup screen and return its container. */
function renderSetup(): HTMLElement {
  return render(() => (
    <ScaleRunnerExercise
      audioEngine={{ playTone: async () => {} } as never}
      practiceEngine={{} as never}
      onBack={() => {}}
    />
  )).container
}

function idleHint(container: HTMLElement): string | null | undefined {
  return container.querySelector('.idle-hint')?.textContent
}

/** The Scale picker: the first of the setup screen's two selects. */
function scalePicker(container: HTMLElement): HTMLSelectElement {
  return container.querySelector('select') as HTMLSelectElement
}

/** Press Start and return the note count the run announces. */
async function startRun(): Promise<number | undefined> {
  fireEvent.click(screen.getByRole('button', { name: 'Start' }))
  await vi.waitFor(() => {
    expect(baseRef.metrics.some((m) => 'scaleLength' in m)).toBe(true)
  })
  return baseRef.metrics.find((m) => 'scaleLength' in m)?.scaleLength
}

describe("Scale Runner's setup screen", () => {
  afterEach(() => {
    cleanup()
    clearLaunchOverride()
    baseRef.metrics = []
  })

  it('opens on the scale a launch asked for, and runs it', async () => {
    setLaunchOverride(EXERCISE_SCALE_RUNNER, {
      type: EXERCISE_SCALE_RUNNER,
      scale: 'pentatonic-minor',
    })
    const container = renderSetup()

    const hint = idleHint(container)
    const picked = scalePicker(container).value
    const scaleLength = await startRun()

    // Five notes and the octave: an eight-note major run would say 8.
    expect(picked).toBe('pentatonic-minor')
    expect(hint).toBe('6 notes · Minor Pentatonic · up')
    expect(scaleLength).toBe(6)
  })

  it('opens on the major scale without a launch', async () => {
    const container = renderSetup()

    const hint = idleHint(container)
    const picked = scalePicker(container).value
    const scaleLength = await startRun()

    expect(picked).toBe('major')
    expect(hint).toBe('8 notes · Major · up')
    expect(scaleLength).toBe(8)
  })

  it('opens on the major scale for a launch naming a scale it does not run', () => {
    setLaunchOverride(EXERCISE_SCALE_RUNNER, {
      type: EXERCISE_SCALE_RUNNER,
      scale: 'dorian',
    })
    const container = renderSetup()

    expect(scalePicker(container).value).toBe('major')
    expect(idleHint(container)).toBe('8 notes · Major · up')
  })

  it("counts the notes of the picker's scale, not of a major run", () => {
    const container = renderSetup()

    fireEvent.change(scalePicker(container), { target: { value: 'chromatic' } })

    expect(idleHint(container)).toBe('13 notes · Chromatic · up')
  })

  it('lists the three minors and both pentatonics', () => {
    const container = renderSetup()

    const labels = [...scalePicker(container).options].map((o) => o.textContent)

    expect(labels).toEqual([
      'Major',
      'Minor',
      'Harmonic Minor',
      'Melodic Minor',
      'Pentatonic',
      'Minor Pentatonic',
      'Chromatic',
    ])
  })
})
