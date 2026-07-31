// ============================================================
// Live capture controller — mic → pitch buffer → metrics
//
// Extracted from the old VocalAnalysis monolith so the dashboard renders
// state and this owns the engine wiring. Timbre comes from the spectral
// worker (real FFT); intensity, slides and vibrato come from the pitch
// buffer via `analyzeLiveBuffer`.
// ============================================================

import { createSignal, onCleanup } from 'solid-js'
import { useEngines } from '@/contexts/EngineContext'
import { computeCentsDeviation, midiToNoteName } from '@/lib/frequency-to-note'
import type { LiveAnalysisSnapshot, LivePitchSample, LiveSpectralTimbre, } from '@/lib/live-pitch-analysis'
import { analyzeLiveBuffer } from '@/lib/live-pitch-analysis'
import { PitchDetector } from '@/lib/pitch-detector'
import { SpectralClient } from '@/lib/spectral-client'
import { computePitchStability } from '@/lib/vocal-analyzer'

/** Frames kept in the rolling buffer before the oldest are dropped. */
const MAX_SAMPLES = 2000
const TRIM_TO = 1500
/** Magnitude frames retained for the Lab's offline tools (~30s at 50ms). */
const MAX_SPECTRA = 600
/** How often the full metric pass runs, in ms. */
const ANALYSIS_INTERVAL_MS = 2000
/** Detection floor — below these the frame is noise, not a sung note. */
const MIN_CLARITY = 0.3
const MIN_FREQ_HZ = 65

function rmsAmplitude(samples: Float32Array): number {
  let sum = 0
  for (let i = 0; i < samples.length; i++) sum += samples[i] * samples[i]
  return Math.sqrt(sum / samples.length)
}

export interface LiveCaptureController {
  isActive: () => boolean
  error: () => string | null
  samples: () => LivePitchSample[]
  snapshot: () => LiveAnalysisSnapshot | null
  spectrum: () => Float32Array
  /** Rolling magnitude history — what the Lab's offline tools run over. */
  spectraHistory: () => Float32Array[]
  centsOffset: () => number | null
  currentNote: () => string | null
  stability: () => number | null
  elapsed: () => number
  start: () => Promise<void>
  stop: () => void
}

export function useLiveCapture(): LiveCaptureController {
  // useEngines throws outside an EngineProvider — the dashboard still has to
  // render in unit tests, so a missing context degrades to "mic unavailable".
  let engines: ReturnType<typeof useEngines> | null = null
  try {
    engines = useEngines()
  } catch {
    engines = null
  }

  const [isActive, setIsActive] = createSignal(false)
  const [error, setError] = createSignal<string | null>(null)
  const [samples, setSamples] = createSignal<LivePitchSample[]>([])
  const [snapshot, setSnapshot] = createSignal<LiveAnalysisSnapshot | null>(
    null,
  )
  const [spectrum, setSpectrum] = createSignal<Float32Array>(
    new Float32Array(0),
  )
  const [spectraHistory, setSpectraHistory] = createSignal<Float32Array[]>([])
  const [centsOffset, setCentsOffset] = createSignal<number | null>(null)
  const [currentNote, setCurrentNote] = createSignal<string | null>(null)
  const [stability, setStability] = createSignal<number | null>(null)
  const [elapsed, setElapsed] = createSignal(0)

  let detector: PitchDetector | null = null
  let spectralClient: SpectralClient | null = null
  let timbre: LiveSpectralTimbre | null = null
  let rafId = 0
  let startedAt = 0
  let lastAnalysisAt = 0
  let frameCount = 0

  const start = async () => {
    if (isActive()) return
    // Bound to a const so the narrowing survives into the RAF closure below.
    const eng = engines
    if (eng === null) {
      setError('Microphone access is only available from the main app.')
      return
    }

    setError(null)
    setSamples([])
    setSnapshot(null)
    setSpectraHistory([])
    timbre = null

    try {
      const started = await eng.practiceEngine.startMic()
      if (!started) {
        setError(
          'Could not access the microphone. Check permissions and try again.',
        )
        return
      }

      detector = new PitchDetector({
        sampleRate: eng.audioEngine.getSampleRate(),
        bufferSize: 2048,
        minConfidence: 0.4,
        minAmplitude: 0.02,
      })

      spectralClient = new SpectralClient()
      spectralClient.setCallback((result) => {
        setSpectrum(result.magnitudeSpectrum)
        setSpectraHistory((prev) => {
          const next = [...prev, result.magnitudeSpectrum]
          return next.length > MAX_SPECTRA ? next.slice(-MAX_SPECTRA) : next
        })
        timbre = {
          breathiness: result.breathiness,
          richness: result.richness,
          resonance: result.resonance,
        }
      })

      setIsActive(true)
      startedAt = performance.now()
      lastAnalysisAt = startedAt
      frameCount = 0

      const tick = () => {
        if (!isActive()) return
        frameCount++

        const timeData = eng.audioEngine.getTimeData()
        const now = performance.now()
        const seconds = (now - startedAt) / 1000
        setElapsed(seconds)

        let detectedFreq: number | null = null

        if (timeData.length > 0) {
          const detected = detector?.detect(timeData) ?? null
          if (
            detected !== null &&
            detected.clarity > MIN_CLARITY &&
            detected.frequency > MIN_FREQ_HZ
          ) {
            detectedFreq = detected.frequency
            const sample: LivePitchSample = {
              frequency: detected.frequency,
              clarity: detected.clarity,
              amplitude: rmsAmplitude(timeData),
              noteName: detected.noteName,
              timestamp: seconds,
            }
            setSamples((prev) => {
              const next = [...prev, sample]
              return next.length > MAX_SAMPLES ? next.slice(-TRIM_TO) : next
            })
          }
        }

        // Feed the spectral worker and refresh the readouts at ~15fps.
        if (frameCount % 4 === 0) {
          if (timeData.length > 0 && detectedFreq !== null) {
            spectralClient?.analyzeFrame(
              timeData,
              eng.audioEngine.getSampleRate(),
              detectedFreq,
            )

            const midi = 69 + 12 * Math.log2(Math.max(1, detectedFreq) / 440)
            setCentsOffset(computeCentsDeviation(midi))
            setCurrentNote(midiToNoteName(Math.round(midi)))
            setStability(
              computePitchStability(
                samples().map((s) => ({
                  time: s.timestamp,
                  midi: 69 + 12 * Math.log2(Math.max(1, s.frequency) / 440),
                  clarity: s.clarity,
                })),
              ),
            )
          } else {
            setCentsOffset(null)
            setCurrentNote(null)
          }
        }

        if (now - lastAnalysisAt > ANALYSIS_INTERVAL_MS) {
          lastAnalysisAt = now
          const buffer = samples()
          if (buffer.length > 10) {
            setSnapshot(analyzeLiveBuffer(buffer, timbre ?? undefined))
          }
        }

        rafId = requestAnimationFrame(tick)
      }

      rafId = requestAnimationFrame(tick)
    } catch (err) {
      setError(
        `Microphone error: ${err instanceof Error ? err.message : String(err)}`,
      )
      // Construction can fail after startMic() succeeded (detector or
      // spectral worker). Tear down whatever was built so a failed start
      // never leaves the microphone or the worker running.
      stop()
    }
  }

  const stop = () => {
    setIsActive(false)
    if (rafId) {
      cancelAnimationFrame(rafId)
      rafId = 0
    }
    engines?.practiceEngine.stopMic()
    detector = null
    spectralClient?.destroy()
    spectralClient = null
    frameCount = 0
    // Buffer and snapshot are kept so the take stays readable after stopping.
  }

  onCleanup(stop)

  return {
    isActive,
    error,
    samples,
    snapshot,
    spectrum,
    spectraHistory,
    centsOffset,
    currentNote,
    stability,
    elapsed,
    start,
    stop,
  }
}
