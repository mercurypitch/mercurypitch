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

// Helper function to compute error items - create outside component to avoid reactivity
function computeErrorItems(errors: number[]) {
  const testFreqs = [
    65.41, 73.42, 82.41, 87.31, 98.0, 110.0, 130.81, 146.83, 164.81, 196.0,
    220.0, 261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25, 783.99,
    880.0, 1046.5,
  ]
  const noteNames = [
    'C3',
    'C#3',
    'D3',
    'D#3',
    'E3',
    'F3',
    'F#3',
    'G3',
    'G#3',
    'A3',
    'A#3',
    'B3',
    'C4',
    'C#4',
    'D4',
    'D#4',
    'E4',
    'F4',
    'F#4',
    'G4',
    'G#4',
    'A4',
    'A#4',
  ]

  const items: { idx: number; freq: number; noteName: string }[] = []
  for (let i = 0; i < errors.length && i < 20; i++) {
    const idx = errors[i]
    const freq = testFreqs[idx] ?? 440
    const noteName = noteNames[idx] ?? 'Unknown'
    items.push({ idx, freq, noteName })
  }
  return items
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
  }>({ passed: 0, failed: 0, errors: [] })

  // UI state
  const [isRunningTest, setIsRunningTest] = createSignal(false)
  const [zoomLevel, setZoomLevel] = createSignal(1)

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

    const detector = detectorForAlgorithm()
    if (detector === undefined) return

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

    const result = detector.detect(dataArray)
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
    setTestResults({ passed: 0, failed: 0, errors: [] })

    // Stop any ongoing detection modes (mic, file, generate)
    stopLiveDetection()
    setIsMicStartedByUser(false)

    // Test frequencies from MIDI 40-100 (C3-A6)
    const testFrequencies = [
      65.41, 73.42, 82.41, 87.31, 98.0, 110.0, 130.81, 146.83, 164.81, 196.0,
      220.0, 261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25,
      783.99, 880.0, 1046.5,
    ]

    const detector = detectors().find(
      (d) => d.algorithm === selectedAlgorithm(),
    )
    if (detector === null || detector === undefined) {
      setIsRunningTest(false)
      return
    }

    const errors: number[] = []
    let passed = 0

    testFrequencies.forEach((freq, index) => {
      // Small delay between tests
      setTimeout(() => {
        const wave = new Float32Array(44100 * 0.5) // Generate same duration for all
        for (let i = 0; i < wave.length; i++) {
          const t = i / 44100
          const amplitude = t < 0.01 ? t / 0.01 : 1
          wave[i] = Math.sin(2 * Math.PI * freq * t) * amplitude
        }

        const result = detector.detect(wave)

        if (
          result !== null &&
          result !== undefined &&
          Math.abs(result.frequency - freq) < 5
        ) {
          passed++
        } else {
          errors.push(index)
        }

        const totalPassed = passed + errors.length
        const newFailed = errors.length
        setTestResults({ passed: totalPassed, failed: newFailed, errors })

        if (errors.length === testFrequencies.length) {
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
    setTestResults({ passed: 0, failed: 0, errors: [] })
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
            <label>Algorithm</label>
            <select
              disabled={isDetecting() || isRunningTest()}
              value={selectedAlgorithm()}
              onChange={(e) =>
                setSelectedAlgorithm(
                  e.currentTarget.value as 'yin' | 'fft' | 'autocorr',
                )
              }
            >
              <option value="yin">YIN Algorithm</option>
              <option value="autocorr">Autocorrelation</option>
              <option value="fft">FFT Max Bin</option>
            </select>
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
                  <span class="metric-label">Clarity</span>
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
          {testResults().errors.length === 0 || isRunningTest() ? (
            <div class="results-panel">
              <h3>Test Results</h3>
              <div class="test-metrics">
                <div class="metric-row">
                  <span>Total Tests</span>
                  <span>{testResults().passed + testResults().failed}</span>
                </div>
                <div class="metric-row passed">
                  <span>Passed</span>
                  <span>{testResults().passed}</span>
                </div>
                <div class="metric-row failed">
                  <span>Failed</span>
                  <span>{testResults().failed}</span>
                </div>
                {testResults().passed > 0 && (
                  <div class="metric-row result">
                    <span>Success Rate</span>
                    <span>
                      {(
                        (testResults().passed /
                          (testResults().passed + testResults().failed)) *
                        100
                      ).toFixed(1)}
                      %
                    </span>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div class="results-panel">
              <h3>Test Results</h3>
              <div class="error-list">
                <p>Failed at test indexes:</p>
                <div class="error-grid">
                  <Show
                    when={computeErrorItems(testResults().errors).length > 0}
                  >
                    <For each={computeErrorItems(testResults().errors)}>
                      {(item: {
                        idx: number
                        freq: number
                        noteName: string
                      }) => (
                        <div class="error-item">
                          {item.noteName} ({item.freq.toFixed(2)} Hz)
                        </div>
                      )}
                    </For>
                  </Show>
                  {testResults().errors.length > 20 && (
                    <div class="error-item">
                      ... and {testResults().errors.length - 20} more
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Algorithm Info */}
          {currentDetector() !== undefined && (
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
          )}
        </div>
      </div>
    </div>
  )
}
