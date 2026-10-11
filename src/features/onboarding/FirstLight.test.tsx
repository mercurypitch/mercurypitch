// ============================================================
// First Light: the Fork's way out, and one way out on every beat
// ============================================================
//
// Owner decisions V1, V2, V3 and V8 (10-11 Oct 2026). Every beat has at
// most one way out, at the top right of the frame: a close button on the
// welcome, "Not now" everywhere else, and never a second exit button
// beside the beat's own. On the Fork, "Not now" is the old "Take me in"
// card moved to the corner: it lands on the Map with nothing measured and
// keeps that card's event, `onboarding_track_short`, so the funnel reads
// straight across the change. No new event names.

import { cleanup, fireEvent, render, waitFor, within, } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type * as OnboardingFunnelModule from '@/features/onboarding/funnel'
import { ONBOARDING_FUNNEL_EVENTS } from '@/lib/funnel-event-catalog'
import type { MirrorResult } from '@/lib/mirror/metrics'
import type { OpenResult, ProbeResult, VoiceSession } from '@/lib/voice-session'

const mocks = vi.hoisted(() => ({ trackOnboarding: vi.fn() }))

vi.mock('@/lib/jam/media-errors', () => ({
  micPermissionState: (): Promise<string> => Promise.resolve('granted'),
}))

vi.mock('@/lib/voice-session', () => ({
  createVoiceSession: (): VoiceSession =>
    ({
      open: (): Promise<OpenResult> =>
        Promise.resolve({ ok: true } as OpenResult),
      probe: (): Promise<ProbeResult> => Promise.resolve('ok' as ProbeResult),
      arm: (): void => {},
      record: () => Promise.resolve([]),
      latest: () => null,
      latestSmoothed: () => null,
      level: (): number => 0,
      context: () => null,
      isOpen: (): boolean => false,
      devices: (): Promise<MediaDeviceInfo[]> => Promise.resolve([]),
      useDevice: (): Promise<ProbeResult> =>
        Promise.resolve('ok' as ProbeResult),
      close: (): void => {},
    }) as unknown as VoiceSession,
}))

// jsdom cannot draw: the canvases (the star field, the voiceprint's demo
// and live trace) are stubbed out. None of them is an exit.
vi.mock('./StarField', () => ({ StarField: () => null }))
vi.mock('@/features/mirror/TaskDemo', () => ({ TaskDemo: () => null }))
vi.mock('@/features/mirror/LiveViz', () => ({ LiveViz: () => null }))
vi.mock('@/features/mirror/voiceprint-share', () => ({
  renderVoiceprintCard: async () => null,
}))

vi.mock('@/features/onboarding/funnel', async (importOriginal) => {
  const actual = await importOriginal<typeof OnboardingFunnelModule>()
  return { ...actual, trackOnboarding: mocks.trackOnboarding }
})

vi.mock('@/stores/promo-store', async () => {
  const { createSignal } = await import('solid-js')
  const [offer] = createSignal(null)
  return { offeredPromo: offer, loadFeaturedPromo: async () => {} }
})

vi.mock('@/stores/launch-gift-store', () => ({
  giftWaiting: () => null,
  rememberGiftOffered: () => {},
  claimGiftNow: async () => {},
}))

import { currentBeat, openBeat, recordVoiceprint, resetOnboarding, savedVoiceprints, track, voiceprint, } from '@/stores/onboarding-store'
import { FirstLight } from './FirstLight'
import type { Beat } from './flow'

const VOICEPRINT: MirrorResult = {
  range: {
    lowMidi: 40,
    highMidi: 67,
    lowNote: 'E2',
    highNote: 'G4',
    semitones: 27,
    qualifyingMidis: [40, 52, 67],
    voiceHint: 'baritone',
  },
  accuracy: null,
  steadiness: null,
}

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

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
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

  it('"Not now" takes the Fork to the Map with nothing measured, counted as the short track', async () => {
    // Arrange
    await at('fork')
    const [notNow] = railExits()

    // Act
    fireEvent.click(notNow)

    // Assert
    await waitFor(() => expect(currentBeat()).toBe('map'))
    expect(notNow).toHaveTextContent('Not now')
    expect(track()).toBe('short')
    expect(voiceprint()).toBeNull()
    expect(tracked()).toContain('onboarding_track_short')
    expect(tracked()).not.toContain('onboarding_skipped')
    expect(ONBOARDING_FUNNEL_EVENTS).toEqual(expect.arrayContaining(tracked()))
  })
})

/** One voiceprint already on this device, for the returning beats. */
const SAVED_PRINT = {
  id: 'saved-1',
  takenAt: '2026-10-10T10:00:00.000Z',
  twin: null,
  source: 'mirror',
  summary: { lowMidi: 43, highMidi: 72, semitones: 29 },
}

/** The ways out that used to sit inside a beat. Matched anywhere in a
 *  button's text, with no word boundary in front: a card button's title
 *  runs straight on from its label ("Straight awayTake me in…"). */
const EXIT_INSIDE = /(Skip|Not now|Take me in|Make another)/

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

describe('focus on a beat change', () => {
  it('moves focus to the new beat\'s heading, out of the Tab order', async () => {
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
    ).toBeTruthy()
  })
})
