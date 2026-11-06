// ============================================================
// Stand-ins for the carrier, the page and the media session
// ============================================================
//
// Node has no media element and no navigator.mediaSession. These keep what
// WebKit keeps for the carrier and the session, for the tests of
// webkit-now-playing.ts, the lock screen's own and its AirPlay ones.

import { vi } from 'vitest'

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
export class FakeCarrier extends EventTarget {
  loop = false
  preload = ''
  disableRemotePlayback = false
  muted = false
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

  /** What the element says of FLAC: nothing, where it would not play it. */
  flac = ''

  canPlayType(type: string): string {
    return type === 'audio/flac' ? this.flac : ''
  }

  get src(): string {
    return this.source ?? ''
  }

  set src(value: string) {
    this.source = value
  }

  hasAttribute(name: string): boolean {
    return name === 'src' ? this.source !== null : this.attributes.has(name)
  }

  /** Attributes other than `src`, as the element keeps them. */
  readonly attributes = new Map<string, string>()

  setAttribute(name: string, value: string): void {
    if (name === 'src') this.source = value
    else this.attributes.set(name, value)
  }

  removeAttribute(name: string): void {
    if (name === 'src') this.source = null
    else this.attributes.delete(name)
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
export class FakePage extends EventTarget {
  visibilityState: DocumentVisibilityState = 'visible'

  /** Hide or show, and queue the event that says so, as WebKit does. */
  turn(state: DocumentVisibilityState): () => void {
    this.visibilityState = state
    return () => {
      this.dispatchEvent(new Event('visibilitychange'))
    }
  }
}

export class FakeMetadata {
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

export function fakeSession() {
  return {
    metadata: null as FakeMetadata | null,
    playbackState: 'none',
    setPositionState: vi.fn(),
    setActionHandler: vi.fn(),
  }
}
