// ============================================================
// PitchTestingTab - Developer Debug Tab for Pitch Detection
// ============================================================

import type { Component } from 'solid-js'
import { createEffect, createMemo, createSignal, For, onCleanup, Show, } from 'solid-js'
import type { PitchDetectionResult } from '@/lib/pitch-algorithms'
import { AutocorrelatorDetector, FFTDetector, YINDetector, } from '@/lib/pitch-algorithms'

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
    createSignal<DetectionMode>('generate')
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

  let animationFrameId: number | null = null
  const testAnimationFrameId: number | null = null
  let streamStopTimeout: number | null = null

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

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      setMediaStream(stream)

      const source = ctx.createMediaStreamSource(stream)
      setSourceNode(source)

      const analyserNode = ctx.createAnalyser()
      analyserNode.fftSize = 2048
      analyserNode.smoothingTimeConstant = 0.8
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

  const updateMicDetection = () => {
    if (!isDetecting() || !isMicStartedByUser()) return
    const analyserVal = analyser()
    if (!analyserVal) return

    const detector = detectorForAlgorithm()
    if (detector === undefined) return

    const dataArray = new Float32Array(analyserVal.frequencyBinCount)
    analyserVal.getFloatTimeDomainData(dataArray)

    const result = detector.detect(dataArray)
    setLiveResults((prev) => [...prev.slice(-100), result])

    animationFrameId = requestAnimationFrame(updateMicDetection)
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

  // Reactive effect: when mic becomes ready while detection is active, start the loop
  createEffect(() => {
    if (isDetecting() && detectionMode() === 'mic' && isMicStartedByUser()) {
      updateMicDetection()
    }
  })

  // Start live detection
  const startLiveDetection = () => {
    setIsDetecting(true)
    setLiveResults([])

    if (detectionMode() === 'mic') {
      if (!isMicStartedByUser()) {
        void startMicrophoneInput()
        // The createEffect above will start detection when mic is ready
      } else {
        updateMicDetection()
      }
      return
    }

    if (detectionMode() === 'file' && fileWaveform()) {
      updateFileDetection()
      return
    }

    if (detectionMode() === 'generate' && generatedWaveform()) {
      updateGenerateDetection()
      return
    }

    stopLiveDetection()
  }

  // Update detection from generated waveform
  const updateGenerateDetection = () => {
    const updateLoop = () => {
      if (!isDetecting()) return

      const detector = detectorForAlgorithm()
      if (detector === undefined) return

      const wave = generatedWaveform()
      if (!wave) {
        animationFrameId = requestAnimationFrame(updateLoop)
        return
      }

      const result = detector.detect(wave)
      setLiveResults((prev) => [...prev.slice(-100), result])

      animationFrameId = requestAnimationFrame(updateLoop)
    }

    animationFrameId = requestAnimationFrame(updateLoop)
  }

  // Update detection from uploaded file
  const updateFileDetection = () => {
    const wave = fileWaveform()
    if (!wave) {
      stopLiveDetection()
      return
    }

    const detector = detectorForAlgorithm()
    if (detector === undefined) {
      stopLiveDetection()
      return
    }

    const updateLoop = () => {
      if (!isDetecting()) return

      const result = detector.detect(wave)
      setLiveResults((prev) => [...prev.slice(-100), result])

      animationFrameId = requestAnimationFrame(updateLoop)
    }

    animationFrameId = requestAnimationFrame(updateLoop)
  }

  // Stop live detection
  const stopLiveDetection = () => {
    setIsDetecting(false)
    if (animationFrameId !== null) {
      cancelAnimationFrame(animationFrameId)
      animationFrameId = null
    }
    if (streamStopTimeout !== null) {
      clearTimeout(streamStopTimeout)
      streamStopTimeout = null
    }
    cleanupMicrophoneResources()
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
    setTestResults({ passed: 0, failed: 0, errors: [] })
    setTotalDetections(0)
    setAvgClarity(0)
    setAvgErrorHz(0)
    setIsRunningTest(false)
  }

  onCleanup(() => {
    stopLiveDetection()
    if (testAnimationFrameId !== null) {
      cancelAnimationFrame(testAnimationFrameId)
    }
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

              <Show when={currentDetector() !== undefined}>
                <div class="metrics-grid">
                  <div class="metric-item">
                    <span class="metric-label">Status</span>
                    <span class="metric-value">
                      {currentDetector()?.getMetrics().status}
                    </span>
                  </div>
                  <div class="metric-item">
                    <span class="metric-label">Frequency</span>
                    <span class="metric-value">
                      {currentDetector()
                        ?.getMetrics()
                        .lastResult?.frequency.toFixed(2) ?? '—'}{' '}
                      Hz
                    </span>
                  </div>
                  <div class="metric-item">
                    <span class="metric-label">Note</span>
                    <span class="metric-value">
                      {currentDetector()?.getMetrics().lastResult?.noteName ??
                        '—'}
                    </span>
                  </div>
                  <div class="metric-item">
                    <span class="metric-label">Midi</span>
                    <span class="metric-value">
                      {currentDetector()
                        ?.getMetrics()
                        .lastResult?.midi.toFixed(0) ?? '—'}
                    </span>
                  </div>
                  <div class="metric-item">
                    <span class="metric-label">Cents</span>
                    <span class="metric-value">
                      {currentDetector()
                        ?.getMetrics()
                        .lastResult?.cents.toFixed(1) ?? '—'}
                    </span>
                  </div>
                  <div class="metric-item">
                    <span class="metric-label">Clarity</span>
                    <span class="metric-value">
                      {currentDetector()
                        ?.getMetrics()
                        .lastResult?.clarity.toFixed(2) ?? '—'}
                    </span>
                  </div>
                  <div class="metric-item">
                    <span class="metric-label">Computation</span>
                    <span class="metric-value">
                      {currentDetector()?.getLastComputationTime().toFixed(3)}{' '}
                      ms
                    </span>
                  </div>
                </div>
              </Show>

              {/* Waveform and Frequency Over Time */}
              <div class="waveform-display">
                <h4>Detection Over Time</h4>
                <div class="waveform-canvas">
                  <For each={liveResults()}>
                    {(result) => {
                      // Pre-compute display values outside render
                      const displayFreq = result?.frequency ?? 0
                      const isTarget = displayFreq > 0
                      const position = isTarget
                        ? `${((440 - displayFreq) / 440) * 100}%`
                        : '50%'

                      return (
                        <div
                          class="waveform-dot"
                          style={{
                            '--y': position,
                            '--freq': displayFreq.toString(),
                          }}
                          title={`${result?.noteName ?? 'No signal'} (${displayFreq.toFixed(2)} Hz)`}
                        />
                      )
                    }}
                  </For>
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
