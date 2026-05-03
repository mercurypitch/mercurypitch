// ============================================================
// Pitch Algorithm Tester UI
// ============================================================

import type { Component } from 'solid-js'
import { createMemo, createSignal, For, onCleanup, onMount, Show, } from 'solid-js'
import { REGISTERED_ALGORITHMS, TEST_SAMPLES } from '@/data/pitch-test-samples'
import type { AlgorithmResult, TestSample } from '@/lib/pitch-algorithm-tester'
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
  const [showResults, setShowResults] = createSignal(false)
  const [results, setResults] = createSignal<AlgorithmResult[]>([])
  const [progress, setProgress] = createSignal(0)
  const [progressText, setProgressText] = createSignal('Initializing...')

  const algorithms = REGISTERED_ALGORITHMS
  const samples = TEST_SAMPLES

  // Cleanup function for when component unmounts
  onCleanup(() => {
    // Any pending cleanup code would go here
  })

  // Stable function for checkbox change handler
  const toggleAlgorithm = (algo: PitchAlgorithm) => {
    const selected = selectedAlgorithms()
    setSelectedAlgorithms(
      selected.includes(algo)
        ? selected.filter((a) => a !== algo)
        : [...selected, algo],
    )
  }

  const playSample = async () => {
    const sample = selectedSample()
    if (!sample || running()) return

    setRunning(true)
    setShowResults(false)
    setProgress(0)
    setProgressText('Running tests...')

    // Run real benchmarking for selected algorithms
    const results: AlgorithmResult[] = []
    const totalAlgos = selectedAlgorithms().length
    const notesPerAlgo = sample.notes.length

    // Batch algorithms into smaller groups to avoid blocking
    const batchedAlgos = []
    const batchSize = 2
    for (let i = 0; i < selectedAlgorithms().length; i += batchSize) {
      batchedAlgos.push(selectedAlgorithms().slice(i, i + batchSize))
    }

    let completedAlgos = 0

    for (let batchIndex = 0; batchIndex < batchedAlgos.length; batchIndex++) {
      const batch = batchedAlgos[batchIndex]

      // Update progress for this batch
      const algoProgress = 100 / batchedAlgos.length
      setProgress(Math.round((batchIndex / batchedAlgos.length) * 100))
      setProgressText(`Running batch ${batchIndex + 1}/${batchedAlgos.length}...`)

      const batchPromises = batch.map((algo, idx) =>
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

      completedAlgos += batch.length
      setProgress(Math.round((completedAlgos / totalAlgos) * 100))
      setProgressText(`Running tests... ${completedAlgos}/${totalAlgos} algorithms`)
    }

    setResults(results)
    setShowResults(true)
    setProgress(100)
    setProgressText('Complete!')
    setTimeout(() => {
      setProgress(0)
      setProgressText('')
    }, 1000)

    setRunning(false)
  }

  return (
    <div class="pitch-algorithm-tester">
      <div class="tester-header">
        <h2>Pitch Algorithm Tester</h2>
      </div>

      <div class="tester-content" classList={{ busy: running() }}>
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
                  classList={{
                    'algorithm-item': true,
                    selected: selectedAlgorithms().includes(algo.id),
                  }}
                >
                  <input
                    type="checkbox"
                    checked={selectedAlgorithms().includes(algo.id)}
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
                  classList={{
                    'sample-btn': true,
                    selected: selectedSample()?.id === sample.id,
                  }}
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

        {/* Progress Bar */}
        <Show when={running()}>
          <div class="progress-container">
            <div class="progress-bar">
              <div
                class="progress-fill"
                style={{
                  width: `${progress()}%`,
                }}
              />
            </div>
            <span class="progress-text">{progressText()}</span>
          </div>
        </Show>

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
                  const color =
                    ACCURACY_BAND_COLORS[
                      result.totalScore as keyof typeof ACCURACY_BAND_COLORS
                    ] || '#666'
                  const offsetColor =
                    result.avgOffsetCents <= 10
                      ? ACCURACY_BAND_COLORS[
                          100 as keyof typeof ACCURACY_BAND_COLORS
                        ]
                      : ACCURACY_BAND_COLORS[
                          50 as keyof typeof ACCURACY_BAND_COLORS
                        ]

                  return (
                    <div class="result-card">
                      <div class="result-header">
                        <span class="result-algo-name">{result.algorithm}</span>
                        <span class="result-score" style={{ color }}>
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
                          classList={{
                            'offset-val': true,
                            good: result.avgOffsetCents <= 10,
                            bad: result.avgOffsetCents > 10,
                          }}
                        >
                          {result.avgOffsetCents.toFixed(1)}¢
                        </span>
                      </div>
                      <div class="offset-bar">
                        <div
                          class="offset-fill"
                          style={{
                            width: `${Math.min(100, result.avgOffsetCents)}%`,
                            background: offsetColor,
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
              <Show when={selectedSample()}>
                {(sample) => (
                  <For each={sample().notes}>
                    {(note: { name: string; frequency: number }) => {
                      const algorithmResults = results().filter((r) =>
                        r.results.some(
                          (rr) => rr.targetFreq === note.frequency,
                        ),
                      )

                      return (
                        <div class="note-row">
                          <span class="note-name">{note.name}</span>
                          <span class="note-freq">
                            {note.frequency.toFixed(2)} Hz
                          </span>
                          <For each={algorithmResults}>
                            {(result: AlgorithmResult) => {
                              // Pre-compute the result for this frequency to avoid reactivity issues
                              const matchingResult = result.results.find(
                                (rr) => rr.targetFreq === note.frequency,
                              )
                              const color =
                                ACCURACY_BAND_COLORS[
                                  matchingResult?.accuracyBand as keyof typeof ACCURACY_BAND_COLORS
                                ] || '#666'
                              const offsetCents =
                                matchingResult?.offsetCents ?? 0

                              return (
                                <span class="note-offset" style={{ color }}>
                                  {offsetCents.toFixed(0)}¢
                                </span>
                              )
                            }}
                          </For>
                        </div>
                      )
                    }}
                  </For>
                )}
              </Show>
            </div>
          </div>
        </Show>
      </div>
    </div>
  )
}
