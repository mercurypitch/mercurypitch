// ============================================================
// First Light names the stores on the Map, and only there
// ============================================================
//
// The Keep beat's account offer, shown over the twin portrait, is where
// nearly every paid sign-up comes from, so no link out of the app may sit
// before it. The Map comes after Keep on every track and is the last
// screen, so the store chips go there: under the rooms, the button and the
// account line, never above them.

import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BeatMap } from '@/features/onboarding/beats/BeatMap'
import { FirstLight } from '@/features/onboarding/FirstLight'
import type * as OnboardingFunnelModule from '@/features/onboarding/funnel'
import type * as NativeBuild from '@/lib/native-build'
import { STORE_PREVIEW_VIDEO_URL } from '@/lib/store-listings'
import type { OpenResult, ProbeResult, VoiceSession } from '@/lib/voice-session'
import { openBeat, resetOnboarding } from '@/stores/onboarding-store'

const build = vi.hoisted(() => ({ native: false }))
vi.mock('@/lib/native-build', async (importOriginal) => ({
  ...(await importOriginal<typeof NativeBuild>()),
  get IS_NATIVE_BUILD() {
    return build.native
  },
}))

const mocks = vi.hoisted(() => ({ trackOnboarding: vi.fn() }))

// Only the counter is replaced: BEAT_EVENT and MAP_STORE_EVENT are the
// flow's own tables, and the test is that the flow sends the Map's names.
vi.mock('@/features/onboarding/funnel', async (importOriginal) => {
  const actual = await importOriginal<typeof OnboardingFunnelModule>()
  return { ...actual, trackOnboarding: mocks.trackOnboarding }
})

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

const noop = (): void => {}

function renderMap(): HTMLElement {
  const { container } = render(() => (
    <BeatMap
      voiceprint={null}
      onEnter={noop}
      onTour={noop}
      onDone={noop}
      onKeep={noop}
    />
  ))
  const map = container.querySelector<HTMLElement>('[data-beat="map"]')
  if (map === null) throw new Error('no map beat')
  return map
}

/** True when `a` comes before `b` in document order. */
const precedes = (a: Element, b: Element): boolean =>
  (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0

beforeEach(() => {
  build.native = false
})
afterEach(cleanup)

describe('the store chips on the Map', () => {
  it('shows both coming-soon chips, each opening the video', () => {
    const map = renderMap()
    const chips = [...map.querySelectorAll('a[data-store]')]
    expect(chips.map((c) => c.getAttribute('data-store'))).toEqual([
      'app-store',
      'google-play',
    ])
    for (const chip of chips) {
      expect(chip).toHaveAttribute('href', STORE_PREVIEW_VIDEO_URL)
      expect(chip).toHaveTextContent(/coming soon/i)
    }
  })

  it('sits after every room, the button and the account line', () => {
    const map = renderMap()
    const firstChip = map.querySelector('a[data-store]')
    const lastRoom = [...map.querySelectorAll('[data-room]')].at(-1)
    const start = [...map.querySelectorAll('button')].find(
      (b) => b.textContent === 'Start singing',
    )
    const keep = [...map.querySelectorAll('button')].find(
      (b) => b.textContent === 'Save it to a free account',
    )
    if (!firstChip || !lastRoom || !start || !keep) {
      throw new Error('the Map is missing a piece')
    }
    expect(precedes(lastRoom, firstChip)).toBe(true)
    expect(precedes(start, firstChip)).toBe(true)
    expect(precedes(keep, firstChip)).toBe(true)
  })

  it('is not on the Map inside the native app', () => {
    build.native = true
    const map = renderMap()
    expect(map.querySelector('a[data-store]')).toBeNull()
    expect(map).not.toHaveTextContent(/google play/i)
    expect(map).not.toHaveTextContent(/app store/i)
  })
})

describe('a store chip click on the Map', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetOnboarding()
    // jsdom ships no matchMedia; the star field asks for reduced-motion.
    vi.stubGlobal('matchMedia', () => ({
      matches: false,
      addEventListener: () => {},
      removeEventListener: () => {},
    }))
  })

  afterEach(() => {
    // Unmount before the stub goes: the star field asks on its way out.
    cleanup()
    vi.unstubAllGlobals()
    resetOnboarding()
  })

  it('hands the store to the flow', () => {
    const onStoreClick = vi.fn()
    render(() => (
      <BeatMap
        voiceprint={null}
        onEnter={noop}
        onTour={noop}
        onDone={noop}
        onStoreClick={onStoreClick}
      />
    ))
    fireEvent.click(
      screen.getByRole('link', { name: /^Coming soon: App Store/ }),
    )
    expect(onStoreClick).toHaveBeenCalledWith('app-store')
  })

  it("counts each store under First Light's own Map names", async () => {
    render(() => <FirstLight />)
    openBeat('map')
    const appStore = await screen.findByRole('link', {
      name: /^Coming soon: App Store/,
    })
    mocks.trackOnboarding.mockClear()

    fireEvent.click(appStore)
    fireEvent.click(
      screen.getByRole('link', { name: /^Coming soon: Google Play/ }),
    )

    expect(mocks.trackOnboarding.mock.calls).toEqual([
      ['onboarding_map_app_store_tap'],
      ['onboarding_map_google_play_tap'],
    ])
  })
})
