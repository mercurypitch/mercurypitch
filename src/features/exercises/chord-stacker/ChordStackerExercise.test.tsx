// ============================================================
// Chord Stacker, through the shell: its pickers, a launch, a round's words
// ============================================================
//
// The setup screen's two pickers choose what a run deals and are
// remembered; a lesson's launch opens the drill on its own chords for the
// visit; "Hear it first" plays the chosen set's first chord; and a round
// says its chord plainly. The real shell and controller run here. Only the
// base exercise, which owns the microphone, is a stand-in: an honest one,
// whose state moves as the controller drives it.

import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resetAllDifficulties } from '@/features/practice-intelligence/difficulty-store'
import { clearLaunchOverride, setLaunchOverride, } from '@/features/practice-intelligence/launch-override'
import type { AudioEngine } from '@/lib/audio-engine'
import { midiToFrequency } from '@/lib/frequency-to-note'
import { EXERCISE_CHORD_STACKER } from '../types'
import ChordStackerExercise from './ChordStackerExercise'

// jsdom has no WebGL, so Merc is his still here whatever the gate says; the
// stub only spares the log the probe's "not implemented" notice.
vi.mock('@/lib/merc/gpu-gate', () => ({
  canRunLiveMerc: () => false,
  waitForLiveMerc: () => () => undefined,
}))

const { targets } = vi.hoisted(() => ({ targets: [] as number[] }))

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
      const disposers: Array<() => void> = []
      return {
        state,
        start: async () => {
          setState((s) => ({ ...s, status: 'active' }))
          return true
        },
        reset: () => {
          for (const fn of disposers.splice(0)) fn()
          setState((s) => ({ ...s, status: 'idle', metrics: {} }))
        },
        error: () => null,
        result: () => null,
        currentPitch: () => null,
        pitchHistory: () => [],
        _registerDispose: (fn: () => void) => disposers.push(fn),
        _setTargetPitch: (hz: number | null) => {
          if (typeof hz === 'number') {
            targets.push(Math.round(12 * Math.log2(hz / 440) + 69))
          }
        },
        _getElapsed: () => 0,
        _setRunning: () => {},
        _updateScore: () => {},
        _updateMetrics: (m: Record<string, number>) =>
          setState((s) => ({ ...s, metrics: { ...s.metrics, ...m } })),
        _completeWithResult: () => {},
      }
    },
  }
})

function open() {
  const playTone = vi.fn(async (_hz: number, _ms?: number) => {})
  const audioEngine = { playTone, stopTone: vi.fn() } as unknown as AudioEngine
  const view = render(() => (
    <ChordStackerExercise
      audioEngine={audioEngine}
      practiceEngine={{} as never}
      onBack={() => {}}
    />
  ))
  const hint = () => view.container.querySelector('.idle-hint')?.textContent
  const pressed = (group: string) =>
    Array.from(
      screen.getByRole('group', { name: group }).querySelectorAll('button'),
    )
      .filter((b) => b.getAttribute('aria-pressed') === 'true')
      .map((b) => b.textContent)
  const pick = (group: string, chip: string) =>
    fireEvent.click(
      Array.from(
        screen.getByRole('group', { name: group }).querySelectorAll('button'),
      ).find((b) => b.textContent === chip)!,
    )
  const say = () =>
    view.container.querySelector('.exercise-active-phase')?.textContent?.trim()
  return { ...view, playTone, hint, pressed, pick, say }
}

describe('Chord Stacker', () => {
  beforeEach(() => {
    localStorage.clear()
    targets.length = 0
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
    vi.restoreAllMocks()
    clearLaunchOverride()
    resetAllDifficulties()
    localStorage.clear()
  })

  it('opens on the five sevenths in root position, as every run before the pickers was', () => {
    const drill = open()

    expect(drill.hint()).toBe('5 chords · Seventh chords · Root position')
    expect(drill.pressed('Chords')).toEqual(['Sevenths'])
    expect(drill.pressed('Inversions')).toEqual(['Off'])
    expect(
      Array.from(
        screen
          .getByRole('group', { name: 'Chords' })
          .querySelectorAll('button'),
      ).map((b) => b.textContent),
    ).toEqual(['Triads', 'Sevenths', 'Both'])
  })

  it("remembers the singer's chords and inversions for the next visit", () => {
    const first = open()
    first.pick('Chords', 'Triads')
    first.pick('Inversions', 'On')
    expect(first.hint()).toBe('5 chords · Triads · With inversions')
    cleanup()

    const again = open()

    expect(again.pressed('Chords')).toEqual(['Triads'])
    expect(again.pressed('Inversions')).toEqual(['On'])
    expect(again.hint()).toBe('5 chords · Triads · With inversions')
  })

  it("opens the triads address's launch on triads in root position, keeping the singer's own choice", () => {
    // Arrange: the singer last chose both sets, turned over.
    const before = open()
    before.pick('Chords', 'Both')
    before.pick('Inversions', 'On')
    cleanup()
    setLaunchOverride(EXERCISE_CHORD_STACKER, {
      type: EXERCISE_CHORD_STACKER,
      chords: ['major', 'minor', 'diminished', 'augmented'],
      inversions: false,
    })

    // Act
    const drill = open()

    // Assert
    expect(drill.hint()).toBe('5 chords · Triads · Root position')
    expect(drill.pressed('Chords')).toEqual(['Triads'])
    expect(drill.pressed('Inversions')).toEqual(['Off'])
    cleanup()
    clearLaunchOverride()
    const later = open()
    expect(later.pressed('Chords')).toEqual(['Both'])
    expect(later.pressed('Inversions')).toEqual(['On'])
  })

  it("names a launch's own chords, until a chip hands the choice back", () => {
    setLaunchOverride(EXERCISE_CHORD_STACKER, {
      type: EXERCISE_CHORD_STACKER,
      chords: ['dom7', 'no-such-chord'],
      inversions: true,
    })
    const drill = open()
    expect(drill.hint()).toBe('5 chords · Dominant seventh · With inversions')
    expect(drill.pressed('Chords')).toEqual(['Sevenths'])

    drill.pick('Chords', 'Sevenths')

    expect(drill.hint()).toBe('5 chords · Seventh chords · With inversions')
  })

  it("plays the chosen set's first chord as its example, and says which", async () => {
    vi.useFakeTimers()
    const drill = open()
    drill.pick('Chords', 'Triads')

    fireEvent.click(screen.getByRole('button', { name: 'Hear it first' }))
    expect(demoLine(drill.container)).toBe('Listen: a major chord, up from E3.')
    await vi.advanceTimersByTimeAsync(2000)

    // E major on E3, the default tenor's note: E3, G#3 and B3.
    expect(drill.playTone.mock.calls.map(([hz]) => hz)).toEqual(
      [52, 56, 59].map(midiToFrequency),
    )
  })

  it("names each round's chord plainly, then asks for its notes from the bottom up", async () => {
    // Arrange: a deal that keeps the triads in the picker's order and takes
    // each chord's last position first, so the run opens on E major in its
    // second inversion: B3, E4 and G#4.
    vi.useFakeTimers()
    vi.spyOn(Math, 'random').mockReturnValue(0.999)
    // The live view draws a pitch trail; jsdom has no 2D canvas.
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
    const drill = open()
    drill.pick('Chords', 'Triads')
    drill.pick('Inversions', 'On')

    // Act
    fireEvent.click(screen.getByRole('button', { name: 'Start' }))
    await vi.advanceTimersByTimeAsync(0)

    // Assert
    expect(drill.say()).toBe('Listen: E major, second inversion')
    expect(drill.getByTestId('chord-stacker-chord').textContent).toBe(
      'E major, second inversion',
    )
    // Three notes of 600 ms with 300 ms between, then 400 ms.
    await vi.advanceTimersByTimeAsync(2800)
    expect(drill.say()).toBe('Sing note 1 of 3: B3')
    expect(targets).toEqual([59])
  })
})

/** Merc's line while the example sounds. */
function demoLine(container: HTMLElement): string | undefined {
  return (
    container.querySelector('.exercise-stage-demo-line')?.textContent ??
    undefined
  )
}
