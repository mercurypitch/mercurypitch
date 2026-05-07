// ============================================================
// PitchTestingTab - Developer Debug Tab for Pitch Detection
// ============================================================

import type { Component } from 'solid-js'
import { createEffect, createMemo, createSignal, For, onCleanup, Show, } from 'solid-js'
import type { PitchDetectionResult } from '@/lib/pitch-algorithms'
import { AutocorrelatorDetector, FFTDetector, YINDetector, } from '@/lib/pitch-algorithms'
import type { TimeStampedPitchSample } from '@/types/pitch-algorithms'
import { PitchOverTimeCanvas } from '@/components/PitchOverTimeCanvas'
import { currentScale } from '@/stores/melody-store'

interface PitchTestingTabProps {
  onClose?: () => void
}

type DetectionMode = 'mic' | 'file' | 'generate'
type AlgorithmId = 'yin' | 'fft' | 'autocorr'

interface TestNoteResult {
  noteName: string
  targetFreq: number
  passed: boolean
  detectedFreq: number | null
}

interface EnsembleTickResult {
  algorithm: AlgorithmId
  result: PitchDetectionResult | null
}

interface EnsembleTestNoteResult {
  noteName: string
  targetFreq: number
  ensemblePassed: boolean
  ensembleFreq: number | null
  perAlgorithm: Record<string, { passed: boolean; detectedFreq: number | null }>
}

const TEST_FREQUENCIES = [
  65.41, 73.42, 82.41, 87.31, 98.0, 110.0, 130.81, 146.83, 164.81, 196.0,
  220.0, 261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25,
  783.99, 880.0, 1046.5,
]

const TEST_NOTE_NAMES = [
  'C2', 'D2', 'E2', 'F2', 'G2', 'A2',
  'C3', 'D3', 'E3', 'G3', 'A3',
  'C4', 'D4', 'E4', 'G4', 'A4',
  'C5', 'D5', 'E5', 'G5', 'A5', 'C6',
]

// Log-scale frequency slider helpers
const FREQ_SLIDER_MIN = 65
const FREQ_SLIDER_MAX = 2100
const FREQ_LOG_RATIO = Math.log2(FREQ_SLIDER_MAX / FREQ_SLIDER_MIN)
const FREQ_SLIDER_STEPS = 1000

function freqToSliderVal(freq: number): number {
  return Math.round(
    (Math.log2(freq / FREQ_SLIDER_MIN) / FREQ_LOG_RATIO) * FREQ_SLIDER_STEPS,
  )
}

function sliderValToFreq(val: number): number {
  return Math.round(
    FREQ_SLIDER_MIN *
      Math.pow(2, (val / FREQ_SLIDER_STEPS) * FREQ_LOG_RATIO),
  )
}

export const PitchTestingTab: Component<PitchTestingTabProps> = (props) => {
  const [detectors] = createSignal([
    new YINDetector(),
    new FFTDetector(),
    new AutocorrelatorDetector(),
  ])

  const [selectedAlgorithm, setSelectedAlgorithm] = createSignal<
    'yin' | 'fft' | 'autocorr'
  >('yin')
  const [ensembleMode, setEnsembleMode] = createSignal(false)
  const [ensembleAlgorithms, setEnsembleAlgorithms] = createSignal<
    Set<AlgorithmId>
  >(new Set(['yin', 'fft']))
  const [ensembleTickResults, setEnsembleTickResults] = createSignal<
    EnsembleTickResult[]
  >([])
  const [detectionMode, setDetectionMode] =
    createSignal<DetectionMode>('mic')
  const [frequency, setFrequency] = createSignal(440)
  const [generatedWaveform, setGeneratedWaveform] =
    createSignal<Float32Array | null>(null)

  // File upload state
  const [uploadedFile, setUploadedFile] = createSignal<File | null>(null)
  const [fileWaveform, setFileWaveform] = createSignal<Float32Array | null>(
    null,
  )
  const [fileDuration, setFileDuration] = createSignal(0)

  // Microphone state
  const [audioContext, setAudioContext] = createSignal<AudioContext | null>(
    null,
  )
  const [mediaStream, setMediaStream] = createSignal<MediaStream | null>(null)
  const [sourceNode, setSourceNode] = createSignal<AudioNode | null>(null)
  const [analyser, setAnalyser] = createSignal<AnalyserNode | null>(null)
  const [isMicStartedByUser, setIsMicStartedByUser] = createSignal(false)

  // Detection results over time
  const [liveResults, setLiveResults] = createSignal<
    (PitchDetectionResult | null)[]
  >([])
  const [pitchSamples, setPitchSamples] = createSignal<
    TimeStampedPitchSample[]
  >([])
  const [isDetecting, setIsDetecting] = createSignal(false)

  // Metrics display
  const [_totalDetections, setTotalDetections] = createSignal(0)
  const [_avgClarity, setAvgClarity] = createSignal(0)
  const [_avgErrorHz, setAvgErrorHz] = createSignal(0)

  // Test results
  const [testResults, setTestResults] = createSignal<{
    passed: number
    failed: number
    errors: number[]
    noteResults: TestNoteResult[]
  }>({ passed: 0, failed: 0, errors: [], noteResults: [] })

  // UI state
  const [isRunningTest, setIsRunningTest] = createSignal(false)
  const [zoomLevel, setZoomLevel] = createSignal(1)
  const [sensitivity, setSensitivity] = createSignal(7)
  const [minConfidence, setMinConfidence] = createSignal(0.3)

  let detectionTimerId: number | null = null
  let detectionStartTime = 0
  let streamStopTimeout: number | null = null

  // Resize state
  let waveformHeight = 280
  let isResizing = false
  let resizeStartY = 0
  let resizeStartHeight = 0

  const onResizeMouseDown = (e: MouseEvent) => {
    isResizing = true
    resizeStartY = e.clientY
    resizeStartHeight = waveformHeight
    document.addEventListener('mousemove', onResizeMouseMove)
    document.addEventListener('mouseup', onResizeMouseUp)
    document.body.style.cursor = 'ns-resize'
    document.body.style.userSelect = 'none'
  }

  const onResizeMouseMove = (e: MouseEvent) => {
    if (!isResizing) return
    const delta = e.clientY - resizeStartY
    waveformHeight = Math.max(150, Math.min(600, resizeStartHeight + delta))
    const el = document.querySelector('.waveform-canvas') as HTMLElement | null
    if (el) el.style.height = `${waveformHeight}px`
  }

  const onResizeMouseUp = () => {
    isResizing = false
    document.removeEventListener('mousemove', onResizeMouseMove)
    document.removeEventListener('mouseup', onResizeMouseUp)
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
  }

  const zoomIn = () => {
    const steps = [1, 2, 3, 5, 8]
    const current = zoomLevel()
    const idx = steps.indexOf(current)
    if (idx < steps.length - 1) setZoomLevel(steps[idx + 1]!)
  }

  const zoomOut = () => {
    const steps = [1, 2, 3, 5, 8]
    const current = zoomLevel()
    const idx = steps.indexOf(current)
    if (idx > 0) setZoomLevel(steps[idx - 1]!)
  }

  // Load audio file
  const handleFileUpload = (event: Event) => {
    const target = event.currentTarget as HTMLInputElement
    const file = target.files?.[0]
    if (!file) return

    setUploadedFile(file)

    const reader = new FileReader()
    reader.onload = (e) => {
      const audioData = e.target?.result as ArrayBuffer
      processAudioFile(audioData)
    }
    reader.readAsArrayBuffer(file)
  }

  const processAudioFile = async (audioData: ArrayBuffer) => {
    const ctx = audioContext()
    if (!ctx) return

    try {
      const audioBuffer = await ctx.decodeAudioData(audioData)

      // Convert to Float32Array and normalize
      const rawData = audioBuffer!.getChannelData(0)
      const sampleRate = audioBuffer!.sampleRate

      // Downsample if necessary for performance
      let samples = rawData
      if (sampleRate > 44100) {
        const ratio = 44100 / sampleRate
        const newLength = Math.floor(rawData.length * ratio)
        samples = new Float32Array(newLength)
        for (let i = 0; i < newLength; i++) {
          samples[i] = rawData[Math.floor(i / ratio)]
        }
      }

      setFileWaveform(samples)
      setFileDuration(audioBuffer!.duration)
      stopLiveDetection() // Reset detection
    } catch (error) {
      console.error('Error processing audio file:', error)
      alert('Failed to process audio file')
    }
  }

  // Start microphone input (only sets up, doesn't start detection loop)
  const startMicrophoneInput = async () => {
    try {
      const ctx = new AudioContext({ sampleRate: 44100 })
      setAudioContext(ctx)
      await ctx.resume()

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      setMediaStream(stream)

      const source = ctx.createMediaStreamSource(stream)
      setSourceNode(source)

      const analyserNode = ctx.createAnalyser()
      analyserNode.fftSize = 2048
      analyserNode.smoothingTimeConstant = 0.1
      setAnalyser(analyserNode)

      source.connect(analyserNode)
      setIsMicStartedByUser(true)
    } catch (error) {
      console.error('Error accessing microphone:', error)
      alert(
        'Failed to access microphone. Please ensure you have granted permission.',
      )
    }
  }

  // Dedicated cleanup for microphone resources (no reactivity)
  const cleanupMicrophoneResources = () => {
    mediaStream()
      ?.getTracks()
      .forEach((track) => track.stop())
    setMediaStream(null)
    sourceNode()?.disconnect()
    setSourceNode(null)
    audioContext()?.close()
    setAudioContext(null)
  }

  const stopMicrophoneInput = () => {
    cleanupMicrophoneResources()
    // Don't call stopLiveDetection here to avoid circular calls
  }

  // Unified detection tick — called on a throttled setInterval (10 Hz)
  const detectionTick = () => {
    if (!isDetecting()) {
      if (detectionTimerId !== null) {
        clearInterval(detectionTimerId)
        detectionTimerId = null
      }
      return
    }

    const isEnsemble = ensembleMode()

    if (!isEnsemble) {
      const detector = detectorForAlgorithm()
      if (detector === undefined) return
    }

    const mode = detectionMode()
    let dataArray: Float32Array

    if (mode === 'mic') {
      if (!isMicStartedByUser()) return
      const analyserVal = analyser()
      if (!analyserVal) return
      dataArray = new Float32Array(analyserVal.fftSize)
      analyserVal.getFloatTimeDomainData(dataArray)
    } else if (mode === 'generate') {
      const wave = generatedWaveform()
      if (!wave) return
      dataArray = wave
    } else if (mode === 'file') {
      const wave = fileWaveform()
      if (!wave) {
        stopLiveDetection()
        return
      }
      dataArray = wave
    } else {
      return
    }

    let result: PitchDetectionResult | null
    let tickPerAlgorithm: EnsembleTickResult[] = []

    if (isEnsemble) {
      const ensembleOutput = ensembleDetect(dataArray)
      result = ensembleOutput.result
      tickPerAlgorithm = ensembleOutput.perAlgorithm
      setEnsembleTickResults(tickPerAlgorithm)
    } else {
      const detector = detectorForAlgorithm()!
      result = detector.detect(dataArray)
    }

    setLiveResults((prev) => [...prev.slice(-100), result])

    const now = performance.now()
    const elapsed = detectionStartTime > 0 ? (now - detectionStartTime) / 1000 : 0
    const sample: TimeStampedPitchSample = {
      time: elapsed,
      freq: result?.frequency ?? null,
      noteName: result?.noteName ?? null,
      clarity: result?.clarity ?? 0,
    }
    setPitchSamples((prev) => {
      const next = [...prev, sample]
      return next.length > 1200 ? next.slice(-1200) : next
    })
  }

  // Load generated waveform
  const loadGeneratedWaveform = () => {
    stopLiveDetection()
    const sampleRate = 44100
    const duration = 0.5
    const samples = Math.floor(duration * sampleRate)
    const wave = new Float32Array(samples)

    for (let i = 0; i < samples; i++) {
      const t = i / sampleRate
      const amplitude = t < 0.01 ? t / 0.01 : 1
      wave[i] = Math.sin(2 * Math.PI * frequency() * t) * amplitude
    }

    setGeneratedWaveform(wave)
    setUploadedFile(null)
    setFileWaveform(null)
    setFileDuration(0)
  }

  // Generate test waveform
  const generateWaveform = () => {
    const sampleRate = 44100
    const duration = 0.5
    const samples = Math.floor(duration * sampleRate)
    const wave = new Float32Array(samples)

    for (let i = 0; i < samples; i++) {
      const t = i / sampleRate
      const amplitude = t < 0.01 ? t / 0.01 : 1
      wave[i] = Math.sin(2 * Math.PI * frequency() * t) * amplitude
    }

    setGeneratedWaveform(wave)
  }

  createEffect(() => {
    generateWaveform()
  })

  // Start live detection
  const startLiveDetection = () => {
    setIsDetecting(true)
    setLiveResults([])
    setPitchSamples([])
    detectionStartTime = performance.now()

    // For mic mode, start mic if needed — detectionTick will pick up when ready
    if (detectionMode() === 'mic' && !isMicStartedByUser()) {
      void startMicrophoneInput()
    }

    // Stop any existing timer before starting a new one
    if (detectionTimerId !== null) {
      clearInterval(detectionTimerId)
    }
    detectionTimerId = setInterval(detectionTick, 100)
  }

  // Stop live detection
  const stopLiveDetection = () => {
    setIsDetecting(false)
    if (detectionTimerId !== null) {
      clearInterval(detectionTimerId)
      detectionTimerId = null
    }
    if (streamStopTimeout !== null) {
      clearTimeout(streamStopTimeout)
      streamStopTimeout = null
    }
  }

  // Run automated test
  const runTest = () => {
    setIsRunningTest(true)
    setTestResults({ passed: 0, failed: 0, errors: [], noteResults: [] })

    // Stop any ongoing detection modes (mic, file, generate)
    stopLiveDetection()
    setIsMicStartedByUser(false)

    // Reset all detectors to clear pitch history — accumulated mic
    // detections would otherwise contaminate the stability filter and
    // cause new test frequencies to be rejected as outliers.
    detectors().forEach((d) => d.reset())

    const isEnsemble = ensembleMode()
    const testSampleRate = 44100

    if (!isEnsemble) {
      const detector = detectors().find(
        (d) => d.algorithm === selectedAlgorithm(),
      )
      if (detector === null || detector === undefined) {
        setIsRunningTest(false)
        return
      }
    }

    const errors: number[] = []
    let passed = 0
    const noteResults: TestNoteResult[] = []

    TEST_FREQUENCIES.forEach((freq, index) => {
      setTimeout(() => {
        const wave = new Float32Array(testSampleRate * 0.5)
        for (let i = 0; i < wave.length; i++) {
          const t = i / testSampleRate
          wave[i] = Math.sin(2 * Math.PI * freq * t)
        }

        let detectedFreq: number | null
        let isPass: boolean

        if (isEnsemble) {
          const ensembleOutput = ensembleDetect(wave)
          detectedFreq = ensembleOutput.result?.frequency ?? null
          isPass =
            ensembleOutput.result !== null &&
            Math.abs(ensembleOutput.result.frequency - freq) < 5
        } else {
          const detector = detectors().find(
            (d) => d.algorithm === selectedAlgorithm(),
          )
          const result = detector!.detect(wave)
          detectedFreq = result?.frequency ?? null
          isPass =
            result !== null &&
            result !== undefined &&
            Math.abs(result.frequency - freq) < 5
        }

        if (isPass) {
          passed++
        } else {
          errors.push(index)
        }

        noteResults.push({
          noteName: TEST_NOTE_NAMES[index] ?? '?',
          targetFreq: freq,
          passed: isPass,
          detectedFreq,
        })

        const newFailed = errors.length
        setTestResults({
          passed,
          failed: newFailed,
          errors,
          noteResults: [...noteResults],
        })

        if (passed + newFailed === TEST_FREQUENCIES.length) {
          setIsRunningTest(false)
        }
      }, index * 100)
    })
  }

  // Reset everything
  const resetAll = () => {
    stopLiveDetection()
    detectors().forEach((d) => d.reset())
    setLiveResults([])
    setPitchSamples([])
    setTestResults({ passed: 0, failed: 0, errors: [], noteResults: [] })
    setEnsembleTickResults([])
    setTotalDetections(0)
    setAvgClarity(0)
    setAvgErrorHz(0)
    setIsRunningTest(false)
  }

  onCleanup(() => {
    stopLiveDetection()
  })

  // Memoized detector lookup to avoid reactivity loops
  const currentDetector = createMemo(() => {
    const selected = selectedAlgorithm()
    for (const d of detectors()) {
      if (d.algorithm === selected) return d
    }
    return undefined
  })

  // Use createMemo to get the current detector without calling find repeatedly
  const detectorForAlgorithm = createMemo(() => {
    const alg = selectedAlgorithm()
    return detectors().find((d) => d.algorithm === alg)
  })

  const toggleEnsembleAlgorithm = (algo: AlgorithmId) => {
    const current = new Set(ensembleAlgorithms())
    if (current.has(algo)) {
      if (current.size <= 2) return // minimum 2 for ensemble
      current.delete(algo)
    } else {
      current.add(algo)
    }
    setEnsembleAlgorithms(current)
  }

  // Ensemble voting: run all selected algorithms on the same data,
  // vote on note name, pick majority winner with confidence tiebreaker.
  const ensembleDetect = (
    dataArray: Float32Array,
  ): {
    result: PitchDetectionResult | null
    perAlgorithm: EnsembleTickResult[]
    votes: Record<string, { count: number; algos: string[]; avgFreq: number }>
  } => {
    const activeDetectors = detectors().filter((d) =>
      ensembleAlgorithms().has(d.algorithm as AlgorithmId),
    )
    const perAlgorithm: EnsembleTickResult[] = []

    for (const det of activeDetectors) {
      const r = det.detect(dataArray)
      perAlgorithm.push({ algorithm: det.algorithm as AlgorithmId, result: r })
    }

    // Vote by note name
    const votes: Record<
      string,
      { count: number; algos: string[]; freqs: number[]; clarities: number[] }
    > = {}
    for (const item of perAlgorithm) {
      if (!item.result?.noteName) continue
      const note = item.result.noteName
      if (!votes[note]) votes[note] = { count: 0, algos: [], freqs: [], clarities: [] }
      votes[note].count++
      votes[note].algos.push(item.algorithm)
      votes[note].freqs.push(item.result.frequency)
      votes[note].clarities.push(item.result.clarity)
    }

    const entries = Object.entries(votes)
    if (entries.length === 0) {
      return { result: null, perAlgorithm, votes: {} }
    }

    // Sort by votes (desc), then avg clarity (desc) as tiebreaker
    entries.sort((a, b) => {
      if (b[1].count !== a[1].count) return b[1].count - a[1].count
      const avgA = a[1].clarities.reduce((s, v) => s + v, 0) / a[1].clarities.length
      const avgB = b[1].clarities.reduce((s, v) => s + v, 0) / b[1].clarities.length
      return avgB - avgA
    })

    const [winningNote, winningData] = entries[0]!
    const avgFreq =
      winningData.freqs.reduce((s, v) => s + v, 0) / winningData.freqs.length
    const agreement = winningData.count / perAlgorithm.length

    // Build simplified votes for display
    const displayVotes: Record<
      string,
      { count: number; algos: string[]; avgFreq: number }
    > = {}
    for (const [note, data] of entries) {
      displayVotes[note] = {
        count: data.count,
        algos: data.algos,
        avgFreq: data.freqs.reduce((s, v) => s + v, 0) / data.freqs.length,
      }
    }

    // Build ensemble result
    const midi = 69 + 12 * Math.log2(avgFreq / 440)
    const result: PitchDetectionResult = {
      frequency: avgFreq,
      clarity: agreement,
      noteName: winningNote,
      octave: Math.floor(midi / 12) - 1,
      cents: (midi - Math.round(midi)) * 100,
      midi: Math.round(midi),
      timestamp: performance.now(),
      computationTime: perAlgorithm.reduce(
        (s, p) => s + (p.result?.computationTime ?? 0),
        0,
      ),
    }

    return { result, perAlgorithm, votes: displayVotes }
  }

  // Latest valid result from liveResults (for reactive metrics panel)
  const latestResult = createMemo(() => {
    const results = liveResults()
    for (let i = results.length - 1; i >= 0; i--) {
      if (results[i]) return results[i]
    }
    return null
  })

  return (
    <div class="pitch-testing-tab">
      <div class="pitch-testing-header">
        <h2>Pitch Detection Testing</h2>
        {props.onClose && (
          <button class="close-btn" onclick={props.onClose}>
            ×
          </button>
        )}
      </div>

      <div class="pitch-testing-layout">
        {/* Left Panel - Controls */}
        <div class="pitch-testing-controls">
          <div class="control-group">
            <div class="algorithm-header-row">
              <label>Algorithm</label>
              <label class="ensemble-toggle-label">
                <input
                  type="checkbox"
                  checked={ensembleMode()}
                  disabled={isDetecting() || isRunningTest()}
                  onChange={(e) => setEnsembleMode(e.currentTarget.checked)}
                />
                <span class="ensemble-toggle-text">Ensemble</span>
              </label>
            </div>
            <Show
              when={ensembleMode()}
              fallback={
                <select
                  disabled={isDetecting() || isRunningTest()}
                  value={selectedAlgorithm()}
                  onChange={(e) =>
                    setSelectedAlgorithm(
                      e.currentTarget.value as AlgorithmId,
                    )
                  }
                >
                  <option value="yin">YIN Algorithm</option>
                  <option value="autocorr">Autocorrelation</option>
                  <option value="fft">FFT Max Bin</option>
                </select>
              }
            >
              <div class="ensemble-pills">
                <For each={detectors()}>
                  {(d) => {
                    const algo = d.algorithm as AlgorithmId
                    return (
                      <button
                        classList={{
                          'ensemble-pill': true,
                          selected: ensembleAlgorithms().has(algo),
                        }}
                        disabled={isDetecting() || isRunningTest()}
                        onClick={() => toggleEnsembleAlgorithm(algo)}
                      >
                        {d.getName()}
                      </button>
                    )
                  }}
                </For>
              </div>
            </Show>
          </div>

          <div class="control-group">
            <label>
              Sensitivity <span class="slider-value-badge">{sensitivity()}</span>
            </label>
            <input
              type="range"
              class="sensitivity-slider"
              min="1"
              max="10"
              step="1"
              value={sensitivity()}
              disabled={isRunningTest()}
              onInput={(e) => {
                const val = Number(e.currentTarget.value)
                setSensitivity(val)
                if (ensembleMode()) {
                  detectors().forEach((d) => d.setSensitivity(val))
                } else {
                  detectorForAlgorithm()?.setSensitivity(val)
                }
              }}
            />
            <div class="slider-range-labels">
              <span>1</span>
              <span>10</span>
            </div>
          </div>

          <div class="control-group">
            <label>
              Min Confidence{' '}
              <span class="slider-value-badge">{minConfidence().toFixed(1)}</span>
            </label>
            <input
              type="range"
              class="confidence-slider"
              min="0.3"
              max="0.9"
              step="0.1"
              value={minConfidence()}
              disabled={isRunningTest()}
              onInput={(e) => {
                const val = Number(e.currentTarget.value)
                setMinConfidence(val)
                if (ensembleMode()) {
                  detectors().forEach((d) => d.setMinConfidence(val))
                } else {
                  detectorForAlgorithm()?.setMinConfidence(val)
                }
              }}
            />
            <div class="slider-range-labels">
              <span>0.3</span>
              <span>0.9</span>
            </div>
          </div>

          <div class="control-group">
            <label>Detection Mode</label>
            <select
              disabled={isDetecting() || isRunningTest()}
              value={detectionMode()}
              onChange={(e) =>
                setDetectionMode(e.currentTarget.value as DetectionMode)
              }
            >
              <option value="generate">Generate Sine Wave</option>
              <option value="file">Load Audio File</option>
              <option value="mic">Microphone Input</option>
            </select>
          </div>

          {/* Microphone Mode UI */}
          <Show when={detectionMode() === 'mic'}>
            <div class="mic-controls">
              {!audioContext() && (
                <>
                  <button
                    class="btn btn-primary btn-sm"
                    onclick={() => void startMicrophoneInput()}
                  >
                    Enable Microphone
                  </button>
                  <span class="mic-hint">
                    Allows live testing with your voice or instrument
                  </span>
                </>
              )}
              {audioContext() && (
                <button
                  class="btn btn-secondary btn-sm"
                  onclick={stopMicrophoneInput}
                >
                  Stop Microphone
                </button>
              )}
              {audioContext() && (
                <span class="mic-status active">Microphone Active</span>
              )}
              {!audioContext() && (
                <span class="mic-status">Microphone Inactive</span>
              )}
            </div>
          </Show>

          {/* File Upload Mode UI */}
          <Show when={detectionMode() === 'file'}>
            <div class="file-controls">
              <input
                type="file"
                accept="audio/*"
                class="file-input"
                onChange={handleFileUpload}
              />
              <Show when={fileWaveform()}>
                <span class="file-info">
                  Loaded: {uploadedFile()?.name ?? 'audio'} •{' '}
                  {fileDuration().toFixed(2)}s
                </span>
              </Show>
              <Show when={!fileWaveform()}>
                <span class="file-info">No file loaded</span>
              </Show>
            </div>
          </Show>

          {/* Generate Mode UI */}
          <Show when={detectionMode() === 'generate'}>
            <div class="generate-controls">
              <button
                class="btn btn-secondary btn-sm"
                onclick={loadGeneratedWaveform}
              >
                Regenerate Waveform
              </button>
              <span class="waveform-info">
                Generated: {frequency()} Hz • 0.5s
              </span>
            </div>
          </Show>

          <div class="control-group">
            <label>Test Frequency (Hz)</label>
            <input
              type="number"
              value={frequency()}
              onChange={(e) => setFrequency(Number(e.currentTarget.value))}
              step="0.01"
            />
            <input
              type="range"
              class="freq-slider"
              min="0"
              max={FREQ_SLIDER_STEPS}
              value={freqToSliderVal(frequency())}
              disabled={isRunningTest()}
              onInput={(e) => {
                setFrequency(sliderValToFreq(Number(e.currentTarget.value)))
              }}
            />
            <span class="control-hint">{frequency()} Hz</span>
          </div>

          <button
            class="btn btn-primary"
            onclick={startLiveDetection}
            disabled={isDetecting() || isRunningTest()}
          >
            {isDetecting() ? 'Detecting...' : 'Start Detection'}
          </button>

          <button
            class="btn btn-secondary"
            onclick={stopLiveDetection}
            disabled={!isDetecting() || isRunningTest()}
          >
            Stop
          </button>

          <button
            class="btn btn-test"
            onclick={runTest}
            disabled={isRunningTest() || isDetecting()}
          >
            {isRunningTest() ? 'Running Test...' : 'Run Benchmark'}
          </button>

          <button class="btn btn-outline" onclick={resetAll}>
            Reset All
          </button>
        </div>

        {/* Right Panel - Visualization */}
        <div class="pitch-testing-visualization">
          {/* Live Detection Display */}
          <Show when={isDetecting()}>
            <div class="detection-panel">
              <h3>Live Detection</h3>

              <Show when={ensembleMode() && ensembleTickResults().length > 0}>
                <div class="ensemble-vote-bar">
                  <For each={ensembleTickResults()}>
                    {(item) => (
                      <div
                        classList={{
                          'ensemble-vote-chip': true,
                          detected: item.result !== null,
                          'no-detect': item.result === null,
                        }}
                      >
                        <span class="vote-chip-algo">{item.algorithm}</span>
                        <span class="vote-chip-note">
                          {item.result?.noteName ?? '—'}
                        </span>
                      </div>
                    )}
                  </For>
                </div>
              </Show>

              <div class="metrics-grid">
                <div class="metric-item">
                  <span class="metric-label">Status</span>
                  <span class="metric-value">
                    {latestResult() ? 'detected' : 'listening...'}
                  </span>
                </div>
                <div class="metric-item">
                  <span class="metric-label">Frequency</span>
                  <span class="metric-value">
                    {latestResult()?.frequency.toFixed(2) ?? '—'} Hz
                  </span>
                </div>
                <div class="metric-item">
                  <span class="metric-label">Note</span>
                  <span class="metric-value">
                    {latestResult()?.noteName ?? '—'}
                  </span>
                </div>
                <div class="metric-item">
                  <span class="metric-label">Midi</span>
                  <span class="metric-value">
                    {latestResult()?.midi.toFixed(0) ?? '—'}
                  </span>
                </div>
                <div class="metric-item">
                  <span class="metric-label">Cents</span>
                  <span class="metric-value">
                    {latestResult()?.cents.toFixed(1) ?? '—'}
                  </span>
                </div>
                <div class="metric-item">
                  <span class="metric-label">
                    {ensembleMode() ? 'Agreement' : 'Clarity'}
                  </span>
                  <span class="metric-value">
                    {latestResult()?.clarity.toFixed(2) ?? '—'}
                  </span>
                </div>
                <div class="metric-item">
                  <span class="metric-label">Detections</span>
                  <span class="metric-value">{liveResults().filter(Boolean).length}</span>
                </div>
              </div>

              {/* Waveform and Frequency Over Time */}
              <div class="waveform-display">
                <div class="waveform-display-header">
                  <h4>Detection Over Time</h4>
                  <div class="zoom-controls">
                    <button
                      class="zoom-btn"
                      onclick={zoomOut}
                      disabled={zoomLevel() <= 1}
                      title="Zoom out"
                    >
                      −
                    </button>
                    <span class="zoom-value">{zoomLevel()}x</span>
                    <button
                      class="zoom-btn"
                      onclick={zoomIn}
                      disabled={zoomLevel() >= 8}
                      title="Zoom in"
                    >
                      +
                    </button>
                  </div>
                </div>
                <div class="waveform-canvas" style={{ height: `${waveformHeight}px` }}>
                  <div class="waveform-canvas-inner">
                    <PitchOverTimeCanvas
                      samples={pitchSamples}
                      isDetecting={isDetecting}
                      visibleWindowSeconds={10}
                      zoomLevel={zoomLevel}
                      onZoomChange={setZoomLevel}
                      scaleNotes={currentScale}
                    />
                  </div>
                  <div class="resize-handle" onMouseDown={onResizeMouseDown}>
                    <div class="resize-grip">
                      <span class="grip-dash" />
                      <span class="grip-dash" />
                      <span class="grip-dash" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Show>

          {/* Test Results Display */}
          <Show when={testResults().noteResults.length > 0 || isRunningTest()}>
            <div class="results-panel">
              <h3>Test Results</h3>

              <Show when={isRunningTest()}>
                <p class="test-running-hint">
                  Running benchmark on {TEST_FREQUENCIES.length} notes with{' '}
                  {ensembleMode()
                    ? `${[...ensembleAlgorithms()].join(' + ')} ensemble`
                    : currentDetector()?.getName() ?? selectedAlgorithm()}
                  ...
                </p>
              </Show>

              <Show when={!isRunningTest() && testResults().noteResults.length > 0}>
                <p class="test-description">
                  {TEST_FREQUENCIES.length} pentatonic notes from C2 (65.41 Hz)
                  to C6 (1046.5 Hz), tested with{' '}
                  {ensembleMode()
                    ? `${[...ensembleAlgorithms()].join(' + ')} ensemble (majority vote)`
                    : currentDetector()?.getName() ?? selectedAlgorithm()}
                  . Pass = detected within &plusmn;5 Hz of target.
                </p>
              </Show>

              <div class="test-summary-bar">
                <div class="test-summary-item">
                  <span class="test-summary-label">Total</span>
                  <span class="test-summary-value">
                    {testResults().passed + testResults().failed}
                  </span>
                </div>
                <div class="test-summary-item passed">
                  <span class="test-summary-label">Passed</span>
                  <span class="test-summary-value">{testResults().passed}</span>
                </div>
                <div class="test-summary-item failed">
                  <span class="test-summary-label">Failed</span>
                  <span class="test-summary-value">{testResults().failed}</span>
                </div>
                <Show when={testResults().passed + testResults().failed > 0}>
                  <div class="test-summary-item rate">
                    <span class="test-summary-label">Rate</span>
                    <span class="test-summary-value">
                      {(
                        (testResults().passed /
                          (testResults().passed + testResults().failed)) *
                        100
                      ).toFixed(1)}%
                    </span>
                  </div>
                </Show>
              </div>

              <Show when={testResults().noteResults.length > 0}>
                <div class="test-table-scroll">
                  <table class="test-results-table">
                    <thead>
                      <tr>
                        <th>Note</th>
                        <th>Target (Hz)</th>
                        <th>Result</th>
                      </tr>
                    </thead>
                    <tbody>
                      <For each={testResults().noteResults}>
                        {(nr) => (
                          <tr
                            classList={{
                              'row-pass': nr.passed,
                              'row-fail': !nr.passed,
                            }}
                          >
                            <td class="test-note-name">{nr.noteName}</td>
                            <td class="test-note-freq">
                              {nr.targetFreq.toFixed(2)}
                            </td>
                            <td class="test-note-result">
                              <Show when={nr.passed}>
                                <span class="result-badge pass">Pass</span>
                              </Show>
                              <Show when={!nr.passed}>
                                <span class="result-badge fail">
                                  {nr.detectedFreq !== null
                                    ? `${nr.detectedFreq.toFixed(1)} Hz`
                                    : 'No detection'}
                                </span>
                              </Show>
                            </td>
                          </tr>
                        )}
                      </For>
                    </tbody>
                  </table>
                </div>
              </Show>
            </div>
          </Show>

          {/* Algorithm Info */}
          <Show
            when={!ensembleMode() && currentDetector() !== undefined}
            fallback={
              <Show when={ensembleMode()}>
                <div class="info-panel">
                  <h3>Ensemble Mode</h3>
                  <p>
                    {[...ensembleAlgorithms()]
                      .map((a) => {
                        const d = detectors().find((dd) => dd.algorithm === a)
                        return d?.getName() ?? a
                      })
                      .join(' + ')}{' '}
                    — majority vote on detected note name. Highest agreement
                    wins; clarity breaks ties.
                  </p>
                  <Show when={ensembleTickResults().length > 0}>
                    <div class="last-result">
                      <h4>Last Tick Per-Algorithm</h4>
                      <div class="result-details">
                        <For each={ensembleTickResults()}>
                          {(item) => (
                            <div>
                              <strong>{item.algorithm}:</strong>{' '}
                              {item.result
                                ? `${item.result.frequency.toFixed(1)} Hz (${item.result.noteName}, clarity ${item.result.clarity.toFixed(2)})`
                                : 'no detection'}
                            </div>
                          )}
                        </For>
                      </div>
                    </div>
                  </Show>
                </div>
              </Show>
            }
          >
            <div class="info-panel">
              <h3>{currentDetector()?.getName()}</h3>
              <p>{currentDetector()?.getDescription()}</p>

              {currentDetector()?.getMetrics().lastResult !== null && (
                <div class="last-result">
                  <h4>Last Detection</h4>
                  <div class="result-details">
                    <div>
                      Frequency:{' '}
                      {currentDetector()
                        ?.getMetrics()
                        .lastResult!.frequency.toFixed(4)}{' '}
                      Hz
                    </div>
                    <div>
                      Note:{' '}
                      {currentDetector()?.getMetrics().lastResult!.noteName}
                    </div>
                    <div>
                      Midi:{' '}
                      {currentDetector()
                        ?.getMetrics()
                        .lastResult!.midi.toFixed(2)}
                    </div>
                    <div>
                      Cents:{' '}
                      {currentDetector()
                        ?.getMetrics()
                        .lastResult!.cents.toFixed(4)}
                    </div>
                    <div>
                      Clarity:{' '}
                      {currentDetector()
                        ?.getMetrics()
                        .lastResult!.clarity.toFixed(4)}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </Show>
        </div>
      </div>
    </div>
  )
}
