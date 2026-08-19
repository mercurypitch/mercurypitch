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
})

afterEach(() => {
  vi.clearAllMocks()
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
  it('shows the zen stage, and the music level on it', () => {
    // THE REGRESSION. Pre-fix the only music-level control was in the mixer
    // header, and the header is not rendered at all down here.
    mountPhone()
    expect(screen.getByTestId('mobile-music-level-toggle')).toBeTruthy()
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

  it('opens a slider carrying the stored bounds', () => {
    // The slider speaks percentages of the shipped level; the store speaks
    // gain. Both bounds are the store's own, divided by its default, so a
    // ceiling raised in the store shows up here without a second edit.
    mountPhone()
    fireEvent.click(screen.getByTestId('mobile-music-level-toggle'))
    const slider = screen.getByTestId('mobile-music-level') as HTMLInputElement
    const percent = (value: number): string =>
      String(Math.round((value / MUSIC_LEVEL.spec.defaultValue) * 100))
    expect(slider.min).toBe(percent(MUSIC_LEVEL.spec.min))
    expect(slider.max).toBe(percent(MUSIC_LEVEL.spec.max))
    expect(slider.value).toBe('100')
  })

  it('writes the moved level through to storage', () => {
    // End to end: the slider is bound to the audio controller's setter, which
    // clamps and persists. A control wired to a local signal would look
    // identical on screen and forget the value on the next song. The stored
    // number is gain — 150% of the shipped 0.7 — not the percentage.
    mountPhone()
    fireEvent.click(screen.getByTestId('mobile-music-level-toggle'))
    fireEvent.input(screen.getByTestId('mobile-music-level'), {
      target: { value: '150' },
    })
    expect(localStorage.getItem(MUSIC_LEVEL.spec.storageKey)).toBe('1.05')
    expect(
      (screen.getByTestId('mobile-music-level') as HTMLInputElement).value,
    ).toBe('150')
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
