// ============================================================
// wild-analysis — read a separated song once for the Field Book.
//
// Three readings the app already makes, on the song's own stems from
// IndexedDB: the vocal's notes through midi-generator's detectNotes,
// the key those notes imply through detectKeyFromNotes, and the
// chords under them through the same STFT → NNLS chroma → detectChords
// chain the Spectral Workbench runs. The instrumental is decimated to
// 11 kHz before the STFT — chroma needs nothing above 5 kHz and a
// four-minute song at full rate is a hundred megabytes of frames.
//
// Every outside call is injectable (WildAnalysisDeps) so the reading
// can be tested without audio; the browser wiring is defaultDeps().
// ============================================================

import type { UvrStemType } from '@/db/entities'
import { getStemBlobUrl } from '@/db/services/uvr-service'
import { computeNNLSChroma, detectChords, simplifyChordSequence, } from '@/lib/chord-detector'
import type { WildBook, WildChord, WildKey, WildNote } from '@/lib/ear/wild'
import { buildWildBook, pitchClassOfName } from '@/lib/ear/wild'
import type { KeyEstimate, KeyNote } from '@/lib/key-detection/key-detector'
import { detectKeyFromNotes } from '@/lib/key-detection/key-detector'
import type { MidiNoteEvent } from '@/lib/midi-generator'
import { DEFAULT_BPM, detectNotes, TICKS_PER_BEAT } from '@/lib/midi-generator'
import { stftForward } from '@/lib/stft-engine'
import type { UvrSession } from '@/stores/uvr-store'
import type { ChordFrame } from '@/types'

export interface WildStems {
  vocal: AudioBuffer
  instrumental: AudioBuffer
  /** The split's bass part when the song had a stem split. */
  bass: AudioBuffer | null
}

export interface WildReading {
  book: WildBook
  stems: WildStems
}

export type WildPhase = 'stems' | 'notes' | 'chords'

export interface WildProgress {
  phase: WildPhase
  /** 0..100 across the whole reading. */
  pct: number
}

export interface WildAnalysisDeps {
  stemUrl: (session: UvrSession, stem: UvrStemType) => Promise<string | null>
  fetchBytes: (url: string) => Promise<ArrayBuffer>
  decode: (bytes: ArrayBuffer) => Promise<AudioBuffer>
  detectNotes: (
    mono: Float32Array,
    sampleRate: number,
    onProgress?: (pct: number) => void,
  ) => Promise<MidiNoteEvent[]>
  detectKey: (notes: KeyNote[]) => KeyEstimate
  chordFrames: (mono: Float32Array, sampleRate: number) => ChordFrame[]
}

/** Chroma analysis rate and frame: 2.7 Hz bins, a hop of 186 ms. */
export const CHORD_RATE = 11_025
export const CHORD_FFT = 4096
export const CHORD_HOP = 2048

export function monoOf(buffer: AudioBuffer): Float32Array {
  const left = buffer.getChannelData(0)
  if (buffer.numberOfChannels === 1) return left
  const mono = new Float32Array(left.length)
  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    const data = buffer.getChannelData(channel)
    for (let i = 0; i < mono.length; i++) mono[i] += data[i]
  }
  const scale = 1 / buffer.numberOfChannels
  for (let i = 0; i < mono.length; i++) mono[i] *= scale
  return mono
}

/** Decimate by an integer factor with a box average — enough of an
 *  anti-alias for chroma. */
export function decimate(mono: Float32Array, factor: number): Float32Array {
  if (factor <= 1) return mono
  const out = new Float32Array(Math.floor(mono.length / factor))
  for (let i = 0; i < out.length; i++) {
    let sum = 0
    const base = i * factor
    for (let k = 0; k < factor; k++) sum += mono[base + k]
    out[i] = sum / factor
  }
  return out
}

/** detectNotes writes ticks at the generator's fixed tempo. */
export function noteSeconds(events: readonly MidiNoteEvent[]): WildNote[] {
  const ticksPerSecond = (TICKS_PER_BEAT * DEFAULT_BPM) / 60
  return events.map((event) => ({
    midi: event.midi,
    startS: event.tickOn / ticksPerSecond,
    endS: event.tickOff / ticksPerSecond,
  }))
}

export function keyOf(estimate: KeyEstimate): WildKey {
  return {
    tonicPc: estimate.tonic,
    mode: estimate.mode === 'minor' ? 'minor' : 'major',
    keyName: estimate.keyName,
  }
}

/** Chord frames are onsets; each lasts until the next, the last to
 *  the end of the song. Unknown roots are dropped. */
export function chordsOf(
  frames: readonly ChordFrame[],
  durationS: number,
): WildChord[] {
  const chords: WildChord[] = []
  frames.forEach((frame, i) => {
    const rootPc = pitchClassOfName(frame.root)
    if (rootPc === null) return
    const endS = i + 1 < frames.length ? frames[i + 1].time : durationS
    if (endS <= frame.time) return
    chords.push({ rootPc, startS: frame.time, endS })
  })
  return chords
}

/** The Workbench's chain on a mono signal at CHORD_RATE. */
export function chordFramesOf(
  mono: Float32Array,
  sampleRate: number,
): ChordFrame[] {
  const stft = stftForward(mono, CHORD_FFT, CHORD_HOP, 'hann')
  const spectra: Float32Array[] = []
  for (let frame = 0; frame < stft.nFrames; frame++) {
    const magnitudes = new Float32Array(stft.nFreq)
    const base = frame * stft.nFreq * 2
    for (let bin = 0; bin < stft.nFreq; bin++) {
      const re = stft.data[base + bin * 2]
      const im = stft.data[base + bin * 2 + 1]
      magnitudes[bin] = Math.sqrt(re * re + im * im)
    }
    spectra.push(magnitudes)
  }
  const chroma = spectra.map((spectrum) =>
    computeNNLSChroma(spectrum, sampleRate, CHORD_FFT),
  )
  return simplifyChordSequence(
    detectChords(chroma, CHORD_HOP / sampleRate, {
      medianWindow: 3,
      minDuration: 0.25,
    }),
  )
}

async function stemUrlOf(
  session: UvrSession,
  stem: UvrStemType,
): Promise<string | null> {
  const stored = await getStemBlobUrl(session.sessionId, stem)
  if (stored !== null) return stored
  const output =
    stem === 'vocal'
      ? session.outputs?.vocal
      : stem === 'instrumental'
        ? session.outputs?.instrumental
        : undefined
  return output !== undefined && output !== '' ? output : null
}

export function defaultDeps(ctx: BaseAudioContext): WildAnalysisDeps {
  return {
    stemUrl: stemUrlOf,
    fetchBytes: async (url) => {
      const response = await fetch(url)
      if (!response.ok) throw new Error('That stem could not be read.')
      return response.arrayBuffer()
    },
    decode: (bytes) => ctx.decodeAudioData(bytes),
    detectNotes,
    detectKey: detectKeyFromNotes,
    chordFrames: chordFramesOf,
  }
}

const yieldToPaint = (): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, 0))

/** Read one song. Throws when a stem is missing or will not decode. */
export async function readWildSession(
  session: UvrSession,
  deps: WildAnalysisDeps,
  onProgress?: (progress: WildProgress) => void,
): Promise<WildReading> {
  const report = (phase: WildPhase, pct: number) =>
    onProgress?.({ phase, pct: Math.round(pct) })

  report('stems', 0)
  const loadStem = async (stem: UvrStemType): Promise<AudioBuffer | null> => {
    const url = await deps.stemUrl(session, stem)
    if (url === null) return null
    const bytes = await deps.fetchBytes(url)
    return deps.decode(bytes)
  }
  const vocal = await loadStem('vocal')
  report('stems', 8)
  const instrumental = await loadStem('instrumental')
  report('stems', 16)
  if (!vocal || !instrumental) {
    throw new Error('This song has no vocal and instrumental stems yet.')
  }
  const bass = await loadStem('bass')
  report('stems', 20)
  await yieldToPaint()

  const vocalMono = monoOf(vocal)
  const events = await deps.detectNotes(vocalMono, vocal.sampleRate, (pct) =>
    report('notes', 20 + pct * 0.5),
  )
  const notes = noteSeconds(events)
  const key = keyOf(
    deps.detectKey(
      notes.map((note) => ({
        midi: note.midi,
        startSec: note.startS,
        endSec: note.endS,
      })),
    ),
  )
  report('chords', 72)
  await yieldToPaint()

  const harmonic = bass ?? instrumental
  const factor = Math.max(1, Math.round(harmonic.sampleRate / CHORD_RATE))
  const harmonicMono = decimate(monoOf(harmonic), factor)
  const frames = deps.chordFrames(harmonicMono, harmonic.sampleRate / factor)
  const chords = chordsOf(frames, harmonic.duration)
  report('chords', 100)

  return {
    book: buildWildBook(session.sessionId, notes, chords, key),
    stems: { vocal, instrumental, bass },
  }
}
