// Polyphonic candidate decoder keeps independent pitch envelopes, never expands a guessed chord root.

export interface PolyphonicNote {
  midi: number
  startSeconds: number
  endSeconds: number
  /** Mean model note activation while above the sustain threshold, not YIN clarity. */
  confidence: number
}

export interface BasicPitchDecoderOptions {
  onsetThreshold: number
  frameThreshold: number
  minDurationSeconds: number
  gapFrames: number
  /** Explicit alternative for notes without a strong onset; null is onset-only. */
  frameStartThreshold: number | null
}

export const BASIC_PITCH_DECODER_DEFAULTS: Readonly<BasicPitchDecoderOptions> =
  {
    onsetThreshold: 0.5,
    frameThreshold: 0.3,
    minDurationSeconds: 0.1277,
    gapFrames: 11,
    frameStartThreshold: null,
  }

interface Voice {
  start: number
  gapStart: number
  gap: number
  sum: number
  count: number
}

/**
 * Our bounded onset/sustain decoder, not a port of upstream's Melodia heuristic.
 * Local onset peaks split repeated picks; brief low-confidence gaps may bridge a
 * sustain. Processing is linear in model frames × 88 pitches, with no rescanning
 * of a five-minute salience matrix or artificial chord-tone completion.
 */
export function createBasicPitchDecoder(
  overrides: Partial<BasicPitchDecoderOptions> = {},
) {
  const options = { ...BASIC_PITCH_DECODER_DEFAULTS, ...overrides }
  for (const threshold of [
    options.onsetThreshold,
    options.frameThreshold,
    options.frameStartThreshold ?? 0,
  ]) {
    if (!Number.isFinite(threshold) || threshold < 0 || threshold > 1)
      throw new Error('Pitch thresholds must be between zero and one.')
  }
  if (
    !Number.isFinite(options.minDurationSeconds) ||
    options.minDurationSeconds <= 0 ||
    !Number.isInteger(options.gapFrames) ||
    options.gapFrames < 1 ||
    options.gapFrames > 100
  )
    throw new Error('Unsupported note duration or gap.')
  const voices: (Voice | null)[] = Array.from({ length: 88 }, () => null)
  const notes: PolyphonicNote[] = []
  let previous: {
    time: number
    frames: Float32Array
    onsets: Float32Array
  } | null = null
  let before: Float32Array = new Float32Array(88)
  let ended = false
  let consumedThrough = 0

  function close(pitch: number, end: number) {
    const voice = voices[pitch]!
    if (end - voice.start >= options.minDurationSeconds && voice.count > 0) {
      if (notes.length >= 10000)
        throw new Error(
          'This analysis produced too many notes to review safely.',
        )
      notes.push({
        midi: pitch + 21,
        startSeconds: voice.start,
        endSeconds: end,
        confidence: voice.sum / voice.count,
      })
    }
    voices[pitch] = null
  }

  function consume(nextOnsets: Float32Array) {
    if (previous === null) return
    const { time, frames, onsets } = previous
    consumedThrough = time
    for (let pitch = 0; pitch < 88; pitch++) {
      const peak =
        onsets[pitch] >= options.onsetThreshold &&
        onsets[pitch] > before[pitch] &&
        onsets[pitch] > nextOnsets[pitch]
      let voice = voices[pitch]
      if (
        peak &&
        voice !== null &&
        time - voice.start >= options.minDurationSeconds
      ) {
        close(pitch, voice.gap > 0 ? voice.gapStart : time)
        voice = null
      }
      if (
        voice === null &&
        (peak ||
          (options.frameStartThreshold !== null &&
            frames[pitch] >= options.frameStartThreshold))
      ) {
        voice = { start: time, gapStart: time, gap: 0, sum: 0, count: 0 }
        voices[pitch] = voice
      }
      if (voice === null) continue
      if (frames[pitch] >= options.frameThreshold) {
        voice.sum += frames[pitch]
        voice.count++
        voice.gap = 0
      } else {
        if (voice.gap++ === 0) voice.gapStart = time
        if (voice.gap >= options.gapFrames) close(pitch, voice.gapStart)
      }
    }
    before = onsets
  }

  return {
    /** Bounded live history, including confirmed sustains; never advances them to the UI clock. */
    recent(sinceSeconds: number): PolyphonicNote[] {
      if (ended || !Number.isFinite(sinceSeconds))
        throw new Error('Invalid live decoder snapshot.')
      for (let index = notes.length - 1; index >= 0; index--)
        if (notes[index].endSeconds < sinceSeconds) notes.splice(index, 1)
      const active = voices.flatMap((voice, pitch) => {
        if (voice === null) return []
        const end = voice.gap > 0 ? voice.gapStart : consumedThrough
        return end - voice.start >= options.minDurationSeconds &&
          voice.count > 0 &&
          end >= sinceSeconds
          ? [
              {
                midi: pitch + 21,
                startSeconds: voice.start,
                endSeconds: end,
                confidence: voice.sum / voice.count,
              },
            ]
          : []
      })
      return [...notes, ...active].sort(
        (a, b) => a.startSeconds - b.startSeconds || a.midi - b.midi,
      )
    },
    push(time: number, frames: Float32Array, onsets: Float32Array) {
      if (ended) throw new Error('This note decoder has finished.')
      if (
        !Number.isFinite(time) ||
        time < 0 ||
        (previous !== null && time <= previous.time) ||
        frames.length !== 88 ||
        onsets.length !== 88
      )
        throw new Error('Invalid pitch frame or time.')
      consume(onsets)
      // Caller may recycle model output buffers after this call.
      previous = { time, frames: frames.slice(), onsets: onsets.slice() }
    },
    finish(duration: number): PolyphonicNote[] {
      if (ended) throw new Error('This note decoder has finished.')
      if (!Number.isFinite(duration) || duration < (previous?.time ?? 0))
        throw new Error('Invalid analysis duration.')
      consume(new Float32Array(88))
      for (let pitch = 0; pitch < 88; pitch++) {
        const voice = voices[pitch]
        if (voice !== null)
          close(pitch, voice.gap > 0 ? voice.gapStart : duration)
      }
      ended = true
      previous = null
      return notes.sort(
        (a, b) => a.startSeconds - b.startSeconds || a.midi - b.midi,
      )
    },
  }
}
