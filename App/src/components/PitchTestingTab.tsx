// ============================================================
// PitchTestingTab - Developer Debug Tab for Pitch Detection
// ============================================================

import type { Component } from 'solid-js'
import { For, createSignal, createEffect, onCleanup } from 'solid-js'
import { appStore } from '@/stores'
import { YINDetector, FFTDetector, AutocorrelatorDetector, type PitchDetectionResult } from '@/lib/pitch-algorithms'
import { getAllTests } from '@/lib/pitch-algorithms/test-data'

interface PitchTestingTabProps {
  onClose?: () => void
}

type DetectionMode = 'mic' | 'file' | 'generate'

export const PitchTestingTab: Component<PitchTestingTabProps> = (props) => {
  const [detectors] = createSignal([
    new YINDetector(),
    new FFTDetector(),
    new AutocorrelatorDetector(),
  ])

  const [selectedAlgorithm, setSelectedAlgorithm] = createSignal<'yin' | 'fft' | 'autocorr'>('yin')
  const [detectionMode, setDetectionMode] = createSignal<DetectionMode>('generate')
  const [frequency, setFrequency] = createSignal(440)
  const [generatedWaveform, setGeneratedWaveform] = createSignal<Float32Array | null>(null)

  // Detection results over time
  const [liveResults, setLiveResults] = createSignal<(PitchDetectionResult | null)[]>([])
  const [isDetecting, setIsDetecting] = createSignal(false)

  // Metrics display
  const [totalDetections, setTotalDetections] = createSignal(0)
  const [avgClarity, setAvgClarity] = createSignal(0)
  const [avgErrorHz, setAvgErrorHz] = createSignal(0)

  // Test results
  const [testResults, setTestResults] = createSignal<{
    passed: number
    failed: number
    errors: number[]
  }>({ passed: 0, failed: 0, errors: [] })

  // UI state
  const [isRunningTest, setIsRunningTest] = createSignal(false)

  let animationFrameId: number | null = null
  let testAnimationFrameId: number | null = null

  // Generate test waveform
  const generateWaveform = () => {
    const sampleRate = appStore.sampleRate() || 44100
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

    const updateDetection = () => {
      if (!isDetecting()) return

      const detector = detectors().find(d => d.algorithm === selectedAlgorithm())
      if (!detector) return

      const wave = generatedWaveform()
      if (!wave) {
        animationFrameId = requestAnimationFrame(updateDetection)
        return
      }

      const result = detector.detect(wave)

      setLiveResults(prev => [...prev.slice(-100), result])

      animationFrameId = requestAnimationFrame(updateDetection)
    }

    animationFrameId = requestAnimationFrame(updateDetection)
  }

  // Stop live detection
  const stopLiveDetection = () => {
    setIsDetecting(false)
    if (animationFrameId !== null) {
      cancelAnimationFrame(animationFrameId)
      animationFrameId = null
    }
  }

  // Run automated test
  const runTest = () => {
    setIsRunningTest(true)
    setTestResults({ passed: 0, failed: 0, errors: [] })

    const tests = getAllTests()
    const detector = detectors().find(d => d.algorithm === selectedAlgorithm())
    if (!detector) {
      setIsRunningTest(false)
      return
    }

    let errors: number[] = []
    let passed = 0

    tests.forEach((test, index) => {
      // Small delay between tests
      setTimeout(() => {
        const wave = new Float32Array(44100 * 0.5) // Generate same duration for all
        for (let i = 0; i < wave.length; i++) {
          const t = i / 44100
          const amplitude = t < 0.01 ? t / 0.01 : 1
          wave[i] = Math.sin(2 * Math.PI * test.frequency * t) * amplitude
        }

        const result = detector.detect(wave)

        if (result && Math.abs(result.frequency - test.expectedFreq) < 5) {
          passed++
        } else {
          errors.push(index)
        }

        const totalPassed = passed + errors.length
        const newFailed = errors.length
        setTestResults({ passed: totalPassed, failed: newFailed, errors })

        if (errors.length === tests.length) {
          setIsRunningTest(false)
        }
      }, index * 100)
    })
  }

  // Reset everything
  const resetAll = () => {
    detectors().forEach(d => d.reset())
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

  const currentDetector = detectors().find(d => d.algorithm === selectedAlgorithm())

  return (
    <div class="pitch-testing-tab">
      <div class="pitch-testing-header">
        <h2>Pitch Detection Testing</h2>
        {props.onClose && (
          <button class="close-btn" onclick={props.onClose}>×</button>
        )}
      </div>

      <div class="pitch-testing-layout">
        {/* Left Panel - Controls */}
        <div class="pitch-testing-controls">
          <div class="control-group">
            <label>Algorithm</label>
            <select
              value={selectedAlgorithm()}
              onChange={(e) => setSelectedAlgorithm(e.currentTarget.value as 'yin' | 'fft' | 'autocorr')}
            >
              <option value="yin">YIN Algorithm</option>
              <option value="autocorr">Autocorrelation</option>
              <option value="fft">FFT Max Bin</option>
            </select>
          </div>

          <div class="control-group">
            <label>Detection Mode</label>
            <select value={detectionMode()} onChange={(e) => setDetectionMode(e.currentTarget.value as DetectionMode)}>
              <option value="generate">Generate Sine Wave</option>
              <option value="file">Load File (TODO)</option>
              <option value="mic">Microphone (TODO)</option>
            </select>
          </div>

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

          <button class="btn btn-outline" onclick={resetAll}>Reset All</button>
        </div>

        {/* Right Panel - Visualization */}
        <div class="pitch-testing-visualization">
          {/* Live Detection Display */}
          {isDetecting() && (
            <div class="detection-panel">
              <h3>Live Detection</h3>

              {currentDetector && (
                <div class="metrics-grid">
                  <div class="metric-item">
                    <span class="metric-label">Status</span>
                    <span class="metric-value">{currentDetector.getMetrics().status}</span>
                  </div>
                  <div class="metric-item">
                    <span class="metric-label">Frequency</span>
                    <span class="metric-value">
                      {currentDetector.getLastResult()?.frequency.toFixed(2) ?? '—'} Hz
                    </span>
                  </div>
                  <div class="metric-item">
                    <span class="metric-label">Note</span>
                    <span class="metric-value">
                      {currentDetector.getLastResult()?.noteName ?? '—'}
                    </span>
                  </div>
                  <div class="metric-item">
                    <span class="metric-label">Midi</span>
                    <span class="metric-value">
                      {currentDetector.getLastResult()?.midi.toFixed(0) ?? '—'}
                    </span>
                  </div>
                  <div class="metric-item">
                    <span class="metric-label">Cents</span>
                    <span class="metric-value">
                      {currentDetector.getLastResult()?.cents.toFixed(1) ?? '—'}
                    </span>
                  </div>
                  <div class="metric-item">
                    <span class="metric-label">Clarity</span>
                    <span class="metric-value">
                      {currentDetector.getLastResult()?.clarity.toFixed(2) ?? '—'}
                    </span>
                  </div>
                  <div class="metric-item">
                    <span class="metric-label">Computation</span>
                    <span class="metric-value">
                      {currentDetector.getLastComputationTime().toFixed(3)} ms
                    </span>
                  </div>
                </div>
              )}

              {/* Waveform and Frequency Over Time */}
              <div class="waveform-display">
                <h4>Detection Over Time</h4>
                <div class="waveform-canvas">
                  {liveResults().map((result, i) => (
                    <div
                      key={i}
                      class="waveform-dot"
                      style={{
                        '--y': result
                          ? `${((440 - result.frequency) / 440) * 100}%`
                          : '50%',
                        '--freq': result ? `${result.frequency}` : '0',
                      }}
                      title={`${result?.noteName ?? 'No signal'} (${result?.frequency?.toFixed(2)} Hz)`}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

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
                      {((testResults().passed / (testResults().passed + testResults().failed)) * 100).toFixed(1)}%
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
                  {testResults().errors.slice(0, 20).map(idx => (
                    <div key={idx} class="error-item">
                      {getAllTests()[idx].expectedNote} ({getAllTests()[idx].frequency} Hz)
                    </div>
                  ))}
                  {testResults().errors.length > 20 && (
                    <div class="error-item">... and {testResults().errors.length - 20} more</div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Algorithm Info */}
          {currentDetector && (
            <div class="info-panel">
              <h3>{currentDetector.getName()}</h3>
              <p>{currentDetector.getDescription()}</p>

              {currentDetector.getLastResult() && (
                <div class="last-result">
                  <h4>Last Detection</h4>
                  <div class="result-details">
                    <div>Frequency: {currentDetector.getLastResult().frequency.toFixed(4)} Hz</div>
                    <div>Note: {currentDetector.getLastResult().noteName}</div>
                    <div>Midi: {currentDetector.getLastResult().midi.toFixed(2)}</div>
                    <div>Cents: {currentDetector.getLastResult().cents.toFixed(4)}</div>
                    <div>Clarity: {currentDetector.getLastResult().clarity.toFixed(4)}</div>
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
