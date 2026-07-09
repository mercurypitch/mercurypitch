// ============================================================
// Pitch Algorithm Tester UI
// ============================================================

import type { Component } from 'solid-js'
import { createSignal, For, onCleanup, Show } from 'solid-js'
import { REGISTERED_ALGORITHMS, TEST_SAMPLES } from '@/data/pitch-test-samples'
import type { AlgorithmResult, TestSample } from '@/lib/pitch-algorithm-tester'
import { ACCURACY_BAND_COLORS, benchmarkAlgorithmAsync, DEFAULT_ALGORITHMS, getPerformanceClassification, } from '@/lib/pitch-algorithm-tester'
import type { PitchAlgorithm } from '@/lib/pitch-detector'
import styles from './PitchAlgorithmTester.module.css'

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
    void runBenchmarks(samples, selectedAlgorithms())
  }

  const runSelected = () => {
    void runBenchmarks(selectedSamples(), selectedAlgorithms())
  }

  const runBenchmarks = async (
    samplesToRun: TestSample[],
    algosToRun: PitchAlgorithm[],
  ) => {
    if (samplesToRun.length === 0 || algosToRun.length === 0 || running())
      return

    setRunning(true)
    setShowResults(false)
    setProgress(0)
    setProgressText('Running tests...')

    const allResults: AlgorithmResult[] = []
    const totalOps = samplesToRun.length * algosToRun.length
    let completed = 0

    for (const sample of samplesToRun) {
      for (const algo of algosToRun) {
        setProgressText(`Testing ${algo} on ${sample.name}...`)
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
        await new Promise((r) => setTimeout(r, 0))
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
    <div class={styles.root}>
      <div class={styles.header}>
        <h2>Pitch Algorithm Tester</h2>
      </div>

      <div class={styles.layout} classList={{ [styles.busy]: running() }}>
        {/* Left Column: Controls */}
        <div class={styles.controls}>
          {/* Algorithm Selection */}
          <div class={styles.section}>
            <h3>Algorithms</h3>
            <div class={styles.algorithmList}>
              <For each={algorithms}>
                {(algo: {
                  id: PitchAlgorithm
                  name: string
                  description: string
                }) => (
                  <label
                    class={styles.algorithmItem}
                    classList={{
                      [styles.selected]: selectedAlgorithms().includes(algo.id),
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={selectedAlgorithms().includes(algo.id)}
                      onChange={() => toggleAlgorithm(algo.id)}
                    />
                    <div class={styles.algoInfo}>
                      <span class={styles.algoName}>{algo.name}</span>
                      <span class={styles.algoDesc}>{algo.description}</span>
                    </div>
                  </label>
                )}
              </For>
            </div>
          </div>

          {/* Sample Selection */}
          <div class={styles.section}>
            <h3>Test Samples</h3>
            <div class={styles.samplePillList}>
              <For each={samples}>
                {(sample: TestSample) => (
                  <button
                    class={styles.samplePill}
                    classList={{
                      [styles.selected]:
                        selectedSamples().find((s) => s.id === sample.id) !==
                        undefined,
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
          <div class={styles.buttons}>
            <button
              class={styles.runBtn}
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
              class={styles.runAllBtn}
              onClick={runAll}
              disabled={running()}
            >
              Run All
            </button>
          </div>

          {/* Progress Bar */}
          <Show when={running()}>
            <div class={styles.progress}>
              <div class={styles.progressBar}>
                <div
                  class={styles.progressFill}
                  style={{ width: `${progress()}%` }}
                />
              </div>
              <span class={styles.progressText}>{progressText()}</span>
            </div>
          </Show>

          {/* Legend */}
          <Show when={showResults()}>
            <div class={styles.resultsLegend}>
              <span class={styles.legendItem}>
                <span class={`${styles.legendDot} ${styles.legendGood}`} /> 10
                perfect
              </span>
              <span class={styles.legendItem}>
                <span class={`${styles.legendDot} ${styles.legendOk}`} /> 25
                good
              </span>
              <span class={styles.legendItem}>
                <span class={`${styles.legendDot} ${styles.legendBad}`} /> 50
                okay
              </span>
              <span class={styles.legendItem}>
                <span class={`${styles.legendDot} ${styles.legendMiss}`} /> no
                det
              </span>
            </div>
          </Show>
        </div>

        {/* Right Column: Results */}
        <div class={styles.results}>
          <Show when={showResults()}>
            {/* Summary Cards */}
            <div class={styles.overallScore}>
              <For each={results()}>
                {(result: AlgorithmResult) => {
                  const perf = getPerformanceClassification(
                    result.avgComputationTime,
                  )
                  const perfClass: Record<string, string> = {
                    green: styles.perfGreen,
                    yellow: styles.perfYellow,
                    red: styles.perfRed,
                  }
                  const color =
                    ACCURACY_BAND_COLORS[
                      result.totalScore as keyof typeof ACCURACY_BAND_COLORS
                    ] || '#666'

                  return (
                    <div class={styles.resultCard}>
                      <div class={styles.resultCardLeft}>
                        <span class={styles.resultAlgoName}>
                          {result.algorithm}
                        </span>
                        <span
                          class={`${styles.perfBadge} ${perfClass[perf.color]}`}
                        >
                          {perf.label}
                        </span>
                      </div>
                      <div class={styles.resultCardRight}>
                        <span class={styles.resultScore} style={{ color }}>
                          {result.totalScore}
                          <span class={styles.scoreMax}>/100</span>
                        </span>
                        <span class={styles.resultTime}>
                          {result.avgComputationTime.toFixed(1)}ms
                        </span>
                        <span
                          class={styles.resultOffset}
                          classList={{
                            [styles.good]: result.avgOffsetCents <= 10,
                            [styles.bad]: result.avgOffsetCents > 10,
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
                const sampleObj = samples.find((s) => s.id === sampleId)

                return (
                  <div class={styles.resultSection}>
                    <div class={styles.resultSampleName}>{sampleName}</div>
                    <div class={styles.detailedResults}>
                      <Show when={sampleObj}>
                        {(s) => (
                          <>
                            {/* Header Row */}
                            <div
                              class={`${styles.resultRow} ${styles.headerRow}`}
                              style={{
                                'grid-template-columns': `80px 100px repeat(${sampleResults.length}, minmax(80px, 1fr))`,
                              }}
                            >
                              <span class={styles.resultName}>Note</span>
                              <span class={styles.resultFreq}>Freq</span>
                              <For each={sampleResults}>
                                {(r) => (
                                  <span class={styles.resultDev}>
                                    {r.algorithm}
                                  </span>
                                )}
                              </For>
                            </div>
                            {/* Data Rows */}
                            <For each={s().notes}>
                              {(note: { name: string; frequency: number }) => (
                                <div
                                  class={styles.resultRow}
                                  style={{
                                    'grid-template-columns': `80px 100px repeat(${sampleResults.length}, minmax(80px, 1fr))`,
                                  }}
                                >
                                  <span class={styles.resultName}>
                                    {note.name}
                                  </span>
                                  <span class={styles.resultFreq}>
                                    {note.frequency.toFixed(0)} Hz
                                  </span>
                                  <For each={sampleResults}>
                                    {(result: AlgorithmResult) => {
                                      const matchingResult =
                                        result.results.find(
                                          (rr) =>
                                            rr.targetFreq === note.frequency,
                                        )
                                      const band = matchingResult?.accuracyBand
                                      const color =
                                        band !== undefined
                                          ? ACCURACY_BAND_COLORS[
                                              band as keyof typeof ACCURACY_BAND_COLORS
                                            ] || 'var(--text-muted)'
                                          : 'var(--text-muted)'
                                      const offsetCents =
                                        matchingResult?.offsetCents

                                      return (
                                        <span
                                          class={styles.resultDev}
                                          classList={{
                                            [styles.resultDevGood]:
                                              band !== undefined && band >= 90,
                                            [styles.resultDevPoor]:
                                              band !== undefined && band <= 50,
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

          <Show when={!showResults()}>
            <div class={styles.emptyResults}>
              Select algorithms and samples above, then click Run to benchmark.
            </div>
          </Show>
        </div>
      </div>
    </div>
  )
}
