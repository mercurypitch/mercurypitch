// ============================================================
// Stem transcription — measured notes from one separated instrument
// ============================================================
//
// The vocal path in `midi-generator.ts` proved the shape of this: detect a
// pitch per frame, then merge same-pitch frames into sustained notes. Every
// constant there is tuned for voice, and each one excludes the bass register:
// 65 Hz cuts off low E (41.2 Hz), a 1024-sample window is under two periods at
// that frequency, and the D2 floor drops a third of the instrument.
//
// Bass gets its own profile here, plus the correction voice does not need: a
// weak fundamental makes detectors report the octave above on attacks and
// decays, so octave slips are repaired against the line's own register.

import { PitchDetector } from '@/lib/pitch-detector'
import { midiToNote } from '@/lib/scale-data'

export interface TranscriptionProfile {
  /** Analysis window in seconds, so the sample rate can change under it. */
  windowSeconds: number
  stepSeconds: number
  /**
   * Rate the audio is decoded at for analysis. YIN costs roughly
   * window × (rate / minFrequency) per frame, so both terms shrink with the
   * rate — and bass carries nothing above `maxFrequency` anyway.
   */
  analysisSampleRate: number
  minFrequency: number
  maxFrequency: number
  minConfidence: number
  minAmplitude: number
  minMidi: number
  maxMidi: number
  minDurationSeconds: number
  maxGapSeconds: number
}

/** Four- and five-string bass, from low B0 to the top of the neck. */
export const BASS_TRANSCRIPTION_PROFILE: TranscriptionProfile = {
  windowSeconds: 0.093,
  stepSeconds: 0.04,
  // 8 kHz leaves a 4 kHz ceiling, ten times the highest note this profile
  // looks for, and cuts the work per frame by roughly thirty.
  analysisSampleRate: 8000,
  minFrequency: 28,
  maxFrequency: 400,
  minConfidence: 0.5,
  minAmplitude: 0.01,
  minMidi: 24,
  maxMidi: 60,
  minDurationSeconds: 0.09,
  maxGapSeconds: 0.06,
}

/** Analysis window in samples at whatever rate the audio actually arrived at. */
export function profileWindowSamples(
  profile: TranscriptionProfile,
  sampleRate: number,
): number {
  return Math.max(256, Math.round(profile.windowSeconds * sampleRate))
}

export interface TranscriptionFrame {
  timeSeconds: number
  midi: number
  clarity: number
}

export interface TranscribedNote {
  midi: number
  noteName: string
  startSeconds: number
  durationSeconds: number
  /** Median detector clarity across the frames that formed this note. */
  confidence: number
}

export interface StemTranscription {
  notes: readonly TranscribedNote[]
  /** Share of analysed frames that produced a confident pitch, 0–1. */
  coverage: number
  analysedSeconds: number
}

const OCTAVE_HISTORY = 8
/** Only repair a slip when the shift is a decisive improvement, so a real leap survives. */
const OCTAVE_REPAIR_MARGIN = 6

function median(values: readonly number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((left, right) => left - right)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2
    : (sorted[middle] ?? 0)
}

/**
 * Pull an octave slip back onto the line's own register. Candidates are the
 * detected pitch and its neighbouring octaves; the closest to the recent median
 * wins, but only when it beats the detected pitch by a decisive margin.
 */
export function repairOctaveSlips(
  midiSequence: readonly number[],
  profile: TranscriptionProfile,
): number[] {
  const repaired: number[] = []
  const recent: number[] = []

  for (const midi of midiSequence) {
    if (recent.length === 0) {
      repaired.push(midi)
      recent.push(midi)
      continue
    }

    const center = median(recent)
    const candidates = [midi, midi - 12, midi + 12].filter(
      (candidate) =>
        candidate >= profile.minMidi && candidate <= profile.maxMidi,
    )
    const best = candidates.reduce(
      (closest, candidate) =>
        Math.abs(candidate - center) < Math.abs(closest - center)
          ? candidate
          : closest,
      midi,
    )
    const improvement = Math.abs(midi - center) - Math.abs(best - center)
    const chosen = improvement > OCTAVE_REPAIR_MARGIN ? best : midi

    repaired.push(chosen)
    recent.push(chosen)
    if (recent.length > OCTAVE_HISTORY) recent.shift()
  }

  return repaired
}

/**
 * Segment confident frames into sustained notes. Kept pure and separate from
 * audio decoding so the segmentation rules can be tested exactly.
 */
export function transcribeFrames(
  frames: readonly TranscriptionFrame[],
  profile: TranscriptionProfile,
  analysedFrameCount = frames.length,
  analysedSeconds = frames.length * profile.stepSeconds,
): StemTranscription {
  const confident = frames.filter(
    (frame) =>
      frame.clarity >= profile.minConfidence &&
      frame.midi >= profile.minMidi &&
      frame.midi <= profile.maxMidi,
  )
  const coverage =
    analysedFrameCount > 0 ? confident.length / analysedFrameCount : 0

  if (confident.length === 0) {
    return { notes: [], coverage: 0, analysedSeconds }
  }

  interface OpenNote {
    startSeconds: number
    endSeconds: number
    midiValues: number[]
    clarities: number[]
  }

  const groups: OpenNote[] = []
  let open: OpenNote = {
    startSeconds: confident[0].timeSeconds,
    endSeconds: confident[0].timeSeconds + profile.stepSeconds,
    midiValues: [confident[0].midi],
    clarities: [confident[0].clarity],
  }

  for (let index = 1; index < confident.length; index += 1) {
    const frame = confident[index]
    const gap = frame.timeSeconds - confident[index - 1].timeSeconds
    const center = Math.round(median(open.midiValues))
    if (Math.abs(frame.midi - center) <= 1 && gap <= profile.maxGapSeconds) {
      open.midiValues.push(frame.midi)
      open.clarities.push(frame.clarity)
      open.endSeconds = frame.timeSeconds + profile.stepSeconds
      continue
    }
    groups.push(open)
    open = {
      startSeconds: frame.timeSeconds,
      endSeconds: frame.timeSeconds + profile.stepSeconds,
      midiValues: [frame.midi],
      clarities: [frame.clarity],
    }
  }
  groups.push(open)

  const sustained = groups.filter(
    (group) =>
      group.endSeconds - group.startSeconds >= profile.minDurationSeconds,
  )
  const repaired = repairOctaveSlips(
    sustained.map((group) => Math.round(median(group.midiValues))),
    profile,
  )

  const notes = sustained.map((group, index) => {
    const midi = repaired[index] ?? Math.round(median(group.midiValues))
    const { name, octave } = midiToNote(midi)
    return {
      midi,
      noteName: `${name}${octave}`,
      startSeconds: group.startSeconds,
      durationSeconds: group.endSeconds - group.startSeconds,
      confidence: median(group.clarities),
    }
  })

  return { notes, coverage, analysedSeconds }
}

/** Analyse one mono stem into measured notes. Yields so a long song cannot freeze the room. */
export async function transcribeStemSamples(
  samples: Float32Array,
  sampleRate: number,
  options: {
    profile?: TranscriptionProfile
    signal?: AbortSignal
    onProgress?: (fraction: number) => void
  } = {},
): Promise<StemTranscription> {
  const profile = options.profile ?? BASS_TRANSCRIPTION_PROFILE
  const windowSamples = profileWindowSamples(profile, sampleRate)
  const detector = new PitchDetector({
    sampleRate,
    algorithm: 'yin',
    bufferSize: windowSamples,
    minFrequency: profile.minFrequency,
    maxFrequency: profile.maxFrequency,
    minConfidence: profile.minConfidence,
    minAmplitude: profile.minAmplitude,
  })

  const stepSamples = Math.max(1, Math.floor(profile.stepSeconds * sampleRate))
  const frameCount =
    Math.floor((samples.length - windowSamples) / stepSamples) + 1
  const analysedSeconds = samples.length / sampleRate
  if (frameCount <= 0) {
    return { notes: [], coverage: 0, analysedSeconds }
  }

  const frames: TranscriptionFrame[] = []
  for (let index = 0; index < frameCount; index += 1) {
    if (options.signal?.aborted === true) {
      throw new DOMException('Transcription cancelled', 'AbortError')
    }
    const offset = index * stepSamples
    const detected = detector.detect(
      samples.subarray(offset, offset + windowSamples),
    )
    if (detected.frequency > 0) {
      frames.push({
        // Stamp the window's centre, not its edge, so onsets are not late.
        timeSeconds: (offset + windowSamples / 2) / sampleRate,
        midi: Math.round(69 + 12 * Math.log2(detected.frequency / 440)),
        clarity: detected.clarity,
      })
    }

    // Yield often. On the main-thread fallback this is the only thing keeping
    // the room responsive; in the worker it is nearly free.
    if (index % 16 === 0 && index > 0) {
      options.onProgress?.(index / frameCount)
      await new Promise((resolve) => setTimeout(resolve, 0))
    }
  }
  options.onProgress?.(1)

  return transcribeFrames(frames, profile, frameCount, analysedSeconds)
}

/**
 * Decode one stem to mono at the profile's analysis rate. `decodeAudioData`
 * resamples to the context's rate with the browser's own filters, so asking for
 * 8 kHz here is both the anti-aliasing step and the reason analysis is cheap.
 */
export async function decodeStemForAnalysis(
  stemUrl: string,
  profile: TranscriptionProfile = BASS_TRANSCRIPTION_PROFILE,
  signal?: AbortSignal,
): Promise<{ samples: Float32Array; sampleRate: number }> {
  const response = await fetch(stemUrl, { signal })
  if (!response.ok) {
    throw new Error('That stem could not be read from this device.')
  }
  const encoded = await response.arrayBuffer()
  const context = new OfflineAudioContext(1, 2, profile.analysisSampleRate)
  const decoded = await context.decodeAudioData(encoded)

  const left = decoded.getChannelData(0)
  if (decoded.numberOfChannels === 1) {
    return { samples: left, sampleRate: decoded.sampleRate }
  }
  const right = decoded.getChannelData(1)
  const mono = new Float32Array(left.length)
  for (let index = 0; index < left.length; index += 1) {
    mono[index] = (left[index] + right[index]) / 2
  }
  return { samples: mono, sampleRate: decoded.sampleRate }
}

/** Decode one stem URL to mono and transcribe it on this thread. */
export async function transcribeStemUrl(
  stemUrl: string,
  options: {
    profile?: TranscriptionProfile
    signal?: AbortSignal
    onProgress?: (fraction: number) => void
  } = {},
): Promise<StemTranscription> {
  const profile = options.profile ?? BASS_TRANSCRIPTION_PROFILE
  const { samples, sampleRate } = await decodeStemForAnalysis(
    stemUrl,
    profile,
    options.signal,
  )
  return transcribeStemSamples(samples, sampleRate, { ...options, profile })
}
