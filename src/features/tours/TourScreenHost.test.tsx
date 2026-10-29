// @vitest-environment jsdom
// ============================================================
// TourScreenHost — the question before a tour closes a drill
// ============================================================
//
// What a door asks before a tour closes what is open over its page, in the
// words the singer reads, what each answer does, and the stage that ends a
// tour it covers. The ask itself is tour-screen.test.ts's.

import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setCoachActive } from '@/lib/coach-state'
import { answerTourAsk, provideTourDetour, startWhenClear, } from '@/lib/tour-screen'

const stores = vi.hoisted(() => ({
  endWalkthrough: vi.fn(),
  endCoachTour: vi.fn(),
}))
vi.mock('@/stores', async () => {
  const { createSignal } = await import('solid-js')
  const [focusMode, setFocusMode] = createSignal(false)
  const [zen, setZen] = createSignal<object | null>(null)
  const [challenge, setChallenge] = createSignal<object | null>(null)
  const [walkthroughActive, setWalkthroughActive] = createSignal(false)
  return {
    focusMode,
    setFocusMode,
    singingZenLaunch: zen,
    setSingingZenLaunch: setZen,
    challengeStageLaunch: challenge,
    setChallengeStageLaunch: setChallenge,
    walkthroughActive,
    setWalkthroughActive,
    endWalkthrough: () => {
      stores.endWalkthrough()
      setWalkthroughActive(false)
    },
  }
})
vi.mock('@/components/coach/start', () => ({
  endCoachTour: () => stores.endCoachTour(),
}))

import * as storeModule from '@/stores'
import { listNames, tourAskWords, TourScreenHost } from './TourScreenHost'

// The mock's own setters, beside the signals the host reads.
const mocked = storeModule as unknown as {
  setSingingZenLaunch: (v: object | null) => void
  setWalkthroughActive: (v: boolean) => void
}

const removers: (() => void)[] = []

/** Long Note open over the Exercises list, until a tour closes it. */
function longNoteOpen(): { open: boolean } {
  const drill = { open: true }
  removers.push(
    provideTourDetour((tab) =>
      tab === 'exercises' && drill.open
        ? { name: 'Long Note', close: () => (drill.open = false) }
        : null,
    ),
  )
  return drill
}

beforeEach(() => {
  stores.endWalkthrough.mockClear()
  stores.endCoachTour.mockClear()
})

afterEach(() => {
  answerTourAsk(false)
  for (const remove of removers.splice(0)) remove()
  mocked.setSingingZenLaunch(null)
  mocked.setWalkthroughActive(false)
  setCoachActive(null)
  cleanup()
})

describe('the words', () => {
  it('names what closes and the tour it makes way for', () => {
    expect(tourAskWords(['Long Note'], 'the Exercises tour')).toEqual({
      title: 'Leave Long Note for the Exercises tour?',
      message:
        'Long Note closes so the tour can show the page under it. Anything still running there stops.',
    })
  })

  it('reads as a list, and as a sentence, whatever closes', () => {
    expect(listNames(['Zen'])).toBe('Zen')
    expect(listNames(['Zen', 'Long Note'])).toBe('Zen and Long Note')
    expect(listNames(['Zen', 'Long Note', 'Hairline'])).toBe(
      'Zen, Long Note and Hairline',
    )
    expect(tourAskWords(['Zen', 'Long Note'], 'the tour').message).toMatch(
      /^Zen and Long Note close so the tour can show the page under them\./,
    )
    expect(tourAskWords(['the challenge'], 'the tour').message).toMatch(
      /^The challenge closes/,
    )
  })
})

describe('the question', () => {
  it('asks before a tour closes a drill, and Take the tour closes it and starts', async () => {
    const drill = longNoteOpen()
    const start = vi.fn()
    render(() => <TourScreenHost />)

    startWhenClear(['exercises'], 'the Exercises tour', start)

    expect(
      await screen.findByText('Leave Long Note for the Exercises tour?'),
    ).toBeInTheDocument()
    expect(start).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: /Take the tour/ }))

    expect(drill.open).toBe(false)
    expect(start).toHaveBeenCalledOnce()
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })

  it('leaves the drill open and starts nothing on Not now', async () => {
    const drill = longNoteOpen()
    const start = vi.fn()
    render(() => <TourScreenHost />)

    startWhenClear(['exercises'], 'the Exercises tour', start)
    fireEvent.click(await screen.findByRole('button', { name: 'Not now' }))

    expect(drill.open).toBe(true)
    expect(start).not.toHaveBeenCalled()
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })

  it('asks nothing when nothing is open', () => {
    const start = vi.fn()
    render(() => <TourScreenHost />)

    startWhenClear(['exercises'], 'the Exercises tour', start)

    expect(start).toHaveBeenCalledOnce()
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })
})

describe('a stage over the tour', () => {
  it('ends the spotlight tour and the Merc tour that Zen covers', async () => {
    render(() => <TourScreenHost />)
    mocked.setWalkthroughActive(true)
    setCoachActive('sing')

    mocked.setSingingZenLaunch({ launchId: 1 })

    expect(stores.endWalkthrough).toHaveBeenCalledOnce()
    await vi.waitFor(() => expect(stores.endCoachTour).toHaveBeenCalledOnce())
  })

  it('ends nothing when no tour is running', async () => {
    render(() => <TourScreenHost />)

    mocked.setSingingZenLaunch({ launchId: 1 })
    await Promise.resolve()

    expect(stores.endWalkthrough).not.toHaveBeenCalled()
    expect(stores.endCoachTour).not.toHaveBeenCalled()
  })
})
