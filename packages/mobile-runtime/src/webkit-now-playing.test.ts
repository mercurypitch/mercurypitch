// ============================================================
// Now Playing through WebKit: the carrier, the bar and the buttons
// ============================================================
//
// Node has no media element and no navigator.mediaSession, so both are
// stand-ins: a carrier that keeps `paused` and queues play, playing, pause
// and seeked as WebKit does, interruptions included, and a session that
// keeps what it was told.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Carrier, WebKitAction, WebKitSong } from './webkit-now-playing'
import { listenOnWebKit, onCarrierHolding, resetWebKitNowPlaying, showOnWebKit, silentWav, webKitNowPlayingAvailable, } from './webkit-now-playing'

/**
 * An `<audio>` element, as far as the carrier uses one, with the bookkeeping
 * WebKit keeps for it (PlatformMediaSession). As in WebKit, `paused` changes
 * at once and the events follow a task later: `settle()` fires the ones
 * queued so far.
 *
 * Interruptions stack. The first suspends the element and keeps the state
 * to restore; one that comes while another is active is ignored. Ending one
 * pops the top, and only the last one, if it was not ignored, restores the
 * state, playing the element again when it was playing and the end says it
 * may. A play sets the state to restore to playing without popping, and also
 * ends a system interruption (the call or the other app) for good; a pause
 * while suspended only changes what is restored. The app going away suspends
 * an element that is not playing, and coming back ends that.
 */
class FakeCarrier extends EventTarget {
  loop = false
  preload = ''
  disableRemotePlayback = false
  paused = true
  private source: string | null = null
  private queued: string[] = []
  private state: 'paused' | 'playing' | 'interrupted' = 'paused'
  private restoring: 'paused' | 'playing' = 'paused'
  private interruptions: { readonly ignored: boolean }[] = []
  private systemInterruption = false

  readonly play = vi.fn(async () => {
    if (this.systemInterruption) {
      this.systemInterruption = false
      this.endOne(false)
    }
    this.restoring = 'playing'
    this.state = 'playing'
    this.start()
  })

  readonly pause = vi.fn(() => {
    if (this.state === 'interrupted') {
      this.restoring = 'paused'
      return
    }
    this.state = 'paused'
    if (this.paused) return
    this.paused = true
    this.queued.push('pause')
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

  /** Fire the events queued so far, in order. */
  settle(): void {
    const events = this.queued
    this.queued = []
    for (const type of events) this.dispatchEvent(new Event(type))
  }

  /** Another app takes the sound, or a call comes. */
  interrupt(): void {
    this.systemInterruption = true
    this.beginOne()
  }

  /** The call ends, with or without the system's word to resume. */
  endInterruption(mayResume: boolean): void {
    if (!this.systemInterruption) return
    this.systemInterruption = false
    this.endOne(mayResume)
  }

  /** The app goes away (the page hides): a carrier not playing is suspended. */
  appLeft(): void {
    if (this.paused) this.beginOne()
  }

  /** The app comes back: a carrier not playing has its suspension ended. */
  appReturned(): void {
    if (this.paused) this.endOne(true)
  }

  /** The loop going back to its start. */
  goRound(): void {
    this.queued.push('seeked')
  }

  private start(): void {
    if (!this.paused) return
    this.paused = false
    this.queued.push('play', 'playing')
  }

  private beginOne(): void {
    if (this.interruptions.some((one) => !one.ignored)) {
      this.interruptions.push({ ignored: true })
      return
    }
    this.interruptions.push({ ignored: false })
    this.restoring = this.state === 'playing' ? 'playing' : 'paused'
    this.state = 'interrupted'
    if (this.paused) return
    this.paused = true
    this.queued.push('pause')
  }

  private endOne(mayResume: boolean): void {
    const ended = this.interruptions.pop()
    if (ended === undefined || ended.ignored) return
    if (this.interruptions.some((one) => !one.ignored)) return
    this.state = this.restoring
    if (mayResume && this.restoring === 'playing') this.start()
  }
}

/** The document, as far as the carrier watches it: the app showing or not. */
class FakePage extends EventTarget {
  visibilityState: DocumentVisibilityState = 'visible'

  /** Hide or show, and queue the event that says so, as WebKit does. */
  turn(state: DocumentVisibilityState): () => void {
    this.visibilityState = state
    return () => {
      this.dispatchEvent(new Event('visibilitychange'))
    }
  }
}

class FakeMetadata {
  static made = 0
  /** Set to make the next one throw, as WebKit does for a bad address. */
  static refuseNext = false
  readonly title: string
  readonly artist: string
  readonly artwork: readonly { readonly src: string }[]

  constructor(init: {
    title: string
    artist: string
    artwork: readonly { readonly src: string }[]
  }) {
    if (FakeMetadata.refuseNext) {
      FakeMetadata.refuseNext = false
      throw new TypeError('Invalid URL')
    }
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
let page: FakePage
let clock = 0

beforeEach(() => {
  session = fakeSession()
  carrier = new FakeCarrier()
  page = new FakePage()
  clock = 0
  FakeMetadata.made = 0
  FakeMetadata.refuseNext = false
  vi.stubGlobal('navigator', { mediaSession: session })
  vi.stubGlobal('MediaMetadata', FakeMetadata)
  vi.spyOn(console, 'info').mockImplementation(() => undefined)
  resetWebKitNowPlaying({
    createCarrier: () => carrier as unknown as Carrier,
    silence: () => 'blob:silence',
    now: () => clock,
    page,
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

  it('plays the carrier without a name WebKit refused, and names it next time', () => {
    FakeMetadata.refuseNext = true

    expect(() => {
      showOnWebKit(song())
    }).not.toThrow()
    expect(session.metadata).toBeNull()
    expect(carrier.play).toHaveBeenCalledTimes(1)

    showOnWebKit(song({ position: 150 }))
    expect(session.metadata).toMatchObject({ title: 'Harbour Lights' })
  })

  it('puts everything away when the song is gone', () => {
    const deliver = vi.fn()
    listenOnWebKit(ACTIONS, deliver)
    showOnWebKit(song())
    carrier.settle()

    showOnWebKit(null)
    carrier.settle()

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
    carrier.settle()
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
    carrier.settle()

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
    carrier.settle()
    expect(session.setPositionState).toHaveBeenLastCalledWith({
      duration: 200,
      playbackRate: 1.5,
      position: 16,
    })

    showOnWebKit(song({ position: 198, duration: 200 }))
    clock = 8000
    carrier.goRound()
    carrier.settle()
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
    carrier.settle()

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
    carrier.settle()

    carrier.interrupt()
    carrier.settle()

    expect(deliver.mock.calls).toEqual([['pause', {}]])
  })

  it('hears nothing from a pause or a play the song asked for', () => {
    const deliver = vi.fn()
    listenOnWebKit(ACTIONS, deliver)

    showOnWebKit(song())
    carrier.settle()
    showOnWebKit(song({ playing: false }))
    carrier.settle()
    showOnWebKit(song())
    carrier.settle()

    expect(carrier.play).toHaveBeenCalledTimes(2)
    expect(deliver).not.toHaveBeenCalled()
  })

  it('hears nothing from events the song has overtaken', () => {
    // WebKit fires them a task late. Paused and played again before the
    // pause arrives, the song must not hear that pause as the system's;
    // played and paused again, it must not hear that play.
    const deliver = vi.fn()
    listenOnWebKit(ACTIONS, deliver)
    showOnWebKit(song())
    carrier.settle()

    showOnWebKit(song({ playing: false }))
    showOnWebKit(song())
    carrier.settle()
    showOnWebKit(song({ playing: false }))
    showOnWebKit(song())
    showOnWebKit(song({ playing: false }))
    carrier.settle()

    expect(deliver).not.toHaveBeenCalled()
  })

  it('plays the song again when a call ends with the word to resume', () => {
    const deliver = vi.fn()
    listenOnWebKit(ACTIONS, deliver)
    showOnWebKit(song())
    carrier.settle()
    carrier.interrupt()
    carrier.settle()

    // The room paused, as it was asked to. The carrier is paused already,
    // and pausing it again would tell WebKit not to resume it.
    showOnWebKit(song({ playing: false }))
    expect(carrier.pause).not.toHaveBeenCalled()

    carrier.endInterruption(true)
    carrier.settle()

    expect(deliver.mock.calls).toEqual([
      ['pause', {}],
      ['play', {}],
    ])
  })

  it('leaves the song paused when a call ends without the word to resume', () => {
    const deliver = vi.fn()
    listenOnWebKit(ACTIONS, deliver)
    showOnWebKit(song())
    carrier.settle()
    carrier.interrupt()
    carrier.settle()
    showOnWebKit(song({ playing: false }))

    carrier.endInterruption(false)
    carrier.settle()

    expect(deliver.mock.calls).toEqual([['pause', {}]])
  })

  /** The app going away, then coming back, the page's event last or first. */
  const leave = (): void => {
    carrier.appLeft()
    page.turn('hidden')()
    carrier.settle()
  }
  const comeBack = (eventFirst: boolean): void => {
    const announce = page.turn('visible')
    carrier.appReturned()
    if (eventFirst) announce()
    carrier.settle()
    if (!eventFirst) announce()
    carrier.settle()
  }

  for (const eventFirst of [false, true]) {
    const order = eventFirst ? 'its event first' : 'its event last'

    it(`keeps a song paused on the lock screen paused as the app comes back (${order})`, () => {
      // Paused in the app, then the phone locked: WebKit suspends the paused
      // carrier. Play and pause on the lock screen leave WebKit owing it a
      // play, which it makes as the phone is unlocked.
      const deliver = vi.fn()
      listenOnWebKit(ACTIONS, deliver)
      showOnWebKit(song())
      carrier.settle()
      showOnWebKit(song({ playing: false }))
      carrier.settle()
      leave()
      showOnWebKit(song())
      carrier.settle()
      showOnWebKit(song({ playing: false }))
      carrier.settle()

      clock = 60_000
      comeBack(eventFirst)

      expect(deliver).not.toHaveBeenCalled()
      expect(carrier.paused).toBe(true)
    })

    it(`keeps a song a call paused paused when the app comes back after it (${order})`, () => {
      // The call takes the phone, so the app is away when it ends: WebKit
      // resumes nothing then, and plays the carrier as the app comes back.
      const deliver = vi.fn()
      listenOnWebKit(ACTIONS, deliver)
      showOnWebKit(song())
      carrier.settle()
      carrier.interrupt()
      carrier.settle()
      showOnWebKit(song({ playing: false }))
      leave()
      carrier.endInterruption(true)
      carrier.settle()

      clock = 300_000
      comeBack(eventFirst)

      expect(deliver.mock.calls).toEqual([['pause', {}]])
      expect(carrier.paused).toBe(true)
    })
  }

  it('follows the system playing the carrier only to undo its own pause', () => {
    // The song paused in the app, then the system playing the carrier, as
    // WebKit can after a suspension: the song stays paused, and so does the
    // lock screen.
    const deliver = vi.fn()
    listenOnWebKit(ACTIONS, deliver)
    showOnWebKit(song())
    carrier.settle()
    showOnWebKit(song({ playing: false }))
    carrier.settle()

    carrier.paused = false
    carrier.dispatchEvent(new Event('play'))

    expect(deliver).not.toHaveBeenCalled()
    expect(carrier.paused).toBe(true)
  })

  it('stops telling a listener that has gone', () => {
    const deliver = vi.fn()
    const stop = listenOnWebKit(ACTIONS, deliver)
    stop()

    showOnWebKit(song())
    carrier.settle()
    carrier.interrupt()
    carrier.settle()

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

  it('plays a carrier that would not play when play is pressed', async () => {
    // The song plays, but its carrier was refused: the lock screen shows it
    // paused, and the room, already playing, has nothing new to report.
    const deliver = vi.fn()
    listenOnWebKit(ACTIONS, deliver)
    carrier.play.mockRejectedValueOnce(
      new DOMException('Not now', 'NotAllowedError'),
    )
    showOnWebKit(song())
    await vi.waitFor(() => {
      expect(console.info).toHaveBeenCalled()
    })
    expect(carrier.paused).toBe(true)

    press('play', { action: 'play' })
    expect(carrier.play).toHaveBeenCalledTimes(2)
    expect(carrier.paused).toBe(false)
    expect(deliver).toHaveBeenLastCalledWith('play', { action: 'play' })

    // Playing now: a press leaves it be.
    press('play', { action: 'play' })
    expect(carrier.play).toHaveBeenCalledTimes(2)
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
    carrier.settle()
    carrier.interrupt()
    carrier.settle()
    expect(second).toHaveBeenCalledWith('pause', {})
    expect(first).not.toHaveBeenCalled()
  })
})

describe('holding the playback session', () => {
  // While the carrier holds it, the app's unlock clip stands aside: beside
  // the carrier, WebKit could show the clip on the lock screen, send it a
  // headset's press, and keep the app there after the song has gone.

  it('holds it once the carrier sounds, and gives it back with the song', () => {
    const heard = vi.fn()
    onCarrierHolding(heard)

    showOnWebKit(song())
    expect(heard).not.toHaveBeenCalled()
    carrier.settle()
    showOnWebKit(song({ playing: false }))
    carrier.settle()
    showOnWebKit(song())
    carrier.settle()
    expect(heard.mock.calls).toEqual([[true]])

    showOnWebKit(null)
    expect(heard.mock.calls).toEqual([[true], [false]])
  })

  it('never holds it for a song that has never played', () => {
    const heard = vi.fn()
    onCarrierHolding(heard)

    showOnWebKit(song({ playing: false }))
    carrier.settle()
    showOnWebKit(null)

    expect(heard).not.toHaveBeenCalled()
  })

  it('takes no word from a carrier sounding after its song was put away', () => {
    const heard = vi.fn()
    onCarrierHolding(heard)

    showOnWebKit(song())
    showOnWebKit(null)
    carrier.settle()

    expect(heard).not.toHaveBeenCalled()
  })

  it('tells a listener that comes while it holds at once', () => {
    showOnWebKit(song())
    carrier.settle()
    const heard = vi.fn()

    onCarrierHolding(heard)

    expect(heard.mock.calls).toEqual([[true]])
  })

  it('stops telling a listener that has gone, but not a newer one', () => {
    const first = vi.fn()
    const second = vi.fn()
    const stopFirst = onCarrierHolding(first)
    onCarrierHolding(second)
    stopFirst()

    showOnWebKit(song())
    carrier.settle()

    expect(first).not.toHaveBeenCalled()
    expect(second.mock.calls).toEqual([[true]])
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
