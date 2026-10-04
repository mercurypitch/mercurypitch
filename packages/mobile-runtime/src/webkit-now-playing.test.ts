// ============================================================
// Now Playing through WebKit: the carrier, the bar and the buttons
// ============================================================
//
// Node has no media element and no navigator.mediaSession, so both are
// stand-ins: a carrier that keeps `paused` and fires play, pause and seeked
// as an `<audio>` does, and a session that keeps what it was told.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Carrier, WebKitAction, WebKitSong } from './webkit-now-playing'
import { listenOnWebKit, resetWebKitNowPlaying, showOnWebKit, silentWav, webKitNowPlayingAvailable, } from './webkit-now-playing'

/** An `<audio>` element, as far as the carrier uses one. */
class FakeCarrier extends EventTarget {
  loop = false
  preload = ''
  disableRemotePlayback = false
  paused = true
  private source: string | null = null

  readonly play = vi.fn(async () => {
    if (!this.paused) return
    this.paused = false
    this.dispatchEvent(new Event('play'))
  })

  readonly pause = vi.fn(() => {
    if (this.paused) return
    this.paused = true
    this.dispatchEvent(new Event('pause'))
  })

  readonly load = vi.fn()

  get src(): string {
    return this.source ?? ''
  }

  set src(value: string) {
    this.source = value
  }

  hasAttribute(name: string): boolean {
    return name === 'src' && this.source !== null
  }

  removeAttribute(name: string): void {
    if (name === 'src') this.source = null
  }

  /** What WebKit does when another app takes the sound, or a call comes. */
  interrupt(): void {
    this.paused = true
    this.dispatchEvent(new Event('pause'))
  }

  /** What WebKit does when a call ends with the system's word to resume. */
  resumeAfterInterruption(): void {
    this.paused = false
    this.dispatchEvent(new Event('play'))
  }

  /** The loop going back to its start. */
  goRound(): void {
    this.dispatchEvent(new Event('seeked'))
  }
}

class FakeMetadata {
  static made = 0
  readonly title: string
  readonly artist: string
  readonly artwork: readonly { readonly src: string }[]

  constructor(init: {
    title: string
    artist: string
    artwork: readonly { readonly src: string }[]
  }) {
    FakeMetadata.made += 1
    this.title = init.title
    this.artist = init.artist
    this.artwork = init.artwork
  }
}

function fakeSession() {
  return {
    metadata: null as FakeMetadata | null,
    playbackState: 'none',
    setPositionState: vi.fn(),
    setActionHandler: vi.fn(),
  }
}

const ACTIONS: readonly WebKitAction[] = ['play', 'pause', 'stop', 'seekto']
const PICTURE = 'data:image/webp;base64,AQID'

const song = (changes: Partial<WebKitSong> = {}): WebKitSong => ({
  title: 'Harbour Lights',
  artist: 'The Wharf',
  artwork: PICTURE,
  playing: true,
  position: 121,
  duration: 246,
  rate: 1,
  ...changes,
})

let session: ReturnType<typeof fakeSession>
let carrier: FakeCarrier
let clock = 0

beforeEach(() => {
  session = fakeSession()
  carrier = new FakeCarrier()
  clock = 0
  FakeMetadata.made = 0
  vi.stubGlobal('navigator', { mediaSession: session })
  vi.stubGlobal('MediaMetadata', FakeMetadata)
  vi.spyOn(console, 'info').mockImplementation(() => undefined)
  resetWebKitNowPlaying({
    createCarrier: () => carrier as unknown as Carrier,
    silence: () => 'blob:silence',
    now: () => clock,
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('a song on the lock screen', () => {
  it('names the song, places the bar and plays the carrier under it', () => {
    showOnWebKit(song())

    expect(session.metadata).toMatchObject({
      title: 'Harbour Lights',
      artist: 'The Wharf',
      artwork: [{ src: PICTURE }],
    })
    expect(session.playbackState).toBe('playing')
    expect(session.setPositionState).toHaveBeenLastCalledWith({
      duration: 246,
      playbackRate: 1,
      position: 121,
    })
    expect(carrier.src).toBe('blob:silence')
    expect(carrier.loop).toBe(true)
    expect(carrier.disableRemotePlayback).toBe(true)
    expect(carrier.play).toHaveBeenCalledTimes(1)
    expect(carrier.paused).toBe(false)
  })

  it('pauses the carrier with the song, and keeps the song on the lock screen', () => {
    showOnWebKit(song())
    showOnWebKit(song({ playing: false, position: 130, rate: 0.75 }))

    expect(session.playbackState).toBe('paused')
    // The paused state stops the bar; the speed stays for when it plays.
    expect(session.setPositionState).toHaveBeenLastCalledWith({
      duration: 246,
      playbackRate: 0.75,
      position: 130,
    })
    expect(carrier.paused).toBe(true)
    // Still loaded: a carrier that has played keeps the song, and its play
    // button, on the lock screen.
    expect(carrier.hasAttribute('src')).toBe(true)
    expect(carrier.load).not.toHaveBeenCalled()
  })

  it('shows nothing for a song that has never played', () => {
    showOnWebKit(song({ playing: false }))

    expect(carrier.play).not.toHaveBeenCalled()
    expect(carrier.hasAttribute('src')).toBe(false)
  })

  it('names the song once, however often its bar moves', () => {
    showOnWebKit(song())
    showOnWebKit(song({ position: 150 }))
    showOnWebKit(song({ playing: false }))
    expect(FakeMetadata.made).toBe(1)

    showOnWebKit(song({ title: 'Low Tide', artist: 'Unknown artist' }))
    expect(FakeMetadata.made).toBe(2)
    expect(session.metadata).toMatchObject({
      title: 'Low Tide',
      artist: 'Unknown artist',
    })
  })

  it('names a song without a picture', () => {
    showOnWebKit(song({ artwork: null }))

    expect(session.metadata?.artwork).toEqual([])
  })

  it('puts everything away when the song is gone', () => {
    const deliver = vi.fn()
    listenOnWebKit(ACTIONS, deliver)
    showOnWebKit(song())

    showOnWebKit(null)

    expect(session.metadata).toBeNull()
    expect(session.playbackState).toBe('none')
    expect(session.setPositionState).toHaveBeenLastCalledWith()
    expect(carrier.paused).toBe(true)
    expect(carrier.hasAttribute('src')).toBe(false)
    expect(carrier.load).toHaveBeenCalledTimes(1)
    // Its own pause, not the system's: the room hears nothing.
    expect(deliver).not.toHaveBeenCalled()
  })

  it('plays the next song after one was put away', () => {
    showOnWebKit(song())
    showOnWebKit(null)

    showOnWebKit(song({ title: 'Low Tide' }))

    expect(carrier.src).toBe('blob:silence')
    expect(carrier.play).toHaveBeenCalledTimes(2)
    expect(session.metadata).toMatchObject({ title: 'Low Tide' })
  })

  it('still plays the carrier when WebKit refuses the bar', () => {
    session.setPositionState.mockImplementation(() => {
      throw new TypeError('The position is beyond the duration')
    })

    showOnWebKit(song())

    expect(session.playbackState).toBe('playing')
    expect(carrier.play).toHaveBeenCalledTimes(1)
  })

  it('leaves the song alone when the carrier will not play', async () => {
    const deliver = vi.fn()
    listenOnWebKit(ACTIONS, deliver)
    carrier.play.mockRejectedValueOnce(
      new DOMException('Not now', 'NotAllowedError'),
    )

    expect(() => {
      showOnWebKit(song())
    }).not.toThrow()
    await vi.waitFor(() => {
      expect(console.info).toHaveBeenCalledWith(
        '[now playing] the carrier would not play:',
        'NotAllowedError',
      )
    })
    expect(deliver).not.toHaveBeenCalled()
  })

  it('makes its own silence when given none', () => {
    resetWebKitNowPlaying({
      createCarrier: () => carrier as unknown as Carrier,
    })

    showOnWebKit(song())

    expect(carrier.src).toMatch(/^blob:/u)
  })
})

describe('the carrier going round', () => {
  // WebKit moves the session's place to the carrier's own on every seek of
  // it, the loop included. The song's place has to go straight back.

  it('puts the bar back where the song is now', () => {
    showOnWebKit(song({ position: 10, duration: 200 }))
    clock = 4000

    carrier.goRound()

    expect(session.setPositionState).toHaveBeenLastCalledWith({
      duration: 200,
      playbackRate: 1,
      position: 14,
    })
  })

  it('runs the place on at the song’s speed, and never past its end', () => {
    showOnWebKit(song({ position: 10, duration: 200, rate: 1.5 }))
    clock = 4000
    carrier.goRound()
    expect(session.setPositionState).toHaveBeenLastCalledWith({
      duration: 200,
      playbackRate: 1.5,
      position: 16,
    })

    showOnWebKit(song({ position: 198, duration: 200 }))
    clock = 8000
    carrier.goRound()
    expect(session.setPositionState).toHaveBeenLastCalledWith({
      duration: 200,
      playbackRate: 1,
      position: 200,
    })
  })

  it('holds a paused song where it stopped', () => {
    showOnWebKit(song({ playing: false, position: 50 }))
    clock = 10_000

    carrier.goRound()

    expect(session.setPositionState).toHaveBeenLastCalledWith({
      duration: 246,
      playbackRate: 1,
      position: 50,
    })
  })
})

describe('what the system does to the song', () => {
  it('pauses the song when the system pauses the carrier', () => {
    const deliver = vi.fn()
    listenOnWebKit(ACTIONS, deliver)
    showOnWebKit(song())

    carrier.interrupt()

    expect(deliver.mock.calls).toEqual([['pause', {}]])
  })

  it('hears nothing from a pause or a play the song asked for', () => {
    const deliver = vi.fn()
    listenOnWebKit(ACTIONS, deliver)

    showOnWebKit(song())
    showOnWebKit(song({ playing: false }))
    showOnWebKit(song())

    expect(carrier.play).toHaveBeenCalledTimes(2)
    expect(deliver).not.toHaveBeenCalled()
  })

  it('plays the song again when the system resumes the carrier', () => {
    const deliver = vi.fn()
    listenOnWebKit(ACTIONS, deliver)
    showOnWebKit(song())
    carrier.interrupt()
    // The room paused, as it was asked to.
    showOnWebKit(song({ playing: false }))

    carrier.resumeAfterInterruption()

    expect(deliver.mock.calls).toEqual([
      ['pause', {}],
      ['play', {}],
    ])
  })

  it('stops telling a listener that has gone', () => {
    const deliver = vi.fn()
    const stop = listenOnWebKit(ACTIONS, deliver)
    stop()

    showOnWebKit(song())
    carrier.interrupt()

    expect(deliver).not.toHaveBeenCalled()
  })
})

describe('the buttons', () => {
  const press = (action: WebKitAction, details: object): void => {
    const call = session.setActionHandler.mock.calls.find(
      ([name]) => name === action,
    )
    ;(call?.[1] as (details: object) => void)(details)
  }

  it('hands each press to the listener, a seek’s place included', () => {
    const deliver = vi.fn()
    listenOnWebKit(ACTIONS, deliver)

    expect(session.setActionHandler.mock.calls.map(([name]) => name)).toEqual(
      ACTIONS,
    )
    press('seekto', { action: 'seekto', seekTime: 61.5 })
    press('pause', { action: 'pause' })

    expect(deliver.mock.calls).toEqual([
      ['seekto', { action: 'seekto', seekTime: 61.5 }],
      ['pause', { action: 'pause' }],
    ])
  })

  it('keeps the buttons WebKit has when it refuses one, and clears only those', () => {
    session.setActionHandler.mockImplementation(
      (action: string, handler: unknown) => {
        if (action === 'stop' && handler !== null) {
          throw new TypeError('stop is not a supported action')
        }
      },
    )
    const stop = listenOnWebKit(ACTIONS, vi.fn())
    session.setActionHandler.mockClear()

    stop()

    expect(session.setActionHandler.mock.calls).toEqual([
      ['play', null],
      ['pause', null],
      ['seekto', null],
    ])
  })

  it('leaves a newer listener’s buttons alone', () => {
    const first = vi.fn()
    const second = vi.fn()
    const stopFirst = listenOnWebKit(ACTIONS, first)
    listenOnWebKit(ACTIONS, second)
    session.setActionHandler.mockClear()

    stopFirst()
    expect(session.setActionHandler).not.toHaveBeenCalled()

    showOnWebKit(song())
    carrier.interrupt()
    expect(second).toHaveBeenCalledWith('pause', {})
    expect(first).not.toHaveBeenCalled()
  })
})

describe('the silence', () => {
  it('is a 16-bit PCM WAV file longer than WebKit’s floor for Now Playing', () => {
    const wav = new DataView(silentWav(4, 48_000))
    const text = (at: number, length: number): string =>
      String.fromCharCode(...new Uint8Array(wav.buffer, at, length))
    const dataBytes = wav.getUint32(40, true)

    expect([text(0, 4), text(8, 4), text(12, 4), text(36, 4)]).toEqual([
      'RIFF',
      'WAVE',
      'fmt ',
      'data',
    ])
    expect(wav.getUint32(4, true)).toBe(36 + dataBytes)
    expect(wav.getUint16(20, true)).toBe(1)
    expect(wav.getUint16(22, true)).toBe(2)
    expect(wav.getUint32(24, true)).toBe(48_000)
    expect(wav.getUint16(34, true)).toBe(16)
    expect(wav.byteLength).toBe(44 + dataBytes)
    // WebKit shows an audio element as Now Playing past 0.95 s.
    expect(dataBytes / wav.getUint32(28, true)).toBe(4)
    expect(new Uint8Array(wav.buffer, 44).every((byte) => byte === 0)).toBe(
      true,
    )
  })
})

describe('availability', () => {
  it('needs the Media Session API', () => {
    expect(webKitNowPlayingAvailable()).toBe(true)

    vi.stubGlobal('navigator', {})
    expect(webKitNowPlayingAvailable()).toBe(false)

    vi.stubGlobal('navigator', { mediaSession: session })
    vi.stubGlobal('MediaMetadata', undefined)
    expect(webKitNowPlayingAvailable()).toBe(false)
  })
})
