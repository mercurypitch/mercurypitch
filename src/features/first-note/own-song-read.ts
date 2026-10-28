// ============================================================
// A song of the singer's own, read once on the phone for First note
// ============================================================
//
// The example songs carry entries read on a desktop and committed
// (first-note-entries.json). A song the singer imported and split in the
// Karaoke room has none, so the phone reads it, once, by the same rules
// (entry-rules.ts), from what the phone already holds of it:
//
//   its notes   the Karaoke room's own pitch read, kept on the phone once
//               the room has read the song. A song it has not read yet is
//               read here the way the room reads it (analyzeVocalSamples,
//               at the mixer's settings) and the notes are kept for the
//               room, so its notes over the lyrics are there next time.
//               The rules check each entry's note against them
//   its vocal   walked a chunk at a time where the phone streams, as the
//               mixer walks it (streamed-vocal-samples.ts), and decoded
//               whole where it cannot; the rules read the voice's level and
//               its pitch (YIN) at each line
//   its lines   the synced lyrics' lines, with their words, where the song
//               has them; otherwise where the voice comes in after a breath
//   its beats   the band's onsets in the lead-in before each entry, and the
//               tempo from those lead-ins together; none where the grid is
//               unclear. The band is never decoded whole where it streams
//
// MEMORY. A decoded song is what iOS killed the app for (about 180 MiB,
// stem-memory.ts), so the read holds one stem at a time and no more of it
// than the walk would. A vocal too long for the walk to hold sits out, and
// says why (`out`). Where the phone cannot stream, a stem is decoded whole
// only when the walk's ceiling allows it (`wholeDecodeFits`), and the vocal,
// walked or decoded, is let go before the band is read: only the voice at
// VOCAL_RATE goes on.
//
// THE SCREEN. The rules' work runs on the thread that draws the screen, in
// steps (entry-rules.ts), and the read lets the screen draw after every line
// and lead-in, and inside one each time SLICE_MS of work has gone by.
//
// Nothing plays. The reads are the impure edges, swappable (OwnSongReadSeams)
// so a test can run the whole read on samples of its own.

import { loadLyricsFromDb } from '@/db/services/lyrics-db-service'
import { loadPitchAnalysisFromDb, savePitchAnalysisToDb, } from '@/db/services/session-pitch-analysis-service'
import { getStemBlob } from '@/db/services/uvr-service'
import { openStemStream } from '@/features/stem-mixer/stem-stream-source'
import { canGatherStreamedVocal, gatherStreamedVocal, streamedAnalysisStep, wholeDecodeFits, windowForStep, } from '@/features/stem-mixer/streamed-vocal-samples'
import { audioDurationSecs } from '@/lib/audio-duration'
import { DECODE_RATE, decodeAudioBytes } from '@/lib/decode-audio-to-mono'
import type { MergedNote } from '@/lib/midi-generator'
import type { VocalAnalysis } from '@/lib/pitch-pipeline'
import { analyzeVocalSamples, pitchHistoryFromNotes, VOCAL_ANALYSIS_DEFAULTS, } from '@/lib/pitch-pipeline'
import type { EntryReading, FoundEntry, OnsetGrid, RuleSteps, Samples, } from './entry-rules'
import { BAND_RATE, beatsBefore, breathLines, entrySteps, loudness, lyricLines, middleNote, onsetSteps, tempoOf, VOCAL_RATE, } from './entry-rules'
import type { FirstNoteEntry } from './first-note-songs'

/** Why a song sits out before its lines are read. */
export type OwnSongOut = 'too-long' | 'no-voice'

/** What a read of one song found. */
export interface OwnSongRead {
  readonly entries: FirstNoteEntry[]
  /** Each line that is not an entry, and why: for the developer's log. */
  readonly dropped: readonly string[]
  /**
   * Why the song sits out with nothing read: too long for this phone to
   * hold, or no voice to read. Absent for a song that was read.
   */
  readonly out?: OwnSongOut
}

export interface OwnSongReadRun {
  /** How far the read is, 0 to 100. */
  readonly onProgress?: (percent: number) => void
  readonly signal?: AbortSignal
}

/** A stretch of the band to read, s. */
export interface BandSpan {
  readonly from: number
  readonly to: number
}

/** A stretch of the band, mono, and where it starts. */
export interface BandStretch extends Samples {
  readonly start: number
}

/** The vocal, mono: what `gatherStreamedVocal` gives, or a whole decode's. */
export interface VocalStem {
  readonly samples: Float32Array
  readonly sampleRate: number
  /** The stream's samples each kept one stands for (1 for a decode). */
  readonly step: number
}

/** The read's impure edges. */
export interface OwnSongReadSeams {
  /** A stem from the phone's store; null when the song has none. */
  stem: (
    sessionId: string,
    type: 'vocal' | 'instrumental',
  ) => Promise<Blob | null>
  /** The song's notes as the Karaoke room keeps them; null for none yet. */
  storedNotes: (sessionId: string) => Promise<readonly MergedNote[] | null>
  /** Keep a fresh read's notes, for the Karaoke room as well. */
  keepNotes: (sessionId: string, analysis: VocalAnalysis) => Promise<void>
  /** The song's lyrics when they are synced; null otherwise. */
  syncedLyrics: (sessionId: string) => Promise<string | null>
  /**
   * The vocal, mono, walked or decoded; `onProgress` from 0 to 1. Null when
   * it is too long for this phone to hold.
   */
  vocal: (
    blob: Blob,
    run: { onProgress: (fraction: number) => void; signal?: AbortSignal },
  ) => Promise<VocalStem | null>
  /** The band at each span, mono; null when it is too long to read here. */
  band: (
    blob: Blob,
    spans: readonly BandSpan[],
    signal?: AbortSignal,
  ) => Promise<BandStretch[] | null>
  analyze: typeof analyzeVocalSamples
  /** A moment for the screen to draw. */
  breathe: () => Promise<void>
  /** The time, ms, for how long the work has run since the screen drew. */
  now: () => number
}

/** Read past the lead-in's edges, s, for the onsets' local mean there. */
const SPAN_MARGIN_SEC = 0.3

/** Work between moments for the screen, ms: well inside a frame. */
const SLICE_MS = 8

function abortError(): Error {
  const error = new Error('The read was stopped.')
  error.name = 'AbortError'
  return error
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted === true) throw abortError()
}

/**
 * `samples` at `rate` kept at about `target`: each kept sample the mean of
 * a whole number of them. The rules read the voice at VOCAL_RATE and the
 * band at BAND_RATE; a phone's stems are at 44.1 or 48 kHz.
 */
export function keepNear(
  samples: Float32Array,
  rate: number,
  target: number,
): Samples {
  const step = Math.max(1, Math.round(rate / target))
  if (step === 1) return { samples, rate }
  const kept = new Float32Array(Math.floor(samples.length / step))
  for (let i = 0; i < kept.length; i++) {
    let sum = 0
    for (let j = 0; j < step; j++) sum += samples[i * step + j]
    kept[i] = sum / step
  }
  return { samples: kept, rate: rate / step }
}

/**
 * A stem decoded whole, where it fits as the walk's ceiling allows
 * (`wholeDecodeFits`): null where it does not.
 */
async function decodeWhole(blob: Blob): Promise<AudioBuffer | null> {
  const seconds = await audioDurationSecs(blob)
  if (!wholeDecodeFits(seconds, blob.size, DECODE_RATE)) return null
  return await decodeAudioBytes(await blob.arrayBuffer())
}

/**
 * The vocal decoded whole, kept as the walk keeps it: channel 0, at the
 * walk's step for its length (`streamedAnalysisStep`). Null when too long.
 */
async function decodeVocal(blob: Blob): Promise<VocalStem | null> {
  const whole = await decodeWhole(blob)
  if (whole === null) return null
  const step = streamedAnalysisStep(whole.duration, whole.sampleRate)
  if (step === null) return null
  const kept = keepNear(
    whole.getChannelData(0),
    whole.sampleRate,
    whole.sampleRate / step,
  )
  return { samples: kept.samples, sampleRate: kept.rate, step }
}

/** Channel 0 from `span.from` to `span.to`, from the stem's own stream. */
async function streamSpan(
  stream: {
    readonly sampleRate: number
    chunks(fromSeconds: number): AsyncIterable<{
      readonly buffer: AudioBuffer
      readonly timestamp: number
    }>
  },
  span: BandSpan,
): Promise<BandStretch> {
  const rate = stream.sampleRate
  const samples = new Float32Array(Math.ceil((span.to - span.from) * rate))
  for await (const chunk of stream.chunks(span.from)) {
    const data = chunk.buffer.getChannelData(0)
    const ratio = rate / chunk.buffer.sampleRate
    const first = Math.round((chunk.timestamp - span.from) * rate)
    for (let i = 0; i < data.length; i++) {
      const at = first + Math.floor(i * ratio)
      if (at < 0) continue
      if (at >= samples.length) break
      samples[at] = data[i]
    }
    if (chunk.timestamp + data.length / chunk.buffer.sampleRate >= span.to) {
      break
    }
  }
  return { ...keepNear(samples, rate, BAND_RATE), start: span.from }
}

/** Channel 0 of a whole decode, cut to `span`. */
function cutSpan(
  whole: { samples: Float32Array; sampleRate: number },
  span: BandSpan,
): BandStretch {
  const rate = whole.sampleRate
  const from = Math.max(0, Math.round(span.from * rate))
  const to = Math.min(whole.samples.length, Math.round(span.to * rate))
  const samples = whole.samples.slice(from, Math.max(from, to))
  return { ...keepNear(samples, rate, BAND_RATE), start: from / rate }
}

const realSeams: OwnSongReadSeams = {
  stem: (sessionId, type) => getStemBlob(sessionId, type),
  storedNotes: async (sessionId) => {
    const stored = await loadPitchAnalysisFromDb(sessionId)
    if (stored === null || stored.segmentedNotes.length === 0) return null
    return stored.segmentedNotes
  },
  keepNotes: async (sessionId, analysis) => {
    await savePitchAnalysisToDb(sessionId, {
      mergedNotes: analysis.mergedNotes,
      segmentedNotes: analysis.segmentedNotes,
      pitchHistory: pitchHistoryFromNotes(analysis.segmentedNotes),
    })
  },
  syncedLyrics: async (sessionId) => {
    const lyrics = await loadLyricsFromDb(sessionId)
    return lyrics !== null && lyrics.format === 'lrc' ? lyrics.text : null
  },
  vocal: async (blob, run) => {
    const stream = await openStemStream(blob)
    if (stream === null) return await decodeVocal(blob)
    try {
      if (!canGatherStreamedVocal(stream)) return null
      return await gatherStreamedVocal(stream, run)
    } finally {
      stream.dispose()
    }
  },
  band: async (blob, spans, signal) => {
    const stream = await openStemStream(blob)
    if (stream === null) {
      const whole = await decodeWhole(blob)
      if (whole === null) return null
      const channel = {
        samples: whole.getChannelData(0),
        sampleRate: whole.sampleRate,
      }
      return spans.map((span) => cutSpan(channel, span))
    }
    try {
      const stretches: BandStretch[] = []
      for (const span of spans) {
        throwIfAborted(signal)
        stretches.push(await streamSpan(stream, span))
      }
      return stretches
    } finally {
      stream.dispose()
    }
  },
  analyze: analyzeVocalSamples,
  breathe: () => new Promise((resolve) => setTimeout(resolve, 0)),
  now: () => performance.now(),
}

let seams: OwnSongReadSeams = realSeams

/** Swap the impure edges. Tests only; `null` puts the real ones back. */
export function setOwnSongReadSeams(
  next: Partial<OwnSongReadSeams> | null,
): void {
  seams = next === null ? realSeams : { ...realSeams, ...next }
}

/** A moment for the screen, and the read stopped there if it was let go. */
async function breathe(signal: AbortSignal | undefined): Promise<void> {
  await seams.breathe()
  throwIfAborted(signal)
}

/**
 * `steps` run to their end, the screen drawing each time SLICE_MS of work
 * has gone by and once at their end: a line or a lead-in, however long,
 * never holds the screen for longer than a slice.
 */
async function paced<T>(
  steps: RuleSteps<T>,
  signal: AbortSignal | undefined,
): Promise<T> {
  let since = seams.now()
  for (;;) {
    const step = steps.next()
    if (step.done === true) {
      await breathe(signal)
      return step.value
    }
    if (seams.now() - since >= SLICE_MS) {
      await breathe(signal)
      since = seams.now()
    }
  }
}

/**
 * Read one song for its entries. A song too long for this phone to hold,
 * or with no voice to read, comes back with none, and why (`out`). Throws an
 * AbortError when `run.signal` aborts, and the cause when the song cannot
 * be read (a file that will not decode, a store that will not answer).
 */
export async function readOwnSong(
  sessionId: string,
  run: OwnSongReadRun = {},
): Promise<OwnSongRead> {
  const { signal } = run
  let shown = -1
  const report = (percent: number): void => {
    const rounded = Math.max(0, Math.min(100, Math.round(percent)))
    if (rounded === shown) return
    shown = rounded
    run.onProgress?.(rounded)
  }
  report(0)

  const [vocalBlob, bandBlob, stored] = await Promise.all([
    seams.stem(sessionId, 'vocal'),
    seams.stem(sessionId, 'instrumental'),
    seams.storedNotes(sessionId),
  ])
  throwIfAborted(signal)
  if (vocalBlob === null) return { entries: [], dropped: [], out: 'no-voice' }

  // The whole vocal is let go inside readVoice: from here on the read holds
  // only the voice at VOCAL_RATE, so the band is never read beside it.
  const voiced = await readVoice(sessionId, vocalBlob, stored, report, signal)
  if (voiced === null) return { entries: [], dropped: [], out: 'too-long' }
  report(80)
  const { voice, notes } = voiced
  if (notes.length === 0) return { entries: [], dropped: ['no notes'] }

  const level = loudness(voice.samples, voice.rate)
  const lyrics = await seams.syncedLyrics(sessionId)
  throwIfAborted(signal)
  const synced = lyrics === null ? [] : lyricLines(lyrics)
  const reading: EntryReading = {
    vocal: voice,
    level,
    notes,
    lines: synced.length > 0 ? synced : breathLines(level),
  }
  const middle = middleNote(notes)
  const found: FoundEntry[] = []
  const dropped: string[] = []
  for (let i = 0; i < reading.lines.length; i++) {
    const entry = await paced(entrySteps(reading, i, middle), signal)
    if (typeof entry === 'string') dropped.push(entry)
    else if (entry !== null) found.push(entry)
    report(80 + (5 * (i + 1)) / reading.lines.length)
  }
  report(85)
  if (found.length === 0) return { entries: [], dropped }

  const beats = await beatsOf(bandBlob, found, report, signal)
  report(100)
  return {
    entries: found.map((entry, i) => ({
      at: entry.at,
      midi: entry.midi,
      from: entry.from,
      until: entry.until,
      beats: beats[i],
      words: entry.words,
    })),
    dropped,
  }
}

/**
 * The voice at VOCAL_RATE and the song's notes, or null for a vocal too
 * long for this phone to hold. The vocal as walked or decoded stays here:
 * only the voice at VOCAL_RATE leaves.
 */
async function readVoice(
  sessionId: string,
  blob: Blob,
  stored: readonly MergedNote[] | null,
  report: (percent: number) => void,
  signal: AbortSignal | undefined,
): Promise<{ voice: Samples; notes: readonly MergedNote[] } | null> {
  // The walk is most of the wait on a phone; the room's read, where the
  // song needs one, is most of the rest.
  const walkShare = stored === null ? 35 : 80
  const vocal = await seams.vocal(blob, {
    onProgress: (fraction) => report(fraction * walkShare),
    signal,
  })
  throwIfAborted(signal)
  if (vocal === null) return null
  const notes =
    stored ?? (await notesOf(sessionId, vocal, walkShare, report, signal))
  return { voice: keepNear(vocal.samples, vocal.sampleRate, VOCAL_RATE), notes }
}

/** The room's read of the vocal, as the room reads it, kept for the room. */
async function notesOf(
  sessionId: string,
  vocal: VocalStem,
  from: number,
  report: (percent: number) => void,
  signal: AbortSignal | undefined,
): Promise<readonly MergedNote[]> {
  const analysis = await seams.analyze(
    vocal.samples,
    vocal.sampleRate,
    // The same span of time at the rate the samples were kept at.
    {
      bufferSize: windowForStep(VOCAL_ANALYSIS_DEFAULTS.bufferSize, vocal.step),
    },
    { signal, onProgress: (percent) => report(from + (percent * 45) / 100) },
  )
  throwIfAborted(signal)
  // An empty read is not kept: it would read back as a song the room has
  // read, and stop the room offering to (jam-pitch-provision-store.ts).
  if (analysis.segmentedNotes.length > 0) {
    await seams.keepNotes(sessionId, analysis).catch(() => undefined)
  }
  return analysis.segmentedNotes
}

/** Each entry's beats, from the band's lead-ins; none without a band. */
async function beatsOf(
  bandBlob: Blob | null,
  entries: readonly FoundEntry[],
  report: (percent: number) => void,
  signal: AbortSignal | undefined,
): Promise<number[][]> {
  const none = entries.map(() => [])
  if (bandBlob === null) return none
  const spans = entries.map((entry) => ({
    from: Math.max(0, entry.from - SPAN_MARGIN_SEC),
    to: entry.at + SPAN_MARGIN_SEC,
  }))
  // A band that cannot be read, or is too long to read whole here, costs
  // the countdown its beats, not the song.
  const stretches = await seams.band(bandBlob, spans, signal).catch((error) => {
    if (signal?.aborted === true) throw abortError()
    console.warn('[first-note] the band would not read:', error)
    return null
  })
  throwIfAborted(signal)
  if (stretches === null) return none
  const grids: OnsetGrid[] = []
  for (const [i, stretch] of stretches.entries()) {
    grids.push(await paced(onsetSteps(stretch, stretch.start), signal))
    report(85 + (13 * (i + 1)) / stretches.length)
  }
  const bpm = tempoOf(grids)
  return entries.map((entry, i) =>
    beatsBefore(grids[i], bpm, entry.from, entry.at),
  )
}
