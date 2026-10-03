// ============================================================
// A phone on its side gets the phone stage, and keeps playing
// ============================================================
//
// An 844x390 phone held sideways is wider than the 768 px breakpoint, so the
// width-only check handed it the desktop mixer: a 504 px rail squeezed under
// a header on a screen 390 px tall (owner decision 2, 2 October 2026). Short
// touch screens held sideways now get the phone stage, and turning the phone
// must not stop the song, the way a width change never did.
//
// The match is mocked rather than driven through matchMedia because the
// viewport accessors are module-level singletons read at import time (see
// src/lib/use-viewport.test.ts for the query itself).

import { fireEvent, render, screen } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

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

const viewport = vi.hoisted(() => ({
  turn: (_sideways: boolean): void => {},
}))

vi.mock('@/lib/use-viewport', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  const { createSignal } = await import('solid-js')
  const [sideways, setSideways] = createSignal(false)
  viewport.turn = (next) => {
    setSideways(next)
  }
  return {
    ...actual,
    isNarrow: () => false,
    isMobile: () => true,
    isShortTouchLandscape: sideways,
  }
})

// The silent <audio> that unlocks playback on iOS is a browser concern, and
// jsdom cannot play it.
vi.mock('@/lib/audio-unlock', () => ({
  installAudioUnlock: () => () => undefined,
  unlockAudio: () => undefined,
}))

import { StemMixer } from '@/components/StemMixer'
import { resetNotifications } from '@/stores/notifications-store'

beforeEach(() => {
  viewport.turn(false)
  resetNotifications()
  localStorage.clear()
  Element.prototype.scrollTo = vi.fn()
  Element.prototype.scrollIntoView = vi.fn()
  ;(
    AudioContext.prototype as unknown as Record<string, unknown>
  ).decodeAudioData = async () =>
    ({
      duration: 30,
      length: 512,
      numberOfChannels: 2,
      sampleRate: 44100,
      getChannelData: () => new Float32Array(512),
    }) as unknown as AudioBuffer
  // The shared mock context has no buffer sources, and Play needs them.
  ;(
    AudioContext.prototype as unknown as Record<string, unknown>
  ).createBufferSource = () => ({
    buffer: null,
    playbackRate: { value: 1 },
    onended: null,
    connect: vi.fn(),
    disconnect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
  })
  vi.stubGlobal('fetch', async () => ({
    ok: true,
    status: 200,
    body: null,
    headers: new Headers(),
    arrayBuffer: async () => new ArrayBuffer(64),
  }))
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

const stageShown = (): 'phone' | 'desktop' | 'none' =>
  screen.queryByTestId('karaoke-mobile-stage') !== null
    ? 'phone'
    : screen.queryByTestId('mixer-capsule') !== null
      ? 'desktop'
      : 'none'

const isPlaying = (): boolean =>
  screen.queryByRole('button', { name: 'Pause' }) !== null

/** The mixer, loaded at a width that is not narrow, playing. */
async function mountPlaying(): Promise<void> {
  render(() => (
    <StemMixer
      stems={{ vocal: 'blob:vocal', instrumental: 'blob:instrumental' }}
      sessionId="sideways"
      songTitle="Consent"
    />
  ))
  await screen.findByRole('button', { name: 'Set loop start (A)' })
  fireEvent.click(screen.getByRole('button', { name: 'Play' }))
  await screen.findByRole('button', { name: 'Pause' })
}

/** The mixer, mounted as UvrPanel mounts it: with a tour to offer. */
function mountOffering(): Array<'mount' | 'button'> {
  const offers: Array<'mount' | 'button'> = []
  render(() => (
    <StemMixer
      stems={{ vocal: 'blob:vocal', instrumental: 'blob:instrumental' }}
      sessionId="sideways-tour"
      songTitle="Consent"
      onOfferTour={(trigger) => offers.push(trigger)}
    />
  ))
  return offers
}

describe('the mixer tour offer', () => {
  // The tour points at the desktop mixer. On the phone stage it had nothing
  // to show, and its toast sat over the scrubber (360x780: y 663-721 against
  // the slider at 646-690), and it used up the one-time offer doing so.

  it('is made as the mixer mounts', async () => {
    const offers = mountOffering()
    await screen.findByRole('button', { name: 'Set loop start (A)' })

    expect(offers).toEqual(['mount'])
  })

  it('is not made on the phone stage', async () => {
    viewport.turn(true)
    const offers = mountOffering()
    await screen.findByRole('button', { name: 'Play' })

    expect([stageShown(), offers]).toEqual(['phone', []])
  })

  it('waits for the mixer to show, then is made once', async () => {
    viewport.turn(true)
    const offers = mountOffering()
    await screen.findByRole('button', { name: 'Play' })
    const counts = [offers.length]

    viewport.turn(false)
    counts.push(offers.length)
    viewport.turn(true)
    viewport.turn(false)
    counts.push(offers.length)

    expect(counts).toEqual([0, 1, 1])
  })
})

describe('turning a phone on its side', () => {
  it('swaps the desktop mixer for the phone stage, and back', async () => {
    await mountPlaying()
    const seen = [stageShown()]

    viewport.turn(true)
    seen.push(stageShown())
    viewport.turn(false)
    seen.push(stageShown())

    expect(seen).toEqual(['desktop', 'phone', 'desktop'])
  })

  it('keeps the song playing through both turns', async () => {
    await mountPlaying()

    viewport.turn(true)
    const onItsSide = [stageShown(), isPlaying()]
    viewport.turn(false)

    expect([onItsSide, [stageShown(), isPlaying()]]).toEqual([
      ['phone', true],
      ['desktop', true],
    ])
  })
})
