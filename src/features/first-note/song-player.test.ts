// ============================================================
// song-player — a sound settles, played or not, whatever stops the band
// ============================================================
//
// jsdom has no media elements that play and no audio graph, so the stems'
// <audio> elements and the room's context are doubles. What this holds the
// player to is the promise a round waits on: `done` settles true once the
// band reaches its place, and false when it stops short of it, by the
// system's hand or the song's end, so the room never waits on a place that
// will not come.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FIRST_NOTE_SONGS } from './first-note-songs'
import { createSongPlayer } from './song-player'

class FakeParam {
  value = 1
  cancelScheduledValues = (): void => undefined
  setValueAtTime(value: number): void {
    this.value = value
  }
  exponentialRampToValueAtTime(value: number): void {
    this.value = value
  }
  setTargetAtTime(value: number): void {
    this.value = value
  }
}

const fakeNode = (): AudioNode =>
  ({
    gain: new FakeParam(),
    connect: () => undefined,
    disconnect: () => undefined,
  }) as unknown as AudioNode

const fakeContext = (): AudioContext =>
  ({
    currentTime: 0,
    state: 'running',
    destination: {},
    createGain: fakeNode,
    createMediaElementSource: fakeNode,
  }) as unknown as AudioContext

/** An <audio> element that loads, seeks and plays when told, as the real one does: events a task later. */
class FakeAudio extends EventTarget {
  static made: FakeAudio[] = []
  preload = ''
  readyState = 0
  paused = true
  private at = 0
  private source: string | null = null

  constructor() {
    super()
    FakeAudio.made.push(this)
  }

  getAttribute(name: string): string | null {
    return name === 'src' ? this.source : null
  }
  removeAttribute(name: string): void {
    if (name === 'src') this.source = null
  }
  get src(): string {
    return this.source ?? ''
  }
  set src(url: string) {
    this.source = url
  }
  load(): void {
    this.readyState = 0
    this.later('loadedmetadata', () => {
      this.readyState = 1
    })
  }
  get currentTime(): number {
    return this.at
  }
  set currentTime(seconds: number) {
    this.at = seconds
    this.later('seeked')
  }
  play(): Promise<void> {
    this.paused = false
    return Promise.resolve()
  }
  pause(): void {
    if (this.paused) return
    this.paused = true
    this.later('pause')
  }
  /** Playback reached `seconds`. */
  playTo(seconds: number): void {
    this.at = seconds
  }
  /** The song's end: playback stops there. */
  end(): void {
    this.paused = true
    this.later('ended')
  }

  private later(event: string, before?: () => void): void {
    setTimeout(() => {
      before?.()
      this.dispatchEvent(new Event(event))
    }, 0)
  }
}

const song = FIRST_NOTE_SONGS[0]
const entry = song.entries[0]

/** The lead-in of the first entry, started, with the band playing. */
async function leadIn(): Promise<{
  done: Promise<boolean>
  band: FakeAudio
  settled: () => boolean | null
}> {
  const player = createSongPlayer(fakeContext())
  const sound = player.leadIn(song, entry)
  let settled: boolean | null = null
  void sound.done.then((played) => {
    settled = played
  })
  await vi.advanceTimersByTimeAsync(20)
  const band = FakeAudio.made[0]
  expect(band.paused).toBe(false)
  return { done: sound.done, band, settled: () => settled }
}

beforeEach(() => {
  vi.useFakeTimers()
  FakeAudio.made = []
  vi.stubGlobal('Audio', FakeAudio)
  vi.stubGlobal('requestAnimationFrame', (step: FrameRequestCallback) =>
    setTimeout(() => step(0), 16),
  )
  vi.stubGlobal('cancelAnimationFrame', (id: number) => clearTimeout(id))
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('a lead-in', () => {
  it('settles played once the band reaches the singer, though the player then pauses it', async () => {
    const { done, band, settled } = await leadIn()

    band.playTo(entry.at)
    await vi.advanceTimersByTimeAsync(500)

    expect(settled()).toBe(true)
    expect(band.paused).toBe(true)
    await expect(done).resolves.toBe(true)
  })

  it('settles unplayed when the system pauses the band short of the singer', async () => {
    const { done, band, settled } = await leadIn()

    band.playTo(entry.from + 1)
    await vi.advanceTimersByTimeAsync(100)
    expect(settled()).toBeNull()

    band.pause()
    await vi.advanceTimersByTimeAsync(500)

    await expect(done).resolves.toBe(false)
  })

  it('settles unplayed when the song ends before the singer comes in', async () => {
    const { done, band } = await leadIn()

    band.end()
    await vi.advanceTimersByTimeAsync(500)

    await expect(done).resolves.toBe(false)
  })

  it('waits for the band while it plays on, short of the singer', async () => {
    const { band, settled } = await leadIn()

    band.playTo(entry.at - 1)
    await vi.advanceTimersByTimeAsync(2000)

    expect(settled()).toBeNull()
  })
})
