// ============================================================
// First Light: the Fork's way out, and one way out on every beat
// ============================================================
//
// Owner decisions V1, V2, V3 and V8 (10-11 Oct 2026). Every beat has at
// most one way out, at the top right of the frame: a close button on the
// welcome, "Not now" everywhere else, and never a second exit button
// beside the beat's own. On the Fork, "Not now" is the old "Take me in"
// card moved to the corner: it lands on the next beat with nothing measured
// and keeps that card's event, `onboarding_track_short`, so the funnel reads
// straight across the change. No new event names.
//
// The next beat is the four questions while the person's plan is due (the
// plan record is empty or only shown), and the Map once it has been answered
// or turned down. The questions' own cases are in FirstLight.plan.test.tsx.
//
// Every case mounts the real flow at one beat and reads what that beat does.
// The harness these cases share with FirstLight.plan.test.tsx and
// FirstLight.keys.test.tsx (the mic, the canvases, the promo and the funnel
// faked once, and the voiceprints) is in FirstLight.fixture.tsx.

import { cleanup, fireEvent, render, waitFor, within, } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ONBOARDING_FUNNEL_EVENTS } from '@/lib/funnel-event-catalog'

// The flow's edges are faked once, in FirstLight.fixture.tsx: the mic, the
// canvases (none of them is an exit), the funnel, the promo and gift stores,
// the GPU gate and the rooms' tours.
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
vi.mock('@/features/mic-check/MicCheckStage', async () =>
  (await import('./FirstLight.fixture')).fake.micStage(),
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
import { savePlanAnswers } from '@/features/plan/plan-store'
import { hasRoomTour, startRoomTour } from '@/features/tours/room-tour'
import { provideRoomTourDoor } from '@/lib/room-tour-door'
import { applyPersistedValue } from '@/lib/storage'
import { currentBeat, flowOpen, openBeat, recordFirstNote, recordVoiceprint, resetOnboarding, savedVoiceprints, track, voiceprint, } from '@/stores/onboarding-store'
import { setActiveTab } from '@/stores/ui-store'
import { VOICE_RIDGE } from './beats/KeepChips'
import { FirstLight } from './FirstLight'
import { mocks, SAVED_PRINT, skipAnyway, VOICEPRINT, } from './FirstLight.fixture'
import type { Beat } from './flow'
import { MAP_ROOM_EVENT } from './funnel'
import type { Plate } from './plates'
import { plateSrc } from './plates'
import { ROOMS } from './rooms'
import { ridgeShape } from './voice-strip'

// The Map asks the room tour door whether a room has a tour, and First Light
// starts one through it; App opens it as it draws. These cases draw no App, so
// they open it as App does.
provideRoomTourDoor(startRoomTour, hasRoomTour)

function beat(name: Beat): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[data-beat="${name}"]`)
}

async function at(name: Beat): Promise<HTMLElement> {
  render(() => <FirstLight />)
  openBeat(name)
  await waitFor(() => expect(beat(name)).not.toBeNull())
  return beat(name) as HTMLElement
}

/** The flow's buttons outside the beat itself: the rail's way out. */
function railExits(): HTMLElement[] {
  const flow = document.querySelector('[data-onboarding-flow]')
  return [...(flow?.querySelectorAll<HTMLElement>('button') ?? [])].filter(
    (button) => button.closest('[data-beat]') === null,
  )
}

function tracked(): string[] {
  return mocks.trackOnboarding.mock.calls.map(([event]) => String(event))
}

/** The plan record and the stops opened live in module signals that `localStorage.clear()` does not reach. */
function forgetThePlan(): void {
  applyPersistedValue(PLAN_RECORD_KEY, 'null', { persist: false })
  applyPersistedValue(PLAN_OPENED_KEY, '[]', { persist: false })
}

/** A plan that has been answered: the questions are not due. */
function answerThePlan(): void {
  savePlanAnswers(
    { q1: 'singing', q2: null, q3: [], q4: [] },
    { q3other: '', q4app: '' },
  )
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
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  forgetThePlan()
  resetOnboarding()
})

describe('the Fork in the flow', () => {
  it('"Find my twin" starts the voiceprint, counted as the full track', async () => {
    // Arrange
    const fork = await at('fork')

    // Act
    fireEvent.click(within(fork).getByRole('button', { name: 'Find my twin' }))

    // Assert
    await waitFor(() => expect(currentBeat()).toBe('voiceprint'))
    expect(track()).toBe('full')
    expect(tracked()).toContain('onboarding_track_full')
    expect(ONBOARDING_FUNNEL_EVENTS).toEqual(expect.arrayContaining(tracked()))
  })

  it("asks the questions after the short track's Not now, with nothing measured, counted as the short track", async () => {
    // Arrange
    await at('fork')
    const [notNow] = railExits()

    // Act: it asks first (FirstLight.skip.test.tsx), and Yes, skip goes on.
    fireEvent.click(notNow)
    skipAnyway()

    // Assert
    await waitFor(() => expect(currentBeat()).toBe('questions'))
    expect(beat('questions')).not.toBeNull()
    expect(notNow).toHaveTextContent('Not now')
    expect(track()).toBe('short')
    expect(voiceprint()).toBeNull()
    expect(tracked()).toContain('onboarding_track_short')
    expect(tracked()).not.toContain('onboarding_skipped')
    expect(ONBOARDING_FUNNEL_EVENTS).toEqual(expect.arrayContaining(tracked()))
  })

  it('"Not now" on a replayed Fork lands on the questions, not the account ask, and keeps the voiceprint', async () => {
    // Arrange: the review's path. A voiceprint made earlier this session
    // is still in memory, the account ask is still due, and the intro is
    // replayed from Settings. Every "Not now" goes past Keep (V9), to the
    // questions while the plan is due; the voiceprint is never dropped (V13).
    recordVoiceprint(VOICEPRINT)
    render(() => <FirstLight replay />)
    openBeat('fork')
    await waitFor(() => expect(beat('fork')).not.toBeNull())
    const [notNow] = railExits()

    // Act
    fireEvent.click(notNow)

    // Assert
    await waitFor(() => expect(beat('questions')).not.toBeNull())
    expect(currentBeat()).toBe('questions')
    expect(beat('keep')).toBeNull()
    expect(voiceprint()).toEqual(VOICEPRINT)
    expect(tracked()).toContain('onboarding_track_short')
  })

  it('"Not now" goes straight to the Map once the plan is answered', async () => {
    // Arrange: somebody who answered the questions on another visit.
    answerThePlan()
    await at('fork')
    const [notNow] = railExits()

    // Act
    fireEvent.click(notNow)
    skipAnyway()

    // Assert
    await waitFor(() => expect(currentBeat()).toBe('map'))
    expect(beat('questions')).toBeNull()
    expect(tracked()).toContain('onboarding_track_short')
  })
})

// Past the walk, a Not now leads to the plain sky (the four questions while the
// plan is due) or to the Map (once it is answered), so both are fetched behind
// each beat that has one. The questions lead to the Map by See every room alone.
describe('the pictures fetched ahead', () => {
  it.each<[Beat, readonly Plate[]]>([
    ['fork', ['plain', 'map']],
    ['first-light', ['plain', 'map']],
    ['questions', ['map']],
  ])('fetches what can follow the %s beat: %j', async (name, plates) => {
    // Arrange
    const requested: string[] = []
    vi.stubGlobal(
      'Image',
      class {
        decoding = ''
        set src(value: string) {
          requested.push(value)
        }
      },
    )

    // Act
    await at(name)

    // Assert
    expect(requested).toEqual(
      expect.arrayContaining(plates.map((plate) => plateSrc(plate, false))),
    )
  })
})

/** The ways out that used to sit inside a beat. Matched anywhere in a
 *  button's text, with no word boundary in front: a card button's title
 *  runs straight on from its label ("Straight awayTake me in…"). "Make
 *  another voiceprint" is not one of them: it is a destination for a
 *  returning singer, the Voice Mirror (owner decision V12). */
const EXIT_INSIDE = /(Skip|Not now|Take me in)/

describe('one way out on every beat', () => {
  // The Map is the last beat: its rooms and its own button are the way
  // on, so the rail carries nothing there.
  it.each<[Beat, number]>([
    ['sky', 1],
    ['first-light', 1],
    ['fork', 1],
    ['prints', 1],
    ['voiceprint', 1],
    ['twin', 1],
    ['keep', 1],
    ['map', 0],
  ])(
    'gives the %s beat %i way out at the top, and none inside the beat',
    async (name, count) => {
      // Arrange
      if (name === 'twin' || name === 'keep') recordVoiceprint(VOICEPRINT)
      if (name === 'prints') {
        localStorage.setItem(
          'mercurypitch.voiceprints.v1',
          JSON.stringify([SAVED_PRINT]),
        )
        render(() => <FirstLight />)
        await waitFor(() => expect(savedVoiceprints()).toHaveLength(1))
        cleanup()
      }

      // Act
      const shown = await at(name)

      // Assert
      expect(railExits()).toHaveLength(count)
      const inside = [...shown.querySelectorAll('button')].map(
        (button) => button.textContent?.trim() ?? '',
      )
      expect(inside.filter((label) => EXIT_INSIDE.test(label))).toEqual([])
    },
  )
})

describe('"Not now" lands past the walk (owner decision V9)', () => {
  it.each<Beat>(['first-light', 'voiceprint', 'prints', 'twin'])(
    'takes the %s beat to the questions, counted as a skip, with the flow still open',
    async (name) => {
      // Arrange
      if (name === 'twin') recordVoiceprint(VOICEPRINT)
      if (name === 'prints') {
        localStorage.setItem(
          'mercurypitch.voiceprints.v1',
          JSON.stringify([SAVED_PRINT]),
        )
        render(() => <FirstLight />)
        await waitFor(() => expect(savedVoiceprints()).toHaveLength(1))
        cleanup()
      }
      await at(name)
      const [notNow] = railExits()
      expect(notNow).toHaveTextContent('Not now')

      // Act: before a voiceprint, Not now asks first; the twin and the
      // prints have one already, and go on at once.
      fireEvent.click(notNow)
      if (name === 'first-light' || name === 'voiceprint') skipAnyway()

      // Assert
      await waitFor(() => expect(currentBeat()).toBe('questions'))
      expect(flowOpen()).toBe(true)
      expect(beat('questions')).not.toBeNull()
      expect(tracked()).toContain('onboarding_skipped')
      expect(tracked()).not.toContain('onboarding_track_short')
      expect(ONBOARDING_FUNNEL_EVENTS).toEqual(
        expect.arrayContaining(tracked()),
      )
    },
  )

  it('takes a beat to the Map once the plan is answered, counted as a skip', async () => {
    // Arrange
    answerThePlan()
    await at('first-light')
    const [notNow] = railExits()

    // Act
    fireEvent.click(notNow)
    skipAnyway()

    // Assert
    await waitFor(() => expect(currentBeat()).toBe('map'))
    expect(beat('questions')).toBeNull()
    expect(tracked()).toContain('onboarding_skipped')
  })

  it('makes no voiceprint on the way: leaving the voiceprint mid-run lands with none', async () => {
    // Arrange
    await at('voiceprint')

    // Act
    fireEvent.click(railExits()[0])
    skipAnyway()

    // Assert
    await waitFor(() => expect(currentBeat()).toBe('questions'))
    expect(voiceprint()).toBeNull()
  })
})

describe('"Make another voiceprint" for a returning singer (owner decision V12)', () => {
  it.each<[Beat, string]>([
    ['fork', 'Make another voiceprint'],
    ['prints', 'Make another voiceprint'],
  ])(
    'opens the Voice Mirror from the %s beat, counted as another voiceprint',
    async (name, label) => {
      // Arrange: one voiceprint already on this device.
      localStorage.setItem(
        'mercurypitch.voiceprints.v1',
        JSON.stringify([SAVED_PRINT]),
      )
      render(() => <FirstLight />)
      await waitFor(() => expect(savedVoiceprints()).toHaveLength(1))
      cleanup()
      const shown = await at(name)
      const location = { href: '' }
      vi.stubGlobal('location', location)

      // Act
      fireEvent.click(within(shown).getByRole('button', { name: label }))

      // Assert
      expect(tracked()).toContain('onboarding_another_voiceprint')
      expect(location.href).toBe('/mirror')
      expect(flowOpen()).toBe(false)
      expect(ONBOARDING_FUNNEL_EVENTS).toEqual(
        expect.arrayContaining(tracked()),
      )
    },
  )
})

describe("First light's star (owner decision V11)", () => {
  const star = (): Element | null =>
    document.querySelector('[data-plate="first-light"] [data-star]')

  it('stays dark until the first note lands, then lights', async () => {
    // Arrange
    await at('first-light')
    expect(star()).toHaveAttribute('data-lit', 'false')

    // Act
    recordFirstNote('A3')

    // Assert
    await waitFor(() => expect(star()).toHaveAttribute('data-lit', 'true'))
  })

  it('stays lit behind the Fork, which shares the picture', async () => {
    // Arrange
    await at('first-light')
    recordFirstNote('A3')

    // Act
    openBeat('fork')

    // Assert
    await waitFor(() => expect(beat('fork')).not.toBeNull())
    expect(star()).toHaveAttribute('data-lit', 'true')
  })

  it('starts the glow at rest, before any voice', async () => {
    await at('first-light')

    expect((star() as HTMLElement).style.getPropertyValue('--voice')).toBe('0')
  })
})

describe('focus on a beat change', () => {
  it("moves focus to the new beat's heading, out of the Tab order", async () => {
    // Arrange
    const fork = await at('fork')
    const start = within(fork).getByRole('button', { name: 'Find my twin' })
    start.focus()

    // Act
    fireEvent.click(start)

    // Assert
    await waitFor(() => expect(beat('voiceprint')).not.toBeNull())
    const heading = beat('voiceprint')?.querySelector('h1')
    expect(heading).not.toBeNull()
    expect(document.activeElement).toBe(heading)
    expect(heading).toHaveAttribute('tabindex', '-1')
  })

  it('never hands an escaped Tab to the way out: Enter, Tab, Enter stays in the beat', async () => {
    // Arrange: the Fork's button pressed from the keyboard. It unmounts
    // with the beat, and the next Tab from the page lands outside the
    // overlay, which the focus trap pulls back in.
    const fork = await at('fork')
    const start = within(fork).getByRole('button', { name: 'Find my twin' })
    start.focus()
    fireEvent.click(start)
    await waitFor(() => expect(beat('voiceprint')).not.toBeNull())
    const outside = document.createElement('button')
    document.body.append(outside)

    // Act
    outside.focus()
    await Promise.resolve()
    await Promise.resolve()

    // Assert
    const [notNow] = railExits()
    expect(document.activeElement).not.toBe(notNow)
    expect(beat('voiceprint')?.contains(document.activeElement)).toBe(true)
    outside.remove()
  })

  it('puts the way out after the beat in the DOM, so Tab reaches the beat first', async () => {
    // Arrange
    const shown = await at('first-light')

    // Act
    const [notNow] = railExits()

    // Assert
    expect(
      shown.compareDocumentPosition(notNow) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
  })
})

// Follow-up to PR 977: `onboarding_map_room` says a room was entered, never
// which, so nothing ranked the four doors under the grid. Each door now
// counts its own tap, beside the room event that keeps its history.
describe('a tap on a Map door, counted per door', () => {
  it.each([
    ['Challenges', 'onboarding_map_door_challenges'],
    ['Guitar', 'onboarding_map_door_guitar'],
    ['Piano', 'onboarding_map_door_piano'],
    ['Voice Mirror', 'onboarding_map_door_mirror'],
    ['Lessons', 'onboarding_map_door_lessons'],
  ])('counts a tap on %s as %s', async (label, event) => {
    // Arrange: a page door navigates, which jsdom cannot do.
    vi.stubGlobal('location', { href: '' })
    const map = await at('map')
    const door = within(map).getByRole('button', { name: label })

    // Act
    fireEvent.click(door)

    // Assert
    expect(tracked().slice(-2)).toEqual(['onboarding_map_room', event])
    expect(ONBOARDING_FUNNEL_EVENTS).toEqual(expect.arrayContaining(tracked()))
  })
})

// `onboarding_map_room` says a room was entered, never which. Each of the
// six rooms now has its own name beside it, whether the card or its tour link
// was tapped. A side door keeps only its own event (tested above).
describe('a tap on a Map room, counted per room', () => {
  it('sends the room after onboarding_map_room when a room card is tapped', async () => {
    // Arrange: Karaoke is a page room, which navigates; jsdom cannot.
    vi.stubGlobal('location', { href: '' })
    const map = await at('map')
    const card = map.querySelector<HTMLElement>('[data-room="karaoke"]')
    if (card === null) throw new Error('the Map has a Karaoke card')

    // Act
    fireEvent.click(card)

    // Assert
    expect(tracked().slice(-2)).toEqual([
      'onboarding_map_room',
      'onboarding_map_room_karaoke',
    ])
  })

  it('sends the room for Take the tour too', async () => {
    // Arrange
    const map = await at('map')
    const card = map.querySelector<HTMLElement>('[data-room="exercises"]')
    const tour = card?.querySelector<HTMLElement>('[role="button"]')
    if (tour === null || tour === undefined) {
      throw new Error('the Exercises card has a tour link')
    }

    // Act
    fireEvent.click(tour)

    // Assert
    expect(tracked().slice(-2)).toEqual([
      'onboarding_map_room',
      'onboarding_map_room_exercises',
    ])
  })

  it('has a catalog name for every room', () => {
    // Assert
    expect(Object.keys(MAP_ROOM_EVENT).sort()).toEqual(
      ROOMS.map((room) => room.id).sort(),
    )
    expect(ONBOARDING_FUNNEL_EVENTS).toEqual(
      expect.arrayContaining(Object.values(MAP_ROOM_EVENT)),
    )
  })

  it('counts every room under its own name', () => {
    // Assert
    for (const room of ROOMS) {
      expect(MAP_ROOM_EVENT[room.id]).toBe(`onboarding_map_room_${room.id}`)
    }
  })
})

// Owner decision, 12 Oct 2026: Keep's rows lead with motion chips, and the
// first one draws the singer's own glides, the line the twin's card drew.
describe("Keep's chips", () => {
  it("draw the glides the voiceprint recorded, not the range's ideal", async () => {
    // Arrange
    const strip = [41, 44.5, 49, 53, 57.2, 61, 64.8, 66.5, 63, 58.4, 52, 45]
    recordVoiceprint(VOICEPRINT, strip)
    const range = VOICEPRINT.range
    if (range === null) throw new Error('the fixture has a range')

    // Act
    const keep = await at('keep')

    // Assert
    expect(
      keep
        .querySelector('[data-chip="voiceprint"] [data-ridge-line]')
        ?.getAttribute('d'),
    ).toBe(ridgeShape(strip, range, VOICE_RIDGE.box).line)
  })
})
