// ============================================================
// On a phone, the music level is on screen — the whole point
// ============================================================
//
// The first cut put the level slider in the mixer's header, and the report
// came straight back: "the slider is basically only visible on desktop in top
// of the stem mixer... the one place it is needed, can't see it, since stem
// mixer isn't visible on mobile small screens, only the zen mode."
//
// That is a wiring bug, and wiring bugs hide from unit tests of either end.
// `KaraokeMobileStage.musicLevel.test.tsx` proves the control works when it is
// handed the props; `mixer-music-level.test.ts` proves the mixer names them.
// Neither would have caught a header-only slider. So this mounts the mixer
// whole at phone width — the exact configuration that was broken — and looks
// for the control the way a thumb would.
//
// The narrow match is mocked rather than driven through matchMedia because
// `isNarrow` is a module-level singleton read at import time; a media query
// changed afterwards cannot reach it.

import { fireEvent, render, screen, waitFor } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MUSIC_LEVEL } from '@/features/stem-mixer/master-headroom'
import { dragPill, tapPill } from '@/tests/helpers/pill-drag'

window.matchMedia = ((query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addEventListener: () => {},
  removeEventListener: () => {},
  addListener: () => {},
  removeListener: () => {},
  dispatchEvent: () => false,
})) as unknown as typeof window.matchMedia

vi.mock('@/lib/use-viewport', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  isNarrow: () => true,
  isMobile: () => true,
}))

const notes = vi.hoisted(() => ({ shown: [] as string[] }))

vi.mock('@/stores/notifications-store', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return {
    ...actual,
    showNotification: (message: string, kind?: string) => {
      notes.shown.push(message)
      return (actual.showNotification as (m: string, k?: string) => unknown)(
        message,
        kind,
      )
    },
  }
})

import { StemMixer } from '@/components/StemMixer'

beforeEach(() => {
  notes.shown = []
  localStorage.clear()
  Element.prototype.scrollTo = vi.fn()
  Element.prototype.scrollIntoView = vi.fn()
  // The mixer loads its stems on mount. The URLs below are fixtures, not real
  // object URLs, so the loader has to be handed a Response rather than left to
  // reach the network: `blob:vocal` was never minted by `createObjectURL`, and
  // undici rejects it with `invalid method` — after this test has already
  // ended, which is why it read as unattributed CI noise on green runs.
  // `body: null` takes fetch-progress's atomic-read path.
  vi.stubGlobal('fetch', async () => ({
    ok: true,
    status: 200,
    body: null,
    headers: new Headers(),
    arrayBuffer: async () => new ArrayBuffer(64),
  }))
})

afterEach(() => {
  vi.clearAllMocks()
  vi.unstubAllGlobals()
})

function mountPhone(): void {
  render(() => (
    <StemMixer
      stems={{ vocal: 'blob:vocal', instrumental: 'blob:instrumental' }}
      sessionId="session-1"
      songTitle="Consent"
    />
  ))
}

describe('the mixer at phone width', () => {
  const pill = (): HTMLElement => screen.getByTestId('mobile-music-level')

  it('shows the zen stage, and the music level on it', () => {
    // THE REGRESSION. Pre-fix the only music-level control was in the mixer
    // header, and the header is not rendered at all down here.
    mountPhone()
    expect(pill()).toBeTruthy()
  })

  it('offers exactly one of them, not two', () => {
    // The phone tree must not sprout a second copy of the control while the
    // first one moves. That the DESKTOP header lost its slider is asserted
    // against the source in `src/tests/mixer-music-level.test.ts` — the
    // header is not rendered at this width, so nothing here could see it.
    mountPhone()
    expect(screen.getAllByLabelText('Music level')).toHaveLength(1)
    expect(screen.queryByTestId('mixer-music-level')).toBeNull()
  })

  it('carries the stored bounds, in percentages of the shipped level', () => {
    // The control speaks percentages; the store speaks gain. Both bounds are
    // the store's own, divided by its default, so a ceiling raised in the
    // store shows up here without a second edit.
    mountPhone()
    tapPill(pill())
    const percent = (value: number): number =>
      Math.round((value / MUSIC_LEVEL.spec.defaultValue) * 100)
    expect(pill().textContent).toContain('100%')

    fireEvent.keyDown(pill(), { key: 'End' })
    expect(pill().textContent).toContain(`${percent(MUSIC_LEVEL.spec.max)}%`)
    fireEvent.keyDown(pill(), { key: 'Home' })
    expect(pill().textContent).toContain(`${percent(MUSIC_LEVEL.spec.min)}%`)
  })

  it('writes the moved level through to storage', () => {
    // End to end: the pill is bound to the audio controller's setter, which
    // clamps and persists. A control wired to a local signal would look
    // identical on screen and forget the value on the next song. The stored
    // number is gain — 150% of the shipped 0.7 — not the percentage. 24px of
    // the pill's 120px travel is a fifth of a 0.35..2.1 range, from a resting
    // fifth: 0.4 of the way up, which is 1.05.
    mountPhone()
    dragPill(pill(), 200, 176)
    expect(localStorage.getItem(MUSIC_LEVEL.spec.storageKey)).toBe('1.05')
    expect(pill().textContent).toContain('150%')
  })

  it('leaves the transport where it was when the level opens', () => {
    // The report that sent this control back: "on my tablet it conceals all
    // playback commands, and none are reachable". jsdom has no layout to
    // measure, so the guarantee is structural — the pill is positioned out of
    // the flow, and the bar cannot grow to fit something that is not in it.
    mountPhone()
    const bar = screen.getByLabelText('Toggle your microphone').parentElement
      ?.parentElement as HTMLElement
    expect(bar.contains(pill())).toBe(true)
    expect(pill().className).toMatch(/levelPill/)
    expect(pill().parentElement?.className).toMatch(/levelAnchor/)
  })
})

describe('the note the first time the mic goes on', () => {
  it('names noise cancelling and points at the button beside the mic', async () => {
    // Reported on the first wording: "it currently says that we lose a
    // backing track or whatever, but its not what happens, the volume is just
    // reduced in a typical noise cancelling scenario". The app does no
    // ducking of its own — audited — so the note has to describe the platform
    // and then point at the control, which is now a button, not a slider up
    // in a header the phone never sees.
    mountPhone()
    fireEvent.click(screen.getByLabelText('Toggle your microphone'))

    await waitFor(() => {
      expect(notes.shown.join('\n')).toMatch(/noise cancelling/)
    })
    const note = notes.shown.find((m) => /noise cancelling/.test(m))!
    expect(note).toContain('turns the backing track down')
    expect(note).toContain('music button next to the mic')
    expect(note).not.toMatch(/up top/)
  })

  it('says it once and never again', async () => {
    // A notification every time the mic opens is noise; the singer needs
    // telling where the button is exactly once, ever.
    mountPhone()
    const mic = screen.getByLabelText('Toggle your microphone')
    fireEvent.click(mic)
    await waitFor(() => {
      expect(
        notes.shown.filter((m) => /noise cancelling/.test(m)),
      ).toHaveLength(1)
    })

    fireEvent.click(mic)
    await waitFor(() => {
      expect(screen.getByLabelText('Toggle your microphone')).toBeTruthy()
    })
    fireEvent.click(mic)
    await waitFor(() => {
      expect(
        notes.shown.filter((m) => /noise cancelling/.test(m)),
      ).toHaveLength(1)
    })
  })
})
