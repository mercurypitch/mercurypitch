// ============================================================
// StemMixer — a playlist's Previous, Skip and Stop while a song plays
// ============================================================
//
// Each pauses the song, which fades the stems out, and then changes the
// playlist. Changed at once, the next entry arrived while the old song was
// still sounding: its key re-routed the key graph under it, and the remount
// that followed closed the clock under it. Either cuts the song off at full
// level, heard as a click. The entry now changes once the fade has played,
// the key shifter's tail included.

import { fireEvent, render, screen, waitFor } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { QueueEntry } from '@/stores/karaoke-playlist-store'

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

const run = vi.hoisted(() => ({
  advance: vi.fn(),
  prev: vi.fn(),
  stopPlaylist: vi.fn(),
}))

// The second of three songs, playing: the run the header's controls act on.
vi.mock('@/stores/karaoke-playlist-store', async (importOriginal) => {
  const real = await importOriginal<Record<string, unknown>>()
  const entry = (sessionId: string, songTitle: string): QueueEntry => ({
    sessionId,
    songTitle,
    itemId: `item-${sessionId}`,
    itemKind: 'session',
  })
  const queue = [
    entry('song-a', 'Opener'),
    entry('song-b', 'Consent'),
    entry('song-c', 'Closer'),
  ]
  return {
    ...real,
    isPlaylistActive: () => true,
    phase: () => 'playing',
    queue: () => queue,
    currentIndex: () => 1,
    currentSong: () => queue[1],
    nextSong: () => queue[2],
    activePlaylistId: () => 'run',
    advance: run.advance,
    prev: run.prev,
    stopPlaylist: run.stopPlaylist,
  }
})

import { StemMixer } from '@/components/StemMixer'

/** A context that plays: sources start and stop, params take ramps. */
function fakeContext() {
  const param = () => ({
    value: 1,
    setValueAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
    setTargetAtTime: vi.fn(),
    cancelScheduledValues: vi.fn(),
  })
  const node = () => ({ connect: vi.fn(), disconnect: vi.fn() })
  return {
    state: 'running',
    currentTime: 0,
    sampleRate: 48_000,
    destination: {},
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    resume: vi.fn(async () => Promise.resolve()),
    suspend: vi.fn(async () => Promise.resolve()),
    close: vi.fn(async () => Promise.resolve()),
    createGain: () => ({ ...node(), gain: param() }),
    createWaveShaper: () => ({ ...node(), curve: null, oversample: 'none' }),
    createAnalyser: () => ({
      ...node(),
      fftSize: 2048,
      smoothingTimeConstant: 0,
      getFloatTimeDomainData: vi.fn(),
    }),
    createBufferSource: () => ({
      ...node(),
      buffer: null as AudioBuffer | null,
      playbackRate: { value: 1 },
      start: vi.fn(),
      stop: vi.fn(),
      onended: null as (() => void) | null,
    }),
    decodeAudioData: async () =>
      ({
        duration: 12,
        length: 512,
        numberOfChannels: 2,
        sampleRate: 44100,
        getChannelData: () => new Float32Array(512),
      }) as unknown as AudioBuffer,
  }
}

beforeEach(() => {
  localStorage.clear()
  Element.prototype.scrollTo = vi.fn()
  Element.prototype.scrollIntoView = vi.fn()
  // The silent clip a press of play starts, which jsdom cannot play.
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined)
  vi.stubGlobal('AudioContext', function AudioContextStub(): unknown {
    return fakeContext()
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
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  run.advance.mockReset()
  run.prev.mockReset()
  run.stopPlaylist.mockReset()
})

/** The playlist's song, loaded; the run's 'playing' phase starts it. */
async function mountPlayingSong(): Promise<void> {
  render(() => (
    <StemMixer
      stems={{ vocal: 'blob:vocal', instrumental: 'blob:instrumental' }}
      sessionId="song-b"
      songTitle="Consent"
    />
  ))
  await waitFor(() => {
    expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument()
  })
}

// The stems' fade and its slack (useStemMixerAudioController RELEASE_MS);
// jsdom has no AudioWorklet, so no key shifter adds its tail here.
const FADE_MS = 80

describe.each([
  ['Skip to next song', run.advance],
  ['Previous song', run.prev],
  ['Stop playlist', run.stopPlaylist],
] as const)('%s while the song plays', (title, change) => {
  it('changes the playlist once the fade has played, not under it', async () => {
    await mountPlayingSong()
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] })

    fireEvent.click(screen.getByTitle(title))

    expect(screen.getByRole('button', { name: 'Play' })).toBeInTheDocument()
    expect(change).not.toHaveBeenCalled()
    vi.advanceTimersByTime(FADE_MS)
    expect(change).toHaveBeenCalledTimes(1)
  })
})

describe('the playlist controls on a paused song', () => {
  it('change the playlist at once, with no fade to wait for', async () => {
    await mountPlayingSong()
    fireEvent.click(screen.getByRole('button', { name: 'Pause' }))
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] })
    vi.advanceTimersByTime(FADE_MS)

    fireEvent.click(screen.getByTitle('Skip to next song'))

    expect(run.advance).toHaveBeenCalledTimes(1)
  })
})
