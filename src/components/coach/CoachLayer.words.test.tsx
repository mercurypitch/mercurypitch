// Words taller than the bubble, as the coach layer handles them: they scroll
// in a box of their own above the buttons, the bubble says when some are
// below that box's foot, each step starts them at the top, the keys that
// scroll a box scroll them from the bubble, and the box takes no focus of
// its own. jsdom lays nothing out, so each test lays the box out itself;
// the CSS that keeps the buttons in view is the browser's to prove
// (src/e2e/sing-show-more.spec.ts, at 320x568).

import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CoachHandoff, CoachStep, CoachTour } from '@/lib/coach-types'
import type * as GpuGateModule from '@/lib/merc/gpu-gate'
import { CoachLayer, TRACK_MS } from './CoachLayer'
import { createCoachRunner } from './runner'

vi.mock('@/lib/demo-audio', () => ({
  playHoldTone: vi.fn(() => ({ stop: vi.fn() })),
}))
// jsdom has no WebGL: Merc is his still.
vi.mock('@/lib/merc/gpu-gate', async (importOriginal) => ({
  ...(await importOriginal<typeof GpuGateModule>()),
  canRunLiveMerc: (): boolean => false,
}))

const step = (id: string): CoachStep => ({
  id,
  kind: 'show',
  title: `The ${id}`,
  body: `About the ${id}.`,
  merc: 'point',
})

const TOUR: CoachTour = {
  key: 'sing',
  steps: [step('first'), step('second'), step('last')],
}

/** One stop that offers the note, as the Sing tour's second does. */
const NOTE_TOUR: CoachTour = {
  key: 'sing',
  steps: [
    {
      id: 'note',
      kind: 'do',
      title: 'Sing any note',
      body: 'Hold one note, any note.',
      merc: 'listen',
      waitFor: 'pitch-detected',
      sound: 'hold-tone',
    },
  ],
}

function mount(
  opts: { tour?: CoachTour; handoff?: () => CoachHandoff | null } = {},
) {
  const runner = createCoachRunner(opts.tour ?? TOUR, {
    track: vi.fn(),
    on: () => () => undefined,
  })
  render(() => (
    <CoachLayer
      runner={runner}
      phone
      handoff={opts.handoff}
      onClose={vi.fn()}
    />
  ))
  return runner
}

const bubble = (): HTMLElement => screen.getByTestId('coach-bubble')

/** The box the words scroll in: a step's live region's parent, or the hand-over's live region. */
const wordsBox = (): HTMLElement => {
  const live = screen.getByRole('heading').closest('[aria-live]')
  const box = live?.matches('[tabindex]') === true ? live : live?.parentElement
  if (!(box instanceof HTMLElement)) throw new Error('no words box')
  return box
}

/** Lays the box out: `words` px of them in `room` px, scrolled to `top`. */
function layOut(el: HTMLElement, words: number, room: number, top = 0): void {
  Object.defineProperty(el, 'scrollHeight', {
    value: words,
    configurable: true,
  })
  Object.defineProperty(el, 'clientHeight', { value: room, configurable: true })
  el.scrollTop = top
}

beforeEach(() => {
  Object.defineProperty(window, 'innerHeight', {
    value: 568,
    configurable: true,
  })
  Object.defineProperty(window, 'innerWidth', {
    value: 320,
    configurable: true,
  })
})

afterEach(() => {
  cleanup()
  document.body.replaceChildren()
  vi.useRealTimers()
})

describe('CoachLayer words that do not fit', () => {
  it('marks the bubble while some words are below the foot of their box', () => {
    mount()
    const box = wordsBox()
    layOut(box, 230, 182)

    fireEvent.scroll(box)

    expect(bubble()).toHaveAttribute('data-more')
  })

  it('clears the mark once they are scrolled to the foot, past its padding', () => {
    mount()
    const box = wordsBox()
    layOut(box, 230, 182)
    fireEvent.scroll(box)
    // 48 px further would be the very end; the last 4 px are padding
    box.scrollTop = 44

    fireEvent.scroll(box)

    expect(bubble()).not.toHaveAttribute('data-more')
  })

  it('marks words that grow past their box while the step shows', () => {
    vi.useFakeTimers()
    mount()
    layOut(wordsBox(), 302, 182)

    vi.advanceTimersByTime(TRACK_MS)

    expect(bubble()).toHaveAttribute('data-more')
  })

  it('marks the words at once when a line the step adds takes them past their box', async () => {
    mount({ tour: NOTE_TOUR })
    layOut(wordsBox(), 230, 182)

    // jsdom has no AudioContext: the note cannot play, and the line on how
    // to hear it comes at once.
    fireEvent.click(screen.getByRole('button', { name: 'Play the note' }))
    await Promise.resolve()

    expect(screen.getByTestId('coach-tone-line')).toBeVisible()
    expect(bubble()).toHaveAttribute('data-more')
  })

  it('leaves words that fit unmarked', () => {
    vi.useFakeTimers()
    mount()
    layOut(wordsBox(), 144, 144)

    vi.advanceTimersByTime(TRACK_MS)

    expect(bubble()).not.toHaveAttribute('data-more')
  })

  it("starts the next step's words at the top, where the last were scrolled", () => {
    mount()
    const box = wordsBox()
    layOut(box, 230, 182, 40)

    fireEvent.click(screen.getByRole('button', { name: 'Next' }))

    expect(screen.getByRole('heading')).toHaveTextContent('The second')
    expect(wordsBox()).toBe(box)
    expect(box.scrollTop).toBe(0)
  })

  it.each([
    { key: 'ArrowDown', shift: false, from: 0, to: 40 },
    { key: 'ArrowUp', shift: false, from: 60, to: 20 },
    { key: 'PageDown', shift: false, from: 0, to: 112 },
    { key: 'PageUp', shift: false, from: 112, to: 0 },
    { key: ' ', shift: false, from: 0, to: 112 },
    { key: ' ', shift: true, from: 120, to: 8 },
    { key: 'End', shift: false, from: 0, to: 172 },
    { key: 'Home', shift: false, from: 172, to: 0 },
    { key: 'ArrowDown', shift: false, from: 160, to: 172 },
  ])(
    'scrolls the words from the bubble on $key (shift $shift), $from to $to',
    ({ key, shift, from, to }) => {
      mount()
      const box = wordsBox()
      layOut(box, 300, 128, from)

      const unhandled = fireEvent.keyDown(bubble(), { key, shiftKey: shift })

      expect(unhandled).toBe(false)
      expect(box.scrollTop).toBe(to)
    },
  )

  it('leaves the keys that scroll to the browser when the words fit', () => {
    mount()
    layOut(wordsBox(), 144, 144)

    const unhandled = fireEvent.keyDown(bubble(), { key: 'ArrowDown' })

    expect(unhandled).toBe(true)
  })

  it('still steps on with the right arrow while the words scroll', () => {
    mount()
    layOut(wordsBox(), 300, 128)

    fireEvent.keyDown(bubble(), { key: 'ArrowRight' })

    expect(screen.getByRole('heading')).toHaveTextContent('The second')
  })

  it('keeps the words out of the Tab order and gives a press on them to the bubble', () => {
    mount()
    const box = wordsBox()
    expect(box.tabIndex).toBe(-1)

    box.focus()

    expect(document.activeElement).toBe(bubble())
  })

  it("marks the hand-over's words when they do not fit", async () => {
    mount({
      handoff: () => ({
        title: 'Next on your plan',
        body: 'Karaoke: Sing one song',
        go: vi.fn(),
      }),
    })
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))

    fireEvent.click(screen.getByRole('button', { name: 'Done' }))
    layOut(wordsBox(), 230, 182)
    await Promise.resolve()

    expect(screen.getByRole('heading')).toHaveTextContent('Next on your plan')
    expect(bubble()).toHaveAttribute('data-more')
  })
})
