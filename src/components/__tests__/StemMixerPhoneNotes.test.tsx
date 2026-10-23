// ============================================================
// The phone stage's notes row, wired to the mixer
// ============================================================
//
// KaraokeMoreSheet.test.tsx and KaraokeMobileStage.more.test.tsx prove the
// row follows what the stage is told. What the mixer tells the stage is
// another matter, and it is where the row was dead: the stage was handed an
// onEnsureNotes that did nothing on a phone that streams the song, and nothing
// once the analysis had its notes (a song with no lyrics then has no words to
// carry them, so the row never changed and a tap did nothing). The row is the
// stage's "this finds the notes", so the mixer offers it only while asking
// would start an analysis. Since 2026-10-23 a phone that streams the song
// gathers the vocal from its stream (streamed-vocal-samples.ts), so the row
// and the mic find the notes there too: an imported song had no pitch guide
// on iOS 27, which streams.
//
// So this mounts the mixer whole at phone width, the analysis standing in for
// the real one so that each way it can end is chosen, and looks for the row
// the way a thumb would. The device class is the one setting between a phone
// that streams the song and a computer that decodes the whole of it.
//
// While the song is still loading there is no vocal to analyse on any device,
// so the row waits for one. Find my key reads the same vocal, decoded or
// streamed, so on any device it says the song is still loading.

import { cleanup, fireEvent, render, screen, waitFor, within, } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { VocalAnalysis } from '@/lib/pitch-pipeline'

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
  isNarrow: () => true,
  isPhoneStage: () => true,
  isMobile: () => true,
}))

// The silent <audio> that unlocks playback on iOS is a browser concern, and
// jsdom cannot play it.
vi.mock('@/lib/audio-unlock', () => ({
  installAudioUnlock: () => () => undefined,
  unlockAudio: () => undefined,
}))

// A phone streams the song and a computer decodes it whole: one setting.
const device = vi.hoisted(() => ({ klass: 'desktop' as 'desktop' | 'mobile' }))

vi.mock('@/lib/device-tier', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  deviceClass: () => device.klass,
}))

// jsdom has no AudioDecoder, so the stream a phone would open is stood in for:
// thirty seconds that nobody plays. Only a phone asks for it, and a stalled one
// never opens, as for a song still loading.
const streaming = vi.hoisted(() => ({ stalled: false }))

vi.mock('@/features/stem-mixer/stem-streaming-load', () => ({
  loadStreamedStem: async () => {
    if (streaming.stalled) await new Promise(() => {})
    return {
      stream: {
        sampleRate: 44100,
        channelCount: 2,
        durationSeconds: 30,
        // eslint-disable-next-line require-yield
        chunks: async function* () {
          return
        },
        dispose: () => undefined,
      },
      displayBuffer: {
        duration: 30,
        length: 512,
        numberOfChannels: 1,
        sampleRate: 44100,
        getChannelData: () => new Float32Array(512),
        copyToChannel: () => undefined,
      },
      displaySampleRate: 44100,
      durationSeconds: 30,
      sampleRate: 44100,
      channelCount: 2,
      displayBytes: 2048,
    }
  },
}))

// No measured range and no voice type picked: Find my key asks which voice.
vi.mock('@/db/services/voiceprint-service', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  listVoiceprints: async () => [],
}))

// The analysis the notes row asks for: pending, or ended, as each test says.
const pipeline = vi.hoisted(() => ({ analyze: vi.fn() }))

vi.mock('@/lib/pitch-pipeline', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  analyzeVocalSamples: pipeline.analyze,
}))

// What the analysis keeps for next time is not under test, and a write that
// outlived its test would be an unhandled rejection in another file's run.
vi.mock(
  '@/db/services/session-pitch-analysis-service',
  async (importOriginal) => ({
    ...(await importOriginal<Record<string, unknown>>()),
    loadPitchAnalysisFromDb: async () => null,
    savePitchAnalysisToDb: async () => undefined,
  }),
)

const toasts = vi.hoisted(() => ({ shown: [] as string[] }))

vi.mock('@/stores/notifications-store', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return {
    ...actual,
    showNotification: (message: string, kind?: string) => {
      toasts.shown.push(message)
      return (actual.showNotification as (m: string, k?: string) => unknown)(
        message,
        kind,
      )
    },
  }
})

import { StemMixer } from '@/components/StemMixer'
import { resetNotifications } from '@/stores/notifications-store'

beforeEach(() => {
  device.klass = 'desktop'
  streaming.stalled = false
  toasts.shown = []
  pipeline.analyze.mockReset()
  resetNotifications()
  localStorage.clear()
  Element.prototype.scrollTo = vi.fn()
  Element.prototype.scrollIntoView = vi.fn()
  ;(
    AudioContext.prototype as unknown as Record<string, unknown>
  ).decodeAudioData = async () =>
    ({
      duration: 30,
      length: 512,
      numberOfChannels: 2,
      sampleRate: 44100,
      getChannelData: () => new Float32Array(512),
    }) as unknown as AudioBuffer
  // The stems download as a few bytes each, and the lyrics search finds
  // nothing for this title: the song has no words for notes to sit on.
  vi.stubGlobal('fetch', async () => ({
    ok: true,
    status: 200,
    body: null,
    headers: new Headers(),
    arrayBuffer: async () => new ArrayBuffer(64),
    json: async () => [],
  }))
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

/** The mixer at phone width, its song loaded. */
async function mountPhone(): Promise<HTMLElement> {
  render(() => (
    <StemMixer
      stems={{ vocal: 'blob:vocal', instrumental: 'blob:instrumental' }}
      sessionId="phone-notes"
      songTitle="Consent"
    />
  ))
  const stage = await screen.findByTestId('karaoke-mobile-stage')
  await waitFor(() => {
    expect(stage.textContent).toContain('0:30')
  })
  return stage
}

const NOTES_ROW = 'Show notes over the lyrics'
const FINDS_FIRST = "Finds this song's notes first"
const FINDING = 'Finding the notes'

/** More, open on the stage. Returns the sheet's queries. */
function openMore(stage: HTMLElement) {
  fireEvent.click(within(stage).getByRole('button', { name: 'More' }))
  return within(screen.getByTestId('karaoke-more-sheet'))
}

/** An analysis that ends when the test says so. */
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

/** What a singer would see of it: notes found, as the pipeline returns them. */
function foundNotes(): VocalAnalysis {
  const notes = [
    { midi: 62, noteName: 'D4', startSec: 12, endSec: 13.3 },
    { midi: 64, noteName: 'E4', startSec: 13.4, endSec: 14.6 },
    { midi: 66, noteName: 'F#4', startSec: 14.7, endSec: 16 },
  ]
  return {
    algo: 'yin',
    rawDetections: [],
    contour: [],
    mergedNotes: notes,
    segmentedNotes: notes,
  }
}

describe('the notes row, on a phone that streams the song', () => {
  it('is offered for a song with no notes, and a tap finds them in the stream', async () => {
    device.klass = 'mobile'
    const stage = await mountPhone()
    const sheet = openMore(stage)
    const pending = deferred<VocalAnalysis>()
    pipeline.analyze.mockReturnValueOnce(pending.promise)

    fireEvent.click(sheet.getByRole('switch', { name: NOTES_ROW }))

    // The stream's thirty seconds, one channel at its own rate, gathered
    // before the detector runs.
    await waitFor(() => {
      expect(pipeline.analyze).toHaveBeenCalledTimes(1)
    })
    const [samples, sampleRate, options] = pipeline.analyze.mock.calls[0] as [
      Float32Array,
      number,
      { bufferSize: number },
    ]
    expect([samples.length, sampleRate, options.bufferSize]).toEqual([
      30 * 44100,
      44100,
      1024,
    ])
  })
})

describe('the notes row, on a device that decodes the song', () => {
  it('is offered for a song with no notes, and a tap finds them', async () => {
    const stage = await mountPhone()
    const sheet = openMore(stage)
    const pending = deferred<VocalAnalysis>()
    pipeline.analyze.mockReturnValueOnce(pending.promise)
    const before = [
      sheet
        .getByRole('switch', { name: NOTES_ROW })
        .getAttribute('aria-checked'),
      sheet.queryByText(FINDS_FIRST) !== null,
    ]

    fireEvent.click(sheet.getByRole('switch', { name: NOTES_ROW }))

    expect(before).toEqual(['false', true])
    expect(pipeline.analyze).toHaveBeenCalledTimes(1)
    expect([
      sheet
        .getByRole('switch', { name: NOTES_ROW })
        .getAttribute('aria-checked'),
      sheet.queryByText(FINDING) !== null,
    ]).toEqual(['true', true])
  })

  it('goes once the analysis has its notes, though the song has no lyrics to carry them', async () => {
    const stage = await mountPhone()
    const sheet = openMore(stage)
    const pending = deferred<VocalAnalysis>()
    pipeline.analyze.mockReturnValueOnce(pending.promise)
    fireEvent.click(sheet.getByRole('switch', { name: NOTES_ROW }))

    pending.resolve(foundNotes())

    // Notes, but no words to put them on: a row that read "finds this song's
    // notes first" again would be a switch whose tap does nothing.
    await waitFor(() => {
      expect(sheet.queryByRole('switch', { name: NOTES_ROW })).toBeNull()
    })
    expect(sheet.getByRole('switch', { name: 'Loop A to B' })).toBeTruthy()
    expect(pipeline.analyze).toHaveBeenCalledTimes(1)
  })

  it('is offered again after an analysis that failed, and a tap runs it again', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const stage = await mountPhone()
    const sheet = openMore(stage)
    pipeline.analyze.mockRejectedValueOnce(new Error('Buffer too short'))
    pipeline.analyze.mockReturnValueOnce(new Promise(() => undefined))
    fireEvent.click(sheet.getByRole('switch', { name: NOTES_ROW }))

    await waitFor(() => {
      expect(sheet.queryByText(FINDS_FIRST)).not.toBeNull()
    })
    // A thumb lands long after the run has settled; one turn of the event loop
    // stands in for that.
    await new Promise((resolve) => setTimeout(resolve, 0))
    const failed = [
      sheet
        .getByRole('switch', { name: NOTES_ROW })
        .getAttribute('aria-checked'),
      pipeline.analyze.mock.calls.length,
      // The analysis says what went wrong, once, in its own words.
      toasts.shown.filter((message) => message === 'Buffer too short').length,
    ]
    fireEvent.click(sheet.getByRole('switch', { name: NOTES_ROW }))

    expect(failed).toEqual(['false', 1, 1])
    expect(pipeline.analyze).toHaveBeenCalledTimes(2)
    expect(sheet.queryByText(FINDING)).not.toBeNull()
  })
})

describe('the mic, which asks for the notes on its own account', () => {
  it('starts the analysis when it goes on over a song with no notes, on a device that decodes', async () => {
    pipeline.analyze.mockReturnValueOnce(new Promise(() => undefined))
    await mountPhone()

    fireEvent.click(screen.getByLabelText('Toggle your microphone'))

    expect(pipeline.analyze).toHaveBeenCalledTimes(1)
    await waitFor(() => {
      expect(toasts.shown.join('\n')).toMatch(/noise cancelling/)
    })
  })

  it('starts the analysis on a phone that streams the song too', async () => {
    device.klass = 'mobile'
    pipeline.analyze.mockReturnValueOnce(new Promise(() => undefined))
    await mountPhone()

    fireEvent.click(screen.getByLabelText('Toggle your microphone'))

    await waitFor(() => {
      expect(pipeline.analyze).toHaveBeenCalledTimes(1)
    })
  })
})

describe('while the song is still loading', () => {
  afterEach(() => {
    delete (AudioContext.prototype as { audioWorklet?: unknown }).audioWorklet
  })

  /** The mixer at phone width over stems that never finish loading. */
  function mountLoading(): Promise<HTMLElement> {
    streaming.stalled = true
    vi.stubGlobal('fetch', (url: string) =>
      String(url).startsWith('blob:')
        ? new Promise(() => {}) // the stems never finish downloading
        : Promise.resolve({ ok: true, status: 200, json: async () => [] }),
    )
    render(() => (
      <StemMixer
        stems={{ vocal: 'blob:vocal', instrumental: 'blob:instrumental' }}
        sessionId="phone-notes-loading"
        songTitle="Consent"
      />
    ))
    return screen.findByTestId('karaoke-mobile-stage')
  }

  // jsdom has no AudioWorklet, and without one the key control is off. The
  // song never leaves key 0 at 1x, which builds no engine, so empty
  // stand-ins are enough to offer Find my key.
  function offerFindMyKey(): void {
    vi.stubGlobal('AudioWorkletNode', vi.fn())
    Object.defineProperty(AudioContext.prototype, 'audioWorklet', {
      configurable: true,
      value: { addModule: async () => undefined },
    })
  }

  /** Find my key from the stage's key sheet, a voice picked when it asks
   *  for one: what the sheet then says. */
  async function findMyKeyFromTheSheet(stage: HTMLElement): Promise<string> {
    // The key button's name carries the key, which moves; its id does not.
    fireEvent.click(within(stage).getByTestId('mobile-key-shift'))
    const sheet = screen.getByRole('dialog', { name: 'Key' })
    fireEvent.click(within(sheet).getByRole('button', { name: 'Find my key' }))
    const picker = await screen.findByRole('dialog', { name: /your voice/i })
    fireEvent.click(within(picker).getByRole('button', { name: /^Tenor/ }))
    return sheet.textContent ?? ''
  }

  // A tap on the row only toasted "No vocal stem loaded".
  it('offers no notes row: there is no vocal to analyse yet', async () => {
    const stage = await mountLoading()

    const sheet = openMore(stage)

    sheet.getByRole('switch', { name: 'Loop A to B' }) // the sheet is up
    expect(sheet.queryByRole('switch', { name: NOTES_ROW })).toBeNull()
  })

  // It said the melody "cannot be found on this device", which was not so
  // for a song that will be decoded.
  it('has Find my key say the song is still loading, where it will be decoded', async () => {
    offerFindMyKey()
    const stage = await mountLoading()

    const said = await findMyKeyFromTheSheet(stage)

    expect(said).toContain(
      'The song is still loading. Press Find my key again once it plays.',
    )
  })

  it('has Find my key say the song is still loading on a phone too, which streams it', async () => {
    device.klass = 'mobile'
    offerFindMyKey()
    const stage = await mountLoading()

    const said = await findMyKeyFromTheSheet(stage)

    expect([
      said.includes('still loading'),
      said.includes('cannot be found on this device'),
    ]).toEqual([true, false])
  })
})
