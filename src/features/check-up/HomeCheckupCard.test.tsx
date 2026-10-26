// ============================================================
// HomeCheckupCard — when Home offers the weekly Check-up, and what it says
// ============================================================
//
// The history is the voiceprint service's (listVoiceprints), faked here at
// that boundary: it reads the account from the server when one is signed in,
// and the card's rules are about what comes back, not how. accountHeld is the
// token's answer, faked the same way. The clock is the card's own seam.

import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type * as AuthService from '@/db/services/auth-service'
import { setAuthToken } from '@/db/services/user-service'
import type { VoiceprintRecord } from '@/db/services/voiceprint-service'
import { CHECKUP_CARD_DISMISSED_KEY } from '@/lib/check-up/due'
import { authModalMode, closeAuthModal } from '@/stores/ui-store'
import { CHECKUP_MIRROR_HREF, HomeCheckupCard } from './HomeCheckupCard'

const world = vi.hoisted(() => ({
  history: [] as VoiceprintRecord[],
  fails: false,
  signedIn: false,
}))

vi.mock('@/db/services/voiceprint-service', () => ({
  listVoiceprints: async () => {
    if (world.fails) throw new Error('offline')
    return world.history
  },
}))

vi.mock('@/db/services/auth-service', async (importOriginal) => ({
  ...(await importOriginal<typeof AuthService>()),
  accountHeld: () => world.signedIn,
}))

const DAY = 24 * 60 * 60 * 1000
const SUNG = Date.parse('2026-10-19T12:00:00.000Z')

function take(ms: number): VoiceprintRecord {
  return {
    id: `take-${ms}`,
    takenAt: new Date(ms).toISOString(),
    twin: null,
    source: 'mirror',
    summary: {
      lowMidi: 43,
      highMidi: 60,
      semitones: 17,
      accuracy: 60,
      steadiness: 70,
    },
  }
}

function renderCard(now: number) {
  const view = render(() => <HomeCheckupCard now={() => now} />)
  return view
}

const card = () => screen.queryByTestId('home-checkup-card')

/** Past the faked read, which settles in a few microtasks. */
const settled = () => new Promise((resolve) => setTimeout(resolve, 0))

beforeEach(() => {
  localStorage.clear()
  world.history = [take(SUNG - 9 * DAY), take(SUNG)]
  world.fails = false
  world.signedIn = false
})

afterEach(() => {
  cleanup()
  closeAuthModal()
})

describe('when the card shows', () => {
  it('offers the next take a week after the newest one, naming its day', async () => {
    renderCard(SUNG + 7 * DAY)

    expect(
      await screen.findByRole('heading', {
        name: 'A week since your last Check-up',
      }),
    ).toBeInTheDocument()
    expect(card()).toHaveTextContent(
      'Sing the same 90 seconds as on 19 October, and see what moved.',
    )
    expect(
      screen.getByRole('link', { name: 'Start my Check-up' }),
    ).toHaveAttribute('href', CHECKUP_MIRROR_HREF)
  })

  it('names the last day as the heading from two weeks on', async () => {
    renderCard(SUNG + 15 * DAY)

    const shown = await screen.findByTestId('home-checkup-card')
    expect(shown.querySelector('h2')).toHaveTextContent(
      'Your last Check-up was on 19 October.',
    )
    expect(shown).toHaveTextContent(
      'Sing the same 90 seconds again, and see what moved.',
    )
  })

  it('draws nothing while the newest take is under a week old', async () => {
    const { container } = renderCard(SUNG + 6 * DAY)
    await settled()

    expect(container.childElementCount).toBe(0)
  })

  it('draws nothing with no take at all', async () => {
    world.history = []
    const { container } = renderCard(SUNG + 30 * DAY)
    await settled()

    expect(container.childElementCount).toBe(0)
  })

  it('draws nothing, and says nothing, when the history cannot be read', async () => {
    world.fails = true
    const { container } = renderCard(SUNG + 8 * DAY)
    await settled()

    expect(container.childElementCount).toBe(0)
    expect(container).toHaveTextContent('')
  })

  it('reads the history again when the auth version moves', async () => {
    renderCard(SUNG + 8 * DAY)
    await screen.findByTestId('home-checkup-card')

    world.history = [take(SUNG + 7 * DAY)]
    setAuthToken('signed-in-elsewhere')

    await vi.waitFor(() => expect(card()).toBeNull())
    setAuthToken(null)
  })
})

describe('"Not this week"', () => {
  it('sends the card away and keeps the tap', async () => {
    const tapped = SUNG + 8 * DAY
    renderCard(tapped)

    fireEvent.click(
      await screen.findByRole('button', { name: 'Not this week' }),
    )

    expect(card()).toBeNull()
    expect(localStorage.getItem(CHECKUP_CARD_DISMISSED_KEY)).toBe(
      String(tapped),
    )
  })

  it('leaves the focus in the main region, without scrolling, as the card goes', async () => {
    // App.tsx's main region, which a test of the card alone has to supply.
    const main = document.createElement('main')
    main.id = 'main-content'
    main.tabIndex = -1
    document.body.append(main)
    try {
      renderCard(SUNG + 8 * DAY)
      const skip = await screen.findByRole('button', { name: 'Not this week' })
      skip.focus()
      const focus = vi.spyOn(main, 'focus')

      fireEvent.click(skip)

      expect(card()).toBeNull()
      expect(focus).toHaveBeenCalledExactlyOnceWith({ preventScroll: true })
      expect(document.activeElement).toBe(main)
    } finally {
      main.remove()
    }
  })

  it('keeps it away for six days after the tap', async () => {
    const tapped = SUNG + 8 * DAY
    localStorage.setItem(CHECKUP_CARD_DISMISSED_KEY, String(tapped))
    const { container } = renderCard(tapped + 6 * DAY)
    await settled()

    expect(container.childElementCount).toBe(0)
  })

  it('brings it back a week after the tap', async () => {
    const tapped = SUNG + 8 * DAY
    localStorage.setItem(CHECKUP_CARD_DISMISSED_KEY, String(tapped))
    renderCard(tapped + 7 * DAY)

    const shown = await screen.findByTestId('home-checkup-card')
    expect(shown.querySelector('h2')).toHaveTextContent(
      'Your last Check-up was on 19 October.',
    )
  })
})

describe('the account line', () => {
  it('says signed out where the Check-ups live, and opens the sign-up pane', async () => {
    renderCard(SUNG + 8 * DAY)

    const line = await screen.findByTestId('home-checkup-account')
    expect(line).toHaveTextContent(
      'Your Check-ups stay in this browser. A free account keeps every one, on every device.',
    )
    fireEvent.click(
      screen.getByRole('button', { name: 'Create a free account' }),
    )
    expect(authModalMode()).toBe('register')
  })

  it('is not there for somebody signed in', async () => {
    world.signedIn = true
    renderCard(SUNG + 8 * DAY)

    await screen.findByTestId('home-checkup-card')
    expect(screen.queryByTestId('home-checkup-account')).toBeNull()
    expect(
      screen.queryByRole('button', { name: 'Create a free account' }),
    ).toBeNull()
  })
})
