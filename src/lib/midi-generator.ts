// ============================================================
// MIDI Generator — pitch-detect vocal audio → Standard MIDI File
// ============================================================

import { PitchDetector } from './pitch-detector'
import { freqToMidi, midiToFreq } from './scale-data'

export interface MidiNoteEvent {
  midi: number
  tickOn: number
  tickOff: number
}

export const TICKS_PER_BEAT = 480
export const DEFAULT_BPM = 120
export const WINDOW_STEP_SEC = 0.1
export const MIN_NOTE_DURATION_SEC = 0.08

/** Shared PitchDetector constructor defaults used by both MIDI generation and realtime */
export const PITCH_DETECTOR_DEFAULTS = {
  bufferSize: 1024,
  minAmplitude: 0.02,
  minConfidence: 0.3,
  threshold: 0.15,
  sensitivity: 7,
  minFrequency: 65,
  maxFrequency: 2100,
} as const

/** MIDI note range filter shared by both paths */
export const MIDI_NOTE_RANGE = { min: 38, max: 96 } as const // D2–C7

/** A single pitch detection at a point in time */
export interface PitchDetection {
  midi: number
  noteName: string
  timeSec: number
}

/** A sustained note formed by merging consecutive same-pitch detections */
export interface MergedNote {
  midi: number
  noteName: string
  startSec: number
  endSec: number
}

/** Merge consecutive same-pitch detections into sustained notes.
 *  Adjacent detections within `maxGapSec` of each other are merged.
 *  Notes shorter than `minDurationSec` are dropped. */
export function mergeConsecutiveNotes(
  detections: PitchDetection[],
  maxGapSec: number = WINDOW_STEP_SEC + 0.02,
  minDurationSec: number = MIN_NOTE_DURATION_SEC,
): MergedNote[] {
  if (detections.length === 0) return []

  const notes: MergedNote[] = []
  let noteStartSec = detections[0].timeSec
  let currentMidi = detections[0].midi
  let currentName = detections[0].noteName

  for (let i = 1; i < detections.length; i++) {
    const gap = detections[i].timeSec - detections[i - 1].timeSec
    if (detections[i].midi === currentMidi && gap < maxGapSec) {
      continue
    }
    const noteEndSec = detections[i - 1].timeSec + WINDOW_STEP_SEC
    const duration = noteEndSec - noteStartSec
    if (duration >= minDurationSec) {
      notes.push({
        midi: currentMidi,
        noteName: currentName,
        startSec: noteStartSec,
        endSec: noteEndSec,
      })
    }
    noteStartSec = detections[i].timeSec
    currentMidi = detections[i].midi
    currentName = detections[i].noteName
  }

  // Final note
  const lastTime = detections[detections.length - 1].timeSec + WINDOW_STEP_SEC
  const lastDuration = lastTime - noteStartSec
  if (lastDuration >= minDurationSec) {
    notes.push({
      midi: currentMidi,
      noteName: currentName,
      startSec: noteStartSec,
      endSec: lastTime,
    })
  }

  return notes
}

function writeVarLen(value: number): number[] {
  const bytes: number[] = []
  let v = Math.floor(value)
  bytes.push(v & 0x7f)
  while ((v >>= 7) > 0) {
    bytes.push((v & 0x7f) | 0x80)
  }
  bytes.reverse()
  return bytes
}

function secondsToTicks(sec: number, bpm: number): number {
  const beatsPerSec = bpm / 60
  return Math.round(sec * beatsPerSec * TICKS_PER_BEAT)
}

/** Generate a Standard MIDI File from an array of detected MIDI note events */
export function buildMidiFile(
  notes: MidiNoteEvent[],
  bpm: number,
): Uint8Array | null {
  if (notes.length === 0) return null

  // Sort by tick
  notes.sort((a, b) => a.tickOn - b.tickOn)

  const absEvents: Array<{
    tick: number
    delta: number
    type: number
    subtype?: number
    note?: number
    velocity?: number
    data?: number[]
  }> = []

  // Tempo
  const microsecondsPerBeat = Math.round(60000000 / bpm)
  absEvents.push({
    tick: 0,
    delta: 0,
    type: 0xff,
    subtype: 0x51,
    data: [
      (microsecondsPerBeat >> 16) & 0xff,
      (microsecondsPerBeat >> 8) & 0xff,
      microsecondsPerBeat & 0xff,
    ],
  })

  // Time signature 4/4
  absEvents.push({
    tick: 0,
    delta: 0,
    type: 0xff,
    subtype: 0x58,
    data: [0x04, 0x02, 0x18, 0x08],
  })

  // Track name
  const nameBytes = [...new TextEncoder().encode('Vocal Melody')]
  absEvents.push({
    tick: 0,
    delta: 0,
    type: 0xff,
    subtype: 0x03,
    data: nameBytes,
  })

  // Note on/off events
  for (const n of notes) {
    absEvents.push({
      tick: n.tickOn,
      delta: 0,
      type: 0x90,
      note: n.midi,
      velocity: 80,
    })
    absEvents.push({
      tick: n.tickOff,
      delta: 0,
      type: 0x80,
      note: n.midi,
      velocity: 0,
    })
  }

  absEvents.sort((a, b) => a.tick - b.tick)
  let prevTick = 0
  for (const e of absEvents) {
    const d = e.tick - prevTick
    e.delta = d
    prevTick = e.tick
  }

  // Serialize track
  const trackData: number[] = []
  for (const e of absEvents) {
    trackData.push(...writeVarLen(e.delta))
    if (e.type === 0xff) {
      trackData.push(e.type, e.subtype!)
      if (e.data) {
        trackData.push(e.data.length)
        trackData.push(...e.data)
      } else {
        trackData.push(0)
      }
    } else {
      trackData.push(e.type, e.note!, e.velocity!)
    }
  }
  trackData.push(0xff, 0x2f, 0x00)

  // Header
  const header = [
    0x4d,
    0x54,
    0x68,
    0x64,
    0x00,
    0x00,
    0x00,
    0x06,
    0x00,
    0x01,
    0x00,
    0x01,
    (TICKS_PER_BEAT >> 8) & 0xff,
    TICKS_PER_BEAT & 0xff,
  ]

  const trackLen = trackData.length
  const track = [
    0x4d,
    0x54,
    0x72,
    0x6b,
    (trackLen >> 24) & 0xff,
    (trackLen >> 16) & 0xff,
    (trackLen >> 8) & 0xff,
    trackLen & 0xff,
    ...trackData,
  ]

  const midiData = new Uint8Array(header.length + track.length)
  midiData.set(header, 0)
  midiData.set(track, header.length)
  return midiData
}

/** Synthesize MIDI note events into an AudioBuffer using sine-wave oscillators */
export async function synthesizeMidiBuffer(
  notes: MidiNoteEvent[],
  bpm: number,
  sampleRate: number,
  totalDurationSec: number,
  onProgress?: (pct: number) => void,
): Promise<AudioBuffer> {
  const numSamples = Math.ceil(sampleRate * totalDurationSec)
  const ctx = new OfflineAudioContext(2, numSamples, sampleRate)
  const buffer = ctx.createBuffer(2, numSamples, sampleRate)
  const left = buffer.getChannelData(0)
  const right = buffer.getChannelData(1)

  const beatsPerSec = bpm / 60
  const ticksPerSec = TICKS_PER_BEAT * beatsPerSec

  const total = notes.length
  for (let i = 0; i < total; i++) {
    const note = notes[i]
    const startSec = note.tickOn / ticksPerSec
    const endSec = note.tickOff / ticksPerSec
    const duration = endSec - startSec
    if (duration <= 0) continue

    const freq = midiToFreq(note.midi)
    const startSample = Math.floor(startSec * sampleRate)
    const endSample = Math.floor(endSec * sampleRate)

    const fadeInSamples = Math.floor(Math.min(0.008, duration / 4) * sampleRate)
    const fadeOutSamples = Math.floor(
      Math.min(0.015, duration / 4) * sampleRate,
    )
    const totalNoteSamples = endSample - startSample

    let phase = 0
    const phaseInc = (2 * Math.PI * freq) / sampleRate

    for (let s = 0; s < totalNoteSamples; s++) {
      const idx = startSample + s
      if (idx >= numSamples) break

      let amp = 0.35
      if (s < fadeInSamples) {
        amp = 0.35 * (s / fadeInSamples)
      } else if (s > totalNoteSamples - fadeOutSamples) {
        amp =
          0.35 *
          (1 - (s - (totalNoteSamples - fadeOutSamples)) / fadeOutSamples)
      }

      const sampleValue = Math.sin(phase) * amp
      left[idx] += sampleValue
      right[idx] += sampleValue

      phase += phaseInc
    }

    // Yield every 1000 notes to avoid freezing the main thread while remaining fast
    if (i % 1000 === 0 && i > 0) {
      onProgress?.(Math.round((i / total) * 100))
      await new Promise((r) => setTimeout(r, 0))
    }
  }

  onProgress?.(100)
  return buffer
}

const YIELD_BATCH_SIZE = 80

/** Pitch-detect a Float32Array and return an array of MIDI note events */
export async function detectNotes(
  audioData: Float32Array,
  sampleRate: number,
  onProgress?: (pct: number) => void,
): Promise<MidiNoteEvent[]> {
  const detector = new PitchDetector({ sampleRate, ...PITCH_DETECTOR_DEFAULTS })

  const windowStepSamples = Math.floor(WINDOW_STEP_SEC * sampleRate)
  const totalFrames =
    Math.floor(
      (audioData.length - PITCH_DETECTOR_DEFAULTS.bufferSize) /
        windowStepSamples,
    ) + 1

  if (totalFrames <= 0) return []

  const detections: PitchDetection[] = []

  for (let i = 0; i < totalFrames; i++) {
    const offset = i * windowStepSamples
    const chunk = audioData.slice(
      offset,
      offset + PITCH_DETECTOR_DEFAULTS.bufferSize,
    )
    const pitch = detector.detect(chunk)

    if (pitch.frequency > 0) {
      const midi = freqToMidi(pitch.frequency)
      if (midi >= MIDI_NOTE_RANGE.min && midi <= MIDI_NOTE_RANGE.max) {
        detections.push({
          midi,
          noteName: pitch.noteName,
          timeSec:
            offset / sampleRate +
            PITCH_DETECTOR_DEFAULTS.bufferSize / sampleRate / 2,
        })
      }
    }

    // Yield to browser every batch to avoid freezing the main thread
    if (i % YIELD_BATCH_SIZE === 0 && i > 0) {
      onProgress?.(Math.round((i / totalFrames) * 100))
      await new Promise((r) => setTimeout(r, 0))
    }
  }

  onProgress?.(100)

  if (detections.length === 0) return []

  const merged = mergeConsecutiveNotes(detections)
  if (merged.length === 0) return []

  return merged.map((n) => ({
    midi: n.midi,
    tickOn: secondsToTicks(n.startSec, DEFAULT_BPM),
    tickOff: secondsToTicks(n.endSec, DEFAULT_BPM),
  }))
}

/**
 * Generate a MIDI blob from a vocal audio URL.
 * Fetches the audio, decodes it, runs YIN pitch detection, and builds a Standard MIDI File.
 */
export async function generateVocalMidi(
  audioUrl: string,
  onProgress?: (pct: number) => void,
): Promise<Blob | null> {
  const resp = await fetch(audioUrl)
  if (!resp.ok) throw new Error(`Failed to fetch audio: HTTP ${resp.status}`)

  const arrayBuffer = await resp.arrayBuffer()
  const audioCtx = new OfflineAudioContext(1, 2, 44100)
  const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer)

  const sampleRate = audioBuffer.sampleRate
  const channelData = audioBuffer.getChannelData(0)

  // Downmix to mono if needed
  let monoData: Float32Array
  if (audioBuffer.numberOfChannels > 1) {
    monoData = new Float32Array(channelData.length)
    monoData.set(channelData)
    const right = audioBuffer.getChannelData(1)
    for (let i = 0; i < monoData.length; i++) {
      monoData[i] = (monoData[i] + right[i]) / 2
    }
  } else {
    monoData = channelData
  }

  const notes = await detectNotes(monoData, sampleRate, onProgress)
  if (notes.length === 0) return null

  const midiData = buildMidiFile(notes, DEFAULT_BPM)
  if (!midiData) return null

  return new Blob([midiData.buffer as ArrayBuffer], { type: 'audio/midi' })
}
