// ============================================================
// The warmup's caption row — one strip, not two
// ============================================================
//
// The run view used to spend two full rows on two short lines: the
// approach-run announcement ("Nice — next: Humming") in the shell's phase
// slot at the very top of the runner, and the guide toggle stacked under
// the step instruction. On a landscape tablet that is the height that
// decides whether the step fits the fold (owner report, 2026-08-17).
//
// Both now live in one row immediately above the canvas. This pins the
// arrangement, because the arrangement IS the fix — the announcement and
// the toggle rendering somewhere, in any order, would look fine in a unit
// test and still cost the row back.

import { render } from '@solidjs/testing-library'
import type { JSX } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

type SessionOpts = { onLoopLimitReached: () => void }
const captured: { opts: SessionOpts | null } = { opts: null }

vi.mock('@/features/zen/useZenPitchSession', () => ({
  useZenPitchSession: (opts: SessionOpts) => {
    captured.opts = opts
    return {
      status: () => 'running',
      elapsedSec: () => 0,
      loopsCompleted: () => 0,
      targets: () => [],
      activePoints: () => [],
      viewport: () => ({ minMidi: 48, maxMidi: 72 }),
      targetVisibility: () => 'full',
      progressCue: () => 'playhead',
      loopDurationSec: () => 10,
      runs: () => [],
      selectExercise: vi.fn(),
      setRootMidi: vi.fn(),
      start: vi.fn(async () => true),
      finish: vi.fn(),
    }
  },
}))

vi.mock('@/features/zen/ZenPitchCanvas', () => ({
  ZenPitchCanvas: () => null,
}))

// A shell stand-in that renders the run view and records every slot it was
// handed. `activePhase` is the slot the announcement used to travel in; the
// point of the change is that warmup no longer needs it.
const shellProps: { last: Record<string, unknown> | null } = { last: null }
vi.mock('@/features/exercises/ExerciseShell', () => ({
  ExerciseShell: (props: Record<string, unknown>) => {
    shellProps.last = props
    return (props.activeContent ?? null) as JSX.Element
  },
}))

vi.mock('@/features/exercises/use-base-exercise', () => ({
  useBaseExercise: () => ({
    state: () => ({ status: 'running', currentScore: 0 }),
    start: vi.fn(async () => true),
    reset: vi.fn(),
    error: () => null,
    result: () => null,
    _updateScore: vi.fn(),
    _updateMetrics: vi.fn(),
    _completeWithResult: vi.fn(),
  }),
}))

vi.mock('@/stores/exercise-history-store', () => ({
  recordExerciseResult: vi.fn(),
}))
vi.mock('@/features/practice-intelligence/difficulty-store', () => ({
  updateDifficultyFromEma: vi.fn(),
}))

const { default: WarmupExercise } =
  await import('@/features/exercises/warmup/WarmupExercise')

const mount = (): { unmount: () => void } =>
  render(() => (
    <WarmupExercise
      audioEngine={
        {
          playMetronomeClick: vi.fn(),
          playTone: vi.fn(async () => undefined),
          playChord: vi.fn().mockResolvedValue(undefined),
        } as never
      }
      practiceEngine={{} as never}
      subscribeFrames={() => () => {}}
      onBack={() => {}}
    />
  ))

describe('the warmup caption row', () => {
  beforeEach(() => {
    captured.opts = null
    shellProps.last = null
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('sits directly above the canvas', () => {
    const { unmount } = mount()

    const row = document.querySelector('.warmup-caption-row')
    const canvas = document.querySelector('.warmup-canvas')
    expect(row).not.toBeNull()
    expect(canvas).not.toBeNull()
    // Immediately above, not merely earlier in the document: anything
    // between them is another row of height above the visual.
    expect(row!.nextElementSibling).toBe(canvas)

    unmount()
  })

  it('carries the guide toggle in the corner instead of a row of its own', () => {
    const { unmount } = mount()

    const toggle = document.querySelector('[data-testid="warmup-guide-mute"]')
    expect(toggle).not.toBeNull()
    expect(toggle!.closest('.warmup-caption-row')).not.toBeNull()
    // It used to be the fourth stacked child of the step block, which is a
    // column — that is the row this change buys back.
    expect(toggle!.closest('.warmup-step-display')).toBeNull()

    unmount()
  })

  it('asks the shell for no phase row at all', () => {
    const { unmount } = mount()

    expect(shellProps.last).not.toBeNull()
    // Passing activePhase would re-open the strip at the top of the runner
    // and undo the saving even with the caption row in place.
    expect(shellProps.last!.activePhase).toBeUndefined()

    unmount()
  })

  it('keeps the step text above the caption, in reading order', () => {
    const { unmount } = mount()

    const stage = document.querySelector('.warmup-stage')
    const order = [...stage!.children].map((el) => el.className)
    expect(order).toEqual([
      'warmup-step-display',
      'warmup-caption-row',
      'warmup-canvas',
    ])

    unmount()
  })
})
