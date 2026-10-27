// A step that runs something while it shows (Merc singing through the Sing
// tab), and a tour that offers another beside Done, as the coach layer
// draws them: the run starts as its step shows and stops however the step
// goes, Merc takes its pose and says its line, a wide screen's bubble keeps
// its corner with the ring up, and "Show me more" stands on the last stop.

import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import { createSignal } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CoachStep, CoachStepRun, CoachTour } from '@/lib/coach-types'
import type { MercState } from '@/lib/merc/constants'
import type * as GpuGateModule from '@/lib/merc/gpu-gate'
import { CoachLayer } from './CoachLayer'
import { createCoachRunner } from './runner'

vi.mock('@/lib/demo-audio', () => ({
  playHoldTone: vi.fn(() => ({ stop: vi.fn() })),
}))
// jsdom has no WebGL: Merc is his still.
vi.mock('@/lib/merc/gpu-gate', async (importOriginal) => ({
  ...(await importOriginal<typeof GpuGateModule>()),
  canRunLiveMerc: (): boolean => false,
}))

/** A run whose pose and line the test sets, counting its stops. */
function fakeRun(): {
  run: CoachStepRun
  setPose: (pose: MercState | null) => void
  setSaid: (line: string) => void
  stop: ReturnType<typeof vi.fn>
} {
  const [pose, setPose] = createSignal<MercState | null>('sing')
  const [said, setSaid] = createSignal('Round 1 of 2.')
  const stop = vi.fn()
  return { run: { pose, said, stop }, setPose, setSaid, stop }
}

let runs: ReturnType<typeof fakeRun>[]

const step = (id: string, extra: Partial<CoachStep> = {}): CoachStep =>
  ({
    id,
    kind: 'show',
    title: `The ${id}`,
    body: `About the ${id}.`,
    merc: 'point',
    ...extra,
  }) as CoachStep

/** Two stops that each run something, between two that do not. */
function demoTour(): CoachTour {
  const running = (): CoachStepRun => {
    const made = fakeRun()
    runs.push(made)
    return made.run
  }
  return {
    key: 'sing-more',
    steps: [
      step('intro'),
      step('repeat', {
        run: running,
        target: '[data-tour="coach-test.repeat"]',
        keepCorner: true,
        corner: 'top-right',
      }),
      step('rests', { run: running }),
      step('end'),
    ],
  }
}

/** A control on the page, laid out where jsdom lays nothing out. */
function addTarget(): HTMLElement {
  const el = document.createElement('button')
  el.setAttribute('data-tour', 'coach-test.repeat')
  const rect = { top: 120, left: 400, width: 40, height: 32 }
  el.getBoundingClientRect = () =>
    ({
      ...rect,
      x: rect.left,
      y: rect.top,
      right: rect.left + rect.width,
      bottom: rect.top + rect.height,
      toJSON: () => rect,
    }) as DOMRect
  document.body.append(el)
  return el
}

function mount(
  opts: {
    tour?: CoachTour
    phone?: boolean
    more?: { label: string; go: () => void }
  } = {},
) {
  const runner = createCoachRunner(opts.tour ?? demoTour(), {
    track: vi.fn(),
    on: () => () => undefined,
    phone: opts.phone,
  })
  render(() => (
    <CoachLayer
      runner={runner}
      phone={opts.phone === true}
      onClose={vi.fn()}
      more={opts.more}
    />
  ))
  return runner
}

const bubble = (): HTMLElement => screen.getByTestId('coach-bubble')
const press = (name: string): void => {
  fireEvent.click(screen.getByRole('button', { name }))
}

beforeEach(() => {
  runs = []
  Object.defineProperty(window, 'innerHeight', {
    value: 900,
    configurable: true,
  })
  Object.defineProperty(window, 'innerWidth', {
    value: 1440,
    configurable: true,
  })
})

afterEach(() => {
  cleanup()
  document.body.replaceChildren()
})

describe('a step that runs something', () => {
  it('starts as its step shows and stops as it goes, by Next, Back or End tour', () => {
    const runner = mount()
    expect(runs).toHaveLength(0)

    press('Next')
    expect(runs).toHaveLength(1)
    expect(runs[0]?.stop).not.toHaveBeenCalled()

    press('Next')
    expect(runs[0]?.stop).toHaveBeenCalledOnce()
    expect(runs).toHaveLength(2)

    press('Back')
    expect(runs[1]?.stop).toHaveBeenCalledOnce()
    expect(runs).toHaveLength(3)

    press('End tour')
    expect(runs[2]?.stop).toHaveBeenCalledOnce()
    expect(runner.ended()).toBe('exit')
  })

  it('stops when the tour ends under it', () => {
    const runner = mount()
    press('Next')

    runner.exit()

    expect(runs[0]?.stop).toHaveBeenCalledOnce()
  })

  it("takes the run's pose and reads its line out, and leaves them with it", () => {
    mount()
    press('Next')

    expect(bubble().dataset.pose).toBe('sing')
    const said = screen.getByTestId('coach-said')
    expect(said).toHaveTextContent('Round 1 of 2.')
    expect(said.closest('[aria-live]')?.getAttribute('aria-live')).toBe(
      'polite',
    )

    runs[0]?.setPose(null)
    runs[0]?.setSaid('Press Play to hear Merc again.')
    expect(bubble().dataset.pose).toBe('point')
    expect(screen.getByTestId('coach-said')).toHaveTextContent(
      'Press Play to hear Merc again.',
    )

    runs[0]?.setSaid('')
    expect(screen.queryByTestId('coach-said')).toBeNull()
    press('Next')
    press('Next')
    expect(bubble().dataset.pose).toBe('point')
  })

  it('pulses its ring while it runs', () => {
    addTarget()
    mount()
    press('Next')

    expect(screen.getByTestId('coach-ring')).toHaveAttribute('data-running')
  })

  it("keeps a wide screen's bubble in its corner, ring and all, when the step asks", () => {
    addTarget()
    mount()
    press('Next')

    expect(screen.getByTestId('coach-ring')).toBeInTheDocument()
    expect(bubble().dataset.place).toBe('corner')
    expect(bubble().dataset.corner).toBe('top-right')
  })

  it('docks on a phone, as any ringed step does', () => {
    addTarget()
    mount({ phone: true })
    press('Next')

    expect(screen.getByTestId('coach-ring')).toBeInTheDocument()
    expect(bubble().dataset.place).toMatch(/^dock-/)
  })
})

describe('"Show me more"', () => {
  it('stands beside Done on the last stop only, and goes on when tapped', () => {
    const go = vi.fn()
    mount({ more: { label: 'Show me more', go } })
    for (const _ of [1, 2, 3]) {
      expect(screen.queryByRole('button', { name: 'Show me more' })).toBeNull()
      press('Next')
    }

    expect(screen.getByRole('button', { name: 'Done' })).toBeVisible()
    press('Show me more')

    expect(go).toHaveBeenCalledOnce()
  })

  it('is not offered by a tour that has no more to show', () => {
    mount()
    for (const _ of [1, 2, 3]) press('Next')

    expect(screen.getByRole('button', { name: 'Done' })).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Show me more' })).toBeNull()
  })
})
