// ============================================================
// The carrier on AirPlay alone: it stands aside, and comes back after
// ============================================================
//
// Over AirPlay to an LG C2, Web Audio alone reached the TV, and Web Audio
// beside a silent element kept local did not (the Developer screen's
// AirPlay sound check, 6 Nov 2026). So while the app says the sound goes to
// AirPlay alone, the carrier is paused by a pause of ours, muted, and
// played by nothing; as the sound leaves AirPlay with the song playing, it
// takes its place again. The stand-ins are the lock screen tests' own
// (webkit-now-playing.fixture.ts).

import type { Mock, MockInstance } from 'vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ONCE_MORE_MS } from './carrier-in-front'
import type { Carrier, WebKitAction, WebKitSong } from './webkit-now-playing'
import { claimCarrier, listenOnWebKit, onCarrierHolding, resetWebKitNowPlaying, showOnWebKit, standCarrierAside, takeTheSound, } from './webkit-now-playing'
import { FakeCarrier, FakeMetadata, FakePage, fakeSession, } from './webkit-now-playing.fixture'

const ACTIONS: readonly WebKitAction[] = ['play', 'pause', 'stop', 'seekto']

const song = (changes: Partial<WebKitSong> = {}): WebKitSong => ({
  title: 'Harbour Lights',
  artist: 'The Wharf',
  artwork: null,
  playing: true,
  position: 121,
  duration: 246,
  rate: 1,
  ...changes,
})

let carrier: FakeCarrier
let page: FakePage
let info: MockInstance<(...data: unknown[]) => void>
/** What the room hears: a press, or the system's own pause and play. */
let pressed: Mock<(action: WebKitAction, details: object) => void>
let fromSystem: Mock<(action: 'play' | 'pause') => void>

/** A song that plays, its carrier sounding under it. */
function playingSong(): void {
  showOnWebKit(song())
  carrier.settle()
}

beforeEach(() => {
  carrier = new FakeCarrier()
  page = new FakePage()
  FakeMetadata.made = 0
  FakeMetadata.refuseNext = false
  vi.stubGlobal('navigator', { mediaSession: fakeSession() })
  vi.stubGlobal('MediaMetadata', FakeMetadata)
  info = vi.spyOn(console, 'info').mockImplementation(() => undefined)
  resetWebKitNowPlaying({
    createCarrier: () => carrier as unknown as Carrier,
    silence: () => 'blob:silence',
    now: () => 0,
    page,
  })
  pressed = vi.fn<(action: WebKitAction, details: object) => void>()
  fromSystem = vi.fn<(action: 'play' | 'pause') => void>()
  listenOnWebKit(ACTIONS, pressed, fromSystem)
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('standing aside on AirPlay', () => {
  it('pauses and mutes a carrier that plays, and the song plays on', () => {
    playingSong()

    standCarrierAside(true)
    carrier.settle()

    expect(carrier.paused).toBe(true)
    expect(carrier.muted).toBe(true)
    // A pause of ours, never the system's: the song is not paused with it.
    expect(fromSystem).not.toHaveBeenCalled()
    expect(pressed).not.toHaveBeenCalled()
  })

  it('never plays the carrier for a song reported while it stands aside', () => {
    standCarrierAside(true)

    showOnWebKit(song())
    showOnWebKit(song({ position: 140 }))
    carrier.settle()

    expect(carrier.play).not.toHaveBeenCalled()
    expect(carrier.paused).toBe(true)
  })

  it('keeps a press of play from playing it, and lets the press go on', () => {
    playingSong()
    showOnWebKit(song({ playing: false }))
    carrier.settle()
    standCarrierAside(true)

    claimCarrier()
    const goesOn = takeTheSound({ otherAudio: true })
    carrier.settle()

    expect(goesOn).toBe(true)
    expect(carrier.play).toHaveBeenCalledTimes(1)
    expect(carrier.paused).toBe(true)
  })

  it('never puts it in front of the song’s clock while it stands aside', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    playingSong()
    standCarrierAside(true)
    carrier.settle()

    page.turn('hidden')()
    showOnWebKit(song({ position: 130 }))
    vi.advanceTimersByTime(ONCE_MORE_MS * 2)

    expect(carrier.play).toHaveBeenCalledTimes(1)
    expect(carrier.paused).toBe(true)
  })

  it('never plays it again to stay in front in the moment WebKit has it playing', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    playingSong()
    standCarrierAside(true)
    carrier.settle()
    void carrier.play()

    // The page hides before WebKit's play has been heard.
    page.turn('hidden')()
    vi.advanceTimersByTime(ONCE_MORE_MS * 2)

    expect(carrier.play).toHaveBeenCalledTimes(2)
  })

  it('puts back a play of WebKit’s own, and the song hears nothing of it', () => {
    playingSong()
    standCarrierAside(true)
    carrier.settle()

    // WebKit plays a suspended carrier as the app comes back.
    void carrier.play()
    carrier.settle()
    carrier.settle()

    expect(carrier.paused).toBe(true)
    expect(fromSystem).not.toHaveBeenCalled()
  })

  it('gives the session back, so the unlock clip is not told the carrier holds it', () => {
    const holds = vi.fn()
    onCarrierHolding(holds)
    playingSong()

    standCarrierAside(true)

    expect(holds.mock.calls).toEqual([[true], [false]])
  })

  it('never says the carrier holds the session for a play of WebKit’s own', () => {
    const holds = vi.fn()
    onCarrierHolding(holds)
    playingSong()
    standCarrierAside(true)
    carrier.settle()

    void carrier.play()
    carrier.settle()
    carrier.settle()

    expect(holds.mock.calls).toEqual([[true], [false]])
  })

  it('keeps the short carrier paused when the long one will not load', () => {
    carrier.flac = 'maybe'
    playingSong()
    standCarrierAside(true)
    carrier.settle()
    carrier.play.mockClear()

    carrier.dispatchEvent(new Event('error'))

    expect(carrier.play).not.toHaveBeenCalled()
    expect(carrier.paused).toBe(true)
  })
})

describe('taking its place again', () => {
  it('unmutes and plays the carrier as the sound leaves AirPlay with the song playing', () => {
    const holds = vi.fn()
    onCarrierHolding(holds)
    playingSong()
    standCarrierAside(true)
    carrier.settle()

    standCarrierAside(false)
    carrier.settle()

    expect(carrier.muted).toBe(false)
    expect(carrier.paused).toBe(false)
    expect(carrier.play).toHaveBeenCalledTimes(2)
    // Sounding again, it holds the session, and the lock screen has the song.
    expect(holds.mock.calls).toEqual([[true], [false], [true]])
  })

  it('gives a song first played on AirPlay its carrier as the sound leaves', () => {
    standCarrierAside(true)
    showOnWebKit(song())
    expect(carrier.hasAttribute('src')).toBe(false)

    standCarrierAside(false)

    expect(carrier.src).toBe('blob:silence')
    expect(carrier.play).toHaveBeenCalledTimes(1)
  })

  it('leaves a paused song’s carrier paused, unmuted for its next play', () => {
    playingSong()
    showOnWebKit(song({ playing: false }))
    standCarrierAside(true)

    standCarrierAside(false)
    carrier.settle()

    expect(carrier.play).toHaveBeenCalledTimes(1)
    expect(carrier.paused).toBe(true)
    expect(carrier.muted).toBe(false)
  })

  it('hears the system’s pause again once it is back', () => {
    playingSong()
    standCarrierAside(true)
    carrier.settle()
    standCarrierAside(false)
    carrier.settle()

    carrier.interrupt()
    carrier.settle()

    expect(fromSystem.mock.calls).toEqual([['pause']])
  })
})

describe('the console', () => {
  it('says each change once', () => {
    playingSong()
    info.mockClear()

    standCarrierAside(true)
    standCarrierAside(true)
    standCarrierAside(false)
    standCarrierAside(false)

    const lines = info.mock.calls.map(([line]) => String(line))
    expect(lines).toEqual([
      "[now playing] the sound is on AirPlay: the carrier stands aside, so the room's sound plays alone",
      '[now playing] the sound has left AirPlay: the carrier takes its place again, and the lock screen shows the song',
    ])
  })
})
