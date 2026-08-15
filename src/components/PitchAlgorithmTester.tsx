// ============================================================
// Pitch Algorithm Tester — decision-oriented detector benchmark
// ============================================================

import type { Component } from 'solid-js'
import { createMemo, createSignal, For, Show } from 'solid-js'
import { Play, WaveformBars } from '@/components/icons'
import { REGISTERED_ALGORITHMS, TEST_SAMPLES } from '@/data/pitch-test-samples'
import type { AccuracyScoreBand, AlgorithmResult, PerformanceBand, PitchResultForNote, TestSample, } from '@/lib/pitch-algorithm-tester'
import { ACCURACY_BAND_LABELS, ACCURACY_BAND_NAMES, benchmarkAlgorithmAsync, DEFAULT_ALGORITHMS, getAccuracyScoreBand, getPerformanceClassification, } from '@/lib/pitch-algorithm-tester'
import type { PitchAlgorithm } from '@/lib/pitch-detector'
import styles from './PitchAlgorithmTester.module.css'

const RECOMMENDED_SAMPLE_IDS = ['octave-1', 'sharp-flat', 'noisy-low'] as const

const RECOMMENDED_SAMPLES = TEST_SAMPLES.filter((sample) =>
  RECOMMENDED_SAMPLE_IDS.some((id) => id === sample.id),
)

/** Speed badge tint per performance band. */
const PERF_CLASS: Record<PerformanceBand, string> = {
  excellent: styles.perfGreen,
  good: styles.perfBlue,
  acceptable: styles.perfYellow,
  slow: styles.perfOrange,
  'too-slow': styles.perfRed,
}

interface AlgorithmSummary {
  algorithm: PitchAlgorithm
  name: string
  score: number
  averageLatency: number
  averageOffset: number | null
  detectionRate: number
  noteCount: number
  sampleCount: number
}

interface PitchAlgorithmTesterProps {
  onClose?: () => void
}

function algorithmName(algorithm: PitchAlgorithm): string {
  return (
    REGISTERED_ALGORITHMS.find((candidate) => candidate.id === algorithm)
      ?.name ?? algorithm
  )
}

function bandClass(score: number): string {
  return styles[ACCURACY_BAND_NAMES[getAccuracyScoreBand(score)]]
}

function bandLabel(score: number): string {
  return ACCURACY_BAND_LABELS[getAccuracyScoreBand(score)]
}

function selectionMatches(
  selected: TestSample[],
  expectedIds: readonly string[],
): boolean {
  if (selected.length !== expectedIds.length) return false
  return expectedIds.every((id) => selected.some((sample) => sample.id === id))
}

function summarizeAlgorithms(results: AlgorithmResult[]): AlgorithmSummary[] {
  const grouped = new Map<PitchAlgorithm, AlgorithmResult[]>()

  for (const result of results) {
    const current = grouped.get(result.algorithm) ?? []
    current.push(result)
    grouped.set(result.algorithm, current)
  }

  return [...grouped.entries()]
    .map(([algorithm, algorithmResults]) => {
      const notes = algorithmResults.flatMap((result) => result.results)
      const detected = notes.filter((result) => result.detectedFreq > 0)
      const noteCount = notes.length

      return {
        algorithm,
        name: algorithmName(algorithm),
        score:
          noteCount === 0
            ? 0
            : Math.round(
                notes.reduce((sum, result) => sum + result.accuracyBand, 0) /
                  noteCount,
              ),
        averageLatency:
          noteCount === 0
            ? 0
            : notes.reduce((sum, result) => sum + result.computedTime, 0) /
              noteCount,
        averageOffset:
          detected.length === 0
            ? null
            : detected.reduce(
                (sum, result) => sum + Math.abs(result.offsetCents),
                0,
              ) / detected.length,
        detectionRate:
          noteCount === 0 ? 0 : (detected.length / noteCount) * 100,
        noteCount,
        sampleCount: algorithmResults.length,
      }
    })
    .sort(
      (left, right) =>
        right.score - left.score ||
        right.detectionRate - left.detectionRate ||
        left.averageLatency - right.averageLatency,
    )
}

function resultPresentation(result: PitchResultForNote | undefined): {
  value: string
  verdict: string
  band: AccuracyScoreBand | null
} {
  if (!result) {
    return { value: 'Not run', verdict: '', band: null }
  }

  if (result.detectedFreq <= 0) {
    return { value: 'No detection', verdict: 'Miss', band: 0 }
  }

  const band = getAccuracyScoreBand(result.accuracyBand)
  return {
    value: `${result.offsetCents.toFixed(1)}¢`,
    verdict: ACCURACY_BAND_LABELS[band],
    band,
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown benchmark error'
}

export const PitchAlgorithmTester: Component<
  PitchAlgorithmTesterProps
> = () => {
  const algorithms = REGISTERED_ALGORITHMS
  const samples = TEST_SAMPLES

  const [selectedAlgorithms, setSelectedAlgorithms] =
    createSignal<PitchAlgorithm[]>(DEFAULT_ALGORITHMS)
  const [selectedSamples, setSelectedSamples] = createSignal<TestSample[]>([
    ...RECOMMENDED_SAMPLES,
  ])
  const [running, setRunning] = createSignal(false)
  const [results, setResults] = createSignal<AlgorithmResult[]>([])
  const [progress, setProgress] = createSignal(0)
  const [progressText, setProgressText] = createSignal('')
  const [statusText, setStatusText] = createSignal('')
  const [benchmarkErrors, setBenchmarkErrors] = createSignal<string[]>([])

  const summaries = createMemo(() => summarizeAlgorithms(results()))
  const hasResults = createMemo(() => summaries().length > 0)
  const recommendedAlgorithm = createMemo(
    () => summaries()[0]?.algorithm ?? null,
  )
  const bestScore = createMemo(() => summaries()[0]?.score ?? 0)
  const fastestLatency = createMemo(() => {
    const values = summaries().map((summary) => summary.averageLatency)
    return values.length === 0 ? 0 : Math.min(...values)
  })

  const selectedNoteCount = createMemo(() =>
    selectedSamples().reduce((total, sample) => total + sample.notes.length, 0),
  )
  const benchmarkCount = createMemo(
    () => selectedAlgorithms().length * selectedSamples().length,
  )
  const noteEvaluationCount = createMemo(
    () => selectedAlgorithms().length * selectedNoteCount(),
  )
  const recommendedScopeSelected = createMemo(() =>
    selectionMatches(selectedSamples(), RECOMMENDED_SAMPLE_IDS),
  )
  const fullScopeSelected = createMemo(() =>
    selectionMatches(
      selectedSamples(),
      samples.map((sample) => sample.id),
    ),
  )

  const scopeSummary = createMemo(() => {
    const algorithmCount = selectedAlgorithms().length
    const sampleCount = selectedSamples().length

    if (algorithmCount === 0 || sampleCount === 0) {
      return 'Choose at least one algorithm and one sample set.'
    }

    return `${algorithmCount} algorithms × ${sampleCount} sample sets · ${benchmarkCount()} runs · ${noteEvaluationCount()} note evaluations`
  })

  const resultsBySample = createMemo(() => {
    const grouped = new Map<string, AlgorithmResult[]>()
    for (const result of results()) {
      const current = grouped.get(result.sampleId) ?? []
      current.push(result)
      grouped.set(result.sampleId, current)
    }
    return [...grouped.entries()]
  })

  const toggleAlgorithm = (algorithm: PitchAlgorithm) => {
    const selected = selectedAlgorithms()
    setSelectedAlgorithms(
      selected.includes(algorithm)
        ? selected.filter((candidate) => candidate !== algorithm)
        : [...selected, algorithm],
    )
  }

  const toggleSample = (sample: TestSample) => {
    const selected = selectedSamples()
    setSelectedSamples(
      selected.some((candidate) => candidate.id === sample.id)
        ? selected.filter((candidate) => candidate.id !== sample.id)
        : [...selected, sample],
    )
  }

  const runBenchmarks = async () => {
    if (running()) return

    // Signals must be read before the first await so this run has a stable
    // scope even if the component is later unmounted.
    const samplesToRun = [...selectedSamples()]
    const algorithmsToRun = [...selectedAlgorithms()]
    if (samplesToRun.length === 0 || algorithmsToRun.length === 0) return

    setRunning(true)
    setProgress(0)
    setProgressText('Preparing benchmark…')
    setStatusText('Benchmark started.')
    setBenchmarkErrors([])

    const allResults: AlgorithmResult[] = []
    const failures: string[] = []
    const totalRuns = samplesToRun.length * algorithmsToRun.length
    let completedRuns = 0

    try {
      for (const sample of samplesToRun) {
        for (const algorithm of algorithmsToRun) {
          const name = algorithmName(algorithm)
          setProgressText(
            `Testing ${name} on ${sample.name} · ${completedRuns + 1} of ${totalRuns}`,
          )

          try {
            const result = await benchmarkAlgorithmAsync(algorithm, sample, {
              sampleRate: 44100,
              bufferSize: 2048,
              minConfidence: 0.3,
            })
            allResults.push(result)
          } catch (error) {
            failures.push(`${name} on ${sample.name}: ${errorMessage(error)}`)
          }

          completedRuns += 1
          setProgress(Math.round((completedRuns / totalRuns) * 100))
          await new Promise<void>((resolve) => setTimeout(resolve, 0))
        }
      }

      setResults(allResults)
      setBenchmarkErrors(failures)
      setProgress(100)
      setProgressText('Benchmark complete.')

      const completedMessage = `${allResults.length} of ${totalRuns} runs completed.`
      setStatusText(
        failures.length === 0
          ? `Benchmark complete. ${completedMessage}`
          : `Benchmark complete with ${failures.length} failed ${failures.length === 1 ? 'run' : 'runs'}. ${completedMessage}`,
      )
    } finally {
      setRunning(false)
    }
  }

  return (
    <div class={styles.root} aria-busy={running()}>
      <div class={styles.header}>
        <span class={styles.kicker}>Detector decision bench</span>
        <h2>Compare accuracy with latency</h2>
        <p>
          Run every detector against the same generated pitch sets, then choose
          the best balance for real-time practice.
        </p>
      </div>

      <p class={styles.srOnly} aria-live="polite">
        {statusText()}
      </p>

      <div class={styles.layout}>
        <div class={styles.controls}>
          <div class={styles.scopeHeader}>
            <div>
              <h3>Benchmark scope</h3>
              <p id="benchmark-scope-summary">{scopeSummary()}</p>
            </div>
            <div
              class={styles.scopePresets}
              role="group"
              aria-label="Sample presets"
            >
              <button
                type="button"
                class={styles.scopePreset}
                classList={{ [styles.active]: recommendedScopeSelected() }}
                aria-pressed={recommendedScopeSelected()}
                disabled={running()}
                onClick={() => setSelectedSamples([...RECOMMENDED_SAMPLES])}
              >
                Recommended
              </button>
              <button
                type="button"
                class={styles.scopePreset}
                classList={{ [styles.active]: fullScopeSelected() }}
                aria-pressed={fullScopeSelected()}
                disabled={running()}
                onClick={() => setSelectedSamples([...samples])}
              >
                Full suite
              </button>
            </div>
          </div>

          <div class={styles.section}>
            <h3 id="benchmark-algorithms-heading">Algorithms</h3>
            <div
              class={styles.algorithmList}
              role="group"
              aria-labelledby="benchmark-algorithms-heading"
            >
              <For each={algorithms}>
                {(algorithm) => (
                  <label
                    class={styles.algorithmItem}
                    classList={{
                      [styles.selected]: selectedAlgorithms().includes(
                        algorithm.id,
                      ),
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={selectedAlgorithms().includes(algorithm.id)}
                      disabled={running()}
                      onChange={() => toggleAlgorithm(algorithm.id)}
                    />
                    <span class={styles.algoInfo}>
                      <span class={styles.algoName}>{algorithm.name}</span>
                      <span class={styles.algoDesc}>
                        {algorithm.description}
                      </span>
                    </span>
                  </label>
                )}
              </For>
            </div>
          </div>

          <details class={styles.sampleChooser}>
            <summary>
              <span>Customize sample sets</span>
              <span class={styles.selectionCount}>
                {selectedSamples().length}/{samples.length} selected
              </span>
            </summary>
            <div class={styles.samplePillList}>
              <For each={samples}>
                {(sample) => (
                  <button
                    type="button"
                    class={styles.samplePill}
                    classList={{
                      [styles.selected]: selectedSamples().some(
                        (candidate) => candidate.id === sample.id,
                      ),
                    }}
                    aria-pressed={selectedSamples().some(
                      (candidate) => candidate.id === sample.id,
                    )}
                    disabled={running()}
                    onClick={() => toggleSample(sample)}
                  >
                    {sample.name}
                  </button>
                )}
              </For>
            </div>
          </details>

          <div class={styles.actionPanel}>
            <button
              type="button"
              class={styles.runBtn}
              onClick={() => void runBenchmarks()}
              aria-describedby="benchmark-scope-summary"
              disabled={
                running() ||
                selectedSamples().length === 0 ||
                selectedAlgorithms().length === 0
              }
            >
              <Play />
              {running() ? `Running ${progress()}%` : 'Run benchmark'}
            </button>
            <span>Results replace the previous run.</span>
          </div>

          <Show when={running()}>
            <div class={styles.progress}>
              <div
                class={styles.progressBar}
                role="progressbar"
                aria-label="Benchmark progress"
                aria-valuemin="0"
                aria-valuemax="100"
                aria-valuenow={progress()}
              >
                <div
                  class={styles.progressFill}
                  style={{ width: `${progress()}%` }}
                />
              </div>
              <span class={styles.progressText} aria-live="polite">
                {progressText()}
              </span>
            </div>
          </Show>

          <Show when={benchmarkErrors().length > 0}>
            <div class={styles.errorPanel} role="alert">
              <strong>
                {benchmarkErrors().length}{' '}
                {benchmarkErrors().length === 1 ? 'run failed' : 'runs failed'}
              </strong>
              <p>Other completed results are still shown.</p>
              <ul>
                <For each={benchmarkErrors()}>
                  {(message) => <li>{message}</li>}
                </For>
              </ul>
            </div>
          </Show>
        </div>

        <div class={styles.results}>
          <Show
            when={hasResults()}
            fallback={
              <div class={styles.emptyResults}>
                <span class={styles.emptyGlyph} aria-hidden="true">
                  <WaveformBars />
                </span>
                <h3>No comparison yet</h3>
                <p>
                  The recommended scope covers clean notes, pitch variation and
                  noisy input. Run it to see which detector balances accuracy,
                  coverage and processing time.
                </p>
              </div>
            }
          >
            <div class={styles.resultsHeading}>
              <div>
                <span class={styles.kicker}>Decision summary</span>
                <h3>Algorithm comparison</h3>
              </div>
              <p>
                Ranked by accuracy, then detection coverage, then processing
                time.
              </p>
            </div>

            <div class={styles.comparisonTableViewport}>
              <table class={styles.comparisonTable}>
                <caption class={styles.srOnly}>
                  Algorithms ranked by accuracy, coverage and processing time
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Algorithm</th>
                    <th scope="col">Accuracy</th>
                    <th scope="col">Detected</th>
                    <th scope="col">Average offset</th>
                    <th scope="col">Processing</th>
                  </tr>
                </thead>
                <tbody>
                  <For each={summaries()}>
                    {(summary, index) => {
                      const performance = getPerformanceClassification(
                        summary.averageLatency,
                      )
                      const isRecommended =
                        summary.algorithm === recommendedAlgorithm()

                      return (
                        <tr classList={{ [styles.recommended]: isRecommended }}>
                          <th scope="row">
                            <span class={styles.rank}>#{index() + 1}</span>
                            <span class={styles.algorithmResultName}>
                              <strong>{summary.name}</strong>
                              <span>
                                {summary.sampleCount} sets · {summary.noteCount}{' '}
                                notes
                              </span>
                            </span>
                            <span class={styles.resultTags}>
                              <Show when={isRecommended}>
                                <span class={styles.recommendedTag}>
                                  Recommended
                                </span>
                              </Show>
                              <Show when={summary.score === bestScore()}>
                                <span class={styles.neutralTag}>
                                  Best accuracy
                                </span>
                              </Show>
                              <Show
                                when={
                                  summary.averageLatency === fastestLatency() &&
                                  summaries().length > 1
                                }
                              >
                                <span class={styles.neutralTag}>Fastest</span>
                              </Show>
                            </span>
                          </th>
                          <td>
                            <strong
                              class={`${styles.resultScore} ${bandClass(summary.score)}`}
                            >
                              {summary.score}/100
                            </strong>
                            <span class={styles.metricVerdict}>
                              {bandLabel(summary.score)}
                            </span>
                          </td>
                          <td>{summary.detectionRate.toFixed(0)}%</td>
                          <td>
                            {summary.averageOffset === null
                              ? 'No pitch'
                              : `${summary.averageOffset.toFixed(1)}¢`}
                          </td>
                          <td>
                            <strong>
                              {summary.averageLatency.toFixed(1)}ms
                            </strong>
                            <span
                              class={`${styles.perfBadge} ${PERF_CLASS[performance.band]}`}
                            >
                              {performance.label}
                            </span>
                          </td>
                        </tr>
                      )
                    }}
                  </For>
                </tbody>
              </table>
            </div>

            <div class={styles.detailHeading}>
              <div>
                <h3>Note-level details</h3>
                <p>Deviation is absolute cents from each target pitch.</p>
              </div>
              <div
                class={styles.bandLegend}
                role="group"
                aria-label="Accuracy bands"
              >
                <span>Perfect ≤10¢</span>
                <span>Good ≤25¢</span>
                <span>Okay ≤50¢</span>
                <span>Miss &gt;50¢</span>
              </div>
            </div>

            <div class={styles.detailSections}>
              <For each={resultsBySample()}>
                {([sampleId, sampleResults]) => {
                  const sample = samples.find(
                    (candidate) => candidate.id === sampleId,
                  )
                  const sampleName = sampleResults[0]?.sampleName ?? sampleId

                  return (
                    <Show when={sample}>
                      {(matchedSample) => (
                        <details class={styles.resultSection}>
                          <summary>
                            <span>{sampleName}</span>
                            <span>{matchedSample().notes.length} notes</span>
                          </summary>
                          <div class={styles.tableViewport}>
                            <table class={styles.detailTable}>
                              <caption class={styles.srOnly}>
                                Pitch deviation results for {sampleName}
                              </caption>
                              <thead>
                                <tr>
                                  <th scope="col">Note</th>
                                  <th scope="col">Target</th>
                                  <For each={sampleResults}>
                                    {(result) => (
                                      <th scope="col">
                                        {algorithmName(result.algorithm)}
                                      </th>
                                    )}
                                  </For>
                                </tr>
                              </thead>
                              <tbody>
                                <For each={matchedSample().notes}>
                                  {(note) => (
                                    <tr>
                                      <th scope="row">{note.name}</th>
                                      <td>{note.frequency.toFixed(0)} Hz</td>
                                      <For each={sampleResults}>
                                        {(result) => {
                                          const presentation =
                                            resultPresentation(
                                              result.results.find(
                                                (candidate) =>
                                                  candidate.targetFreq ===
                                                  note.frequency,
                                              ),
                                            )

                                          return (
                                            <td>
                                              <span
                                                class={styles.detailValue}
                                                classList={{
                                                  [styles.bandMuted]:
                                                    presentation.band === null,
                                                  [styles[
                                                    ACCURACY_BAND_NAMES[
                                                      presentation.band ?? 0
                                                    ]
                                                  ]]:
                                                    presentation.band !== null,
                                                }}
                                              >
                                                {presentation.value}
                                              </span>
                                              <Show when={presentation.verdict}>
                                                <span
                                                  class={styles.detailVerdict}
                                                >
                                                  {presentation.verdict}
                                                </span>
                                              </Show>
                                            </td>
                                          )
                                        }}
                                      </For>
                                    </tr>
                                  )}
                                </For>
                              </tbody>
                            </table>
                          </div>
                        </details>
                      )}
                    </Show>
                  )
                }}
              </For>
            </div>
          </Show>
        </div>
      </div>
    </div>
  )
}
