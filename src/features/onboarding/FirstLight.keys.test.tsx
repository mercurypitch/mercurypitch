// ============================================================
// First Light keeps its keys (ruling R67)
// ============================================================
//
// First Light is a modal over the live app, and the app's shortcuts listen on
// `window` (useKeyboardShortcuts). Unfenced, a Space on one of the flow's
// buttons would play or pause the tab behind it and swallow the press that
// should activate the button, M would toggle the microphone, and Escape would
// stop playback. The flow's focus trap stops every keydown at the overlay
// (isolateKeyboard) to keep them in. A stopped keydown never reaches the
// document either, where Solid listens for its delegated handlers, so the one
// key handler the flow has (the Map's "Take the tour" link) is bound natively.
//
// What is pinned here: that no key from a control on any beat reaches the
// window; that Tab still cycles inside the trap; that the tour link answers
// Enter and Space inside the trap, and a typed line still answers Enter; and
// that a delegated key handler cannot come back unseen (that guard, which reads
// everything each isolating host imports, First Light and the plan layer among
// them, is in src/tests/trap-key-handlers.test.ts). The questions and the plan as the
// app's layer have their own copy of the first half in PlanLayer.test.tsx.

import { cleanup, fireEvent, render, screen, waitFor, within, } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// The flow's edges are faked once, in FirstLight.fixture.tsx: the mic, the
// canvases (none of them takes a key), the funnel, the promo and gift stores,
// the GPU gate and the page tours.
vi.mock('@/lib/jam/media-errors', async () =>
  (await import('./FirstLight.fixture')).fake.micPermission(),
)
vi.mock('@/lib/voice-session', async () =>
  (await import('./FirstLight.fixture')).fake.voiceSession(),
)
vi.mock('./StarField', async () =>
  (await import('./FirstLight.fixture')).fake.starField(),
)
vi.mock('@/features/mirror/TaskDemo', async () =>
  (await import('./FirstLight.fixture')).fake.taskDemo(),
)
vi.mock('@/features/mirror/LiveViz', async () =>
  (await import('./FirstLight.fixture')).fake.liveViz(),
)
vi.mock('@/features/mirror/voiceprint-share', async () =>
  (await import('./FirstLight.fixture')).fake.voiceprintCard(),
)
vi.mock('@/features/onboarding/funnel', async (importOriginal) =>
  (await import('./FirstLight.fixture')).fake.funnel(importOriginal),
)
vi.mock('@/stores/promo-store', async () =>
  (await import('./FirstLight.fixture')).fake.promoStore(),
)
vi.mock('@/stores/launch-gift-store', async () =>
  (await import('./FirstLight.fixture')).fake.giftStore(),
)
vi.mock('@/lib/merc/gpu-gate', async (importOriginal) =>
  (await import('./FirstLight.fixture')).fake.gpuGate(importOriginal),
)
vi.mock('@/stores/app-store', async (importOriginal) =>
  (await import('./FirstLight.fixture')).fake.appStore(importOriginal),
)

import { PLAN_OPENED_KEY, PLAN_RECORD_KEY } from '@/features/plan/plan-keys'
import { next, OTHER_FIELD, passTo, SOMETHING_ELSE, tap, } from '@/features/plan/PlanQuestions.fixture'
import { TAB_EXERCISES } from '@/features/tabs/constants'
import { applyPersistedValue } from '@/lib/storage'
import { currentBeat, flowOpen, openBeat, recordVoiceprint, resetOnboarding, savedVoiceprints, } from '@/stores/onboarding-store'
import { setActiveTab } from '@/stores/ui-store'
import { APP_KEYS, overheard, stopOverhearing } from '@/tests/utils/trap-keys'
import { BeatMap } from './beats/BeatMap'
import { FirstLight } from './FirstLight'
import { mocks, SAVED_PRINT, VOICEPRINT } from './FirstLight.fixture'
import type { Beat } from './flow'
import type { Room } from './rooms'
import { ROOMS } from './rooms'

/** Every beat the flow can show. */
const BEATS: readonly Beat[] = [
  'sky',
  'first-light',
  'fork',
  'prints',
  'voiceprint',
  'twin',
  'keep',
  'map',
  'questions',
]

/** A key as the tests press it: the app reads `code`, the flow's own handlers read `key`. */
interface Press {
  key: string
  code: string
}

function beat(name: Beat): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[data-beat="${name}"]`)
}

function overlay(): HTMLElement {
  const flow = document.querySelector<HTMLElement>('[data-onboarding-flow]')
  if (flow === null) throw new Error('First Light is not on screen')
  return flow
}

/**
 * What a person can press in the flow: its buttons, links, switches and typed
 * lines. The Map's tour links are spans with a role, and have cases of their
 * own below.
 */
function controls(): HTMLElement[] {
  return [
    ...overlay().querySelectorAll<HTMLElement>(
      'button, a[href], input, [role="switch"]',
    ),
  ]
}

/** Presses every key the app answers to on every control the flow shows. */
function pressEveryAppKeyOnEveryControl(): void {
  for (const control of controls()) {
    for (const press of APP_KEYS) fireEvent.keyDown(control, press)
  }
}

function tracked(): string[] {
  return mocks.trackOnboarding.mock.calls.map(([event]) => String(event))
}

/** The plan record and the stops opened live in module signals that `localStorage.clear()` does not reach. */
function forgetThePlan(): void {
  applyPersistedValue(PLAN_RECORD_KEY, 'null', { persist: false })
  applyPersistedValue(PLAN_OPENED_KEY, '[]', { persist: false })
}

/** Mounts the flow once so it reads the one saved voiceprint, then clears it away. */
async function saveOnePrint(): Promise<void> {
  localStorage.setItem(
    'mercurypitch.voiceprints.v1',
    JSON.stringify([SAVED_PRINT]),
  )
  render(() => <FirstLight />)
  await waitFor(() => expect(savedVoiceprints()).toHaveLength(1))
  cleanup()
}

/** The flow, opened on one beat, with what that beat needs to have in hand. */
async function at(name: Beat): Promise<HTMLElement> {
  if (name === 'twin' || name === 'keep') recordVoiceprint(VOICEPRINT)
  if (name === 'prints') await saveOnePrint()
  render(() => <FirstLight />)
  openBeat(name)
  await waitFor(() => expect(beat(name)).not.toBeNull())
  return beat(name) as HTMLElement
}

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  forgetThePlan()
  setActiveTab('home')
  vi.spyOn(console, 'info').mockImplementation(() => undefined)
  resetOnboarding()
  // jsdom ships no matchMedia; the star field and the plates ask it.
  vi.stubGlobal('matchMedia', () => ({
    matches: false,
    addEventListener: () => {},
    removeEventListener: () => {},
  }))
})

afterEach(() => {
  stopOverhearing()
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  forgetThePlan()
  resetOnboarding()
})

describe('the keyboard stays in the flow', () => {
  it.each([...BEATS])(
    'keeps a Space, an M and an Escape from a control on the %s beat away from the app behind',
    async (name) => {
      // Arrange
      await at(name)
      const heard = overheard()
      // The control: the app does hear a key that comes from outside the flow.
      fireEvent.keyDown(document.body, { key: ' ', code: 'Space' })
      expect(heard).toEqual(['Space'])
      heard.length = 0
      expect(controls().length).toBeGreaterThan(0)

      // Act
      pressEveryAppKeyOnEveryControl()

      // Assert: nothing got out, and Escape is no way out either.
      expect(heard).toEqual([])
      expect(currentBeat()).toBe(name)
      expect(flowOpen()).toBe(true)
    },
  )

  it('keeps the same keys off the plan screen, which the questions lead to', async () => {
    // Arrange
    const host = await at('questions')
    passTo(4)
    next()
    await waitFor(() =>
      within(host).getByRole('button', { name: 'See every room' }),
    )
    expect(host.querySelector('[data-kind="start"]')).not.toBeNull()
    const heard = overheard()

    // Act
    pressEveryAppKeyOnEveryControl()

    // Assert
    expect(heard).toEqual([])
    expect(currentBeat()).toBe('questions')
    expect(flowOpen()).toBe(true)
  })

  it('still cycles Tab inside the trap, from the last control to the first and back', async () => {
    // Arrange: the welcome's controls in DOM order, the way out last.
    await at('sky')
    const first = screen.getByRole('button', { name: 'Sing one note' })
    const last = screen.getByRole('button', { name: 'Skip the intro' })
    const heard = overheard()
    last.focus()

    // Act + Assert: forward from the last control, back from the first.
    expect(fireEvent.keyDown(last, { key: 'Tab', code: 'Tab' })).toBe(false)
    expect(first).toHaveFocus()
    expect(
      fireEvent.keyDown(first, { key: 'Tab', code: 'Tab', shiftKey: true }),
    ).toBe(false)
    expect(last).toHaveFocus()
    expect(heard).toEqual([])
  })
})

describe("the Map's tour link in the flow", () => {
  async function tourLink(): Promise<HTMLElement> {
    const map = await at('map')
    const link = map.querySelector<HTMLElement>(
      '[data-room="exercises"] [role="button"]',
    )
    if (link === null) throw new Error('the Exercises card has a tour link')
    return link
  }

  it.each<[string, Press]>([
    ['Enter', { key: 'Enter', code: 'Enter' }],
    ['Space', { key: ' ', code: 'Space' }],
  ])(
    'opens the room with its tour on %s, which only a handler bound natively can hear behind the stopped keydown',
    async (_name, press) => {
      // Arrange
      const link = await tourLink()
      const heard = overheard()
      link.focus()

      // Act
      const unhandled = fireEvent.keyDown(link, press)

      // Assert: handled (the card's own button does not also activate), counted
      // as the room and the tour, and kept from the app behind.
      expect(unhandled).toBe(false)
      expect(mocks.startPageTour).toHaveBeenCalledTimes(1)
      expect(mocks.startPageTour).toHaveBeenCalledWith(TAB_EXERCISES)
      expect(tracked().slice(-2)).toEqual([
        'onboarding_map_room',
        'onboarding_map_room_exercises',
      ])
      expect(flowOpen()).toBe(false)
      expect(heard).toEqual([])
    },
  )

  it('opens no tour on a key that is not its own, and the app behind hears none of them', async () => {
    // Arrange
    const link = await tourLink()
    const heard = overheard()
    link.focus()

    // Act: the app's keys except Space, which is the link's own.
    for (const press of APP_KEYS) {
      if (press.code !== 'Space') fireEvent.keyDown(link, press)
    }

    // Assert
    expect(mocks.startPageTour).not.toHaveBeenCalled()
    expect(flowOpen()).toBe(true)
    expect(heard).toEqual([])
  })
})

describe("a typed line's Enter in the flow", () => {
  it('still puts the keyboard away, bound natively like the tour link', async () => {
    // Arrange: the third question, with its typed line open
    await at('questions')
    passTo(3)
    tap(SOMETHING_ELSE)
    const field = screen.getByRole('textbox', { name: OTHER_FIELD })
    const heard = overheard()
    field.focus()
    expect(field).toHaveFocus()

    // Act
    const unhandled = fireEvent.keyDown(field, { key: 'Enter', code: 'Enter' })

    // Assert
    expect(unhandled).toBe(false)
    expect(field).not.toHaveFocus()
    expect(heard).toEqual([])
  })
})

describe("the Map's tour link on its own", () => {
  function exercises(): Room {
    const room = ROOMS.find((candidate) => candidate.id === 'exercises')
    if (room === undefined) throw new Error('the Map has an Exercises room')
    return room
  }

  function mount(onTour: () => void): { link: HTMLElement; heard: string[] } {
    const { container } = render(() => (
      <BeatMap
        voiceprint={null}
        onEnter={() => {}}
        onTour={onTour}
        onDone={() => {}}
      />
    ))
    // An ancestor of the link, to hear what the link lets through.
    const heard: string[] = []
    container.addEventListener('keydown', (e) => heard.push(e.key))
    const link = container.querySelector<HTMLElement>(
      '[data-room="exercises"] [role="button"]',
    )
    if (link === null) throw new Error('the Exercises card has a tour link')
    return { link, heard }
  }

  it.each([
    ['Enter', 'Enter'],
    ['Space', ' '],
  ])(
    'opens its own room with the tour on %s and keeps the key to itself',
    (_name, key) => {
      // Arrange
      const onTour = vi.fn()
      const { link, heard } = mount(onTour)

      // Act
      const unhandled = fireEvent.keyDown(link, { key })

      // Assert: the card's own button is not also pressed, and nothing above
      // the link hears the key.
      expect(unhandled).toBe(false)
      const room = exercises()
      expect(onTour).toHaveBeenCalledTimes(1)
      expect(onTour).toHaveBeenCalledWith(room.target, room.tourTab, room.id)
      expect(heard).toEqual([])
    },
  )

  it.each(['Tab', 'ArrowDown', 'm', 'Escape'])(
    'is not the business of %s: no tour, and the key goes on up',
    (key) => {
      // Arrange
      const onTour = vi.fn()
      const { link, heard } = mount(onTour)

      // Act
      const unhandled = fireEvent.keyDown(link, { key })

      // Assert
      expect(unhandled).toBe(true)
      expect(onTour).not.toHaveBeenCalled()
      expect(heard).toEqual([key])
    },
  )
})
