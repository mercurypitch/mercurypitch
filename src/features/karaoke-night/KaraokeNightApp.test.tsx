// ============================================================
// Karaoke Night shell background integration tests
// ============================================================

import { cleanup, fireEvent, render, screen, waitFor, within, } from '@solidjs/testing-library'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MERC_TOUR_LINE } from '@/components/coach/TourChip'
import { matchVoiceCommand } from '@/features/voice-control/command-grammar'
import { activeVoiceCommands } from '@/features/voice-control/voice-command-registry'
import type * as GuideFunnelModule from '@/lib/guide-funnel'
import type * as ViewportModule from '@/lib/use-viewport'
import { karaokeZen, setKaraokeZen } from '@/stores/ui-store'
import { KARAOKE_TOUR_OFFER_KEY } from './karaoke-tour-offer'
import { KaraokeNightApp } from './KaraokeNightApp'

const viewport = vi.hoisted(() => ({ narrow: false }))
vi.mock('@/lib/use-viewport', async (importOriginal) => ({
  ...(await importOriginal<typeof ViewportModule>()),
  isNarrow: () => viewport.narrow,
}))

// No demo unless a test puts one in; a demo given is a playable one.
const demo = vi.hoisted(() => ({ songs: [] as unknown[] }))
vi.mock('./demo-song', () => ({
  demoIsPlayable: (song: unknown) => song !== null && song !== undefined,
  demoSessionId: (slug: string) => `demo:${slug}`,
  isDemoSessionId: () => false,
  loadDemoSongs: async () => demo.songs,
  seedDemoLyrics: async () => undefined,
}))

vi.mock('./funnel', () => ({ trackKaraoke: vi.fn() }))
vi.mock('./KaraokeAccount', () => ({ KaraokeAccount: () => null }))
vi.mock('./KaraokeNightRuntime', () => ({ KaraokeNightRuntime: () => null }))
vi.mock('./KaraokeRailPanels', () => ({ KaraokeRailPanels: () => null }))
vi.mock('./KaraokeStageHost', () => ({ KaraokeStageHost: () => null }))

// Merc's tour itself (the coach, the steps) is start-karaoke-tour.ts's.
const tour = vi.hoisted(() => ({ start: vi.fn(async () => undefined) }))
vi.mock('./start-karaoke-tour', () => ({ startKaraokeTour: tour.start }))

const funnel = vi.hoisted(() => ({ trackTour: vi.fn() }))
vi.mock('@/lib/guide-funnel', async (importOriginal) => ({
  ...(await importOriginal<typeof GuideFunnelModule>()),
  trackTour: funnel.trackTour,
}))

afterEach(() => {
  cleanup()
  localStorage.clear()
  window.history.replaceState({}, '', '/')
  setKaraokeZen(false)
  viewport.narrow = false
  demo.songs = []
  tour.start.mockClear()
  funnel.trackTour.mockClear()
})

describe('KaraokeNightApp background integration', () => {
  it('paints the free fallback through shared focal-point variables', () => {
    const { container } = render(() => <KaraokeNightApp />)
    const app = container.querySelector<HTMLElement>('.kn-app')
    expect(app).not.toBeNull()
    expect(app!.style.getPropertyValue('--mp-stage-image')).toContain(
      '/karaoke-night-stage.webp',
    )
    expect(app!.style.getPropertyValue('--mp-stage-position')).toBe('50% 50%')
    expect(
      screen.getByRole('button', { name: 'Choose karaoke stage background' }),
    ).toBeInTheDocument()
  })
})

// ============================================================
// A room you can leave by voice
// ============================================================
//
// Reported from a device retest: on this page voice offered Mercury Sing's
// commands and "what can I say", and nothing else. The tab set that carries
// "go home" belongs to the app shell, which this document is not — so a
// singer with the phone across the room could get here by voice and then
// had no phrase that got them out again.

describe('KaraokeNightApp voice navigation', () => {
  it('registers a spoken way back into the app', () => {
    render(() => <KaraokeNightApp />)

    const ids = new Set(activeVoiceCommands().map((command) => command.id))
    expect(ids).toContain('nav.leave.home')
    expect(ids).toContain('nav.leave.singing')
    expect(ids).toContain('nav.leave.karaoke')
    // The set it used to be registered beside, still there.
    expect(ids).toContain('nav.voiceHelp')
  })

  it('answers the phrases a singer would actually say', () => {
    render(() => <KaraokeNightApp />)

    for (const utterance of ['go home', 'back to the studio', 'go to singing'])
      expect(
        matchVoiceCommand(utterance, activeVoiceCommands()),
        utterance,
      ).not.toBeNull()
  })
})

// ============================================================
// Link parameters: zen=1 and an unknown song (REQ-SKL-012, REQ-SKL-013)
// ============================================================

describe('KaraokeNightApp link parameters', () => {
  it('opens the zen stage on a desktop for zen=1', () => {
    window.history.replaceState({}, '', '/karaoke-night?zen=1')
    render(() => <KaraokeNightApp />)
    expect(karaokeZen()).toBe(true)
  })

  it('changes nothing on a phone, which is always zen', () => {
    viewport.narrow = true
    window.history.replaceState({}, '', '/karaoke-night?zen=1')
    render(() => <KaraokeNightApp />)
    expect(karaokeZen()).toBe(false)
  })

  it('leaves zen off without the parameter', () => {
    window.history.replaceState({}, '', '/karaoke-night')
    render(() => <KaraokeNightApp />)
    expect(karaokeZen()).toBe(false)
  })

  it('takes zen=1 out of the address when the visitor leaves zen', () => {
    window.history.replaceState({}, '', '/karaoke-night?song=josephine&zen=1')
    render(() => <KaraokeNightApp />)
    expect(window.location.search).toContain('zen=1')

    setKaraokeZen(false)

    expect(window.location.search).not.toContain('zen')
  })

  it('drops a song nobody published and opens the page as usual', async () => {
    window.history.replaceState({}, '', '/karaoke-night?song=not-a-song&zen=1')
    render(() => <KaraokeNightApp />)

    await waitFor(() => expect(window.location.search).toBe('?zen=1'))
    expect(
      screen.getByRole('heading', { name: 'Your stage is set' }),
    ).toBeInTheDocument()
  })
})

// ============================================================
// Merc's tour: an ad's ?tour=first, and a first visit's chip (R23)
// ============================================================
//
// `?tour=first` starts the tour, and goes from the address with the launch's
// other one-shot params. A first visit to an empty stage is offered the tour
// once, by a chip under the top bar, which goes once a song is on stage.
// Neither runs on the vocal remover's landing, which shares this entry. The
// tour and the coach load with import() (start-karaoke-tour.ts, mocked here).

const DEMO = {
  slug: 'opener',
  title: 'Opener',
  artist: 'The Band',
  attribution: {
    text: 'Music: "Opener" by The Band',
    url: 'https://example.invalid/opener',
    license: 'CC BY 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
  },
  stems: {
    vocal: 'https://example.invalid/opener/vocal.m4a',
    instrumental: 'https://example.invalid/opener/instrumental.m4a',
  },
}

/** Long enough for a lazy chunk the page asked for to have arrived. */
const settle = async (): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, 100))

describe("KaraokeNightApp and Merc's tour", () => {
  it('starts the tour from ?tour=first and drops the parameter', async () => {
    window.history.replaceState({}, '', '/karaoke?tour=first&zen=1')
    render(() => <KaraokeNightApp />)

    await waitFor(() => expect(tour.start).toHaveBeenCalledTimes(1))
    // An ad's landing waits for the consent bar (start-karaoke-tour.ts).
    expect(tour.start).toHaveBeenCalledWith({ afterConsent: true })
    expect(window.location.search).toBe('?zen=1')
    await settle()
    expect(screen.queryByTestId('tour-chip')).toBeNull()
  })

  it('offers the tour once on a first visit', async () => {
    window.history.replaceState({}, '', '/karaoke-night')
    render(() => <KaraokeNightApp />)

    expect(await screen.findByTestId('tour-chip')).toBeInTheDocument()
    expect(localStorage.getItem(KARAOKE_TOUR_OFFER_KEY)).toBe('true')
    expect(funnel.trackTour).toHaveBeenCalledWith('tour_offer', 'karaoke-night')
    expect(tour.start).not.toHaveBeenCalled()

    cleanup()
    render(() => <KaraokeNightApp />)
    await settle()
    expect(screen.queryByTestId('tour-chip')).toBeNull()
    expect(funnel.trackTour).toHaveBeenCalledTimes(1)
  })

  it('starts the tour from the chip at once, and puts the chip away', async () => {
    window.history.replaceState({}, '', '/karaoke-night')
    render(() => <KaraokeNightApp />)

    fireEvent.click(await screen.findByRole('button', { name: MERC_TOUR_LINE }))

    await waitFor(() => expect(tour.start).toHaveBeenCalledTimes(1))
    // The visitor asked: no wait for the consent bar.
    expect(tour.start).toHaveBeenCalledWith({ afterConsent: false })
    expect(screen.queryByTestId('tour-chip')).toBeNull()
  })

  it('offers the chip again when the tour does not load, with nothing unhandled', async () => {
    tour.start.mockRejectedValueOnce(new Error('chunk'))
    window.history.replaceState({}, '', '/karaoke-night')
    render(() => <KaraokeNightApp />)

    fireEvent.click(await screen.findByRole('button', { name: MERC_TOUR_LINE }))

    await waitFor(() => expect(tour.start).toHaveBeenCalledTimes(1))
    expect(await screen.findByTestId('tour-chip')).toBeInTheDocument()
  })

  it("leaves an ad's landing as it was when the tour does not load", async () => {
    tour.start.mockRejectedValueOnce(new Error('chunk'))
    window.history.replaceState({}, '', '/karaoke?tour=first')
    render(() => <KaraokeNightApp />)

    await waitFor(() => expect(tour.start).toHaveBeenCalledTimes(1))
    await settle()
    expect(window.location.search).toBe('')
  })

  it('puts the chip away for Not now, and starts nothing', async () => {
    window.history.replaceState({}, '', '/karaoke-night')
    render(() => <KaraokeNightApp />)

    fireEvent.click(await screen.findByRole('button', { name: 'Not now' }))

    expect(screen.queryByTestId('tour-chip')).toBeNull()
    await settle()
    expect(tour.start).not.toHaveBeenCalled()
  })

  it('takes the chip away once a song is on stage', async () => {
    demo.songs = [DEMO]
    window.history.replaceState({}, '', '/karaoke-night')
    const { container } = render(() => <KaraokeNightApp />)
    await screen.findByTestId('tour-chip')

    const hero = container.querySelector<HTMLElement>('.kn-hero')
    fireEvent.click(
      within(hero as HTMLElement).getByRole('button', {
        name: 'Sing this song',
      }),
    )

    await waitFor(() => expect(screen.queryByTestId('tour-chip')).toBeNull())
    expect(tour.start).not.toHaveBeenCalled()
  })

  it('offers nothing to a link that names a song', async () => {
    // A link is somebody sending a song: the stage is about to be taken.
    window.history.replaceState({}, '', '/karaoke-night?song=not-a-song')
    render(() => <KaraokeNightApp />)

    await settle()
    expect(screen.queryByTestId('tour-chip')).toBeNull()
    // Nothing was offered, so nothing is spent.
    expect(localStorage.getItem(KARAOKE_TOUR_OFFER_KEY)).toBeNull()
  })

  it("runs no tour on the vocal remover's page, and drops its parameter", async () => {
    window.history.replaceState({}, '', '/vocal-remover?tour=first')
    render(() => <KaraokeNightApp />)

    await waitFor(() => expect(window.location.search).toBe(''))
    await settle()
    expect(tour.start).not.toHaveBeenCalled()
    expect(screen.queryByTestId('tour-chip')).toBeNull()
  })

  it("names the hero's Sing this song for the tour's first stop", async () => {
    demo.songs = [DEMO]
    const { container } = render(() => <KaraokeNightApp />)

    const hero = container.querySelector<HTMLElement>('.kn-hero')
    const sing = await within(hero as HTMLElement).findByRole('button', {
      name: 'Sing this song',
    })
    expect(sing).toHaveAttribute('data-tour', 'karaoke.demo')
    // The rail's opener has a button by the same name; only the hero's is
    // the stop's, so the ring has one place to go.
    expect(
      container.querySelectorAll('[data-tour="karaoke.demo"]'),
    ).toHaveLength(1)
  })

  it("names the folded rail's Add a song for the tour's last stop", () => {
    localStorage.setItem('pitchperfect_kn_rail_collapsed', 'true')
    render(() => <KaraokeNightApp />)

    expect(screen.getByTitle('Add a song')).toHaveAttribute(
      'data-tour',
      'karaoke.own-song',
    )
  })
})
