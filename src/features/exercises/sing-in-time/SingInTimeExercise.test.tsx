// ============================================================
// Sing It in Time, through the shell: setup, Hear it first, a run, the result
// ============================================================
//
// The real shell, controller, player and judge; only the base exercise,
// which owns the microphone, is a stand-in, and it hears nothing. The app's
// audio context is missing, so every beat is timed on the page's clock, as
// on a phone whose sound is off: the run is drawn and judged all the same.

import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { clearExerciseHistory, exerciseHistory, flushExerciseHistoryWrites, } from '@/stores/exercise-history-store'
import type { ExerciseResult } from '../types'
import { EXERCISE_SING_IN_TIME, runStoppedEarly } from '../types'
import SingInTimeExercise from './SingInTimeExercise'

// jsdom has no WebGL, so Merc is his still here whatever the gate says.
vi.mock('@/lib/merc/gpu-gate', () => ({
  canRunLiveMerc: () => false,
  waitForLiveMerc: () => () => undefined,
}))

const { disposers } = vi.hoisted(() => ({ disposers: [] as (() => void)[] }))

vi.mock('@/features/exercises/use-base-exercise', async () => {
  const { createSignal } = await import('solid-js')
  return {
    useBaseExercise: () => {
      const [state, setState] = createSignal({
        status: 'idle' as string,
        currentScore: 0,
        elapsedMs: 0,
        metrics: {},
      })
      const [result, setResult] = createSignal<ExerciseResult | null>(null)
      let startedAt = 0
      return {
        state,
        start: async () => {
          startedAt = performance.now()
          setState((s) => ({ ...s, status: 'active' }))
          return true
        },
        reset: () => {
          for (const fn of disposers) fn()
          setResult(null)
          setState((s) => ({ ...s, status: 'idle', currentScore: 0 }))
        },
        stop: () => {},
        error: () => null,
        result,
        currentPitch: () => null,
        pitchHistory: () => [],
        _registerDispose: (fn: () => void) => disposers.push(fn),
        _setTargetPitch: () => {},
        _getElapsed: () => performance.now() - startedAt,
        _setRunning: () => {},
        _updateScore: (score: number) =>
          setState((s) => ({ ...s, currentScore: score })),
        _updateMetrics: () => {},
        _completeWithResult: (r: ExerciseResult) => {
          setResult(r)
          setState((s) => ({ ...s, status: 'complete' }))
        },
      }
    },
  }
})

function open() {
  const view = render(() => (
    <SingInTimeExercise
      audioEngine={
        {
          init: async () => {},
          resume: async () => {},
          getAudioContext: () => null,
          getVolume: () => 1,
          getMetronomeVolume: () => 1,
        } as never
      }
      practiceEngine={{} as never}
      onBack={() => {}}
    />
  ))
  const say = () =>
    view.container.querySelector('.exercise-active-phase')?.textContent ?? ''
  const coach = () => view.getByTestId('exercise-stage-coach').textContent ?? ''
  return { ...view, say, coach }
}

describe('Sing It in Time', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    localStorage.clear()
    clearExerciseHistory()
  })

  afterEach(async () => {
    cleanup()
    disposers.length = 0
    // a finished run's save is in flight on the faked clock: run it out first
    await vi.runAllTimersAsync()
    vi.useRealTimers()
    await flushExerciseHistoryWrites()
    clearExerciseHistory()
    localStorage.clear()
  })

  it('opens on its brief and the first tune to read, at the level a new singer starts on', () => {
    const drill = open()
    expect(drill.coach()).toContain(
      "I give you do, then the click counts one bar. Keep reading: the beat won't wait.",
    )
    expect(drill.container.querySelector('.idle-hint')?.textContent).toBe(
      '3 tunes · 60 BPM · quarters and halves, steps and thirds',
    )
    const staff = drill.getByTestId('tune-staff')
    expect(staff.getAttribute('aria-label')).toMatch(/^(Treble|Bass) staff in /)
    expect(drill.container.textContent).toMatch(/Tune 1 of 3 · in [A-G]/)
    expect(drill.getAllByTestId('tune-note').length).toBeGreaterThanOrEqual(5)
  })

  it('turns the names off and keeps the choice', () => {
    const drill = open()
    fireEvent.click(drill.getByRole('button', { name: 'Names on' }))
    expect(
      drill
        .getByRole('button', { name: 'Names off' })
        .getAttribute('aria-pressed'),
    ).toBe('false')
    expect(localStorage.getItem('pitchperfect_sing_in_time_names')).toBe(
      'false',
    )
  })

  it('keeps the click to the count-in until the singer asks for it under the singing', () => {
    const drill = open()
    const click = drill.getByRole('switch', { name: /Click while I sing/ })
    expect(click.getAttribute('aria-checked')).toBe('false')
    fireEvent.click(click)
    expect(click.getAttribute('aria-checked')).toBe('true')
    expect(localStorage.getItem('pitchperfect_sing_in_time_click')).toBe('true')
  })

  it('plays the tune first, its key on Merc’s line and the cursor moving on the staff', async () => {
    const drill = open()
    fireEvent.click(screen.getByRole('button', { name: 'Hear it first' }))
    await vi.advanceTimersByTimeAsync(0)
    expect(
      drill.container.querySelector('.exercise-stage-demo-line')?.textContent,
    ).toMatch(
      /^Listen: do, the count-in, then the tune on the beat, in [A-G]♭? major\.$/,
    )
    // into the tune's first bar: the cursor is on the staff
    await vi.advanceTimersByTimeAsync(7000)
    expect(drill.queryByTestId('tune-cursor')).not.toBeNull()
    expect(
      drill
        .getAllByTestId('tune-note')
        .some((n) => n.getAttribute('data-tone') === 'now'),
    ).toBe(true)
  })

  it('counts in, says each note as its beat comes, and after a silent run asks after the microphone', async () => {
    const drill = open()
    fireEvent.click(drill.getByRole('button', { name: 'Start' }))
    await vi.advanceTimersByTimeAsync(0)
    expect(drill.say()).toMatch(/^This is do\. The tune is in [A-G]♭? major\.$/)
    await vi.advanceTimersByTimeAsync(2300)
    expect(drill.say()).toBe('One.')
    expect(drill.getByTestId('beat-pulse')).toBeTruthy()
    await vi.advanceTimersByTimeAsync(2000)
    expect(drill.say()).toBe('One, two, ready.')
    await vi.advanceTimersByTimeAsync(1900)
    expect(drill.say()).toMatch(/^[A-Z][a-z]+, on 1/)

    await vi.advanceTimersByTimeAsync(60_000)
    expect(drill.coach()).toContain(
      "I didn't hear a note. Check the microphone, then sing along on the next run.",
    )
    const byNote = drill.getByTestId('note-by-note')
    expect(
      byNote.querySelectorAll('button[aria-label^="Hear tune"]'),
    ).toHaveLength(3)
    const pitches = Array.from(byNote.querySelectorAll('[data-pitch]')).map(
      (n) => n.getAttribute('data-pitch'),
    )
    expect(pitches.length).toBeGreaterThanOrEqual(15)
    expect(new Set(pitches)).toEqual(new Set(['not-heard']))
    const saved = exerciseHistory().filter(
      (r) => r.type === EXERCISE_SING_IN_TIME,
    )
    expect(saved).toHaveLength(1)
    expect(saved[0].score).toBe(0)
    expect(runStoppedEarly(saved[0].metrics)).toBe(false)
  })

  it('calls a stopped run practice, and says so', async () => {
    const drill = open()
    fireEvent.click(drill.getByRole('button', { name: 'Start' }))
    await vi.advanceTimersByTimeAsync(8000)
    fireEvent.click(drill.getByRole('button', { name: 'Stop' }))
    await vi.advanceTimersByTimeAsync(0)
    expect(drill.coach()).toContain(
      'Stopped before the end, so that one was practice. The notes you sang are below.',
    )
    const saved = exerciseHistory().filter(
      (r) => r.type === EXERCISE_SING_IN_TIME,
    )
    expect(saved).toHaveLength(1)
    expect(runStoppedEarly(saved[0].metrics)).toBe(true)
  })
})
