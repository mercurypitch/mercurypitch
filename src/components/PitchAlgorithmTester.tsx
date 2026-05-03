// ============================================================
// Pitch Algorithm Tester UI
// ============================================================

import type { Component } from 'solid-js'
import { createSignal, For, Show } from 'solid-js'
import { REGISTERED_ALGORITHMS, TEST_SAMPLES } from '@/data/pitch-test-samples'
import type { AlgorithmResult, PitchResultForNote, TestSample, } from '@/lib/pitch-algorithm-tester'
import { ACCURACY_BAND_COLORS, benchmarkAlgorithmAsync, DEFAULT_ALGORITHMS, getPerformanceClassification, } from '@/lib/pitch-algorithm-tester'
import type { PitchAlgorithm } from '@/lib/pitch-detector'

interface PitchAlgorithmTesterProps {
  onClose?: () => void
}

export const PitchAlgorithmTester: Component<PitchAlgorithmTesterProps> = (
  props,
) => {
  // State
  const [selectedAlgorithms, setSelectedAlgorithms] =
    createSignal<PitchAlgorithm[]>(DEFAULT_ALGORITHMS)
  const [selectedSample, setSelectedSample] = createSignal<TestSample | null>(
    null,
  )
  const [running, setRunning] = createSignal(false)
  const [results, setResults] = createSignal<AlgorithmResult[]>([])
  const [showResults, setShowResults] = createSignal(false)

  const algorithms = REGISTERED_ALGORITHMS
  const samples = TEST_SAMPLES

  const isAlgorithmSelected = (algo: PitchAlgorithm) =>
    selectedAlgorithms().includes(algo)

  const toggleAlgorithm = (algo: PitchAlgorithm) => {
    if (isAlgorithmSelected(algo)) {
      setSelectedAlgorithms((prev: PitchAlgorithm[]) =>
        prev.filter((a) => a !== algo),
      )
    } else {
      setSelectedAlgorithms((prev: PitchAlgorithm[]) => [...prev, algo])
    }
  }

  const playSample = async () => {
    const sample = selectedSample()
    if (!sample || running()) return

    setRunning(true)
    setShowResults(false)

    // Run real benchmarking for selected algorithms
    const results: AlgorithmResult[] = []

    // Batch algorithms into smaller groups to avoid blocking
    const batchedAlgos = []
    const batchSize = 2
    for (let i = 0; i < selectedAlgorithms().length; i += batchSize) {
      batchedAlgos.push(selectedAlgorithms().slice(i, i + batchSize))
    }

    for (const batch of batchedAlgos) {
      const batchPromises = batch.map((algo) =>
        benchmarkAlgorithmAsync(algo, sample, {
          sampleRate: 44100,
          bufferSize: 2048,
          minConfidence: 0.3,
        }).catch((err) => {
          console.error(`Error benchmarking ${algo}:`, err)
          return null
        }),
      )
      const batchResults = await Promise.all(batchPromises)
      results.push(
        ...batchResults.filter((r): r is AlgorithmResult => r !== null),
      )
    }

    setResults(results)
    setShowResults(true)
    setRunning(false)
  }

  return (
    <div class="pitch-algorithm-tester">
      <div class="tester-header">
        <h2>Pitch Algorithm Tester</h2>
        <button class="close-btn" onClick={() => props.onClose?.()}>
          ✕
        </button>
      </div>

      <div class="tester-content">
        {/* Algorithm Selection */}
        <div class="section">
          <h3>Algorithms to Test</h3>
          <div class="algorithm-list">
            <For each={algorithms}>
              {(algo: {
                id: PitchAlgorithm
                name: string
                description: string
              }) => (
                <label
                  class={`algorithm-item ${isAlgorithmSelected(algo.id) ? 'selected' : ''}`}
                >
                  <input
                    type="checkbox"
                    checked={isAlgorithmSelected(algo.id)}
                    onChange={() => toggleAlgorithm(algo.id)}
                  />
                  <div class="algo-info">
                    <span class="algo-name">{algo.name}</span>
                    <span class="algo-desc">
                      {algo.description.slice(0, 50)}...
                    </span>
                  </div>
                </label>
              )}
            </For>
          </div>
        </div>

        {/* Sample Selection */}
        <div class="section">
          <h3>Test Samples</h3>
          <div class="sample-list">
            <For each={samples}>
              {(sample: TestSample) => (
                <button
                  class={`sample-btn ${selectedSample()?.id === sample.id ? 'selected' : ''}`}
                  onClick={() => setSelectedSample(sample)}
                >
                  {sample.name}
                </button>
              )}
            </For>
          </div>
        </div>

        {/* Play Button */}
        <button
          class="play-btn"
          onClick={() => void playSample()}
          disabled={
            running() || !selectedSample() || selectedAlgorithms().length === 0
          }
        >
          {running() ? 'Running...' : 'Run Tests'}
        </button>

        {/* Results */}
        <Show when={showResults()}>
          <div class="results-section">
            <h3>Results</h3>

            {/* Overall Score */}
            <div class="overall-score">
              <For each={results()}>
                {(result: AlgorithmResult) => {
                  const perf = getPerformanceClassification(
                    result.avgComputationTime,
                  )
                  return (
                    <div class="result-card">
                      <div class="result-header">
                        <span class="result-algo-name">{result.algorithm}</span>
                        <span
                          class="result-score"
                          style={{
                            color:
                              ACCURACY_BAND_COLORS[
                                result.totalScore as keyof typeof ACCURACY_BAND_COLORS
                              ] || '#666',
                          }}
                        >
                          {result.totalScore}/100
                        </span>
                      </div>
                      <div class="perf-metrics">
                        <span class={`perf-badge ${perf.color}`}>
                          {perf.label}
                        </span>
                        <span class="perf-time">
                          ⚡ {result.avgComputationTime.toFixed(1)}ms avg
                        </span>
                      </div>
                      <div class="offset-metrics">
                        <span class="offset-label">Avg Offset:</span>
                        <span
                          class={`offset-val ${result.avgOffsetCents <= 10 ? 'good' : 'bad'}`}
                        >
                          {result.avgOffsetCents.toFixed(1)}¢
                        </span>
                      </div>
                      <div class="offset-bar">
                        <div
                          class="offset-fill"
                          style={{
                            width: `${Math.min(100, result.avgOffsetCents)}%`,
                            background:
                              result.avgOffsetCents <= 10
                                ? ACCURACY_BAND_COLORS[
                                    100 as keyof typeof ACCURACY_BAND_COLORS
                                  ]
                                : ACCURACY_BAND_COLORS[
                                    50 as keyof typeof ACCURACY_BAND_COLORS
                                  ],
                          }}
                        />
                      </div>
                    </div>
                  )
                }}
              </For>
            </div>

            {/* Detailed Results Table */}
            <div class="detailed-results">
              <For each={selectedSample()?.notes}>
                {(note: { name: string; frequency: number }) => {
                  const algorithmResults = results().map((r) =>
                    r.results.find((rr) => rr.targetFreq === note.frequency),
                  )
                  return (
                    <div class="note-row">
                      <span class="note-name">{note.name}</span>
                      <span class="note-freq">
                        {note.frequency.toFixed(2)} Hz
                      </span>
                      <For each={algorithmResults}>
                        {(result: PitchResultForNote | undefined) => {
                          if (result === undefined) {
                            return <span class="note-offset missing">-</span>
                          }
                          return (
                            <span
                              class="note-offset"
                              style={{
                                color:
                                  ACCURACY_BAND_COLORS[
                                    result.accuracyBand as keyof typeof ACCURACY_BAND_COLORS
                                  ] || '#666',
                              }}
                            >
                              {result.offsetCents.toFixed(0)}¢
                            </span>
                          )
                        }}
                      </For>
                    </div>
                  )
                }}
              </For>
            </div>
          </div>
        </Show>
      </div>
    </div>
  )
}
