// ============================================================
// Pitch Algorithm Tester UI
// ============================================================

import type { Component } from 'solid-js'
import { createSignal, For, onCleanup, Show } from 'solid-js'
import { REGISTERED_ALGORITHMS, TEST_SAMPLES } from '@/data/pitch-test-samples'
import type { AlgorithmResult, TestSample } from '@/lib/pitch-algorithm-tester'
import { ACCURACY_BAND_COLORS, benchmarkAlgorithmAsync, DEFAULT_ALGORITHMS, getPerformanceClassification, } from '@/lib/pitch-algorithm-tester'
import type { PitchAlgorithm } from '@/lib/pitch-detector'

interface PitchAlgorithmTesterProps {
  onClose?: () => void
}

export const PitchAlgorithmTester: Component<
  PitchAlgorithmTesterProps
> = () => {
  const [selectedAlgorithms, setSelectedAlgorithms] =
    createSignal<PitchAlgorithm[]>(DEFAULT_ALGORITHMS)
  const [selectedSamples, setSelectedSamples] = createSignal<TestSample[]>([])
  const [running, setRunning] = createSignal(false)
  const [showResults, setShowResults] = createSignal(false)
  const [results, setResults] = createSignal<AlgorithmResult[]>([])
  const [progress, setProgress] = createSignal(0)
  const [progressText, setProgressText] = createSignal('Initializing...')

  const algorithms = REGISTERED_ALGORITHMS
  const samples = TEST_SAMPLES

  onCleanup(() => {})

  const toggleAlgorithm = (algo: PitchAlgorithm) => {
    const selected = selectedAlgorithms()
    setSelectedAlgorithms(
      selected.includes(algo)
        ? selected.filter((a) => a !== algo)
        : [...selected, algo],
    )
  }

  const toggleSample = (sample: TestSample) => {
    const selected = selectedSamples()
    setSelectedSamples(
      selected.find((s) => s.id === sample.id)
        ? selected.filter((s) => s.id !== sample.id)
        : [...selected, sample],
    )
  }

  const runAll = () => {
    setSelectedSamples([...samples])
    setSelectedAlgorithms([...DEFAULT_ALGORITHMS])
    void runBenchmarks(samples, DEFAULT_ALGORITHMS)
  }

  const runSelected = () => {
    void runBenchmarks(selectedSamples(), selectedAlgorithms())
  }

  const runBenchmarks = async (
    samplesToRun: TestSample[],
    algosToRun: PitchAlgorithm[],
  ) => {
    if (samplesToRun.length === 0 || algosToRun.length === 0 || running()) return

    setRunning(true)
    setShowResults(false)
    setProgress(0)
    setProgressText('Running tests...')

    const allResults: AlgorithmResult[] = []
    const totalOps = samplesToRun.length * algosToRun.length
    let completed = 0

    for (const sample of samplesToRun) {
      for (const algo of algosToRun) {
        setProgressText(
          `Testing ${algo} on ${sample.name}...`,
        )
        const result = await benchmarkAlgorithmAsync(algo, sample, {
          sampleRate: 44100,
          bufferSize: 2048,
          minConfidence: 0.3,
        }).catch((err) => {
          console.error(`Error benchmarking ${algo}:`, err)
          return null
        })
        if (result) allResults.push(result)
        completed++
        setProgress(Math.round((completed / totalOps) * 100))
      }
    }

    setResults(allResults)
    setShowResults(true)
    setProgress(100)
    setProgressText('Complete!')
    setTimeout(() => {
      setProgress(0)
      setProgressText('')
    }, 1000)

    setRunning(false)
  }

  // Group results by sample for section dividers
  const resultsBySample = () => {
    const map = new Map<string, AlgorithmResult[]>()
    for (const r of results()) {
      const key = r.sampleId
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(r)
    }
    return map
  }

  return (
    <div class="pitch-algorithm-tester">
      <div class="tester-header">
        <h2>Pitch Algorithm Tester</h2>
      </div>

      <div class="tester-layout" classList={{ busy: running() }}>
        {/* Left Column: Controls */}
        <div class="tester-controls">
          {/* Algorithm Selection */}
          <div class="section">
            <h3>Algorithms</h3>
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
                      <span class="algo-desc">{algo.description}</span>
                    </div>
                  </label>
                )}
              </For>
            </div>
          </div>

          {/* Sample Selection */}
          <div class="section">
            <h3>Test Samples</h3>
            <div class="sample-pill-list">
              <For each={samples}>
                {(sample: TestSample) => (
                  <button
                    classList={{
                      'sample-pill': true,
                      selected: selectedSamples().find(
                        (s) => s.id === sample.id,
                      ) !== undefined,
                    }}
                    onClick={() => toggleSample(sample)}
                  >
                    {sample.name}
                  </button>
                )}
              </For>
            </div>
          </div>

          {/* Buttons */}
          <div class="tester-buttons">
            <button
              class="play-btn"
              onClick={runSelected}
              disabled={
                running() ||
                selectedSamples().length === 0 ||
                selectedAlgorithms().length === 0
              }
            >
              {running() ? 'Running...' : 'Run Selected'}
            </button>
            <button
              class="run-all-btn"
              onClick={runAll}
              disabled={running()}
            >
              Run All
            </button>
          </div>

          {/* Progress Bar */}
          <Show when={running()}>
            <div class="progress-container">
              <div class="progress-bar">
                <div
                  class="progress-fill"
                  style={{ width: `${progress()}%` }}
                />
              </div>
              <span class="progress-text">{progressText()}</span>
            </div>
          </Show>

          {/* Legend */}
          <Show when={showResults()}>
            <div class="results-legend">
              <span class="legend-item"><span class="legend-dot good" /> 10 perfect</span>
              <span class="legend-item"><span class="legend-dot ok" /> 25 good</span>
              <span class="legend-item"><span class="legend-dot bad" /> 50 okay</span>
              <span class="legend-item"><span class="legend-dot miss" /> no det</span>
            </div>
          </Show>
        </div>

        {/* Right Column: Results */}
        <div class="tester-results">
          <Show when={showResults()}>
            {/* Summary Cards */}
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

                  return (
                    <div class="result-card">
                      <div class="result-card-left">
                        <span class="result-algo-name">{result.algorithm}</span>
                        <span class={`perf-badge ${perf.color}`}>
                          {perf.label}
                        </span>
                      </div>
                      <div class="result-card-right">
                        <span class="result-score" style={{ color }}>
                          {result.totalScore}<span class="score-max">/100</span>
                        </span>
                        <span class="result-time">
                          {result.avgComputationTime.toFixed(1)}ms
                        </span>
                        <span
                          classList={{
                            'result-offset': true,
                            good: result.avgOffsetCents <= 10,
                            bad: result.avgOffsetCents > 10,
                          }}
                        >
                          {result.avgOffsetCents.toFixed(1)} off
                        </span>
                      </div>
                    </div>
                  )
                }}
              </For>
            </div>

            {/* Per-Sample Detailed Results */}
            <For each={[...resultsBySample().entries()]}>
              {([sampleId, sampleResults]) => {
                const sampleName = sampleResults[0]?.sampleName ?? sampleId
                // Build combined notes list from first result that has them
                const sampleObj = samples.find((s) => s.id === sampleId)

                return (
                  <div class="sample-section">
                    <div class="sample-section-header">{sampleName}</div>
                    <div class="detailed-results">
                      <Show when={sampleObj}>
                        {(s) => (
                          <>
                            {/* Header Row */}
                            <div
                              class="note-row note-header"
                              style={{
                                'grid-template-columns': `60px 70px repeat(${sampleResults.length}, minmax(50px, 1fr))`,
                              }}
                            >
                              <span class="note-name">Note</span>
                              <span class="note-freq">Freq</span>
                              <For each={sampleResults}>
                                {(r) => (
                                  <span class="note-offset-hdr">{r.algorithm}</span>
                                )}
                              </For>
                            </div>
                            {/* Data Rows */}
                            <For each={s().notes}>
                              {(note: { name: string; frequency: number }) => (
                                <div
                                  class="note-row"
                                  style={{
                                    'grid-template-columns': `60px 70px repeat(${sampleResults.length}, minmax(50px, 1fr))`,
                                  }}
                                >
                                  <span class="note-name">{note.name}</span>
                                  <span class="note-freq">
                                    {note.frequency.toFixed(0)} Hz
                                  </span>
                                  <For each={sampleResults}>
                                    {(result: AlgorithmResult) => {
                                      const matchingResult = result.results.find(
                                        (rr) => rr.targetFreq === note.frequency,
                                      )
                                      const band = matchingResult?.accuracyBand
                                      const color =
                                        band !== undefined
                                          ? (ACCURACY_BAND_COLORS[
                                              band as keyof typeof ACCURACY_BAND_COLORS
                                            ] || 'var(--text-muted)')
                                          : 'var(--text-muted)'
                                      const offsetCents =
                                        matchingResult?.offsetCents

                                      return (
                                        <span
                                          classList={{
                                            'note-offset': true,
                                            good:
                                              band !== undefined && band >= 90,
                                            ok: band === 75,
                                            bad:
                                              band !== undefined && band <= 50,
                                            miss: band === undefined,
                                          }}
                                          style={{ color }}
                                        >
                                          {matchingResult
                                            ? `${offsetCents!.toFixed(0)}`
                                            : ''}
                                        </span>
                                      )
                                    }}
                                  </For>
                                </div>
                              )}
                            </For>
                          </>
                        )}
                      </Show>
                    </div>
                  </div>
                )
              }}
            </For>
          </Show>
        </div>
      </div>
    </div>
  )
}
