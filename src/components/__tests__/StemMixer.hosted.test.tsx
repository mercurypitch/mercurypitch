// ============================================================
// StemMixer hosted by the native Karaoke room
// ============================================================
//
// Three audit defects live in how the mixer decides what it is, and each has
// the same fix inside the room: the room says, the mixer does not guess.
//
//   K6  an 852-wide phone on its side is not narrow, so it got the desktop
//       mixer. Hosted, the mixer always draws the zen stage.
//   K9  an Android tablet's user agent reads as a desktop, so it decoded
//       whole stems. Hosted, the mixer always streams.
//   the room's one context: hosted, the mixer builds on the context the room
//       lends it and leaves it open on the way out (REQ-NRM-033/038).
//
// So this mounts the whole mixer on a screen that is wide and a device that
// says desktop — the configuration that was wrong — and hosts it.

import { cleanup, fireEvent, render, screen, waitFor, } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { KaraokeStageHosting } from '@/components/KaraokeMobileStage'
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

vi.mock('@/lib/device-tier', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return {
    ...actual,
    deviceClass: () => 'desktop',
    classifyDevice: () => 'desktop',
  }
})

const streams = vi.hoisted(() => ({ opened: 0, decoder: true }))

vi.mock('@/features/stem-mixer/stem-stream-source', () => ({
  canStreamStems: () => streams.decoder,
  openStemStream: vi.fn(async () => {
    if (!streams.decoder) return null
    streams.opened += 1
    return {
      sampleRate: 48_000,
      channelCount: 2,
      durationSeconds: 246,
      // eslint-disable-next-line require-yield
      chunks: async function* () {
        return
      },
      dispose: () => undefined,
    }
  }),
}))

import { StemMixer } from '@/components/StemMixer'

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

let constructed = 0

beforeEach(() => {
  streams.opened = 0
  streams.decoder = true
  constructed = 0
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
    constructed += 1
    return fakeContext()
  })
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  vi.unstubAllGlobals()
})

function hosting(over: Partial<StemMixerHosting> = {}) {
  const lent = fakeContext()
  const stage: KaraokeStageHosting = {
    byline: () => 'Josh Woodward · CC BY 4.0',
    onOpenLibrary: vi.fn(),
    lyricsSize: () => 'current',
    noteGlyphs: () => false,
  }
  let attached: HostedMixerControls | null = null
  const host: StemMixerHosting = {
    audio: {
      ensure: vi.fn(() => lent as unknown as AudioContext),
      unlock: vi.fn(async () => Promise.resolve(true)),
    },
    stage,
    attach: (controls) => {
      attached = controls
    },
    hasPrev: () => false,
    hasNext: () => true,
    onPrev: vi.fn(),
    onNext: vi.fn(),
    onEnded: vi.fn(),
    ...over,
  }
  return { host, lent, controls: () => attached }
}

function mountHosted(
  host: StemMixerHosting,
  sessionId = 'karaoke-night-demo',
): () => void {
  const { unmount } = render(() => (
    <StemMixer
      stems={{
        vocal: '/karaoke/examples/goodbye-to-spring/vocal.m4a',
        instrumental: '/karaoke/examples/goodbye-to-spring/instrumental.m4a',
      }}
      sessionId={sessionId}
      songTitle="Goodbye to Spring"
      preset="performance"
      showStageSettings={false}
      practiceMode="full"
      requestedStems={{ vocal: true, instrumental: true }}
      karaokeReferenceVocal
      hosted={host}
    />
  ))
  return unmount
}

describe('the mixer the Karaoke room hosts', () => {
  it('draws the zen stage on a screen that is not narrow (K6)', () => {
    const { host } = hosting()
    mountHosted(host)
    const stage = screen.getByTestId('karaoke-mobile-stage')
    expect(stage.dataset.hosted).toBe('')
  })

  it('streams on a device that says it is a desktop (K9)', async () => {
    const { host } = hosting()
    mountHosted(host)
    await waitFor(() => {
      expect(streams.opened).toBe(2)
    })
  })

  it('plays on the context the room lends, and never builds one', async () => {
    const { host } = hosting()
    mountHosted(host)
    await waitFor(() => {
      expect(host.audio?.ensure).toHaveBeenCalled()
    })
    expect(constructed).toBe(0)
  })

  it('leaves the lent context open when it goes', async () => {
    const { host, lent } = hosting()
    const unmount = mountHosted(host)
    await waitFor(() => {
      expect(streams.opened).toBe(2)
    })
    unmount()
    expect(lent.close).not.toHaveBeenCalled()
  })

  it('hands the room its controls', async () => {
    const { host, controls } = hosting()
    mountHosted(host)
    await waitFor(() => {
      expect(controls()).not.toBeNull()
    })
    expect(controls()!.playing()).toBe(false)
    expect(controls()!.hasNotes()).toBe(false)
  })

  it('hands the room the guide vocal, and takes it back after a park', async () => {
    const { host, controls } = hosting()
    mountHosted(host)
    await waitFor(() => {
      expect(controls()).not.toBeNull()
    })
    // A karaoke reference vocal starts muted, at the mixer's level.
    expect(controls()!.guide()).toEqual({ volume: 0.8, muted: true })

    controls()!.setGuide({ volume: 0.35, muted: false })

    expect(controls()!.guide()).toEqual({ volume: 0.35, muted: false })
  })

  it('says a song with stored notes has them, so the room can offer them (K1)', async () => {
    // The examples' notes are seeded under their session ids
    // (bundled-notes.ts); a streamed vocal is never analysed on the phone, so
    // a stored record is the only way a hosted song has notes.
    const { savePitchAnalysisToDbStrict } =
      await import('@/db/services/session-pitch-analysis-service')
    const notes = [{ midi: 60, noteName: 'C4', startSec: 1, endSec: 2 }]
    await savePitchAnalysisToDbStrict('karaoke-night-demo:notes-test', {
      mergedNotes: notes,
      segmentedNotes: notes,
      pitchHistory: [],
    })
    const { host, controls } = hosting()
    mountHosted(host, 'karaoke-night-demo:notes-test')
    await waitFor(() => {
      expect(controls()?.hasNotes()).toBe(true)
    })
  })

  it("hands the key to the room's options, and keeps it off the stage", async () => {
    // The room's landscape column is 236-286 px wide and the key control
    // needs about 324: in the room, the key is a row in Karaoke options.
    const { host, controls } = hosting()
    mountHosted(host)
    await waitFor(() => {
      expect(controls()).not.toBeNull()
    })
    const before = controls()!.key.value()

    controls()!.key.onChange(2)

    expect({
      onStage: screen.queryByTestId('mobile-key-shift'),
      before,
      after: controls()!.key.value(),
    }).toEqual({ onStage: null, before: 0, after: 2 })
  })

  it("steps through the room's library, not the mixer's own", () => {
    const { host } = hosting()
    mountHosted(host)
    fireEvent.click(screen.getByLabelText('Next song'))
    expect(host.onNext).toHaveBeenCalledTimes(1)
  })
})

describe('a song the room cannot play on this phone', () => {
  // A WKWebView with no WebCodecs AudioDecoder cannot stream, and the room
  // refuses a song it would have to decode whole (review item 3). Loading it
  // again lands on the same refusal, so the card offers no "Try again".
  it('says why, and offers no Try again', async () => {
    streams.decoder = false
    vi.stubGlobal('fetch', async () => ({
      ok: false,
      status: 0,
      body: null,
      headers: new Headers(),
      // Past the 12 MiB a stem the room still decodes whole (stem-memory.ts).
      arrayBuffer: async () => new ArrayBuffer(16 * 1024 * 1024),
    }))
    const { host } = hosting()
    mountHosted(host)

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain(
      "This song needs a newer version of this phone's software to play here.",
    )
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull()
  })

  it('still offers Try again for a load that can succeed next time', async () => {
    vi.stubGlobal('fetch', async () =>
      Promise.reject(new TypeError('Failed to fetch')),
    )
    const { host } = hosting()
    mountHosted(host)

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain('Stems could not be loaded.')
    expect(screen.getByRole('button', { name: 'Try again' })).not.toBeNull()
  })
})

// ── A held last word, lit for as long as it is held ──────────────────────
//
// "Nothing in the Dark" ends a line on "dark" at 113.23 s and holds it to
// about 114 s; the next line starts at 125.36 s. The example ships only word
// starts for that line, so the end comes from the notes it ships with
// (bundled-notes.ts) and the sung-end rule (lyric-sung-end.ts). Both the
// stage and the small window must sweep "dark" across the held note: not
// across the eleven silent seconds after it, and not in a third of a second.
describe('a held last word in the room', () => {
  /** The bundle's examples, from the repository root vitest runs in. */
  const EXAMPLES = 'apps/mercurypitch/native-only/karaoke/examples'
  const SONG = 'nothing-in-the-dark'
  /** Half a second into the held "dark". */
  const AT = 113.8

  async function seedTheExample(): Promise<string> {
    const { readFileSync } = await import('node:fs')
    const { resolve } = await import('node:path')
    const file = (path: string) => resolve(process.cwd(), EXAMPLES, path)
    const manifest = JSON.parse(
      readFileSync(file('manifest.json'), 'utf8'),
    ) as { songs: { slug: string; notes?: string }[] }
    const song = manifest.songs.find((s) => s.slug === SONG)!
    const notesBytes = readFileSync(file(`${SONG}/notes.json`))
    vi.stubGlobal('fetch', async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : String(input)
      if (url === song.notes) {
        return new Response(new Uint8Array(notesBytes), { status: 200 })
      }
      return {
        ok: false,
        status: 0,
        body: null,
        headers: new Headers(),
        arrayBuffer: async () => new ArrayBuffer(64),
      }
    })
    const { demoSessionId, seedDemoLyrics } =
      await import('@/features/karaoke-night/demo-song')
    const { seedBundledNotes } =
      await import('@/features/karaoke-night/bundled-notes')
    await seedDemoLyrics(song as Parameters<typeof seedDemoLyrics>[0])
    expect(
      await seedBundledNotes(song as Parameters<typeof seedBundledNotes>[0]),
    ).toBe(true)
    return demoSessionId(SONG)
  }

  /** The stage's current line: its words, and the sweep on the active one. */
  function stageLine(): { text: string; sweep: string | null } | null {
    const lyrics = screen.getByTestId('karaoke-lyrics')
    const current = [...lyrics.querySelectorAll('p')].find((p) =>
      [...p.classList].some((c) => c.includes('current')),
    )
    if (current === undefined) return null
    const swept = [...current.querySelectorAll('span')].find(
      (span) => span.style.getPropertyValue('--sweep') !== '',
    )
    return {
      text: (current.textContent ?? '').trim(),
      sweep: swept?.style.getPropertyValue('--sweep') ?? null,
    }
  }

  it('sweeps "dark" across the held note, on the stage and in the window', async () => {
    const sessionId = await seedTheExample()
    const { host, controls } = hosting()
    render(() => (
      <StemMixer
        stems={{
          vocal: `/karaoke/examples/${SONG}/vocal.m4a`,
          instrumental: `/karaoke/examples/${SONG}/instrumental.m4a`,
        }}
        sessionId={sessionId}
        songTitle="Nothing in the Dark"
        preset="performance"
        showStageSettings={false}
        practiceMode="full"
        requestedStems={{ vocal: true, instrumental: true }}
        karaokeReferenceVocal
        hosted={host}
      />
    ))
    await waitFor(() => {
      expect(controls()?.hasNotes()).toBe(true)
      expect(controls()!.loading()).toBe(false)
      expect(controls()!.duration()).toBeGreaterThan(AT)
      expect(screen.getByTestId('karaoke-lyrics').textContent).toContain(
        'nothing in the dark',
      )
    })
    // The suite's frames never come (setup-common.ts); a seek finds its line
    // on the frame after it, so this one needs that frame to arrive.
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) =>
      setTimeout(() => cb(performance.now()), 0),
    )
    controls()!.seek(AT)
    expect(controls()!.elapsed()).toBe(AT)

    // The held note ends at 114.015 s (the notes' own analysis); the sung
    // end adds the release tail, so "dark" runs 113.23 s to 114.365 s.
    const expected = (AT - 113.23) / (114.0154 + 0.35 - 113.23)
    await waitFor(() => {
      const glance = controls()!.lyricGlance()
      expect(glance.words.at(-1)).toBe('dark')
      expect(glance.current).toBe(
        'Try to see it all but there is nothing in the dark',
      )
      expect(glance.sungUpTo).toBe(10)
      expect(glance.sweep).toBeCloseTo(expected, 2)
    })
    await waitFor(() => {
      const line = stageLine()
      expect(line?.text).toBe(
        'Try to see it all but there is nothing in the dark',
      )
      expect(line?.sweep).toBe(`${(expected * 100).toFixed(1)}%`)
    })
  })
})
