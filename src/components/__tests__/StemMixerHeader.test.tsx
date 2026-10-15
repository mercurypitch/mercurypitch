// ============================================================
// StemMixer — the header it draws
// ============================================================
//
// The title is the song's own name: no "(session)" after it, and no
// length beside it (the timeline ends with the length now). Open in
// Karaoke Night links to this song, waits while the studio is separating,
// and is not drawn where Karaoke Night has nothing to add.

import { cleanup, render, screen } from '@solidjs/testing-library'
import { createSignal } from 'solid-js'
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

import { KN_SEPARATING } from '@/components/stem-mixer/header/karaoke-night'
import { StemMixer } from '@/components/StemMixer'

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
        duration: 257,
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
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

const night = () => screen.queryByTestId('mixer-karaoke-night')

describe('the mixer header', () => {
  it('names the song plainly: no "(session)", and no length beside it', async () => {
    render(() => (
      <StemMixer
        stems={{ vocal: 'blob:vocal', instrumental: 'blob:instrumental' }}
        sessionId="song-b"
        songTitle="Harbor Lights.mp3"
      />
    ))
    await screen.findByRole('button', { name: 'Play' })

    const header = screen.getByTestId('mixer-header')
    expect(
      screen.getByRole('heading', { level: 2, name: 'Harbor Lights' }),
    ).toBeInTheDocument()
    expect(header).not.toHaveTextContent('(session)')
    expect(header).not.toHaveTextContent('4:17')
  })

  it('keeps a dot that belongs to the title', async () => {
    render(() => (
      <StemMixer
        stems={{ vocal: 'blob:vocal', instrumental: 'blob:instrumental' }}
        sessionId="song-b"
        songTitle="Mr. Brightside"
      />
    ))
    await screen.findByRole('button', { name: 'Play' })

    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(
      /^Mr\. Brightside$/,
    )
  })

  it('opens this song in Karaoke Night, and waits while the studio separates', async () => {
    const [separating, setSeparating] = createSignal(false)
    render(() => (
      <StemMixer
        stems={{ vocal: 'blob:vocal', instrumental: 'blob:instrumental' }}
        sessionId="song-b"
        songTitle="Harbor Lights"
        separationRunning={separating}
      />
    ))
    await screen.findByRole('button', { name: 'Play' })

    expect(night()).toHaveAttribute('href', '/karaoke-night?session=song-b')
    expect(night()).toHaveAttribute(
      'title',
      'Open Harbor Lights in Karaoke Night',
    )

    setSeparating(true)
    expect(night()).toHaveAttribute('aria-disabled', 'true')
    expect(night()).toHaveAccessibleDescription(KN_SEPARATING)

    setSeparating(false)
    expect(night()).not.toHaveAttribute('aria-disabled')
  })

  it('leaves Karaoke Night out on the Karaoke Night stage itself', async () => {
    render(() => (
      <StemMixer
        stems={{ vocal: 'blob:vocal', instrumental: 'blob:instrumental' }}
        sessionId="song-b"
        songTitle="Harbor Lights"
        preset="performance"
      />
    ))
    await screen.findByRole('button', { name: 'Play' })

    expect(screen.getByTestId('mixer-header')).toBeInTheDocument()
    expect(night()).toBeNull()
  })
})
