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

// ── "Nothing in the Dark", as the bundle ships it ────────────────────────
//
// It ends a line on "dark" at 113.23 s and holds it to about 114 s; the next
// line starts at 125.36 s.

/** The bundle's examples, from the repository root vitest runs in. */
const EXAMPLES = 'apps/mercurypitch/native-only/karaoke/examples'
const SONG = 'nothing-in-the-dark'
/** Half a second into the held "dark". */
const AT = 113.8
/** The line sung at `AT`. */
const DARK_LINE = 'Try to see it all but there is nothing in the dark'

async function seedTheExample(): Promise<string> {
  const { readFileSync } = await import('node:fs')
  const { resolve } = await import('node:path')
  const file = (path: string) => resolve(process.cwd(), EXAMPLES, path)
  const manifest = JSON.parse(readFileSync(file('manifest.json'), 'utf8')) as {
    songs: { slug: string; notes?: string }[]
  }
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
  const { loadPitchAnalysisFromDbStrict } =
    await import('@/db/services/session-pitch-analysis-service')
  await seedDemoLyrics(song as Parameters<typeof seedDemoLyrics>[0])
  // False once an earlier test in this file has stored them: either way,
  // the notes must be there.
  await seedBundledNotes(song as Parameters<typeof seedBundledNotes>[0])
  expect(
    await loadPitchAnalysisFromDbStrict(demoSessionId(SONG)),
  ).not.toBeNull()
  return demoSessionId(SONG)
}

/** The example on a hosted mixer, loaded, with its lyrics on the stage. */
async function mountTheExample(): Promise<() => HostedMixerControls> {
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
  return () => controls()!
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

/** Frames that arrive, which this suite's never do (setup-common.ts). */
function letFramesRun(): void {
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) =>
    setTimeout(() => cb(performance.now()), 0),
  )
}

// ── A held last word, lit for as long as it is held ──────────────────────
//
// The example ships only word starts for the line that ends on "dark", so
// the end comes from the notes it ships with (bundled-notes.ts) and the
// sung-end rule (lyric-sung-end.ts). Both the stage and the small window
// must sweep "dark" across the held note: not across the eleven silent
// seconds after it, and not in a third of a second.
describe('a held last word in the room', () => {
  it('sweeps "dark" across the held note, on the stage and in the window', async () => {
    const controls = await mountTheExample()
    // About the sweep, not the seek: frames arrive, as on a phone in front.
    letFramesRun()
    controls().seek(AT)
    expect(controls().elapsed()).toBe(AT)

    // The held note ends at 114.015 s (the notes' own analysis); the sung
    // end adds the release tail, so "dark" runs 113.23 s to 114.365 s.
    const expected = (AT - 113.23) / (114.0154 + 0.35 - 113.23)
    await waitFor(() => {
      const glance = controls().lyricGlance()
      expect(glance.words.at(-1)).toBe('dark')
      expect(glance.current).toBe(DARK_LINE)
      expect(glance.sungUpTo).toBe(10)
      expect(glance.sweep).toBeCloseTo(expected, 2)
    })
    await waitFor(() => {
      const line = stageLine()
      expect(line?.text).toBe(DARK_LINE)
      expect(line?.sweep).toBe(`${(expected * 100).toFixed(1)}%`)
    })
  })
})

// ── A seek the room asks for lands as a tapped line does ─────────────────
//
// The room seeks the mixer for the system's progress bar: the notification
// and the shade on Android, the lock screen. The app is usually behind
// another one then, where no frame comes to find the new line, and the
// singer may have scrolled the lyrics away just before. A tapped line copes
// with both, and so must this.
describe('a seek the room asks for', () => {
  it('finds the line it lands on without waiting for a frame', async () => {
    const controls = await mountTheExample()

    controls().seek(AT)

    // No frame has run: none ever does in this suite.
    expect(controls().lyricGlance().current).toBe(DARK_LINE)
    expect(stageLine()?.text).toBe(DARK_LINE)
  })

  it('puts that line back in the middle, after the singer scrolled away', async () => {
    const controls = await mountTheExample()
    // Frames arrive here, so only the scroll is under test.
    letFramesRun()
    fireEvent.wheel(screen.getByTestId('karaoke-lyrics'))
    const centre = vi.mocked(Element.prototype.scrollIntoView)
    centre.mockClear()

    controls().seek(AT)

    await waitFor(() => {
      const centred = centre.mock.contexts.map((line) =>
        ((line as HTMLElement).textContent ?? '').trim(),
      )
      expect(centred).toContain(DARK_LINE)
    })
  })
})
