// ============================================================
// StemMixer, hosted: who played or paused the song, as its line says
// ============================================================
//
// The mixer's own controls name themselves (playback-cause.ts), so the
// song's line in the audio record says which one it was: the stage's play
// and pause button, Space, or a song that started by itself. The room's own
// calls name themselves in the room (KaraokeRoomStage.test.tsx).

import { cleanup, fireEvent, render, screen, waitFor, } from '@solidjs/testing-library'
import type { Accessor } from 'solid-js'
import { createSignal } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { HostedMixerControls, StemMixerHosting, } from '@/components/stem-mixer-hosting'

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
  isNarrow: () => false,
  isMobile: () => false,
}))

vi.mock('@/features/stem-mixer/stem-stream-source', () => ({
  canStreamStems: () => true,
  openStemStream: vi.fn(async () => ({
    sampleRate: 48_000,
    channelCount: 2,
    durationSeconds: 246,
    // eslint-disable-next-line require-yield
    chunks: async function* () {
      return
    },
    dispose: () => undefined,
  })),
}))

import { StemMixer } from '@/components/StemMixer'
import { audioDiagnosticEntries, resetAudioDiagnosticsForTests, } from '@/lib/audio-diagnostics'

function fakeContext() {
  const param = () => ({
    value: 1,
    setValueAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
    setTargetAtTime: vi.fn(),
    cancelScheduledValues: vi.fn(),
  })
  const node = () => ({ connect: vi.fn(), disconnect: vi.fn(), gain: param() })
  return {
    state: 'running',
    currentTime: 0,
    sampleRate: 48_000,
    destination: {},
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    close: vi.fn(async () => Promise.resolve()),
    resume: vi.fn(async () => Promise.resolve()),
    suspend: vi.fn(async () => Promise.resolve()),
    createGain: vi.fn(node),
    createWaveShaper: vi.fn(() => ({ connect: vi.fn(), disconnect: vi.fn() })),
    createAnalyser: vi.fn(() => ({
      fftSize: 2048,
      smoothingTimeConstant: 0,
      connect: vi.fn(),
      disconnect: vi.fn(),
      getFloatTimeDomainData: vi.fn(),
    })),
    createBuffer: vi.fn(
      (channels: number, frames: number, sampleRate: number) => ({
        numberOfChannels: channels,
        length: frames,
        sampleRate,
        duration: frames / sampleRate,
        getChannelData: () => new Float32Array(frames),
        copyToChannel: () => undefined,
      }),
    ),
    decodeAudioData: vi.fn(async () =>
      Promise.reject(new Error('a hosted mixer never decodes a whole stem')),
    ),
  }
}

/** A room that lends its clock and takes the mixer's controls. */
function hosting(): {
  host: StemMixerHosting
  controls: Accessor<HostedMixerControls | null>
} {
  const [controls, setControls] = createSignal<HostedMixerControls | null>(null)
  const lent = fakeContext()
  const host: StemMixerHosting = {
    audio: {
      ensure: vi.fn(() => lent as unknown as AudioContext),
      unlock: vi.fn(async () => Promise.resolve(true)),
    },
    stage: {
      byline: () => 'Josh Woodward · CC BY 4.0',
      onOpenLibrary: vi.fn(),
      lyricsSize: () => 'current',
      noteGlyphs: () => false,
    },
    attach: setControls,
    hasPrev: () => false,
    hasNext: () => true,
    onPrev: vi.fn(),
    onNext: vi.fn(),
    onEnded: vi.fn(),
  }
  return { host, controls }
}

/** The mixer as the room mounts it, loaded. */
async function mountLoaded(
  autoPlay = false,
): Promise<Accessor<HostedMixerControls | null>> {
  const { host, controls } = hosting()
  render(() => (
    <StemMixer
      stems={{
        vocal: '/karaoke/examples/goodbye-to-spring/vocal.m4a',
        instrumental: '/karaoke/examples/goodbye-to-spring/instrumental.m4a',
      }}
      sessionId="karaoke-night-demo"
      songTitle="Goodbye to Spring"
      preset="performance"
      showStageSettings={false}
      practiceMode="full"
      requestedStems={{ vocal: true, instrumental: true }}
      autoPlay={autoPlay}
      hosted={host}
    />
  ))
  await waitFor(() => {
    expect(controls()?.loading()).toBe(false)
  })
  return controls
}

/** Who each line of `event` says asked. */
const said = (event: string): unknown[] =>
  audioDiagnosticEntries()
    .filter((entry) => entry.source === 'karaoke' && entry.event === event)
    .map((entry) => entry.detail.by)

beforeEach(() => {
  resetAudioDiagnosticsForTests()
  localStorage.clear()
  Element.prototype.scrollTo = vi.fn()
  Element.prototype.scrollIntoView = vi.fn()
  vi.stubGlobal('fetch', async () => ({
    ok: false,
    status: 0,
    body: null,
    headers: new Headers(),
    arrayBuffer: async () => new ArrayBuffer(64),
  }))
  vi.stubGlobal('AudioContext', function AudioContextStub(): unknown {
    return fakeContext()
  })
  // The silent clip a press of play starts, which jsdom cannot play.
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined)
  vi.spyOn(console, 'info').mockImplementation(() => undefined)
  vi.spyOn(console, 'log').mockImplementation(() => undefined)
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('who played or paused the song, in its line', () => {
  it('says the stage’s own button played and paused it', async () => {
    const controls = await mountLoaded()

    fireEvent.click(screen.getByRole('button', { name: 'Play' }))
    expect(controls()?.playing()).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Pause' }))

    expect(said('play')).toEqual(['button'])
    expect(said('pause')).toEqual(['button'])
  })

  it('says Space played and paused it', async () => {
    const controls = await mountLoaded()

    fireEvent.keyDown(window, { code: 'Space', key: ' ' })
    expect(controls()?.playing()).toBe(true)
    fireEvent.keyDown(window, { code: 'Space', key: ' ' })

    expect(said('play')).toEqual(['key'])
    expect(said('pause')).toEqual(['key'])
  })

  it('says a song the room cued to play started by itself', async () => {
    const controls = await mountLoaded(true)

    await waitFor(() => {
      expect(controls()?.playing()).toBe(true)
    })

    expect(said('play')).toEqual(['autoplay'])
  })
})
