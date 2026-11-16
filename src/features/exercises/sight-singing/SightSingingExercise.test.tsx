// ============================================================
// Sight-Singing, through the shell: the line, its setup, Hear it first, a run
// ============================================================
//
// The real shell, controller, key, line and staff; only the base exercise,
// which owns the microphone, is a stand-in, and it hears what a test says.

import { cleanup, fireEvent, render } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { clearLaunchOverride, setLaunchOverride, } from '@/features/practice-intelligence/launch-override'
import { setKeyName, setScaleType } from '@/stores/app-store'
import { clearExerciseHistory, flushExerciseHistoryWrites, } from '@/stores/exercise-history-store'
import { setVocalRangePreset } from '@/stores/settings-store'
import type { ExerciseResult } from '../types'
import { EXERCISE_SIGHT_SINGING } from '../types'
import SightSingingExercise from './SightSingingExercise'

// jsdom has no WebGL, so Merc is his still here whatever the gate says.
vi.mock('@/lib/merc/gpu-gate', () => ({
  canRunLiveMerc: () => false,
  waitForLiveMerc: () => () => undefined,
}))

const { mic, disposers } = vi.hoisted(() => ({
  /** What the stand-in microphone hears, in Hz; 0 for nothing. */
  mic: { hz: 0, targets: [] as number[] },
  disposers: [] as (() => void)[],
}))

vi.mock('@/features/exercises/use-base-exercise', async () => {
  const { createSignal } = await import('solid-js')
  return {
    useBaseExercise: () => {
      const [state, setState] = createSignal({
        status: 'idle' as string,
        currentScore: 0,
        elapsedMs: 0,
        metrics: {} as Record<string, number>,
      })
      const [result, setResult] = createSignal<ExerciseResult | null>(null)
      let startedAt = 0
      const heard = () =>
        mic.hz > 0 ? { freq: mic.hz, clarity: 1, noteName: '' } : null
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
        currentPitch: heard,
        pitchHistory: () => {
          const now = (performance.now() - startedAt) / 1000
          return mic.hz > 0
            ? [
                { freq: mic.hz, time: Math.max(0, now - 0.001), cents: 0 },
                { freq: mic.hz, time: now, cents: 0 },
              ]
            : []
        },
        voiceCapture: undefined,
        _registerDispose: (fn: () => void) => disposers.push(fn),
        _setTargetPitch: (hz: number | null) => {
          if (hz !== null) mic.targets.push(hz)
        },
        _getElapsed: () => performance.now() - startedAt,
        _isRunning: () => true,
        _setRunning: () => {},
        _updateScore: (score: number) =>
          setState((s) => ({ ...s, currentScore: score })),
        _updateMetrics: (m: Record<string, number>) =>
          setState((s) => ({ ...s, metrics: { ...s.metrics, ...m } })),
        _completeWithResult: (r: ExerciseResult) => {
          setResult(r)
          setState((s) => ({ ...s, status: 'complete' }))
        },
      }
    },
  }
})

const hz = (midi: number): number => 440 * 2 ** ((midi - 69) / 12)

function open() {
  const tones: number[] = []
  const view = render(() => (
    <SightSingingExercise
      audioEngine={
        {
          playTone: (frequency: number) => {
            tones.push(frequency)
            return Promise.resolve()
          },
          stopTone: () => {},
        } as never
      }
      practiceEngine={{} as never}
      onBack={() => {}}
    />
  ))
  const staff = () => view.getByTestId('sight-staff')
  const names = () =>
    view.queryAllByTestId('sight-name').map((n) => n.textContent)
  const midis = () =>
    view
      .queryAllByTestId('sight-note')
      .map((n) => Number(n.getAttribute('data-midi')))
  const chip = (group: string, label: string) =>
    Array.from(
      view.getByRole('group', { name: group }).querySelectorAll('button'),
    ).find((b) => b.textContent === label)!
  const start = async () => {
    fireEvent.click(view.container.querySelector('.exercise-idle-start')!)
    await vi.advanceTimersByTimeAsync(0)
  }
  const hint = () => view.container.querySelector('.idle-hint')?.textContent
  return { ...view, tones, staff, names, midis, chip, start, hint }
}

describe('Sight-Singing', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    localStorage.clear()
    clearExerciseHistory()
    setVocalRangePreset('tenor')
    setKeyName('C')
    setScaleType('major')
    mic.hz = 0
    mic.targets = []
    // The run's tracker draws a pitch trail; jsdom has no 2D canvas.
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
  })

  afterEach(async () => {
    cleanup()
    vi.restoreAllMocks()
    disposers.length = 0
    clearLaunchOverride()
    await vi.runAllTimersAsync()
    vi.useRealTimers()
    await flushExerciseHistoryWrites()
    clearExerciseHistory()
    localStorage.clear()
    setKeyName('C')
    setScaleType('major')
  })

  it('opens on the line to read, six notes in the Singing tab’s key, on the treble staff for a tenor', () => {
    const page = open()

    expect(page.staff().getAttribute('data-clef')).toBe('treble')
    expect(page.midis()).toHaveLength(6)
    expect(page.hint()).toBe('6 notes · C major')
    expect(page.names()).toHaveLength(6)
  })

  it('opens on the bass staff for a bass or a baritone', () => {
    setVocalRangePreset('baritone')

    const page = open()

    expect(page.staff().getAttribute('data-clef')).toBe('bass')
    expect(page.chip('Clef', 'Bass').getAttribute('aria-pressed')).toBe('true')
  })

  it('writes the key the Singing tab is set to, with its signature', () => {
    setKeyName('Bb')
    setScaleType('major')

    const page = open()

    expect(page.hint()).toBe('6 notes · B♭ major')
    expect(page.queryAllByTestId('sight-key-sign')).toHaveLength(2)
  })

  it('remembers the clef and the names the singer picks', () => {
    const first = open()
    fireEvent.click(first.chip('Clef', 'Bass'))
    fireEvent.click(first.chip('Names', 'Off'))
    cleanup()

    const again = open()

    expect(again.staff().getAttribute('data-clef')).toBe('bass')
    expect(again.chip('Names', 'Off').getAttribute('aria-pressed')).toBe('true')
    expect(again.names()).toEqual([])
  })

  it('names each note by its letter, by its syllable, or not at all', () => {
    setLaunchOverride(EXERCISE_SIGHT_SINGING, {
      type: EXERCISE_SIGHT_SINGING,
      targetNotes: ['A4', 'G#4', 'A4', 'E5'],
      key: 'A',
      scale: 'harmonic-minor',
    })
    const page = open()

    expect(page.names()).toEqual(['A', 'G♯', 'A', 'E'])
    fireEvent.click(page.chip('Names', 'Do re mi'))
    expect(page.names()).toEqual(['do', 'ti', 'do', 'so'])
    fireEvent.click(page.chip('Names', 'Off'))
    expect(page.names()).toEqual([])
    expect(page.staff().getAttribute('aria-label')).toContain(
      'the second space, the second line',
    )
  })

  it("reads a launch's key and scale in place of the Singing tab's", () => {
    setKeyName('Bb')
    setLaunchOverride(EXERCISE_SIGHT_SINGING, {
      type: EXERCISE_SIGHT_SINGING,
      key: 'A',
      scale: 'harmonic-minor',
    })

    const page = open()

    expect(page.hint()).toBe('6 notes · A harmonic minor')
    expect(page.staff().getAttribute('data-key')).toBe('A')
    // Six notes of A harmonic minor: G is always sharp.
    for (const midi of page.midis()) expect(midi % 12).not.toBe(7)
  })

  it('sings a launched phrase as the line, in a key that holds it when the launch names none', () => {
    setKeyName('D')
    setLaunchOverride(EXERCISE_SIGHT_SINGING, {
      type: EXERCISE_SIGHT_SINGING,
      targetNotes: ['E4', 'E4', 'F4', 'G4', 'G4', 'F4', 'E4', 'D4', 'C4'],
    })

    const page = open()

    expect(page.hint()).toBe('9 notes · C major')
    expect(page.midis()).toEqual([64, 64, 65, 67, 67, 65, 64, 62, 60])
  })

  it('plays do, then do-mi-so-mi-do, when asked to hear it first, and says so', async () => {
    setLaunchOverride(EXERCISE_SIGHT_SINGING, {
      type: EXERCISE_SIGHT_SINGING,
      targetNotes: ['G3', 'A3', 'B3', 'A3', 'G3'],
      key: 'G',
    })
    const page = open()

    fireEvent.click(page.getByRole('button', { name: 'Hear it first' }))
    await vi.advanceTimersByTimeAsync(5_000)

    expect(page.tones).toEqual([55, 55, 59, 62, 59, 55].map(hz))
    expect(page.getByTestId('exercise-stage-coach').textContent).not.toContain(
      'G3',
    )
  })

  it("says what the start is while it plays: do and the key's triad", async () => {
    setLaunchOverride(EXERCISE_SIGHT_SINGING, {
      type: EXERCISE_SIGHT_SINGING,
      targetNotes: ['A3', 'B3', 'C4'],
      key: 'A',
      scale: 'natural-minor',
    })
    const page = open()

    fireEvent.click(page.getByRole('button', { name: 'Hear it first' }))
    await vi.advanceTimersByTimeAsync(10)

    expect(page.getByTestId('exercise-stage-coach').textContent).toContain(
      'Listen: do, then do, me, so, me, do, in A minor.',
    )
  })

  it('sings the line on the staff, and hears a note an octave under the page as the note', async () => {
    setLaunchOverride(EXERCISE_SIGHT_SINGING, {
      type: EXERCISE_SIGHT_SINGING,
      targetNotes: ['G4', 'A4', 'B4'],
      key: 'G',
    })
    const page = open()
    const line = page.midis()

    await page.start()
    // The singer sings G3, an octave under the written G4.
    mic.hz = hz(55)
    await vi.advanceTimersByTimeAsync(600)

    expect(mic.targets[0]).toBeCloseTo(hz(line[0]), 6)
    const first = page.queryAllByTestId('sight-note')[0]
    expect(first.getAttribute('data-tone')).toBe('held')
    expect(
      page.container.querySelector('.exercise-active-phase')?.textContent,
    ).toBe('Note 2 of 3: read it, then sing.')
  })

  it('with the names off, names no note under the staff and none on the hold bar', async () => {
    localStorage.setItem('pitchperfect_sight_singing_names', 'off')
    setLaunchOverride(EXERCISE_SIGHT_SINGING, {
      type: EXERCISE_SIGHT_SINGING,
      targetNotes: ['G4', 'A4', 'B4'],
      key: 'G',
    })
    const page = open()

    await page.start()

    expect(page.names()).toEqual([])
    expect(
      page.container.querySelector('.sight-singing-hold')?.textContent,
    ).toBe('Hold the lit note to continue')
  })

  it('names the lit note on the hold bar by its syllable with do re mi on', async () => {
    localStorage.setItem('pitchperfect_sight_singing_names', 'solfege')
    setLaunchOverride(EXERCISE_SIGHT_SINGING, {
      type: EXERCISE_SIGHT_SINGING,
      targetNotes: ['B4', 'A4', 'G4'],
      key: 'G',
    })
    const page = open()

    await page.start()

    expect(
      page.container.querySelector('.sight-singing-hold')?.textContent,
    ).toBe('Hold mi to continue')
  })
})
