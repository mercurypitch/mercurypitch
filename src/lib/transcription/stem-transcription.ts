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

import { createAttackDetector } from '@/lib/guitar/attack-detector'
import { PitchDetector } from '@/lib/pitch-detector'
import { midiToNote } from '@/lib/scale-data'

export interface TranscriptionProfile {
  /** Analysis window in seconds, so the sample rate can change under it. */
  windowSeconds: number
  /**
   * A second, shorter window run over the same audio.
   *
   * One window cannot serve a bass line. Long enough to resolve the low
   * strings means long enough to straddle two sixteenth notes and resolve
   * neither; short enough for the fast passage cannot express the low string
   * at all. Rather than split the difference and be wrong at both ends, each
   * window is asked only about the range it can actually hear, and the clearer
   * answer wins where they overlap.
   *
   * Null runs the long window alone.
   */
  fineWindowSeconds: number | null
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
  /**
   * A note whose fundamental carries less than this share of the energy at
   * twice its frequency is not a fundamental at all — it is the octave below
   * the real note. Raise it to correct harder, lower it to trust the detector.
   */
  octaveEvidenceRatio: number
  /**
   * Split a held pitch into separate notes when the string is struck again.
   * Off (null) keeps the old behaviour of merging repeats into one long note.
   */
  onsetSplitFloor: number | null
}

/**
 * Four-string bass, from low E to the top of the neck.
 *
 * `windowSeconds` and `minFrequency` are not independent, and an earlier
 * version of this profile had them contradict each other: it asked for notes
 * down to 28 Hz through a window that holds barely one cycle at that
 * frequency, which YIN cannot resolve. The window has to hold about four
 * cycles of the lowest note asked for — see `resolvableMinFrequency`, which a
 * test pins — so the two move together or not at all.
 *
 * The shape of the trade: a longer window reaches lower and blurs fast notes,
 * because it straddles two of them and resolves neither. Measured against
 * Dance of Death's bass stem, shortening the window from 93 ms to 60 ms and
 * halving the step found 55% more notes, at the cost of slightly more octave
 * errors (83 to 93) — the shorter view has less evidence to settle an octave
 * with. Finding the notes at all was worth more. Low B lives below what this
 * can resolve; a five-string profile needs its own longer window, and
 * pretending one profile covers both is how the contradiction got here.
 */
export const BASS_TRANSCRIPTION_PROFILE: TranscriptionProfile = {
  windowSeconds: 0.06,
  // Off, measured rather than assumed. A second shorter window is the textbook
  // answer to fast notes, and against Dance of Death it was neutral-to-worse:
  // that bass line has no two onsets closer than 90 ms, so the fine window had
  // nothing to resolve that the main one could not, and its shorter view only
  // added noise. The path stays for material that IS that fast — which this
  // has not been tested on, so it is available rather than recommended.
  fineWindowSeconds: null,
  stepSeconds: 0.02,
  // 8 kHz leaves a 4 kHz ceiling, ten times the highest note this profile
  // looks for, and cuts the work per frame by roughly thirty.
  analysisSampleRate: 8000,
  // Just under low E at 41.2 Hz: room for a flat tuning, and no room for the
  // sub-octave the detector would otherwise be free to report.
  minFrequency: 38,
  maxFrequency: 400,
  minConfidence: 0.5,
  minAmplitude: 0.01,
  minMidi: 24,
  maxMidi: 60,
  minDurationSeconds: 0.05,
  maxGapSeconds: 0.04,
  octaveEvidenceRatio: 0.5,
  onsetSplitFloor: 0.02,
}

/**
 * The lowest frequency a window of this length can express at all. YIN shifts
 * the buffer against itself by up to half its length, so a period longer than
 * half the window has nothing left to compare against and simply cannot be
 * measured.
 *
 * This is a hard floor, not a quality bar. An estimate near it rests on barely
 * one cycle of overlap and is correspondingly shaky; comfort starts around
 * three or four cycles, which is `4 / windowSeconds`. The bass profile sits
 * between the two at its very bottom, deliberately: reaching low E matters
 * more than a pristine estimate on the one note nobody plays fast.
 */
export function resolvableMinFrequency(windowSeconds: number): number {
  return windowSeconds > 0 ? 2 / windowSeconds : Infinity
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
 * Energy at one frequency over a span of samples, by Goertzel.
 *
 * Cheaper than an FFT and the only question being asked is a yes/no about two
 * specific frequencies, so a whole spectrum would be waste.
 */
export function toneMagnitude(
  samples: Float32Array,
  sampleRate: number,
  frequency: number,
  fromSample: number,
  toSample: number,
): number {
  const from = Math.max(0, Math.floor(fromSample))
  const to = Math.min(samples.length, Math.ceil(toSample))
  const count = to - from
  if (count < 8 || frequency <= 0 || frequency >= sampleRate / 2) return 0

  const coefficient = 2 * Math.cos((2 * Math.PI * frequency) / sampleRate)
  let previous = 0
  let beforePrevious = 0
  for (let index = 0; index < count; index += 1) {
    // Hann window: without it a partial period at each end leaks across bins
    // and the comparison between f and 2f stops meaning anything.
    const windowed =
      (samples[from + index] ?? 0) *
      (0.5 - 0.5 * Math.cos((2 * Math.PI * index) / count))
    const current = windowed + coefficient * previous - beforePrevious
    beforePrevious = previous
    previous = current
  }
  return (
    Math.sqrt(
      Math.max(
        0,
        previous * previous +
          beforePrevious * beforePrevious -
          coefficient * previous * beforePrevious,
      ),
    ) / count
  )
}

/**
 * Ask the audio whether a note is really where the detector put it.
 *
 * A period detector settles into whichever repetition it finds first, and on a
 * plucked string more than one is available: twice the true period reads an
 * octave low, and one-and-a-half times it reads a fifth low.
 *
 * Only the octave is corrected here, and that is a measured decision rather
 * than an oversight. Against Dance of Death the fifth is in fact the LARGER
 * error — 244 of them, six times any other interval — but this same energy
 * test cannot pick out which ones they are. A fifth above a bass note is
 * frequently another instrument bleeding through the separation, or a
 * neighbouring note of the passage, so the evidence looks identical whether
 * the reading is wrong or right. Correcting on it cost more notes than it
 * recovered at every threshold tried, so it is left alone and written down.
 * Distinguishing them needs more than two magnitudes — the harmonic series as
 * a whole, or a detector that does not produce the error in the first place.
 *
 * Statistics cannot settle this. When half a line is displaced the median sits
 * between the two readings and every note looks equally plausible. The audio
 * can: a real fundamental has energy at its own frequency, and an invented
 * sub-harmonic has almost none while the frequency it was derived from is
 * loud.
 *
 * Candidates are tried smallest-shift-first, and only upward. Shifting up
 * repairs the error the detector actually makes; the same evidence read
 * downward would just as happily "repair" a real note whose fundamental is
 * genuinely weak, which is most notes near the bottom of a bass.
 */
const HARMONIC_CANDIDATES: readonly { ratio: number; semitones: number }[] = [
  { ratio: 2, semitones: 12 },
]

export function harmonicCorrectedMidi(
  samples: Float32Array,
  sampleRate: number,
  midi: number,
  fromSample: number,
  toSample: number,
  profile: TranscriptionProfile,
): number {
  const frequency = 440 * Math.pow(2, (midi - 69) / 12)

  // Widen a short note's span to a few periods before asking. A brief note at
  // the bottom of a bass is barely two cycles long, and two cycles cannot tell
  // two frequencies apart — the test would answer from noise. Reaching past
  // the note borrows its own ringing, which is the same string either way.
  const minimumSpan = (4 * sampleRate) / frequency
  const centre = (fromSample + toSample) / 2
  const half = Math.max(minimumSpan, toSample - fromSample) / 2
  const from = Math.max(0, centre - half)
  const to = Math.min(samples.length, centre + half)

  const fundamental = toneMagnitude(samples, sampleRate, frequency, from, to)

  for (const candidate of HARMONIC_CANDIDATES) {
    if (midi + candidate.semitones > profile.maxMidi) continue
    const above = toneMagnitude(
      samples,
      sampleRate,
      frequency * candidate.ratio,
      from,
      to,
    )
    if (above > 0 && fundamental < above * profile.octaveEvidenceRatio) {
      return midi + candidate.semitones
    }
  }
  return midi
}

/** Times, in seconds, at which the stem was struck. */
export function detectStemOnsets(
  samples: Float32Array,
  sampleRate: number,
  profile: TranscriptionProfile,
): number[] {
  if (profile.onsetSplitFloor === null) return []
  const detector = createAttackDetector({
    sampleRate,
    floorLevel: profile.onsetSplitFloor,
    // A repeated sixteenth at 200 BPM is 75 ms apart, and a bass line lives
    // there. The live-input default is slower because a room has more to
    // mistake for a strike than a separated stem does.
    refractoryMs: 55,
  })
  const onsets: number[] = []
  const block = 512
  for (let start = 0; start < samples.length; start += block) {
    const chunk = samples.subarray(
      start,
      Math.min(start + block, samples.length),
    )
    for (const attack of detector.process(chunk)) {
      onsets.push((start + attack.offsetSamples) / sampleRate)
    }
  }
  return onsets
}

/**
 * Segment confident frames into sustained notes. Kept pure and separate from
 * audio decoding so the segmentation rules can be tested exactly.
 *
 * `onsetSeconds` is what makes a repeated note two notes. Pitch alone cannot:
 * a string struck four times on the same fret is one unbroken pitch contour,
 * and without onsets it transcribes as a single long note — which is most of
 * what a bass line does.
 */
export function transcribeFrames(
  frames: readonly TranscriptionFrame[],
  profile: TranscriptionProfile,
  analysedFrameCount = frames.length,
  analysedSeconds = frames.length * profile.stepSeconds,
  onsetSeconds: readonly number[] = [],
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

  // Onsets are consumed in order alongside the frames, so the check below is a
  // pointer bump rather than a scan per frame.
  const onsets = [...onsetSeconds].sort((left, right) => left - right)
  let nextOnset = 0
  const struckBetween = (fromSeconds: number, toSeconds: number): boolean => {
    while (nextOnset < onsets.length && onsets[nextOnset] <= fromSeconds) {
      nextOnset += 1
    }
    return nextOnset < onsets.length && onsets[nextOnset] < toSeconds
  }

  for (let index = 1; index < confident.length; index += 1) {
    const frame = confident[index]
    const previous = confident[index - 1]
    const gap = frame.timeSeconds - previous.timeSeconds
    const center = Math.round(median(open.midiValues))
    const restruck = struckBetween(previous.timeSeconds, frame.timeSeconds)
    if (
      !restruck &&
      Math.abs(frame.midi - center) <= 1 &&
      gap <= profile.maxGapSeconds
    ) {
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

  /**
   * How far above a window's hard limit its answers start being worth having.
   * Measured, not chosen: at 2x, the fine window's floor landed on 89 Hz and
   * shut it out of E2 at 82.4 Hz — the single most common note in the material
   * this was tuned against, which left the fine window covering almost nothing
   * that mattered.
   */
  const FINE_FLOOR_MARGIN = 1.5

  /**
   * One analysis window and the band it is allowed to answer about. The floor
   * is above what the window can barely express, because an estimate resting
   * on one cycle of overlap is a guess, and a guess admitted into the frame
   * stream is indistinguishable from a note.
   */
  interface Lens {
    detector: PitchDetector
    samples: number
    minFrequency: number
  }

  const lensFor = (seconds: number, isFine: boolean): Lens => {
    const lensSamples = Math.max(256, Math.round(seconds * sampleRate))
    const minFrequency = Math.max(
      profile.minFrequency,
      isFine ? FINE_FLOOR_MARGIN * resolvableMinFrequency(seconds) : 0,
    )
    return {
      detector: new PitchDetector({
        sampleRate,
        algorithm: 'yin',
        bufferSize: lensSamples,
        minFrequency,
        maxFrequency: profile.maxFrequency,
        minConfidence: profile.minConfidence,
        minAmplitude: profile.minAmplitude,
        // The detector's smoother replaces any reading more than a couple of
        // semitones from its recent median, and needs two consecutive agreeing
        // frames before it accepts a note change. That is right for a sung line
        // watched live and wrong here: a bass line's next note IS a jump, and at
        // this step size a short one is gone before the filter believes in it.
        stabilize: false,
      }),
      samples: lensSamples,
      minFrequency,
    }
  }

  // Fine window first, and the order is the merge rule. Clarity cannot arbitrate
  // between windows of different lengths — a longer one scores higher simply by
  // having more signal to agree with itself about — so picking the clearest
  // reading just hands every frame back to the long window and undoes the
  // split. Where the fine window can answer at all, its answer is the one with
  // the time resolution worth having.
  const lenses: Lens[] = []
  if (profile.fineWindowSeconds !== null) {
    lenses.push(lensFor(profile.fineWindowSeconds, true))
  }
  lenses.push(lensFor(profile.windowSeconds, false))

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
    // Every window is centred on the same instant, so a short one and a long
    // one describe the same moment and their answers can be compared.
    const centre = offset + windowSamples / 2

    let best: { frequency: number; clarity: number } | null = null
    for (const lens of lenses) {
      const start = Math.round(centre - lens.samples / 2)
      if (start < 0 || start + lens.samples > samples.length) continue
      const detected = lens.detector.detect(
        samples.subarray(start, start + lens.samples),
      )
      if (detected.frequency <= 0) continue
      best = { frequency: detected.frequency, clarity: detected.clarity }
      break
    }

    if (best !== null) {
      frames.push({
        timeSeconds: centre / sampleRate,
        midi: Math.round(69 + 12 * Math.log2(best.frequency / 440)),
        clarity: best.clarity,
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

  const onsets = detectStemOnsets(samples, sampleRate, profile)
  const transcription = transcribeFrames(
    frames,
    profile,
    frameCount,
    analysedSeconds,
    onsets,
  )

  // Octave verification runs on the finished notes rather than per frame: a
  // note spans enough samples for the two magnitudes to mean something, where
  // a single 93 ms frame of a decaying low string often does not.
  const notes = transcription.notes.map((note) => {
    const midi = harmonicCorrectedMidi(
      samples,
      sampleRate,
      note.midi,
      note.startSeconds * sampleRate,
      (note.startSeconds + note.durationSeconds) * sampleRate,
      profile,
    )
    if (midi === note.midi) return note
    const { name, octave } = midiToNote(midi)
    return { ...note, midi, noteName: `${name}${octave}` }
  })

  return { ...transcription, notes }
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
