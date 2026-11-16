// ============================================================
// ExerciseShell on the stage: Merc beside the sheet, and what he says
// ============================================================
//
// Every drill runs in this shell, so what holds here holds for all of them:
// the shell is a dark stage in either app theme, one Merc stands beside the
// sheet for the whole visit, his bubble carries the drill's brief until a run
// starts and the run's instruction while it lasts, and the idle button
// carries a microphone.

import { cleanup, fireEvent, render } from '@solidjs/testing-library'
import type { JSX } from 'solid-js'
import { createSignal } from 'solid-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { EXERCISE_HELP } from './exercise-help'
import type { ExerciseDemo } from './ExerciseShell'
import { DEMO_LINE_MIN_MS, ExerciseShell } from './ExerciseShell'
import type { ExerciseStatus } from './types'
import { EXERCISE_INTERVAL_TRAINER } from './types'

// jsdom has no WebGL, so Merc is his still here whatever the gate says; the
// stub only spares the log the probe's "not implemented" notice.
vi.mock('@/lib/merc/gpu-gate', () => ({
  canRunLiveMerc: () => false,
  waitForLiveMerc: () => () => undefined,
}))

const tick = () => new Promise((resolve) => setTimeout(resolve, 0))

interface Staged {
  brief?: JSX.Element
  instruction?: JSX.Element
  score?: number
  demo?: ExerciseDemo
}

/** A drill on the stage, and the handle that moves its run along. */
function stage(options: Staged = {}) {
  const [status, setStatus] = createSignal<ExerciseStatus>('idle')
  const view = render(() => (
    <ExerciseShell
      type={EXERCISE_INTERVAL_TRAINER}
      title="Interval Trainer"
      status={status}
      currentScore={() => options.score ?? 0}
      resultScore={() =>
        status() === 'complete' ? (options.score ?? null) : null
      }
      idlePlaceholder={options.brief}
      activePhase={options.instruction}
      demo={options.demo}
      onBack={() => {}}
      onStart={() => {}}
      activeContent={<div>the drill's own visual</div>}
      onStop={() => {}}
      resultSummary={<>Rounds: 6</>}
      onTryAgain={() => {}}
      onChangeTarget={() => {}}
    />
  ))
  const one = (selector: string): HTMLElement => {
    const el = view.container.querySelector<HTMLElement>(selector)
    if (el === null) throw new Error(`nothing matches ${selector}`)
    return el
  }
  return {
    ...view,
    setStatus,
    root: () => one('.exercise-runner'),
    coach: () => one('[data-testid="exercise-stage-coach"]'),
    merc: () => one('[data-testid="exercise-stage-merc"]'),
    sheet: () => one('.exercise-canvas-area'),
  }
}

const BRIEF = (
  <div class="exercise-idle-placeholder">
    <p>Hear two notes, then sing them back.</p>
    <span class="idle-hint">6 rounds · Major 2nd through Octave</span>
  </div>
)

describe('the drill stage', () => {
  afterEach(cleanup)

  it('is the dark stage at its root and says which state the run is in', async () => {
    const drill = stage({ brief: BRIEF })
    expect(drill.root().classList.contains('mp-dark-stage')).toBe(true)
    expect(drill.root().getAttribute('data-run')).toBe('idle')

    drill.setStatus('active')
    await tick()
    expect(drill.root().getAttribute('data-run')).toBe('active')
  })

  it("puts the drill's brief in Merc's bubble, not in the sheet", () => {
    const drill = stage({ brief: BRIEF })
    expect(drill.coach().querySelector('.idle-hint')?.textContent).toBe(
      '6 rounds · Major 2nd through Octave',
    )
    expect(drill.coach().textContent).toContain(
      'Hear two notes, then sing them back.',
    )
    expect(drill.sheet().querySelector('.exercise-idle-placeholder')).toBeNull()
  })

  it('has him read the help summary for a drill that wrote no brief', () => {
    const drill = stage()
    expect(drill.coach().textContent).toContain(
      EXERCISE_HELP[EXERCISE_INTERVAL_TRAINER].summary,
    )
  })

  it("swaps the brief for the run's instruction while the run lasts", async () => {
    const drill = stage({
      brief: BRIEF,
      instruction: <span>Sing note 1 of 2</span>,
    })
    drill.setStatus('active')
    await tick()

    const phase = drill.coach().querySelector('.exercise-active-phase')
    expect(phase?.textContent).toBe('Sing note 1 of 2')
    expect(drill.coach().querySelector('.idle-hint')).toBeNull()
    // The instruction used to head the sheet. It is said once.
    expect(drill.sheet().querySelector('.exercise-active-phase')).toBeNull()

    drill.setStatus('complete')
    await tick()
    expect(drill.coach().querySelector('.exercise-active-phase')).toBeNull()
    expect(drill.coach().querySelector('.idle-hint')).not.toBeNull()
  })

  it('keeps the brief through the run of a drill that gives no instruction', async () => {
    const drill = stage({ brief: BRIEF })
    drill.setStatus('active')
    await tick()
    expect(drill.coach().querySelector('.idle-hint')).not.toBeNull()
  })

  it('keeps one Merc from the setup through the run to the result', async () => {
    const drill = stage({ brief: BRIEF, score: 90 })
    const merc = drill.merc()

    drill.setStatus('active')
    await tick()
    expect(drill.merc()).toBe(merc)

    drill.setStatus('complete')
    await tick()
    expect(drill.merc()).toBe(merc)
  })

  it('has him listen to a run and cheer a good one', async () => {
    const drill = stage({ brief: BRIEF, score: 90 })
    const still = () => drill.merc().querySelector('img')?.getAttribute('src')
    expect(still()).toBe('/onboarding/coach/merc-point.webp')

    drill.setStatus('active')
    await tick()
    expect(still()).toBe('/onboarding/coach/merc-listen.webp')

    drill.setStatus('complete')
    await tick()
    expect(still()).toBe('/onboarding/coach/merc-celebrate.webp')
  })

  it('does not have him cheer a middling run', async () => {
    const drill = stage({ brief: BRIEF, score: 60 })
    drill.setStatus('active')
    await tick()
    drill.setStatus('complete')
    await tick()
    expect(drill.merc().querySelector('img')?.getAttribute('src')).toBe(
      '/onboarding/coach/merc-point.webp',
    )
  })

  it('puts a microphone on the idle button and keeps its name', () => {
    const drill = stage({ brief: BRIEF })
    const start = drill.getByRole('button', { name: 'Start' })
    expect(start.classList.contains('exercise-idle-start')).toBe(true)
    // The glyph is decoration: the button is still named by its word alone.
    const glyph = start.querySelector('svg')
    expect(glyph).not.toBeNull()
    expect(glyph?.closest('[aria-hidden="true"]')).not.toBeNull()
  })
})

describe('Hear it first', () => {
  afterEach(() => {
    vi.useRealTimers()
    cleanup()
  })

  /** An example that sounds until the test says it has finished. */
  function example() {
    let finish: () => void = () => {}
    const calls = { play: 0, stop: 0 }
    const demo: ExerciseDemo = {
      play: () => {
        calls.play += 1
        return new Promise<void>((resolve) => {
          finish = resolve
        })
      },
      stop: () => {
        calls.stop += 1
        finish()
      },
      line: () => 'Listen: E3, then B3.',
    }
    return { demo, calls, finish: () => finish() }
  }

  /** The example's line in the bubble, and the brief it lies over. */
  const line = (drill: ReturnType<typeof stage>) =>
    drill.coach().querySelector('.exercise-stage-demo-line')?.textContent
  const briefHidden = (drill: ReturnType<typeof stage>) =>
    drill
      .coach()
      .querySelector('.idle-hint')
      ?.closest('[aria-hidden="true"]') != null

  it('is not offered by a drill that has no example', () => {
    const drill = stage({ brief: BRIEF })
    expect(drill.queryByRole('button', { name: 'Hear it first' })).toBeNull()
  })

  it("plays the drill's example and lays what it is over the brief", async () => {
    vi.useFakeTimers()
    const { demo, calls, finish } = example()
    const drill = stage({ brief: BRIEF, demo })
    const button = drill.getByRole('button', { name: 'Hear it first' })
    expect(briefHidden(drill)).toBe(false)

    fireEvent.click(button)
    expect(calls.play).toBe(1)
    expect(line(drill)).toBe('Listen: E3, then B3.')
    // The brief keeps its place under the line, so the bubble keeps its
    // size and the sheet stays put; it is neither seen nor read.
    expect(drill.coach().querySelector('.idle-hint')).not.toBeNull()
    expect(briefHidden(drill)).toBe(true)
    expect(button.textContent).toBe('Listen…')
    expect(button.hasAttribute('disabled')).toBe(true)

    // A long example takes its line with it the moment it ends.
    await vi.advanceTimersByTimeAsync(DEMO_LINE_MIN_MS + 500)
    finish()
    await vi.advanceTimersByTimeAsync(0)
    expect(line(drill)).toBeUndefined()
    expect(briefHidden(drill)).toBe(false)
    expect(button.textContent).toBe('Hear it first')
    expect(button.hasAttribute('disabled')).toBe(false)
  })

  it('keeps the line of a short example up long enough to read', async () => {
    vi.useFakeTimers()
    const { demo, finish } = example()
    const drill = stage({ brief: BRIEF, demo })
    const button = drill.getByRole('button', { name: 'Hear it first' })

    fireEvent.click(button)
    await vi.advanceTimersByTimeAsync(600)
    finish()
    await vi.advanceTimersByTimeAsync(0)
    // The sound is over, so the example can be asked for again, and Merc
    // stops singing; the line stays for the rest of its two seconds.
    expect(button.hasAttribute('disabled')).toBe(false)
    expect(line(drill)).toBe('Listen: E3, then B3.')
    expect(briefHidden(drill)).toBe(true)

    await vi.advanceTimersByTimeAsync(DEMO_LINE_MIN_MS - 600 - 1)
    expect(line(drill)).toBe('Listen: E3, then B3.')
    await vi.advanceTimersByTimeAsync(1)
    expect(line(drill)).toBeUndefined()
    expect(briefHidden(drill)).toBe(false)
  })

  it('played again while its line lingers, keeps the line for the new play', async () => {
    vi.useFakeTimers()
    const { demo, calls, finish } = example()
    const drill = stage({ brief: BRIEF, demo })
    const button = drill.getByRole('button', { name: 'Hear it first' })

    fireEvent.click(button)
    await vi.advanceTimersByTimeAsync(500)
    finish()
    await vi.advanceTimersByTimeAsync(0)
    fireEvent.click(button)
    expect(calls.play).toBe(2)

    // The first play's two seconds run out while the second still sounds.
    await vi.advanceTimersByTimeAsync(DEMO_LINE_MIN_MS)
    expect(line(drill)).toBe('Listen: E3, then B3.')
  })

  it('gives way to the run the moment it starts', async () => {
    const { demo, calls } = example()
    const drill = stage({
      brief: BRIEF,
      instruction: <span>Sing note 1 of 2</span>,
      demo,
    })
    fireEvent.click(drill.getByRole('button', { name: 'Hear it first' }))

    drill.setStatus('active')
    await tick()
    expect(calls.stop).toBe(1)
    expect(line(drill)).toBeUndefined()
    expect(
      drill.coach().querySelector('.exercise-active-phase')?.textContent,
    ).toBe('Sing note 1 of 2')
  })

  it('gives way to a run though only its line was still up', async () => {
    vi.useFakeTimers()
    const { demo, calls, finish } = example()
    const drill = stage({
      brief: BRIEF,
      instruction: <span>Sing note 1 of 2</span>,
      demo,
    })
    fireEvent.click(drill.getByRole('button', { name: 'Hear it first' }))
    await vi.advanceTimersByTimeAsync(300)
    finish()
    await vi.advanceTimersByTimeAsync(0)

    drill.setStatus('active')
    await vi.advanceTimersByTimeAsync(0)
    // Nothing was sounding, so there is nothing to stop; the line goes.
    expect(calls.stop).toBe(0)
    expect(line(drill)).toBeUndefined()
    expect(briefHidden(drill)).toBe(false)
  })

  it('is cut short when the drill is left', () => {
    const { demo, calls } = example()
    const drill = stage({ brief: BRIEF, demo })
    fireEvent.click(drill.getByRole('button', { name: 'Hear it first' }))
    drill.unmount()
    expect(calls.stop).toBe(1)
  })
})
