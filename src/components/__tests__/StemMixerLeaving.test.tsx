// ============================================================
// StemMixer — a song left while it plays, off the Karaoke room
// ============================================================
//
// Leaving a song pauses it with a fade. Off the room the mixer owns its
// AudioContext, and its cleanup closed that context at once, so the fade
// never played: the song stopped mid-note, heard as a click. Next and Back on
// the phone stage, walking the library, switched songs the same way. Now the
// library steps once the fade has played, and a mixer that unmounts closes
// its context after the fade, the key shifter's tail included.
//
// Last, a run stopped with no score card to show says so (onStoppedUnscored),
// and a mixer that unmounts says nothing: Karaoke Night's Merc tour waits
// through the song for the card, and a song that has none ends that wait.

import { cleanup, fireEvent, render, screen, waitFor, } from '@solidjs/testing-library'
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

const viewport = vi.hoisted(() => ({ phone: false }))

vi.mock('@/lib/use-viewport', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  isNarrow: () => viewport.phone,
  isPhoneStage: () => viewport.phone,
  isMobile: () => viewport.phone,
}))

// The library around the song: one before it, one after it.
vi.mock('@/features/stem-mixer/zen-navigation', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  nextSessionId: () => 'song-c',
  prevSessionId: () => 'song-a',
}))

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

/** The contexts the mixer made for itself, in order. */
let made: ReturnType<typeof fakeContext>[] = []

beforeEach(() => {
  viewport.phone = false
  made = []
  localStorage.clear()
  Element.prototype.scrollTo = vi.fn()
  Element.prototype.scrollIntoView = vi.fn()
  // The silent clip a press of play starts, which jsdom cannot play.
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined)
  vi.stubGlobal('AudioContext', function AudioContextStub(): unknown {
    const context = fakeContext()
    made.push(context)
    return context
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
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

// The stems' fade and its slack (useStemMixerAudioController RELEASE_MS);
// jsdom has no AudioWorklet, so no key shifter adds its tail here.
const FADE_MS = 80

function mount(onPickSession = vi.fn()): {
  onPickSession: ReturnType<typeof vi.fn>
  unmount: () => void
} {
  const { unmount } = render(() => (
    <StemMixer
      stems={{ vocal: 'blob:vocal', instrumental: 'blob:instrumental' }}
      sessionId="song-b"
      songTitle="Consent"
      onPickSession={onPickSession}
    />
  ))
  return { onPickSession, unmount }
}

async function play(): Promise<void> {
  const button = await screen.findByRole('button', { name: 'Play' })
  await waitFor(() => {
    expect(button).not.toBeDisabled()
  })
  fireEvent.click(button)
  await screen.findByRole('button', { name: 'Pause' })
}

describe('walking the library on the phone stage while a song plays', () => {
  it.each([
    ['Next song', 'song-c'],
    ['Back to the start of the song', 'song-a'],
  ])('%s steps once the fade has played', async (label, target) => {
    viewport.phone = true
    const { onPickSession } = mount()
    await play()
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] })

    fireEvent.click(screen.getByRole('button', { name: label }))

    expect(screen.getByRole('button', { name: 'Play' })).toBeInTheDocument()
    expect(onPickSession).not.toHaveBeenCalled()
    vi.advanceTimersByTime(FADE_MS)
    expect(onPickSession).toHaveBeenCalledWith(target)
  })

  it('steps at once from a paused song', async () => {
    viewport.phone = true
    const { onPickSession } = mount()
    await play()
    fireEvent.click(screen.getByRole('button', { name: 'Pause' }))
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] })
    vi.advanceTimersByTime(FADE_MS)

    fireEvent.click(screen.getByRole('button', { name: 'Next song' }))

    expect(onPickSession).toHaveBeenCalledWith('song-c')
  })
})

describe('a mixer that unmounts while its song plays', () => {
  it('closes its context once the fade has played, not under it', async () => {
    const { unmount } = mount()
    await play()
    const context = made.at(-1)
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] })

    unmount()

    expect(context?.close).not.toHaveBeenCalled()
    vi.advanceTimersByTime(FADE_MS)
    expect(context?.close).toHaveBeenCalledTimes(1)
  })

  it('closes it at once when nothing was playing', async () => {
    const { unmount } = mount()
    await screen.findByRole('button', { name: 'Play' })
    const context = made.at(-1)

    unmount()

    expect(context?.close).toHaveBeenCalledTimes(1)
  })
})

describe('a song stopped with no score card to show', () => {
  function mountHeard(): {
    heard: ReturnType<typeof vi.fn>
    unmount: () => void
  } {
    const heard = vi.fn()
    const { unmount } = render(() => (
      <StemMixer
        stems={{ vocal: 'blob:vocal', instrumental: 'blob:instrumental' }}
        sessionId="song-b"
        songTitle="Consent"
        onStoppedUnscored={heard}
      />
    ))
    return { heard, unmount }
  }

  it('says so once when Stop is pressed with the mic off', async () => {
    const { heard } = mountHeard()
    await play()

    fireEvent.click(screen.getByRole('button', { name: 'Stop' }))

    expect(heard).toHaveBeenCalledOnce()
  })

  it('says nothing when the mixer unmounts while its song plays', async () => {
    const { heard, unmount } = mountHeard()
    await play()

    unmount()

    expect(heard).not.toHaveBeenCalled()
  })
})
