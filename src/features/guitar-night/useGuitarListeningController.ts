// Guitar Night Listening captures explicit, local pitch evidence for truthful Jam Doctor readouts.
// ============================================================

import { createMemo, createSignal, onCleanup } from 'solid-js'
import type { GuitarSessionAudioGraph } from '@/features/guitar/backing/guitar-session-audio-graph'
import { micManager } from '@/lib/mic-manager'
import { PitchDetector } from '@/lib/pitch-detector'

const CONSUMER_ID = 'guitar-night-listening'
const MAX_EVENTS = 256

export type GuitarListeningStatus = 'off' | 'requesting' | 'listening' | 'error'

export interface GuitarListeningEvent {
  atMs: number
  midi: number
  noteName: string
  clarity: number
  cents: number
  rms: number
}

export interface GuitarListeningObservation {
  label: string
  value: string
  detail: string
}

interface GuitarListeningControllerOptions {
  activateAudio(): Promise<boolean>
  getAudioGraph(): GuitarSessionAudioGraph | null
}

function median(values: readonly number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((left, right) => left - right)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2
    : (sorted[middle] ?? 0)
}

export function summarizeGuitarListeningEvidence(
  events: readonly GuitarListeningEvent[],
): readonly GuitarListeningObservation[] {
  if (events.length === 0) return []
  const observations: GuitarListeningObservation[] = [
    {
      label: 'Attacks heard',
      value: String(events.length),
      detail: 'Fresh note attacks captured in this take.',
    },
  ]

  if (events.length >= 3) {
    const clarity = median(events.map((event) => event.clarity))
    observations.push({
      label: 'Median clarity',
      value: `${Math.round(clarity * 100)}%`,
      detail: 'Detector confidence across captured attacks.',
    })
  }

  if (events.length >= 4) {
    const intervals = events
      .slice(1)
      .map((event, index) => event.atMs - (events[index]?.atMs ?? event.atMs))
      .filter((interval) => interval > 45 && interval < 5000)
    if (intervals.length >= 3) {
      const center = median(intervals)
      const deviation = median(
        intervals.map((interval) => Math.abs(interval - center)),
      )
      observations.push({
        label: 'Attack spacing',
        value: `±${Math.round(deviation)} ms`,
        detail: `Median spacing ${Math.round(center)} ms; lower variation is steadier.`,
      })
    }
  }

  const midiValues = events.map((event) => event.midi)
  const range = Math.max(...midiValues) - Math.min(...midiValues)
  if (range > 0) {
    observations.push({
      label: 'Range heard',
      value: `${range} semitones`,
      detail: 'Lowest-to-highest detected attack in this take.',
    })
  }

  return observations
}

function rms(samples: Float32Array): number {
  let sum = 0
  for (let index = 0; index < samples.length; index += 1) {
    sum += samples[index] * samples[index]
  }
  return Math.sqrt(sum / Math.max(1, samples.length))
}

export function useGuitarListeningController(
  options: GuitarListeningControllerOptions,
) {
  const [status, setStatus] = createSignal<GuitarListeningStatus>('off')
  const [error, setError] = createSignal<string | null>(null)
  const [currentNote, setCurrentNote] = createSignal<string | null>(null)
  const [detectedMidi, setDetectedMidi] = createSignal<number | null>(null)
  const [clarity, setClarity] = createSignal(0)
  const [events, setEvents] = createSignal<readonly GuitarListeningEvent[]>([])
  const observations = createMemo(() =>
    summarizeGuitarListeningEvidence(events()),
  )

  let source: MediaStreamAudioSourceNode | null = null
  let analyser: AnalyserNode | null = null
  let frame = 0
  let generation = 0

  const stopNodes = (): void => {
    if (frame !== 0) cancelAnimationFrame(frame)
    frame = 0
    source?.disconnect()
    analyser?.disconnect()
    source = null
    analyser = null
  }

  const stop = (): void => {
    generation += 1
    stopNodes()
    micManager.release(CONSUMER_ID)
    setStatus('off')
    setCurrentNote(null)
    setDetectedMidi(null)
    setClarity(0)
  }

  const start = async (): Promise<boolean> => {
    if (status() === 'requesting' || status() === 'listening') return true
    generation += 1
    const currentGeneration = generation
    stopNodes()
    setEvents([])
    setError(null)
    setStatus('requesting')

    try {
      if (
        !(await options.activateAudio()) ||
        currentGeneration !== generation
      ) {
        throw new Error('The room audio clock could not start.')
      }
      const graph = options.getAudioGraph()
      if (graph === null)
        throw new Error('The room audio clock is unavailable.')
      const stream = await micManager.acquire(CONSUMER_ID)
      if (currentGeneration !== generation) {
        micManager.release(CONSUMER_ID)
        return false
      }

      const nextSource = graph.context.createMediaStreamSource(stream)
      const nextAnalyser = graph.context.createAnalyser()
      nextAnalyser.fftSize = 2048
      nextAnalyser.smoothingTimeConstant = 0
      nextSource.connect(nextAnalyser)
      source = nextSource
      analyser = nextAnalyser
      const samples = new Float32Array(nextAnalyser.fftSize)
      const detector = new PitchDetector({
        algorithm: 'mpm',
        sampleRate: graph.context.sampleRate,
        bufferSize: nextAnalyser.fftSize,
        minFrequency: 55,
        maxFrequency: 1600,
        minConfidence: 0.38,
        minAmplitude: 0.018,
      })
      let heldMidi: number | null = null
      let lastEventAtMs = Number.NEGATIVE_INFINITY
      let smoothedRms = 0.008
      let silentFrames = 0
      setStatus('listening')

      const tick = (): void => {
        if (currentGeneration !== generation || analyser === null) return
        analyser.getFloatTimeDomainData(samples)
        const amplitude = rms(samples)
        const onset = amplitude > smoothedRms * 1.75 && amplitude > 0.025
        smoothedRms = smoothedRms * 0.9 + amplitude * 0.1
        const detected = detector.detect(samples)
        if (detected.frequency > 0 && detected.clarity >= 0.38) {
          const midi = Math.round(69 + 12 * Math.log2(detected.frequency / 440))
          const label = `${detected.noteName}${detected.octave}`
          setCurrentNote(label)
          setDetectedMidi(midi)
          setClarity(detected.clarity)
          silentFrames = 0
          const eventAtMs = performance.now()
          if (heldMidi !== midi || (onset && eventAtMs - lastEventAtMs >= 55)) {
            heldMidi = midi
            lastEventAtMs = eventAtMs
            const event: GuitarListeningEvent = {
              atMs: eventAtMs,
              midi,
              noteName: label,
              clarity: detected.clarity,
              cents: detected.cents,
              rms: amplitude,
            }
            setEvents((previous) => [
              ...previous.slice(-(MAX_EVENTS - 1)),
              event,
            ])
          }
        } else {
          silentFrames += 1
          if (silentFrames >= 3) heldMidi = null
          if (silentFrames >= 6) {
            setCurrentNote(null)
            setDetectedMidi(null)
            setClarity(0)
          }
        }
        frame = requestAnimationFrame(tick)
      }
      frame = requestAnimationFrame(tick)
      return true
    } catch (caught) {
      if (currentGeneration !== generation) return false
      stopNodes()
      micManager.release(CONSUMER_ID)
      const message =
        typeof caught === 'object' &&
        caught !== null &&
        'message' in caught &&
        typeof caught.message === 'string'
          ? caught.message
          : 'Listening could not open this input.'
      setError(message)
      setStatus('error')
      return false
    }
  }

  const clearTake = (): void => {
    setEvents([])
  }

  onCleanup(() => {
    generation += 1
    stopNodes()
    micManager.release(CONSUMER_ID)
  })

  return {
    status,
    error,
    currentNote,
    detectedMidi,
    clarity,
    events,
    observations,
    start,
    stop,
    clearTake,
  }
}
