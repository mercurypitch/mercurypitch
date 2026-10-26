// The coach layer as a singer meets it: where focus and the keys go, what
// Skip and the ring do, the note it plays only when asked, and the hand-over
// once a tour is done. The runner is the real one, with a fake bus and a
// spied tracker, so these read through to the tour events.

import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import type { Mock } from 'vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CoachEventName } from '@/lib/coach-events'
import type { CoachHandoff, CoachStep, CoachTour } from '@/lib/coach-types'
import type * as GpuGateModule from '@/lib/merc/gpu-gate'
import { CoachLayer, HOLD_TONE_HZ, TRACK_MS } from './CoachLayer'
import type { CoachRunnerDeps } from './runner'
import { CELEBRATE_MS, createCoachRunner } from './runner'

const { playHoldTone } = vi.hoisted(() => ({
  playHoldTone: vi.fn(() => ({ stop: vi.fn() })),
}))
vi.mock('@/lib/demo-audio', () => ({ playHoldTone }))

// jsdom has no WebGL: Merc is his still.
vi.mock('@/lib/merc/gpu-gate', async (importOriginal) => ({
  ...(await importOriginal<typeof GpuGateModule>()),
  canRunLiveMerc: (): boolean => false,
}))

function fakeBus(): {
  on: NonNullable<CoachRunnerDeps['on']>
  send: (name: CoachEventName) => void
} {
  const listeners = new Set<{ name: CoachEventName; fn: () => void }>()
  return {
    on(name, fn) {
      const entry = { name, fn }
      listeners.add(entry)
      return () => {
        listeners.delete(entry)
      }
    },
    send(name) {
      for (const entry of [...listeners]) if (entry.name === name) entry.fn()
    },
  }
}

const STEPS: readonly CoachStep[] = [
  {
    id: 'mic',
    kind: 'show',
    title: 'Tap to start',
    body: 'Tap here and Merc starts listening.',
    target: '[data-tour="coach-test.mic"]',
    merc: 'point',
  },
  {
    id: 'note',
    kind: 'do',
    title: 'Sing any note',
    body: 'Hold one note, any note.',
    merc: 'listen',
    waitFor: 'pitch-detected',
    sound: 'hold-tone',
  },
  {
    id: 'takes',
    kind: 'watch',
    title: 'Your takes land here',
    body: 'Every take you keep lands here.',
    merc: 'idle',
    lesson: { href: '/learn/01', title: 'Lesson 1, What is a note?' },
  },
]
const TOUR: CoachTour = { key: 'sing', steps: STEPS }

let bus: ReturnType<typeof fakeBus>
let track: Mock<NonNullable<CoachRunnerDeps['track']>>
let onClose: Mock<() => void>

beforeEach(() => {
  bus = fakeBus()
  track = vi.fn<NonNullable<CoachRunnerDeps['track']>>()
  onClose = vi.fn<() => void>()
  playHoldTone.mockClear()
  Object.defineProperty(window, 'innerHeight', {
    value: 844,
    configurable: true,
  })
  Object.defineProperty(window, 'innerWidth', {
    value: 1440,
    configurable: true,
  })
  vi.stubGlobal(
    'AudioContext',
    class {
      resume = vi.fn(async () => undefined)
      close = vi.fn(async () => undefined)
    },
  )
})

afterEach(() => {
  cleanup()
  document.body.replaceChildren()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

function mount(
  opts: {
    tour?: CoachTour
    phone?: boolean
    handoff?: () => CoachHandoff | null
  } = {},
) {
  const runner = createCoachRunner(opts.tour ?? TOUR, {
    on: bus.on,
    track,
    phone: opts.phone,
  })
  render(() => (
    <CoachLayer
      runner={runner}
      phone={opts.phone === true}
      handoff={opts.handoff}
      onClose={onClose}
    />
  ))
  return runner
}

const bubble = (): HTMLElement => screen.getByTestId('coach-bubble')
const key = (name: string): void => {
  fireEvent.keyDown(bubble(), { key: name })
}

/** A target on the page, laid out at `rect` (jsdom lays nothing out). */
function addTarget(
  rect: Partial<DOMRect> = { top: 300, left: 200, width: 120, height: 48 },
): HTMLElement {
  const el = document.createElement('button')
  el.setAttribute('data-tour', 'coach-test.mic')
  const full = {
    top: 0,
    left: 0,
    width: 0,
    height: 0,
    ...rect,
  }
  el.getBoundingClientRect = () =>
    ({
      ...full,
      x: full.left,
      y: full.top,
      right: full.left + full.width,
      bottom: full.top + full.height,
      toJSON: () => full,
    }) as DOMRect
  document.body.append(el)
  return el
}

describe('CoachLayer', () => {
  it('moves focus to the bubble and announces it', async () => {
    mount()
    await Promise.resolve()

    expect(document.activeElement).toBe(bubble())
    expect(bubble()).toHaveAccessibleName('Tap to start')
    const live = screen.getByText('Tap to start').closest('[aria-live]')
    expect(live?.getAttribute('aria-live')).toBe('polite')
    expect(live).toHaveTextContent('Tap here and Merc starts listening.')
    expect(screen.getByText('1 of 3')).toBeInTheDocument()
  })

  it('ends the tour on Escape', () => {
    const runner = mount()
    key('Escape')

    expect(runner.ended()).toBe('exit')
    expect(track).toHaveBeenLastCalledWith('tour_exit', 'sing', {
      step: 1,
      of: 3,
    })
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('ends the tour from its close button', () => {
    const runner = mount()
    fireEvent.click(screen.getByRole('button', { name: 'End tour' }))

    expect(runner.ended()).toBe('exit')
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('steps with Enter and the arrows', () => {
    const runner = mount()
    key('Enter')
    expect(runner.snapshot()?.step.id).toBe('note')
    key('ArrowLeft')
    expect(runner.snapshot()?.step.id).toBe('mic')
    key('ArrowRight')
    expect(runner.snapshot()?.step.id).toBe('note')
    // A do step waits for the singer: the keys do not rush it.
    key('ArrowRight')
    key('Enter')
    expect(runner.snapshot()?.step.id).toBe('note')
  })

  it('keeps its keys from the app on the window', () => {
    mount()
    const heard = vi.fn()
    window.addEventListener('keydown', heard)
    key(' ')
    key('m')
    key('Escape')
    window.removeEventListener('keydown', heard)

    expect(heard).not.toHaveBeenCalled()
  })

  it('leaves Enter on a button to the button', () => {
    const runner = mount()
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    fireEvent.click(screen.getByRole('button', { name: 'Skip this step' }))
    expect(runner.snapshot()?.step.id).toBe('takes')
    fireEvent.keyDown(screen.getByRole('button', { name: 'Back' }), {
      key: 'Enter',
    })

    // Enter on Back is Back's own press, which the browser turns into a
    // click; the bubble does not also move on (past the last step, here).
    expect(runner.snapshot()?.step.id).toBe('takes')
    expect(runner.ended()).toBeNull()
  })

  it('lets Skip move on when no note can come', () => {
    const runner = mount()
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    fireEvent.click(screen.getByRole('button', { name: 'Skip this step' }))

    expect(runner.snapshot()?.step.id).toBe('takes')
  })

  it('celebrates the note, then moves on by itself', () => {
    vi.useFakeTimers()
    const runner = mount()
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    bus.send('pitch-detected')

    expect(screen.getByRole('button', { name: 'Next' })).toBeVisible()
    vi.advanceTimersByTime(CELEBRATE_MS)
    expect(runner.snapshot()?.step.id).toBe('takes')
  })

  it('offers Next, not Skip, when Back returns to a step the singer did', () => {
    vi.useFakeTimers()
    const runner = mount()
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    bus.send('pitch-detected')
    vi.advanceTimersByTime(CELEBRATE_MS)
    fireEvent.click(screen.getByRole('button', { name: 'Back' }))

    expect(runner.snapshot()?.step.id).toBe('note')
    expect(screen.queryByRole('button', { name: 'Skip this step' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    expect(runner.snapshot()?.step.id).toBe('takes')
  })

  it('rings the target and stands the bubble beside it', () => {
    addTarget({ top: 300, left: 200, width: 120, height: 48 })
    mount()
    const ring = screen.getByTestId('coach-ring')

    expect(ring.style.top).toBe('300px')
    expect(ring.style.left).toBe('200px')
    expect(ring.style.width).toBe('120px')
    expect(ring.style.height).toBe('48px')
    expect(bubble().dataset.place).toBe('near')
    // Below the target: its foot plus the gap.
    expect(bubble().style.top).toBe('360px')
  })

  it('drops the spotlight for a target taller than most of the screen', () => {
    addTarget({ top: 0, left: 0, width: 390, height: 2000 })
    mount()

    expect(screen.queryByTestId('coach-ring')).toBeNull()
    expect(bubble().dataset.place).toBe('centre')
  })

  it('centres the bubble when the target is missing, and rings it once it comes', () => {
    vi.useFakeTimers()
    mount()
    expect(screen.queryByTestId('coach-ring')).toBeNull()
    expect(bubble().dataset.place).toBe('centre')

    addTarget()
    vi.advanceTimersByTime(TRACK_MS)

    expect(screen.getByTestId('coach-ring').style.top).toBe('300px')
    expect(bubble().dataset.place).toBe('near')
  })

  it('does not ring a target under a page made inert', () => {
    const target = addTarget()
    const page = document.createElement('div')
    page.setAttribute('inert', '')
    page.append(target)
    document.body.append(page)
    mount()

    expect(screen.queryByTestId('coach-ring')).toBeNull()
  })

  it('stands aside for a do step with nothing to ring', () => {
    mount()
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    expect(bubble().dataset.place).toBe('corner')
    cleanup()

    mount({ phone: true })
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    expect(bubble().dataset.place).toBe('dock-top')
  })

  it('docks above the tab bar on a phone, and at the top when it would cover the target', () => {
    mount({ phone: true })
    expect(bubble().dataset.place).toBe('dock-bottom')
    cleanup()

    addTarget({ top: 780, left: 20, width: 60, height: 44 })
    mount({ phone: true })
    expect(bubble().dataset.place).toBe('dock-top')
  })

  it('plays the note when asked, and only then', () => {
    mount()
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    expect(playHoldTone).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Play the note' }))

    expect(playHoldTone).toHaveBeenCalledOnce()
    expect(playHoldTone).toHaveBeenCalledWith(expect.anything(), HOLD_TONE_HZ)
  })

  it('opens the lesson of a watch step in a new tab', () => {
    mount()
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    fireEvent.click(screen.getByRole('button', { name: 'Skip this step' }))
    const link = screen.getByRole('link', { name: 'Lesson 1, What is a note?' })

    expect(link.getAttribute('href')).toBe('/learn/01')
    expect(link.getAttribute('target')).toBe('_blank')
    expect(screen.getByRole('button', { name: 'Done' })).toBeVisible()
  })

  it('shows a step’s aside under its body', () => {
    mount({
      tour: {
        key: 'karaoke-night',
        steps: [
          {
            id: 'own',
            kind: 'show',
            title: 'Bring your own song',
            body: 'Add any song.',
            merc: 'point',
            aside: () => ({
              title: '5 free songs',
              sub: 'with a free account',
            }),
          },
        ],
      },
    })

    expect(screen.getByTestId('coach-aside')).toHaveTextContent(
      '5 free songs with a free account',
    )
  })

  it('says how to let Merc hear once the mic fails, and keeps Skip and End tour', () => {
    mount({
      tour: {
        key: 'sing',
        steps: [
          {
            id: 'mic',
            kind: 'do',
            title: 'Start the mic',
            body: 'Tap the mic and Merc starts listening.',
            merc: 'point',
            waitFor: 'mic-on',
            failure: {
              event: 'mic-failed',
              aside: { title: 'No mic yet.', sub: 'Allow it, then tap again.' },
            },
          },
        ],
      },
    })
    expect(screen.queryByTestId('coach-failure')).toBeNull()

    bus.send('mic-failed')

    const line = screen.getByTestId('coach-failure')
    expect(line).toHaveTextContent('No mic yet. Allow it, then tap again.')
    // Read out as it comes, with the step's own words.
    expect(line.closest('[aria-live]')?.getAttribute('aria-live')).toBe(
      'polite',
    )
    expect(screen.getByRole('button', { name: 'Skip this step' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'End tour' })).toBeVisible()
  })

  it('offers Next on a do step that is already done as it shows', () => {
    const runner = mount({
      tour: {
        key: 'sing',
        steps: [
          {
            id: 'mic',
            kind: 'do',
            title: 'Start the mic',
            body: 'Tap the mic and Merc starts listening.',
            merc: 'point',
            waitFor: 'mic-on',
            doneAlready: () => true,
          },
          STEPS[2] as CoachStep,
        ],
      },
    })

    expect(screen.queryByRole('button', { name: 'Skip this step' })).toBeNull()
    key('Enter')
    expect(runner.snapshot()?.step.id).toBe('takes')
  })

  it('offers the next stop on the plan when the tour ends', () => {
    const go = vi.fn()
    mount({
      handoff: () => ({
        title: 'Next on your plan',
        body: 'Karaoke: Sing one song',
        go,
      }),
    })
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    fireEvent.click(screen.getByRole('button', { name: 'Skip this step' }))
    fireEvent.click(screen.getByRole('button', { name: 'Done' }))

    expect(track).toHaveBeenLastCalledWith('tour_done', 'sing', {
      step: 3,
      of: 3,
    })
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByText('Next on your plan')).toBeVisible()
    expect(screen.getByText('Karaoke: Sing one song')).toBeVisible()

    fireEvent.click(screen.getByRole('button', { name: 'Go' }))
    expect(onClose).toHaveBeenCalledOnce()
    expect(go).toHaveBeenCalledOnce()
  })

  it('closes on Later without going anywhere', () => {
    const go = vi.fn()
    mount({ handoff: () => ({ title: 'Next', body: 'Jam', go }) })
    key('Enter')
    fireEvent.click(screen.getByRole('button', { name: 'Skip this step' }))
    fireEvent.click(screen.getByRole('button', { name: 'Done' }))
    fireEvent.click(screen.getByRole('button', { name: 'Later' }))

    expect(onClose).toHaveBeenCalledOnce()
    expect(go).not.toHaveBeenCalled()
  })

  it('closes at the end when there is nothing to hand over to', () => {
    mount({ handoff: () => null })
    key('Enter')
    fireEvent.click(screen.getByRole('button', { name: 'Skip this step' }))
    fireEvent.click(screen.getByRole('button', { name: 'Done' }))

    expect(onClose).toHaveBeenCalledOnce()
  })
})
