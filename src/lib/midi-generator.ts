// ============================================================
// MIDI Generator — pitch-detect vocal audio → Standard MIDI File
// ============================================================

import { PitchDetector } from './pitch-detector'
import { freqToMidi } from './scale-data'

interface MidiNoteEvent {
  midi: number
  tickOn: number
  tickOff: number
}

const TICKS_PER_BEAT = 480
const DEFAULT_BPM = 120
const WINDOW_SAMPLES = 1024
const WINDOW_STEP_SEC = 0.10
const MIN_NOTE_DURATION_SEC = 0.08

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
function buildMidiFile(notes: MidiNoteEvent[], bpm: number): Uint8Array | null {
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
    tick: 0, delta: 0, type: 0xff, subtype: 0x51,
    data: [(microsecondsPerBeat >> 16) & 0xff, (microsecondsPerBeat >> 8) & 0xff, microsecondsPerBeat & 0xff],
  })

  // Time signature 4/4
  absEvents.push({
    tick: 0, delta: 0, type: 0xff, subtype: 0x58,
    data: [0x04, 0x02, 0x18, 0x08],
  })

  // Track name
  const nameBytes = [...new TextEncoder().encode('Vocal Melody')]
  absEvents.push({
    tick: 0, delta: 0, type: 0xff, subtype: 0x03,
    data: nameBytes,
  })

  // Note on/off events
  for (const n of notes) {
    absEvents.push({ tick: n.tickOn, delta: 0, type: 0x90, note: n.midi, velocity: 80 })
    absEvents.push({ tick: n.tickOff, delta: 0, type: 0x80, note: n.midi, velocity: 0 })
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
    0x4d, 0x54, 0x68, 0x64, 0x00, 0x00, 0x00, 0x06,
    0x00, 0x01, 0x00, 0x01, (TICKS_PER_BEAT >> 8) & 0xff, TICKS_PER_BEAT & 0xff,
  ]

  const trackLen = trackData.length
  const track = [
    0x4d, 0x54, 0x72, 0x6b,
    (trackLen >> 24) & 0xff, (trackLen >> 16) & 0xff, (trackLen >> 8) & 0xff, trackLen & 0xff,
    ...trackData,
  ]

  const midiData = new Uint8Array(header.length + track.length)
  midiData.set(header, 0)
  midiData.set(track, header.length)
  return midiData
}

const YIELD_BATCH_SIZE = 80

/** Pitch-detect a Float32Array and return an array of MIDI note events */
async function detectNotes(
  audioData: Float32Array,
  sampleRate: number,
  onProgress?: (pct: number) => void,
): Promise<MidiNoteEvent[]> {
  const detector = new PitchDetector({ sampleRate, bufferSize: WINDOW_SAMPLES, minAmplitude: 0.02, minConfidence: 0.3 })

  const windowStepSamples = Math.floor(WINDOW_STEP_SEC * sampleRate)
  const totalFrames = Math.floor((audioData.length - WINDOW_SAMPLES) / windowStepSamples) + 1

  if (totalFrames <= 0) return []

  const detections: { midi: number; timeSec: number }[] = []

  for (let i = 0; i < totalFrames; i++) {
    const offset = i * windowStepSamples
    const chunk = audioData.slice(offset, offset + WINDOW_SAMPLES)
    const pitch = detector.detect(chunk)

    if (pitch.frequency > 0 && pitch.clarity > 0.3) {
      const midi = freqToMidi(pitch.frequency)
      if (midi >= 38 && midi <= 96) {
        detections.push({
          midi,
          timeSec: (offset / sampleRate) + (WINDOW_SAMPLES / sampleRate / 2),
        })
      }
    }

    // Yield to browser every batch to avoid freezing the main thread
    if (i % YIELD_BATCH_SIZE === 0 && i > 0) {
      onProgress?.(Math.round((i / totalFrames) * 100))
      await new Promise(r => setTimeout(r, 0))
    }
  }

  onProgress?.(100)

  if (detections.length === 0) return []

  // Merge consecutive same-pitch detections into sustained notes
  const notes: MidiNoteEvent[] = []
  let noteStartSec = detections[0].timeSec
  let currentMidi = detections[0].midi

  for (let i = 1; i < detections.length; i++) {
    const gap = detections[i].timeSec - detections[i - 1].timeSec
    if (detections[i].midi === currentMidi && gap < WINDOW_STEP_SEC + 0.02) {
      continue
    }
    const noteEndSec = detections[i - 1].timeSec + WINDOW_STEP_SEC
    const duration = noteEndSec - noteStartSec
    if (duration >= MIN_NOTE_DURATION_SEC) {
      notes.push({
        midi: currentMidi,
        tickOn: secondsToTicks(noteStartSec, DEFAULT_BPM),
        tickOff: secondsToTicks(noteEndSec, DEFAULT_BPM),
      })
    }
    noteStartSec = detections[i].timeSec
    currentMidi = detections[i].midi
  }

  // Final note
  const lastTime = detections[detections.length - 1].timeSec + WINDOW_STEP_SEC
  const lastDuration = lastTime - noteStartSec
  if (lastDuration >= MIN_NOTE_DURATION_SEC) {
    notes.push({
      midi: currentMidi,
      tickOn: secondsToTicks(noteStartSec, DEFAULT_BPM),
      tickOff: secondsToTicks(lastTime, DEFAULT_BPM),
    })
  }

  return notes
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
